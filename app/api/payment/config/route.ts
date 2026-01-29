'use server';

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    
    if (!keyId) {
      return NextResponse.json(
        { error: 'Razorpay configuration not found' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      razorpayKeyId: keyId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch Razorpay config' },
      { status: 500 }
    );
  }
}
