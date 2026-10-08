/**
 * Hunger Rewards Service
 * =======================
 * Points-based loyalty system. No paid AI needed.
 *
 * Earning rules:
 * - 1 point per ₹10 spent (configurable)
 * - 10 points for reviews
 * - 25 points for referrals
 * - 50 points for group orders
 * - Bonus multipliers on special days
 *
 * Redemption:
 * - 100 points = ₹10 discount (configurable)
 * - Min 100 points to redeem
 * - Max 50% of order value can be covered by points
 */

import { adminDb } from './firebase-admin';
import { RewardAccount, RewardTransaction, RewardConfig } from './hunger-types';

// Default configuration (also stored in Firestore for admin override)
export const DEFAULT_REWARD_CONFIG: RewardConfig = {
  pointsPerRupee: 0.1,           // ₹10 → 1 point
  redemptionRate: 0.1,           // 100 points → ₹10
  minRedemptionPoints: 100,
  maxRedemptionPercent: 50,
  referralBonus: 25,
  reviewBonus: 10,
  groupOrderBonus: 50,
  orderBonus: 0,
  milestoneBonus: {
    ordersCount: 10,
    bonusPoints: 100,
  },
};

export interface RewardOperationResult {
  success: boolean;
  newPoints?: number;
  pointsEarned?: number;
  error?: string;
}

// ─── Account Management ───────────────────────────────────────────────────────

export async function getOrCreateRewardAccount(customerId: string): Promise<RewardAccount> {
  const ref = adminDb.collection('rewardAccounts').doc(customerId);
  const snap = await ref.get();

  if (snap.exists) {
    return { id: snap.id, ...snap.data() } as RewardAccount;
  }

  const account: Omit<RewardAccount, 'id'> = {
    customerId,
    points: 0,
    lifetimePoints: 0,
    tier: 'bronze',
    totalOrders: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await ref.set(account);
  return { id: customerId, ...account };
}

// ─── Earning Points ───────────────────────────────────────────────────────────

/**
 * Award points for an order.
 */
export async function awardOrderPoints(
  customerId: string,
  orderId: string,
  orderAmount: number,
  config: RewardConfig = DEFAULT_REWARD_CONFIG
): Promise<RewardOperationResult> {
  const points = Math.floor(orderAmount * config.pointsPerRupee);
  if (points <= 0) return { success: false, error: 'No points earned for this order' };

  return addPoints(customerId, points, 'earned_order', `Order reward (₹${orderAmount})`, orderId);
}

/**
 * Award referral bonus to the referrer.
 */
export async function awardReferralPoints(
  referrerId: string,
  newUserId: string,
  config: RewardConfig = DEFAULT_REWARD_CONFIG
): Promise<RewardOperationResult> {
  return addPoints(referrerId, config.referralBonus, 'earned_referral', 'Referral bonus', newUserId);
}

/**
 * Award review bonus.
 */
export async function awardReviewPoints(
  customerId: string,
  reviewId: string,
  config: RewardConfig = DEFAULT_REWARD_CONFIG
): Promise<RewardOperationResult> {
  return addPoints(customerId, config.reviewBonus, 'earned_review', 'Review bonus', reviewId);
}

/**
 * Award group order bonus.
 */
export async function awardGroupOrderPoints(
  customerId: string,
  groupOrderId: string,
  config: RewardConfig = DEFAULT_REWARD_CONFIG
): Promise<RewardOperationResult> {
  return addPoints(
    customerId, config.groupOrderBonus, 'earned_bonus',
    'Group order bonus 🎉', groupOrderId
  );
}

// ─── Redemption ───────────────────────────────────────────────────────────────

/**
 * Calculate how many points can be redeemed for a given order.
 */
export function calculateRedemption(
  points: number,
  orderAmount: number,
  config: RewardConfig = DEFAULT_REWARD_CONFIG
): { redeemablePoints: number; discount: number; remainingPoints: number } {
  if (points < config.minRedemptionPoints) {
    return { redeemablePoints: 0, discount: 0, remainingPoints: points };
  }

  const maxDiscount = orderAmount * (config.maxRedemptionPercent / 100);
  const maxPointsForDiscount = Math.floor(maxDiscount / config.redemptionRate) * 10;
  const redeemablePoints = Math.min(points, maxPointsForDiscount);
  const discount = +((redeemablePoints / 10) * config.redemptionRate).toFixed(2);

  return {
    redeemablePoints,
    discount,
    remainingPoints: points - redeemablePoints,
  };
}

/**
 * Redeem points for an order discount.
 */
export async function redeemPoints(
  customerId: string,
  pointsToRedeem: number,
  orderId: string,
  config: RewardConfig = DEFAULT_REWARD_CONFIG
): Promise<RewardOperationResult & { discount: number }> {
  if (pointsToRedeem < config.minRedemptionPoints) {
    return { success: false, discount: 0, error: `Minimum ${config.minRedemptionPoints} points needed` };
  }

  const discount = +((pointsToRedeem / 10) * config.redemptionRate).toFixed(2);

  const ref = adminDb.collection('rewardAccounts').doc(customerId);
  try {
    let newPoints = 0;

    await adminDb.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Reward account not found');

      const currentPoints = snap.data()?.points || 0;
      if (currentPoints < pointsToRedeem) {
        throw new Error(`Insufficient points. Available: ${currentPoints}`);
      }

      newPoints = currentPoints - pointsToRedeem;
      tx.update(ref, { points: newPoints, updatedAt: new Date() });

      const txRef = adminDb.collection('rewardTransactions').doc();
      const transaction: Omit<RewardTransaction, 'id'> = {
        customerId,
        type: 'redeemed',
        points: -pointsToRedeem,
        pointsAfter: newPoints,
        description: `Redeemed ${pointsToRedeem} pts = ₹${discount} off`,
        sourceId: orderId,
        createdAt: new Date(),
      };
      tx.set(txRef, transaction);
    });

    return { success: true, newPoints, discount };
  } catch (error: any) {
    return { success: false, discount: 0, error: error.message };
  }
}

