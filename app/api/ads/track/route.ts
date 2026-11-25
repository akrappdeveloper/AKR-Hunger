import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin-db';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdSettingsServer } from '@/lib/campaigns/wallet-balance';
import { normalizeCampaignStatus } from '@/lib/campaigns/constants';
import { CampaignAdType } from '@/lib/types';

function getTodayIST(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function sanitizeIdPart(val: string): string {
  return String(val || 'anon')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 48);
}

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 500 });
    }

    const body = await request.json();
    const eventType = String(body?.eventType || '').toUpperCase();
    const campaignId = String(body?.campaignId || '').trim();
    const menuItemId = String(body?.menuItemId || '').trim();
    const sessionId = String(body?.sessionId || 'anon').trim();
    const userId = body?.userId ? String(body.userId).trim() : '';
    const orderId = body?.orderId ? String(body.orderId).trim() : '';
    const orderAmount = Number(body?.orderAmount || 0);
    const searchQuery = body?.searchQuery ? String(body.searchQuery).trim().slice(0, 120) : '';
    const placementRaw = String(body?.placement || 'HOME_PAGE').toUpperCase();
    const placement: CampaignAdType =
      placementRaw === 'SEARCH' || placementRaw === 'PRODUCT_DETAILS'
        ? (placementRaw as CampaignAdType)
        : 'HOME_PAGE';

    if (!campaignId || !menuItemId || !['IMPRESSION', 'CLICK', 'CONVERSION'].includes(eventType)) {
      return NextResponse.json({ success: false, error: 'Invalid tracking payload' }, { status: 400 });
    }

    if (eventType === 'CONVERSION' && !orderId) {
      return NextResponse.json({ success: false, error: 'orderId required for CONVERSION' }, { status: 400 });
    }

    const settings = await getAdSettingsServer();
    const nowMs = Date.now();
    const todayIST = getTodayIST();
    const hourBucket = Math.floor(nowMs / (60 * 60 * 1000));
    const halfHourBucket = Math.floor(nowMs / (30 * 60 * 1000));
    const safeSession = sanitizeIdPart(sessionId);
    const safeActor = sanitizeIdPart(userId || sessionId);

    const result = await adminDb.runTransaction(async (tx) => {
      const campRef = adminDb.collection('adCampaigns').doc(campaignId);
      const campSnap = await tx.get(campRef);
      if (!campSnap.exists) {
        return { skipped: true, reason: 'Campaign not found' };
      }

      const camp = campSnap.data()!;
      const status = normalizeCampaignStatus(camp);
      // Allow CONVERSION attribution even if campaign just paused/completed moments after click
      if (eventType !== 'CONVERSION' && status !== 'ACTIVE') {
        return { skipped: true, reason: `Campaign status is ${status}` };
      }

      const campAdType: CampaignAdType =
        camp.adType === 'SEARCH' || camp.adType === 'PRODUCT_DETAILS' || camp.adType === 'HOME_PAGE'
          ? camp.adType
          : placement;
      const multiplier = settings.placementMultipliers?.[campAdType] ?? 1.0;

      const totalBudget = Number(camp.totalBudget ?? camp.monthlyCost ?? 0);
      const currentSpent = Number(camp.spentAmount ?? camp.totalSpent ?? 0);
      const currentRemaining =
        camp.remainingBudget !== undefined
          ? Number(camp.remainingBudget)
          : Math.max(0, totalBudget - currentSpent);
      const currentTodaySpent = camp.lastSpendDate === todayIST ? Number(camp.todaySpent || 0) : 0;
      const dailyBudget = Number(camp.dailyBudget || 0);

      const nowField = FieldValue.serverTimestamp();

      if (eventType === 'IMPRESSION') {
        const dedupId = `${campaignId}_${menuItemId}_${safeSession}_${hourBucket}`;
        const impRef = adminDb.collection('adImpressions').doc(dedupId);
        const impSnap = await tx.get(impRef);
        if (impSnap.exists) {
          return { deduplicated: true };
        }

        const uniqueId = `${campaignId}_${safeActor}_${todayIST}_uniq`;
        const uniqueRef = adminDb.collection('adImpressions').doc(uniqueId);
        const uniqueSnap = await tx.get(uniqueRef);
        const isUnique = !uniqueSnap.exists;

        let rawCharge = Number(((settings.cpmRate * multiplier) / 1000).toFixed(4));
        if (dailyBudget > 0) {
          rawCharge = Math.min(rawCharge, Math.max(0, dailyBudget - currentTodaySpent));
        }
        const charge = totalBudget > 0 ? Math.min(rawCharge, currentRemaining) : 0;

        tx.set(impRef, {
          impressionId: dedupId,
          campaignId,
          restaurantId: camp.restaurantId,
          menuItemId,
          adType: campAdType,
          sessionId: safeSession,
          userId: userId || null,
          chargeAmount: charge,
          createdAt: nowField,
        });

        if (isUnique) {
          tx.set(uniqueRef, {
            impressionId: uniqueId,
            campaignId,
            restaurantId: camp.restaurantId,
            actor: safeActor,
            dateIST: todayIST,
            isUniqueMarker: true,
            createdAt: nowField,
          });
        }

        const newImpressions = Number(camp.impressions || 0) + 1;
        const newUnique = Number(camp.uniqueImpressions || 0) + (isUnique ? 1 : 0);
        const newClicks = Number(camp.totalClicks || camp.clicks || 0);
        const newSpent = Number((currentSpent + charge).toFixed(4));
        const newTodaySpent = Number((currentTodaySpent + charge).toFixed(4));
        const newRemaining = totalBudget > 0 ? Math.max(0, Number((totalBudget - newSpent).toFixed(4))) : 0;
        const ctr = newImpressions > 0 ? Number(((newClicks / newImpressions) * 100).toFixed(2)) : 0;

        const updates: Record<string, any> = {
          impressions: newImpressions,
          uniqueImpressions: newUnique,
          spentAmount: newSpent,
          totalSpent: newSpent,
          todaySpent: newTodaySpent,
          lastSpendDate: todayIST,
          remainingBudget: newRemaining,
          clickThroughRate: ctr,
          updatedAt: nowField,
        };

        if (totalBudget > 0 && newRemaining <= 0.001) {
          updates.remainingBudget = 0;
          updates.campaignStatus = 'COMPLETED';
          updates.status = 'completed';
          updates.isActive = false;
          updates.completedAt = nowField;
        }

        tx.update(campRef, updates);
        return { recorded: true, eventType: 'IMPRESSION', charge };
      }

      if (eventType === 'CLICK') {
        const dedupId = `${campaignId}_${menuItemId}_${safeSession}_${halfHourBucket}`;
        const clickRef = adminDb.collection('adClicks').doc(dedupId);
        const clickSnap = await tx.get(clickRef);
        if (clickSnap.exists) {
          return { deduplicated: true };
        }

        let rawCharge = Number((settings.cpcRate * multiplier).toFixed(2));
        if (dailyBudget > 0) {
          rawCharge = Math.min(rawCharge, Math.max(0, dailyBudget - currentTodaySpent));
        }
        const charge = totalBudget > 0 ? Math.min(rawCharge, currentRemaining) : 0;

        tx.set(clickRef, {
          clickId: dedupId,
          campaignId,
          restaurantId: camp.restaurantId,
          menuItemId,
          adType: campAdType,
          sessionId: safeSession,
          userId: userId || null,
          searchQuery: searchQuery || null,
          chargeAmount: charge,
          createdAt: nowField,
        });

        const newImpressions = Math.max(1, Number(camp.impressions || 0));
        const newClicks = Number(camp.totalClicks || camp.clicks || 0) + 1;
        const newSpent = Number((currentSpent + charge).toFixed(4));
        const newTodaySpent = Number((currentTodaySpent + charge).toFixed(4));
        const newRemaining = totalBudget > 0 ? Math.max(0, Number((totalBudget - newSpent).toFixed(4))) : 0;
        const ctr = Number(((newClicks / newImpressions) * 100).toFixed(2));
        const cpc = Number((newSpent / newClicks).toFixed(2));
        const revenue = Number(camp.revenueAttributed || 0);
        const roas = newSpent > 0 ? Number((revenue / newSpent).toFixed(2)) : 0;

        const updates: Record<string, any> = {
          totalClicks: newClicks,
          clicks: newClicks,
          spentAmount: newSpent,
          totalSpent: newSpent,
          todaySpent: newTodaySpent,
          lastSpendDate: todayIST,
          remainingBudget: newRemaining,
          clickThroughRate: ctr,
          costPerClick: cpc,
          roas,
          updatedAt: nowField,
        };

        if (totalBudget > 0 && newRemaining <= 0.001) {
          updates.remainingBudget = 0;
          updates.campaignStatus = 'COMPLETED';
          updates.status = 'completed';
          updates.isActive = false;
          updates.completedAt = nowField;
        }

        tx.update(campRef, updates);
        return { recorded: true, eventType: 'CLICK', charge };
      }

      // CONVERSION attribution
      const convId = `${campaignId}_${sanitizeIdPart(orderId)}_${sanitizeIdPart(menuItemId)}`;
      const convRef = adminDb.collection('adConversions').doc(convId);
      const convSnap = await tx.get(convRef);
      if (convSnap.exists) {
        return { deduplicated: true };
      }

      tx.set(convRef, {
        conversionId: convId,
        campaignId,
        restaurantId: camp.restaurantId,
        menuItemId,
        adType: campAdType,
        orderId,
        userId: userId || null,
        orderAmount,
        createdAt: nowField,
      });

      const newOrders = Number(camp.ordersGenerated || camp.conversions || 0) + 1;
      const newRevenue = Number((Number(camp.revenueAttributed || 0) + Math.max(0, orderAmount)).toFixed(2));
      const clicks = Math.max(1, Number(camp.totalClicks || camp.clicks || 0));
      const convRate = Number(((newOrders / clicks) * 100).toFixed(2));
      const costPerOrder = currentSpent > 0 ? Number((currentSpent / newOrders).toFixed(2)) : 0;
      const roas = currentSpent > 0 ? Number((newRevenue / currentSpent).toFixed(2)) : 0;

      tx.update(campRef, {
        ordersGenerated: newOrders,
        conversions: newOrders,
        revenueAttributed: newRevenue,
        conversionRate: convRate,
        costPerOrder,
        roas,
        updatedAt: nowField,
      });

      return { recorded: true, eventType: 'CONVERSION', newOrders, newRevenue };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Ads Track API] Error:', err);
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
