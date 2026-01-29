import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getRazorpayKeySecret } from '@/lib/razorpay-server';

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
