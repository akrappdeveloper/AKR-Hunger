/**
 * Restaurant Location Update API Route
 * 
 * POST /api/restaurants/location
 * 
 * Updates a restaurant's location (coordinates, geohash, address fields).
 * Geohash is computed server-side — clients cannot set it directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { encodeGeohash } from '@/lib/geohash';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      restaurantId,
      latitude,
      longitude,
      street,
      locality,
      city,
      state,
      pincode,
      formattedAddress,
    } = body;

    // Validate required fields
    if (!restaurantId) {
      return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
    }
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json({ error: 'Valid latitude and longitude required' }, { status: 400 });
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: 'Coordinates out of range' }, { status: 400 });
    }
    if (latitude === 0 && longitude === 0) {
      return NextResponse.json({ error: 'Null island coordinates rejected' }, { status: 400 });
    }

    // Verify restaurant exists
    const restaurantRef = doc(db, 'restaurants', restaurantId);
    const restaurantDoc = await getDoc(restaurantRef);
    if (!restaurantDoc.exists()) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    // Compute geohash server-side (SECURITY: client cannot set this)
    const geohash = encodeGeohash(latitude, longitude, 9);

    // Build update payload
    const updatePayload: Record<string, any> = {
      latitude,
      longitude,
      geohash,
      updatedAt: new Date(),
    };

    // Optional address fields
    if (street !== undefined) updatePayload.street = street;
    if (locality !== undefined) updatePayload.locality = locality;
    if (city !== undefined) updatePayload.city = city;
    if (state !== undefined) updatePayload.state = state;
    if (pincode !== undefined) updatePayload.pincode = pincode;
    if (formattedAddress !== undefined) updatePayload.formattedAddress = formattedAddress;

    await updateDoc(restaurantRef, updatePayload);

    return NextResponse.json({
      success: true,
      geohash,
      latitude,
      longitude,
    });
  } catch (error: any) {
    console.error('[API] Restaurant location update error:', error);
    return NextResponse.json(
      { error: 'Failed to update restaurant location' },
      { status: 500 }
    );
  }
}
