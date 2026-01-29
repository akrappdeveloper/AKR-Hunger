import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { getRazorpayKeyId, getRazorpayKeySecret } from '@/lib/razorpay-server';

const razorpay = new Razorpay({
  key_id: getRazorpayKeyId(),
  key_secret: getRazorpayKeySecret(),
});

export async function POST(request: NextRequest) {
  try {
    const { amount, orderId, customerEmail, customerName, customerPhone } =
      await request.json();

    if (!amount || !orderId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(amount), // in paise
      currency: 'INR',
      receipt: orderId,
      description: `AKR Hunger Food Order - ${orderId}`,
      customer_notify: 1,
      notes: {
        orderId,
        customerEmail,
        customerName,
        customerPhone,
      },
    };

    const razorpayOrder = await razorpay.orders.create(options);

    console.log('[v0] Razorpay order created:', razorpayOrder.id);

    return NextResponse.json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
    });
  } catch (error: any) {
    console.error('[v0] Error creating Razorpay order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}
