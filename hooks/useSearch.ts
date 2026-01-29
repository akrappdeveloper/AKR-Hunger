'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { SearchFilters } from '@/lib/types';

export function useSearch() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [filters, setFilters] = useState<SearchFilters>({
        query: searchParams.get('q') || '',
        cuisineTypes: searchParams.get('cuisines')?.split(',').filter(Boolean) || [],
        rating: searchParams.get('rating') ? parseFloat(searchParams.get('rating')!) : undefined,
        deliveryTime: searchParams.get('deliveryTime') ? parseInt(searchParams.get('deliveryTime')!) : undefined,
        sortBy: (searchParams.get('sortBy') as any) || 'popularity',
        sortOrder: (searchParams.get('sortOrder') as any) || 'desc',
    });

    const [debouncedQuery, setDebouncedQuery] = useState(filters.query);

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(filters.query || '');
        }, 500);

        return () => clearTimeout(timer);
    }, [filters.query]);

    // Sync filters with URL
    useEffect(() => {
        const params = new URLSearchParams();

        if (debouncedQuery) params.set('q', debouncedQuery);
        if (filters.cuisineTypes && filters.cuisineTypes.length > 0) {
            params.set('cuisines', filters.cuisineTypes.join(','));
        }
        if (filters.rating) params.set('rating', filters.rating.toString());
        if (filters.deliveryTime) params.set('deliveryTime', filters.deliveryTime.toString());
        if (filters.sortBy) params.set('sortBy', filters.sortBy);
        if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);

        const queryString = params.toString();
        const newUrl = queryString ? `?${queryString}` : window.location.pathname;

        router.replace(newUrl, { scroll: false });
    }, [debouncedQuery, filters, router]);

    const updateFilters = (updates: Partial<SearchFilters>) => {
        setFilters((prev) => ({ ...prev, ...updates }));
    };

    const clearFilters = () => {
        setFilters({
            query: '',
            cuisineTypes: [],
            rating: undefined,
            deliveryTime: undefined,
            sortBy: 'popularity',
            sortOrder: 'desc',
        });
    };

    const activeFilterCount =
        (filters.cuisineTypes?.length || 0) +
        (filters.rating ? 1 : 0) +
        (filters.deliveryTime ? 1 : 0);

    return {
        filters: { ...filters, query: debouncedQuery },
        updateFilters,
        clearFilters,
        activeFilterCount,
    };
}
