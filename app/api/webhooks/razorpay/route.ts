import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin-db';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.error('[webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const payload = event.payload;

    console.log('[webhook] Received event:', eventType);

    switch (eventType) {
      case 'payment.captured': {
        const payment = payload.payment?.entity;
        if (!payment) break;

        // Find order by razorpayOrderId
        const ordersSnap = await adminDb.collection('orders')
          .where('razorpayOrderId', '==', payment.order_id)
          .get();

        if (!ordersSnap.empty) {
          const orderDoc = ordersSnap.docs[0];
          await orderDoc.ref.update({
            paymentStatus: 'completed',
            razorpayPaymentId: payment.id,
            razorpayMethod: payment.method,
            updatedAt: FieldValue.serverTimestamp()
          });

          await adminDb.collection('auditLogs').add({
            action: 'PAYMENT_CAPTURED',
            orderId: orderDoc.id,
            razorpayPaymentId: payment.id,
            amount: payment.amount / 100,
            performedBy: 'RAZORPAY_WEBHOOK',
            timestamp: FieldValue.serverTimestamp()
          });

          // Send Payment Receipt Email via Resend
          try {
            const oData = orderDoc.data();
            let customerEmail = oData?.customerEmail;
            if (!customerEmail && oData?.customerId) {
              const custDoc = await adminDb.collection('customers').doc(oData.customerId).get();
              if (custDoc.exists) {
                customerEmail = custDoc.data()?.email;
              }
            }

            if (customerEmail) {
              const { sendPaymentVerifiedEmail } = await import('@/lib/email/service');
              await sendPaymentVerifiedEmail({
                orderId: orderDoc.id,
                customerEmail,
                customerName: oData?.customerName || 'Foodie',
                amount: payment.amount / 100,
                paymentMethod: payment.method || 'online',
                paymentId: payment.id,
                status: 'completed',
              });
            }
          } catch (emailErr) {
            console.warn('[webhook] Payment receipt email notice:', emailErr);
          }
        }
        break;
      }

      case 'payment.failed': {
        const payment = payload.payment?.entity;
        if (!payment) break;

        const ordersSnap = await adminDb.collection('orders')
          .where('razorpayOrderId', '==', payment.order_id)
          .get();

        if (!ordersSnap.empty) {
          await ordersSnap.docs[0].ref.update({
            paymentStatus: 'failed',
            paymentFailureReason: payment.error_description,
            updatedAt: FieldValue.serverTimestamp()
          });
        }
        break;
      }

      case 'refund.created': {
        const refund = payload.refund?.entity;
        if (!refund) break;

        // Find refund by razorpayRefundId
        const refundsSnap = await adminDb.collection('refunds')
          .where('razorpayRefundId', '==', refund.id)
          .get();

        if (!refundsSnap.empty) {
          await refundsSnap.docs[0].ref.update({
            status: 'PROCESSING',
            updatedAt: FieldValue.serverTimestamp()
          });

          await adminDb.collection('auditLogs').add({
            action: 'REFUND_PROCESSING',
            refundId: refundsSnap.docs[0].id,
            razorpayRefundId: refund.id,
            performedBy: 'RAZORPAY_WEBHOOK',
            timestamp: FieldValue.serverTimestamp()
          });
        }
        break;
      }

      case 'refund.processed': {
        const refund = payload.refund?.entity;
        if (!refund) break;

        const refundsSnap = await adminDb.collection('refunds')
          .where('razorpayRefundId', '==', refund.id)
          .get();

        if (!refundsSnap.empty) {
          const refundDoc = refundsSnap.docs[0];
          const refundData = refundDoc.data();

          await refundDoc.ref.update({
            status: 'COMPLETED',
            updatedAt: FieldValue.serverTimestamp(),
            completedAt: FieldValue.serverTimestamp()
          });

          // Notify customer
          if (refundData.userId) {
            await adminDb.collection('notifications').add({
              userId: refundData.userId,
              userType: 'customer',
              type: 'payment',
              subType: 'refund-completed',
              title: 'Refund Completed ✅',
              message: `Your refund of ₹${refundData.amount?.toFixed(2) || '0.00'} has been successfully processed.`,
              isRead: false,
              read: false,
              deleted: false,
              orderId: refundData.orderId,
              refundId: refundDoc.id,
              createdAt: FieldValue.serverTimestamp()
            });
          }

          await adminDb.collection('auditLogs').add({
            action: 'REFUND_COMPLETED',
            refundId: refundDoc.id,
            orderId: refundData.orderId,
            userId: refundData.userId,
            amount: refundData.amount,
            razorpayRefundId: refund.id,
            performedBy: 'RAZORPAY_WEBHOOK',
            timestamp: FieldValue.serverTimestamp()
          });
        }
        break;
      }

      case 'refund.failed': {
        const refund = payload.refund?.entity;
        if (!refund) break;

        const refundsSnap = await adminDb.collection('refunds')
          .where('razorpayRefundId', '==', refund.id)
          .get();

        if (!refundsSnap.empty) {
          const refundDoc = refundsSnap.docs[0];
          const refundData = refundDoc.data();

          await refundDoc.ref.update({
            status: 'FAILED',
            failureReason: refund.description || 'Refund failed',
            updatedAt: FieldValue.serverTimestamp()
          });

          // Notify customer
          if (refundData.userId) {
            await adminDb.collection('notifications').add({
              userId: refundData.userId,
              userType: 'customer',
              type: 'payment',
              subType: 'refund-failed',
              title: 'Refund Issue',
              message: `We couldn't complete your refund automatically. Our support team will review it.`,
              isRead: false,
              read: false,
              deleted: false,
              orderId: refundData.orderId,
              refundId: refundDoc.id,
              createdAt: FieldValue.serverTimestamp()
            });
          }

          // Move to manual review
          await refundDoc.ref.update({ status: 'MANUAL_REVIEW' });

          await adminDb.collection('auditLogs').add({
            action: 'REFUND_FAILED',
            refundId: refundDoc.id,
            orderId: refundData.orderId,
            razorpayRefundId: refund.id,
            performedBy: 'RAZORPAY_WEBHOOK',
            timestamp: FieldValue.serverTimestamp()
          });
        }
        break;
      }

      default:
        console.log('[webhook] Unhandled event:', eventType);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
