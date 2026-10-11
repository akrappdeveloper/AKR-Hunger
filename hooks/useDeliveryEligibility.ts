'use client';

import { useState, useCallback, useRef } from 'react';
import { DeliveryEligibilityResult } from '@/lib/types';

interface UseDeliveryEligibilityReturn {
  eligibility: DeliveryEligibilityResult | null;
  loading: boolean;
  error: string | null;
  check: (restaurantId: string, customerLat: number, customerLon: number) => Promise<DeliveryEligibilityResult | null>;
  reset: () => void;
}

/**
 * Hook for checking delivery eligibility of a specific restaurant.
 * 
 * Usage:
 * ```tsx
 * const { eligibility, loading, check } = useDeliveryEligibility();
 * 
 * useEffect(() => {
 *   if (restaurantId && lat && lon) check(restaurantId, lat, lon);
 * }, [restaurantId, lat, lon]);
 * ```
 */
export function useDeliveryEligibility(): UseDeliveryEligibilityReturn {
  const [eligibility, setEligibility] = useState<DeliveryEligibilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const abortRef = useRef<AbortController | null>(null);

  const check = useCallback(
    async (restaurantId: string, customerLat: number, customerLon: number): Promise<DeliveryEligibilityResult | null> => {
      // Cancel previous request
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/delivery/eligibility', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ restaurantId, customerLat, customerLon }),
        });

        if (!response.ok) {
          throw new Error(`Eligibility check failed: ${response.status}`);
        }

        const data = await response.json();
        
        if (!controller.signal.aborted) {
          setEligibility(data.eligibility);
          return data.eligibility;
        }
        return null;
      } catch (err: any) {
        if (err.name === 'AbortError') return null;
        console.error('[useDeliveryEligibility] Error:', err);
        if (!controller.signal.aborted) {
          setError(err.message || 'Failed to check eligibility');
        }
        return null;
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    []
  );

  const reset = useCallback(() => {
    setEligibility(null);
    setError(null);
  }, []);

  return { eligibility, loading, error, check, reset };
}
