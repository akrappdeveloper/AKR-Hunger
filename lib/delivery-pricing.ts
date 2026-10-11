/**
 * Delivery Pricing Service
 * 
 * Server-side delivery fee calculation based on road distance,
 * platform settings, restaurant configuration, and promotions.
 * 
 * SECURITY: Clients CANNOT write delivery fees — all calculations
 * happen server-side and are validated at checkout.
 */

import { PlatformDeliverySettings, DeliveryFeeBreakdown, DeliveryServiceMode } from './types';

const DEFAULT_SETTINGS: PlatformDeliverySettings = {
  standardMaxRadiusKm: 10,
  extendedMaxRadiusKm: 20,
  longDistanceMaxKm: 100,
  defaultPreparationMinutes: 20,
  dispatchBufferMinutes: 5,
  pickupHandoffBufferMinutes: 3,
  baseFee: 20,
  perKmCharge: 5,
  minimumDeliveryFee: 15,
  peakHourMultiplier: 1.0,
  taxRate: 0.05,
  extendedDeliveryGlobalEnabled: false,
  longDistanceGlobalEnabled: false,
};

export interface PricingInput {
  roadDistanceMeters: number;
  serviceMode: DeliveryServiceMode;
  platformSettings?: PlatformDeliverySettings;
  restaurantSubsidyPercent?: number; // e.g. 0.5 = restaurant pays 50% of delivery fee
  promotionalDiscountFlat?: number;
  isPeakHour?: boolean;
}

/**
 * Calculate delivery fee breakdown
 */
export function calculateDeliveryFee(input: PricingInput): DeliveryFeeBreakdown {
  const settings = input.platformSettings || DEFAULT_SETTINGS;
  const distanceKm = input.roadDistanceMeters / 1000;

  // Base fee
  let baseFee = settings.baseFee;

  // Distance-based charge
  let distanceCharge = 0;
  if (distanceKm > 2) {
    // First 2km included in base fee
    distanceCharge = Math.ceil((distanceKm - 2) * settings.perKmCharge);
  }

  // Extended / long-distance surcharges
  if (input.serviceMode === 'extended') {
    distanceCharge *= 1.3; // 30% surcharge on extended delivery
  } else if (input.serviceMode === 'long_distance') {
    distanceCharge *= 1.8; // 80% surcharge on long-distance
    baseFee *= 1.5; // Higher base fee for long distance
  }

  // Peak hour multiplier
  const peakMultiplier = input.isPeakHour ? settings.peakHourMultiplier : 1.0;
  const subtotal = (baseFee + distanceCharge) * peakMultiplier;

  // Minimum fee enforcement
  const minimumFee = settings.minimumDeliveryFee;
  const effectiveSubtotal = Math.max(subtotal, minimumFee);

  // Peak charge (the extra from peak multiplier)
  const peakCharge = input.isPeakHour ? Math.round(subtotal - (baseFee + distanceCharge)) : 0;

  // Restaurant subsidy (restaurant absorbs part of the fee)
  const restaurantSubsidy = input.restaurantSubsidyPercent
    ? Math.round(effectiveSubtotal * input.restaurantSubsidyPercent)
    : 0;

  // Promotional discount
  const promotionalDiscount = input.promotionalDiscountFlat || 0;

  // Net fee before tax
  const netFee = Math.max(0, effectiveSubtotal - restaurantSubsidy - promotionalDiscount);

  // Tax
  const taxes = Math.round(netFee * settings.taxRate);

  // Total
  const totalFee = Math.round(netFee + taxes);

  return {
    baseFee: Math.round(baseFee),
    distanceCharge: Math.round(distanceCharge),
    minimumFee,
    restaurantSubsidy,
    promotionalDiscount,
    peakCharge,
    taxes,
    totalFee,
  };
}

/**
 * Check if current time is peak hour
 * Peak hours: 12:00-14:00 (lunch) and 19:00-22:00 (dinner)
 */
export function isPeakHour(date?: Date): boolean {
  const now = date || new Date();
  const hour = now.getHours();
  return (hour >= 12 && hour < 14) || (hour >= 19 && hour < 22);
}

/**
 * Format delivery fee for display
 */
export function formatDeliveryFee(totalFee: number): string {
  if (totalFee <= 0) return 'FREE';
  return `₹${totalFee}`;
}
