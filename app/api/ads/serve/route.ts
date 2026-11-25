import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin-db';
import { processCampaignSchedules } from '@/lib/campaigns/lifecycle-engine';
import { getAdSettingsServer } from '@/lib/campaigns/wallet-balance';
import { normalizeCampaignStatus } from '@/lib/campaigns/constants';
import { CampaignAdType } from '@/lib/types';

function toMillis(val: any): number {
  if (!val) return 0;
  if (typeof val?.toDate === 'function') return val.toDate().getTime();
  if (typeof val?.seconds === 'number') return val.seconds * 1000;
  const parsed = new Date(val).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getTodayIST(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ success: true, ads: [] });
    }

    const { searchParams } = new URL(request.url);
    const placementRaw = (searchParams.get('placement') || 'HOME_PAGE').toUpperCase();
    const placement: CampaignAdType =
      placementRaw === 'SEARCH' || placementRaw === 'PRODUCT_DETAILS'
        ? (placementRaw as CampaignAdType)
        : 'HOME_PAGE';
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const category = (searchParams.get('category') || '').trim().toLowerCase();
    const excludeMenuItemId = (searchParams.get('excludeMenuItemId') || '').trim();
    const pincode = (searchParams.get('pincode') || '').trim();
    const limit = Math.min(12, Math.max(1, Number(searchParams.get('limit') || 6)));

    // Keep lifecycle accurate before serving ads
    await processCampaignSchedules(false);

    const settings = await getAdSettingsServer();
    if (settings.placementsEnabled?.[placement] === false) {
      return NextResponse.json({ success: true, ads: [], disabledPlacement: true });
    }

    const nowMs = Date.now();
    const todayIST = getTodayIST();

    const snap = await adminDb.collection('adCampaigns').get();
    const candidateCampaigns: Array<Record<string, any>> = snap.docs
      .map((d): Record<string, any> => ({ id: d.id, ...(d.data() as Record<string, any>) }))
      .filter((c) => {
        const status = normalizeCampaignStatus(c);
        if (status !== 'ACTIVE') return false;

        const campAdType: CampaignAdType =
          c.adType === 'SEARCH' || c.adType === 'PRODUCT_DETAILS' || c.adType === 'HOME_PAGE'
            ? c.adType
            : 'HOME_PAGE';
        if (campAdType !== placement) return false;

        const startMs = toMillis(c.startAt || c.startDate);
        const endMs = toMillis(c.endAt || c.endDate);
        if (startMs > 0 && nowMs < startMs) return false;
        if (endMs > 0 && nowMs >= endMs) return false;

        const totalBudget = Number(c.totalBudget ?? c.monthlyCost ?? 0);
        const spentAmount = Number(c.spentAmount ?? c.totalSpent ?? 0);
        const remainingBudget =
          c.remainingBudget !== undefined
            ? Number(c.remainingBudget)
            : Math.max(0, totalBudget - spentAmount);
        if (totalBudget > 0 && remainingBudget <= 0) return false;

        const dailyBudget = Number(c.dailyBudget || 0);
        const todaySpent = c.lastSpendDate === todayIST ? Number(c.todaySpent || 0) : 0;
        if (dailyBudget > 0 && todaySpent >= dailyBudget) return false;

        return true;
      });

    if (candidateCampaigns.length === 0) {
      return NextResponse.json({ success: true, ads: [] });
    }

    // Collect unique menuItemIds and restaurantIds
    const allItemIds = new Set<string>();
    const allRestaurantIds = new Set<string>();

    candidateCampaigns.forEach((c) => {
      const ids: string[] =
        Array.isArray(c.menuItemIds) && c.menuItemIds.length > 0
          ? c.menuItemIds
          : c.menuItemId
          ? [c.menuItemId]
          : [];
      ids.forEach((id) => {
        if (id && id !== excludeMenuItemId) allItemIds.add(id);
      });
      if (c.restaurantId) allRestaurantIds.add(c.restaurantId);
    });

    if (allItemIds.size === 0) {
      return NextResponse.json({ success: true, ads: [] });
    }

    const [itemSnaps, restaurantSnaps] = await Promise.all([
      Promise.all(Array.from(allItemIds).map((id) => adminDb.collection('menuItems').doc(id).get())),
      Promise.all(
        Array.from(allRestaurantIds).map((id) => adminDb.collection('restaurants').doc(id).get())
      ),
    ]);

    const itemMap = new Map<string, Record<string, any>>();
    itemSnaps.forEach((s) => {
      if (s.exists) itemMap.set(s.id, { id: s.id, ...s.data() });
    });

    const restaurantMap = new Map<string, Record<string, any>>();
    restaurantSnaps.forEach((s) => {
      if (s.exists) restaurantMap.set(s.id, { id: s.id, ...s.data() });
    });

    const queryTokens = q.split(/\s+/).filter((t) => t.length >= 2);
    const scoredCandidates: Array<{
      score: number;
      campaign: Record<string, any>;
      menuItem: Record<string, any>;
      restaurant: Record<string, any>;
    }> = [];

    for (const c of candidateCampaigns) {
      const rest = restaurantMap.get(c.restaurantId);
      if (!rest) continue;
      if (rest.isBlocked === true || rest.isActive === false) continue;
      if (pincode && Array.isArray(rest.serviceablePincodes) && rest.serviceablePincodes.length > 0) {
        if (!rest.serviceablePincodes.includes(pincode)) continue;
      }

      const ids: string[] =
        Array.isArray(c.menuItemIds) && c.menuItemIds.length > 0
          ? c.menuItemIds
          : c.menuItemId
          ? [c.menuItemId]
          : [];

      const campKeywords: string[] = Array.isArray(c.targetKeywords)
        ? c.targetKeywords.map((k: string) => String(k).toLowerCase())
        : [];

      for (const itemId of ids) {
        if (!itemId || itemId === excludeMenuItemId) continue;
        const item = itemMap.get(itemId);
        if (!item) continue;

        const approved = !item.approvalStatus || item.approvalStatus === 'approved';
        const available = item.available !== false && item.isAvailable !== false;
        const notDeleted = item.deleted !== true && item.isDeleted !== true;
        if (!approved || !available || !notDeleted) continue;

        const searchableText = [
          item.name || '',
          item.category || '',
          item.description || '',
          rest.restaurantName || rest.name || '',
          c.campaignName || '',
          c.campaignDescription || '',
          ...campKeywords,
        ]
          .join(' ')
          .toLowerCase();

        // For search placement, require query relevance when a search query is active
        let relevanceScore = 10;
        if (placement === 'SEARCH' && queryTokens.length > 0) {
          let matchedTokens = 0;
          queryTokens.forEach((tok) => {
            if (searchableText.includes(tok)) matchedTokens++;
            if ((item.name || '').toLowerCase().includes(tok)) matchedTokens += 1.5;
            if (campKeywords.some((kw) => kw.includes(tok))) matchedTokens += 1.2;
          });
          if (matchedTokens <= 0) continue;
          relevanceScore += matchedTokens * 20;
        } else if (placement === 'PRODUCT_DETAILS' && category) {
          const itemCat = (item.category || '').toLowerCase();
          if (itemCat === category) relevanceScore += 25;
          else if (itemCat.includes(category) || category.includes(itemCat)) relevanceScore += 15;
        } else if (placement === 'HOME_PAGE' && category && category !== 'all') {
          const itemCat = (item.category || '').toLowerCase();
          if (itemCat.includes(category)) relevanceScore += 15;
        }

        const totalBudget = Number(c.totalBudget ?? c.monthlyCost ?? 100);
        const remainingBudget = Number(c.remainingBudget ?? totalBudget);
        const budgetWeight = Math.min(20, Math.log10(Math.max(10, remainingBudget)) * 6);
        const ctrScore = Math.min(15, Number(c.clickThroughRate || 0) * 1.5);
        const openBoost = rest.isOpen !== false ? 8 : 0;

        scoredCandidates.push({
          score: relevanceScore + budgetWeight + ctrScore + openBoost,
          campaign: c,
          menuItem: item,
          restaurant: rest,
        });
      }
    }

    // Sort highest score first, diversify max 1 item per campaign on top pass
    scoredCandidates.sort((a, b) => b.score - a.score);

    const picked: typeof scoredCandidates = [];
    const seenCampaigns = new Set<string>();
    const seenItems = new Set<string>();

    // Pass 1: One top item per distinct campaign
    for (const cand of scoredCandidates) {
      if (picked.length >= limit) break;
      if (seenCampaigns.has(cand.campaign.id) || seenItems.has(cand.menuItem.id)) continue;
      picked.push(cand);
      seenCampaigns.add(cand.campaign.id);
      seenItems.add(cand.menuItem.id);
    }

    // Pass 2: Fill remaining slots from multi-item campaigns if needed
    for (const cand of scoredCandidates) {
      if (picked.length >= limit) break;
      if (seenItems.has(cand.menuItem.id)) continue;
      picked.push(cand);
      seenItems.add(cand.menuItem.id);
    }

    const multiplier = settings.placementMultipliers?.[placement] ?? 1.0;

    const ads = picked.map(({ campaign, menuItem, restaurant }) => ({
      campaignId: campaign.id,
      campaignName: campaign.campaignName || campaign.title || 'Sponsored Promotion',
      adType: placement,
      offerBadge:
        campaign.offerBadge ||
        (menuItem.originalPrice && Number(menuItem.originalPrice) > Number(menuItem.price)
          ? `${Math.round(((Number(menuItem.originalPrice) - Number(menuItem.price)) / Number(menuItem.originalPrice)) * 100)}% OFF`
          : undefined),
      restaurantId: restaurant.id,
      restaurantName: restaurant.restaurantName || restaurant.name || campaign.restaurantName || 'AKR Partner',
      restaurantRating: Number(restaurant.rating || 4.5),
      restaurantIsOpen: restaurant.isOpen !== false,
      deliveryTime: restaurant.deliveryTime || '25-35 mins',
      menuItem: {
        id: menuItem.id,
        name: menuItem.name,
        description: menuItem.description || '',
        price: Number(menuItem.price || 0),
        originalPrice: menuItem.originalPrice ? Number(menuItem.originalPrice) : undefined,
        image: menuItem.image || menuItem.imageUrl || '/placeholder-food.png',
        category: menuItem.category || 'Specials',
        veg: menuItem.veg,
        isVeg: menuItem.isVeg,
        rating: Number(menuItem.rating || 4.5),
        available: true,
        restaurantId: restaurant.id,
        restaurantName: restaurant.restaurantName || restaurant.name || 'AKR Partner',
        spiceLevelOptions: menuItem.spiceLevelOptions,
        sizeOptions: menuItem.sizeOptions,
        addonOptions: menuItem.addonOptions,
      },
      rates: {
        cpc: Number((settings.cpcRate * multiplier).toFixed(2)),
        cpm: Number((settings.cpmRate * multiplier).toFixed(2)),
      },
    }));

    return NextResponse.json({
      success: true,
      placement,
      ads,
    });
  } catch (err: any) {
    console.error('[Ads Serve API] Error:', err);
    return NextResponse.json({ success: false, ads: [], error: err?.message }, { status: 500 });
  }
}
