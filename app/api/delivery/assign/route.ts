import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  arrayUnion,
  serverTimestamp
} from 'firebase/firestore';
import {
  discoverEligiblePartners,
  assignOrderToPartner,
  DELIVERY_ASSIGNMENT_DEFAULTS,
} from '@/lib/delivery-assignment';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, orderId, partnerId, adminId, reason, radiusKm } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    // 1. Fetch Order
    const orderDoc = await getDoc(doc(db, 'orders', orderId));
    if (!orderDoc.exists()) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const order = orderDoc.data();

    // Extract restaurant coordinates
    let restLat = order.restaurantLocation?.lat || order.delivery?.pickup?.latitude;
    let restLng = order.restaurantLocation?.lng || order.delivery?.pickup?.longitude;

    if (!restLat || !restLng) {
      if (order.restaurantId) {
        const restDoc = await getDoc(doc(db, 'restaurants', order.restaurantId));
        if (restDoc.exists()) {
          const rData = restDoc.data();
          restLat = rData.latitude || rData.coordinates?.latitude;
          restLng = rData.longitude || rData.coordinates?.longitude;
        }
      }
    }

    if (!restLat || !restLng) {
      return NextResponse.json(
        { error: 'Restaurant verified coordinates not available for this order' },
        { status: 400 }
      );
    }

    // Handle Action
    switch (action) {
      case 'discover_candidates': {
        const candidates = await discoverEligiblePartners(restLat, restLng, {
          assignmentRadiusKm: radiusKm ? Number(radiusKm) : undefined,
          excludePartnerIds: order.rejectedPartnerIds || [],
          requiredPincode: order.restaurantPincode || undefined,
        });

        return NextResponse.json({
          orderId,
          restaurantCoordinates: { latitude: restLat, longitude: restLng },
          candidateCount: candidates.length,
          candidates,
          assignmentRadiusKm: radiusKm || DELIVERY_ASSIGNMENT_DEFAULTS.DEFAULT_ASSIGNMENT_RADIUS_KM,
        });
      }

      case 'auto_assign': {
        const candidates = await discoverEligiblePartners(restLat, restLng, {
          assignmentRadiusKm: radiusKm ? Number(radiusKm) : undefined,
          excludePartnerIds: order.rejectedPartnerIds || [],
        });

        if (candidates.length === 0) {
          // Update order status to note that no partners were currently available
          await updateDoc(doc(db, 'orders', orderId), {
            assignmentStatus: 'failed_no_partner',
            lastAssignmentAttemptAt: serverTimestamp(),
          });

          return NextResponse.json(
            {
              success: false,
              message: 'No eligible delivery partners found within search radius',
              assignmentStatus: 'failed_no_partner',
            },
            { status: 404 }
          );
        }

        const selected = candidates[0];
        const assigned = await assignOrderToPartner(orderId, selected.partnerId, {
          assignmentType: 'auto',
          reason: 'Nearest eligible online partner',
        });

        return NextResponse.json({
          success: true,
          message: `Order assigned to ${assigned.partnerName}`,
          assigned,
        });
      }

      case 'manual_assign': {
        if (!partnerId) {
          return NextResponse.json({ error: 'partnerId is required for manual assignment' }, { status: 400 });
        }

        const assigned = await assignOrderToPartner(orderId, partnerId, {
          assignmentType: 'manual',
          adminId,
          reason: reason || 'Manual dispatch by administrator',
        });

        return NextResponse.json({
          success: true,
          message: `Order manually assigned to ${assigned.partnerName}`,
          assigned,
        });
      }

      case 'reject_offer': {
        if (!partnerId) {
          return NextResponse.json({ error: 'partnerId is required' }, { status: 400 });
        }

        // Add partner to rejected list and clear assignment if it was pending
        await updateDoc(doc(db, 'orders', orderId), {
          rejectedPartnerIds: arrayUnion(partnerId),
          updatedAt: serverTimestamp(),
        });

        return NextResponse.json({
          success: true,
          message: 'Assignment rejected and logged',
        });
      }

      default:
        return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[API /api/delivery/assign] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal assignment error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // 1. Fetch unassigned orders waiting for delivery
    const waitingQuery = query(
      collection(db, 'orders'),
      where('status', 'in', ['confirmed', 'preparing', 'ready']),
      where('deliveryPersonId', '==', null)
    );
    const waitingSnap = await getDocs(waitingQuery);

    const waitingOrders = waitingSnap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));

    // 2. Fetch partner counts
    const partnersSnap = await getDocs(collection(db, 'deliveryPersons'));
    const locationsSnap = await getDocs(
      query(collection(db, 'driverLocations'), where('isOnline', '==', true))
    );

    const totalPartners = partnersSnap.size;
    const onlineDrivers = locationsSnap.docs.map(d => d.data());
    const busyCount = onlineDrivers.filter(d => d.activeOrderId || d.availabilityStatus === 'busy').length;
    const availableCount = onlineDrivers.length - busyCount;

    return NextResponse.json({
      waitingOrdersCount: waitingOrders.length,
      waitingOrders,
      fleetSummary: {
        totalPartners,
        onlineCount: onlineDrivers.length,
        availableCount,
        busyCount,
      },
      defaults: DELIVERY_ASSIGNMENT_DEFAULTS,
    });
  } catch (err: any) {
    console.error('[API /api/delivery/assign GET] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch assignment status' },
      { status: 500 }
    );
  }
}
