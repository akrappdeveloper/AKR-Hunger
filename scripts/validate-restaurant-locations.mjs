#!/usr/bin/env node

/**
 * Validation Script: Check restaurants for missing location data
 * 
 * Scans all restaurants and reports those missing:
 * - Latitude/Longitude coordinates
 * - Geohash
 * - City/Pincode
 * 
 * Usage:
 *   node scripts/validate-restaurant-locations.mjs
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

try {
  initializeApp();
} catch (e) {
  // App already initialized
}

const db = getFirestore();

async function validate() {
  console.log('🔍 Validating restaurant location data...\n');

  const snapshot = await db.collection('restaurants').get();

  const issues = {
    missingCoordinates: [],
    missingGeohash: [],
    missingCity: [],
    missingPincode: [],
    zeroCoordinates: [],
    outOfIndia: [],
  };

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const name = data.name || doc.id;
    const lat = data.latitude;
    const lon = data.longitude;

    // Check coordinates
    if (lat === undefined || lon === undefined || lat === null || lon === null) {
      issues.missingCoordinates.push(name);
    } else if (lat === 0 && lon === 0) {
      issues.zeroCoordinates.push(name);
    } else if (lat < 6.5 || lat > 37.5 || lon < 68 || lon > 97.5) {
      // Rough India bounding box check
      issues.outOfIndia.push(`${name} (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
    }

    // Check geohash
    if (!data.geohash) {
      issues.missingGeohash.push(name);
    }

    // Check city
    if (!data.city || data.city.trim() === '') {
      issues.missingCity.push(name);
    }

    // Check pincode
    if (!data.pincode || data.pincode.trim() === '') {
      issues.missingPincode.push(name);
    }
  }

  console.log(`📊 Total restaurants scanned: ${snapshot.size}\n`);

  const printIssue = (label, items, emoji) => {
    if (items.length === 0) {
      console.log(`${emoji} ${label}: ✅ None`);
    } else {
      console.log(`${emoji} ${label}: ❌ ${items.length} found`);
      items.forEach(item => console.log(`     - ${item}`));
    }
    console.log('');
  };

  printIssue('Missing Coordinates', issues.missingCoordinates, '📍');
  printIssue('Zero Coordinates (0, 0)', issues.zeroCoordinates, '🎯');
  printIssue('Missing Geohash', issues.missingGeohash, '#️⃣');
  printIssue('Missing City', issues.missingCity, '🏙️');
  printIssue('Missing Pincode', issues.missingPincode, '📮');
  printIssue('Outside India Bounds', issues.outOfIndia, '🗺️');

  const totalIssues = Object.values(issues).reduce((sum, arr) => sum + arr.length, 0);
  if (totalIssues === 0) {
    console.log('🎉 All restaurants have complete location data!');
  } else {
    console.log(`⚠️  Total issues found: ${totalIssues}`);
    console.log('   Run migrate-restaurant-geohash.mjs to fix missing geohashes.');
    console.log('   Manually update restaurants missing coordinates via the admin dashboard.');
  }
}

validate().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
