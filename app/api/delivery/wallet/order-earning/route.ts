import { NextRequest, NextResponse } from 'next/server';
import { processOrderCompletionEarning } from '@/lib/rider-wallet-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, riderId } = body;

    if (!orderId || !riderId) {
      return NextResponse.json(
        { error: 'Missing orderId or riderId' },
        { status: 400 }
      );
    }

    const result = await processOrderCompletionEarning(orderId, riderId);
    return NextResponse.json({
      success: true,
      message: 'Order completion earnings processed successfully',
      ...result,
    });
  } catch (err: any) {
    console.error('[API Order Earning] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process order earnings' },
      { status: 500 }
    );
  }
}
