/**
 * Delivery Eligibility Service
 * 
 * Centralized server-side service that determines whether a restaurant
 * can deliver to a customer's location. Checks road distance, restaurant
 * approval status, operating status, delivery capacity, and service area.
 */

import { Restaurant, PlatformDeliverySettings, DeliveryEligibilityResult, DeliveryReasonCode, DeliveryServiceMode } from './types';
import { getRoute, getStraightLineDistance, RouteCoordinate } from './osrm';

// Default platform delivery settings
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

export interface EligibilityInput {
  customerLat: number;
  customerLon: number;
  restaurant: Restaurant;
  platformSettings?: PlatformDeliverySettings;
  /** Skip routing (use straight-line) for quick pre-filtering */
  skipRouting?: boolean;
}

/**
 * Check delivery eligibility for a single restaurant → customer pair
 */
export async function checkDeliveryEligibility(
  input: EligibilityInput
): Promise<DeliveryEligibilityResult> {
  const { customerLat, customerLon, restaurant, skipRouting = false } = input;
  const settings = input.platformSettings || DEFAULT_SETTINGS;
  const now = new Date().toISOString();

  // Stage 1: Validate customer location
  if (!isValidCoordinate(customerLat, customerLon)) {
    return buildResult(restaurant.id || '', 'INVALID_CUSTOMER_LOCATION', now, settings);
  }

  // Stage 2: Validate restaurant location
  if (!restaurant.latitude || !restaurant.longitude || !isValidCoordinate(restaurant.latitude, restaurant.longitude)) {
    return buildResult(restaurant.id || '', 'INVALID_RESTAURANT_LOCATION', now, settings);
  }

  // Stage 3: Check restaurant approval status
  if (restaurant.approvalStatus && restaurant.approvalStatus !== 'approved') {
    return buildResult(restaurant.id || '', 'RESTAURANT_NOT_APPROVED', now, settings);
  }

  // Stage 4: Check if restaurant is open
  if (restaurant.isOpen === false || restaurant.isCurrentlyOpen === false) {
    return buildResult(restaurant.id || '', 'RESTAURANT_CLOSED', now, settings);
  }

  // Stage 5: Check if accepting orders
  if (restaurant.acceptsOrders === false) {
    return buildResult(restaurant.id || '', 'NOT_ACCEPTING_ORDERS', now, settings);
  }

  // Stage 6: Calculate effective maximum delivery radius
  const effectiveMaxKm = calculateEffectiveMaxRadius(restaurant, settings);

  // Stage 7: Calculate straight-line distance as pre-filter
  const straightLineMeters = getStraightLineDistance(
    { latitude: restaurant.latitude, longitude: restaurant.longitude },
    { latitude: customerLat, longitude: customerLon }
  );
  const straightLineKm = straightLineMeters / 1000;

  // Quick reject: if straight-line > 1.5x max radius, definitely out of range
  // (road distance is always >= straight-line distance)
  if (straightLineKm > effectiveMaxKm * 1.5) {
    return {
      restaurantId: restaurant.id || '',
      eligible: false,
      reasonCode: 'OUTSIDE_DELIVERY_RADIUS',
      serviceMode: 'standard',
      roadDistanceMeters: 0,
      straightLineDistanceMeters: Math.round(straightLineMeters),
      routeDurationSeconds: 0,
      estimatedDeliveryMinutes: 0,
      effectiveMaxRoadDistanceKm: effectiveMaxKm,
      checkedAt: now,
    };
  }

  // Stage 8: Get actual road distance via OSRM
  let roadDistanceMeters = 0;
  let routeDurationSeconds = 0;
  let routeGeometry: [number, number][] | undefined;

  if (skipRouting) {
    // Use straight-line with 1.4x multiplier as estimate
    roadDistanceMeters = Math.round(straightLineMeters * 1.4);
    routeDurationSeconds = Math.round((roadDistanceMeters / 1000 / 25) * 3600); // ~25 km/h avg
  } else {
    const from: RouteCoordinate = { latitude: restaurant.latitude, longitude: restaurant.longitude };
    const to: RouteCoordinate = { latitude: customerLat, longitude: customerLon };
    
    try {
      const route = await getRoute(from, to);
      if (route) {
        roadDistanceMeters = Math.round(route.distance);
        routeDurationSeconds = Math.round(route.duration);
        routeGeometry = route.geometry;
      } else {
        return buildResult(restaurant.id || '', 'NO_VALID_ROUTE', now, settings, straightLineMeters);
      }
    } catch (error) {
      console.error('[DeliveryEligibility] Routing failed:', error);
      return buildResult(restaurant.id || '', 'ROUTING_TEMPORARILY_UNAVAILABLE', now, settings, straightLineMeters);
    }
  }

  const roadDistanceKm = roadDistanceMeters / 1000;

  // Stage 9: Determine service mode and check against limits
  let serviceMode: DeliveryServiceMode = 'standard';
  let eligible = true;
  let reasonCode: DeliveryReasonCode = 'DELIVERABLE';

  if (roadDistanceKm <= settings.standardMaxRadiusKm) {
    serviceMode = 'standard';
  } else if (
    roadDistanceKm <= (restaurant.serviceArea?.extendedMaxRadiusKm || settings.extendedMaxRadiusKm) &&
    restaurant.serviceArea?.extendedDeliveryEnabled &&
    settings.extendedDeliveryGlobalEnabled
  ) {
    serviceMode = 'extended';
  } else if (
    roadDistanceKm <= settings.longDistanceMaxKm &&
    restaurant.serviceArea?.longDistanceEnabled &&
    settings.longDistanceGlobalEnabled
  ) {
    serviceMode = 'long_distance';
  } else {
    eligible = false;
    reasonCode = 'OUTSIDE_DELIVERY_RADIUS';
  }

  // Stage 10: Calculate estimated delivery time
  const prepMinutes = restaurant.averagePreparationMinutes || restaurant.preparationTime || settings.defaultPreparationMinutes;
  const travelMinutes = Math.ceil(routeDurationSeconds / 60);
  const estimatedDeliveryMinutes = prepMinutes + travelMinutes + settings.dispatchBufferMinutes + settings.pickupHandoffBufferMinutes;

  return {
    restaurantId: restaurant.id || '',
    eligible,
    reasonCode,
    serviceMode,
    roadDistanceMeters,
    straightLineDistanceMeters: Math.round(straightLineMeters),
    routeDurationSeconds,
    estimatedDeliveryMinutes,
    effectiveMaxRoadDistanceKm: effectiveMaxKm,
    checkedAt: now,
    routeGeometry,
  };
}

