import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getRazorpayKeySecret } from '@/lib/razorpay-config';

export async function POST(request: NextRequest) {
  try {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      await request.json();

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        { error: 'Missing required payment details' },
        { status: 400 }
      );
    }

    // Verify signature
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', getRazorpayKeySecret())
      .update(body)
      .digest('hex');

    const isValidSignature = expectedSignature === razorpaySignature;

    if (!isValidSignature) {
      console.warn('[v0] Invalid payment signature');
      return NextResponse.json(
        { success: false, error: 'Payment signature verification failed' },
        { status: 400 }
      );
    }

    console.log('[v0] Payment verified successfully for order:', orderId);

    // Send Payment Verified Receipt Email via Resend
    if (orderId) {
      try {
        const { adminDb } = await import('@/lib/firebase-admin-db');
        const { sendPaymentVerifiedEmail } = await import('@/lib/email/service');
        if (adminDb) {
          const orderDoc = await adminDb.collection('orders').doc(orderId).get();
          if (orderDoc.exists) {
            const oData = orderDoc.data();
            let customerEmail = oData?.customerEmail;
            const customerName = oData?.customerName || 'Foodie';
            const amount = oData?.total || 0;

            if (!customerEmail && oData?.customerId) {
              const custDoc = await adminDb.collection('customers').doc(oData.customerId).get();
              if (custDoc.exists) {
                customerEmail = custDoc.data()?.email;
              }
            }

            if (customerEmail) {
              await sendPaymentVerifiedEmail({
                orderId,
                customerEmail,
                customerName,
                amount,
                paymentMethod: 'online',
                paymentId: razorpayPaymentId,
                status: 'completed',
              });
            }
          }
        }
      } catch (emailErr) {
        console.warn('[Resend] Payment receipt email notice:', emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified',
    });
  } catch (error: any) {
    console.error('[v0] Error verifying payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify payment' },
      { status: 500 }
    );
  }
}
