import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin-db';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyBearerAuth, verifyAdminActor } from '@/lib/campaigns/server-auth';
import { getAdSettingsServer } from '@/lib/campaigns/wallet-balance';
import { processCampaignSchedules, releasePaymentReservations } from '@/lib/campaigns/lifecycle-engine';
import { normalizeCampaignStatus } from '@/lib/campaigns/constants';

function serializeDoc(data: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v.toDate === 'function') {
      out[k] = v.toDate().toISOString();
    } else if (v && typeof v === 'object' && typeof v.seconds === 'number') {
      out[k] = new Date(v.seconds * 1000).toISOString();
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await verifyBearerAuth(request);
    if (!actor) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const adminCheck = await verifyAdminActor(actor);
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    await processCampaignSchedules(false);

    const [
      settings,
      campSnap,
      paySnap,
      walletTxSnap,
      rewardTxSnap,
      pointsSnap,
    ] = await Promise.all([
      getAdSettingsServer(),
      adminDb.collection('adCampaigns').get(),
      adminDb.collection('campaignPayments').get(),
      adminDb.collection('restaurantWalletTransactions').get(),
      adminDb.collection('restaurantRewardTransactions').get(),
      adminDb.collection('pointsAccounts').get(),
    ]);

    const toMs = (iso?: string) => (iso ? new Date(iso).getTime() || 0 : 0);

    const campaigns = campSnap.docs
      .map((d) => serializeDoc({ id: d.id, ...d.data() }))
      .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

    const payments = paySnap.docs
      .map((d) => serializeDoc({ id: d.id, ...d.data() }))
      .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
      .slice(0, 200);

    const walletTransactions = walletTxSnap.docs
      .map((d) => serializeDoc({ id: d.id, ...d.data() }))
      .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
      .slice(0, 200);

    const rewardTransactions = rewardTxSnap.docs
      .map((d) => serializeDoc({ id: d.id, ...d.data() }))
      .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
      .slice(0, 200);

    let totalPointsInCirculation = 0;
    pointsSnap.docs.forEach((d) => {
      totalPointsInCirculation += Number(d.data()?.availablePoints || 0);
    });

    return NextResponse.json({
      success: true,
      settings,
      campaigns,
      payments,
      walletTransactions,
      rewardTransactions,
      totalPointsInCirculation,
    });
  } catch (err: any) {
    console.error('[Admin Campaigns GET] Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await verifyBearerAuth(request);
    if (!actor) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const adminCheck = await verifyAdminActor(actor);
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const action = String(body?.action || '').toUpperCase();

    if (action === 'UPDATE_SETTINGS') {
      const s = body?.settings || {};
      const nextSettings = {
        id: 'global',
        minDailyBudget: Math.max(10, Number(s.minDailyBudget || 50)),
        minTotalBudget: Math.max(20, Number(s.minTotalBudget || 100)),
        cpcRate: Math.max(0.1, Number(s.cpcRate || 2.0)),
        cpmRate: Math.max(1, Number(s.cpmRate || 40.0)),
        pointsToRupeeRate: Math.max(0.1, Number(s.pointsToRupeeRate || 1.0)),
        activationDelaySeconds: Math.max(10, Math.min(600, Number(s.activationDelaySeconds || 60))),
        estimatedCtrPercent: Math.max(0.5, Math.min(25, Number(s.estimatedCtrPercent || 3.5))),
        placementsEnabled: {
          HOME_PAGE: s.placementsEnabled?.HOME_PAGE !== false,
          SEARCH: s.placementsEnabled?.SEARCH !== false,
          PRODUCT_DETAILS: s.placementsEnabled?.PRODUCT_DETAILS !== false,
        },
        placementMultipliers: {
          HOME_PAGE: Math.max(0.2, Number(s.placementMultipliers?.HOME_PAGE || 1.0)),
          SEARCH: Math.max(0.2, Number(s.placementMultipliers?.SEARCH || 1.2)),
          PRODUCT_DETAILS: Math.max(0.2, Number(s.placementMultipliers?.PRODUCT_DETAILS || 0.9)),
        },
        updatedBy: actor.uid,
        updatedAt: FieldValue.serverTimestamp(),
      };

      await adminDb.collection('adSettings').doc('global').set(nextSettings, { merge: true });
      await adminDb.collection('auditLogs').add({
        action: 'AD_SETTINGS_UPDATED',
        actorUid: actor.uid,
        actorRole: adminCheck.role || 'admin',
        settings: nextSettings,
        createdAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ success: true, settings: nextSettings });
    }

    const campaignId = String(body?.campaignId || '').trim();
    if (!campaignId) {
      return NextResponse.json({ success: false, error: 'campaignId is required' }, { status: 400 });
    }

    const campRef = adminDb.collection('adCampaigns').doc(campaignId);
    const campSnap = await campRef.get();
    if (!campSnap.exists) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
    }

    const campData = campSnap.data()!;
    const currentStatus = normalizeCampaignStatus(campData);
    const nowField = FieldValue.serverTimestamp();

    if (action === 'PAUSE') {
      if (!['ACTIVE', 'SCHEDULED', 'ACTIVATING'].includes(currentStatus)) {
        return NextResponse.json(
          { success: false, error: `Cannot pause campaign in status ${currentStatus}` },
          { status: 400 }
        );
      }
      const pauseReason = String(body?.reason || 'Paused by Platform Administrator').trim();
      await campRef.update({
        campaignStatus: 'PAUSED',
        status: 'paused',
        isActive: false,
        pauseReason,
        pausedBy: actor.uid,
        updatedAt: nowField,
      });
      await adminDb.collection('auditLogs').add({
        action: 'CAMPAIGN_PAUSED_BY_ADMIN',
        campaignId,
        restaurantId: campData.restaurantId,
        actorUid: actor.uid,
        reason: pauseReason,
        createdAt: nowField,
      });
      return NextResponse.json({ success: true, campaignStatus: 'PAUSED' });
    }

    if (action === 'RESUME') {
      if (currentStatus !== 'PAUSED') {
        return NextResponse.json(
          { success: false, error: `Only PAUSED campaigns can be resumed (current: ${currentStatus})` },
          { status: 400 }
        );
      }
      const startMs = campData.startAt ? new Date(campData.startAt).getTime() : 0;
      const endMs = campData.endAt ? new Date(campData.endAt).getTime() : 0;
      if (endMs > 0 && Date.now() >= endMs) {
        return NextResponse.json({ success: false, error: 'Campaign end time has passed' }, { status: 400 });
      }
      const remaining = Number(campData.remainingBudget ?? 0);
      if (Number(campData.totalBudget || 0) > 0 && remaining <= 0) {
        return NextResponse.json({ success: false, error: 'Campaign budget exhausted' }, { status: 400 });
      }

      const nextStatus = startMs > Date.now() ? 'SCHEDULED' : 'ACTIVE';
      await campRef.update({
        campaignStatus: nextStatus,
        status: nextStatus.toLowerCase(),
        isActive: nextStatus === 'ACTIVE',
        pauseReason: FieldValue.delete(),
        resumedBy: actor.uid,
        updatedAt: nowField,
      });
      await adminDb.collection('auditLogs').add({
        action: 'CAMPAIGN_RESUMED_BY_ADMIN',
        campaignId,
        restaurantId: campData.restaurantId,
        actorUid: actor.uid,
        nextStatus,
        createdAt: nowField,
      });
      return NextResponse.json({ success: true, campaignStatus: nextStatus });
    }

    if (action === 'REJECT') {
      const rejectionReason = String(body?.reason || '').trim();
      if (!rejectionReason) {
        return NextResponse.json({ success: false, error: 'Rejection reason is required' }, { status: 400 });
      }
      if (['REJECTED', 'CANCELLED', 'COMPLETED'].includes(currentStatus)) {
        return NextResponse.json(
          { success: false, error: `Campaign already in terminal status ${currentStatus}` },
          { status: 400 }
        );
      }

      // Release reservations if still pending payment
      if (currentStatus === 'PENDING_PAYMENT' && campData.paymentId) {
        await releasePaymentReservations(campData.paymentId, `Admin Rejected: ${rejectionReason}`, 'FAILED');
      }

      const refundedAmount = await adminDb.runTransaction(async (tx) => {
        const freshSnap = await tx.get(campRef);
        const fresh = freshSnap.data()!;
        const totalBudget = Number(fresh.totalBudget ?? fresh.monthlyCost ?? 0);
        const spent = Number(fresh.spentAmount ?? fresh.totalSpent ?? 0);
        const unused = Math.max(0, Number((fresh.remainingBudget ?? totalBudget - spent).toFixed(2)));
        const isPaid = fresh.paymentStatus === 'PAID';

        tx.update(campRef, {
          campaignStatus: 'REJECTED',
          status: 'rejected',
          isActive: false,
          rejectionReason,
          rejectedBy: actor.uid,
          rejectedAt: nowField,
          updatedAt: nowField,
        });

        let refund = 0;
        if (isPaid && unused > 0 && fresh.restaurantId) {
          refund = unused;
          const wRef = adminDb.collection('restaurantWalletTransactions').doc();
          tx.set(wRef, {
            transactionId: wRef.id,
            restaurantId: fresh.restaurantId,
            type: 'REFUND',
            amount: refund,
            campaignId,
            campaignName: fresh.campaignName || fresh.title || 'Campaign Refund',
            paymentId: fresh.paymentId || '',
            status: 'COMPLETED',
            description: `Admin rejected campaign "${fresh.campaignName || campaignId}" refund: ₹${refund} (${rejectionReason})`,
            createdAt: nowField,
          });

          const cTxRef = adminDb.collection('campaignTransactions').doc();
          tx.set(cTxRef, {
            transactionId: cTxRef.id,
            campaignId,
            restaurantId: fresh.restaurantId,
            type: 'ADMIN_REJECTION_REFUND',
            amount: refund,
            reason: rejectionReason,
            actorUid: actor.uid,
            createdAt: nowField,
          });
        }

        const auditRef = adminDb.collection('auditLogs').doc();
        tx.set(auditRef, {
          action: 'CAMPAIGN_REJECTED_BY_ADMIN',
          campaignId,
          restaurantId: fresh.restaurantId,
          actorUid: actor.uid,
          reason: rejectionReason,
          refundedAmount: refund,
          createdAt: nowField,
        });

        return refund;
      });

      return NextResponse.json({
        success: true,
        campaignStatus: 'REJECTED',
        refundedAmount,
      });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[Admin Campaigns POST] Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal error' }, { status: 500 });
  }
}
