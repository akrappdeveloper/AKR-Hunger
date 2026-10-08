import { NextRequest, NextResponse } from 'next/server';
import { executeCodSettlement } from '@/lib/rider-wallet-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { riderId, amount, paymentMethod, reference, autoVerify } = body;

    if (!riderId || !amount) {
      return NextResponse.json(
        { error: 'Missing required settlement fields' },
        { status: 400 }
      );
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid settlement amount' },
        { status: 400 }
      );
    }

    const result = await executeCodSettlement(
      riderId,
      numAmount,
      paymentMethod || 'UPI/Card',
      reference || `PAY-${Date.now()}`,
      autoVerify !== false
    );

    return NextResponse.json({
      message: `COD settlement of ₹${numAmount} processed`,
      ...result,
    });
  } catch (err: any) {
    console.error('[API Settle COD] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Settlement failed' },
      { status: 500 }
    );
  }
}
