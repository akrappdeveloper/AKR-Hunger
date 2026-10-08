/**
 * Hunger Wallet Service
 * ======================
 * Manages customer wallet balance, transactions,
 * auto-top-up, and cashback. No paid AI needed.
 *
 * Design principles:
 * - Wallet balance is always derived from Firestore (no client-side math)
 * - Every transaction records sourceId for traceability
 * - Refunds to wallet are instant; bank refunds go via Razorpay
 */

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { HungerWallet, EnhancedWalletTransaction } from './hunger-types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WalletOperationResult {
  success: boolean;
  newBalance?: number;
  transactionId?: string;
  error?: string;
}

// ─── Core Wallet Ops ──────────────────────────────────────────────────────────

/**
 * Get wallet by customer ID. Creates it if it doesn't exist.
 */
export async function getOrCreateWallet(customerId: string): Promise<HungerWallet> {
  const ref = adminDb.collection('hungerWallets').doc(customerId);
  const snap = await ref.get();

  if (snap.exists) {
    return { id: snap.id, ...snap.data() } as HungerWallet;
  }

  const newWallet: Omit<HungerWallet, 'id'> = {
    customerId,
    balance: 0,
    currency: 'INR',
    isActive: true,
    autoTopUpEnabled: false,
    autoTopUpThreshold: 100,
    autoTopUpAmount: 200,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await ref.set(newWallet);
  return { id: customerId, ...newWallet };
}

/**
 * Add funds to wallet (top-up, cashback, refund, bonus).
 */
export async function creditWallet(
  customerId: string,
  amount: number,
  type: EnhancedWalletTransaction['type'],
  description: string,
  sourceId?: string,
  metadata?: Record<string, any>
): Promise<WalletOperationResult> {
  if (amount <= 0) return { success: false, error: 'Amount must be positive' };

  const walletRef = adminDb.collection('hungerWallets').doc(customerId);

  try {
    let newBalance = 0;

    await adminDb.runTransaction(async (tx: any) => {
      const snap = await tx.get(walletRef);

      let currentBalance = 0;
      if (!snap.exists) {
        tx.set(walletRef, {
          customerId,
          balance: 0,
          currency: 'INR',
          isActive: true,
          autoTopUpEnabled: false,
          autoTopUpThreshold: 100,
          autoTopUpAmount: 200,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else {
        currentBalance = snap.data()?.balance || 0;
      }

      newBalance = +(currentBalance + amount).toFixed(2);

      tx.update(walletRef, {
        balance: newBalance,
        updatedAt: new Date(),
      });

      // Record transaction
      const txRef = adminDb.collection('walletTransactions').doc();
      const transaction: Omit<EnhancedWalletTransaction, 'id'> = {
        customerId,
        type,
        amount,
        balanceAfter: newBalance,
        description,
        sourceId,
        status: 'completed',
        metadata: metadata || {},
        createdAt: new Date(),
      };
      tx.set(txRef, transaction);
    });

    return { success: true, newBalance };
  } catch (error: any) {
    console.error('creditWallet error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Debit wallet for order payment.
 * Returns failure if insufficient balance.
 */
export async function debitWallet(
  customerId: string,
  amount: number,
  orderId: string,
  description: string = 'Order payment'
): Promise<WalletOperationResult> {
  if (amount <= 0) return { success: false, error: 'Amount must be positive' };

  const walletRef = adminDb.collection('hungerWallets').doc(customerId);

  try {
    let newBalance = 0;
    let txId = '';

    await adminDb.runTransaction(async (tx: any) => {
      const snap = await tx.get(walletRef);
      if (!snap.exists) throw new Error('Wallet not found');

      const currentBalance = snap.data()?.balance || 0;
      if (currentBalance < amount) {
        throw new Error(`Insufficient balance. Available: ₹${currentBalance.toFixed(2)}`);
      }

      newBalance = +(currentBalance - amount).toFixed(2);
      tx.update(walletRef, { balance: newBalance, updatedAt: new Date() });

      const txRef = adminDb.collection('walletTransactions').doc();
      txId = txRef.id;

      const transaction: Omit<EnhancedWalletTransaction, 'id'> = {
        customerId,
        type: 'debit',
        amount: -amount, // Stored negative for debit
        balanceAfter: newBalance,
        description,
        sourceId: orderId,
        status: 'completed',
        metadata: { orderId },
        createdAt: new Date(),
      };
      tx.set(txRef, transaction);
    });

    return { success: true, newBalance, transactionId: txId };
  } catch (error: any) {
    console.error('debitWallet error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Process instant refund to wallet (e.g., cancelled order).
 */
export async function refundToWallet(
  customerId: string,
  amount: number,
  orderId: string,
  reason: string
): Promise<WalletOperationResult> {
  return creditWallet(
    customerId,
    amount,
    'refund',
    `Refund: ${reason}`,
    orderId,
    { orderId, reason, isInstant: true }
  );
}

/**
 * Add cashback after order completion.
 */
export async function addCashback(
  customerId: string,
  orderId: string,
  orderAmount: number,
  cashbackPercent: number = 5
): Promise<WalletOperationResult> {
  const cashbackAmount = +(orderAmount * (cashbackPercent / 100)).toFixed(2);
  if (cashbackAmount < 1) return { success: false, error: 'Cashback too small' };

  return creditWallet(
    customerId,
    cashbackAmount,
    'cashback',
    `${cashbackPercent}% cashback on order`,
    orderId,
    { orderId, orderAmount, cashbackPercent }
  );
}

/**
 * Get recent wallet transactions.
 */
export async function getWalletTransactions(
  customerId: string,
  limit: number = 20
): Promise<EnhancedWalletTransaction[]> {
  const snap = await adminDb
    .collection('walletTransactions')
    .where('customerId', '==', customerId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map((doc: any) => ({
    id: doc.id,
    ...doc.data(),
  })) as EnhancedWalletTransaction[];
}

/**
 * Apply partial wallet payment (wallet + other payment method).
 * Returns the portion to pay via the other method.
 */
export function calculateWalletUsage(
  walletBalance: number,
  orderTotal: number
): { walletAmount: number; remainingAmount: number } {
  const walletAmount = Math.min(walletBalance, orderTotal);
  const remainingAmount = +(orderTotal - walletAmount).toFixed(2);
  return { walletAmount: +walletAmount.toFixed(2), remainingAmount };
}

/**
 * Add bonus/welcome credit.
 */
export async function addWelcomeBonus(customerId: string): Promise<WalletOperationResult> {
  return creditWallet(
    customerId,
    50,
    'bonus',
    'Welcome bonus — thanks for joining Hunger! 🎉',
    'WELCOME_BONUS',
    { isOneTime: true }
  );
}