/**
 * Batch check eligibility for multiple restaurants
 */
export async function checkBatchEligibility(
  customerLat: number,
  customerLon: number,
  restaurants: Restaurant[],
  platformSettings?: PlatformDeliverySettings,
  options?: { maxConcurrent?: number; skipRouting?: boolean }
): Promise<DeliveryEligibilityResult[]> {
  const maxConcurrent = options?.maxConcurrent || 5;
  const results: DeliveryEligibilityResult[] = [];

  // Process in batches to avoid overwhelming OSRM
  for (let i = 0; i < restaurants.length; i += maxConcurrent) {
    const batch = restaurants.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map(restaurant =>
        checkDeliveryEligibility({
          customerLat,
          customerLon,
          restaurant,
          platformSettings,
          skipRouting: options?.skipRouting,
        })
      )
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Calculate the effective maximum delivery radius for a restaurant
 */
function calculateEffectiveMaxRadius(restaurant: Restaurant, settings: PlatformDeliverySettings): number {
  // Start with standard platform limit
  let maxKm = settings.standardMaxRadiusKm;

  // Check if restaurant has a custom service area
  if (restaurant.serviceArea) {
    const restaurantMax = restaurant.serviceArea.maxRadiusKm;
    // Restaurant cannot exceed its admin-approved maximum
    maxKm = Math.min(restaurantMax, settings.standardMaxRadiusKm);

    // Extended delivery (if enabled for both platform and restaurant)
    if (restaurant.serviceArea.extendedDeliveryEnabled && settings.extendedDeliveryGlobalEnabled) {
      maxKm = Math.min(
        restaurant.serviceArea.extendedMaxRadiusKm || settings.extendedMaxRadiusKm,
        settings.extendedMaxRadiusKm
      );
    }

    // Long-distance delivery (if enabled)
    if (restaurant.serviceArea.longDistanceEnabled && settings.longDistanceGlobalEnabled) {
      maxKm = Math.min(
        restaurant.serviceArea.longDistanceMaxKm || settings.longDistanceMaxKm,
        settings.longDistanceMaxKm
      );
    }
  }

  return maxKm;
}

/**
 * Validate coordinate values
 */
function isValidCoordinate(lat: number, lon: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180 &&
    lat !== 0 && lon !== 0 // Reject null island
  );
}

/**
 * Build a rejection result
 */
function buildResult(
  restaurantId: string,
  reasonCode: DeliveryReasonCode,
  checkedAt: string,
  settings: PlatformDeliverySettings,
  straightLineMeters?: number
): DeliveryEligibilityResult {
  return {
    restaurantId,
    eligible: false,
    reasonCode,
    serviceMode: 'standard',
    roadDistanceMeters: 0,
    straightLineDistanceMeters: straightLineMeters ? Math.round(straightLineMeters) : undefined,
    routeDurationSeconds: 0,
    estimatedDeliveryMinutes: 0,
    effectiveMaxRoadDistanceKm: settings.standardMaxRadiusKm,
    checkedAt,
  };
}
