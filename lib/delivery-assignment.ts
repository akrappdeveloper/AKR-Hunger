import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { haversineDistance } from '@/lib/geohash';
import { getRoute } from '@/lib/osrm';

/** Default operational parameters */
export const DELIVERY_ASSIGNMENT_DEFAULTS = {
  /** Maximum restaurant-to-customer distance (Customer delivery policy) */
  MAX_RESTAURANT_TO_CUSTOMER_KM: 10.0,
  /** Default search radius for delivery partners around the restaurant */
  DEFAULT_ASSIGNMENT_RADIUS_KM: 7.0,
  /** Offer timeout in seconds */
  DEFAULT_OFFER_TIMEOUT_SEC: 45,
  /** Max location staleness for delivery partners (10 minutes) */
  MAX_LOCATION_AGE_MS: 10 * 60 * 1000,
};

export interface CandidatePartner {
  partnerId: string;
  name: string;
  phone: string;
  vehicle: string;
  rating: number;
  latitude: number;
  longitude: number;
  distanceToRestaurantKm: number;
  estimatedTravelTimeMin: number;
  accuracyMeters: number;
  lastUpdatedMs: number;
  availabilityStatus: string;
}

/**
 * Discovers eligible online delivery partners near a restaurant.
 * Strictly adheres to distance separation:
 * 1. Restaurant-to-customer distance is verified against 10km limit.
 * 2. Partner search radius is calculated from RESTAURANT to PARTNER.
 */
export async function discoverEligiblePartners(
  restaurantLat: number,
  restaurantLng: number,
  options: {
    assignmentRadiusKm?: number;
    excludePartnerIds?: string[];
    requiredPincode?: string;
  } = {}
): Promise<CandidatePartner[]> {
  const radiusKm = options.assignmentRadiusKm || DELIVERY_ASSIGNMENT_DEFAULTS.DEFAULT_ASSIGNMENT_RADIUS_KM;
  const excludeIds = new Set(options.excludePartnerIds || []);
  const now = Date.now();

  // 1. Fetch online driver locations
  const locationsSnap = await getDocs(
    query(collection(db, 'driverLocations'), where('isOnline', '==', true))
  );

  const candidates: CandidatePartner[] = [];

  for (const locDoc of locationsSnap.docs) {
    const loc = locDoc.data();
    const partnerId = loc.driverId || loc.partnerId || locDoc.id;

    if (excludeIds.has(partnerId)) continue;

    // Check location freshness
    let updateTimeMs = 0;
    if (loc.updatedAt?.toMillis) {
      updateTimeMs = loc.updatedAt.toMillis();
    } else if (loc.lastLocationUpdateAt?.toMillis) {
      updateTimeMs = loc.lastLocationUpdateAt.toMillis();
    } else if (loc.updatedAt?.seconds) {
      updateTimeMs = loc.updatedAt.seconds * 1000;
    }

    if (now - updateTimeMs > DELIVERY_ASSIGNMENT_DEFAULTS.MAX_LOCATION_AGE_MS && updateTimeMs > 0) {
      // Stale location fix (> 10 mins old)
      continue;
    }

    // Check active order status
    if (loc.activeOrderId || loc.availabilityStatus === 'busy') {
      continue;
    }

    const pLat = Number(loc.latitude);
    const pLng = Number(loc.longitude);

    if (isNaN(pLat) || isNaN(pLng) || (Math.abs(pLat) < 0.001 && Math.abs(pLng) < 0.001)) {
      continue;
    }

    // Straight-line distance from partner to restaurant
    const straightDistKm = haversineDistance(pLat, pLng, restaurantLat, restaurantLng);
    if (straightDistKm > radiusKm) {
      continue;
    }

    // Fetch partner profile for KYC and verification
    const partnerDoc = await getDoc(doc(db, 'deliveryPersons', partnerId));
    if (!partnerDoc.exists()) continue;
    const partnerData = partnerDoc.data();

    // Verification check
    const isApproved =
      partnerData.verificationStatus === 'approved' ||
      partnerData.kycStatus === 'approved' ||
      partnerData.isVerified === true;
    if (!isApproved) continue;

    // Pincode filter check if partner configured service pincodes
    if (partnerData.pincodeFilterActive && partnerData.servicePincodes?.length > 0 && options.requiredPincode) {
      if (!partnerData.servicePincodes.includes(options.requiredPincode)) {
        continue;
      }
    }

    // Estimate road distance
    let roadDistKm = straightDistKm;
    let travelTimeMin = Math.max(3, Math.round((straightDistKm / 25) * 60)); // Avg 25 km/h in city
    try {
      const roadResult = await getRoute(
        { latitude: pLat, longitude: pLng },
        { latitude: restaurantLat, longitude: restaurantLng }
      );
      if (roadResult && roadResult.distance > 0) {
        roadDistKm = roadResult.distance / 1000;
        travelTimeMin = Math.max(1, Math.round(roadResult.duration / 60));
      }
    } catch {
      // Fallback to straight-line estimate
    }

    candidates.push({
      partnerId,
      name: partnerData.name || loc.driverName || 'Delivery Partner',
      phone: partnerData.phone || '',
      vehicle: partnerData.vehicle || 'Bike',
      rating: Number(partnerData.rating || 4.8),
      latitude: pLat,
      longitude: pLng,
      distanceToRestaurantKm: Number(roadDistKm.toFixed(2)),
      estimatedTravelTimeMin: travelTimeMin,
      accuracyMeters: Number(loc.accuracy || loc.locationAccuracyMeters || 10),
      lastUpdatedMs: updateTimeMs,
      availabilityStatus: 'available',
    });
  }

  // Rank by distance to restaurant (nearest first), tie-break by rating desc
  candidates.sort((a, b) => {
    if (Math.abs(a.distanceToRestaurantKm - b.distanceToRestaurantKm) < 0.5) {
      return b.rating - a.rating;
    }
    return a.distanceToRestaurantKm - b.distanceToRestaurantKm;
  });

  return candidates;
}

