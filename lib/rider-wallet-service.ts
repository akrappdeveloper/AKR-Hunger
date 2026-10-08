import { db } from '@/lib/firebase';
import {
  doc, getDoc, setDoc, updateDoc, collection,
  runTransaction, serverTimestamp, increment, addDoc,
  getDocs, query, where
} from 'firebase/firestore';
import {
  RiderEarningSettings, RiderWalletTransaction,
  WithdrawalRequest, CodSettlementRequest, Order
} from '@/lib/types';

export const DEFAULT_RIDER_EARNING_SETTINGS: RiderEarningSettings = {
  deliveryChargeRiderShare: 80, // 80% to Rider
  platformShare: 20,           // 20% to Hunger
  defaultCodLimit: 3000,       // ₹3,000 default cash limit
  allowPrepaidWhenCodBlocked: true, // Allow prepaid orders even if COD limit is full
  minWithdrawal: 100,          // Minimum withdrawal ₹100
  maxDailyWithdrawal: 5000,    // Maximum daily withdrawal ₹5,000
  withdrawalProcessingFee: 0,  // ₹0 processing fee
};

/**
 * Fetch server-side Rider Earning Settings from Firestore
 */
export async function getRiderEarningSettings(): Promise<RiderEarningSettings> {
  try {
    const settingsDoc = await getDoc(doc(db, 'systemSettings', 'riderEarning'));
    if (settingsDoc.exists()) {
      return {
        ...DEFAULT_RIDER_EARNING_SETTINGS,
        ...settingsDoc.data(),
      } as RiderEarningSettings;
    }
  } catch (err) {
    console.warn('[RiderWallet] Using default earning settings:', err);
  }
  return DEFAULT_RIDER_EARNING_SETTINGS;
}

/**
 * Check if a delivery partner is eligible for a COD order
 * Checks: online status, codBlocked, and PROJECTED COD exposure
 */
export async function checkRiderOrderEligibility(
  riderId: string,
  isCodOrder: boolean,
  orderTotal: number = 0
): Promise<{ eligible: boolean; reason?: string; codOutstanding?: number; codLimit?: number }> {
  try {
    const riderDoc = await getDoc(doc(db, 'deliveryPersons', riderId));
    if (!riderDoc.exists()) {
      return { eligible: false, reason: 'Rider not found' };
    }

    const data = riderDoc.data();
    const settings = await getRiderEarningSettings();
    const codLimit = Number(data.codLimit || settings.defaultCodLimit);
    const codCollected = Number(data.codCollected || 0);
    const codDeposited = Number(data.codDeposited || 0);
    const codOutstanding = Math.max(0, codCollected - codDeposited);
    const isCodBlocked = data.codBlocked === true || codOutstanding >= codLimit;

    // Prepaid Order Check
    if (!isCodOrder) {
      if (isCodBlocked && !settings.allowPrepaidWhenCodBlocked) {
        return { eligible: false, reason: 'Account temporarily paused for settlement' };
      }
      return { eligible: true };
    }

    // COD Order Checks
    if (isCodBlocked) {
      return {
        eligible: false,
        reason: 'COD cash limit reached. Settle cash to receive COD orders.',
        codOutstanding,
        codLimit,
      };
    }

    // Projected COD Exposure Check
    const projectedExposure = codOutstanding + orderTotal;
    if (projectedExposure > codLimit) {
      return {
        eligible: false,
        reason: `Projected COD cash (₹${projectedExposure}) would exceed limit (₹${codLimit})`,
        codOutstanding,
        codLimit,
      };
    }

    return { eligible: true, codOutstanding, codLimit };
  } catch (err: any) {
    console.error('[RiderWallet] Eligibility check error:', err);
    return { eligible: true }; // Fallback to avoid blocking on network error
  }
}

/**
 * Process order completion earnings atomically with IDEMPOTENCY
 * Credits 80% (or configured share) of delivery charge + 100% tip to Available Earnings
 * Updates COD Outstanding if payment method is COD
 */
