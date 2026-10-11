/**
 * Restaurant Discovery Service
 * 
 * Multi-stage geospatial pipeline to find eligible restaurants
 * near a customer's location. Uses geohash-based Firestore queries
 * for candidate selection, then road-distance verification via OSRM.
 * 
 * Pipeline stages:
 * 1. Validate customer location
 * 2. Calculate geohash bounds
 * 3. Query Firestore for candidates within bounds
 * 4. Deduplicate results
 * 5. Spatial pre-filter (straight-line distance)
 * 6. Route batch (OSRM road distance)
 * 7. Road distance eligibility check
 * 8. Apply delivery fees
 * 9. Rank results
 * 10. Paginate
 */

import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from './firebase';
import { Restaurant, PlatformDeliverySettings, RestaurantDiscoveryResult } from './types';
import { geohashBoundsForRadius, haversineDistance } from './geohash';
import { checkBatchEligibility } from './delivery-eligibility';
import { calculateDeliveryFee, isPeakHour } from './delivery-pricing';

export interface DiscoveryOptions {
  customerLat: number;
  customerLon: number;
  radiusKm?: number;
  platformSettings?: PlatformDeliverySettings;
  maxResults?: number;
  sortBy?: 'distance' | 'rating' | 'deliveryTime' | 'relevance';
  cuisineFilter?: string[];
  vegOnly?: boolean;
  rating4Plus?: boolean;
  fastDelivery?: boolean;
  searchQuery?: string;
}

/**
 * Discover eligible restaurants near a customer location
 * 
 * This is the PRIMARY client-facing discovery function.
 * Call this from the customer homepage to get filtered, ranked restaurants.
 */
