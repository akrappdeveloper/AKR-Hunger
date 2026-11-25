'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MenuItem } from '@/lib/types';
import {
  checkIsBestSeller,
  checkIsNewArrival,
} from '@/lib/menu-constants';
export { checkIsBestSeller, checkIsNewArrival };
import { toast } from 'sonner';
import {
  Plus, Trash2, ChevronDown, Image as ImageIcon,
  Clock, X, Star, Users, Utensils,
  Search, ShoppingBag, Store, Edit2,
  LayoutGrid, List, Video
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Checkbox } from '@/components/ui/checkbox';

export default function MenuManagementPage() {
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Layout View Switcher (Grid vs List)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'non-veg' | 'bestseller' | 'special'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'out-of-stock'>('all');

  const [pickupDialogOpen, setPickupDialogOpen] = useState(false);
  const [savingPickupSettings, setSavingPickupSettings] = useState(false);
  const [pickupSettings, setPickupSettings] = useState({
    isPickupEnabled: true,
    defaultPickupTime: 20,
    pickupCounter: 'Express Takeaway Counter',
    pickupInstructions: 'Show digital Order OTP at the pickup counter for instant handover.',
    packagingFee: 0,
    applyToAllItems: true,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/restaurant/login');
      return;
    }
    fetchMenuItems();
    loadRestaurantPickupSettings();
  }, [user, authLoading, router]);

  // Load restaurant's pickup settings from Firestore
  const loadRestaurantPickupSettings = async () => {
    if (!user) return;
    try {
      const restId = restaurant?.id || user.restaurantId || user.uid;
      const snap = await getDoc(doc(db, 'restaurants', restId));
      if (snap.exists()) {
        const data = snap.data();
        if (data.pickupSettings) {
          setPickupSettings({
            isPickupEnabled: data.pickupSettings.isPickupEnabled !== false,
            defaultPickupTime: data.pickupSettings.defaultPickupTime || 20,
            pickupCounter: data.pickupSettings.pickupCounter || 'Express Takeaway Counter',
            pickupInstructions: data.pickupSettings.pickupInstructions || 'Show digital Order OTP at the counter.',
            packagingFee: data.pickupSettings.packagingFee || 0,
            applyToAllItems: false,
          });
        }
      }
    } catch (e) {
      console.warn('[Menu] Could not load pickup settings:', e);
    }
  };

  const fetchMenuItems = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const menuRef = collection(db, 'menuItems');
      const targetIds = Array.from(new Set([user.uid, user.restaurantId, restaurant?.id].filter(Boolean))) as string[];

      const itemsMap = new Map<string, MenuItem>();
      for (const targetId of targetIds) {
        const q = query(menuRef, where('restaurantId', '==', targetId));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach((d) => {
          itemsMap.set(d.id, {
            ...d.data(),
            id: d.id,
          } as MenuItem);
        });
      }

      const qOwner = query(menuRef, where('ownerId', '==', user.uid));
      const ownerSnap = await getDocs(qOwner);
      ownerSnap.docs.forEach((d) => {
        itemsMap.set(d.id, {
          ...d.data(),
          id: d.id,
        } as MenuItem);
      });

      const items = Array.from(itemsMap.values());
      setMenuItems(items);

      if (items.length > 0 && !expandedCategory) {
        setExpandedCategory(items[0].category);
      }
    } catch (error) {
      console.error('[Menu] Error fetching menu items:', error);
      toast.error('Failed to load menu items');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this dish from your menu?')) return;

    try {
      const resolvedRestaurantId = restaurant?.id || user?.restaurantId || user?.uid || '';
      await deleteDoc(doc(db, 'menuItems', itemId));
      if (resolvedRestaurantId) {
        try {
          await deleteDoc(doc(db, 'restaurants', resolvedRestaurantId, 'menuItems', itemId));
        } catch (_) {}
      }
      setMenuItems((prev) => prev.filter((item) => item.id !== itemId));
      toast.success('Dish removed from menu');
    } catch (error) {
      console.error('[Menu] Error deleting item:', error);
      toast.error('Failed to delete item');
    }
  };

  const handleToggleItemAvailability = async (item: MenuItem) => {
    const newStatus = !(item.available !== false);
    try {
      await updateDoc(doc(db, 'menuItems', item.id), {
        available: newStatus,
        updatedAt: new Date(),
      });
      setMenuItems((prev) => prev.map((m) => (m.id === item.id ? { ...m, available: newStatus } : m)));
      toast.success(`${item.name} is now ${newStatus ? 'In Stock (Live)' : 'Marked Out of Stock'}`);
    } catch (e) {
      toast.error('Could not update availability');
    }
  };

  const handleSavePickupSettings = async () => {
    if (!user) return;
    try {
      setSavingPickupSettings(true);
      const restId = restaurant?.id || user.restaurantId || user.uid;

      await updateDoc(doc(db, 'restaurants', restId), {
        isPickupAvailable: pickupSettings.isPickupEnabled,
        pickupSettings: {
          isPickupEnabled: pickupSettings.isPickupEnabled,
          defaultPickupTime: pickupSettings.defaultPickupTime,
          pickupCounter: pickupSettings.pickupCounter,
          pickupInstructions: pickupSettings.pickupInstructions,
          packagingFee: pickupSettings.packagingFee,
          updatedAt: new Date(),
        },
      });

      if (pickupSettings.applyToAllItems && menuItems.length > 0) {
        const updatePromises = menuItems.map((item) =>
          updateDoc(doc(db, 'menuItems', item.id), {
            isPickupAvailable: pickupSettings.isPickupEnabled,
            pickupPrepTime: pickupSettings.defaultPickupTime,
            packagingFee: pickupSettings.packagingFee,
          }).catch(() => {})
        );
        await Promise.all(updatePromises);
        setMenuItems((prev) =>
          prev.map((m) => ({
            ...m,
            isPickupAvailable: pickupSettings.isPickupEnabled,
            pickupPrepTime: pickupSettings.defaultPickupTime,
            packagingFee: pickupSettings.packagingFee,
          } as any))
        );
      }

      toast.success('Pickup & Takeaway settings saved successfully!');
      setPickupDialogOpen(false);
    } catch (error: any) {
      console.error('[Menu] Error saving pickup settings:', error);
      toast.error('Failed to save pickup settings: ' + (error?.message || 'Network error'));
    } finally {
      setSavingPickupSettings(false);
    }
  };

  // Badges resolver for each dish
  const getDishBadges = (item: MenuItem) => {
    const rawAny = item as any;
    const badges: { label: string; icon: string; className: string }[] = [];

    // 1. Automatic Dynamic Badges (Calculated automatically for qualifying special items)
    if (checkIsBestSeller(item, menuItems)) {
      badges.push({
        label: 'BESTSELLER',
        icon: '⭐',
        className: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-950 font-black shadow-sm shadow-amber-500/30',
      });
    }

    if (checkIsNewArrival(item)) {
      badges.push({
        label: 'NEW ARRIVAL',
        icon: '✨',
        className: 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-extrabold shadow-sm shadow-blue-500/30',
      });
    }

    // 2. Curated Badges (Assigned manually by restaurant to special items)
    if (rawAny.isChefSpecial) {
      badges.push({
        label: "CHEF'S SPECIAL",
        icon: '👨‍🍳',
        className: 'bg-gradient-to-r from-rose-600 to-pink-500 text-white font-extrabold shadow-sm shadow-rose-500/20',
      });
    }

    if (rawAny.isMustTry) {
      badges.push({
        label: 'MUST TRY',
        icon: '🔥',
        className: 'bg-gradient-to-r from-orange-600 to-amber-500 text-white font-extrabold shadow-sm shadow-orange-500/20',
      });
    }

    if (rawAny.isTrending) {
      badges.push({
        label: 'TRENDING',
        icon: '⚡',
        className: 'bg-gradient-to-r from-violet-600 to-purple-500 text-white font-extrabold shadow-sm shadow-violet-500/20',
      });
    }

    if (rawAny.isHealthyChoice) {
      badges.push({
        label: 'HEALTHY',
        icon: '🥗',
        className: 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-extrabold shadow-sm shadow-emerald-500/20',
      });
    }

    if (rawAny.isSeasonalSpecial) {
      badges.push({
        label: 'SEASONAL',
        icon: '🌟',
        className: 'bg-gradient-to-r from-amber-600 to-yellow-500 text-white font-extrabold shadow-sm shadow-amber-500/20',
      });
    }

    if (rawAny.isLimitedEdition) {
      badges.push({
        label: 'LIMITED BATCH',
        icon: '⏳',
        className: 'bg-zinc-800 text-amber-300 border border-amber-400/40 font-extrabold',
      });
    }

    if (rawAny.isHouseSpecialty) {
      badges.push({
        label: 'HOUSE SPECIAL',
        icon: '👑',
        className: 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white font-extrabold shadow-sm shadow-indigo-500/20',
      });
    }

    if (rawAny.isKidsFavorite) {
      badges.push({
        label: "KIDS' FAVORITE",
        icon: '👶',
        className: 'bg-gradient-to-r from-sky-500 to-blue-400 text-white font-extrabold shadow-sm shadow-sky-500/20',
      });
    }

    return badges;
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const rawAny = item as any;
      const isVeg = item.vegetarian || rawAny.foodType === 'veg' || rawAny.foodType === 'vegan';

      // Search match
      const queryMatch =
        searchQuery.trim() === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!queryMatch) return false;

      // Category filter
      if (selectedCategoryFilter !== 'all' && item.category !== selectedCategoryFilter) {
        return false;
      }

      // Dietary & Special filter
      if (dietFilter === 'veg' && !isVeg) return false;
      if (dietFilter === 'non-veg' && isVeg) return false;
      if (dietFilter === 'bestseller' && !checkIsBestSeller(item, menuItems)) return false;
      if (dietFilter === 'special' && !(rawAny.isChefSpecial || rawAny.isMustTry || rawAny.isTrending || rawAny.isHouseSpecialty)) return false;

      // Stock filter
      const inStock = item.available !== false;
      if (stockFilter === 'in-stock' && !inStock) return false;
      if (stockFilter === 'out-of-stock' && inStock) return false;

      return true;
    });
  }, [menuItems, searchQuery, selectedCategoryFilter, dietFilter, stockFilter]);

  const existingCategories = Array.from(new Set(menuItems.map((item) => item.category).filter(Boolean)));
  const categoriesInFiltered = Array.from(new Set(filteredItems.map((item) => item.category).filter(Boolean)));

  // Statistics
  const totalDishes = menuItems.length;
  const inStockCount = menuItems.filter((m) => m.available !== false).length;
  const outOfStockCount = totalDishes - inStockCount;
  const bestSellersCount = menuItems.filter((m) => checkIsBestSeller(m, menuItems)).length;
  const takeawayCount = menuItems.filter((m) => (m as any).isPickupAvailable !== false).length;

  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-pulse">
          <Utensils className="w-8 h-8 text-primary" />
        </div>
        <p className="text-muted-foreground font-semibold text-sm tracking-wide">Loading Menu Studio...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-8">
      {/* ── HERO & KPI STATS BAR ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl p-6 md:p-8 border border-border/80 bg-gradient-to-br from-card via-card/90 to-background shadow-xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Badge className="bg-primary/10 hover:bg-primary/15 text-primary border border-primary/25 px-3 py-1 font-bold text-xs rounded-full gap-1.5 shadow-xs">
                <Store className="w-3.5 h-3.5" />
                {restaurant?.name || 'Hunger Partner Kitchen'}
              </Badge>
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 font-bold text-xs rounded-full px-2.5 py-0.5">
                ● Live Catalog
              </Badge>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">
              Menu <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-500 to-amber-500">Studio</span>
            </h1>
            <p className="text-muted-foreground text-sm md:text-base max-w-2xl leading-relaxed">
              Manage your culinary creations, automatic algorithm badges, custom pricing, dietary classifications, and express takeaway availability.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setPickupDialogOpen(true)}
              className="h-12 px-5 rounded-2xl gap-2 border-border/80 bg-card hover:bg-muted font-bold text-foreground transition-all shadow-sm hover:shadow"
            >
              <ShoppingBag className="w-4 h-4 text-primary" />
              Pickup Settings
            </Button>

            <Button
              onClick={() => router.push('/restaurant/menu/new')}
              className="h-12 px-6 rounded-2xl gap-2.5 bg-gradient-to-r from-primary to-orange-500 text-primary-foreground hover:opacity-95 font-black text-base shadow-lg shadow-primary/25 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
              Add New Menu Item
            </Button>
          </div>
        </div>

        {/* Quick KPI Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 md:gap-4 mt-8 pt-6 border-t border-border/60">
          <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Dishes</p>
            <p className="text-2xl font-black text-foreground mt-0.5 font-mono">{totalDishes}</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">In Stock</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">{inStockCount}</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
            <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Out of Stock</p>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5 font-mono">{outOfStockCount}</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Bestsellers
            </p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5 font-mono">{bestSellersCount}</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 col-span-2 sm:col-span-1">
            <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
              <ShoppingBag className="w-3 h-3" /> Takeaway
            </p>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5 font-mono">{takeawayCount}</p>
          </div>
        </div>
      </div>

      {/* ── SEARCH, FILTER & VIEW CONTROLS ──────────────────────────────── */}
      <div className="sticky top-2 z-20 space-y-3 bg-background/90 backdrop-blur-2xl p-4 rounded-3xl border border-border/80 shadow-md">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search dishes by name, ingredients, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card border-border/80 h-11 pl-11 pr-10 rounded-2xl text-foreground placeholder:text-muted-foreground text-sm font-medium focus:border-primary shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filter Selectors & View Mode Switcher */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {/* Dietary Filter */}
            <div className="flex items-center p-1 bg-muted/40 border border-border/80 rounded-2xl">
              {[
                { id: 'all', label: 'All' },
                { id: 'veg', label: '🟢 Veg' },
                { id: 'non-veg', label: '🔴 Non-Veg' },
                { id: 'bestseller', label: '⭐ Bestseller' },
                { id: 'special', label: '👨‍🍳 Special' },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDietFilter(d.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    dietFilter === d.id
                      ? 'bg-card text-foreground shadow-xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* In-Stock Filter */}
            <div className="flex items-center p-1 bg-muted/40 border border-border/80 rounded-2xl">
              {[
                { id: 'all', label: 'All Stock' },
                { id: 'in-stock', label: 'In Stock' },
                { id: 'out-of-stock', label: 'Out of Stock' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStockFilter(s.id as any)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    stockFilter === s.id
                      ? 'bg-card text-foreground shadow-xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center p-1 bg-muted/40 border border-border/80 rounded-2xl">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="List Accordion View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Horizontal Filter Pills */}
        {existingCategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pt-1 no-scrollbar">
            <button
              onClick={() => setSelectedCategoryFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 border ${
                selectedCategoryFilter === 'all'
                  ? 'bg-foreground text-background border-foreground shadow-sm'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              All Categories ({menuItems.length})
            </button>
            {existingCategories.map((cat) => {
              const count = menuItems.filter((m) => m.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategoryFilter(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 border flex items-center gap-1.5 ${
                    selectedCategoryFilter === cat
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{cat}</span>
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MENU ITEMS DISPLAY ────────────────────────────────────────── */}
      {filteredItems.length === 0 ? (
        <Card className="py-24 text-center bg-card border-border/80 border-dashed rounded-3xl group shadow-sm">
          <div className="w-20 h-20 mx-auto bg-primary/10 rounded-3xl flex items-center justify-center mb-5 ring-1 ring-primary/20">
            <Utensils className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-2xl font-black text-foreground mb-2">No Dishes Match Your Search</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm leading-relaxed">
            {searchQuery || dietFilter !== 'all' || stockFilter !== 'all' || selectedCategoryFilter !== 'all'
              ? 'Try resetting your search query or filters to view all menu items.'
              : 'Your culinary catalog is currently empty. Add your first signature dish to start receiving live orders!'}
          </p>
          <div className="flex justify-center gap-3">
            {(searchQuery || dietFilter !== 'all' || stockFilter !== 'all' || selectedCategoryFilter !== 'all') && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setDietFilter('all');
                  setStockFilter('all');
                  setSelectedCategoryFilter('all');
                }}
                className="rounded-2xl px-6 h-11 text-xs font-bold"
              >
                Reset Filters
              </Button>
            )}
            <Button
              onClick={() => router.push('/restaurant/menu/new')}
              className="bg-primary text-primary-foreground font-black rounded-2xl px-7 h-11 text-xs shadow-lg hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add First Dish
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {categoriesInFiltered.map((category) => {
            const categoryItems = filteredItems.filter((item) => item.category === category);
            const isExpanded = expandedCategory === category || categoriesInFiltered.length === 1;

            return (
              <div
                key={category}
                className="overflow-hidden rounded-3xl border border-border/80 bg-card/70 backdrop-blur-xl transition-all shadow-md"
              >
                {/* Category Header */}
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : category)}
                  className="w-full p-5 md:p-6 flex items-center justify-between bg-card hover:bg-muted/15 transition-colors border-b border-border/60"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-9 rounded-full bg-gradient-to-b from-primary to-orange-500" />
                    <div className="text-left">
                      <div className="flex items-center gap-2.5">
                        <h3 className="font-black text-foreground text-xl md:text-2xl tracking-tight">
                          {category}
                        </h3>
                        <Badge variant="outline" className="text-xs font-mono font-bold bg-muted/40 border-border">
                          {categoryItems.length} {categoryItems.length === 1 ? 'item' : 'items'}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {categoryItems.filter((i) => i.available !== false).length} currently in stock
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-10 h-10 rounded-2xl border border-border flex items-center justify-center bg-muted/40 transition-transform duration-300 ${
                      isExpanded ? 'rotate-180 bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground'
                    }`}
                  >
                    <ChevronDown className="w-5 h-5" />
                  </div>
                </button>

                {/* Items in Category */}
                {isExpanded && (
                  <div className="p-4 md:p-6">
                    {viewMode === 'grid' ? (
                      /* ── GRID CARDS VIEW ──────────────────────────────── */
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {categoryItems.map((item) => {
                          const rawAny = item as any;
                          const isVeg = item.vegetarian || rawAny.foodType === 'veg' || rawAny.foodType === 'vegan';
                          const originalPrice = rawAny.originalPrice;
                          const badges = getDishBadges(item);
                          const isInStock = item.available !== false;

                          return (
                            <div
                              key={item.id}
                              className={`group relative rounded-3xl overflow-hidden border transition-all duration-300 flex flex-col justify-between bg-card hover:shadow-xl ${
                                isInStock
                                  ? 'border-border/80 hover:border-primary/40'
                                  : 'border-border/60 opacity-80 bg-muted/20'
                              }`}
                            >
                              <div>
                                {/* Dish Image Container */}
                                <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                                  {item.image ? (
                                    <img
                                      src={item.image}
                                      alt={item.name}
                                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-muted">
                                      <ImageIcon className="w-12 h-12 text-muted-foreground" />
                                    </div>
                                  )}

                                  {/* Top Left Veg / Non-Veg Icon + Video Badge */}
                                  <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                                    <span
                                      className={`w-6 h-6 rounded-lg bg-card/95 backdrop-blur-md border flex items-center justify-center shadow-md ${
                                        isVeg ? 'border-emerald-600' : 'border-red-600'
                                      }`}
                                      title={isVeg ? 'Vegetarian Dish' : 'Non-Vegetarian Dish'}
                                    >
                                      <span
                                        className={`w-3 h-3 rounded-full ${
                                          isVeg ? 'bg-emerald-600' : 'bg-red-600'
                                        }`}
                                      />
                                    </span>
                                    {(rawAny.videoUrl || (Array.isArray(rawAny.videos) && rawAny.videos.length > 0)) && (
                                      <span className="px-2 py-0.5 rounded-lg bg-black/75 text-white text-[10px] font-bold flex items-center gap-1 shadow-md">
                                        <Video className="w-3 h-3 text-primary" /> Video
                                      </span>
                                    )}
                                  </div>

                                  {/* Badges on Top Right Image */}
                                  <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5 max-w-[70%]">
                                    {badges.map((b, idx) => (
                                      <span
                                        key={idx}
                                        className={`px-2.5 py-1 rounded-full text-[10px] tracking-wider uppercase flex items-center gap-1 ${b.className}`}
                                      >
                                        <span>{b.icon}</span>
                                        <span>{b.label}</span>
                                      </span>
                                    ))}
                                  </div>

                                  {/* Bottom Gradient overlay */}
                                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/75 to-transparent pointer-events-none" />

                                  {/* Bottom Overlay Price */}
                                  <div className="absolute bottom-2.5 left-3 right-3 flex items-baseline justify-between z-10 text-white">
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-xl font-black font-mono tracking-tight drop-shadow-md">
                                        ₹{item.price}
                                      </span>
                                      {originalPrice && originalPrice > item.price && (
                                        <span className="text-xs line-through text-white/70 font-mono">
                                          ₹{originalPrice}
                                        </span>
                                      )}
                                    </div>
                                    {originalPrice && originalPrice > item.price && (
                                      <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow-sm">
                                        {Math.round(((originalPrice - item.price) / originalPrice) * 100)}% OFF
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Content Details */}
                                <div className="p-4 space-y-3">
                                  <div>
                                    <h4 className="font-black text-foreground text-base tracking-tight group-hover:text-primary transition-colors line-clamp-1">
                                      {item.name}
                                    </h4>
                                    <p className="text-muted-foreground text-xs line-clamp-2 mt-1 leading-relaxed">
                                      {item.description || 'Freshly prepared signature dish.'}
                                    </p>
                                  </div>

                                  {/* Meta tags */}
                                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-muted-foreground">
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted/60 border border-border/60">
                                      <Clock className="w-3 h-3 text-primary" /> {item.preparationTime || 30}m
                                    </span>
                                    {item.servings && (
                                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted/60 border border-border/60">
                                        <Users className="w-3 h-3" /> Serves {item.servings}
                                      </span>
                                    )}
                                    {rawAny.isPickupAvailable && (
                                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                                        <ShoppingBag className="w-3 h-3" /> Takeaway
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Footer Card Actions */}
                              <div className="p-4 pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                                {/* Fast Stock Switch */}
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={isInStock}
                                    onCheckedChange={() => handleToggleItemAvailability(item)}
                                    aria-label="Toggle dish stock availability"
                                  />
                                  <span className={`text-xs font-bold ${isInStock ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                                    {isInStock ? 'In Stock' : 'Out of Stock'}
                                  </span>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteItem(item.id || '')}
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
                                    title="Delete dish"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.push(`/restaurant/menu/${item.id}/edit`)}
                                    className="h-8 px-3 rounded-xl text-xs font-bold border-border/80 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
                                  >
                                    <Edit2 className="w-3 h-3 mr-1" /> Edit
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* ── COMPACT LIST VIEW ────────────────────────────── */
                      <div className="space-y-3">
                        {categoryItems.map((item) => {
                          const rawAny = item as any;
                          const isVeg = item.vegetarian || rawAny.foodType === 'veg' || rawAny.foodType === 'vegan';
                          const originalPrice = rawAny.originalPrice;
                          const badges = getDishBadges(item);
                          const isInStock = item.available !== false;

                          return (
                            <div
                              key={item.id}
                              className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card hover:bg-muted/15 ${
                                isInStock ? 'border-border/80' : 'border-border/60 opacity-80'
                              }`}
                            >
                              <div className="flex items-center gap-4 min-w-0 flex-1">
                                {/* Thumbnail */}
                                <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-muted border border-border">
                                  {item.image ? (
                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <ImageIcon className="w-6 h-6 m-auto text-muted-foreground" />
                                  )}
                                  <span
                                    className={`absolute top-1 left-1 w-3 h-3 rounded-full border border-card ${
                                      isVeg ? 'bg-emerald-600' : 'bg-red-600'
                                    }`}
                                  />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                    <h4 className="font-bold text-foreground text-sm truncate">{item.name}</h4>
                                    {badges.map((b, idx) => (
                                      <span
                                        key={idx}
                                        className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold flex items-center gap-1 ${b.className}`}
                                      >
                                        <span>{b.icon}</span>
                                        <span>{b.label}</span>
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-muted-foreground text-xs line-clamp-1">{item.description}</p>
                                </div>
                              </div>

                              {/* Price & Actions */}
                              <div className="flex items-center justify-between md:justify-end gap-5 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-border/60">
                                <div className="text-right">
                                  <p className="text-base font-black font-mono text-foreground">₹{item.price}</p>
                                  {originalPrice && originalPrice > item.price && (
                                    <p className="text-[10px] text-muted-foreground line-through font-mono">₹{originalPrice}</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={isInStock}
                                    onCheckedChange={() => handleToggleItemAvailability(item)}
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.push(`/restaurant/menu/${item.id}/edit`)}
                                    className="h-8 px-3 rounded-xl text-xs font-bold"
                                  >
                                    <Edit2 className="w-3 h-3 mr-1" /> Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteItem(item.id || '')}
                                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 rounded-xl"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── PICKUP & TAKEAWAY CONFIGURATION DIALOG ─────────────────────── */}
      <Dialog open={pickupDialogOpen} onOpenChange={setPickupDialogOpen}>
        <DialogContent className="max-w-xl bg-card border-border text-card-foreground shadow-2xl p-6 rounded-3xl">
          <DialogHeader className="pb-3 border-b border-border">
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-primary" /> Pickup & Takeaway Settings
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Manage how customers order for self-pickup from your restaurant counter.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="p-4 rounded-2xl border border-border bg-muted/20 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-foreground text-sm">Enable Self-Pickup (Takeaway)</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Customers can choose Takeaway at checkout to collect food directly.
                </p>
              </div>
              <Switch
                checked={pickupSettings.isPickupEnabled}
                onCheckedChange={(c) => setPickupSettings({ ...pickupSettings, isPickupEnabled: Boolean(c) })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">Standard Pickup Preparation Time</Label>
              <div className="grid grid-cols-4 gap-2">
                {[15, 20, 30, 45].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setPickupSettings({ ...pickupSettings, defaultPickupTime: mins })}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                      pickupSettings.defaultPickupTime === mins
                        ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {mins} mins
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="counter" className="text-xs font-bold text-foreground">Pickup Counter Spot</Label>
              <Input
                id="counter"
                placeholder="e.g. Express Online Pickup Window #1"
                value={pickupSettings.pickupCounter}
                onChange={(e) => setPickupSettings({ ...pickupSettings, pickupCounter: e.target.value })}
                className="bg-card border-border h-11 text-xs rounded-2xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="instructions" className="text-xs font-bold text-foreground">Customer Pickup Instructions</Label>
              <Textarea
                id="instructions"
                placeholder="e.g. Show digital Order OTP at the pickup window. No waiting in the dine-in queue."
                value={pickupSettings.pickupInstructions}
                onChange={(e) => setPickupSettings({ ...pickupSettings, pickupInstructions: e.target.value })}
                className="bg-card border-border text-xs rounded-2xl min-h-[75px] resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="packaging" className="text-xs font-bold text-foreground">Takeaway Packaging Fee (₹)</Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">₹</span>
                <Input
                  id="packaging"
                  type="number"
                  placeholder="0"
                  value={pickupSettings.packagingFee}
                  onChange={(e) =>
                    setPickupSettings({ ...pickupSettings, packagingFee: parseFloat(e.target.value) || 0 })
                  }
                  className="bg-card border-border h-11 pl-8 text-xs rounded-2xl font-mono"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Keep ₹0 for free customer takeaway packaging.</p>
            </div>

            <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-primary/20 bg-primary/5 cursor-pointer">
              <Checkbox
                checked={pickupSettings.applyToAllItems}
                onCheckedChange={(c) => setPickupSettings({ ...pickupSettings, applyToAllItems: !!c })}
                className="mt-0.5 h-4 w-4 data-[state=checked]:bg-primary"
              />
              <div>
                <p className="font-bold text-xs text-foreground">Apply Pickup availability to all menu items</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Synchronizes all dishes to be available for self-pickup with this prep time.
                </p>
              </div>
            </label>
          </div>

          <DialogFooter className="pt-3 border-t border-border flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setPickupDialogOpen(false)}
              className="rounded-2xl h-11 px-5 text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePickupSettings}
              disabled={savingPickupSettings}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl h-11 px-6 text-xs font-bold shadow-md"
            >
              {savingPickupSettings && <Spinner className="mr-2 h-3.5 w-3.5" />}
              {savingPickupSettings ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
