#!/usr/bin/env node

/**
 * Migration Script: Backfill geohash for existing restaurants
 * 
 * Reads all restaurants from Firestore, computes geohash from
 * their latitude/longitude, and writes it back.
 * 
 * Usage:
 *   node scripts/migrate-restaurant-geohash.mjs
 * 
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS environment variable set
 *   - Or run from a Firebase-authenticated environment
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
// Uses GOOGLE_APPLICATION_CREDENTIALS or default credentials
try {
  initializeApp();
} catch (e) {
  // App already initialized
}

const db = getFirestore();

// Geohash encoding (standalone version for migration script)
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encodeGeohash(latitude, longitude, precision = 9) {
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  let latRange = [-90.0, 90.0];
  let lonRange = [-180.0, 180.0];
  let hash = '';
  let isEven = true;
  let bit = 0;
  let ch = 0;

  while (hash.length < precision) {
    if (isEven) {
      const mid = (lonRange[0] + lonRange[1]) / 2;
      if (longitude >= mid) {
        ch |= (1 << (4 - bit));
        lonRange[0] = mid;
      } else {
        lonRange[1] = mid;
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (latitude >= mid) {
        ch |= (1 << (4 - bit));
        latRange[0] = mid;
      } else {
        latRange[1] = mid;
      }
    }

    isEven = !isEven;
    if (bit < 4) {
      bit++;
    } else {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

async function migrate() {
  console.log('🔄 Starting geohash migration for restaurants...\n');

  const snapshot = await db.collection('restaurants').get();
  let updated = 0;
  let skipped = 0;
  let noCoords = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const { latitude, longitude, geohash, name } = data;

    // Skip if already has geohash
    if (geohash && geohash.length >= 5) {
      skipped++;
      continue;
    }

    // Skip if no coordinates
    if (!latitude || !longitude || latitude === 0 || longitude === 0) {
      noCoords++;
      console.log(`  ⚠️  ${name || doc.id}: Missing coordinates, skipping`);
      continue;
    }

    // Compute geohash
    const newGeohash = encodeGeohash(latitude, longitude, 9);
    if (!newGeohash) {
      errors++;
      console.log(`  ❌ ${name || doc.id}: Invalid coordinates (${latitude}, ${longitude})`);
      continue;
    }

    try {
      await db.collection('restaurants').doc(doc.id).update({
        geohash: newGeohash,
        updatedAt: new Date(),
      });
      updated++;
      console.log(`  ✅ ${name || doc.id}: ${newGeohash} (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
    } catch (err) {
      errors++;
      console.log(`  ❌ ${name || doc.id}: Write failed - ${err.message}`);
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`   Total restaurants: ${snapshot.size}`);
  console.log(`   Updated with geohash: ${updated}`);
  console.log(`   Already had geohash: ${skipped}`);
  console.log(`   Missing coordinates: ${noCoords}`);
  console.log(`   Errors: ${errors}`);
  console.log('\n✅ Migration complete!');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