// ─── Tier Management ──────────────────────────────────────────────────────────

export function calculateTier(lifetimePoints: number): RewardAccount['tier'] {
  if (lifetimePoints >= 5000) return 'platinum';
  if (lifetimePoints >= 2000) return 'gold';
  if (lifetimePoints >= 500) return 'silver';
  return 'bronze';
}

export function getNextTierThreshold(tier: RewardAccount['tier']): number {
  switch (tier) {
    case 'bronze': return 500;
    case 'silver': return 2000;
    case 'gold': return 5000;
    case 'platinum': return Infinity;
  }
}

export function getTierBenefits(tier: RewardAccount['tier']): string[] {
  switch (tier) {
    case 'bronze': return ['1 point per ₹10', 'Basic cashback'];
    case 'silver': return ['1.5x points', '5% cashback', 'Free delivery on weekends'];
    case 'gold': return ['2x points', '8% cashback', 'Priority support', 'Free delivery always'];
    case 'platinum': return ['3x points', '12% cashback', 'Dedicated support', 'Free delivery', 'Monthly bonus 200 pts'];
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function addPoints(
  customerId: string,
  points: number,
  type: RewardTransaction['type'],
  description: string,
  sourceId?: string
): Promise<RewardOperationResult> {
  const ref = adminDb.collection('rewardAccounts').doc(customerId);

  try {
    let newPoints = 0;

    await adminDb.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      let currentPoints = 0;
      let lifetimePoints = 0;

      if (!snap.exists) {
        tx.set(ref, {
          customerId, points: 0, lifetimePoints: 0,
          tier: 'bronze', totalOrders: 0,
          createdAt: new Date(), updatedAt: new Date(),
        });
      } else {
        currentPoints = snap.data()?.points || 0;
        lifetimePoints = snap.data()?.lifetimePoints || 0;
      }

      newPoints = currentPoints + points;
      const newLifetime = lifetimePoints + points;
      const newTier = calculateTier(newLifetime);

      tx.update(ref, {
        points: newPoints,
        lifetimePoints: newLifetime,
        tier: newTier,
        updatedAt: new Date(),
      });

      const txRef = adminDb.collection('rewardTransactions').doc();
      tx.set(txRef, {
        customerId, type, points, pointsAfter: newPoints,
        description, sourceId, createdAt: new Date(),
      });
    });

    return { success: true, newPoints, pointsEarned: points };
  } catch (error: any) {
    console.error('addPoints error:', error);
    return { success: false, error: error.message };
  }
}
