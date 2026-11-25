'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Restaurant, MenuItem, CartItem } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import RestaurantCard from '@/components/customer/RestaurantCard';
import FullscreenToggle from '@/components/customer/FullscreenToggle';
import {
  ArrowLeft, ChefHat, Store, Star, Clock, Utensils,
  Search, Leaf, Flame, ShoppingCart, Check, X,
  SlidersHorizontal, Sparkles, Filter, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// Standard known cuisines with vibrant icons and styling
interface CuisineMeta {
  id: string;
  name: string;
  icon: string;
  gradient: string;
  desc: string;
  category: string;
}

const DEFAULT_CUISINES: CuisineMeta[] = [
  { id: 'north-indian', name: 'North Indian', icon: '🍛', gradient: 'from-orange-500 to-red-600', desc: 'Rich curries, tandoori, naan & biryanis', category: 'Indian' },
  { id: 'south-indian', name: 'South Indian', icon: '🥞', gradient: 'from-amber-500 to-yellow-600', desc: 'Crispy dosas, fluffy idlis, sambar & filter coffee', category: 'Indian' },
  { id: 'biryani', name: 'Biryani', icon: '🍲', gradient: 'from-red-600 to-amber-600', desc: 'Aromatic basmati rice cooked with dum spices & tender cuts', category: 'Indian' },
  { id: 'chinese', name: 'Chinese', icon: '🍜', gradient: 'from-red-500 to-rose-600', desc: 'Wok tossed noodles, manchurian, fried rice & dim sums', category: 'Asian' },
  { id: 'italian', name: 'Italian', icon: '🍕', gradient: 'from-green-600 to-emerald-600', desc: 'Stone-baked pizzas, artisanal pastas & risottos', category: 'Continental' },
  { id: 'mughlai', name: 'Mughlai', icon: '🍗', gradient: 'from-amber-600 to-orange-700', desc: 'Royal kebabs, rich shahi kormas & tender nihari', category: 'Indian' },
  { id: 'burgers-fast-food', name: 'Burgers & Fast Food', icon: '🍔', gradient: 'from-amber-500 to-red-500', desc: 'Smash burgers, loaded crinkle fries & crispy wings', category: 'Fast Food' },
  { id: 'street-food', name: 'Street Food', icon: '🥘', gradient: 'from-red-600 to-orange-600', desc: 'Pani puri, samosas, chaats & spicy street bites', category: 'Indian' },
  { id: 'continental', name: 'Continental', icon: '🥩', gradient: 'from-blue-600 to-indigo-600', desc: 'Grilled steaks, creamy bakes, gourmet salads & toasts', category: 'Continental' },
  { id: 'desserts', name: 'Desserts & Sweets', icon: '🍰', gradient: 'from-pink-500 to-fuchsia-600', desc: 'Decadent cakes, ice creams, warm gulab jamuns & pastries', category: 'Dessert' },
  { id: 'healthy', name: 'Healthy & Diet', icon: '🥗', gradient: 'from-emerald-500 to-teal-600', desc: 'High-protein grain bowls, superfood salads & detox smoothies', category: 'Healthy' },
  { id: 'beverages', name: 'Beverages & Shakes', icon: '🥤', gradient: 'from-purple-500 to-violet-600', desc: 'Thick milkshakes, artisanal cold brews, fresh juices & boba', category: 'Beverage' },
  { id: 'bakery', name: 'Bakery & Cafe', icon: '🥐', gradient: 'from-yellow-500 to-amber-600', desc: 'Buttery croissants, sourdough loaves, cookies & muffins', category: 'Bakery' },
  { id: 'japanese', name: 'Japanese & Sushi', icon: '🍣', gradient: 'from-rose-500 to-red-600', desc: 'Fresh maki rolls, savory ramen bowls & crispy tempura', category: 'Asian' },
  { id: 'thai', name: 'Thai', icon: '🍲', gradient: 'from-lime-600 to-green-600', desc: 'Fragrant green curries, pad thai noodles & tom yum soup', category: 'Asian' },
  { id: 'korean', name: 'Korean', icon: '🍱', gradient: 'from-red-500 to-amber-600', desc: 'Korean fried chicken, spicy tteokbokki & bibimbap bowls', category: 'Asian' },
  { id: 'mexican', name: 'Mexican', icon: '🌮', gradient: 'from-yellow-500 to-red-500', desc: 'Stuffed burritos, crunchy tacos, nachos & cheesy quesadillas', category: 'Continental' },
  { id: 'seafood', name: 'Seafood', icon: '🦐', gradient: 'from-cyan-500 to-blue-600', desc: 'Fresh coastal curries, butter garlic prawns & fish fry', category: 'Regional' },
];

export default function CuisineExplorerPage() {
  const { addItem, items: cartItems } = useCart();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'restaurants' | 'dishes'>('all');
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'time' | 'price_low' | 'price_high'>('popular');
  const [addedItemIds, setAddedItemIds] = useState<Set<string>>(new Set());

  // Real-time Firestore sync for Restaurants & Menu Items
  useEffect(() => {
    const unsubRestaurants = onSnapshot(collection(db, 'restaurants'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Restaurant));
      setRestaurants(list);
    }, (err) => {
      console.warn('Error fetching restaurants:', err);
    });

    const unsubMenuItems = onSnapshot(collection(db, 'menuItems'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
      setMenuItems(list);
      setLoading(false);
    }, (err) => {
      console.warn('Error fetching menu items:', err);
      setLoading(false);
    });

    return () => {
      unsubRestaurants();
      unsubMenuItems();
    };
  }, []);

  // Aggregate dynamic cuisines from real Firestore restaurants + menu items
  const allCuisines = useMemo(() => {
    const cuisineMap = new Map<string, CuisineMeta>();

    // Start with default template list
    DEFAULT_CUISINES.forEach(c => cuisineMap.set(c.id, c));

    // Discover additional cuisines present in Firestore
    restaurants.forEach(r => {
      const types = Array.isArray(r.cuisineType)
        ? r.cuisineType
        : typeof r.cuisineType === 'string'
        ? (r.cuisineType as string).split(',').map(s => s.trim())
        : [];

      types.forEach(name => {
        if (!name || name.length < 2) return;
        const normalizedId = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        if (!cuisineMap.has(normalizedId)) {
          cuisineMap.set(normalizedId, {
            id: normalizedId,
            name: name,
            icon: '🍽️',
            gradient: 'from-indigo-500 to-purple-600',
            desc: `Delicious authentic ${name} dishes & specials`,
            category: 'Specialty',
          });
        }
      });
    });

    return Array.from(cuisineMap.values());
  }, [restaurants]);

  // Helper matching cuisine to restaurant
  const getRestaurantsForCuisine = (cuisineId: string) => {
    const meta = allCuisines.find(c => c.id === cuisineId);
    const searchTarget = (meta?.name || cuisineId).toLowerCase();

    return restaurants.filter(r => {
      const cuisines = Array.isArray(r.cuisineType)
        ? r.cuisineType.map(c => c.toLowerCase())
        : typeof r.cuisineType === 'string'
        ? (r.cuisineType as string).toLowerCase()
        : '';

      const matchCuisine = Array.isArray(cuisines)
        ? cuisines.some(c => c.includes(searchTarget) || searchTarget.includes(c))
        : cuisines.includes(searchTarget);

      const matchName = r.name?.toLowerCase().includes(searchTarget);
      const matchDesc = r.description?.toLowerCase().includes(searchTarget);

      return matchCuisine || matchName || matchDesc;
    });
  };

  // Helper matching cuisine to menu items
  const getDishesForCuisine = (cuisineId: string) => {
    const meta = allCuisines.find(c => c.id === cuisineId);
    const searchTarget = (meta?.name || cuisineId).toLowerCase();
    const matchingRestaurantIds = new Set(getRestaurantsForCuisine(cuisineId).map(r => r.id));

    return menuItems.filter(item => {
      const matchCat = item.category?.toLowerCase().includes(searchTarget);
      const matchName = item.name?.toLowerCase().includes(searchTarget);
      const matchDesc = item.description?.toLowerCase().includes(searchTarget);
      const matchRest = item.restaurantId && matchingRestaurantIds.has(item.restaurantId);

      return matchCat || matchName || matchDesc || matchRest;
    });
  };

  // Filtered cuisines by search input
  const filteredCuisines = useMemo(() => {
    if (!searchQuery.trim()) return allCuisines;
    const q = searchQuery.toLowerCase();
    return allCuisines.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.desc.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  }, [allCuisines, searchQuery]);

  // Filtered and sorted restaurants for selected cuisine (or all if none selected)
  const currentRestaurants = useMemo(() => {
    let list = selectedCuisine
      ? getRestaurantsForCuisine(selectedCuisine)
      : restaurants;

    if (dietaryFilter === 'veg') {
      list = list.filter(r => r.isVeg || r.isPureVeg);
    }

    if (searchQuery.trim() && selectedCuisine) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      );
    }

    // Sort
    return [...list].sort((a, b) => {
      if (sortBy === 'rating') {
        const rA = a.averageRating || a.rating || 4;
        const rB = b.averageRating || b.rating || 4;
        return rB - rA;
      }
      if (sortBy === 'time') {
        return (a.deliveryTime || 30) - (b.deliveryTime || 30);
      }
      return 0; // popular / default
    });
  }, [selectedCuisine, restaurants, dietaryFilter, searchQuery, sortBy]);

  // Filtered and sorted dishes for selected cuisine (or all if none selected)
  const currentDishes = useMemo(() => {
    let list = selectedCuisine
      ? getDishesForCuisine(selectedCuisine)
      : menuItems;

    if (dietaryFilter === 'veg') {
      list = list.filter(d => d.vegetarian);
    } else if (dietaryFilter === 'non-veg') {
      list = list.filter(d => !d.vegetarian);
    }

    if (searchQuery.trim() && selectedCuisine) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d =>
        d.name?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.category?.toLowerCase().includes(q)
      );
    }

    // Sort
    return [...list].sort((a, b) => {
      if (sortBy === 'price_low') return a.price - b.price;
      if (sortBy === 'price_high') return b.price - a.price;
      if (sortBy === 'rating') return (b.averageRating || 4.5) - (a.averageRating || 4.5);
      return 0;
    });
  }, [selectedCuisine, menuItems, dietaryFilter, searchQuery, sortBy]);

  // Add dish to cart
  const handleAddToCart = (dish: MenuItem) => {
    const parentRestaurant = restaurants.find(r => r.id === dish.restaurantId);
    const cartItem: CartItem = {
      id: `${dish.id}-${Date.now()}`,
      menuItemId: dish.id,
      restaurantId: dish.restaurantId || 'platform',
      name: dish.name,
      price: dish.price,
      quantity: 1,
      image: dish.image || (dish.images && dish.images[0]) || '',
      restaurantName: parentRestaurant?.name || (dish as any).restaurantName || 'Gourmet Kitchen',
      addedAt: new Date(),
    };

    addItem(cartItem);
    setAddedItemIds(prev => new Set(prev).add(dish.id));
    toast.success(`Added "${dish.name}" to cart! 🍽️`);
    setTimeout(() => {
      setAddedItemIds(prev => {
        const next = new Set(prev);
        next.delete(dish.id);
        return next;
      });
    }, 2500);
  };

  const selectedCuisineMeta = allCuisines.find(c => c.id === selectedCuisine);

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Full-width Responsive Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/70 px-4 sm:px-6 lg:px-8 py-3.5 shadow-xs">
        <div className="w-full max-w-[1700px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Left: Back & Title */}
          <div className="flex items-center gap-3">
            <Link href="/customer">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2 tracking-tight">
                <ChefHat className="w-6 h-6 text-primary" />
                Cuisine Explorer
              </h1>
              <p className="text-xs text-muted-foreground">
                Discover {allCuisines.length} cuisines across {restaurants.length} live restaurants &amp; {menuItems.length} dishes
              </p>
            </div>
          </div>

          {/* Center: Search Bar */}
          <div className="flex-1 max-w-md w-full relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cuisines, dishes, curries, pizzas..."
              className="pl-9 pr-9 py-2 rounded-2xl bg-muted/50 border-border focus:bg-background text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Right: Actions & Fullscreen Toggle */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            {/* Dietary Filter */}
            <div className="flex items-center bg-muted/60 rounded-xl p-1 border border-border/60 text-xs font-semibold">
              <button
                onClick={() => setDietaryFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  dietaryFilter === 'all' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setDietaryFilter('veg')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  dietaryFilter === 'veg' ? 'bg-emerald-600 text-white shadow-xs' : 'text-muted-foreground hover:text-emerald-500'
                }`}
              >
                <Leaf className="w-3 h-3" /> Veg
              </button>
              <button
                onClick={() => setDietaryFilter('non-veg')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  dietaryFilter === 'non-veg' ? 'bg-rose-600 text-white shadow-xs' : 'text-muted-foreground hover:text-rose-500'
                }`}
              >
                <Flame className="w-3 h-3" /> Non-Veg
              </button>
            </div>

            {/* Fullscreen Button */}
            <FullscreenToggle className="border border-border/80 rounded-xl" showText={false} />
          </div>
        </div>
      </div>

      {/* Main Full-Width Container */}
      <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-8">
        
        {/* Selected Cuisine Active Banner (if one is chosen) */}
        {selectedCuisineMeta && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-3xl p-6 sm:p-8 bg-gradient-to-r ${selectedCuisineMeta.gradient} text-white shadow-xl relative overflow-hidden`}
          >
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4 sm:gap-6">
                <span className="text-5xl sm:text-6xl drop-shadow-md">{selectedCuisineMeta.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-white/20 text-white border-white/30 text-xs">
                      {selectedCuisineMeta.category}
                    </Badge>
                    <Badge className="bg-black/30 text-white text-xs font-mono">
                      {currentRestaurants.length} Restaurants • {currentDishes.length} Dishes
                    </Badge>
                  </div>
                  <h2 className="text-2xl sm:text-4xl font-black mt-1 tracking-tight">
                    {selectedCuisineMeta.name} Cuisines
                  </h2>
                  <p className="text-white/90 text-sm max-w-xl mt-1">
                    {selectedCuisineMeta.desc}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCuisine(null)}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/40 rounded-xl font-bold backdrop-blur-md"
                >
                  <X className="w-4 h-4 mr-1.5" />
                  View All Cuisines
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Cuisine Pills Grid (Full width responsive 2 to 8 columns) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-black flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {selectedCuisine ? 'Explore More Cuisines' : 'Browse All Cuisines'}
            </h2>
            <p className="text-xs text-muted-foreground">
              Showing {filteredCuisines.length} options
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
            {filteredCuisines.map((cuisine, i) => {
              const restCount = getRestaurantsForCuisine(cuisine.id).length;
              const dishCount = getDishesForCuisine(cuisine.id).length;
              const isSelected = selectedCuisine === cuisine.id;

              return (
                <motion.div
                  key={cuisine.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                >
                  <Card
                    onClick={() => {
                      setSelectedCuisine(isSelected ? null : cuisine.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-2 p-3.5 sm:p-4 text-center flex flex-col items-center justify-between h-36 sm:h-40 ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/40 bg-primary/5 shadow-lg shadow-primary/20'
                        : 'border-border/70 hover:border-primary/50 bg-card'
                    }`}
                  >
                    <div className="text-3xl sm:text-4xl mb-1 filter drop-shadow">
                      {cuisine.icon}
                    </div>
                    <div>
                      <h3 className="font-black text-xs sm:text-sm line-clamp-1 text-foreground">
                        {cuisine.name}
                      </h3>
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                        {cuisine.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-semibold">
                        {restCount} spots
                      </Badge>
                      {dishCount > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono text-muted-foreground">
                          {dishCount} dishes
                        </Badge>
                      )}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* View Selection Filter Tabs (When Cuisine is selected) */}
        {selectedCuisine && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-border/70">
            {/* View tabs */}
            <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-2xl border border-border/60">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activeTab === 'all'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Highlights
              </button>
              <button
                onClick={() => setActiveTab('restaurants')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'restaurants'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Store className="w-4 h-4 text-primary" />
                Restaurants ({currentRestaurants.length})
              </button>
              <button
                onClick={() => setActiveTab('dishes')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'dishes'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Utensils className="w-4 h-4 text-primary" />
                Dishes ({currentDishes.length})
              </button>
            </div>

            {/* Sort Dropdown / Selector */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-semibold flex items-center gap-1">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Sort:
              </span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-card border border-border rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="popular">Most Popular</option>
                <option value="rating">Top Rated (⭐)</option>
                <option value="time">Fastest Delivery (⚡)</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
              </select>
            </div>
          </div>
        )}

        {/* Section 1: Restaurants Grid */}
        {(activeTab === 'all' || activeTab === 'restaurants') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-2xl font-black flex items-center gap-2 text-foreground">
                <Store className="w-5 h-5 text-primary" />
                {selectedCuisineMeta ? `${selectedCuisineMeta.name} Restaurants` : 'Featured Restaurants'}
              </h2>
              <span className="text-xs font-semibold text-muted-foreground">
                {currentRestaurants.length} found
              </span>
            </div>

            {currentRestaurants.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-3xl border border-dashed border-border/80 p-8 space-y-3">
                <Store className="w-12 h-12 mx-auto text-muted-foreground" />
                <h3 className="font-bold text-foreground">No restaurants found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Try switching off dietary filters or exploring other authentic cuisines.
                </p>
                <Button variant="outline" size="sm" onClick={() => { setDietaryFilter('all'); setSearchQuery(''); }}>
                  Reset Filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
                {currentRestaurants.map((restaurant) => (
                  <RestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    variant="grid"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Section 2: Real Dishes Grid with 1-Click Add to Cart */}
        {(activeTab === 'all' || activeTab === 'dishes') && (
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-2xl font-black flex items-center gap-2 text-foreground">
                <Utensils className="w-5 h-5 text-primary" />
                {selectedCuisineMeta ? `Popular ${selectedCuisineMeta.name} Dishes` : 'Trending Dishes Across Cuisines'}
              </h2>
              <span className="text-xs font-semibold text-muted-foreground">
                {currentDishes.length} items
              </span>
            </div>

            {currentDishes.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-3xl border border-dashed border-border/80 p-8 space-y-3">
                <Utensils className="w-12 h-12 mx-auto text-muted-foreground" />
                <h3 className="font-bold text-foreground">No specific dishes found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Restaurants serving this cuisine have full menus available inside their store pages.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
                {currentDishes.slice(0, selectedCuisine ? 40 : 20).map((dish) => {
                  const parentRest = restaurants.find(r => r.id === dish.restaurantId);
                  const isAdded = addedItemIds.has(dish.id);
                  const displayImg = dish.image || (dish.images && dish.images[0]) || '/placeholder.svg';

                  return (
                    <Card
                      key={dish.id}
                      className="overflow-hidden border border-border/70 hover:border-primary/50 transition-all hover:shadow-xl flex flex-col justify-between group bg-card"
                    >
                      {/* Image & Badges */}
                      <div className="relative h-44 w-full bg-muted overflow-hidden">
                        <img
                          src={displayImg}
                          alt={dish.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e: any) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
                          }}
                        />

                        {/* Top left veg/non-veg tag */}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                          {dish.vegetarian ? (
                            <Badge className="bg-emerald-600/90 text-white backdrop-blur-md text-[10px] font-bold">
                              <Leaf className="w-2.5 h-2.5 mr-1" /> Veg
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-600/90 text-white backdrop-blur-md text-[10px] font-bold">
                              <Flame className="w-2.5 h-2.5 mr-1" /> Non-Veg
                            </Badge>
                          )}
                          {dish.isBestSeller && (
                            <Badge className="bg-amber-500 text-black text-[10px] font-black">
                              Bestseller
                            </Badge>
                          )}
                        </div>

                        {/* Bottom right price chip */}
                        <div className="absolute bottom-2.5 right-2.5 bg-black/75 text-white backdrop-blur-md px-2.5 py-1 rounded-xl text-xs font-black font-mono">
                          ₹{dish.price}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <h4 className="font-bold text-sm sm:text-base text-foreground line-clamp-1">
                            {dish.name}
                          </h4>
                          {parentRest && (
                            <Link
                              href={`/customer/restaurant/${parentRest.id}`}
                              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 mt-0.5"
                            >
                              <Store className="w-3 h-3" />
                              <span className="truncate">{parentRest.name}</span>
                            </Link>
                          )}
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">
                            {dish.description || 'Prepared fresh with premium ingredients & chef spices.'}
                          </p>
                        </div>

                        {/* Add to Cart button */}
                        <Button
                          size="sm"
                          onClick={() => handleAddToCart(dish)}
                          className={`w-full rounded-xl text-xs font-bold transition-all shadow-md ${
                            isAdded
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1" /> Added to Cart
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Add to Cart • ₹{dish.price}
                            </>
                          )}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
