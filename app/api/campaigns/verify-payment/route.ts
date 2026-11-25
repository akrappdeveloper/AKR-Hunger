import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { getRazorpayKeyId, getRazorpayKeySecret } from '@/lib/razorpay-config';
import { verifyBearerAuth, resolveAuthorizedRestaurant } from '@/lib/campaigns/server-auth';
import { finalizeOnlineCampaignPayment } from '@/lib/campaigns/payment-reconcile';
import { adminDb } from '@/lib/firebase-admin-db';

export async function POST(request: NextRequest) {
  try {
    const actor = await verifyBearerAuth(request);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      paymentId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = await request.json();

    if (!paymentId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json({ error: 'Missing required payment verification fields' }, { status: 400 });
    }

    const paySnap = await adminDb.collection('campaignPayments').doc(paymentId).get();
    if (!paySnap.exists) {
      return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
    }
    const payData = paySnap.data()!;

    const authz = await resolveAuthorizedRestaurant(actor, payData.restaurantId);
    if (!authz.authorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (payData.razorpayOrderId && payData.razorpayOrderId !== razorpayOrderId) {
      return NextResponse.json({ error: 'Razorpay order mismatch' }, { status: 400 });
    }

    // 1. Verify HMAC-SHA256 signature
    const secret = getRazorpayKeySecret();
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      return NextResponse.json(
        { success: false, error: 'Payment signature verification failed' },
        { status: 400 }
      );
    }

    // 2. Verify live payment status directly with Razorpay server API
    try {
      const rp = new Razorpay({ key_id: getRazorpayKeyId(), key_secret: secret });
      const rpPayment = await rp.payments.fetch(razorpayPaymentId);
      if (!rpPayment || !['captured', 'authorized'].includes(rpPayment.status)) {
        return NextResponse.json(
          { success: false, error: `Payment not captured (status: ${rpPayment?.status || 'unknown'})` },
          { status: 400 }
        );
      }
      if (rpPayment.order_id && rpPayment.order_id !== razorpayOrderId) {
        return NextResponse.json(
          { success: false, error: 'Razorpay payment order mismatch' },
          { status: 400 }
        );
      }
    } catch (rpFetchErr: any) {
      console.warn('[Campaign Verify] Razorpay fetch check notice:', rpFetchErr?.message);
    }

    // 3. Finalize campaign payment & schedule activation atomically
    const result = await finalizeOnlineCampaignPayment({
      paymentId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      verifiedBy: 'CLIENT_CALLBACK',
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[POST /api/campaigns/verify-payment] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to verify campaign payment' },
      { status: 500 }
    );
  }
}
