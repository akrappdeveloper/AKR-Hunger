import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  increment,
  addDoc,
  collection
} from 'firebase/firestore';

/**
 * Valid state transitions table for the Hunger delivery lifecycle.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  // Initial / confirmed states
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'ready', 'going_to_restaurant', 'searching_for_partner', 'cancelled'],
  preparing: ['ready', 'going_to_restaurant', 'cancelled'],
  ready: ['going_to_restaurant', 'at_restaurant', 'out_for_delivery', 'picked_up', 'cancelled'],

  // In-transit stages
  going_to_restaurant: ['at_restaurant', 'picked_up', 'out_for_delivery', 'cancelled'],
  at_restaurant: ['picked_up', 'out_for_delivery', 'cancelled'],
  picked_up: ['out_for_delivery', 'going_to_customer', 'arrived', 'returning', 'cancelled'],
  out_for_delivery: ['going_to_customer', 'arrived', 'delivered', 'delivery_failed', 'returning', 'cancelled'],
  going_to_customer: ['arrived', 'delivered', 'delivery_failed', 'returning', 'cancelled'],
  arrived: ['delivered', 'delivery_failed', 'returning'],

  // Final states
  delivered: [],
  cancelled: ['returning'],
  returned: [],
  delivery_failed: ['returning', 'cancelled'],
  returning: ['returned'],
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      orderId,
      targetStatus,
      targetStage,
      userId,
      role = 'partner',
      deliveryOtp,
      proofNote,
      reason,
    } = body;

    if (!orderId || (!targetStatus && !targetStage)) {
      return NextResponse.json(
        { error: 'orderId and targetStatus or targetStage are required' },
        { status: 400 }
      );
    }

    const orderRef = doc(db, 'orders', orderId);

    const result = await runTransaction(db, async (transaction) => {
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists()) {
        throw new Error(`Order #${orderId} does not exist`);
      }

      const order = orderSnap.data();
      const currentStatus = order.deliveryStatus || order.status || 'pending';
      const currentStage = order.deliveryStage || (order.delivery?.stage) || '';

      const effectiveTargetStatus = (targetStatus || targetStage).toLowerCase();

      // Authorization verification
      if (role === 'partner' && userId) {
        if (order.deliveryPersonId && order.deliveryPersonId !== userId) {
          throw new Error('Unauthorized: You are not the assigned delivery partner for this order.');
        }
      }

      // Special verification for DELIVERED
      if (effectiveTargetStatus === 'delivered') {
        const expectedOtp = order.deliveryOtp ? String(order.deliveryOtp).trim() : '';
        const suppliedOtp = deliveryOtp ? String(deliveryOtp).trim() : '';

        // If OTP exists on order, verify it (unless admin override)
        if (expectedOtp && role !== 'admin') {
          if (!suppliedOtp || suppliedOtp !== expectedOtp) {
            throw new Error('Invalid delivery OTP. Please verify with customer.');
          }
        }
      }

      // State transition validation (admins can override if needed)
      if (role !== 'admin') {
        const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
        const isAllowedStatus = allowed.includes(effectiveTargetStatus) || allowed.includes(targetStatus);
        
        // Also permit stage progression (e.g., at_restaurant -> picked_up)
        const isKnownStage = ['going_to_restaurant', 'at_restaurant', 'picked_up', 'going_to_customer', 'arrived', 'delivered'].includes(effectiveTargetStatus);

        if (!isAllowedStatus && !isKnownStage) {
          throw new Error(`Invalid transition from "${currentStatus}" to "${effectiveTargetStatus}".`);
        }
      }

      // Prepare updates
      const updates: Record<string, any> = {
        updatedAt: serverTimestamp(),
      };

      if (effectiveTargetStatus === 'delivered') {
        updates.status = 'delivered';
        updates.deliveryStatus = 'delivered';
        updates.deliveryStage = 'delivered';
        updates.deliveredAt = serverTimestamp();
        if (proofNote) updates.proofNote = proofNote;

        // Clear driver active order
        if (order.deliveryPersonId) {
          const driverLocRef = doc(db, 'driverLocations', order.deliveryPersonId);
          transaction.set(driverLocRef, {
            activeOrderId: null,
            availabilityStatus: 'available',
            updatedAt: serverTimestamp(),
          }, { merge: true });

          // Update partner earnings in deliveryPersons
          const partnerRef = doc(db, 'deliveryPersons', order.deliveryPersonId);
          const earning = Number(order.deliveryCharge || 40);
          transaction.update(partnerRef, {
            todayEarnings: increment(earning),
            totalEarnings: increment(earning),
            walletBalance: increment(earning),
            totalDeliveries: increment(1),
          });
        }
      } else if (effectiveTargetStatus === 'picked_up') {
        updates.status = 'out_for_delivery';
        updates.deliveryStatus = 'going_to_customer';
        updates.deliveryStage = 'to_customer';
        updates.pickedUpAt = serverTimestamp();
      } else if (effectiveTargetStatus === 'at_restaurant') {
        updates.deliveryStatus = 'at_restaurant';
        updates.deliveryStage = 'at_restaurant';
        updates.arrivedAtRestaurantAt = serverTimestamp();
      } else if (effectiveTargetStatus === 'going_to_restaurant') {
        updates.deliveryStatus = 'going_to_restaurant';
        updates.deliveryStage = 'to_restaurant';
      } else if (effectiveTargetStatus === 'arrived') {
        updates.deliveryStatus = 'arrived';
        updates.deliveryStage = 'arrived';
        updates.arrivedAtCustomerAt = serverTimestamp();
      } else if (effectiveTargetStatus === 'returning') {
        updates.deliveryStatus = 'returning';
        updates.deliveryStage = 'returning';
      } else if (effectiveTargetStatus === 'returned') {
        updates.deliveryStatus = 'returned';
        updates.deliveryStage = 'returned';
        updates.returnedAt = serverTimestamp();

        // Release driver
        if (order.deliveryPersonId) {
          const driverLocRef = doc(db, 'driverLocations', order.deliveryPersonId);
          transaction.set(driverLocRef, {
            activeOrderId: null,
            availabilityStatus: 'available',
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
      } else {
        updates.deliveryStatus = effectiveTargetStatus;
        if (targetStage) updates.deliveryStage = targetStage;
      }

      transaction.update(orderRef, updates);

      return {
        orderId,
        previousStatus: currentStatus,
        newStatus: effectiveTargetStatus,
        updatedAt: new Date().toISOString(),
      };
    });

    // Record audit entry
    try {
      await addDoc(collection(db, 'auditLogs'), {
        action: 'delivery_status_transition',
        orderId,
        userId: userId || null,
        role,
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
        reason: reason || null,
        timestamp: serverTimestamp(),
      });
    } catch { }

    return NextResponse.json({
      success: true,
      message: `Status updated to ${result.newStatus}`,
      ...result,
    });
  } catch (err: any) {
    console.error('[API /api/delivery/order-status] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Status transition error' },
      { status: 400 }
    );
  }
}
