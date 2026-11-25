import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin-db';
import { verifyBearerAuth, resolveAuthorizedRestaurant } from '@/lib/campaigns/server-auth';
import { getAdSettingsServer, getRestaurantFinancialSnapshot } from '@/lib/campaigns/wallet-balance';
import { processCampaignSchedules } from '@/lib/campaigns/lifecycle-engine';

export async function GET(request: NextRequest) {
  try {
    const actor = await verifyBearerAuth(request);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestedId = request.nextUrl.searchParams.get('restaurantId') || undefined;
    const authz = await resolveAuthorizedRestaurant(actor, requestedId);
    if (!authz.authorized) {
      return NextResponse.json({ error: authz.reason || 'Forbidden' }, { status: 403 });
    }

    // Run server-authoritative schedule & expiry reconciliation
    await processCampaignSchedules(false);

    const restaurantId = authz.restaurantId;

    const [
      settings,
      financials,
      campaignsSnap,
      walletTxSnap,
      rewardTxSnap,
      paymentsSnap,
    ] = await Promise.all([
      getAdSettingsServer(),
      getRestaurantFinancialSnapshot(restaurantId),
      adminDb.collection('adCampaigns').where('restaurantId', '==', restaurantId).get(),
      adminDb.collection('restaurantWalletTransactions').where('restaurantId', '==', restaurantId).get(),
      adminDb.collection('restaurantRewardTransactions').where('restaurantId', '==', restaurantId).get(),
      adminDb.collection('campaignPayments').where('restaurantId', '==', restaurantId).get(),
    ]);

    const toIso = (val: any) => {
      if (!val) return null;
      if (typeof val?.toDate === 'function') return val.toDate().toISOString();
      if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000).toISOString();
      const d = new Date(val);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    };

    const campaigns = campaignsSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          campaignId: data.campaignId || d.id,
          startDate: toIso(data.startAt || data.startDate),
          endDate: toIso(data.endAt || data.endDate),
          startAt: toIso(data.startAt || data.startDate),
          endAt: toIso(data.endAt || data.endDate),
          activationDueAt: toIso(data.activationDueAt),
          activatedAt: toIso(data.activatedAt),
          createdAt: toIso(data.createdAt),
          updatedAt: toIso(data.updatedAt),
        };
      })
      .sort((a: any, b: any) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tB - tA;
      });

    const walletTransactions = walletTxSnap.docs
      .map((d) => ({ ...d.data(), id: d.id, createdAt: toIso(d.data().createdAt) }))
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const rewardTransactions = rewardTxSnap.docs
      .map((d) => ({ ...d.data(), id: d.id, createdAt: toIso(d.data().createdAt) }))
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const payments = paymentsSnap.docs
      .map((d) => ({
        ...d.data(),
        id: d.id,
        createdAt: toIso(d.data().createdAt),
        paidAt: toIso(d.data().paidAt),
      }))
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return NextResponse.json({
      success: true,
      restaurantId,
      settings,
      financials,
      campaigns,
      walletTransactions,
      rewardTransactions,
      payments,
    });
  } catch (err: any) {
    console.error('[GET /api/campaigns] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to load campaigns' }, { status: 500 });
  }
}