export async function discoverNearbyRestaurants(
  options: DiscoveryOptions
): Promise<RestaurantDiscoveryResult[]> {
  const {
    customerLat,
    customerLon,
    radiusKm = 10,
    maxResults = 50,
    sortBy = 'relevance',
    cuisineFilter,
    vegOnly = false,
    rating4Plus = false,
    fastDelivery = false,
    searchQuery,
  } = options;

  // Stage 1: Validate customer location
  if (!customerLat || !customerLon || customerLat === 0 || customerLon === 0) {
    console.warn('[Discovery] Invalid customer coordinates');
    return [];
  }

  // Stage 2: Calculate geohash bounds for search radius
  const bounds = geohashBoundsForRadius(customerLat, customerLon, radiusKm);

  // Stage 3: Query Firestore for candidate restaurants within geohash bounds
  let candidates: Restaurant[] = [];
  
  try {
    // Use geohash range query for efficient spatial lookup
    const restaurantsRef = collection(db, 'restaurants');
    const q = query(
      restaurantsRef,
      where('geohash', '>=', bounds.lower),
      where('geohash', '<=', bounds.upper),
      limit(200) // Cap candidates to prevent excessive reads
    );

    const snapshot = await getDocs(q);
    candidates = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    } as Restaurant));
  } catch (error) {
    console.error('[Discovery] Firestore query failed:', error);
    // Fallback: load all restaurants (for databases without geohash indexed yet)
    try {
      const allRestaurantsRef = collection(db, 'restaurants');
      const fallbackSnapshot = await getDocs(allRestaurantsRef);
      candidates = fallbackSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      } as Restaurant));
    } catch (fbError) {
      console.error('[Discovery] Fallback query also failed:', fbError);
      return [];
    }
  }

  // Stage 4: Deduplicate
  const seen = new Set<string>();
  candidates = candidates.filter(r => {
    if (!r.id || seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  // Stage 5: Spatial pre-filter (straight-line distance)
  // Reject restaurants that are obviously too far (straight-line > 1.5x radius)
  const maxStraightLine = radiusKm * 1500 * 1.5; // Convert to meters with buffer
  candidates = candidates.filter(r => {
    if (!r.latitude || !r.longitude) return false;
    const dist = haversineDistance(customerLat, customerLon, r.latitude, r.longitude);
    return dist <= maxStraightLine;
  });

  // Apply quick filters before expensive routing
  if (vegOnly) {
    candidates = candidates.filter(r => r.isPureVeg || r.isVeg);
  }
  if (rating4Plus) {
    candidates = candidates.filter(r => (r.averageRating || r.rating || 4.5) >= 4.0);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    candidates = candidates.filter(r => {
      const matchName = r.name?.toLowerCase().includes(q);
      const matchCuisine = (r.cuisineType || []).some(c => c.toLowerCase().includes(q));
      const matchDesc = r.description?.toLowerCase().includes(q);
      return matchName || matchCuisine || matchDesc;
    });
  }
  if (cuisineFilter && cuisineFilter.length > 0) {
    candidates = candidates.filter(r => {
      return (r.cuisineType || []).some(c =>
        cuisineFilter.some(f => c.toLowerCase().includes(f.toLowerCase()))
      );
    });
  }

  // Stage 6 & 7: Batch route check and road distance eligibility
  const eligibilityResults = await checkBatchEligibility(
    customerLat,
    customerLon,
    candidates,
    options.platformSettings,
    { maxConcurrent: 5, skipRouting: false }
  );

  // Stage 8: Build results with delivery fees
  const peakHour = isPeakHour();
  const results: RestaurantDiscoveryResult[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const restaurant = candidates[i];
    const eligibility = eligibilityResults[i];

    if (!eligibility) continue;

    // Calculate delivery fee for eligible restaurants
    if (eligibility.eligible) {
      const feeBreakdown = calculateDeliveryFee({
        roadDistanceMeters: eligibility.roadDistanceMeters,
        serviceMode: eligibility.serviceMode,
        platformSettings: options.platformSettings,
        isPeakHour: peakHour,
      });
      eligibility.deliveryFee = feeBreakdown.totalFee;
      eligibility.feeBreakdown = feeBreakdown;
    }

    // Apply fast delivery filter after routing
    if (fastDelivery && eligibility.estimatedDeliveryMinutes > 30) continue;

    results.push({ restaurant, eligibility });
  }

  // Stage 9: Rank results
  results.sort((a, b) => {
    // Always show eligible first
    if (a.eligibility.eligible !== b.eligibility.eligible) {
      return a.eligibility.eligible ? -1 : 1;
    }

    switch (sortBy) {
      case 'distance':
        return a.eligibility.roadDistanceMeters - b.eligibility.roadDistanceMeters;
      case 'rating':
        return (b.restaurant.averageRating || b.restaurant.rating || 4.5) -
               (a.restaurant.averageRating || a.restaurant.rating || 4.5);
      case 'deliveryTime':
        return a.eligibility.estimatedDeliveryMinutes - b.eligibility.estimatedDeliveryMinutes;
      case 'relevance':
      default:
        // Composite score: rating * 0.4 + proximity * 0.3 + speed * 0.3
        const scoreA = calculateRelevanceScore(a);
        const scoreB = calculateRelevanceScore(b);
        return scoreB - scoreA;
    }
  });

  // Stage 10: Paginate
  return results.slice(0, maxResults);
}

/**
 * Calculate a composite relevance score for ranking
 */
function calculateRelevanceScore(result: RestaurantDiscoveryResult): number {
  const { restaurant, eligibility } = result;

  // Normalize rating (0-5 → 0-1)
  const rating = (restaurant.averageRating || restaurant.rating || 4.5) / 5;

  // Normalize distance (closer = higher score, max 15km → 0-1)
  const distKm = eligibility.roadDistanceMeters / 1000;
  const proximity = Math.max(0, 1 - distKm / 15);

  // Normalize delivery speed (faster = higher score, max 60min → 0-1)
  const speed = Math.max(0, 1 - eligibility.estimatedDeliveryMinutes / 60);

  // Bonus for open restaurants
  const openBonus = restaurant.isOpen !== false ? 0.1 : 0;

  return rating * 0.4 + proximity * 0.3 + speed * 0.2 + openBonus + 0.1;
}

/**
 * Quick check: is a specific restaurant eligible for delivery to a location?
 * Used on restaurant detail pages and at checkout.
 */
export async function checkSingleRestaurantEligibility(
  customerLat: number,
  customerLon: number,
  restaurant: Restaurant,
  platformSettings?: PlatformDeliverySettings
) {
  const results = await checkBatchEligibility(
    customerLat,
    customerLon,
    [restaurant],
    platformSettings,
    { skipRouting: false }
  );
  
  if (results.length > 0 && results[0].eligible) {
    const feeBreakdown = calculateDeliveryFee({
      roadDistanceMeters: results[0].roadDistanceMeters,
      serviceMode: results[0].serviceMode,
      platformSettings,
      isPeakHour: isPeakHour(),
    });
    results[0].deliveryFee = feeBreakdown.totalFee;
    results[0].feeBreakdown = feeBreakdown;
  }

  return results[0] || null;
}
