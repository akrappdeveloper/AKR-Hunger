import { NextRequest, NextResponse } from 'next/server';
import { requestEarningsWithdrawal } from '@/lib/rider-wallet-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { riderId, amount, paymentMethod, destinationReference } = body;

    if (!riderId || !amount || !paymentMethod || !destinationReference) {
      return NextResponse.json(
        { error: 'Missing required withdrawal fields' },
        { status: 400 }
      );
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid withdrawal amount' },
        { status: 400 }
      );
    }

    const result = await requestEarningsWithdrawal(
      riderId,
      numAmount,
      paymentMethod,
      destinationReference
    );

    return NextResponse.json({
      message: `Withdrawal request of ₹${numAmount} submitted successfully`,
      ...result,
    });
  } catch (err: any) {
    console.error('[API Withdraw] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Withdrawal request failed' },
      { status: 500 }
    );
  }
}
