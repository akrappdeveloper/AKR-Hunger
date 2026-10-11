/**
 * Delivery Pricing API Route
 * 
 * POST /api/delivery/pricing
 * 
 * Server-side delivery fee calculation. Returns a complete
 * fee breakdown for a given road distance and service mode.
 */

import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PlatformDeliverySettings } from '@/lib/types';
import { calculateDeliveryFee, isPeakHour } from '@/lib/delivery-pricing';
import { DeliveryServiceMode } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roadDistanceMeters, serviceMode = 'standard', restaurantSubsidyPercent, promotionalDiscountFlat } = body;

    // Validate
    if (typeof roadDistanceMeters !== 'number' || roadDistanceMeters < 0) {
      return NextResponse.json(
        { error: 'Missing or invalid roadDistanceMeters' },
        { status: 400 }
      );
    }

    // Fetch platform settings
    let platformSettings: PlatformDeliverySettings | undefined;
    try {
      const settingsDoc = await getDoc(doc(db, 'platformSettings', 'deliveryPolicies'));
      if (settingsDoc.exists()) {
        platformSettings = settingsDoc.data() as PlatformDeliverySettings;
      }
    } catch (e) {
      // Use defaults
    }

    const breakdown = calculateDeliveryFee({
      roadDistanceMeters,
      serviceMode: serviceMode as DeliveryServiceMode,
      platformSettings,
      restaurantSubsidyPercent,
      promotionalDiscountFlat,
      isPeakHour: isPeakHour(),
    });

    return NextResponse.json({
      breakdown,
      isPeakHour: isPeakHour(),
    });
  } catch (error: any) {
    console.error('[API] Delivery pricing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
