'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Restaurant, MenuItem, CartItem } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, Clock, MapPin, ArrowLeft, Heart, Search, Share2, Plus, Minus, CheckCircle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function RestaurantPage() {
  const params = useParams();
  const router = useRouter();
  const { addItem, items: cartItems } = useCart();
  const restaurantId = params.id as string;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isHeaderSticky, setIsHeaderSticky] = useState(false);
  const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Custom scroll listener for sticky header effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 200) {
        setIsHeaderSticky(true);
      } else {
        setIsHeaderSticky(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/restaurants/${restaurantId}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Failed to fetch restaurant');

        setRestaurant(data.restaurant as Restaurant);

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
  }, [restaurantId]);

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
    toast.success(`Added ${item.name} to cart`);
  };

  const filteredItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-4 space-y-8 animate-pulse">
        <div className="h-64 bg-gray-900 rounded-3xl" />
        <div className="h-8 w-1/2 bg-gray-900 rounded" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-900 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!restaurant) return null;

  return (
    <div className="min-h-screen bg-black text-white pb-24 font-sans selection:bg-orange-500/30">

      {/* 1. Header Actions (Back/Share) */}
      <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isHeaderSticky ? 'bg-black/90 backdrop-blur-md shadow-lg py-3' : 'bg-transparent py-4'}`}>
        <div className="max-w-3xl mx-auto px-4 flex justify-between items-center">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm border border-white/10">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm border border-white/10">
              <Search className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm border border-white/10">
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Sticky Category Bar */}
        <div className={`mt-2 overflow-x-auto scrollbar-hide border-b border-gray-800 transition-all duration-500 ${isHeaderSticky ? 'opacity-100 max-h-20' : 'opacity-0 max-h-0'}`}>
          <div className="max-w-3xl mx-auto px-4 flex gap-4 pb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => scrollToCategory(cat)}
                className={`text-sm font-medium whitespace-nowrap px-4 py-1.5 rounded-full transition-all ${activeCategory === cat ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Parallax Cover & Info Card */}
      <div className="relative w-full h-80 md:h-96">
        <Image
          src={restaurant.image || "/placeholder.svg"}
          alt={restaurant.name}
          fill
          className="object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 max-w-3xl mx-auto">
          <div className="bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500" />

            <div className="flex justify-between items-start mb-2">
              <h1 className="text-2xl md:text-4xl font-extrabold text-white leading-tight">{restaurant.name}</h1>
              <div className="bg-green-600 text-white px-2 py-1 rounded-lg text-sm font-bold flex items-center gap-1 shadow-lg shadow-green-900/20">
                {(restaurant.rating || 4.2).toFixed(1)} <Star className="w-3 h-3 fill-white" />
              </div>
            </div>

            <p className="text-gray-300 text-sm mb-4 line-clamp-2">{restaurant.description || 'Serving delicious food with love.'}</p>

            <div className="flex items-center gap-4 text-xs font-medium text-gray-400 border-t border-white/10 pt-4 border-dashed">
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-orange-400" /> {restaurant.deliveryTime} mins</span>
              <span className="w-1 h-1 bg-gray-600 rounded-full" />
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-orange-400" /> 2.5 km</span>
              <span className="w-1 h-1 bg-gray-600 rounded-full" />
              <span className="text-gray-300">Min Order ₹{restaurant.minimumOrder}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Menu Content */}
      <div className="max-w-3xl mx-auto px-4 pt-4 relative z-10">

        {/* Categories (Static) */}
        {!isHeaderSticky && (
          <div className="mb-8">
            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => scrollToCategory(cat)}
                  className={`flex flex-col items-center gap-2 min-w-[5rem] p-3 rounded-2xl border transition-all ${activeCategory === cat ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-900/50 border-gray-800 text-gray-500'}`}
                >
                  <span className="text-2xl">🍽️</span>
                  <span className="text-xs font-bold">{cat}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Menu Items List */}
        <div className="space-y-8">
          {categories.map((category) => {
            const categoryItems = filteredItems.filter(item => item.category === category);
            if (categoryItems.length === 0) return null;

            return (
              <div key={category} ref={(el) => (categoryRefs.current[category] = el)} className="scroll-mt-40">
                <h2 className="text-xl font-bold mb-4 text-gray-200 flex items-center gap-2">
                  {category} <span className="text-sm font-normal text-gray-600">({categoryItems.length})</span>
                </h2>

                <div className="space-y-6">
                  {categoryItems.map(item => (
                    <div key={item.id} className="group relative bg-transparent border-b border-gray-800/50 pb-6 mb-6 last:border-0 last:mb-0 flex gap-4">
                      {/* Text Info */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start gap-2">
                          {item.vegetarian ? (
                            <Badge variant="outline" className="border-green-500/50 bg-green-500/10 text-green-500 h-5 w-5 p-0 flex items-center justify-center rounded-sm">
                              <div className="w-2 h-2 bg-green-500 rounded-full" />
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-red-500/50 bg-red-500/10 text-red-500 h-5 w-5 p-0 flex items-center justify-center rounded-sm">
                              <div className="w-2 h-2 bg-red-500 rounded-full" />
                            </Badge>
                          )}
                          {item.isBestSeller && (
                            <span className="text-[10px] font-bold text-yellow-500 flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-yellow-500" /> Bestseller
                            </span>
                          )}
                        </div>

                        <h3 className="font-bold text-gray-100 text-lg group-hover:text-orange-400 transition-colors">{item.name}</h3>
                        <div className="font-medium text-white">₹{item.price}</div>

                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className={`w-3 h-3 ${star <= (item.averageRating || 4) ? 'fill-yellow-500 text-yellow-500' : 'text-gray-700'}`} />
                          ))}
                          <span className="text-xs text-gray-500 ml-1">({Math.floor(Math.random() * 50) + 10})</span>
                        </div>

                        <p className="text-sm text-gray-500 line-clamp-2">{item.description}</p>
                      </div>

                      {/* Image & Add Button */}
                      <div className="relative w-36 h-32 flex-shrink-0">
                        <div className="w-full h-full rounded-2xl overflow-hidden bg-gray-900 shadow-md">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>

                        <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
                          {getQuantityInCart(item.id) > 0 ? (
                            <div className="flex items-center bg-gray-900 border border-gray-700 rounded-lg shadow-xl shadow-black/50 overflow-hidden">
                              <button className="p-2 hover:bg-gray-800 text-white" onClick={() => {/* Decrease logic */ }}>
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="text-green-500 font-bold px-1">{getQuantityInCart(item.id)}</span>
                              <button className="p-2 hover:bg-gray-800 text-white" onClick={() => handleAddToCart(item)}>
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <Button
                              onClick={() => handleAddToCart(item)}
                              className="bg-white text-green-600 hover:bg-gray-100 font-extrabold uppercase text-xs h-9 px-6 shadow-xl shadow-black/20"
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
    </div>
  );
}
