/**
 * Delivery Policies API Route (Admin Only)
 * 
 * GET /api/delivery/policies — Fetch current platform delivery settings
 * PUT /api/delivery/policies — Update platform delivery settings
 * 
 * SECURITY: Updates require admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PlatformDeliverySettings } from '@/lib/types';

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

export async function GET() {
  try {
    const settingsDoc = await getDoc(doc(db, 'platformSettings', 'deliveryPolicies'));
    
    if (settingsDoc.exists()) {
      return NextResponse.json({ settings: settingsDoc.data() });
    }
    
    return NextResponse.json({ settings: DEFAULT_SETTINGS });
  } catch (error: any) {
    console.error('[API] Fetch delivery policies error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch delivery policies' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'Invalid settings payload' },
        { status: 400 }
      );
    }

    // Validate numeric ranges
    const validatedSettings: Partial<PlatformDeliverySettings> = {};
    
    if (typeof settings.standardMaxRadiusKm === 'number' && settings.standardMaxRadiusKm > 0) {
      validatedSettings.standardMaxRadiusKm = Math.min(settings.standardMaxRadiusKm, 50);
    }
    if (typeof settings.extendedMaxRadiusKm === 'number' && settings.extendedMaxRadiusKm > 0) {
      validatedSettings.extendedMaxRadiusKm = Math.min(settings.extendedMaxRadiusKm, 100);
    }
    if (typeof settings.longDistanceMaxKm === 'number' && settings.longDistanceMaxKm > 0) {
      validatedSettings.longDistanceMaxKm = Math.min(settings.longDistanceMaxKm, 500);
    }
    if (typeof settings.defaultPreparationMinutes === 'number' && settings.defaultPreparationMinutes > 0) {
      validatedSettings.defaultPreparationMinutes = settings.defaultPreparationMinutes;
    }
    if (typeof settings.dispatchBufferMinutes === 'number' && settings.dispatchBufferMinutes >= 0) {
      validatedSettings.dispatchBufferMinutes = settings.dispatchBufferMinutes;
    }
    if (typeof settings.pickupHandoffBufferMinutes === 'number' && settings.pickupHandoffBufferMinutes >= 0) {
      validatedSettings.pickupHandoffBufferMinutes = settings.pickupHandoffBufferMinutes;
    }
    if (typeof settings.baseFee === 'number' && settings.baseFee >= 0) {
      validatedSettings.baseFee = settings.baseFee;
    }
    if (typeof settings.perKmCharge === 'number' && settings.perKmCharge >= 0) {
      validatedSettings.perKmCharge = settings.perKmCharge;
    }
    if (typeof settings.minimumDeliveryFee === 'number' && settings.minimumDeliveryFee >= 0) {
      validatedSettings.minimumDeliveryFee = settings.minimumDeliveryFee;
    }
    if (typeof settings.peakHourMultiplier === 'number' && settings.peakHourMultiplier >= 1.0) {
      validatedSettings.peakHourMultiplier = Math.min(settings.peakHourMultiplier, 3.0);
    }
    if (typeof settings.taxRate === 'number' && settings.taxRate >= 0) {
      validatedSettings.taxRate = Math.min(settings.taxRate, 0.28); // Max 28% GST
    }
    if (typeof settings.extendedDeliveryGlobalEnabled === 'boolean') {
      validatedSettings.extendedDeliveryGlobalEnabled = settings.extendedDeliveryGlobalEnabled;
    }
    if (typeof settings.longDistanceGlobalEnabled === 'boolean') {
      validatedSettings.longDistanceGlobalEnabled = settings.longDistanceGlobalEnabled;
    }

    // Merge with existing settings
    const existingDoc = await getDoc(doc(db, 'platformSettings', 'deliveryPolicies'));
    const existing = existingDoc.exists() ? existingDoc.data() : DEFAULT_SETTINGS;

    const merged = {
      ...existing,
      ...validatedSettings,
      updatedAt: new Date(),
    };

    await setDoc(doc(db, 'platformSettings', 'deliveryPolicies'), merged);

    return NextResponse.json({ settings: merged, success: true });
  } catch (error: any) {
    console.error('[API] Update delivery policies error:', error);
    return NextResponse.json(
      { error: 'Failed to update delivery policies' },
      { status: 500 }
    );
  }
}
