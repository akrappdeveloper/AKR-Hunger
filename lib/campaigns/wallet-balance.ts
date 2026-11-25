import 'server-only';
import { adminDb } from '@/lib/firebase-admin-db';
import { AdSettings } from '@/lib/types';
import { DEFAULT_AD_SETTINGS } from './constants';

export interface RestaurantFinancialSnapshot {
  totalEarnings: number;
  pendingWithdrawals: number;
  totalWithdrawn: number;
  campaignDebits: number;
  campaignRefunds: number;
  availableWalletBalance: number;
  availablePoints: number;
  pointsToRupeeRate: number;
}

/**
 * Fetches authoritative adSettings/global from Firestore with safe defaults.
 */
export async function getAdSettingsServer(): Promise<AdSettings> {
  if (!adminDb) return DEFAULT_AD_SETTINGS;
  try {
    const snap = await adminDb.collection('adSettings').doc('global').get();
    if (!snap.exists) return DEFAULT_AD_SETTINGS;
    const data = snap.data() || {};
    return {
      ...DEFAULT_AD_SETTINGS,
      ...data,
      minDailyBudget: Number(data.minDailyBudget ?? DEFAULT_AD_SETTINGS.minDailyBudget),
      minTotalBudget: Number(data.minTotalBudget ?? DEFAULT_AD_SETTINGS.minTotalBudget),
      cpcRate: Number(data.cpcRate ?? DEFAULT_AD_SETTINGS.cpcRate),
      cpmRate: Number(data.cpmRate ?? DEFAULT_AD_SETTINGS.cpmRate),
      pointsToRupeeRate: Number(data.pointsToRupeeRate ?? DEFAULT_AD_SETTINGS.pointsToRupeeRate),
      activationDelaySeconds: Number(data.activationDelaySeconds ?? DEFAULT_AD_SETTINGS.activationDelaySeconds),
      estimatedCtrPercent: Number(data.estimatedCtrPercent ?? DEFAULT_AD_SETTINGS.estimatedCtrPercent),
      placementsEnabled: {
        ...DEFAULT_AD_SETTINGS.placementsEnabled,
        ...(data.placementsEnabled || {}),
      },
      placementMultipliers: {
        ...DEFAULT_AD_SETTINGS.placementMultipliers,
        ...(data.placementMultipliers || {}),
      },
    };
  } catch (err) {
    console.warn('[AdSettings] Fallback to defaults:', (err as any)?.message);
    return DEFAULT_AD_SETTINGS;
  }
}

/**
 * Authoritative server-side calculation of Restaurant Wallet Balance & Reward Points.
 * Integrates existing delivered order earnings, withdrawalRequests, and restaurantWalletTransactions.
 */
export async function getRestaurantFinancialSnapshot(
  restaurantId: string
): Promise<RestaurantFinancialSnapshot> {
  const settings = await getAdSettingsServer();

  const [ordersSnap, withdrawalsSnap, walletTxSnap, pointsSnap] = await Promise.all([
    adminDb
      .collection('orders')
      .where('restaurantId', '==', restaurantId)
      .where('status', '==', 'delivered')
      .get(),
    adminDb
      .collection('withdrawalRequests')
      .where('restaurantId', '==', restaurantId)
      .get(),
    adminDb
      .collection('restaurantWalletTransactions')
      .where('restaurantId', '==', restaurantId)
      .get(),
    adminDb.collection('pointsAccounts').doc(restaurantId).get(),
  ]);

  let totalEarnings = 0;
  ordersSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const itemsSubtotal = Array.isArray(data.items)
      ? data.items.reduce(
          (sum: number, item: any) => sum + Number(item?.price || 0) * Number(item?.quantity || 1),
          0
        )
      : Number(data.subtotal || 0);
    totalEarnings += itemsSubtotal;
  });

  let pendingWithdrawals = 0;
  let totalWithdrawn = 0;
  withdrawalsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const amount = Number(data.amount || 0);
    if (data.status === 'pending') pendingWithdrawals += amount;
    else if (data.status === 'completed') totalWithdrawn += amount;
  });

  let campaignDebits = 0;
  let campaignRefunds = 0;
  walletTxSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const amount = Number(data.amount || 0);
    const type = String(data.type || '').toUpperCase();
    const status = String(data.status || '').toUpperCase();

    if ((type === 'DEBIT' || type === 'RESERVED') && (status === 'COMPLETED' || status === 'RESERVED')) {
      campaignDebits += amount;
    } else if ((type === 'CREDIT' || type === 'REFUND') && status === 'COMPLETED') {
      campaignRefunds += amount;
    }
  });

  const availableWalletBalance = Math.max(
    0,
    Math.round((totalEarnings - pendingWithdrawals - totalWithdrawn - campaignDebits + campaignRefunds) * 100) / 100
  );

  const availablePoints = pointsSnap.exists ? Number(pointsSnap.data()?.availablePoints || 0) : 0;

  return {
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    pendingWithdrawals: Math.round(pendingWithdrawals * 100) / 100,
    totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
    campaignDebits: Math.round(campaignDebits * 100) / 100,
    campaignRefunds: Math.round(campaignRefunds * 100) / 100,
    availableWalletBalance,
    availablePoints,
    pointsToRupeeRate: settings.pointsToRupeeRate,
  };
}
