'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Restaurant, MenuItem, CartItem } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, Clock, MapPin, ArrowLeft, Heart, Search, Share2, Plus, Minus, CheckCircle, Info, ShoppingBag, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function RestaurantPage() {
  const params = useParams();
  const router = useRouter();
  const { addItem, items: cartItems, total } = useCart();
  const { user } = useAuth();
  const restaurantId = params.id as string;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isHeaderSticky, setIsHeaderSticky] = useState(false);
  const [isServiceable, setIsServiceable] = useState(true);
  const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Custom scroll listener for sticky header effect
  useEffect(() => {
    const handleScroll = () => {
      // Header stickiness
      if (window.scrollY > 300) {
        setIsHeaderSticky(true);
      } else {
        setIsHeaderSticky(false);
      }

      // Active category detection on scroll
      const scrollPosition = window.scrollY + 200;
      for (const category of categories) {
        const element = categoryRefs.current[category];
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveCategory(category);
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [categories]);

  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/restaurants/${restaurantId}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Failed to fetch restaurant');

        const fetchedRestaurant = data.restaurant as Restaurant;
        setRestaurant(fetchedRestaurant);

        // Check servicability immediately after fetching
        if (user && user.addresses && fetchedRestaurant.servicePincodes && fetchedRestaurant.servicePincodes.length > 0) {
          const defaultAddress = user.addresses.find(a => a.isDefault) || user.addresses[0];
          if (defaultAddress) {
            const canServe = fetchedRestaurant.servicePincodes.includes(defaultAddress.pincode);
            setIsServiceable(canServe);
            if (!canServe) {
              toast.error("This restaurant does not deliver to your default location.", { duration: 5000 });
            }
          }
        } else if (fetchedRestaurant.servicePincodes && fetchedRestaurant.servicePincodes.length > 0 && (!user || !user.addresses || user.addresses.length === 0)) {
          // If user has no address, we don't block yet, but maybe show a warning?
          // For now, let's assume serviceable until they try to order or sign in.
          // Or strictly: setIsServiceable(true); 
        }

        const rawItems = data.menuItems as MenuItem[];
        const items = rawItems.filter(item => item.approvalStatus === 'approved' && item.isLive);
        setMenuItems(items);

        const uniqueCategories = Array.from(new Set(items.map((item) => item.category)));
        setCategories(uniqueCategories);
        if (uniqueCategories.length > 0) setActiveCategory(uniqueCategories[0]);

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (restaurantId) fetchRestaurantData();
  }, [restaurantId, user]);

  const scrollToCategory = (category: string) => {
    setActiveCategory(category);
    const element = categoryRefs.current[category];
    if (element) {
      const offset = 180; // persistent header height
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  const getQuantityInCart = (itemId: string) => {
    return cartItems
      .filter(item => item.menuItemId === itemId)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleAddToCart = (item: MenuItem) => {
    if (!isServiceable) {
      toast.error("Sorry, this restaurant does not deliver to your location.");
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
      addedAt: new Date(),
    });
    // Create a smooth flying animation effect conceptually (toast for now)
    toast.success(`Added ${item.name} to cart`);
  };

  const filteredItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-4 space-y-8 animate-pulse">
        <div className="h-80 bg-gray-900 rounded-b-3xl" />
        <div className="max-w-7xl mx-auto px-4 space-y-8 -mt-20">
          <div className="h-40 bg-gray-800 rounded-3xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-gray-900 rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32 font-sans selection:bg-orange-500/30">

      {/* 1. Header Actions (Back/Share) */}
      <div className={`fixed top-16 md:top-20 left-0 right-0 z-40 transition-all duration-300 ${isHeaderSticky ? 'bg-black/80 backdrop-blur-xl shadow-2xl py-2 border-b border-white/5' : 'bg-transparent py-4'}`}>
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md border border-white/10 w-10 h-10 transition-transform hover:scale-105 active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </Button>

          {/* Title in sticky header */}
          <div className={`transition-all duration-500 transform ${isHeaderSticky ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} font-bold text-lg`}>
            {restaurant.name}
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" size="icon" className="rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md border border-white/10 w-10 h-10 transition-transform hover:scale-105 active:scale-95">
              <Search className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md border border-white/10 w-10 h-10 transition-transform hover:scale-105 active:scale-95">
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Sticky Category Bar */}
        <div className={`mt-2 overflow-x-auto scrollbar-hide transition-all duration-500 ease-in-out ${isHeaderSticky ? 'opacity-100 max-h-20 translate-y-0' : 'opacity-0 max-h-0 -translate-y-4 pointer-events-none'}`}>
          <div className="max-w-7xl mx-auto px-4 flex gap-3 pb-3 pt-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => scrollToCategory(cat)}
                className={`text-sm font-semibold whitespace-nowrap px-5 py-2 rounded-full transition-all duration-300 shadow-lg ${activeCategory === cat ? 'bg-white text-black scale-105 shadow-white/10' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Hero Section */}
      <div className="relative w-full h-[400px] md:h-[500px] group">
        <Image
          src={restaurant.image || "/placeholder.svg"}
          alt={restaurant.name}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/60 to-black/30" />

        {/* Info Card - Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-12 z-10">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-2xl relative overflow-hidden group hover:bg-white/10 transition-all duration-500">
              {/* Glow Effect */}
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">{restaurant.name}</h1>
                    <div className="bg-green-600/90 backdrop-blur text-white px-3 py-1 rounded-xl text-sm font-bold flex items-center gap-1 shadow-lg shadow-green-900/30">
                      {(restaurant.rating || restaurant.averageRating || 4.2).toFixed(1)} <Star className="w-3.5 h-3.5 fill-white" />
                    </div>
                  </div>
                  <p className="text-gray-300 text-base mb-6 font-medium line-clamp-2 max-w-2xl">{restaurant.description || 'Experience the finest culinary delights crafted with passion and served with love.'}</p>

                  <div className="flex flex-wrap items-center gap-4 md:gap-8 text-sm font-semibold text-gray-300">
                    <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-lg border border-white/5">
                      <Clock className="w-4 h-4 text-orange-400" />
                      <span>{restaurant.deliveryTime || '30-40'} mins</span>
                    </div>
                    <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-lg border border-white/5">
                      <MapPin className="w-4 h-4 text-orange-400" />
                      <span>2.5 km</span>
                    </div>
                    <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-lg border border-white/5">
                      <ShoppingBag className="w-4 h-4 text-orange-400" />
                      <span>Min ₹{restaurant.minimumOrder || 100}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                  <Button className="flex-1 md:flex-none bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl h-12 px-8 shadow-lg shadow-orange-900/40 transform hover:translate-y-[-2px] transition-all">
                    Review
                  </Button>
                  <Button variant="outline" className="flex-1 md:flex-none border-white/20 text-white hover:bg-white/10 rounded-xl h-12 px-6">
                    <Heart className="w-5 h-5 mr-2" /> Favorite
                  </Button>
                </div>
              </div>

              {/* Not Serviceable Warning */}
              {!isServiceable && (
                <div className="mt-4 bg-red-500/10 border border-red-500/40 rounded-xl p-3 flex items-start gap-3 animate-in slide-in-from-top-2 fade-in">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-red-500 text-sm">Not Serviceable</h4>
                    <p className="text-xs text-red-400/90">This restaurant does not deliver to your current location ({user?.addresses?.find(a => a.isDefault)?.pincode}).</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Menu Content */}
      <div className="max-w-4xl mx-auto px-4 pt-8 relative z-10">

        {/* Categories (Static - visible when header not sticky) */}
        {!isHeaderSticky && (
          <div className="mb-12">
            <h3 className="text-lg font-bold text-gray-400 mb-4 uppercase tracking-wider text-xs px-2">Browse Menu</h3>
            <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide snap-x">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => scrollToCategory(cat)}
                  className={`flex flex-col items-center justify-center gap-3 min-w-[6rem] p-4 rounded-[1.5rem] border transition-all duration-300 snap-start group ${activeCategory === cat ? 'bg-gradient-to-br from-orange-500/20 to-orange-600/5 border-orange-500/50 shadow-orange-500/10' : 'bg-[#111] border-white/5 hover:bg-[#1a1a1a] hover:border-white/10'}`}
                >
                  <span className="text-3xl bg-black/40 w-12 h-12 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">🍽️</span>
                  <span className={`text-sm font-bold ${activeCategory === cat ? 'text-orange-400' : 'text-gray-400 group-hover:text-white'}`}>{cat}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Menu Items List */}
        <div className="space-y-12">
          {categories.map((category) => {
            const categoryItems = filteredItems.filter(item => item.category === category);
            if (categoryItems.length === 0) return null;

            return (
              <div key={category} ref={(el) => (categoryRefs.current[category] = el)} className="scroll-mt-48">
                <div className="flex items-center gap-4 mb-6">
                  <h2 className="text-2xl font-black text-white">{category}</h2>
                  <span className="h-[1px] flex-1 bg-gradient-to-r from-white/10 to-transparent"></span>
                  <span className="text-sm font-bold text-gray-500 bg-white/5 px-3 py-1 rounded-full">{categoryItems.length} items</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {categoryItems.map(item => (
                    <div key={item.id} className={`group relative bg-[#111] border border-white/5 hover:border-white/10 rounded-2xl p-4 transition-all duration-300 hover:bg-[#161616] hover:shadow-2xl hover:shadow-black/50 flex gap-4 ${!isServiceable ? 'opacity-50 grayscale-[0.5]' : ''}`}>

                      {/* Text Info */}
                      <div className="flex-1 flex flex-col">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {item.vegetarian ? (
                              <div className="border border-green-500/50 bg-green-500/10 rounded-md p-0.5" title="Vegetarian">
                                <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                              </div>
                            ) : (
                              <div className="border border-red-500/50 bg-red-500/10 rounded-md p-0.5" title="Non-Vegetarian">
                                <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                              </div>
                            )}
                            {item.isBestSeller && (
                              <span className="text-[10px] font-bold bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full flex items-center gap-1 border border-yellow-500/20">
                                <Star className="w-3 h-3 fill-yellow-500" /> Bestseller
                              </span>
                            )}
                          </div>
                        </div>

                        <h3 className="font-bold text-gray-100 text-lg leading-tight mb-1 group-hover:text-orange-400 transition-colors">{item.name}</h3>
                        <div className="font-bold text-white text-lg mb-2">₹{item.price}</div>

                        <p className="text-sm text-gray-500 line-clamp-2 mb-3 flex-1">{item.description}</p>

                        <div className="flex items-center gap-1 mt-auto">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star key={star} className={`w-3 h-3 ${star <= (item.averageRating || 4) ? 'fill-yellow-500 text-yellow-500' : 'fill-gray-800 text-gray-800'}`} />
                            ))}
                          </div>
                          <span className="text-xs text-gray-600 ml-2 font-medium">102 ratings</span>
                        </div>
                      </div>

                      {/* Image & Add Button */}
                      <div className="relative w-32 h-32 md:w-40 md:h-40 flex-shrink-0">
                        <div className="w-full h-full rounded-xl overflow-hidden bg-gray-900 shadow-inner relative">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="object-cover group-hover:scale-110 transition-transform duration-700"
                          />
                        </div>

                        <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-full flex justify-center drops-shadow-xl z-10">
                          {getQuantityInCart(item.id) > 0 ? (
                            <div className="flex items-center bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden h-9">
                              <button className="px-3 hover:bg-gray-800 text-white transition-colors" onClick={() => {/* Decrease logic */ }} disabled={!isServiceable}>
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-green-500 font-bold px-2 text-sm">{getQuantityInCart(item.id)}</span>
                              <button className="px-3 hover:bg-gray-800 text-white transition-colors" onClick={() => handleAddToCart(item)} disabled={!isServiceable}>
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <Button
                              onClick={() => handleAddToCart(item)}
                              disabled={!isServiceable}
                              className={`bg-white text-green-700 hover:bg-gray-100 font-extrabold uppercase text-xs h-9 px-6 rounded-xl shadow-xl border border-gray-200 transform group-hover:translate-y-[-2px] transition-all ${!isServiceable ? 'bg-gray-400 text-gray-600 border-gray-500 cursor-not-allowed' : ''}`}
                            >
                              ADD
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Floating Cart Bar (Mobile/Standard) */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-4xl mx-auto animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-green-600 rounded-2xl p-4 shadow-2xl flex justify-between items-center cursor-pointer hover:bg-green-700 transition-colors group" onClick={() => router.push('/customer/cart')}>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-green-100 uppercase tracking-wider">{cartItems.length} Items</span>
              <span className="font-black text-xl text-white">₹{total + 40 + 10} <span className="text-xs font-normal opacity-80 decoration-slice ml-1">plus taxes</span></span>
            </div>
            <div className="flex items-center gap-2 font-bold text-white group-hover:translate-x-1 transition-transform">
              View Cart <ShoppingBag className="w-5 h-5 fill-white/20" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