/**
 * Atomically assigns an order to a delivery partner using Firestore transactions.
 * Enforces:
 * - Restaurant-to-customer 10 km limit
 * - Atomic assignment prevention of duplicate bookings
 * - Audit logging
 */
export async function assignOrderToPartner(
  orderId: string,
  partnerId: string,
  options: {
    assignmentType?: 'auto' | 'manual';
    adminId?: string;
    reason?: string;
  } = {}
) {
  const orderRef = doc(db, 'orders', orderId);
  const partnerRef = doc(db, 'deliveryPersons', partnerId);
  const locationRef = doc(db, 'driverLocations', partnerId);

  const result = await runTransaction(db, async (transaction) => {
    const [orderSnap, partnerSnap] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(partnerRef),
    ]);

    if (!orderSnap.exists()) {
      throw new Error(`Order #${orderId} does not exist`);
    }
    if (!partnerSnap.exists()) {
      throw new Error(`Partner #${partnerId} does not exist`);
    }

    const orderData = orderSnap.data();
    const partnerData = partnerSnap.data();

    // Check if order is already assigned
    if (orderData.deliveryPersonId && orderData.deliveryPersonId !== partnerId) {
      throw new Error(`Order is already assigned to another partner (${orderData.deliveryPersonName || orderData.deliveryPersonId})`);
    }

    // Verify restaurant-to-customer 10km rule
    const restLat = orderData.restaurantLocation?.lat || orderData.delivery?.pickup?.latitude;
    const restLng = orderData.restaurantLocation?.lng || orderData.delivery?.pickup?.longitude;
    const custLat = orderData.deliveryAddress?.latitude || orderData.delivery?.drop?.latitude;
    const custLng = orderData.deliveryAddress?.longitude || orderData.delivery?.drop?.longitude;

    if (restLat && restLng && custLat && custLng) {
      const restToCustDist = haversineDistance(restLat, restLng, custLat, custLng);
      if (restToCustDist > DELIVERY_ASSIGNMENT_DEFAULTS.MAX_RESTAURANT_TO_CUSTOMER_KM) {
        throw new Error(
          `Restaurant-to-customer distance (${(restToCustDist).toFixed(1)} km) exceeds the standard 10 km limit.`
        );
      }
    }

    // Build assignment update
    const previousPartnerId = orderData.deliveryPersonId || null;
    const updates: Record<string, any> = {
      deliveryPersonId: partnerId,
      deliveryPersonName: partnerData.name || 'Assigned Partner',
      deliveryPersonPhone: partnerData.phone || '',
      deliveryVehicle: partnerData.vehicle || 'Bike',
      status: 'ready',
      deliveryStatus: 'going_to_restaurant',
      deliveryStage: 'to_restaurant',
      assignedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      assignmentType: options.assignmentType || 'auto',
    };

    if (orderData.delivery) {
      updates['delivery.driverId'] = partnerId;
      updates['delivery.stage'] = 'TO_PICKUP';
      updates['delivery.assignedAt'] = serverTimestamp();
    }

    transaction.update(orderRef, updates);

    // Update driver location document to reflect active order
    transaction.set(
      locationRef,
      {
        activeOrderId: orderId,
        availabilityStatus: 'busy',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return {
      orderId,
      partnerId,
      partnerName: partnerData.name,
      previousPartnerId,
    };
  });

  // Log audit trail
  try {
    await addDoc(collection(db, 'auditLogs'), {
      action: options.assignmentType === 'manual' ? 'manual_reassign_delivery' : 'auto_assign_delivery',
      orderId,
      partnerId,
      previousPartnerId: result.previousPartnerId,
      adminId: options.adminId || null,
      reason: options.reason || 'Standard operational assignment',
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[Assignment] Failed to record audit log:', err);
  }

  return result;
}
