import 'server-only';
import { adminDb } from '@/lib/firebase-admin-db';
import { FieldValue } from 'firebase-admin/firestore';
import { normalizeCampaignStatus } from './constants';

let lastRunTimestamp = 0;
const THROTTLE_MS = 10_000;

function toMillis(val: any): number {
  if (!val) return 0;
  if (typeof val?.toDate === 'function') return val.toDate().getTime();
  if (typeof val?.seconds === 'number') return val.seconds * 1000;
  const parsed = new Date(val).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function checkMenuItemsEligibility(menuItemIds: string[]): Promise<boolean> {
  if (!menuItemIds || menuItemIds.length === 0) return false;
  const snaps = await Promise.all(
    menuItemIds.map((id) => adminDb.collection('menuItems').doc(id).get())
  );
  return snaps.some((snap) => {
    if (!snap.exists) return false;
    const d = snap.data() || {};
    const approved = !d.approvalStatus || d.approvalStatus === 'approved';
    const available = d.available !== false && d.isAvailable !== false;
    const notDeleted = d.deleted !== true && d.isDeleted !== true;
    return approved && available && notDeleted;
  });
}

/**
 * Releases reserved wallet and reward points balances when an online payment fails or expires.
 */
export async function releasePaymentReservations(
  paymentId: string,
  reason: string,
  finalCampaignStatus: 'FAILED' | 'CANCELLED' = 'FAILED'
): Promise<void> {
  if (!adminDb || !paymentId) return;

  await adminDb.runTransaction(async (tx) => {
    const payRef = adminDb.collection('campaignPayments').doc(paymentId);
    const paySnap = await tx.get(payRef);
    if (!paySnap.exists) return;

    const pay = paySnap.data()!;
    if (pay.status === 'PAID') return; // Never release a paid payment

    const restaurantId = pay.restaurantId;
    const campaignId = pay.campaignId;
    const now = FieldValue.serverTimestamp();

    // Release reserved wallet funds
    if (pay.walletReservationStatus === 'RESERVED' && Number(pay.walletAmount || 0) > 0) {
      const reservedTxSnap = await tx.get(
        adminDb
          .collection('restaurantWalletTransactions')
          .where('paymentId', '==', paymentId)
          .where('status', '==', 'RESERVED')
      );
      reservedTxSnap.docs.forEach((d) => {
        tx.update(d.ref, {
          status: 'RELEASED',
          type: 'RELEASED',
          updatedAt: now,
          description: `${d.data().description || 'Campaign reservation'} (Released: ${reason})`,
        });
      });
    }

    // Release reserved reward points
    if (pay.pointsReservationStatus === 'RESERVED' && Number(pay.pointsUsed || 0) > 0) {
      const ptsRef = adminDb.collection('pointsAccounts').doc(restaurantId);
      const ptsSnap = await tx.get(ptsRef);
      const currentAvailable = ptsSnap.exists ? Number(ptsSnap.data()?.availablePoints || 0) : 0;
      const restorePts = Number(pay.pointsUsed || 0);

      tx.set(
        ptsRef,
        {
          availablePoints: currentAvailable + restorePts,
          updatedAt: now,
        },
        { merge: true }
      );

      const rewardTxRef = adminDb.collection('restaurantRewardTransactions').doc();
      tx.set(rewardTxRef, {
        transactionId: rewardTxRef.id,
        restaurantId,
        type: 'RELEASED',
        points: restorePts,
        rupeeValue: Number(pay.pointsValueInRupees || 0),
        conversionRate: restorePts > 0 ? Number(pay.pointsValueInRupees || 0) / restorePts : 1,
        campaignId,
        campaignName: pay.campaignName || '',
        paymentId,
        status: 'RELEASED',
        balanceBefore: currentAvailable,
        balanceAfter: currentAvailable + restorePts,
        description: `Released ${restorePts} reserved points (${reason})`,
        createdAt: now,
      });
    }

    tx.update(payRef, {
      status: finalCampaignStatus === 'CANCELLED' ? 'CANCELLED' : 'FAILED',
      walletReservationStatus:
        pay.walletReservationStatus === 'RESERVED' ? 'RELEASED' : pay.walletReservationStatus || 'NONE',
      pointsReservationStatus:
        pay.pointsReservationStatus === 'RESERVED' ? 'RELEASED' : pay.pointsReservationStatus || 'NONE',
      failureReason: reason,
      updatedAt: now,
    });

    if (campaignId) {
      const campRef = adminDb.collection('adCampaigns').doc(campaignId);
      const campSnap = await tx.get(campRef);
      if (campSnap.exists && campSnap.data()?.paymentStatus !== 'PAID') {
        tx.update(campRef, {
          paymentStatus: finalCampaignStatus === 'CANCELLED' ? 'CANCELLED' : 'FAILED',
          campaignStatus: finalCampaignStatus,
          status: finalCampaignStatus.toLowerCase(),
          isActive: false,
          updatedAt: now,
        });
      }
    }
  });
}

/**
 * Authoritative campaign schedule & lifecycle processor.
 * Transitions ACTIVATING -> ACTIVE, SCHEDULED -> ACTIVE/ACTIVATING,
 * stops expired/exhausted campaigns, pauses if menu items unavailable, and cleans stale pending payments.
 */
export async function processCampaignSchedules(force = false): Promise<{
  activated: number;
  completed: number;
  paused: number;
  resumed: number;
  cleanedPending: number;
}> {
  const summary = { activated: 0, completed: 0, paused: 0, resumed: 0, cleanedPending: 0 };
  if (!adminDb) return summary;

  const nowMs = Date.now();
  if (!force && nowMs - lastRunTimestamp < THROTTLE_MS) {
    return summary;
  }
  lastRunTimestamp = nowMs;

  try {
    const snap = await adminDb.collection('adCampaigns').get();
    const nowField = FieldValue.serverTimestamp();

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const status = normalizeCampaignStatus(data);
      const startMs = toMillis(data.startAt || data.startDate);
      const endMs = toMillis(data.endAt || data.endDate);
      const activationDueMs = toMillis(data.activationDueAt);
      const createdMs = toMillis(data.createdAt);
      const totalBudget = Number(data.totalBudget ?? data.monthlyCost ?? data.pointsRemaining ?? 0);
      const spentAmount = Number(data.spentAmount ?? data.totalSpent ?? 0);
      const remainingBudget =
        data.remainingBudget !== undefined
          ? Number(data.remainingBudget)
          : Math.max(0, totalBudget - spentAmount);
      const itemIds: string[] = Array.isArray(data.menuItemIds) && data.menuItemIds.length > 0
        ? data.menuItemIds
        : data.menuItemId
        ? [data.menuItemId]
        : [];

      // 1. Reconcile stale unpaid PENDING_PAYMENT campaigns (> 30 mins old)
      if (status === 'PENDING_PAYMENT' && createdMs > 0 && nowMs - createdMs > 30 * 60 * 1000) {
        if (data.paymentId) {
          await releasePaymentReservations(data.paymentId, 'Payment session expired', 'FAILED');
        } else {
          await docSnap.ref.update({
            campaignStatus: 'FAILED',
            status: 'failed',
            paymentStatus: 'FAILED',
            isActive: false,
            updatedAt: nowField,
          });
        }
        summary.cleanedPending++;
        continue;
      }

      // Skip terminal or unpaid states
      if (['DRAFT', 'PENDING_PAYMENT', 'COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED'].includes(status)) {
        continue;
      }

      // 2. Stop campaigns past end time or with exhausted budget
      if ((endMs > 0 && nowMs >= endMs) || (totalBudget > 0 && remainingBudget <= 0)) {
        await docSnap.ref.update({
          campaignStatus: 'COMPLETED',
          status: 'completed',
          isActive: false,
          completedAt: nowField,
          updatedAt: nowField,
        });
        await adminDb
          .collection('campaignSchedules')
          .doc(docSnap.id)
          .set({ campaignId: docSnap.id, status: 'COMPLETED', updatedAt: nowField }, { merge: true });
        summary.completed++;
        continue;
      }

      // 3. Activate ACTIVATING / SCHEDULED campaigns when paid and due
      if (status === 'ACTIVATING' || status === 'SCHEDULED') {
        if (data.paymentStatus !== 'PAID') continue;

        const readyBySchedule = startMs <= 0 || nowMs >= startMs;
        const readyByActivationDelay = activationDueMs <= 0 || nowMs >= activationDueMs;

        if (readyBySchedule && readyByActivationDelay) {
          const itemsEligible = await checkMenuItemsEligibility(itemIds);
          if (itemsEligible) {
            await docSnap.ref.update({
              campaignStatus: 'ACTIVE',
              status: 'active',
              isActive: true,
              activatedAt: nowField,
              pauseReason: FieldValue.delete(),
              updatedAt: nowField,
            });
            await adminDb
              .collection('campaignSchedules')
              .doc(docSnap.id)
              .set({ campaignId: docSnap.id, status: 'ACTIVE', activatedAt: nowField, updatedAt: nowField }, { merge: true });
            summary.activated++;
          } else {
            await docSnap.ref.update({
              campaignStatus: 'PAUSED',
              status: 'paused',
              isActive: false,
              pauseReason: 'Advertised menu items unavailable',
              updatedAt: nowField,
            });
            summary.paused++;
          }
        }
        continue;
      }

      // 4. Pause ACTIVE campaigns if all advertised items became unavailable
      if (status === 'ACTIVE') {
        const itemsEligible = await checkMenuItemsEligibility(itemIds);
        if (!itemsEligible) {
          await docSnap.ref.update({
            campaignStatus: 'PAUSED',
            status: 'paused',
            isActive: false,
            pauseReason: 'Advertised menu items unavailable',
            updatedAt: nowField,
          });
          summary.paused++;
        }
        continue;
      }

      // 5. Auto-resume PAUSED campaigns if paused solely for item unavailability and items are back
      if (status === 'PAUSED' && data.pauseReason === 'Advertised menu items unavailable') {
        const itemsEligible = await checkMenuItemsEligibility(itemIds);
        if (itemsEligible && (startMs <= 0 || nowMs >= startMs)) {
          await docSnap.ref.update({
            campaignStatus: 'ACTIVE',
            status: 'active',
            isActive: true,
            pauseReason: FieldValue.delete(),
            updatedAt: nowField,
          });
          summary.resumed++;
        }
      }
    }
  } catch (err) {
    console.warn('[LifecycleEngine] Notice:', (err as any)?.message);
  }

  return summary;
}
