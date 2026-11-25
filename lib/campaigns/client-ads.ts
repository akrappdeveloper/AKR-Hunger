'use client';

import { CampaignAdType } from '@/lib/types';

export interface ServedAdItem {
  campaignId: string;
  campaignName: string;
  adType: CampaignAdType;
  offerBadge?: string;
  restaurantId: string;
  restaurantName: string;
  restaurantRating: number;
  restaurantIsOpen: boolean;
  deliveryTime: string;
  menuItem: {
    id: string;
    name: string;
    description?: string;
    price: number;
    originalPrice?: number;
    image: string;
    category: string;
    veg?: boolean;
    isVeg?: boolean;
    rating: number;
    available: boolean;
    restaurantId: string;
    restaurantName: string;
    spiceLevelOptions?: string[];
    sizeOptions?: any[];
    addonOptions?: any[];
  };
}

interface StoredAttribution {
  campaignId: string;
  menuItemId: string;
  restaurantId: string;
  adType: CampaignAdType;
  clickedAt: number;
}

const ATTRIBUTION_KEY = 'akr_hunger_ad_attributions_v1';
const SESSION_KEY = 'akr_hunger_ad_session_v1';
const firedEventsCache = new Set<string>();

export function getAdSessionId(): string {
  if (typeof window === 'undefined') return 'ssr_session';
  try {
    let existing = window.sessionStorage.getItem(SESSION_KEY);
    if (!existing) {
      existing = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
      window.sessionStorage.setItem(SESSION_KEY, existing);
    }
    return existing;
  } catch {
    return `sess_${Date.now().toString(36)}`;
  }
}

export async function fetchSponsoredAds(params: {
  placement: CampaignAdType;
  q?: string;
  category?: string;
  excludeMenuItemId?: string;
  pincode?: string;
  limit?: number;
}): Promise<ServedAdItem[]> {
  try {
    const qs = new URLSearchParams();
    qs.set('placement', params.placement);
    if (params.q) qs.set('q', params.q);
    if (params.category) qs.set('category', params.category);
    if (params.excludeMenuItemId) qs.set('excludeMenuItemId', params.excludeMenuItemId);
    if (params.pincode) qs.set('pincode', params.pincode);
    if (params.limit) qs.set('limit', String(params.limit));

    const res = await fetch(`/api/ads/serve?${qs.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.ads) ? data.ads : [];
  } catch {
    return [];
  }
}

export async function trackAdEvent(params: {
  eventType: 'IMPRESSION' | 'CLICK' | 'CONVERSION';
  campaignId: string;
  menuItemId: string;
  placement: CampaignAdType;
  userId?: string;
  orderId?: string;
  orderAmount?: number;
  searchQuery?: string;
}): Promise<void> {
  if (!params.campaignId || !params.menuItemId) return;
  const sessionId = getAdSessionId();

  // Deduplicate impressions/clicks locally so StrictMode & re-renders never double fire
  if (params.eventType !== 'CONVERSION') {
    const cacheKey = `${params.eventType}:${params.campaignId}:${params.menuItemId}:${sessionId}`;
    if (firedEventsCache.has(cacheKey)) return;
    firedEventsCache.add(cacheKey);
  }

  try {
    await fetch('/api/ads/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        sessionId,
      }),
      keepalive: true,
    });
  } catch {
    // Non-blocking analytics
  }
}

export function saveAdAttribution(attr: Omit<StoredAttribution, 'clickedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_KEY);
    const list: StoredAttribution[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    // Keep last 24h attributions
    const fresh = list.filter(
      (item) =>
        now - item.clickedAt < 24 * 60 * 60 * 1000 &&
        !(item.campaignId === attr.campaignId && item.menuItemId === attr.menuItemId)
    );
    fresh.push({ ...attr, clickedAt: now });
    window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(fresh.slice(-20)));
  } catch {
    // Ignore storage errors
  }
}

export async function trackAdConversionsForOrder(
  orderId: string,
  orderItems: Array<{ menuItemId?: string; id?: string; restaurantId?: string; price?: number; quantity?: number }>,
  orderTotal: number,
  userId?: string
): Promise<void> {
  if (typeof window === 'undefined' || !orderId || !Array.isArray(orderItems)) return;
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_KEY);
    if (!raw) return;
    const attributions: StoredAttribution[] = JSON.parse(raw);
    if (!Array.isArray(attributions) || attributions.length === 0) return;

    const now = Date.now();
    const valid = attributions.filter((a) => now - a.clickedAt < 24 * 60 * 60 * 1000);
    const orderedIds = new Set(
      orderItems.map((it) => String(it.menuItemId || it.id || '').split('-')[0]).filter(Boolean)
    );

    const matched = valid.filter((a) => orderedIds.has(a.menuItemId));
    if (matched.length === 0) return;

    // Track conversions for matching items
    await Promise.allSettled(
      matched.map((attr) =>
        trackAdEvent({
          eventType: 'CONVERSION',
          campaignId: attr.campaignId,
          menuItemId: attr.menuItemId,
          placement: attr.adType,
          userId,
          orderId,
          orderAmount: orderTotal,
        })
      )
    );

    // Clear matched attributions so subsequent orders aren't wrongly re-attributed
    const remaining = valid.filter((a) => !orderedIds.has(a.menuItemId));
    window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(remaining));
  } catch {
    // Non-blocking
  }
}
