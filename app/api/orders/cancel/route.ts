import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin-db';
import { FieldValue } from 'firebase-admin/firestore';
import Razorpay from 'razorpay';

const CANCELLATION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const { orderId, userId, reason } = await request.json();

    if (!orderId || !userId || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch order from Firestore using Admin SDK
    const orderRef = adminDb.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orderSnap.data()!;

    // Security: Verify customer owns this order
    if (order.customerId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check order is cancellable
    const nonCancellableStatuses = ['preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];
    if (nonCancellableStatuses.includes(order.status)) {
      return NextResponse.json({
        error: order.status === 'preparing'
          ? 'Your order is already being prepared. Please contact Hunger Support.'
          : `Order cannot be cancelled in ${order.status} status`
      }, { status: 400 });
    }

    // Server-side 5-minute window check
    const createdAt = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
    const now = new Date();
    const elapsedMs = now.getTime() - createdAt.getTime();

    if (elapsedMs > CANCELLATION_WINDOW_MS) {
      return NextResponse.json({
        error: 'Cancellation window expired. Please contact Hunger Support.'
      }, { status: 400 });
    }

    // Idempotency: Check if already cancelled
    if (order.status === 'cancelled') {
      return NextResponse.json({ error: 'Order already cancelled' }, { status: 400 });
    }

    // Check for existing refund
    const existingRefunds = await adminDb.collection('refunds')
      .where('orderId', '==', orderId)
      .where('status', 'in', ['INITIATED', 'PROCESSING', 'COMPLETED'])
      .get();

    if (!existingRefunds.empty) {
      return NextResponse.json({
        success: true,
        message: 'Order already cancelled with refund in progress',
        refundId: existingRefunds.docs[0].id
      });
    }

    // Run everything in a Firestore transaction
    const result = await adminDb.runTransaction(async (tx) => {
      // Re-read order inside transaction
      const orderDoc = await tx.get(orderRef);
      const orderData = orderDoc.data()!;

      if (orderData.status === 'cancelled') {
        throw new Error('Order already cancelled');
      }

      // 1. Update order status
      tx.update(orderRef, {
        status: 'cancelled',
        cancelledAt: FieldValue.serverTimestamp(),
        cancellationReason: reason,
        cancelledBy: 'CUSTOMER',
        updatedAt: FieldValue.serverTimestamp()
      });

      // 2. Create cancellation record
      const cancellationRef = adminDb.collection('orderCancellations').doc();
      tx.set(cancellationRef, {
        orderId,
        userId,
        cancelledBy: 'CUSTOMER',
        reason,
        cancelledAt: FieldValue.serverTimestamp(),
        refundRequired: ['online', 'wallet'].includes(orderData.paymentMethod) && orderData.paymentStatus === 'completed',
        refundId: null
      });

      // 3. Create audit log
      const auditRef = adminDb.collection('auditLogs').doc();
      tx.set(auditRef, {
        action: 'ORDER_CANCELLED',
        orderId,
        userId,
        restaurantId: orderData.restaurantId,
        performedBy: 'CUSTOMER',
        reason,
        timestamp: FieldValue.serverTimestamp()
      });

      return { orderData, cancellationId: cancellationRef.id };
    });

    const { orderData, cancellationId } = result;

    // 4. Send notification to restaurant
    try {
      await adminDb.collection('notifications').add({
        userId: orderData.restaurantId,
        userType: 'restaurant',
        type: 'order',
        subType: 'order-cancelled',
        title: 'Order Cancelled',
        message: `Order #${orderId.substring(0, 8).toUpperCase()} was cancelled by customer. Reason: ${reason}`,
        isRead: false,
        read: false,
        deleted: false,
        orderId,
        cancellationId,
        createdAt: FieldValue.serverTimestamp()
      });
    } catch (notifErr) {
      console.error('[cancel] Restaurant notification failed:', notifErr);
    }

    // 5. Process refund
    let refundResult = { refundId: null as string | null, refundMethod: 'NONE', status: 'NOT_REQUIRED' };

    const needsRefund = ['online', 'wallet'].includes(orderData.paymentMethod) && orderData.paymentStatus === 'completed';

    if (needsRefund) {
      const refundAmount = orderData.total || 0;
      const refundRef = adminDb.collection('refunds').doc();

      if (orderData.paymentMethod === 'wallet') {
        // Instant wallet refund
        await adminDb.runTransaction(async (tx) => {
          const walletRef = adminDb.collection('wallets').doc(userId);
          const walletSnap = await tx.get(walletRef);

          const currentBalance = walletSnap.exists ? (walletSnap.data()?.balance || 0) : 0;

          // Update or create wallet
          tx.set(walletRef, {
            userId,
            balance: currentBalance + refundAmount,
            currency: 'INR',
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });

          // Also update customer document balance field
          tx.update(adminDb.collection('customers').doc(userId), {
            walletBalance: FieldValue.increment(refundAmount)
          });

          // Create refund record
          tx.set(refundRef, {
            refundId: refundRef.id,
            orderId,
            userId,
            restaurantId: orderData.restaurantId,
            amount: refundAmount,
            paymentMethod: 'wallet',
            refundMethod: 'WALLET',
            status: 'COMPLETED',
            reason: 'CUSTOMER_CANCELLATION',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            completedAt: FieldValue.serverTimestamp()
          });

          // Create wallet transaction ledger entry
          const walletTxRef = adminDb.collection('walletTransactions').doc();
          tx.set(walletTxRef, {
            transactionId: walletTxRef.id,
            userId,
            type: 'CREDIT',
            source: 'ORDER_REFUND',
            amount: refundAmount,
            orderId,
            refundId: refundRef.id,
            status: 'COMPLETED',
            description: `Refund for cancelled order #${orderId.substring(0, 8).toUpperCase()}`,
            createdAt: FieldValue.serverTimestamp()
          });
        });

        // Update cancellation with refund ID
        await adminDb.collection('orderCancellations').doc(cancellationId).update({
          refundId: refundRef.id
        });

        // Create audit log for wallet refund
        await adminDb.collection('auditLogs').add({
          action: 'WALLET_CREDITED',
          orderId,
          refundId: refundRef.id,
          userId,
          amount: refundAmount,
          performedBy: 'SYSTEM',
          timestamp: FieldValue.serverTimestamp()
        });

        // Customer notification
        await adminDb.collection('notifications').add({
          userId,
          userType: 'customer',
          type: 'payment',
          subType: 'wallet-refund',
          title: 'Refund Credited 💰',
          message: `₹${refundAmount.toFixed(2)} has been credited to your Hunger Wallet.`,
          isRead: false,
          read: false,
          deleted: false,
          orderId,
          refundId: refundRef.id,
          createdAt: FieldValue.serverTimestamp()
        });

        refundResult = { refundId: refundRef.id, refundMethod: 'WALLET', status: 'COMPLETED' };

      } else if (orderData.paymentMethod === 'online' && orderData.razorpayPaymentId) {
        // Razorpay online refund
        try {
          const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID!,
            key_secret: process.env.RAZORPAY_KEY_SECRET!
          });

          const razorpayRefund = await razorpay.payments.refund(orderData.razorpayPaymentId, {
            amount: Math.round(refundAmount * 100), // paise
            speed: 'normal',
            notes: {
              orderId,
              userId,
              reason: 'Customer Cancellation'
            },
            receipt: refundRef.id
          });

          await refundRef.set({
            refundId: refundRef.id,
            orderId,
            userId,
            restaurantId: orderData.restaurantId,
            amount: refundAmount,
            paymentMethod: 'online',
            refundMethod: 'RAZORPAY',
            status: 'INITIATED',
            razorpayPaymentId: orderData.razorpayPaymentId,
            razorpayRefundId: razorpayRefund.id,
            reason: 'CUSTOMER_CANCELLATION',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            completedAt: null
          });

          // Update cancellation with refund ID
          await adminDb.collection('orderCancellations').doc(cancellationId).update({
            refundId: refundRef.id
          });

          // Audit log
          await adminDb.collection('auditLogs').add({
            action: 'REFUND_INITIATED',
            orderId,
            refundId: refundRef.id,
            razorpayRefundId: razorpayRefund.id,
            userId,
            amount: refundAmount,
            performedBy: 'SYSTEM',
            timestamp: FieldValue.serverTimestamp()
          });

          // Customer notification
          await adminDb.collection('notifications').add({
            userId,
            userType: 'customer',
            type: 'payment',
            subType: 'refund-initiated',
            title: 'Refund Initiated',
            message: `Your ₹${refundAmount.toFixed(2)} refund has been initiated. It may take 2–7 business days to appear.`,
            isRead: false,
            read: false,
            deleted: false,
            orderId,
            refundId: refundRef.id,
            createdAt: FieldValue.serverTimestamp()
          });

          refundResult = { refundId: refundRef.id, refundMethod: 'RAZORPAY', status: 'INITIATED' };
        } catch (rzpErr: any) {
          console.error('[cancel] Razorpay refund failed:', rzpErr);

          // Create manual review refund
          await refundRef.set({
            refundId: refundRef.id,
            orderId,
            userId,
            restaurantId: orderData.restaurantId,
            amount: refundAmount,
            paymentMethod: 'online',
            refundMethod: 'RAZORPAY',
            status: 'MANUAL_REVIEW',
            razorpayPaymentId: orderData.razorpayPaymentId,
            razorpayRefundId: null,
            reason: 'CUSTOMER_CANCELLATION',
            failureReason: rzpErr.message || 'Razorpay refund initiation failed',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            completedAt: null
          });

          await adminDb.collection('notifications').add({
            userId,
            userType: 'customer',
            type: 'payment',
            subType: 'refund-manual',
            title: 'Refund Under Review',
            message: `We couldn't process your refund automatically. Our support team will review it shortly.`,
            isRead: false,
            read: false,
            deleted: false,
            orderId,
            refundId: refundRef.id,
            createdAt: FieldValue.serverTimestamp()
          });

          refundResult = { refundId: refundRef.id, refundMethod: 'RAZORPAY', status: 'MANUAL_REVIEW' };
        }
      }
    }

    // Customer cancellation notification
    await adminDb.collection('notifications').add({
      userId,
      userType: 'customer',
      type: 'order',
      subType: 'order-cancelled',
      title: 'Order Cancelled',
      message: `Your order #${orderId.substring(0, 8).toUpperCase()} has been cancelled successfully.`,
      isRead: false,
      read: false,
      deleted: false,
      orderId,
      createdAt: FieldValue.serverTimestamp()
    });

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
      cancellationId,
      refund: refundResult
    });

  } catch (error: any) {
    console.error('[cancel] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel order' },
      { status: 500 }
    );
  }
}
