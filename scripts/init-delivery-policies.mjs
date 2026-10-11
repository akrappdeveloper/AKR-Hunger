#!/usr/bin/env node

/**
 * Initialization Script: Set up default platform delivery policies
 * 
 * Creates the platformSettings/deliveryPolicies document in Firestore
 * with sensible default values if it doesn't already exist.
 * 
 * Usage:
 *   node scripts/init-delivery-policies.mjs
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

try {
  initializeApp();
} catch (e) {
  // App already initialized
}

const db = getFirestore();

const DEFAULT_SETTINGS = {
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
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function init() {
  console.log('🔧 Initializing platform delivery policies...\n');

  const docRef = db.collection('platformSettings').doc('deliveryPolicies');
  const existing = await docRef.get();

  if (existing.exists) {
    console.log('ℹ️  Delivery policies already exist:');
    const data = existing.data();
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'createdAt' && key !== 'updatedAt') {
        console.log(`   ${key}: ${value}`);
      }
    }
    console.log('\n⚠️  No changes made. Delete the document manually if you want to reset.');
    return;
  }

  await docRef.set(DEFAULT_SETTINGS);

  console.log('✅ Default delivery policies created:');
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (key !== 'createdAt' && key !== 'updatedAt') {
      console.log(`   ${key}: ${value}`);
    }
  }
  console.log('\n🎉 Platform delivery policies initialized successfully!');
}

init().catch(err => {
  console.error('Initialization failed:', err);
  process.exit(1);
});