export async function processOrderCompletionEarning(orderId: string, riderId: string) {
  const settings = await getRiderEarningSettings();

  return await runTransaction(db, async (transaction) => {
    const orderRef = doc(db, 'orders', orderId);
    const riderRef = doc(db, 'deliveryPersons', riderId);

    const orderSnap = await transaction.get(orderRef);
    const riderSnap = await transaction.get(riderRef);

    if (!orderSnap.exists()) throw new Error('Order not found');
    if (!riderSnap.exists()) throw new Error('Rider profile not found');

    const orderData = orderSnap.data() as Order;
    const riderData = riderSnap.data();

    // ─── IDEMPOTENCY CHECK ──────────────────────────────────────────────────
    // Never process or credit earnings twice for the same order
    if ((orderData as any).earningsProcessed === true) {
      console.log(`[RiderWallet] Order ${orderId} earnings already processed. Skipping duplicate event.`);
      return { duplicate: true };
    }

    const orderTotal = Number(orderData.total || 0);
    const isCod = orderData.paymentMethod === 'cod';
    const totalItemsQty = orderData.items?.reduce((s, it) => s + (it.quantity || 1), 0) || 1;

    // Delivery charge only (NEVER food price, platform fee or taxes)
    const rawDeliveryCharge = Number(
      orderData.deliveryCharge || (orderData as any).deliveryFee || (totalItemsQty > 1 ? 60 : 40)
    );

    // Configured Rider Share (default 80%)
    const riderSharePercent = Number(settings.deliveryChargeRiderShare || 80);
    const riderDeliveryEarning = Math.round((rawDeliveryCharge * riderSharePercent) / 100);

    // 100% of customer tip to rider
    const tipAmount = Number(orderData.tip || (orderData as any).tipAmount || 0);
    const totalEarningForOrder = riderDeliveryEarning + tipAmount;

    // Read previous balances
    const prevAvailable = Number(riderData.availableEarnings ?? (riderData.totalEarnings || 0));
    const prevTotal = Number(riderData.totalEarnings || 0);
    const prevDeliv = Number(riderData.deliveryEarnings || 0);
    const prevTips = Number(riderData.tips || 0);
    const prevCodCollected = Number(riderData.codCollected || 0);
    const prevCodDeposited = Number(riderData.codDeposited || 0);
    const codLimit = Number(riderData.codLimit || settings.defaultCodLimit);

    // New Balances
    const newAvailable = prevAvailable + totalEarningForOrder;
    const newTotal = prevTotal + totalEarningForOrder;
    const newDeliv = prevDeliv + riderDeliveryEarning;
    const newTips = prevTips + tipAmount;

    let newCodCollected = prevCodCollected;
    let newCodOutstanding = Math.max(0, prevCodCollected - prevCodDeposited);
    let isCodBlocked = riderData.codBlocked === true;

    if (isCod) {
      newCodCollected += orderTotal;
      newCodOutstanding = Math.max(0, newCodCollected - prevCodDeposited);
      isCodBlocked = newCodOutstanding >= codLimit;
    }

    const netSettlementBalance = newAvailable - newCodOutstanding;

    // 1. Update Order doc (mark earningsProcessed to guarantee idempotency)
    transaction.update(orderRef, {
      earningsProcessed: true,
      deliveryEarnings: riderDeliveryEarning,
      riderTip: tipAmount,
      riderTotalEarning: totalEarningForOrder,
      earningsProcessedAt: serverTimestamp(),
    });

    // 2. Update Delivery Partner Wallet
    transaction.update(riderRef, {
      availableEarnings: newAvailable,
      totalEarnings: newTotal,
      deliveryEarnings: newDeliv,
      ...(tipAmount > 0 ? { tips: newTips } : {}),
      ...(isCod ? {
        codCollected: newCodCollected,
        codOutstanding: newCodOutstanding,
        codBlocked: isCodBlocked,
      } : {}),
      walletBalance: netSettlementBalance,
      completedOrdersCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    // 3. Create Immutable Transaction Record in Subcollection
    const txId = `TX-${orderId.slice(-6)}-${Date.now()}`;
    const txRef = doc(collection(riderRef, 'walletTransactions'));
    const txData: RiderWalletTransaction = {
      transactionId: txId,
      riderId,
      orderId,
      type: isCod ? 'COD_DELIVERY_EARNING' : 'PREPAID_DELIVERY_EARNING',
      amount: totalEarningForOrder,
      direction: 'CREDIT',
      balanceBefore: prevAvailable,
      balanceAfter: newAvailable,
      status: 'COMPLETED',
      createdAt: serverTimestamp(),
      description: isCod
        ? `COD Delivery #${orderId.slice(-6)}: Earning ₹${riderDeliveryEarning}${tipAmount > 0 ? ` + Tip ₹${tipAmount}` : ''} (Collected ₹${orderTotal} cash)`
        : `Prepaid Delivery #${orderId.slice(-6)}: Earning ₹${riderDeliveryEarning}${tipAmount > 0 ? ` + Tip ₹${tipAmount}` : ''}`,
      metadata: {
        isCod,
        orderTotal: isCod ? orderTotal : 0,
        rawDeliveryCharge,
        riderSharePercent,
        tipAmount,
      },
    };
    transaction.set(txRef, txData);

    return {
      success: true,
      totalEarningForOrder,
      newAvailable,
      codOutstanding: newCodOutstanding,
      codBlocked: isCodBlocked,
      codLimit,
    };
  });
}

/**
 * Settle COD Cash with Lifecycle (PENDING -> UNDER_REVIEW -> VERIFIED)
 * Only VERIFIED settlements reduce codOutstanding & auto-unblock
 */
export async function executeCodSettlement(
  riderId: string,
  amount: number,
  paymentMethod: string,
  reference: string,
  autoVerify: boolean = false
) {
  const settings = await getRiderEarningSettings();

  return await runTransaction(db, async (transaction) => {
    const riderRef = doc(db, 'deliveryPersons', riderId);
    const riderSnap = await transaction.get(riderRef);
    if (!riderSnap.exists()) throw new Error('Rider profile not found');

    const riderData = riderSnap.data();
    const codLimit = Number(riderData.codLimit || settings.defaultCodLimit);
    const prevCodCollected = Number(riderData.codCollected || 0);
    const prevCodDeposited = Number(riderData.codDeposited || 0);

    const settlementId = `SETTLE-${Date.now()}`;
    const settlementDocRef = doc(collection(db, 'codSettlements'), settlementId);

    if (autoVerify) {
      const newCodDeposited = prevCodDeposited + amount;
      const newCodOutstanding = Math.max(0, prevCodCollected - newCodDeposited);
      const isCodBlocked = newCodOutstanding >= codLimit;
      const availableEarnings = Number(riderData.availableEarnings || 0);
      const newWalletBalance = availableEarnings - newCodOutstanding;

      // Update Rider
      transaction.update(riderRef, {
        codDeposited: newCodDeposited,
        codOutstanding: newCodOutstanding,
        codBlocked: isCodBlocked,
        walletBalance: newWalletBalance,
        lastSettlementAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Record Settlement Doc
      transaction.set(settlementDocRef, {
        settlementId,
        riderId,
        riderName: riderData.name || 'Rider',
        amount,
        paymentMethod,
        transactionReference: reference,
        status: 'VERIFIED',
        requestedAt: serverTimestamp(),
        verifiedAt: serverTimestamp(),
        verifiedBy: 'AUTOMATIC_GATEWAY',
      });

      // Ledger Transaction
      const txRef = doc(collection(riderRef, 'walletTransactions'));
      transaction.set(txRef, {
        transactionId: `TX-DEP-${Date.now()}`,
        riderId,
        type: 'COD_SETTLEMENT',
        amount,
        direction: 'CREDIT',
        status: 'COMPLETED',
        createdAt: serverTimestamp(),
        description: `Verified COD Deposit ₹${amount} via ${paymentMethod} (Ref: ${reference.slice(0, 10)})`,
        isDebit: false,
      });

      return { success: true, status: 'VERIFIED', codOutstanding: newCodOutstanding, unblocked: !isCodBlocked };
    } else {
      // Pending Admin Review
      transaction.set(settlementDocRef, {
        settlementId,
        riderId,
        riderName: riderData.name || 'Rider',
        amount,
        paymentMethod,
        transactionReference: reference,
        status: 'PENDING',
        requestedAt: serverTimestamp(),
      });

      return { success: true, status: 'PENDING' };
    }
  });
}

/**
 * Request Earnings Withdrawal with atomic balance validation
 */
export async function requestEarningsWithdrawal(
  riderId: string,
  amount: number,
  paymentMethod: 'bank' | 'upi',
  destinationReference: string
) {
  const settings = await getRiderEarningSettings();

  if (amount < settings.minWithdrawal) {
    throw new Error(`Minimum withdrawal amount is ₹${settings.minWithdrawal}`);
  }

  // Pre-calculate/reconcile rider earnings in case availableEarnings is not initialized in doc
  const riderDocSnap = await getDoc(doc(db, 'deliveryPersons', riderId));
  if (!riderDocSnap.exists()) throw new Error('Rider profile not found');
  const initialRiderData = riderDocSnap.data();

  const prevWithdrawn = Number(initialRiderData.withdrawnAmount || 0);
  const docAvailable = Number(initialRiderData.availableEarnings || 0);
  const docTotal = Number(initialRiderData.totalEarnings || 0);
  const docDeliv = Number(initialRiderData.deliveryEarnings || 0);
  const docTips = Number(initialRiderData.tips || 0);
  const docIncentives = Number(initialRiderData.incentives || 0);
  const docComp = Number(initialRiderData.cancellationCompensation || 0);
  const sumDoc = docDeliv + docTips + docIncentives + docComp;

  let reconciledAvailable = Math.max(docAvailable, docTotal - prevWithdrawn, sumDoc - prevWithdrawn);

  // If still less than requested amount, check completed orders in database
  if (reconciledAvailable < amount) {
    try {
      const ordersSnap = await getDocs(
        query(
          collection(db, 'orders'),
          where('deliveryPersonId', '==', riderId),
          where('status', '==', 'delivered')
        )
      );
      let computedOrdersEarn = 0;
      ordersSnap.forEach((d) => {
        const o = d.data();
        const totalItemsQty = o.items?.reduce((s: number, it: any) => s + (it.quantity || 1), 0) || 1;
        const rawDeliveryCharge = Number(o.deliveryCharge || o.deliveryFee || (totalItemsQty > 1 ? 60 : 40));
        const orderEarn = Number(o.deliveryEarnings || o.earnings || Math.round(rawDeliveryCharge * 0.8));
        const tip = Number(o.tip || o.tipAmount || 0);
        computedOrdersEarn += (orderEarn + tip);
      });
      const orderAvailable = Math.max(0, computedOrdersEarn - prevWithdrawn);
      if (orderAvailable > reconciledAvailable) {
        reconciledAvailable = orderAvailable;
      }
    } catch (orderErr) {
      console.warn('[RiderWallet] Order earnings lookup note:', orderErr);
    }
  }

  if (reconciledAvailable < amount) {
    throw new Error(`Insufficient Available Earnings. Available: ₹${reconciledAvailable}, Requested: ₹${amount}`);
  }

  return await runTransaction(db, async (transaction) => {
    const riderRef = doc(db, 'deliveryPersons', riderId);
    const riderSnap = await transaction.get(riderRef);
    if (!riderSnap.exists()) throw new Error('Rider profile not found');

    const riderData = riderSnap.data();
    const currentPrevWithdrawn = Number(riderData.withdrawnAmount || 0);
    const currentDocAvailable = Number(riderData.availableEarnings || 0);
    const currentDocTotal = Number(riderData.totalEarnings || 0);

    const available = Math.max(currentDocAvailable, reconciledAvailable, currentDocTotal - currentPrevWithdrawn);

    if (available < amount) {
      throw new Error(`Insufficient Available Earnings. Available: ₹${available}, Requested: ₹${amount}`);
    }

    const newAvailable = available - amount;
    const newWithdrawn = currentPrevWithdrawn + amount;

    const withdrawalId = `WDR-${Date.now()}`;
    const withdrawalDocRef = doc(collection(db, 'withdrawals'), withdrawalId);

    // Update Rider Doc
    transaction.update(riderRef, {
      availableEarnings: newAvailable,
      withdrawnAmount: newWithdrawn,
      totalEarnings: Math.max(currentDocTotal, available + currentPrevWithdrawn),
      lastWithdrawalAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Create Withdrawal Request Doc
    transaction.set(withdrawalDocRef, {
      withdrawalId,
      riderId,
      riderName: riderData.name || 'Rider',
      amount,
      paymentMethod,
      destinationReference,
      status: 'PENDING',
      requestedAt: serverTimestamp(),
    });

    // Create Ledger Transaction
    const txRef = doc(collection(riderRef, 'walletTransactions'));
    transaction.set(txRef, {
      transactionId: `TX-WDR-${Date.now()}`,
      riderId,
      type: 'WITHDRAWAL',
      amount,
      direction: 'DEBIT',
      balanceBefore: available,
      balanceAfter: newAvailable,
      status: 'PENDING',
      createdAt: serverTimestamp(),
      description: `Withdrawal Request ₹${amount} to ${paymentMethod.toUpperCase()} (${destinationReference})`,
      isDebit: true,
    });

    return { success: true, withdrawalId, newAvailable };
  });
}
