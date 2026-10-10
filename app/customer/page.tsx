'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MenuItem, Restaurant } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/context/CartContext';
import { Search, ShoppingCart, Star, Flame, Clock, Filter, MapPin, ChevronRight, ChevronLeft, ChevronDown, TrendingUp, Plus, Store, Sparkles } from 'lucide-react';
import Link from 'next/link';
import SafeImage from '@/components/ui/safe-image';
import RestaurantCard from '@/components/customer/RestaurantCard';
import { checkRestaurantOperatingStatus } from '@/lib/restaurant-schedule';
import { toast } from 'sonner';

// Curated Food Categories with Rich Vibrant Color Palettes
const CATEGORIES = [
  {
    id: '1',
    name: 'Pizza',
    icon: '🍕',
    activeBg: 'bg-gradient-to-tr from-orange-500 via-amber-500 to-red-500 text-white shadow-lg shadow-orange-500/35 border-orange-400',
    idleBg: 'bg-gradient-to-br from-orange-500/15 via-amber-500/10 to-red-500/5 border-orange-500/30 text-orange-600 dark:text-orange-400 hover:border-orange-500/60 hover:shadow-md hover:shadow-orange-500/20',
    activeText: 'text-orange-600 dark:text-orange-400',
  },
  {
    id: '2',
    name: 'Burger',
    icon: '🍔',
    activeBg: 'bg-gradient-to-tr from-amber-500 via-yellow-500 to-orange-500 text-white shadow-lg shadow-amber-500/35 border-amber-400',
    idleBg: 'bg-gradient-to-br from-amber-500/15 via-yellow-500/10 to-orange-500/5 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:border-amber-500/60 hover:shadow-md hover:shadow-amber-500/20',
    activeText: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: '3',
    name: 'Biryani',
    icon: '🍲',
    activeBg: 'bg-gradient-to-tr from-red-500 via-rose-500 to-orange-500 text-white shadow-lg shadow-red-500/35 border-red-400',
    idleBg: 'bg-gradient-to-br from-red-500/15 via-rose-500/10 to-orange-500/5 border-red-500/30 text-red-600 dark:text-red-400 hover:border-red-500/60 hover:shadow-md hover:shadow-red-500/20',
    activeText: 'text-red-600 dark:text-red-400',
  },
  {
    id: '4',
    name: 'Chinese',
    icon: '🍜',
    activeBg: 'bg-gradient-to-tr from-blue-500 via-indigo-500 to-cyan-500 text-white shadow-lg shadow-blue-500/35 border-blue-400',
    idleBg: 'bg-gradient-to-br from-blue-500/15 via-indigo-500/10 to-cyan-500/5 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:border-blue-500/60 hover:shadow-md hover:shadow-blue-500/20',
    activeText: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: '5',
    name: 'Dessert',
    icon: '🍰',
    activeBg: 'bg-gradient-to-tr from-pink-500 via-rose-500 to-fuchsia-500 text-white shadow-lg shadow-pink-500/35 border-pink-400',
    idleBg: 'bg-gradient-to-br from-pink-500/15 via-rose-500/10 to-fuchsia-500/5 border-pink-500/30 text-pink-600 dark:text-pink-400 hover:border-pink-500/60 hover:shadow-md hover:shadow-pink-500/20',
    activeText: 'text-pink-600 dark:text-pink-400',
  },
  {
    id: '6',
    name: 'Healthy',
    icon: '🥗',
    activeBg: 'bg-gradient-to-tr from-emerald-500 via-green-500 to-teal-500 text-white shadow-lg shadow-emerald-500/35 border-emerald-400',
    idleBg: 'bg-gradient-to-br from-emerald-500/15 via-green-500/10 to-teal-500/5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:border-emerald-500/60 hover:shadow-md hover:shadow-emerald-500/20',
    activeText: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: '7',
    name: 'Drinks',
    icon: '🥤',
    activeBg: 'bg-gradient-to-tr from-purple-500 via-violet-500 to-indigo-500 text-white shadow-lg shadow-purple-500/35 border-purple-400',
    idleBg: 'bg-gradient-to-br from-purple-500/15 via-violet-500/10 to-indigo-500/5 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:border-purple-500/60 hover:shadow-md hover:shadow-purple-500/20',
    activeText: 'text-purple-600 dark:text-purple-400',
  },
  {
    id: '8',
    name: 'Kebabs',
    icon: '🍢',
    activeBg: 'bg-gradient-to-tr from-amber-600 via-orange-600 to-red-600 text-white shadow-lg shadow-amber-600/35 border-amber-500',
    idleBg: 'bg-gradient-to-br from-amber-600/15 via-orange-600/10 to-red-600/5 border-amber-600/30 text-amber-700 dark:text-amber-400 hover:border-amber-600/60 hover:shadow-md hover:shadow-amber-600/20',
    activeText: 'text-amber-700 dark:text-amber-400',
  },
  {
    id: '9',
    name: 'Sushi',
    icon: '🍣',
    activeBg: 'bg-gradient-to-tr from-rose-500 via-red-500 to-orange-500 text-white shadow-lg shadow-rose-500/35 border-rose-400',
    idleBg: 'bg-gradient-to-br from-rose-500/15 via-red-500/10 to-orange-500/5 border-rose-500/30 text-rose-600 dark:text-rose-400 hover:border-rose-500/60 hover:shadow-md hover:shadow-rose-500/20',
    activeText: 'text-rose-600 dark:text-rose-400',
  },
  {
    id: '10',
    name: 'Rolls',
    icon: '🌯',
    activeBg: 'bg-gradient-to-tr from-teal-500 via-emerald-500 to-cyan-500 text-white shadow-lg shadow-teal-500/35 border-teal-400',
    idleBg: 'bg-gradient-to-br from-teal-500/15 via-emerald-500/10 to-cyan-500/5 border-teal-500/30 text-teal-600 dark:text-teal-400 hover:border-teal-500/60 hover:shadow-md hover:shadow-teal-500/20',
    activeText: 'text-teal-600 dark:text-teal-400',
  },
  {
    id: '11',
    name: 'South Indian',
    icon: '🥞',
    activeBg: 'bg-gradient-to-tr from-amber-500 via-yellow-500 to-orange-400 text-white shadow-lg shadow-amber-500/35 border-amber-400',
    idleBg: 'bg-gradient-to-br from-amber-500/15 via-yellow-500/10 to-orange-500/5 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:border-amber-500/60 hover:shadow-md hover:shadow-amber-500/20',
    activeText: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: '12',
    name: 'Chai & Cafe',
    icon: '☕',
    activeBg: 'bg-gradient-to-tr from-amber-700 via-amber-800 to-stone-700 text-white shadow-lg shadow-amber-700/35 border-amber-600',
    idleBg: 'bg-gradient-to-br from-amber-700/15 via-amber-800/10 to-stone-700/5 border-amber-700/30 text-amber-800 dark:text-amber-300 hover:border-amber-700/60 hover:shadow-md hover:shadow-amber-700/20',
    activeText: 'text-amber-800 dark:text-amber-300',
  },
  {
    id: '13',
    name: 'Bakery',
    icon: '🥐',
    activeBg: 'bg-gradient-to-tr from-yellow-600 via-amber-600 to-orange-500 text-white shadow-lg shadow-yellow-600/35 border-yellow-500',
    idleBg: 'bg-gradient-to-br from-yellow-600/15 via-amber-600/10 to-orange-500/5 border-yellow-600/30 text-yellow-700 dark:text-yellow-400 hover:border-yellow-600/60 hover:shadow-md hover:shadow-yellow-600/20',
    activeText: 'text-yellow-700 dark:text-yellow-400',
  },
  {
    id: '14',
    name: 'Shakes',
    icon: '🧋',
    activeBg: 'bg-gradient-to-tr from-violet-500 via-fuchsia-500 to-purple-600 text-white shadow-lg shadow-violet-500/35 border-violet-400',
    idleBg: 'bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-purple-600/5 border-violet-500/30 text-violet-600 dark:text-violet-400 hover:border-violet-500/60 hover:shadow-md hover:shadow-violet-500/20',
    activeText: 'text-violet-600 dark:text-violet-400',
  },
  {
    id: '15',
    name: 'Street Food',
    icon: '🥘',
    activeBg: 'bg-gradient-to-tr from-red-600 via-orange-600 to-amber-600 text-white shadow-lg shadow-red-600/35 border-red-500',
    idleBg: 'bg-gradient-to-br from-red-600/15 via-orange-600/10 to-amber-600/5 border-red-600/30 text-red-600 dark:text-red-400 hover:border-red-600/60 hover:shadow-md hover:shadow-red-600/20',
    activeText: 'text-red-600 dark:text-red-400',
  },
];

