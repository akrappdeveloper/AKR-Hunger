'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GPSTracker, GPSPosition, speedToKmh } from '@/lib/gps-tracking';
import { encodeGeohash } from '@/lib/geohash';

interface UseDriverLocationOptions {
  /** Driver's user ID */
  driverId: string | null;
  /** Driver's display name */
  driverName?: string;
  /** Whether the driver is currently online */
  isOnline: boolean;
  /** Whether the driver has an active delivery */
  hasActiveDelivery: boolean;
  /** Current active order ID */
  activeOrderId?: string;
}

interface UseDriverLocationReturn {
  /** Current GPS position */
  position: GPSPosition | null;
  /** Whether GPS is actively tracking */
  isTracking: boolean;
  /** GPS permission status */
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unsupported' | 'checking';
  /** GPS error message */
  error: string | null;
  /** Accuracy in meters */
  accuracy: number | null;
  /** Speed in km/h */
  speedKmh: number;
  /** Request GPS permission and start tracking */
  requestPermission: () => void;
}

/**
 * Hook for delivery drivers — manages GPS tracking and writes location to Firestore
 * 
 * Firestore path: driverLocations/{driverId}
 */
export function useDriverLocation({
  driverId,
  driverName,
  isOnline,
  hasActiveDelivery,
  activeOrderId,
}: UseDriverLocationOptions): UseDriverLocationReturn {
  const [position, setPosition] = useState<GPSPosition | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<UseDriverLocationReturn['permissionStatus']>('checking');
  const [error, setError] = useState<string | null>(null);
  const trackerRef = useRef<GPSTracker | null>(null);
  const driverIdRef = useRef(driverId);
  const driverNameRef = useRef(driverName);
  const activeOrderIdRef = useRef(activeOrderId);

  // Keep refs in sync
  driverIdRef.current = driverId;
  driverNameRef.current = driverName;
  activeOrderIdRef.current = activeOrderId;

  // Check permission on mount
  useEffect(() => {
    GPSTracker.checkPermission().then(setPermissionStatus);
  }, []);

  // Write position to Firestore
  const writeToFirestore = useCallback(async (pos: GPSPosition) => {
    const currentDriverId = driverIdRef.current;
    if (!currentDriverId) return;

    // Validate coordinates
    if (
      isNaN(pos.latitude) || isNaN(pos.longitude) ||
      pos.latitude < -90 || pos.latitude > 90 ||
      pos.longitude < -180 || pos.longitude > 180 ||
      (Math.abs(pos.latitude) < 0.0001 && Math.abs(pos.longitude) < 0.0001)
    ) {
      console.warn('[GPS] Discarding invalid coordinates:', pos.latitude, pos.longitude);
      return;
    }

    // Discard inaccurate fixes > 200m
    if (pos.accuracy > 200) {
      console.warn('[GPS] Discarding inaccurate fix:', pos.accuracy);
      return;
    }

    try {
      const geohash = encodeGeohash(pos.latitude, pos.longitude, 7);
      const acc = Math.round(pos.accuracy);
      const isBusy = Boolean(activeOrderIdRef.current);

      await setDoc(doc(db, 'driverLocations', currentDriverId), {
        driverId: currentDriverId,
        partnerId: currentDriverId,
        ...(driverNameRef.current ? { driverName: driverNameRef.current } : {}),
        latitude: pos.latitude,
        longitude: pos.longitude,
        geohash,
        accuracy: acc,
        locationAccuracyMeters: acc,
        speed: Math.round(speedToKmh(pos.speed)),
        heading: Math.round(pos.heading),
        isOnline: true,
        availabilityStatus: isBusy ? 'busy' : 'available',
        activeOrderId: activeOrderIdRef.current || null,
        lastLocationUpdateAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.error('[GPS] Failed to write location to Firestore:', err);
    }
  }, []);

  // Handle position update
  const handlePosition = useCallback((pos: GPSPosition) => {
    setPosition(pos);
    setError(null);
    writeToFirestore(pos);
  }, [writeToFirestore]);

  // Handle GPS error
  const handleError = useCallback((err: GeolocationPositionError) => {
    switch (err.code) {
      case err.PERMISSION_DENIED:
        setError('Location permission denied. Please enable GPS.');
        setPermissionStatus('denied');
        break;
      case err.POSITION_UNAVAILABLE:
        setError('Location unavailable. Check GPS signal.');
        break;
      case err.TIMEOUT:
        setError('Location request timed out.');
        break;
      default:
        setError('Unknown GPS error.');
    }
  }, []);

  // Start/stop tracking based on online status
  useEffect(() => {
    if (!driverId || !isOnline) {
      // Stop tracking when offline
      if (trackerRef.current) {
        trackerRef.current.stop();
        trackerRef.current = null;
        setIsTracking(false);
      }

      // Mark as offline in Firestore
      if (driverId) {
        setDoc(doc(db, 'driverLocations', driverId), {
          driverId,
          partnerId: driverId,
          isOnline: false,
          availabilityStatus: 'offline',
          activeOrderId: null,
          updatedAt: serverTimestamp(),
        }, { merge: true }).catch(console.error);
      }

      return;
    }

    // Create tracker if not exists
    if (!trackerRef.current) {
      trackerRef.current = new GPSTracker(handlePosition, handleError);
    }

    // Set mode based on delivery status
    if (hasActiveDelivery) {
      trackerRef.current.setActiveDeliveryMode();
    } else {
      trackerRef.current.setIdleMode();
    }

    // Start tracking
    const started = trackerRef.current.start();
    setIsTracking(started);

    if (!started) {
      setError('GPS not supported on this device.');
      setPermissionStatus('unsupported');
    }

    return () => {
      if (trackerRef.current) {
        trackerRef.current.stop();
        trackerRef.current = null;
        setIsTracking(false);
      }
    };
  }, [driverId, isOnline, hasActiveDelivery, handlePosition, handleError]);

  // Update delivery mode when it changes
  useEffect(() => {
    if (trackerRef.current) {
      if (hasActiveDelivery) {
        trackerRef.current.setActiveDeliveryMode();
      } else {
        trackerRef.current.setIdleMode();
      }
    }
  }, [hasActiveDelivery]);

  // Request permission manually
  const requestPermission = useCallback(() => {
    if (!navigator.geolocation) {
      setPermissionStatus('unsupported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        setPermissionStatus('granted');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionStatus('denied');
        }
      },
      { enableHighAccuracy: true }
    );
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (trackerRef.current) {
        trackerRef.current.stop();
      }
    };
  }, []);

  return {
    position,
    isTracking,
    permissionStatus,
    error,
    accuracy: position?.accuracy ? Math.round(position.accuracy) : null,
    speedKmh: position?.speed ? speedToKmh(position.speed) : 0,
    requestPermission,
  };
}
