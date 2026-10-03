import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin-db';
import { FieldValue } from 'firebase-admin/firestore';
import Razorpay from 'razorpay';

export async function POST(request: NextRequest) {
  try {
    const { refundId, adminId, action, notes } = await request.json();

    if (!refundId || !adminId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const refundRef = adminDb.collection('refunds').doc(refundId);
    const refundSnap = await refundRef.get();

    if (!refundSnap.exists) {
      return NextResponse.json({ error: 'Refund not found' }, { status: 404 });
    }

    const refund = refundSnap.data()!;

    if (action === 'RETRY_RAZORPAY') {
      // Idempotency: don't create if already completed/processing
      if (['COMPLETED', 'PROCESSING', 'INITIATED'].includes(refund.status)) {
        return NextResponse.json({
          error: `Refund is already in ${refund.status} status`
        }, { status: 400 });
      }

      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID!,
        key_secret: process.env.RAZORPAY_KEY_SECRET!
      });

      const razorpayRefund = await razorpay.payments.refund(refund.razorpayPaymentId, {
        amount: Math.round(refund.amount * 100),
        speed: 'normal',
        notes: { orderId: refund.orderId, adminRetry: 'true', adminId, notes: notes || '' },
        receipt: refundId
      });

      await refundRef.update({
        status: 'INITIATED',
        razorpayRefundId: razorpayRefund.id,
        updatedAt: FieldValue.serverTimestamp()
      });

      await adminDb.collection('auditLogs').add({
        action: 'ADMIN_REFUND_RETRY',
        refundId,
        orderId: refund.orderId,
        razorpayRefundId: razorpayRefund.id,
        performedBy: adminId,
        notes: notes || '',
        timestamp: FieldValue.serverTimestamp()
      });

      return NextResponse.json({ success: true, razorpayRefundId: razorpayRefund.id });
    }

    if (action === 'APPROVE_WALLET') {
      // Manual wallet credit for special cases (COD/disputes)
      if (refund.status === 'COMPLETED') {
        return NextResponse.json({ error: 'Refund already completed' }, { status: 400 });
      }

      const amount = refund.amount;
      const userId = refund.userId;

      await adminDb.runTransaction(async (tx) => {
        const walletRef = adminDb.collection('wallets').doc(userId);
        const walletSnap = await tx.get(walletRef);
        const currentBalance = walletSnap.exists ? (walletSnap.data()?.balance || 0) : 0;

        tx.set(walletRef, {
          userId,
          balance: currentBalance + amount,
          currency: 'INR',
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });

        tx.update(adminDb.collection('customers').doc(userId), {
          walletBalance: FieldValue.increment(amount)
        });

        tx.update(refundRef, {
          status: 'COMPLETED',
          refundMethod: 'WALLET',
          adminApprovedBy: adminId,
          updatedAt: FieldValue.serverTimestamp(),
          completedAt: FieldValue.serverTimestamp()
        });

        const walletTxRef = adminDb.collection('walletTransactions').doc();
        tx.set(walletTxRef, {
          transactionId: walletTxRef.id,
          userId,
          type: 'CREDIT',
          source: 'ORDER_REFUND',
          amount,
          orderId: refund.orderId,
          refundId,
          status: 'COMPLETED',
          description: `Admin approved wallet refund for order #${refund.orderId?.substring(0, 8).toUpperCase()}`,
          adminId,
          createdAt: FieldValue.serverTimestamp()
        });
      });

      await adminDb.collection('auditLogs').add({
        action: 'ADMIN_REFUND_APPROVED',
        refundId,
        orderId: refund.orderId,
        userId: refund.userId,
        amount: refund.amount,
        performedBy: adminId,
        notes: notes || '',
        timestamp: FieldValue.serverTimestamp()
      });

      // Notify customer
      await adminDb.collection('notifications').add({
        userId: refund.userId,
        userType: 'customer',
        type: 'payment',
        subType: 'refund-completed',
        title: 'Refund Completed ✅',
        message: `₹${refund.amount?.toFixed(2)} has been credited to your Hunger Wallet.`,
        isRead: false,
        read: false,
        deleted: false,
        orderId: refund.orderId,
        refundId,
        createdAt: FieldValue.serverTimestamp()
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'REJECT') {
      await refundRef.update({
        status: 'FAILED',
        failureReason: notes || 'Rejected by admin',
        adminRejectedBy: adminId,
        updatedAt: FieldValue.serverTimestamp()
      });

      await adminDb.collection('auditLogs').add({
        action: 'ADMIN_REFUND_REJECTED',
        refundId,
        orderId: refund.orderId,
        userId: refund.userId,
        performedBy: adminId,
        reason: notes || 'Rejected by admin',
        timestamp: FieldValue.serverTimestamp()
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('[admin-refund] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query: FirebaseFirestore.Query = adminDb.collection('refunds')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (status && status !== 'ALL') {
      query = adminDb.collection('refunds')
        .where('status', '==', status)
        .orderBy('createdAt', 'desc')
        .limit(limit);
    }

    const snapshot = await query.get();
    const refunds = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()?.toISOString(),
      updatedAt: doc.data().updatedAt?.toDate()?.toISOString(),
      completedAt: doc.data().completedAt?.toDate()?.toISOString()
    }));

    return NextResponse.json({ refunds });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
