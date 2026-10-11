'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface DriverLocationData {
  driverId: string;
  partnerId?: string;
  driverName?: string;
  latitude: number;
  longitude: number;
  geohash?: string;
  accuracy: number;
  locationAccuracyMeters?: number;
  speed: number; // km/h
  heading: number;
  isOnline: boolean;
  availabilityStatus?: string;
  activeOrderId?: string;
  lastLocationUpdateAt?: any;
  updatedAt: any;
}

/**
 * Hook to subscribe to a single driver's live location
 * Used by Customer and Restaurant panels to track a specific delivery driver
 */
export function useTrackDriver(driverId: string | null | undefined): {
  location: DriverLocationData | null;
  loading: boolean;
  error: string | null;
} {
  const [location, setLocation] = useState<DriverLocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!driverId) {
      setLocation(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      doc(db, 'driverLocations', driverId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as DriverLocationData;
          setLocation(data);
        } else {
          setLocation(null);
        }
        setLoading(false);
      },
      (err) => {
        if (err.code !== 'permission-denied' && err.code !== 'not-found') {
          console.warn('[TrackDriver] Info:', err.message);
        }
        setLocation(null);
        setError(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [driverId]);

  return { location, loading, error };
}

/**
 * Hook to subscribe to ALL online drivers' locations
 * Used by Admin panel for fleet management
 */
export function useTrackAllDrivers(): {
  drivers: DriverLocationData[];
  loading: boolean;
  error: string | null;
} {
  const [drivers, setDrivers] = useState<DriverLocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'driverLocations'),
      where('isOnline', '==', true)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const locations = snapshot.docs.map((doc) => ({
          ...doc.data(),
          driverId: doc.id,
        })) as DriverLocationData[];
        setDrivers(locations);
        setLoading(false);
      },
      (err) => {
        if (err.code !== 'permission-denied') {
          console.warn('[TrackAllDrivers] Info:', err.message);
        }
        setError(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { drivers, loading, error };
}
