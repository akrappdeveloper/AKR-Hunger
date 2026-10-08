/**
 * Hunger Delivery Promise Service
 * ================================
 * Calculates realistic delivery time windows.
 * If admin enables guarantee, issues wallet compensation on breach.
 */

import { DeliveryPromise, DeliveryPromiseConfig } from './hunger-types';

const DEFAULT_CONFIG: DeliveryPromiseConfig = {
  enableGuarantee: false,
  gracePeriodMinutes: 10,
  compensationRupees: 20,
  maxDailyCompensationPerUser: 100,
  maxDailyCompensationTotal: 5000,
};

export interface PromiseInput {
  restaurantPrepMinutes: number;
  riderDistanceKm: number;
  trafficMultiplier?: number; // 1.0 = normal, 1.5 = heavy traffic
  riderAvailable: boolean;
  historicalAvgPrepMinutes?: number;
}

const RIDER_SPEED_KM_PER_MIN = 0.5; // ~30 km/h average
const PICKUP_BUFFER = 2;              // 2 minutes pickup overhead

/** Calculate a realistic delivery promise window */
export function calculateDeliveryPromise(
  orderId: string,
  input: PromiseInput,
  config: DeliveryPromiseConfig = DEFAULT_CONFIG
): DeliveryPromise {
  // Use historical data if available
  const prepTime = input.historicalAvgPrepMinutes
    ? Math.round((input.restaurantPrepMinutes + input.historicalAvgPrepMinutes) / 2)
    : input.restaurantPrepMinutes;

  const trafficMultiplier = input.trafficMultiplier ?? 1.1;
  const riderTime = Math.ceil(
    (input.riderDistanceKm / RIDER_SPEED_KM_PER_MIN) * trafficMultiplier
  ) + PICKUP_BUFFER;

  // Add rider wait buffer if not immediately available
  const availabilityBuffer = input.riderAvailable ? 0 : 8;
  const totalMinutes = prepTime + riderTime + availabilityBuffer;

  // Estimated window: ±5 minutes for honesty
  const minEstimate = Math.max(15, totalMinutes - 5);
  const maxEstimate = totalMinutes + 5;
  const displayEstimate = Math.round((minEstimate + maxEstimate) / 2);

  const now = new Date();
  const promisedBy = new Date(now.getTime() + maxEstimate * 60000);

  const promise: DeliveryPromise = {
    orderId,
    estimatedMinutes: displayEstimate,
    restaurantPrepMinutes: prepTime,
    riderDistanceMinutes: riderTime,
    trafficBuffer: Math.round((trafficMultiplier - 1) * riderTime),
    isGuaranteed: config.enableGuarantee,
    status: 'active',
  };

  if (config.enableGuarantee) {
    const guaranteedMinutes = maxEstimate + config.gracePeriodMinutes;
    promise.guaranteedMinutes = guaranteedMinutes;
    promise.promisedBy = new Date(now.getTime() + guaranteedMinutes * 60000);
    promise.compensationAmount = config.compensationRupees;
  } else {
    promise.promisedBy = promisedBy;
  }

  return promise;
}

/** Check if delivery promise was breached and issue compensation */
export async function checkAndCompensatePromise(
  promise: DeliveryPromise,
  actualDeliveryTime: Date,
  issueWalletCredit: (customerId: string, amount: number, reason: string) => Promise<void>,
  customerId: string
): Promise<{ breached: boolean; compensated: boolean; amount: number }> {
  if (!promise.isGuaranteed || !promise.promisedBy) {
    return { breached: false, compensated: false, amount: 0 };
  }

  const breached = actualDeliveryTime > promise.promisedBy;

  if (breached && promise.compensationAmount && !promise.compensationIssued) {
    await issueWalletCredit(
      customerId,
      promise.compensationAmount,
      `Delivery Promise Compensation - Order #${promise.orderId}`
    );
    return { breached: true, compensated: true, amount: promise.compensationAmount };
  }

  return { breached, compensated: false, amount: 0 };
}

/** Format display string */
export function formatDeliveryWindow(promise: DeliveryPromise): string {
  const min = Math.max(15, promise.estimatedMinutes - 5);
  const max = promise.estimatedMinutes + 5;
  return `${min}–${max} min`;
}
