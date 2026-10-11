/**
 * Delivery Eligibility API Route
 * 
 * POST /api/delivery/eligibility
 * 
 * Server-side validation of delivery eligibility for a single
 * restaurant → customer pair. Returns road distance, ETA, fee,
 * and eligibility status.
 * 
 * SECURITY: All eligibility decisions are made server-side.
 * Clients cannot influence distance, fee, or eligibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Restaurant, PlatformDeliverySettings } from '@/lib/types';
import { checkDeliveryEligibility } from '@/lib/delivery-eligibility';
import { calculateDeliveryFee, isPeakHour } from '@/lib/delivery-pricing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { restaurantId, customerLat, customerLon } = body;

    // Validate required fields
    if (!restaurantId || typeof customerLat !== 'number' || typeof customerLon !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: restaurantId, customerLat, customerLon' },
        { status: 400 }
      );
    }

    // Validate coordinate ranges
    if (customerLat < -90 || customerLat > 90 || customerLon < -180 || customerLon > 180) {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    // Fetch restaurant from Firestore
    const restaurantDoc = await getDoc(doc(db, 'restaurants', restaurantId));
    if (!restaurantDoc.exists()) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      );
    }

    const restaurant = { id: restaurantDoc.id, ...restaurantDoc.data() } as Restaurant;

    // Fetch platform delivery settings
    let platformSettings: PlatformDeliverySettings | undefined;
    try {
      const settingsDoc = await getDoc(doc(db, 'platformSettings', 'deliveryPolicies'));
      if (settingsDoc.exists()) {
        platformSettings = settingsDoc.data() as PlatformDeliverySettings;
      }
    } catch (e) {
      // Use defaults if settings not found
    }

    // Check eligibility
    const eligibility = await checkDeliveryEligibility({
      customerLat,
      customerLon,
      restaurant,
      platformSettings,
    });

    // Calculate delivery fee if eligible
    if (eligibility.eligible) {
      const feeBreakdown = calculateDeliveryFee({
        roadDistanceMeters: eligibility.roadDistanceMeters,
        serviceMode: eligibility.serviceMode,
        platformSettings,
        isPeakHour: isPeakHour(),
      });
      eligibility.deliveryFee = feeBreakdown.totalFee;
      eligibility.feeBreakdown = feeBreakdown;
    }

    return NextResponse.json({ eligibility });
  } catch (error: any) {
    console.error('[API] Delivery eligibility error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
