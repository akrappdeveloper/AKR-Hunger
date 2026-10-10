'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MenuItem, Restaurant, CartItem } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import SafeImage from '@/components/ui/safe-image';
import CustomerSearchBar from '@/components/customer/CustomerSearchBar';
import SmartMealFinder from '@/components/customer/SmartMealFinder';
import RestaurantCard from '@/components/customer/RestaurantCard';
import { MealIntent } from '@/lib/hunger-types-client';
import {
  Search,
  Clock,
  Star,
  X,
  Flame,
  Sparkles,
  Trash2,
  ArrowUpRight,
  ShoppingBag,
  SlidersHorizontal,
  ArrowUpDown,
  LayoutGrid,
  List,
  Store,
  Utensils,
  Plus,
  Minus,
  Check,
  ChevronDown,
  Percent,
  Timer,
  Navigation,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const TRENDING_TAGS = [
  'Dum Biryani',
  'Woodfired Pizza',
  'Truffle Burger',
  'Butter Chicken',
  'Cold Brew',
  'Crispy Dimsum',
  'Hakka Noodles',
  'Sizzling Brownie',
];

const POPULAR_CUISINES = [
  { name: 'Pizza', img: '🍕', bg: 'bg-orange-500/10 border-orange-500/25 text-orange-600 dark:text-orange-400' },
  { name: 'Burger', img: '🍔', bg: 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400' },
  { name: 'Biryani', img: '🍲', bg: 'bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-400' },
  { name: 'Chinese', img: '🍜', bg: 'bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400' },
  { name: 'Dessert', img: '🍰', bg: 'bg-pink-500/10 border-pink-500/25 text-pink-600 dark:text-pink-400' },
  { name: 'Healthy', img: '🥗', bg: 'bg-green-500/10 border-green-500/25 text-green-600 dark:text-green-400' },
  { name: 'Drinks', img: '🥤', bg: 'bg-purple-500/10 border-purple-500/25 text-purple-600 dark:text-purple-400' },
  { name: 'Rolls', img: '🌯', bg: 'bg-cyan-500/10 border-cyan-500/25 text-cyan-600 dark:text-cyan-400' },
];

type SortOption = 'relevance' | 'rating-desc' | 'delivery-fast' | 'price-asc' | 'price-desc';

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const { items: cartItems, addItem, updateQuantity, removeItem } = useCart();

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [dishResults, setDishResults] = useState<MenuItem[]>([]);
  const [restaurantResults, setRestaurantResults] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Tab & Filters State
  const [searchTab, setSearchTab] = useState<'all' | 'dishes' | 'restaurants'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [filterVegOnly, setFilterVegOnly] = useState(false);
  const [filterNonVegOnly, setFilterNonVegOnly] = useState(false);
  const [filterRating4Plus, setFilterRating4Plus] = useState(false);
  const [filterFastDelivery, setFilterFastDelivery] = useState(false);
  const [filterUnder250, setFilterUnder250] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const saved = localStorage.getItem('recentSearches_v2') || localStorage.getItem('recentSearches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved).slice(0, 8));
      } catch (_) { }
    }
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  const performSearch = async (term: string) => {
    if (!term.trim()) return;

    setLoading(true);
    try {
      const lower = term.toLowerCase().trim();

      // 1. Query Menu Items
      const menuSnap = await getDocs(query(collection(db, 'menuItems')));
      const allDishes = menuSnap.docs.map((d) => ({ ...d.data(), id: d.id } as MenuItem));
      const matchedDishes = allDishes.filter((item) => {
        const name = (item.name || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        const tags = Array.isArray(item.tags) ? item.tags.join(' ').toLowerCase() : '';
        return (
          name.includes(lower) ||
          desc.includes(lower) ||
          cat.includes(lower) ||
          tags.includes(lower)
        );
      });

      // 2. Query Restaurants
      const restSnap = await getDocs(query(collection(db, 'restaurants')));
      const allRestaurants = restSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Restaurant));
      const matchedRestaurants = allRestaurants.filter((rest) => {
        const name = (rest.name || '').toLowerCase();
        const desc = (rest.description || '').toLowerCase();
        const cuisines = Array.isArray(rest.cuisineType)
          ? rest.cuisineType.join(' ').toLowerCase()
          : '';
        return (
          name.includes(lower) ||
          desc.includes(lower) ||
          cuisines.includes(lower)
        );
      });

      setDishResults(matchedDishes);
      setRestaurantResults(matchedRestaurants);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Error fetching search results');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTag = (term: string) => {
    setSearchQuery(term);
    performSearch(term);
    router.replace(`/customer/search?q=${encodeURIComponent(term)}`);
  };

  const clearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches_v2');
    localStorage.removeItem('recentSearches');
  };

  // Filter and Sort Dishes
  const filteredDishes = useMemo(() => {
    let list = [...dishResults];

    if (filterVegOnly) list = list.filter((i) => i.vegetarian);
    if (filterNonVegOnly) list = list.filter((i) => !i.vegetarian);
    if (filterRating4Plus) list = list.filter((i) => (i.averageRating || 0) >= 4.0);
    if (filterFastDelivery) list = list.filter((i) => (i.preparationTime || 25) <= 25);
    if (filterUnder250) list = list.filter((i) => (i.price || 0) <= 250);

    // Sorting
    switch (sortBy) {
      case 'rating-desc':
        list.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
        break;
      case 'price-asc':
        list.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price-desc':
        list.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'delivery-fast':
        list.sort((a, b) => (a.preparationTime || 25) - (b.preparationTime || 25));
        break;
      default:
        break;
    }

    return list;
  }, [
    dishResults,
    filterVegOnly,
    filterNonVegOnly,
    filterRating4Plus,
    filterFastDelivery,
    filterUnder250,
    sortBy,
  ]);

  // Filter and Sort Restaurants
  const filteredRestaurants = useMemo(() => {
    let list = [...restaurantResults];

    if (filterRating4Plus) list = list.filter((r) => (r.rating || 0) >= 4.0);
    if (filterFastDelivery) list = list.filter((r) => (r.deliveryTime || 30) <= 30);

    if (sortBy === 'rating-desc') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'delivery-fast') {
      list.sort((a, b) => (a.deliveryTime || 30) - (b.deliveryTime || 30));
    }

    return list;
  }, [restaurantResults, filterRating4Plus, filterFastDelivery, sortBy]);

  // Cart Helper
  const getCartQuantity = (dishId: string) => {
    const found = cartItems.find((ci) => ci.id === dishId);
    return found ? found.quantity : 0;
  };

  const handleAddToCart = (dish: MenuItem) => {
    const cartItem: CartItem = {
      id: dish.id || `dish-${Date.now()}`,
      menuItemId: dish.id || '',
      restaurantId: dish.restaurantId || 'unknown',
      restaurantName: 'Restaurant',
      name: dish.name,
      price: dish.price || 0,
      quantity: 1,
      image: dish.image,
      addedAt: new Date(),
    };
    addItem(cartItem);
    toast.success(`Added ${dish.name} to cart!`);
  };

  const hasSearch = searchQuery.trim().length > 0;
  const totalResultsCount = filteredDishes.length + filteredRestaurants.length;

  const sortLabels: Record<SortOption, string> = {
    relevance: 'Relevance',
    'rating-desc': 'Rating: High to Low',
    'delivery-fast': 'Fastest Delivery',
    'price-asc': 'Price: Low to High',
    'price-desc': 'Price: High to Low',
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-40 sm:pb-24 font-sans selection:bg-primary/20">
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10 space-y-6">
        {/* Search Bar Header */}
        <div className="space-y-4">
          <CustomerSearchBar
            placeholder="Search dishes, restaurants, cuisines or snacks..."
            size="lg"
            initialValue={searchQuery}
            onSearch={(term) => {
              setSearchQuery(term);
              performSearch(term);
              router.replace(`/customer/search?q=${encodeURIComponent(term)}`);
            }}
          />
        </div>

        {/* ── HUNGER SMART MEAL AI CARD ── */}
        <div className="rounded-2xl border border-orange-500/25 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3.5">
            <span className="text-xl">✨</span>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-foreground">Hunger Smart Meal</h2>
              <p className="text-xs text-muted-foreground">Tell us what you want in plain language (e.g. &ldquo;₹200 ke andar spicy veg&rdquo;)</p>
            </div>
          </div>
          <SmartMealFinder
            onResults={(intent: MealIntent, q: string) => {
              const term = q || intent.query || '';
              if (term) {
                setSearchQuery(term);
                performSearch(term);
                router.replace(`/customer/search?q=${encodeURIComponent(term)}`);
              }
            }}
          />
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="space-y-4">
            <div className="h-10 w-64 bg-muted/60 rounded-xl animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-64 bg-muted/40 rounded-3xl animate-pulse border border-border/50" />
              ))}
            </div>
          </div>
        ) : hasSearch ? (
          /* Active Results State */
          <div className="space-y-6">
            {/* Results Filter & Sort Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-3xl bg-card border border-border/70 shadow-sm">
              {/* Tab Selector (All / Dishes / Restaurants) */}
              <div className="flex items-center gap-1.5 p-1 bg-muted/70 rounded-2xl self-start">
                <button
                  onClick={() => setSearchTab('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${searchTab === 'all'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  All ({totalResultsCount})
                </button>
                <button
                  onClick={() => setSearchTab('dishes')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${searchTab === 'dishes'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <Utensils className="w-3.5 h-3.5" />
                  Dishes ({filteredDishes.length})
                </button>
                <button
                  onClick={() => setSearchTab('restaurants')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${searchTab === 'restaurants'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  Restaurants ({filteredRestaurants.length})
                </button>
              </div>

              {/* Quick Filter Chips & Sort Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Pure Veg Toggle */}
                <button
                  onClick={() => {
                    setFilterVegOnly(!filterVegOnly);
                    if (!filterVegOnly) setFilterNonVegOnly(false);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-full font-bold border transition-all flex items-center gap-1.5 ${filterVegOnly
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500 shadow-sm'
                    : 'bg-muted/50 border-border/60 text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Pure Veg
                </button>

                {/* Non-Veg Toggle */}
                <button
                  onClick={() => {
                    setFilterNonVegOnly(!filterNonVegOnly);
                    if (!filterNonVegOnly) setFilterVegOnly(false);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-full font-bold border transition-all flex items-center gap-1.5 ${filterNonVegOnly
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500 shadow-sm'
                    : 'bg-muted/50 border-border/60 text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <span className="w-2 h-2 rounded-full bg-red-500" /> Non-Veg
                </button>

                {/* 4.0+ Stars Filter */}
                <button
                  onClick={() => setFilterRating4Plus(!filterRating4Plus)}
                  className={`text-xs px-3 py-1.5 rounded-full font-bold border transition-all flex items-center gap-1 ${filterRating4Plus
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500 shadow-sm'
                    : 'bg-muted/50 border-border/60 text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <Star className="w-3 h-3 fill-current" /> 4.0+ Rated
                </button>

                {/* Fast Delivery */}
                <button
                  onClick={() => setFilterFastDelivery(!filterFastDelivery)}
                  className={`text-xs px-3 py-1.5 rounded-full font-bold border transition-all flex items-center gap-1 ${filterFastDelivery
                    ? 'bg-primary/10 text-primary border-primary shadow-sm'
                    : 'bg-muted/50 border-border/60 text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <Timer className="w-3 h-3" /> Under 25 Mins
                </button>

                {/* Under ₹250 */}
                <button
                  onClick={() => setFilterUnder250(!filterUnder250)}
                  className={`text-xs px-3 py-1.5 rounded-full font-bold border transition-all ${filterUnder250
                    ? 'bg-primary/10 text-primary border-primary shadow-sm'
                    : 'bg-muted/50 border-border/60 text-muted-foreground hover:text-foreground'
                    }`}
                >
                  Under ₹250
                </button>

                {/* Sort Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-2xl text-xs gap-1.5 font-bold h-8">
                      <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{sortLabels[sortBy]}</span>
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-2xl w-48 shadow-xl">
                    {(Object.keys(sortLabels) as SortOption[]).map((key) => (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => setSortBy(key)}
                        className={`text-xs font-semibold cursor-pointer rounded-xl ${sortBy === key ? 'text-primary font-bold bg-primary/10' : ''
                          }`}
                      >
                        {sortLabels[key]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Grid / List View Toggle */}
                <div className="hidden sm:flex items-center p-1 bg-muted/60 rounded-xl border border-border/60">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                      }`}
                    title="Grid View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                      }`}
                    title="List View"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Total Results Summary */}
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <p>
                Showing results for <strong className="text-foreground">&ldquo;{searchQuery}&rdquo;</strong>
              </p>
              {(filterVegOnly || filterNonVegOnly || filterRating4Plus || filterFastDelivery || filterUnder250) && (
                <button
                  onClick={() => {
                    setFilterVegOnly(false);
                    setFilterNonVegOnly(false);
                    setFilterRating4Plus(false);
                    setFilterFastDelivery(false);
                    setFilterUnder250(false);
                  }}
                  className="text-primary hover:underline font-bold"
                >
                  Clear all filters
                </button>
              )}
            </div>

            {/* Section 1: Restaurants (if applicable) */}
            {(searchTab === 'all' || searchTab === 'restaurants') && filteredRestaurants.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                  <Store className="w-5 h-5 text-orange-500" /> Restaurants ({filteredRestaurants.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {filteredRestaurants.map((rest) => (
                    <RestaurantCard
                      key={rest.id}
                      restaurant={rest}
                      variant="grid"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Section 2: Dishes */}
            {(searchTab === 'all' || searchTab === 'dishes') && filteredDishes.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-primary" /> Dishes ({filteredDishes.length})
                </h3>

                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6'
                      : 'space-y-3 max-w-4xl'
                  }
                >
                  {filteredDishes.map((dish) => {
                    const inCartCount = getCartQuantity(dish.id || '');

                    return viewMode === 'grid' ? (
                      /* Grid Card */
                      <div
                        key={dish.id}
                        className="rounded-3xl border border-border/70 bg-card hover:border-primary/50 hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between group"
                      >
                        <div className="relative h-44 w-full bg-muted overflow-hidden">
                          {dish.image ? (
                            <SafeImage
                              src={dish.image}
                              alt={dish.name}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-4xl">🍲</div>
                          )}

                          {/* Top Badges */}
                          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                            <span
                              className={`w-4 h-4 rounded-md border-2 flex items-center justify-center bg-white/90 shadow-sm ${dish.vegetarian ? 'border-emerald-600' : 'border-red-600'
                                }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${dish.vegetarian ? 'bg-emerald-600' : 'bg-red-600'
                                  }`}
                              />
                            </span>

                            {dish.averageRating && (
                              <Badge className="bg-black/60 backdrop-blur-md text-white border-0 text-[11px] font-black gap-1">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                {dish.averageRating.toFixed(1)}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Details */}
                        <div className="p-4 flex flex-col justify-between flex-1">
                          <div className="space-y-1 mb-3">
                            <h4 className="font-black text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                              {dish.name}
                            </h4>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {dish.description || 'Delicious culinary preparation crafted with fresh spices.'}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                            <span className="text-lg font-black text-foreground">₹{dish.price}</span>

                            {/* Cart Action Buttons */}
                            {inCartCount > 0 ? (
                              <div className="flex items-center gap-2 bg-primary text-primary-foreground rounded-2xl px-2 py-1 shadow-md">
                                <button
                                  onClick={() => updateQuantity(dish.id || '', inCartCount - 1)}
                                  className="w-5 h-5 flex items-center justify-center hover:opacity-80"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="font-black text-xs min-w-[12px] text-center">
                                  {inCartCount}
                                </span>
                                <button
                                  onClick={() => updateQuantity(dish.id || '', inCartCount + 1)}
                                  className="w-5 h-5 flex items-center justify-center hover:opacity-80"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleAddToCart(dish)}
                                className="rounded-xl px-3.5 h-8 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" /> Add
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* List View Row */
                      <div
                        key={dish.id}
                        className="rounded-3xl border border-border/70 bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-muted flex-shrink-0">
                            {dish.image ? (
                              <SafeImage src={dish.image} alt={dish.name} fill className="object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-2xl">🍲</div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center ${dish.vegetarian ? 'border-emerald-600' : 'border-red-600'
                                  }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${dish.vegetarian ? 'bg-emerald-600' : 'bg-red-600'
                                    }`}
                                />
                              </span>
                              <h4 className="font-bold text-base text-foreground truncate">{dish.name}</h4>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1">{dish.description}</p>
                            <span className="text-sm font-black text-foreground mt-1 block">₹{dish.price}</span>
                          </div>
                        </div>

                        {/* Add to Cart button */}
                        <div className="flex-shrink-0">
                          {inCartCount > 0 ? (
                            <div className="flex items-center gap-2 bg-primary text-primary-foreground rounded-2xl px-2.5 py-1.5 shadow-md">
                              <button
                                onClick={() => updateQuantity(dish.id || '', inCartCount - 1)}
                                className="w-5 h-5 flex items-center justify-center hover:opacity-80"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="font-black text-xs min-w-[12px] text-center">
                                {inCartCount}
                              </span>
                              <button
                                onClick={() => updateQuantity(dish.id || '', inCartCount + 1)}
                                className="w-5 h-5 flex items-center justify-center hover:opacity-80"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleAddToCart(dish)}
                              className="rounded-xl px-4 h-9 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Zero Results State */}
            {totalResultsCount === 0 && (
              <div className="text-center py-16 bg-card rounded-3xl border border-border/80 p-8 space-y-4 max-w-lg mx-auto">
                <div className="w-20 h-20 bg-muted/80 rounded-full flex items-center justify-center mx-auto text-muted-foreground">
                  <Search className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-foreground">No culinary match found</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  We couldn't find items matching &ldquo;{searchQuery}&rdquo;. Try clearing filters or try our trending picks below.
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {TRENDING_TAGS.slice(0, 5).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleSelectTag(tag)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      Try &ldquo;{tag}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty Search - Discovery View */
          <div className="space-y-10">
            {/* Recent Searches Header */}
            {recentSearches.length > 0 && (
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <h3 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Recent Searches
                  </h3>
                  <div className="flex items-center gap-3">
                    <Link
                      href="/customer/search/history"
                      className="text-xs text-primary hover:underline font-bold flex items-center gap-1"
                    >
                      View Full History &rarr;
                    </Link>
                    <button
                      type="button"
                      onClick={clearRecent}
                      className="text-xs text-destructive hover:underline font-bold uppercase tracking-wider flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Clear
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectTag(term)}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-card border border-border/80 rounded-xl text-xs sm:text-sm font-semibold text-foreground hover:bg-muted hover:border-primary/40 transition-all shadow-sm"
                    >
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{term}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Popular Cuisines Carousel / Grid */}
            <div className="space-y-3">
              <h3 className="font-black text-lg text-foreground flex items-center gap-2 px-1">
                <Sparkles className="w-4 h-4 text-amber-500" /> Popular Cuisines
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
                {POPULAR_CUISINES.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => handleSelectTag(c.name)}
                    className="p-3.5 rounded-2xl bg-card border border-border/70 hover:border-primary/50 hover:shadow-lg transition-all flex flex-col items-center justify-center gap-2 group"
                  >
                    <span className="text-3xl group-hover:scale-110 transition-transform">{c.img}</span>
                    <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                      {c.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Trending Food Tags */}
            <div className="space-y-3">
              <h3 className="font-black text-lg text-foreground flex items-center gap-2 px-1">
                <Flame className="w-4 h-4 text-orange-500" /> Trending Dishes Today
              </h3>
              <div className="flex flex-wrap gap-2">
                {TRENDING_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleSelectTag(tag)}
                    className="text-xs px-3.5 py-2 rounded-2xl bg-muted/60 hover:bg-primary/10 hover:text-primary border border-border/60 text-foreground transition-all font-semibold flex items-center gap-1.5"
                  >
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    <span>{tag}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
