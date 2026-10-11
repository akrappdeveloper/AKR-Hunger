/**
 * Restaurant Discovery API Route
 * 
 * POST /api/delivery/discover
 * 
 * Server-side geospatial restaurant discovery. Returns eligible
 * restaurants near a customer's location with delivery fees and ETAs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PlatformDeliverySettings } from '@/lib/types';
import { discoverNearbyRestaurants } from '@/lib/restaurant-discovery';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
    } = body;

    // Validate required fields
    if (typeof customerLat !== 'number' || typeof customerLon !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: customerLat, customerLon' },
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

    // Cap radius to prevent abuse
    const safeRadius = Math.min(Math.max(radiusKm, 1), 100);
    const safeMaxResults = Math.min(Math.max(maxResults, 1), 100);

    // Fetch platform delivery settings
    let platformSettings: PlatformDeliverySettings | undefined;
    try {
      const settingsDoc = await getDoc(doc(db, 'platformSettings', 'deliveryPolicies'));
      if (settingsDoc.exists()) {
        platformSettings = settingsDoc.data() as PlatformDeliverySettings;
      }
    } catch (e) {
      // Use defaults
    }

    // Run discovery pipeline
    const results = await discoverNearbyRestaurants({
      customerLat,
      customerLon,
      radiusKm: safeRadius,
      platformSettings,
      maxResults: safeMaxResults,
      sortBy,
      cuisineFilter,
      vegOnly,
      rating4Plus,
      fastDelivery,
      searchQuery,
    });

    return NextResponse.json({
      results,
      meta: {
        total: results.length,
        eligible: results.filter(r => r.eligibility.eligible).length,
        radiusKm: safeRadius,
        customerLat,
        customerLon,
      },
    });
  } catch (error: any) {
    console.error('[API] Restaurant discovery error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