export default function CustomerHomePage() {
  const router = useRouter();
  const { items, deliveryAddress, addItem } = useCart();

  const [menuItems, setMenuItems] = useState<(MenuItem & { restaurantName: string })[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('delivery'); // 'delivery' or 'pickup'
  const [currentTime, setCurrentTime] = useState(new Date());

  // Carousel ref, quick filter state, and dish visibility limit
  const carouselRef = useRef<HTMLDivElement>(null);
  const [restFilterVeg, setRestFilterVeg] = useState(false);
  const [restFilterRating4Plus, setRestFilterRating4Plus] = useState(false);
  const [restFilterFastDelivery, setRestFilterFastDelivery] = useState(false);
  const [visibleDishCount, setVisibleDishCount] = useState(10);

  // Clock tick every 30 seconds for live operating schedule evaluation
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let unsubscribeMenu: (() => void) | null = null;
    let unsubscribeRestaurants: (() => void) | null = null;

    setLoading(true);

    const restaurantMap = new Map<string, string>();

    // 1. Realtime listener for Restaurants
    const restaurantsRef = collection(db, 'restaurants');
    unsubscribeRestaurants = onSnapshot(restaurantsRef, (rSnapshot) => {
      restaurantMap.clear();
      const list = rSnapshot.docs.map(doc => {
        const data = doc.data();
        restaurantMap.set(doc.id, data.name || 'Restaurant');
        return { ...data, id: doc.id } as Restaurant;
      });
      setRestaurants(list);

      // Re-map restaurant names on menu items if already loaded
      setMenuItems(prev => prev.map(m => ({
        ...m,
        restaurantName: restaurantMap.get(m.restaurantId) || m.restaurantName || 'Restaurant'
      })));
    }, (err) => {
      console.error('[Customer Home] Realtime restaurants listener notice:', err);
    });

    // 2. Realtime listener for Menu Items
    const menuRef = collection(db, 'menuItems');
    const q = query(menuRef);

    unsubscribeMenu = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          restaurantName: restaurantMap.get(data.restaurantId) || 'Unknown Restaurant',
          price: Number(data.price) || 0,
          name: data.name || 'Unnamed',
          image: data.image || 'https://via.placeholder.com/150',
          category: data.category || 'General',
          isLive: data.isLive ?? false,
          available: data.available ?? true,
          approvalStatus: data.approvalStatus || 'pending'
        } as MenuItem & { restaurantName: string };
      });

      setMenuItems(list);
      setLoading(false);
    }, (err) => {
      console.error('[Customer Home] Realtime menu listener notice:', err);
      setLoading(false);
    });

    return () => {
      if (unsubscribeMenu) unsubscribeMenu();
      if (unsubscribeRestaurants) unsubscribeRestaurants();
    };
  }, []);

  // Filter Items
  const filteredItems = menuItems.filter(item => {
    if (item.approvalStatus !== 'approved' || !item.isLive) return false;

    const matchesSearch = !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'all' ||
      item.category.toLowerCase().includes(categoryFilter.toLowerCase()) ||
      item.name.toLowerCase().includes(categoryFilter.toLowerCase()) ||
      (categoryFilter === 'Kebabs' && (item.category.toLowerCase().includes('mughlai') || item.category.toLowerCase().includes('grill') || item.name.toLowerCase().includes('kebab') || item.name.toLowerCase().includes('tikka'))) ||
      (categoryFilter === 'Chai & Cafe' && (item.category.toLowerCase().includes('coffee') || item.category.toLowerCase().includes('tea') || item.name.toLowerCase().includes('chai') || item.name.toLowerCase().includes('coffee'))) ||
      (categoryFilter === 'Bakery' && (item.category.toLowerCase().includes('pastry') || item.category.toLowerCase().includes('cake') || item.name.toLowerCase().includes('croissant') || item.name.toLowerCase().includes('bread'))) ||
      (categoryFilter === 'South Indian' && (item.category.toLowerCase().includes('dosa') || item.category.toLowerCase().includes('idli') || item.name.toLowerCase().includes('dosa') || item.name.toLowerCase().includes('idli') || item.name.toLowerCase().includes('vada'))) ||
      (categoryFilter === 'Street Food' && (item.category.toLowerCase().includes('chaat') || item.name.toLowerCase().includes('chaat') || item.name.toLowerCase().includes('samosa') || item.name.toLowerCase().includes('pani puri')));

    // Service Area Filter
    let inServiceArea = true;
    if (deliveryAddress?.pincode) {
      const rest = restaurants.find(r => r.id === item.restaurantId);
      if (rest) {
        // If restaurant has defined service pincodes, check if it includes user's pincode
        if (rest.servicePincodes && rest.servicePincodes.length > 0) {
          inServiceArea = rest.servicePincodes.includes(deliveryAddress.pincode);
        }
        // If no service pincodes defined, we assume it serves everywhere (or maybe nowhere? defaulting to everywhere for now)
      }
    }

    return matchesSearch && matchesCategory && inServiceArea;
  });

  // Filter Restaurants based on Service Area
  const filteredRestaurants = restaurants.filter(r => {
    if (!deliveryAddress?.pincode) return true;
    if (r.servicePincodes && r.servicePincodes.length > 0) {
      return r.servicePincodes.includes(deliveryAddress.pincode);
    }
    return true; // Default to true if no restrictions set
  });

  // Featured Restaurants (Curated top picks for carousel)
  const featuredRestaurants = filteredRestaurants
    .filter(r => (r.rating || r.averageRating || 4.5) >= 4.0 || r.isActive)
    .slice(0, 10);
  const activeFeatured = featuredRestaurants.length > 0 ? featuredRestaurants : filteredRestaurants.slice(0, 8);

  // Carousel smooth scroll helper
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Display Restaurants for "All Restaurants" Section (supports Search, Category & Quick Filters)
  const displayRestaurants = filteredRestaurants.filter(r => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = r.name?.toLowerCase().includes(q);
      const matchCuisine = (r.cuisineType || []).some(c => c.toLowerCase().includes(q));
      const matchDesc = r.description?.toLowerCase().includes(q);
      if (!matchName && !matchCuisine && !matchDesc) return false;
    }

    if (categoryFilter !== 'all') {
      const catLower = categoryFilter.toLowerCase();
      const matchCuisine = (r.cuisineType || []).some(c => c.toLowerCase().includes(catLower));
      const matchDesc = r.description?.toLowerCase().includes(catLower);
      const matchName = r.name?.toLowerCase().includes(catLower);
      if (!matchCuisine && !matchDesc && !matchName) return false;
    }

    if (restFilterVeg && !(r.isPureVeg || r.isVeg)) return false;
    if (restFilterRating4Plus && (r.averageRating || r.rating || 4.5) < 4.0) return false;
    if (restFilterFastDelivery && (r.deliveryTime || 30) > 30) return false;

    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center flex-col gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground animate-pulse text-sm font-medium">Loading delicious options...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-40 sm:pb-24 font-sans selection:bg-primary/20">

      <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-8 space-y-6 sm:space-y-8 mt-3 sm:mt-6">

        {/* Category Scroller */}
        <div>
          <h2 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2 text-foreground">
            Eat what makes you happy
            <Flame className="w-4 h-4 text-primary" />
          </h2>
          <div className="flex gap-2.5 sm:gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x -mx-3 px-3 sm:mx-0 sm:px-0">
            {/* All Food Pill */}
            <div
              onClick={() => setCategoryFilter('all')}
              className="snap-start flex flex-col items-center gap-1.5 sm:gap-2 min-w-[66px] sm:min-w-[80px] cursor-pointer group"
            >
              <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl transition-all duration-300 border ${categoryFilter === 'all'
                ? 'bg-gradient-to-tr from-primary via-orange-500 to-amber-500 text-white border-primary scale-110 shadow-lg shadow-primary/35 ring-2 ring-primary/30'
                : 'bg-gradient-to-br from-primary/15 via-orange-500/10 to-transparent border-primary/30 text-primary hover:border-primary/60 hover:shadow-md hover:shadow-primary/20 hover:scale-105 hover:-translate-y-0.5'
                }`}>
                <span className="drop-shadow-xs group-hover:scale-115 transition-transform duration-300">
                  🍽️
                </span>
              </div>
              <span className={`text-xs font-semibold tracking-tight transition-colors ${categoryFilter === 'all' ? 'text-primary font-bold' : 'text-muted-foreground group-hover:text-foreground'
                }`}>
                All
              </span>
            </div>

            {/* Individual Food Category Pills */}
            {CATEGORIES.map(cat => {
              const isSelected = categoryFilter === cat.name;
              return (
                <div
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.name)}
                  className="snap-start flex flex-col items-center gap-1.5 sm:gap-2 min-w-[66px] sm:min-w-[80px] cursor-pointer group"
                >
                  <div
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl transition-all duration-300 border ${isSelected
                      ? `${cat.activeBg} scale-110 ring-2 ring-primary/30`
                      : `${cat.idleBg} hover:scale-105 hover:-translate-y-0.5`
                      }`}
                  >
                    <span className="drop-shadow-xs group-hover:scale-115 transition-transform duration-300">
                      {cat.icon}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-semibold tracking-tight transition-colors text-center truncate max-w-[76px] ${isSelected
                      ? `${cat.activeText} font-bold`
                      : 'text-muted-foreground group-hover:text-foreground'
                      }`}
                  >
                    {cat.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hero Banner (Offers) */}
        {!searchQuery && (
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-orange-600 via-amber-600 to-red-600 shadow-2xl shadow-orange-500/15 text-white">
            <div className="absolute top-0 right-0 p-8 sm:p-12 opacity-15 pointer-events-none">
              <ChefHatIcon className="w-48 h-48 sm:w-64 sm:h-64 text-white" />
            </div>
            <div className="p-5 sm:p-8 md:p-12 relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-3 sm:space-y-4 text-center md:text-left">
                <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-md px-3 py-1 font-bold text-xs uppercase tracking-wider">
                  Limited Time Offer
                </Badge>
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white leading-tight tracking-tight">
                  50% OFF<br />
                  <span className="text-amber-200 text-xl sm:text-3xl md:text-4xl font-extrabold">On Your First Order</span>
                </h2>
                <p className="text-white/90 max-w-sm text-xs sm:text-sm md:text-base leading-relaxed">
                  Use code <span className="font-mono text-white font-bold bg-black/20 px-2 py-0.5 rounded border border-white/20">TASTY50</span> at checkout. Valid on orders above ₹199.
                </p>
                <Button className="bg-white text-orange-600 hover:bg-orange-50 font-black rounded-2xl px-6 sm:px-8 shadow-xl hover:scale-105 transition-all duration-300 w-full sm:w-auto h-11 sm:h-12 text-sm sm:text-base">
                  Order Now
                </Button>
              </div>
              <div className="w-full md:w-1/3 flex justify-center py-2">
                <div className="w-40 h-40 bg-white/20 rounded-full blur-3xl opacity-50 absolute"></div>
                <div className="relative text-7xl sm:text-8xl md:text-9xl transform md:rotate-12 hover:rotate-0 transition-all duration-500 cursor-pointer drop-shadow-2xl">
                  🍔
                </div>
              </div>
            </div>
          </div>
        )}



        {/* Featured Restaurants Section */}
        {!searchQuery && categoryFilter === 'all' && (
          <div className="space-y-3 sm:space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-2xl font-black tracking-tight text-foreground">Featured Restaurants</h2>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] sm:text-xs font-bold">
                    Top Picks
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Handpicked favorites with top ratings and fast delivery
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Desktop Carousel Navigation Arrows */}
                <div className="hidden sm:flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => scrollCarousel('left')}
                    className="w-8 h-8 rounded-full border border-border/70 hover:border-primary/50 hover:bg-primary/10 flex items-center justify-center text-foreground transition-all active:scale-95 shadow-xs"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCarousel('right')}
                    className="w-8 h-8 rounded-full border border-border/70 hover:border-primary/50 hover:bg-primary/10 flex items-center justify-center text-foreground transition-all active:scale-95 shadow-xs"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <Button
                  variant="ghost"
                  onClick={() => {
                    const el = document.getElementById('all-restaurants-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-primary hover:text-primary/80 hover:bg-primary/10 font-bold text-xs sm:text-sm h-8 px-2.5 rounded-lg flex items-center gap-1"
                >
                  <span>View all</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div
              ref={carouselRef}
              className="flex gap-4 sm:gap-5 overflow-x-auto pb-4 pt-1 scrollbar-hide snap-x scroll-smooth -mx-3 px-3 sm:mx-0 sm:px-0"
            >
              {activeFeatured.map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  variant="carousel"
                  isPromoted={true}
                  currentTime={currentTime}
                />
              ))}
              {activeFeatured.length === 0 && (
                [1, 2, 3].map(i => (
                  <div key={i} className="snap-start w-[280px] sm:w-[320px] md:w-[340px] flex-shrink-0 h-64 bg-muted/40 rounded-2xl sm:rounded-3xl animate-pulse border border-border/60" />
                ))
              )}
            </div>
          </div>
        )}

        {/* Popular Items Grid */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg sm:text-xl font-black text-foreground flex flex-wrap items-center gap-2">
              {searchQuery ? 'Search Results' : (categoryFilter !== 'all' ? `${categoryFilter} Items` : 'Popular Near You')}
              {!searchQuery && categoryFilter === 'all' && (
                <Badge variant="outline" className="text-xs border-green-500/30 text-green-600 dark:text-green-400 bg-green-500/10 font-bold">
                  Free Delivery
                </Badge>
              )}
              {deliveryAddress && (
                <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/10 hidden md:flex font-bold">
                  Serving {deliveryAddress.pincode}
                </Badge>
              )}
            </h2>
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-12 sm:py-20 bg-card rounded-2xl sm:rounded-3xl border border-dashed border-border p-6">
              <p className="text-muted-foreground font-medium">No items found matching your criteria.</p>
              <Button
                variant="link"
                onClick={() => { setCategoryFilter('all'); setSearchQuery(''); }}
                className="text-primary font-bold mt-2"
              >
                Clear Filters
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5">
            {filteredItems.slice(0, visibleDishCount).map((item) => (
              <Link key={item.id} href={`/customer/product/${item.id}`} className="group block h-full">
                <div className="bg-card border border-border/60 rounded-2xl sm:rounded-3xl overflow-hidden hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1.5 transition-all duration-300 relative h-full flex flex-col">

                  {/* Image Section */}
                  <div className="h-48 sm:h-52 relative overflow-hidden bg-muted flex-shrink-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                    {/* Veg / Non-Veg dot — FSSAI style */}
                    <div className={`absolute top-3 left-3 w-5 h-5 rounded-sm border-2 flex items-center justify-center bg-white/95 shadow-md ${item.vegetarian ? 'border-green-600' : 'border-red-600'
                      }`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${item.vegetarian ? 'bg-green-600' : 'bg-red-600'
                        }`} />
                    </div>

                    {/* Bestseller ribbon */}
                    {item.isBestSeller && (
                      <div className="absolute top-0 right-0">
                        <div className="relative overflow-hidden w-20 h-20">
                          <div className="absolute top-3.5 -right-6 w-24 text-center bg-amber-500 text-black text-[9px] font-black py-1 rotate-45 shadow-md uppercase tracking-widest">
                            Best Seller
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quick Add Button — stop propagation so it doesn't navigate */}
                    <div
                      className="absolute bottom-3 right-3"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const parentRest = restaurants.find(r => r.id === item.restaurantId);
                        if (parentRest && !checkRestaurantOperatingStatus(parentRest, currentTime).isOpen) {
                          toast.error(`"${parentRest.name}" is currently closed. Click to open dish & save to wishlist!`);
                          return;
                        }
                        addItem({
                          id: `${item.id}-${Date.now()}`,
                          menuItemId: item.id,
                          restaurantId: item.restaurantId,
                          name: item.name,
                          price: item.price,
                          quantity: 1,
                          image: item.image,
                          restaurantName: item.restaurantName || '',
                          addedAt: new Date(),
                        });
                        toast.success(`Added "${item.name}" to cart`);
                      }}
                    >
                      <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/40 hover:scale-110 active:scale-95 transition-transform cursor-pointer border-2 border-white/20">
                        <Plus className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 flex-1 flex flex-col">
                    {/* Item Name + Restaurant chip */}
                    <div className="mb-2">
                      <h3 className="font-black text-foreground text-base leading-tight group-hover:text-primary transition-colors line-clamp-1 mb-1">{item.name}</h3>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                        <Store className="w-3 h-3 text-primary/70" />
                        <span className="truncate">{item.restaurantName}</span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3 flex-1">{item.description || 'Freshly prepared and packed with delicious flavours.'}</p>

                    {/* Price + Meta row */}
                    <div className="flex items-end justify-between pt-2.5 border-t border-border/50 mt-auto">
                      <div>
                        <span className="text-xl font-black text-foreground tracking-tight">₹{item.price}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        {/* Prep time */}
                        <div className="flex items-center gap-1 bg-muted/80 px-2 py-1 rounded-lg text-[11px] text-muted-foreground font-semibold border border-border/60">
                          <Clock className="w-3 h-3 text-primary" /> {item.preparationTime || '25'}m
                        </div>
                        {/* Rating */}
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-bold text-foreground">{item.averageRating ? item.averageRating.toFixed(1) : 'New'}</span>
                          {item.totalReviews ? <span className="text-[10px] text-muted-foreground">({item.totalReviews})</span> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* View More Option for Popular Near You */}
          {filteredItems.length > visibleDishCount && (
            <div className="flex justify-center pt-4">
              <Button
                type="button"
                onClick={() => setVisibleDishCount(prev => prev + 10)}
                variant="outline"
                className="rounded-full px-7 py-2.5 font-bold text-sm border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground shadow-sm hover:shadow-md transition-all gap-2"
              >
                <span>View More Dishes ({filteredItems.length - visibleDishCount} remaining)</span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* All Restaurants Near You Section - Moved to bottom of Popular Near You */}
        <div id="all-restaurants-section" className="space-y-3 sm:space-y-4 pt-4 border-t border-border/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg sm:text-2xl font-black text-foreground flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" />
                <span>{categoryFilter !== 'all' ? `${categoryFilter} Restaurants` : 'All Restaurants Near You'}</span>
                <Badge variant="outline" className="text-xs font-bold border-border/80">
                  {displayRestaurants.length}
                </Badge>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Explore verified kitchen partners, authentic menus, and lightning delivery
              </p>
            </div>

            {/* Quick Filter Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setRestFilterVeg(prev => !prev)}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                  restFilterVeg
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-card text-muted-foreground border-border/80 hover:border-border'
                }`}
              >
                🌱 Pure Veg
              </button>
              <button
                type="button"
                onClick={() => setRestFilterRating4Plus(prev => !prev)}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                  restFilterRating4Plus
                    ? 'bg-amber-500 text-black border-amber-500 shadow-sm'
                    : 'bg-card text-muted-foreground border-border/80 hover:border-border'
                }`}
              >
                ⭐ 4.0+ Rating
              </button>
              <button
                type="button"
                onClick={() => setRestFilterFastDelivery(prev => !prev)}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                  restFilterFastDelivery
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card text-muted-foreground border-border/80 hover:border-border'
                }`}
              >
                ⚡ &lt;30 Mins
              </button>
            </div>
          </div>

          {displayRestaurants.length === 0 ? (
            <div className="text-center py-8 bg-card rounded-2xl border border-dashed border-border p-6">
              <p className="text-muted-foreground font-medium text-sm">No restaurants match your selected filters.</p>
              <Button
                variant="link"
                onClick={() => {
                  setRestFilterVeg(false);
                  setRestFilterRating4Plus(false);
                  setRestFilterFastDelivery(false);
                  setCategoryFilter('all');
                  setSearchQuery('');
                }}
                className="text-primary font-bold mt-1 text-xs"
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {displayRestaurants.map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  variant="grid"
                  currentTime={currentTime}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Icon component for Hero
function ChefHatIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
      <line x1="6" x2="18" y1="17" y2="17" />
    </svg>
  )
}
