import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin-db';
import { verifyBearerAuth, resolveAuthorizedRestaurant } from '@/lib/campaigns/server-auth';
import { releasePaymentReservations } from '@/lib/campaigns/lifecycle-engine';

export async function POST(request: NextRequest) {
  try {
    const actor = await verifyBearerAuth(request);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentId, reason, cancelled } = await request.json();
    if (!paymentId) {
      return NextResponse.json({ error: 'Missing paymentId' }, { status: 400 });
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

    await releasePaymentReservations(
      paymentId,
      String(reason || (cancelled ? 'Cancelled by restaurant' : 'Online payment failed')),
      cancelled ? 'CANCELLED' : 'FAILED'
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[POST /api/campaigns/payment-failed] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to release payment reservations' },
      { status: 500 }
    );
  }
}
