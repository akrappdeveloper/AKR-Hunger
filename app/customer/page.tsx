'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MenuItem, Restaurant } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/context/CartContext';
import { Search, ShoppingCart, Star, Flame, Clock, Filter, MapPin, ChevronRight, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import SafeImage from '@/components/ui/safe-image';

// Mock Data for UI Categories
const CATEGORIES = [
  { id: '1', name: 'Pizza', icon: '🍕', color: 'bg-orange-500/10 text-orange-500' },
  { id: '2', name: 'Burger', icon: '🍔', color: 'bg-yellow-500/10 text-yellow-500' },
  { id: '3', name: 'Biryani', icon: '🍲', color: 'bg-red-500/10 text-red-500' },
  { id: '4', name: 'Chinese', icon: '🍜', color: 'bg-blue-500/10 text-blue-500' },
  { id: '5', name: 'Dessert', icon: '🍰', color: 'bg-pink-500/10 text-pink-500' },
  { id: '6', name: 'Healthy', icon: '🥗', color: 'bg-green-500/10 text-green-500' },
  { id: '7', name: 'Drinks', icon: '🥤', color: 'bg-purple-500/10 text-purple-500' },
];

export default function CustomerHomePage() {
  const router = useRouter();
  const { items, deliveryAddress } = useCart();

  const [menuItems, setMenuItems] = useState<(MenuItem & { restaurantName: string })[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('delivery'); // 'delivery' or 'pickup'

  useEffect(() => {
    let unsubscribeMenu: () => void;

    const initialize = async () => {
      setLoading(true);

      // 1. Fetch Restaurants
      const restaurantMap = new Map<string, string>();
      try {
        const restaurantsRef = collection(db, 'restaurants');
        const rSnapshot = await getDocs(restaurantsRef);
        rSnapshot.docs.forEach(doc => {
          restaurantMap.set(doc.id, doc.data().name);
        });
        setRestaurants(rSnapshot.docs.map(d => ({ ...d.data(), id: d.id } as Restaurant)));
      } catch (e) {
        console.error("Restaurant fetch failed:", e);
      }

      // 2. Listen to Menu Items
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
      });
    };

    initialize();

    return () => {
      if (unsubscribeMenu) unsubscribeMenu();
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
      (categoryFilter === 'Pizza' && item.name.toLowerCase().includes('pizza')); // Simple fallback mapping

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

  // Filter Restaurants based on Service Area for Featured Section
  const filteredRestaurants = restaurants.filter(r => {
    if (!deliveryAddress?.pincode) return true;
    if (r.servicePincodes && r.servicePincodes.length > 0) {
      return r.servicePincodes.includes(deliveryAddress.pincode);
    }
    return true; // Default to true if no restrictions set
  });

  // Featured Restaurants (Mock logic: just take first 5 from filtered)
  const featuredRestaurants = filteredRestaurants.slice(0, 5);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center flex-col gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 animate-pulse">Loading experience...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-40 sm:pb-24 font-sans selection:bg-blue-500/30">

      {/* 
         REMOVED HEADER: 
         The Custom Header was removed because it is now handled by the global CustomerNavbar.tsx
         which provides Search, Location, and User controls properly.
      */}

      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-4 space-y-6 sm:space-y-8 mt-4 sm:mt-6">

        {/* Category Scroller */}
        <div>
          <h2 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2">
            Eat what makes you happy
            <Flame className="w-4 h-4 text-orange-500" />
          </h2>
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
            <div
              onClick={() => setCategoryFilter('all')}
              className={`snap-start flex flex-col items-center gap-1.5 sm:gap-2 min-w-[60px] sm:min-w-[70px] cursor-pointer group`}
            >
              <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-xl sm:text-2xl transition-all duration-300 border ${categoryFilter === 'all' ? 'bg-white text-black border-white scale-110 shadow-lg shadow-white/20' : 'bg-gray-900 text-gray-400 border-gray-800 group-hover:bg-gray-800 group-hover:border-gray-700'}`}>
                ♾️
              </div>
              <span className={`text-xs font-medium ${categoryFilter === 'all' ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>All</span>
            </div>
            {CATEGORIES.map(cat => (
              <div
                key={cat.id}
                onClick={() => setCategoryFilter(cat.name)}
                className="snap-start flex flex-col items-center gap-1.5 sm:gap-2 min-w-[60px] sm:min-w-[70px] cursor-pointer group"
              >
                <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-xl sm:text-2xl transition-all duration-300 border ${categoryFilter === cat.name ? 'start-color border-transparent scale-110 shadow-lg' : 'bg-gray-900 border-gray-800 group-hover:bg-gray-800 group-hover:border-gray-700'} ${categoryFilter === cat.name ? cat.color.replace('text-', 'bg-').replace('/10', '') + ' text-white' : ''}`}>
                  {cat.icon}
                </div>
                <span className={`text-xs font-medium ${categoryFilter === cat.name ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>{cat.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hero Banner (Offers) */}
        {!searchQuery && (
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 shadow-2xl shadow-blue-900/20">
            <div className="absolute top-0 right-0 p-8 sm:p-12 opacity-10">
              <ChefHatIcon className="w-48 h-48 sm:w-64 sm:h-64 text-white" />
            </div>
            <div className="p-6 sm:p-8 md:p-12 relative z-10 flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
              <div className="space-y-3 sm:space-y-4 text-center md:text-left">
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 px-3 py-1">Limited Time Offer</Badge>
                <h2 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-white leading-tight">
                  50% OFF<br />
                  <span className="text-blue-300 text-xl sm:text-2xl md:text-3xl font-bold">On Your First Order</span>
                </h2>
                <p className="text-blue-200/80 max-w-sm text-sm sm:text-base">
                  Use code <span className="font-mono text-white font-bold bg-white/10 px-2 rounded">TASTY50</span> at checkout. Valid on orders above $30.
                </p>
                <Button className="bg-white text-blue-900 hover:bg-blue-50 font-bold rounded-xl px-6 sm:px-8 shadow-lg shadow-black/20 transform transition hover:scale-105 w-full sm:w-auto">
                  Order Now
                </Button>
              </div>
              <div className="w-full md:w-1/3 flex justify-center">
                {/* Placeholder illustration/image */}
                <div className="w-48 h-48 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full blur-3xl opacity-50 absolute"></div>
                <div className="relative text-7xl sm:text-9xl transform md:rotate-12 hover:rotate-0 transition-all duration-500 cursor-pointer drop-shadow-2xl">
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
              <h2 className="text-lg sm:text-xl font-bold">Featured Restaurants</h2>
              <Button variant="link" className="text-blue-400 p-0 h-auto text-sm">View all</Button>
            </div>
            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
              {featuredRestaurants.map((restaurant) => (
                <Link key={restaurant.id} href={`/customer/restaurant/${restaurant.id}`} className="snap-center min-w-[240px] sm:min-w-[280px] group">
                  <div className="h-56 sm:h-64 rounded-2xl overflow-hidden relative shadow-lg bg-gray-900">
                    <SafeImage
                      src={restaurant.image}
                      fallbackType="restaurant"
                      useImgTag={true}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      alt={restaurant.name}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-90" />
                    <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                      <h3 className="text-base sm:text-lg font-bold text-white mb-1 shadow-sm">{restaurant.name}</h3>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-300 mb-2">
                        <span className="bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded text-xs font-bold flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-green-400" /> {restaurant.rating || '4.5'}
                        </span>
                        <span className="w-1 h-1 bg-gray-500 rounded-full" />
                        <span className="line-clamp-1">{restaurant.cuisineType?.join(', ') || 'Multi-cuisine'}</span>
                      </div>
                    </div>
                    {/* Promo Badge */}
                    <div className="absolute top-3 left-3 bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg uppercase tracking-wider">
                      Promoted
                    </div>
                  </div>
                </Link>
              ))}
              {/* Skeleton/Placeholder if no restaurants */}
              {featuredRestaurants.length === 0 && (
                [1, 2, 3].map(i => (
                  <div key={i} className="snap-center min-w-[240px] sm:min-w-[280px] h-56 sm:h-64 bg-gray-900/50 rounded-2xl animate-pulse border border-gray-800" />
                ))
              )}
            </div>
          </div>
        )}

        {/* Popular Items Grid */}
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-lg sm:text-xl font-bold flex flex-wrap items-center gap-2">
            {searchQuery ? 'Search Results' : (categoryFilter !== 'all' ? `${categoryFilter} Items` : 'Popular Near You')}
            {!searchQuery && categoryFilter === 'all' && <Badge variant="outline" className="text-xs border-green-500/50 text-green-500 bg-green-500/10">Free Delivery</Badge>}
            {deliveryAddress && (
              <Badge variant="outline" className="text-xs border-orange-500/50 text-orange-500 bg-orange-500/10 hidden md:flex">
                Serving {deliveryAddress.pincode}
              </Badge>
            )}
          </h2>

          {filteredItems.length === 0 && (
            <div className="text-center py-12 sm:py-20 bg-gray-900/30 rounded-2xl sm:rounded-3xl border border-dashed border-gray-800">
              <p className="text-gray-500">No items found matching your criteria.</p>
              <Button
                variant="link"
                onClick={() => { setCategoryFilter('all'); setSearchQuery(''); }}
                className="text-blue-400 mt-2"
              >
                Clear Filters
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredItems.map((item) => (
              <Link key={item.id} href={`/customer/product/${item.id}`} className="group">
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl sm:rounded-2xl overflow-hidden hover:border-gray-700 hover:bg-gray-900 transition-all duration-300 relative h-full flex flex-col">
                  {/* Image Section */}
                  <div className="h-40 sm:h-48 relative overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent opacity-60" />
                    {item.isBestSeller && (
                      <div className="absolute top-2 sm:top-3 left-2 sm:left-3 bg-yellow-500/90 backdrop-blur-sm text-black text-[10px] font-bold px-2 py-1 rounded shadow-lg uppercase tracking-wide">
                        Bestseller
                      </div>
                    )}
                    <div className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-white font-bold text-sm border border-white/10">
                      ₹{item.price}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-white text-base sm:text-lg leading-tight group-hover:text-blue-400 transition-colors line-clamp-1">{item.name}</h3>
                        <div className={`w-4 h-4 rounded-sm border flex items-center justify-center p-0.5 shrink-0 ${item.vegetarian ? 'border-green-500' : 'border-red-500'}`}>
                          <div className={`w-full h-full rounded-full ${item.vegetarian ? 'bg-green-500' : 'bg-red-500'}`} />
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-400 line-clamp-2 mb-2 sm:mb-3">{item.description || 'No description available.'}</p>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 sm:pt-3 border-t border-gray-800/50">
                      <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" /> {item.preparationTime || '20-30'} min
                      </div>
                      <div className="flex items-center gap-1 text-xs font-bold text-gray-300">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        {item.averageRating ? item.averageRating.toFixed(1) : 'New'}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
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
