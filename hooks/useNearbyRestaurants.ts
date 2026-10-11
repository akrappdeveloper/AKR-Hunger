'use client';

import { useState, useCallback, useRef } from 'react';
import { RestaurantDiscoveryResult } from '@/lib/types';

interface UseNearbyRestaurantsOptions {
  radiusKm?: number;
  maxResults?: number;
  sortBy?: 'distance' | 'rating' | 'deliveryTime' | 'relevance';
}

interface UseNearbyRestaurantsReturn {
  results: RestaurantDiscoveryResult[];
  loading: boolean;
  error: string | null;
  meta: {
    total: number;
    eligible: number;
    radiusKm: number;
  } | null;
  discover: (
    customerLat: number,
    customerLon: number,
    filters?: {
      cuisineFilter?: string[];
      vegOnly?: boolean;
      rating4Plus?: boolean;
      fastDelivery?: boolean;
      searchQuery?: string;
    }
  ) => Promise<void>;
  clearResults: () => void;
}

/**
 * Hook for geospatial restaurant discovery via the server-side API.
 * 
 * Usage:
 * ```tsx
 * const { results, loading, discover } = useNearbyRestaurants();
 * 
 * useEffect(() => {
 *   if (lat && lon) discover(lat, lon);
 * }, [lat, lon]);
 * ```
 */
export function useNearbyRestaurants(
  options: UseNearbyRestaurantsOptions = {}
): UseNearbyRestaurantsReturn {
  const [results, setResults] = useState<RestaurantDiscoveryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ total: number; eligible: number; radiusKm: number } | null>(null);
  
  // Abort controller for cancelling in-flight requests
  const abortRef = useRef<AbortController | null>(null);

  const discover = useCallback(
    async (
      customerLat: number,
      customerLon: number,
      filters?: {
        cuisineFilter?: string[];
        vegOnly?: boolean;
        rating4Plus?: boolean;
        fastDelivery?: boolean;
        searchQuery?: string;
      }
    ) => {
      // Cancel previous request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/delivery/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            customerLat,
            customerLon,
            radiusKm: options.radiusKm || 10,
            maxResults: options.maxResults || 50,
            sortBy: options.sortBy || 'relevance',
            ...filters,
          }),
        });

        if (!response.ok) {
          throw new Error(`Discovery failed: ${response.status}`);
        }

        const data = await response.json();
        
        if (!controller.signal.aborted) {
          setResults(data.results || []);
          setMeta(data.meta || null);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return; // Cancelled, ignore
        console.error('[useNearbyRestaurants] Error:', err);
        if (!controller.signal.aborted) {
          setError(err.message || 'Failed to discover restaurants');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [options.radiusKm, options.maxResults, options.sortBy]
  );

  const clearResults = useCallback(() => {
    setResults([]);
    setMeta(null);
    setError(null);
  }, []);

  return { results, loading, error, meta, discover, clearResults };
}
