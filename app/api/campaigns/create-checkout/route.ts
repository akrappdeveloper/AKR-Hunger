import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin-db';
import { getRazorpayKeyId, getRazorpayKeySecret } from '@/lib/razorpay-config';
import { verifyBearerAuth, resolveAuthorizedRestaurant } from '@/lib/campaigns/server-auth';
import { getAdSettingsServer, getRestaurantFinancialSnapshot } from '@/lib/campaigns/wallet-balance';
import { AD_PLACEMENTS, generateCampaignId } from '@/lib/campaigns/constants';
import { CampaignAdType } from '@/lib/types';

function createRazorpayClient() {
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await verifyBearerAuth(request);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      restaurantId: requestedRestaurantId,
      campaignName,
      description,
      adType,
      menuItemIds,
      offerBadge,
      targetKeywords,
      budgetType,
      dailyBudget,
      totalBudget,
      startAt,
      endAt,
      timezone,
      paymentMode, // 'WALLET' | 'RAZORPAY' | 'REWARD_POINTS'
      usePoints,
      pointsToUse,
      secondaryPaymentMethod, // 'WALLET' | 'RAZORPAY' | 'WALLET_AND_RAZORPAY'
      useWalletAmount,
      acceptedTerms,
      idempotencyKey,
    } = body;

    if (!acceptedTerms) {
      return NextResponse.json({ error: 'Please accept campaign terms before confirming.' }, { status: 400 });
    }

    const authz = await resolveAuthorizedRestaurant(actor, requestedRestaurantId);
    if (!authz.authorized) {
      return NextResponse.json({ error: authz.reason || 'Forbidden' }, { status: 403 });
    }

    const restaurantId = authz.restaurantId;
    const restaurantName = String(authz.restaurantData?.name || 'Restaurant');

    // Validate idempotency key (prevent duplicate submission)
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return NextResponse.json({ error: 'Missing idempotencyKey' }, { status: 400 });
    }

    const existingPaySnap = await adminDb
      .collection('campaignPayments')
      .where('restaurantId', '==', restaurantId)
      .where('idempotencyKey', '==', idempotencyKey)
      .limit(1)
      .get();

    if (!existingPaySnap.empty) {
      const existingPay = existingPaySnap.docs[0].data();
      if (existingPay.status === 'PAID' || existingPay.status === 'PENDING_ONLINE') {
        return NextResponse.json({
          success: true,
          idempotentReplay: true,
          campaignId: existingPay.campaignId,
          paymentId: existingPay.paymentId,
          paymentStatus: existingPay.status,
          razorpayOrderId: existingPay.razorpayOrderId || null,
          razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || null,
          onlineAmount: existingPay.onlineAmount || 0,
        });
      }
    }

    // Validate adType & placement enabled
    const validAdTypes: CampaignAdType[] = ['HOME_PAGE', 'SEARCH', 'PRODUCT_DETAILS'];
    if (!validAdTypes.includes(adType)) {
      return NextResponse.json({ error: 'Invalid advertisement type' }, { status: 400 });
    }
    const typedAdType = adType as CampaignAdType;

    const settings = await getAdSettingsServer();
    if (!settings.placementsEnabled?.[typedAdType]) {
      return NextResponse.json(
        { error: `${AD_PLACEMENTS[typedAdType].title} placement is currently disabled by Admin.` },
        { status: 400 }
      );
    }

    if (!campaignName || String(campaignName).trim().length < 3) {
      return NextResponse.json({ error: 'Campaign name must be at least 3 characters.' }, { status: 400 });
    }

    // Validate schedule
    const startMs = new Date(startAt).getTime();
    const endMs = new Date(endAt).getTime();
    const nowMs = Date.now();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      return NextResponse.json({ error: 'Invalid campaign start or end date/time.' }, { status: 400 });
    }
    if (startMs < nowMs - 5 * 60 * 1000) {
      return NextResponse.json({ error: 'Campaign start date/time cannot be in the past.' }, { status: 400 });
    }
    if (endMs <= startMs) {
      return NextResponse.json({ error: 'Campaign end date/time must be later than start date/time.' }, { status: 400 });
    }

    // Validate budget
    const normalizedBudgetType: 'DAILY' | 'TOTAL' = budgetType === 'DAILY' ? 'DAILY' : 'TOTAL';
    const durationDays = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));
    let computedDailyBudget = Number(dailyBudget || 0);
    let computedTotalBudget = Number(totalBudget || 0);

    if (normalizedBudgetType === 'DAILY') {
      if (Number.isNaN(computedDailyBudget) || computedDailyBudget < settings.minDailyBudget) {
        return NextResponse.json(
          { error: `Minimum daily budget is ₹${settings.minDailyBudget}.` },
          { status: 400 }
        );
      }
      computedTotalBudget = Math.round(computedDailyBudget * durationDays * 100) / 100;
    } else {
      if (Number.isNaN(computedTotalBudget) || computedTotalBudget < settings.minTotalBudget) {
        return NextResponse.json(
          { error: `Minimum total campaign budget is ₹${settings.minTotalBudget}.` },
          { status: 400 }
        );
      }
      computedDailyBudget = Math.round((computedTotalBudget / durationDays) * 100) / 100;
    }

    if (computedTotalBudget < settings.minTotalBudget) {
      return NextResponse.json(
        { error: `Minimum total campaign budget is ₹${settings.minTotalBudget}.` },
        { status: 400 }
      );
    }

    // Validate menu items (must exist, belong to restaurant, approved, available)
    const uniqueItemIds: string[] = Array.isArray(menuItemIds)
      ? Array.from(new Set(menuItemIds.map(String).filter(Boolean)))
      : [];
    if (uniqueItemIds.length === 0) {
      return NextResponse.json({ error: 'Please select at least one approved menu item.' }, { status: 400 });
    }

    const itemSnaps = await Promise.all(
      uniqueItemIds.map((id) => adminDb.collection('menuItems').doc(id).get())
    );
    const eligibleItems: Array<{
      id: string;
      name: string;
      price: number;
      image: string;
      category?: string;
      vegetarian?: boolean;
    }> = [];

    for (const snap of itemSnaps) {
      if (!snap.exists) {
        return NextResponse.json({ error: 'One or more selected menu items do not exist.' }, { status: 400 });
      }
      const d = snap.data()!;
      if (d.restaurantId !== restaurantId) {
        return NextResponse.json({ error: 'Unauthorized menu item selected.' }, { status: 403 });
      }
      if (d.deleted === true || d.isDeleted === true) {
        return NextResponse.json({ error: `"${d.name}" has been deleted and cannot be promoted.` }, { status: 400 });
      }
      if (d.approvalStatus && d.approvalStatus !== 'approved') {
        return NextResponse.json({ error: `"${d.name}" is not approved yet and cannot be promoted.` }, { status: 400 });
      }
      if (d.available === false || d.isAvailable === false) {
        return NextResponse.json({ error: `"${d.name}" is currently unavailable and cannot be promoted.` }, { status: 400 });
      }
      eligibleItems.push({
        id: snap.id,
        name: String(d.name || 'Dish'),
        price: Number(d.price || 0),
        image: String(d.image || ''),
        category: d.category ? String(d.category) : undefined,
        vegetarian: Boolean(d.vegetarian),
      });
    }

    // Authoritative server-side balances
    const financials = await getRestaurantFinancialSnapshot(restaurantId);
    const pointRate = Math.max(0.01, settings.pointsToRupeeRate || 1);

    let finalPointsUsed = 0;
    let finalPointsValue = 0;
    let finalWalletAmount = 0;
    let finalOnlineAmount = 0;
    let resolvedPaymentMethod:
      | 'WALLET'
      | 'RAZORPAY'
      | 'REWARD_POINTS'
      | 'POINTS_WALLET'
      | 'POINTS_RAZORPAY'
      | 'POINTS_WALLET_RAZORPAY' = 'WALLET';

    if (paymentMode === 'WALLET') {
      if (financials.availableWalletBalance < computedTotalBudget) {
        return NextResponse.json(
          {
            error: `Insufficient Wallet Balance. Available: ₹${financials.availableWalletBalance.toFixed(2)}, Required: ₹${computedTotalBudget.toFixed(2)}.`,
          },
          { status: 400 }
        );
      }
      finalWalletAmount = computedTotalBudget;
      resolvedPaymentMethod = 'WALLET';
    } else if (paymentMode === 'RAZORPAY') {
      finalOnlineAmount = computedTotalBudget;
      resolvedPaymentMethod = 'RAZORPAY';
    } else if (paymentMode === 'REWARD_POINTS') {
      const requestedPts = usePoints === false ? 0 : Math.floor(Number(pointsToUse ?? financials.availablePoints));
      if (requestedPts < 0 || requestedPts > financials.availablePoints) {
        return NextResponse.json(
          { error: `Insufficient Reward Points. Available: ${financials.availablePoints} pts.` },
          { status: 400 }
        );
      }

      const maxPtsForTotal = Math.ceil(computedTotalBudget / pointRate);
      finalPointsUsed = Math.min(requestedPts, financials.availablePoints, maxPtsForTotal);
      finalPointsValue = Math.min(
        computedTotalBudget,
        Math.round(finalPointsUsed * pointRate * 100) / 100
      );

      let remaining = Math.max(0, Math.round((computedTotalBudget - finalPointsValue) * 100) / 100);

      if (remaining === 0) {
        resolvedPaymentMethod = 'REWARD_POINTS';
      } else {
        if (secondaryPaymentMethod === 'WALLET') {
          if (financials.availableWalletBalance < remaining) {
            return NextResponse.json(
              {
                error: `Insufficient Wallet Balance for remaining ₹${remaining.toFixed(2)}. Available wallet: ₹${financials.availableWalletBalance.toFixed(2)}.`,
              },
              { status: 400 }
            );
          }
          finalWalletAmount = remaining;
          remaining = 0;
          resolvedPaymentMethod = finalPointsUsed > 0 ? 'POINTS_WALLET' : 'WALLET';
        } else if (secondaryPaymentMethod === 'WALLET_AND_RAZORPAY') {
          const requestedWallet = Math.max(0, Math.min(Number(useWalletAmount || 0), remaining, financials.availableWalletBalance));
          finalWalletAmount = Math.round(requestedWallet * 100) / 100;
          finalOnlineAmount = Math.max(0, Math.round((remaining - finalWalletAmount) * 100) / 100);
          resolvedPaymentMethod =
            finalPointsUsed > 0 && finalWalletAmount > 0 && finalOnlineAmount > 0
              ? 'POINTS_WALLET_RAZORPAY'
              : finalPointsUsed > 0 && finalOnlineAmount > 0
              ? 'POINTS_RAZORPAY'
              : finalWalletAmount > 0 && finalOnlineAmount === 0
              ? 'POINTS_WALLET'
              : 'RAZORPAY';
        } else {
          // RAZORPAY covers remaining
          finalOnlineAmount = remaining;
          resolvedPaymentMethod = finalPointsUsed > 0 ? 'POINTS_RAZORPAY' : 'RAZORPAY';
        }
      }
    } else {
      return NextResponse.json({ error: 'Invalid payment mode' }, { status: 400 });
    }

    const campaignId = generateCampaignId();
    const paymentId = `PAY-${campaignId.replace('CAMP-', '')}-${Date.now().toString(36).toUpperCase()}`;
    const activationDelayMs = Math.max(15, settings.activationDelaySeconds || 60) * 1000;
    const isImmediateStart = startMs <= nowMs + activationDelayMs;
    const activationDueAt = isImmediateStart ? new Date(nowMs + activationDelayMs) : new Date(startMs);

    // If online payment is needed, create Razorpay order first before reserving
    let razorpayOrderId = '';
    if (finalOnlineAmount > 0) {
      const razorpay = createRazorpayClient();
      const rpOrder = await razorpay.orders.create({
        amount: Math.round(finalOnlineAmount * 100),
        currency: 'INR',
        receipt: paymentId,
        notes: {
          type: 'CAMPAIGN_AD',
          campaignId,
          paymentId,
          restaurantId,
        },
      });
      razorpayOrderId = rpOrder.id;
    }

    const primaryItem = eligibleItems[0];
    const nowField = FieldValue.serverTimestamp();
    const normalizedKeywords = Array.isArray(targetKeywords)
      ? targetKeywords.map((k: any) => String(k).trim().toLowerCase()).filter(Boolean)
      : eligibleItems.flatMap((it) =>
          [it.name, it.category || ''].map((s) => s.toLowerCase()).filter(Boolean)
        );

    await adminDb.runTransaction(async (tx) => {
      // Re-verify points inside transaction
      const ptsRef = adminDb.collection('pointsAccounts').doc(restaurantId);
      const ptsSnap = await tx.get(ptsRef);
      const currentAvailablePts = ptsSnap.exists ? Number(ptsSnap.data()?.availablePoints || 0) : 0;
      const currentSpentPts = ptsSnap.exists ? Number(ptsSnap.data()?.spentPoints || 0) : 0;

      if (finalPointsUsed > 0 && currentAvailablePts < finalPointsUsed) {
        throw new Error('Insufficient reward points during atomic check.');
      }

      // Re-verify wallet inside transaction by summing wallet transactions + earnings snapshot
      if (finalWalletAmount > 0) {
        const latestSnapshot = await getRestaurantFinancialSnapshot(restaurantId);
        if (latestSnapshot.availableWalletBalance < finalWalletAmount) {
          throw new Error('Insufficient wallet balance during atomic check.');
        }

        const walletTxRef = adminDb.collection('restaurantWalletTransactions').doc();
        tx.set(walletTxRef, {
          transactionId: walletTxRef.id,
          restaurantId,
          type: finalOnlineAmount > 0 ? 'RESERVED' : 'DEBIT',
          category: 'CAMPAIGN_AD',
          campaignId,
          campaignName: String(campaignName).trim(),
          paymentId,
          paymentReference: razorpayOrderId || paymentId,
          amount: finalWalletAmount,
          balanceBefore: latestSnapshot.availableWalletBalance,
          balanceAfter: Math.round((latestSnapshot.availableWalletBalance - finalWalletAmount) * 100) / 100,
          status: finalOnlineAmount > 0 ? 'RESERVED' : 'COMPLETED',
          description: `${AD_PLACEMENTS[adType as CampaignAdType].title} – ${primaryItem.name}`,
          createdAt: nowField,
          updatedAt: nowField,
        });
      }

      // Deduct or reserve points
      if (finalPointsUsed > 0) {
        tx.set(
          ptsRef,
          {
            userId: restaurantId,
            userType: 'restaurant',
            availablePoints: currentAvailablePts - finalPointsUsed,
            spentPoints: finalOnlineAmount > 0 ? currentSpentPts : currentSpentPts + finalPointsUsed,
            updatedAt: nowField,
          },
          { merge: true }
        );

        const rewardTxRef = adminDb.collection('restaurantRewardTransactions').doc();
        tx.set(rewardTxRef, {
          transactionId: rewardTxRef.id,
          restaurantId,
          type: finalOnlineAmount > 0 ? 'RESERVED' : 'DEBIT',
          points: finalPointsUsed,
          rupeeValue: finalPointsValue,
          conversionRate: pointRate,
          campaignId,
          campaignName: String(campaignName).trim(),
          paymentId,
          status: finalOnlineAmount > 0 ? 'RESERVED' : 'COMPLETED',
          balanceBefore: currentAvailablePts,
          balanceAfter: currentAvailablePts - finalPointsUsed,
          description: `${finalOnlineAmount > 0 ? 'Reserved' : 'Redeemed'} ${finalPointsUsed} pts for ${String(campaignName).trim()}`,
          createdAt: nowField,
        });

        const legacyPtsTxRef = adminDb.collection('pointsTransactions').doc();
        tx.set(legacyPtsTxRef, {
          userId: restaurantId,
          type: 'spent',
          amount: finalPointsUsed,
          rupeesAmount: finalPointsValue,
          relatedCampaignId: campaignId,
          relatedPaymentId: paymentId,
          description: `Campaign: ${String(campaignName).trim()}`,
          balanceBefore: currentAvailablePts,
          balanceAfter: currentAvailablePts - finalPointsUsed,
          createdAt: nowField,
        });
      }

      const initialCampaignStatus =
        finalOnlineAmount > 0
          ? 'PENDING_PAYMENT'
          : isImmediateStart
          ? 'ACTIVATING'
          : 'SCHEDULED';

      const initialPaymentStatus = finalOnlineAmount > 0 ? 'PENDING_ONLINE' : 'PAID';

      // Create payment record
      tx.set(adminDb.collection('campaignPayments').doc(paymentId), {
        paymentId,
        campaignId,
        restaurantId,
        restaurantName,
        campaignName: String(campaignName).trim(),
        idempotencyKey,
        paymentMethod: resolvedPaymentMethod,
        totalAmount: computedTotalBudget,
        pointsUsed: finalPointsUsed,
        pointsValueInRupees: finalPointsValue,
        walletAmount: finalWalletAmount,
        onlineAmount: finalOnlineAmount,
        status: initialPaymentStatus,
        walletReservationStatus:
          finalWalletAmount > 0 ? (finalOnlineAmount > 0 ? 'RESERVED' : 'COMMITTED') : 'NONE',
        pointsReservationStatus:
          finalPointsUsed > 0 ? (finalOnlineAmount > 0 ? 'RESERVED' : 'COMMITTED') : 'NONE',
        razorpayOrderId: razorpayOrderId || null,
        createdAt: nowField,
        updatedAt: nowField,
        ...(finalOnlineAmount === 0 ? { paidAt: nowField } : {}),
      });

      // Create campaign record
      tx.set(adminDb.collection('adCampaigns').doc(campaignId), {
        campaignId,
        restaurantId,
        restaurantName,
        campaignName: String(campaignName).trim(),
        title: String(campaignName).trim(),
        description: String(description || '').trim(),
        adType,
        menuItemId: primaryItem.id,
        menuItemIds: eligibleItems.map((i) => i.id),
        menuItemName:
          eligibleItems.length > 1
            ? `${primaryItem.name} (+${eligibleItems.length - 1} more)`
            : primaryItem.name,
        menuItemNames: eligibleItems.map((i) => i.name),
        menuItemImage: primaryItem.image,
        menuItemsSnapshot: eligibleItems,
        offerBadge: offerBadge ? String(offerBadge).trim() : '',
        targetKeywords: Array.from(new Set(normalizedKeywords)),
        budget: normalizedBudgetType === 'DAILY' ? 'daily' : 'monthly',
        budgetType: normalizedBudgetType,
        dailyBudget: computedDailyBudget,
        totalBudget: computedTotalBudget,
        spentAmount: 0,
        remainingBudget: computedTotalBudget,
        todaySpent: 0,
        todaySpentDate: new Date().toISOString().slice(0, 10),
        dailyCost: computedDailyBudget,
        monthlyCost: computedTotalBudget,
        status: initialCampaignStatus.toLowerCase(),
        campaignStatus: initialCampaignStatus,
        paymentStatus: initialPaymentStatus,
        isActive: false,
        paymentMethod: resolvedPaymentMethod,
        paymentId,
        idempotencyKey,
        pointsUsed: finalPointsUsed,
        pointsValueInRupees: finalPointsValue,
        walletAmountUsed: finalWalletAmount,
        onlineAmountPaid: finalOnlineAmount,
        totalAmountPaid: finalOnlineAmount === 0 ? computedTotalBudget : 0,
        razorpayOrderId: razorpayOrderId || null,
        totalClicks: 0,
        totalSpent: 0,
        pointsRemaining: computedTotalBudget,
        impressions: 0,
        uniqueImpressions: 0,
        ordersGenerated: 0,
        revenueAttributed: 0,
        clickThroughRate: 0,
        startDate: new Date(startMs),
        endDate: new Date(endMs),
        startAt: new Date(startMs),
        endAt: new Date(endMs),
        activationDueAt,
        timezone: String(timezone || 'Asia/Kolkata'),
        createdBy: actor.uid,
        createdAt: nowField,
        updatedAt: nowField,
      });

      if (finalOnlineAmount === 0) {
        tx.set(adminDb.collection('campaignSchedules').doc(campaignId), {
          campaignId,
          restaurantId,
          status: initialCampaignStatus,
          startAt: new Date(startMs),
          endAt: new Date(endMs),
          activationDueAt,
          updatedAt: nowField,
        });

        const campTxRef = adminDb.collection('campaignTransactions').doc();
        tx.set(campTxRef, {
          transactionId: campTxRef.id,
          campaignId,
          restaurantId,
          paymentId,
          paymentMethod: resolvedPaymentMethod,
          totalAmount: computedTotalBudget,
          pointsUsed: finalPointsUsed,
          walletAmount: finalWalletAmount,
          onlineAmount: 0,
          status: 'COMPLETED',
          description: `Paid via ${resolvedPaymentMethod} for ${String(campaignName).trim()}`,
          createdAt: nowField,
        });
      }

      const auditRef = adminDb.collection('auditLogs').doc();
      tx.set(auditRef, {
        action: 'CAMPAIGN_CREATED',
        campaignId,
        paymentId,
        restaurantId,
        adType,
        totalBudget: computedTotalBudget,
        paymentMethod: resolvedPaymentMethod,
        performedBy: actor.uid,
        timestamp: nowField,
      });
    });

    return NextResponse.json({
      success: true,
      campaignId,
      paymentId,
      requiresOnlinePayment: finalOnlineAmount > 0,
      onlineAmount: finalOnlineAmount,
      walletAmountUsed: finalWalletAmount,
      pointsUsed: finalPointsUsed,
      razorpayOrderId: razorpayOrderId || null,
      razorpayKeyId:
        finalOnlineAmount > 0
          ? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || null
          : null,
      campaignStatus:
        finalOnlineAmount > 0
          ? 'PENDING_PAYMENT'
          : isImmediateStart
          ? 'ACTIVATING'
          : 'SCHEDULED',
      activationDueAt: activationDueAt.toISOString(),
    });
  } catch (err: any) {
    console.error('[POST /api/campaigns/create-checkout] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create campaign' },
      { status: 500 }
    );
  }
}
