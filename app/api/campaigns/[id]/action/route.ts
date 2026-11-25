import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin-db';
import { verifyBearerAuth, resolveAuthorizedRestaurant } from '@/lib/campaigns/server-auth';
import { normalizeCampaignStatus } from '@/lib/campaigns/constants';
import { releasePaymentReservations } from '@/lib/campaigns/lifecycle-engine';
import { getRestaurantFinancialSnapshot } from '@/lib/campaigns/wallet-balance';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await verifyBearerAuth(request);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: campaignId } = await context.params;
    const { action } = await request.json();

    if (!campaignId || !['PAUSE', 'RESUME', 'CANCEL'].includes(action)) {
      return NextResponse.json({ error: 'Invalid campaign action' }, { status: 400 });
    }

    const campRef = adminDb.collection('adCampaigns').doc(campaignId);
    const campSnap = await campRef.get();
    if (!campSnap.exists) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const camp = campSnap.data()!;
    const authz = await resolveAuthorizedRestaurant(actor, camp.restaurantId);
    if (!authz.authorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const currentStatus = normalizeCampaignStatus(camp);
    const nowField = FieldValue.serverTimestamp();

    if (action === 'PAUSE') {
      if (!['ACTIVE', 'SCHEDULED', 'ACTIVATING'].includes(currentStatus)) {
        return NextResponse.json(
          { error: `Cannot pause campaign in ${currentStatus} status.` },
          { status: 400 }
        );
      }
      await campRef.update({
        campaignStatus: 'PAUSED',
        status: 'paused',
        isActive: false,
        pauseReason: 'Paused by restaurant',
        updatedAt: nowField,
      });
      return NextResponse.json({ success: true, campaignStatus: 'PAUSED' });
    }

    if (action === 'RESUME') {
      if (currentStatus !== 'PAUSED') {
        return NextResponse.json({ error: 'Only paused campaigns can be resumed.' }, { status: 400 });
      }
      if (camp.paymentStatus !== 'PAID') {
        return NextResponse.json({ error: 'Unpaid campaign cannot be resumed.' }, { status: 400 });
      }
      const endMs = camp.endAt?.toDate ? camp.endAt.toDate().getTime() : new Date(camp.endAt || 0).getTime();
      if (endMs > 0 && Date.now() >= endMs) {
        return NextResponse.json({ error: 'Campaign schedule has already ended.' }, { status: 400 });
      }
      const remainingBudget = Number(camp.remainingBudget ?? camp.pointsRemaining ?? 0);
      if (remainingBudget <= 0) {
        return NextResponse.json({ error: 'Campaign budget is exhausted.' }, { status: 400 });
      }

      const startMs = camp.startAt?.toDate ? camp.startAt.toDate().getTime() : new Date(camp.startAt || 0).getTime();
      const targetStatus = startMs > Date.now() ? 'SCHEDULED' : 'ACTIVE';

      await campRef.update({
        campaignStatus: targetStatus,
        status: targetStatus.toLowerCase(),
        isActive: targetStatus === 'ACTIVE',
        pauseReason: FieldValue.delete(),
        updatedAt: nowField,
      });
      return NextResponse.json({ success: true, campaignStatus: targetStatus });
    }

    // CANCEL
    if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(currentStatus)) {
      return NextResponse.json(
        { error: `Campaign is already ${currentStatus}.` },
        { status: 400 }
      );
    }

    if (currentStatus === 'PENDING_PAYMENT' && camp.paymentId) {
      await releasePaymentReservations(camp.paymentId, 'Cancelled by restaurant', 'CANCELLED');
      return NextResponse.json({ success: true, campaignStatus: 'CANCELLED', refundedAmount: 0 });
    }

    const totalBudget = Number(camp.totalBudget ?? camp.monthlyCost ?? 0);
    const spent = Number(camp.spentAmount ?? camp.totalSpent ?? 0);
    const unusedBudget = Math.max(
      0,
      Math.round((camp.remainingBudget !== undefined ? Number(camp.remainingBudget) : totalBudget - spent) * 100) / 100
    );

    const financials = camp.paymentStatus === 'PAID' && unusedBudget > 0
      ? await getRestaurantFinancialSnapshot(camp.restaurantId)
      : null;

    await adminDb.runTransaction(async (tx) => {
      tx.update(campRef, {
        campaignStatus: 'CANCELLED',
        status: 'cancelled',
        isActive: false,
        remainingBudget: 0,
        updatedAt: nowField,
      });

      if (camp.paymentStatus === 'PAID' && unusedBudget > 0 && financials) {
        const refundTxRef = adminDb.collection('restaurantWalletTransactions').doc();
        tx.set(refundTxRef, {
          transactionId: refundTxRef.id,
          restaurantId: camp.restaurantId,
          type: 'REFUND',
          category: 'CAMPAIGN_REFUND',
          campaignId,
          campaignName: camp.campaignName || camp.title || '',
          paymentId: camp.paymentId || '',
          paymentReference: `REF-${campaignId}`,
          amount: unusedBudget,
          balanceBefore: financials.availableWalletBalance,
          balanceAfter: Math.round((financials.availableWalletBalance + unusedBudget) * 100) / 100,
          status: 'COMPLETED',
          description: `Unused budget refund for cancelled campaign ${camp.campaignName || camp.title}`,
          createdAt: nowField,
          updatedAt: nowField,
        });
      }

      tx.set(adminDb.collection('auditLogs').doc(), {
        action: 'CAMPAIGN_CANCELLED_BY_RESTAURANT',
        campaignId,
        restaurantId: camp.restaurantId,
        refundedAmount: camp.paymentStatus === 'PAID' ? unusedBudget : 0,
        performedBy: actor.uid,
        timestamp: nowField,
      });
    });

    return NextResponse.json({
      success: true,
      campaignStatus: 'CANCELLED',
      refundedAmount: camp.paymentStatus === 'PAID' ? unusedBudget : 0,
    });
  } catch (err: any) {
    console.error('[POST /api/campaigns/[id]/action] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update campaign' },
      { status: 500 }
    );
  }
}
