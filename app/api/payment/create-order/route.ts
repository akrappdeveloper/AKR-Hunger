import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { getRazorpayKeyId, getRazorpayKeySecret } from '@/lib/razorpay-config'; // Import from config

// Initialize safely to prevent build errors if env vars are missing
let razorpay: Razorpay;
try {
  const key_id = getRazorpayKeyId();
  const key_secret = getRazorpayKeySecret();

  if (key_id && key_secret) {
    razorpay = new Razorpay({
      key_id,
      key_secret,
    });
  } else {
    // Dummy instance for build time or missing config
    // @ts-ignore
    razorpay = { orders: { create: async () => { throw new Error('Razorpay not configured'); } } };
  }
} catch (e) {
  console.warn('Failed to initialize Razorpay:', e);
  // @ts-ignore
  razorpay = { orders: { create: async () => { throw new Error('Razorpay failed to init'); } } };
}

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
      description: `Hunger Food Order - ${orderId}`,
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
