import { MenuItem } from '@/lib/types';

export const POPULAR_CATEGORIES = [
  { name: 'Pizza', icon: '🍕', color: 'from-orange-500/20 to-red-500/20 border-orange-500/30 text-orange-600 dark:text-orange-400' },
  { name: 'Burgers & Wraps', icon: '🍔', color: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30 text-amber-600 dark:text-amber-400' },
  { name: 'Biryani & Rice', icon: '🍲', color: 'from-red-500/20 to-rose-500/20 border-red-500/30 text-red-600 dark:text-red-400' },
  { name: 'Chinese & Asian', icon: '🍜', color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-600 dark:text-blue-400' },
  { name: 'North Indian', icon: '🍛', color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' },
  { name: 'South Indian & Dosa', icon: '🥞', color: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-600 dark:text-yellow-400' },
  { name: 'Rolls & Shawarma', icon: '🌯', color: 'from-orange-500/20 to-amber-500/20 border-orange-500/30 text-orange-600 dark:text-orange-400' },
  { name: 'Tandoor & Kebabs', icon: '🍢', color: 'from-red-600/20 to-orange-600/20 border-red-600/30 text-red-600 dark:text-red-400' },
  { name: 'Italian & Pasta', icon: '🍝', color: 'from-rose-500/20 to-pink-500/20 border-rose-500/30 text-rose-600 dark:text-rose-400' },
  { name: 'Salads & Healthy', icon: '🥗', color: 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-600 dark:text-green-400' },
  { name: 'Desserts & Sweets', icon: '🍰', color: 'from-pink-500/20 to-purple-500/20 border-pink-500/30 text-pink-600 dark:text-pink-400' },
  { name: 'Beverages & Shakes', icon: '🧋', color: 'from-purple-500/20 to-indigo-500/20 border-purple-500/30 text-purple-600 dark:text-purple-400' },
  { name: 'Momos & Dimsums', icon: '🥟', color: 'from-cyan-500/20 to-sky-500/20 border-cyan-500/30 text-cyan-600 dark:text-cyan-400' },
  { name: 'Combos & Thalis', icon: '🍱', color: 'from-amber-600/20 to-orange-600/20 border-amber-600/30 text-amber-600 dark:text-amber-400' },
  { name: 'Bakery & Quick Bites', icon: '🥐', color: 'from-yellow-600/20 to-orange-500/20 border-yellow-600/30 text-yellow-600 dark:text-yellow-400' },
  { name: 'Sandwiches & Snacks', icon: '🥪', color: 'from-lime-500/20 to-green-500/20 border-lime-500/30 text-lime-600 dark:text-lime-400' },
  { name: 'Chai & Coffee', icon: '☕', color: 'from-amber-700/20 to-amber-900/20 border-amber-700/30 text-amber-700 dark:text-amber-300' },
  { name: 'Fast Food', icon: '🍟', color: 'from-red-500/20 to-yellow-500/20 border-red-500/30 text-red-600 dark:text-red-400' },
];

export const CURATED_BADGES = [
  {
    key: 'isChefSpecial',
    label: "Chef's Special",
    desc: 'Signature preparation recommended by head chef',
    icon: '👨‍🍳',
    color: 'from-rose-500 to-pink-600',
    badgeClass: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
  },
  {
    key: 'isMustTry',
    label: 'Must Try',
    desc: 'Crowd-favorite dish highly recommended for first-timers',
    icon: '🔥',
    color: 'from-amber-500 to-orange-600',
    badgeClass: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  },
  {
    key: 'isTrending',
    label: 'Trending Now',
    desc: 'Currently in high demand among food enthusiasts',
    icon: '⚡',
    color: 'from-violet-500 to-purple-600',
    badgeClass: 'bg-violet-500/15 text-violet-500 border-violet-500/30',
  },
  {
    key: 'isHealthyChoice',
    label: 'Healthy Choice',
    desc: 'Nutrient-rich, macro-balanced, and guilt-free',
    icon: '🥗',
    color: 'from-emerald-500 to-teal-600',
    badgeClass: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  },
  {
    key: 'isSeasonalSpecial',
    label: 'Seasonal Special',
    desc: 'Crafted with fresh seasonal harvest for a limited time',
    icon: '🌟',
    color: 'from-yellow-500 to-amber-600',
    badgeClass: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
  },
  {
    key: 'isLimitedEdition',
    label: 'Limited Batch',
    desc: 'Cooked in strictly restricted daily batches',
    icon: '⏳',
    color: 'from-zinc-700 to-slate-900',
    badgeClass: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  },
  {
    key: 'isHouseSpecialty',
    label: 'House Specialty',
    desc: 'Authentic heritage recipe unique to your kitchen',
    icon: '👑',
    color: 'from-indigo-500 to-blue-600',
    badgeClass: 'bg-indigo-500/15 text-indigo-500 border-indigo-500/30',
  },
  {
    key: 'isKidsFavorite',
    label: "Kids' Favorite",
    desc: 'Mild spices, delicious taste loved by younger guests',
    icon: '👶',
    color: 'from-sky-500 to-blue-500',
    badgeClass: 'bg-sky-500/15 text-sky-500 border-sky-500/30',
  },
];

export function checkIsBestSeller(item: MenuItem, allItems?: MenuItem[]): boolean {
  const raw = item as any;
  const orders = Number(raw.orderCount || raw.totalOrders || raw.salesCount || 0);
  const rating = Number(raw.averageRating || raw.rating || 0);
  const reviews = Number(raw.totalReviews || raw.reviewsCount || 0);

  if (orders >= 5) return true;
  if (rating >= 4.5 && reviews >= 3) return true;

  if (allItems && allItems.length >= 4) {
    const sorted = [...allItems].sort(
      (a: any, b: any) => Number(b.orderCount || b.totalOrders || 0) - Number(a.orderCount || a.totalOrders || 0)
    );
    const topCount = Math.max(1, Math.floor(allItems.length * 0.15));
    const isTop = sorted.slice(0, topCount).some((topItem) => topItem.id === item.id);
    if (isTop && orders > 0) return true;
  }

  return Boolean(item.isBestSeller);
}

export function checkIsNewArrival(item: MenuItem): boolean {
  const raw = item as any;
  const created = item.createdAt || raw.submittedAt;
  if (!created) return Boolean(item.isNew);

  const dateObj =
    created instanceof Date
      ? created
      : (created as any)?.toDate
      ? (created as any).toDate()
      : new Date(created);

  if (isNaN(dateObj.getTime())) return Boolean(item.isNew);

  const ageInDays = (Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24);
  return ageInDays >= 0 && ageInDays <= 14;
}
