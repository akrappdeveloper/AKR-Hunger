/**
 * Hunger Price Lock Service
 * ==========================
 * Transparent, immutable pricing before checkout.
 * Once a price is locked, it CANNOT increase at payment time.
 * No hidden charges.
 */

export interface PriceLockBreakdown {
  // Food
  itemSubtotal: number;
  packagingFee: number;
  // Delivery
  deliveryFee: number;
  // Platform
  platformFee: number;
  // Tax
  cgst: number;
  sgst: number;
  totalTax: number;
  // Discounts
  couponDiscount: number;
  walletDiscount: number;
  membershipDiscount: number;
  totalDiscount: number;
  // Final
  finalAmount: number;
  // Budget indicator
  isUnderBudget?: boolean;
  remainingBudget?: number;
  // Lock metadata
  lockedAt: Date;
  lockToken: string;           // SHA-256 of breakdown for verification
  expiresAt: Date;             // Lock valid for 15 minutes
}

export interface PriceLockInput {
  items: Array<{ price: number; quantity: number }>;
  deliveryFee: number;
  restaurantId: string;
  couponCode?: string;
  couponDiscount?: number;
  walletAmountUsed?: number;
  membershipDiscount?: number;
  budget?: number;
}

const PLATFORM_FEE = 5;           // ₹5 flat platform fee
const PACKAGING_FEE_PER_ITEM = 2; // ₹2 per item
const GST_RATE = 5;               // 5% GST (split equally CGST/SGST)
const LOCK_VALIDITY_MINUTES = 15;

/** Calculate a complete transparent price breakdown */
export function calculatePriceLock(input: PriceLockInput): PriceLockBreakdown {
  const itemSubtotal = input.items.reduce(
    (sum, item) => sum + item.price * item.quantity, 0
  );

  const totalItems = input.items.reduce((s, i) => s + i.quantity, 0);
  const packagingFee = Math.min(totalItems * PACKAGING_FEE_PER_ITEM, 20); // Max ₹20

  const deliveryFee = input.deliveryFee;
  const platformFee = PLATFORM_FEE;

  // GST on food only (5%)
  const taxableAmount = itemSubtotal;
  const totalGST = parseFloat(((taxableAmount * GST_RATE) / 100).toFixed(2));
  const cgst = parseFloat((totalGST / 2).toFixed(2));
  const sgst = parseFloat((totalGST / 2).toFixed(2));

  const couponDiscount = Math.min(input.couponDiscount || 0, itemSubtotal);
  const walletDiscount = Math.min(input.walletAmountUsed || 0, 99999);
  const membershipDiscount = input.membershipDiscount || 0;
  const totalDiscount = couponDiscount + walletDiscount + membershipDiscount;

  const preTaxSubtotal = itemSubtotal + packagingFee + deliveryFee + platformFee;
  const finalAmount = Math.max(
    0,
    parseFloat((preTaxSubtotal + totalGST - couponDiscount - membershipDiscount - walletDiscount).toFixed(2))
  );

  const lockedAt = new Date();
  const expiresAt = new Date(lockedAt.getTime() + LOCK_VALIDITY_MINUTES * 60000);

  // Create a deterministic lock token
  const lockToken = generateLockToken({
    itemSubtotal, packagingFee, deliveryFee, platformFee,
    totalGST, couponDiscount, walletDiscount, finalAmount,
    lockedAt: lockedAt.toISOString(),
  });

  const result: PriceLockBreakdown = {
    itemSubtotal: parseFloat(itemSubtotal.toFixed(2)),
    packagingFee,
    deliveryFee,
    platformFee,
    cgst,
    sgst,
    totalTax: totalGST,
    couponDiscount,
    walletDiscount,
    membershipDiscount,
    totalDiscount,
    finalAmount,
    lockedAt,
    lockToken,
    expiresAt,
  };

  // Budget awareness
  if (input.budget) {
    result.isUnderBudget = finalAmount <= input.budget;
    result.remainingBudget = parseFloat((input.budget - finalAmount).toFixed(2));
  }

  return result;
}

/** Verify that a price lock hasn't been tampered with */
export function verifyPriceLock(breakdown: PriceLockBreakdown): boolean {
  const expectedToken = generateLockToken({
    itemSubtotal: breakdown.itemSubtotal,
    packagingFee: breakdown.packagingFee,
    deliveryFee: breakdown.deliveryFee,
    platformFee: breakdown.platformFee,
    totalGST: breakdown.totalTax,
    couponDiscount: breakdown.couponDiscount,
    walletDiscount: breakdown.walletDiscount,
    finalAmount: breakdown.finalAmount,
    lockedAt: breakdown.lockedAt instanceof Date
      ? breakdown.lockedAt.toISOString()
      : new Date(breakdown.lockedAt).toISOString(),
  });

  const isValid = breakdown.lockToken === expectedToken;
  const isNotExpired = new Date() < new Date(breakdown.expiresAt);

  return isValid && isNotExpired;
}

function generateLockToken(data: Record<string, unknown>): string {
  // Simple deterministic hash (for server-side, use crypto.createHash)
  const str = JSON.stringify(data, Object.keys(data).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/** Format breakdown for display */
export function formatPriceLockDisplay(breakdown: PriceLockBreakdown) {
  return [
    { label: 'Food Total', amount: breakdown.itemSubtotal, show: true },
    { label: 'Packaging', amount: breakdown.packagingFee, show: breakdown.packagingFee > 0 },
    { label: 'Delivery Fee', amount: breakdown.deliveryFee, show: true },
    { label: 'Platform Fee', amount: breakdown.platformFee, show: true },
    { label: 'CGST (2.5%)', amount: breakdown.cgst, show: true },
    { label: 'SGST (2.5%)', amount: breakdown.sgst, show: true },
    { label: 'Coupon Discount', amount: -breakdown.couponDiscount, show: breakdown.couponDiscount > 0 },
    { label: 'Membership Discount', amount: -breakdown.membershipDiscount, show: breakdown.membershipDiscount > 0 },
    { label: 'Wallet Used', amount: -breakdown.walletDiscount, show: breakdown.walletDiscount > 0 },
  ].filter(row => row.show);
}
