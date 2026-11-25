import { AdSettings, CampaignAdType, CampaignStatus } from '@/lib/types';

export const DEFAULT_AD_SETTINGS: AdSettings = {
  id: 'global',
  minDailyBudget: 50,
  minTotalBudget: 100,
  cpcRate: 2.0, // ₹2 per click
  cpmRate: 40.0, // ₹40 per 1,000 impressions
  pointsToRupeeRate: 1.0, // 1 point = ₹1
  activationDelaySeconds: 60,
  estimatedCtrPercent: 3.5,
  placementsEnabled: {
    HOME_PAGE: true,
    SEARCH: true,
    PRODUCT_DETAILS: true,
  },
  placementMultipliers: {
    HOME_PAGE: 1.0,
    SEARCH: 1.2,
    PRODUCT_DETAILS: 0.9,
  },
};

export interface AdPlacementMeta {
  adType: CampaignAdType;
  slug: 'home-page' | 'search' | 'product-details';
  title: string;
  shortTitle: string;
  description: string;
  placementLabel: string;
  examplePlacement: string;
  supportsMultipleItems: boolean;
  badgeText: string;
}

export const AD_PLACEMENTS: Record<CampaignAdType, AdPlacementMeta> = {
  HOME_PAGE: {
    adType: 'HOME_PAGE',
    slug: 'home-page',
    title: 'Home Page Ads',
    shortTitle: 'Home Page',
    description: 'Promote selected restaurant menu items on the customer home page.',
    placementLabel: 'Customer Home → Recommended / Sponsored Items',
    examplePlacement: 'Customer Home → Recommended/Sponsored Items section.',
    supportsMultipleItems: true,
    badgeText: 'High Visibility Feed',
  },
  SEARCH: {
    adType: 'SEARCH',
    slug: 'search',
    title: 'Search Ads',
    shortTitle: 'Search Results',
    description: 'Promote menu items in relevant customer search results.',
    placementLabel: 'Customer Search → Relevant Sponsored Results',
    examplePlacement: 'Customer Search → Relevant Sponsored Results.',
    supportsMultipleItems: true,
    badgeText: 'High Intent Buyers',
  },
  PRODUCT_DETAILS: {
    adType: 'PRODUCT_DETAILS',
    slug: 'product-details',
    title: 'Product Details Page Ads',
    shortTitle: 'Product Details',
    description: "Promote related menu items on other menu item's details pages.",
    placementLabel: 'Customer Menu Details → Sponsored Related Items',
    examplePlacement: 'Customer Menu Details → Sponsored Related Items.',
    supportsMultipleItems: true,
    badgeText: 'Cross-Sell Boost',
  },
};

export function slugToAdType(slug?: string | null): CampaignAdType | null {
  switch ((slug || '').toLowerCase()) {
    case 'home-page':
    case 'home_page':
      return 'HOME_PAGE';
    case 'search':
      return 'SEARCH';
    case 'product-details':
    case 'product_details':
      return 'PRODUCT_DETAILS';
    default:
      return null;
  }
}

export function adTypeToSlug(adType?: CampaignAdType | string): string {
  switch (adType) {
    case 'SEARCH':
      return 'search';
    case 'PRODUCT_DETAILS':
      return 'product-details';
    case 'HOME_PAGE':
    default:
      return 'home-page';
  }
}

export function normalizeCampaignStatus(campaign: any): CampaignStatus {
  const raw = String(campaign?.campaignStatus || campaign?.status || 'DRAFT').toUpperCase();
  const valid: CampaignStatus[] = [
    'DRAFT',
    'PENDING_PAYMENT',
    'SCHEDULED',
    'ACTIVATING',
    'ACTIVE',
    'PAUSED',
    'COMPLETED',
    'REJECTED',
    'CANCELLED',
    'FAILED',
  ];
  return valid.includes(raw as CampaignStatus) ? (raw as CampaignStatus) : 'DRAFT';
}

export function getCampaignStatusMeta(status: string): {
  label: string;
  className: string;
} {
  const norm = String(status || 'DRAFT').toUpperCase();
  switch (norm) {
    case 'ACTIVE':
      return {
        label: 'Active',
        className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      };
    case 'ACTIVATING':
      return {
        label: 'Activating',
        className: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
      };
    case 'SCHEDULED':
      return {
        label: 'Scheduled',
        className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
      };
    case 'PENDING_PAYMENT':
      return {
        label: 'Pending Payment',
        className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      };
    case 'PAUSED':
      return {
        label: 'Paused',
        className: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
      };
    case 'COMPLETED':
      return {
        label: 'Completed',
        className: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
      };
    case 'REJECTED':
      return {
        label: 'Rejected',
        className: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        className: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30',
      };
    case 'FAILED':
      return {
        label: 'Failed',
        className: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
      };
    default:
      return {
        label: 'Draft',
        className: 'bg-muted text-muted-foreground border-border',
      };
  }
}

export function estimateCampaignPerformance(params: {
  totalBudget: number;
  adType: CampaignAdType;
  settings?: AdSettings;
}): {
  estimatedImpressionsMin: number;
  estimatedImpressionsMax: number;
  estimatedClicksMin: number;
  estimatedClicksMax: number;
  estimatedReachMin: number;
  estimatedReachMax: number;
  effectiveCpm: number;
  effectiveCpc: number;
} {
  const s = params.settings || DEFAULT_AD_SETTINGS;
  const multiplier = s.placementMultipliers?.[params.adType] ?? 1.0;
  const effectiveCpm = Math.max(5, s.cpmRate * multiplier);
  const effectiveCpc = Math.max(0.5, s.cpcRate * multiplier);
  const budget = Math.max(0, Number(params.totalBudget || 0));

  // Blended impression estimate from CPM & CPC pacing
  const baseImpressions = Math.round((budget / effectiveCpm) * 1000);
  const estimatedImpressionsMin = Math.round(baseImpressions * 0.8);
  const estimatedImpressionsMax = Math.round(baseImpressions * 1.2);

  const ctr = Math.max(0.5, s.estimatedCtrPercent || 3.5) / 100;
  const rawClicks = Math.round(baseImpressions * ctr);
  const maxClicksByCpc = Math.floor(budget / effectiveCpc);
  const midClicks = Math.min(rawClicks, Math.max(rawClicks, maxClicksByCpc));

  const estimatedClicksMin = Math.max(0, Math.round(midClicks * 0.75));
  const estimatedClicksMax = Math.max(estimatedClicksMin, Math.round(midClicks * 1.25));

  const estimatedReachMin = Math.round(estimatedImpressionsMin * 0.65);
  const estimatedReachMax = Math.round(estimatedImpressionsMax * 0.75);

  return {
    estimatedImpressionsMin,
    estimatedImpressionsMax,
    estimatedClicksMin,
    estimatedClicksMax,
    estimatedReachMin,
    estimatedReachMax,
    effectiveCpm,
    effectiveCpc,
  };
}

export function formatDurationLabel(startMs: number, endMs: number): {
  days: number;
  hours: number;
  totalHours: number;
  label: string;
} {
  const diffMs = Math.max(0, endMs - startMs);
  const totalHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days === 0) {
    return { days: 0, hours: totalHours, totalHours, label: `${totalHours} hour${totalHours === 1 ? '' : 's'}` };
  }
  if (hours === 0) {
    return { days, hours: 0, totalHours, label: `${days} day${days === 1 ? '' : 's'}` };
  }
  return {
    days,
    hours,
    totalHours,
    label: `${days}d ${hours}h`,
  };
}

export function generateCampaignId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 8; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CAMP-${suffix}`;
}
