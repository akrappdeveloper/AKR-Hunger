'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, ShoppingCart, Heart, Flame, RefreshCw, Check,
  ArrowRight, Leaf, Store, Star, Clock, Filter, Search,
  SlidersHorizontal, Zap, Utensils
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCart } from '@/context/CartContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { MenuItem, Restaurant, CartItem } from '@/lib/types';
import Link from 'next/link';
import { toast } from 'sonner';

interface MoodDefinition {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  color: string;
  badgeBg: string;
  keywords: string[];
  cuisines: string[];
  fallbackDishes: {
    name: string;
    cuisine: string;
    price: number;
    vegetarian: boolean;
    image: string;
    description: string;
  }[];
}

const MOOD_PROFILES: MoodDefinition[] = [
  {
    id: 'rainy',
    name: 'Rainy & Cozy',
    emoji: '🌧️',
    tagline: 'Warm, cozy & steaming hot bites for cozy moments',
    color: 'from-blue-600 to-indigo-700',
    badgeBg: 'bg-blue-500/15 border-blue-500/30 text-blue-500',
    keywords: ['soup', 'chai', 'tea', 'samosa', 'pakora', 'momo', 'curry', 'noodle', 'khichdi', 'broth'],
    cuisines: ['street food', 'chinese', 'north indian', 'beverages'],
    fallbackDishes: [
      { name: 'Adrak Masala Chai with Samosas', cuisine: 'Street Food', price: 99, vegetarian: true, image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500', description: 'Freshly brewed ginger cardamom tea paired with golden fried samosas' },
      { name: 'Steaming Hot Sweet Corn Soup', cuisine: 'Chinese', price: 149, vegetarian: true, image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500', description: 'Velvety comforting soup infused with fresh sweet corn kernels & scallions' },
      { name: 'Crispy Onion & Paneer Pakoras', cuisine: 'Snacks', price: 129, vegetarian: true, image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500', description: 'Crunchy gram flour fritters served with tangy mint chutney' }
    ]
  },
  {
    id: 'stressed',
    name: 'Stress Buster',
    emoji: '🧘',
    tagline: 'Melt the fatigue away with rich comfort flavors',
    color: 'from-purple-600 to-pink-600',
    badgeBg: 'bg-purple-500/15 border-purple-500/30 text-purple-500',
    keywords: ['pizza', 'pasta', 'cheese', 'brownie', 'chocolate', 'dal makhani', 'naan', 'dessert', 'lasagna', 'burger'],
    cuisines: ['italian', 'dessert', 'north indian', 'continental'],
    fallbackDishes: [
      { name: 'Creamy Truffle Mac & Cheese', cuisine: 'Italian', price: 249, vegetarian: true, image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=500', description: 'Four-cheese baked macaroni topped with aromatic herbs' },
      { name: 'Gooey Lava Chocolate Brownie', cuisine: 'Dessert', price: 139, vegetarian: true, image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500', description: 'Warm dark chocolate cake with a molten center of Belgian chocolate' },
      { name: 'Butter Garlic Naan with Dal Makhani', cuisine: 'North Indian', price: 219, vegetarian: true, image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500', description: 'Slow cooked black lentils simmered overnight with butter and cream' }
    ]
  },
  {
    id: 'midnight',
    name: 'Midnight Munchies',
    emoji: '🌙',
    tagline: 'Late night cravings? We have your hunger covered',
    color: 'from-amber-600 to-red-600',
    badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-500',
    keywords: ['burger', 'fries', 'wings', 'sandwich', 'roll', 'wrap', 'shake', 'pizza', 'nachos', 'shawarma'],
    cuisines: ['fast food', 'burgers', 'american', 'continental'],
    fallbackDishes: [
      { name: 'Loaded Double Smash Burger', cuisine: 'Fast Food', price: 229, vegetarian: false, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500', description: 'Juicy smashed patties, caramelized onions and double cheddar' },
      { name: 'Peri-Peri Cheesy Crinkle Fries', cuisine: 'Sides', price: 119, vegetarian: true, image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=500', description: 'Golden seasoned crinkle fries smothered in warm cheese sauce' },
      { name: 'BBQ Paneer Personal Pan Pizza', cuisine: 'Italian', price: 199, vegetarian: true, image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500', description: 'Crispy pan crust loaded with smoky bbq sauce and grilled paneer' }
    ]
  },
  {
    id: 'workout',
    name: 'Fitness & Fuel',
    emoji: '🏋️',
    tagline: 'High protein bowls to nourish muscles and restore energy',
    color: 'from-emerald-600 to-teal-600',
    badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500',
    keywords: ['quinoa', 'salad', 'protein', 'chicken', 'paneer tikka', 'egg', 'smoothie', 'bowl', 'sprout', 'grilled'],
    cuisines: ['healthy', 'diet', 'salads', 'continental'],
    fallbackDishes: [
      { name: 'Grilled Herb Chicken Quinoa Bowl', cuisine: 'Healthy', price: 289, vegetarian: false, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500', description: '38g protein bowl with tender chicken breast, quinoa & avocado' },
      { name: 'High-Protein Paneer Tikka Bowl', cuisine: 'Healthy', price: 239, vegetarian: true, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500', description: 'Roasted cottage cheese chunks, brown rice & steamed broccoli' },
      { name: 'Peanut Butter Whey Protein Shake', cuisine: 'Beverages', price: 149, vegetarian: true, image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500', description: 'Blended with natural peanut butter, organic oats, and 28g whey' }
    ]
  },
  {
    id: 'celebration',
    name: 'Royal Celebration',
    emoji: '🎉',
    tagline: 'Grand aromatic biryanis & rich curries for special days',
    color: 'from-orange-500 to-amber-600',
    badgeBg: 'bg-orange-500/15 border-orange-500/30 text-orange-500',
    keywords: ['biryani', 'mutton', 'kebab', 'tikka', 'butter chicken', 'feast', 'platter', 'thali', 'shahi', 'dum'],
    cuisines: ['biryani', 'mughlai', 'north indian'],
    fallbackDishes: [
      { name: 'Hyderabadi Dum Chicken Biryani', cuisine: 'Biryani', price: 349, vegetarian: false, image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500', description: 'Slow cooked aromatic basmati rice layered with spiced tender chicken' },
      { name: 'Butter Chicken Masala Deluxe', cuisine: 'North Indian', price: 299, vegetarian: false, image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=500', description: 'Tandoori chicken simmered in rich velvety tomato cashew gravy' },
      { name: 'Royal Gulab Jamun with Rabdi Pot', cuisine: 'Dessert', price: 119, vegetarian: true, image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500', description: 'Warm soft gulab jamuns served atop rich reduced saffron milk' }
    ]
  },
  {
    id: 'quick',
    name: 'Quick 20-Min Rush',
    emoji: '⚡',
    tagline: 'In a hurry? Ultra-fast freshly prepared bites on the go',
    color: 'from-yellow-500 to-orange-600',
    badgeBg: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-600',
    keywords: ['wrap', 'roll', 'sandwich', 'kathi', 'frankie', 'snack', 'dosa', 'toast', 'juice'],
    cuisines: ['fast food', 'south indian', 'street food'],
    fallbackDishes: [
      { name: 'Paneer Kathi Roll Special', cuisine: 'Street Food', price: 139, vegetarian: true, image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500', description: 'Flaky paratha rolled with spiced paneer tikka, onions and mint chutney' },
      { name: 'Crispy Grilled Cheese Club Sandwich', cuisine: 'Continental', price: 159, vegetarian: true, image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500', description: 'Triple-decker sandwich with melted cheddar, crisp veggies and herb mayo' },
      { name: 'Fresh Masala Dosa with Chutneys', cuisine: 'South Indian', price: 119, vegetarian: true, image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500', description: 'Golden crepe stuffed with potato masala, served with piping hot sambar' }
    ]
  },
  {
    id: 'sweet',
    name: 'Sweet Tooth Bliss',
    emoji: '🍰',
    tagline: 'Indulgent sugary creations to brighten up your mood',
    color: 'from-pink-500 to-rose-600',
    badgeBg: 'bg-pink-500/15 border-pink-500/30 text-pink-500',
    keywords: ['dessert', 'cake', 'ice cream', 'pastry', 'shake', 'waffle', 'cookie', 'sweet', 'halwa', 'pie'],
    cuisines: ['desserts', 'bakery', 'beverages'],
    fallbackDishes: [
      { name: 'Belgian Chocolate Waffle with Scoop', cuisine: 'Desserts', price: 189, vegetarian: true, image: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=500', description: 'Crisp waffle smothered in warm milk & dark Belgian chocolate with gelato' },
      { name: 'New York Baked Berry Cheesecake', cuisine: 'Bakery', price: 199, vegetarian: true, image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=500', description: 'Creamy classic cheesecake topped with sweet wild blueberry compote' },
      { name: 'Nutella Thick Shake Supreme', cuisine: 'Beverages', price: 169, vegetarian: true, image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500', description: 'Rich blended shake with roasted hazelnuts, whipped cream and cocoa' }
    ]
  },
  {
    id: 'zen',
    name: 'Pure Green & Zen',
    emoji: '🌿',
    tagline: '100% vegetarian, organic, light and refreshing dishes',
    color: 'from-teal-600 to-emerald-700',
    badgeBg: 'bg-teal-500/15 border-teal-500/30 text-teal-600',
    keywords: ['veg', 'paneer', 'dal', 'salad', 'juice', 'jain', 'tofu', 'organic', 'green', 'detox'],
    cuisines: ['healthy', 'south indian', 'north indian'],
    fallbackDishes: [
      { name: 'Avocado Green Goddess Super Bowl', cuisine: 'Healthy', price: 249, vegetarian: true, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500', description: 'Fresh crisp greens, creamy avocado slices, edamame and lemon vinaigrette' },
      { name: 'Classic Steamed Idli & Medu Vada Combo', cuisine: 'South Indian', price: 129, vegetarian: true, image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500', description: 'Steamed rice cakes and crispy lentil donuts served with coconut chutney' },
      { name: 'Fresh Cold-Pressed Detox Green Juice', cuisine: 'Beverages', price: 119, vegetarian: true, image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500', description: 'Cucumber, green apple, celery, spinach, ginger and mint' }
    ]
  }
];

export default function MoodFoodMatcher() {
  const [selectedMood, setSelectedMood] = useState<MoodDefinition>(MOOD_PROFILES[0]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const { addItem } = useCart();

  // Listen to live restaurants and menu items in Firestore
  useEffect(() => {
    const unsubR = onSnapshot(collection(db, 'restaurants'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Restaurant));
      setRestaurants(list);
    });

    const unsubM = onSnapshot(collection(db, 'menuItems'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as MenuItem));
      setMenuItems(list);
    });

    return () => {
      unsubR();
      unsubM();
    };
  }, []);

  // Compute matched dishes from real Firestore database for the selected mood
  const matchedDishes = useMemo(() => {
    const keywords = selectedMood.keywords;
    const targetCuisines = selectedMood.cuisines;

    // Filter real items in Firestore
    let realMatches = menuItems.filter(item => {
      const name = item.name?.toLowerCase() || '';
      const cat = item.category?.toLowerCase() || '';
      const desc = item.description?.toLowerCase() || '';

      const matchKw = keywords.some(kw => name.includes(kw) || cat.includes(kw) || desc.includes(kw));
      const matchCuisine = targetCuisines.some(c => cat.includes(c));

      return matchKw || matchCuisine;
    });

    // If dietary filter is applied
    if (dietaryFilter === 'veg') {
      realMatches = realMatches.filter(item => item.vegetarian);
    } else if (dietaryFilter === 'non-veg') {
      realMatches = realMatches.filter(item => !item.vegetarian);
    }

    // If search query is applied
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      realMatches = realMatches.filter(item =>
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
      );
    }

    // Convert real items into uniform display model
    const result = realMatches.map(item => {
      const parentRest = restaurants.find(r => r.id === item.restaurantId);
      return {
        id: item.id,
        menuItemId: item.id,
        restaurantId: item.restaurantId || (restaurants[0]?.id || 'hunger-curated'),
        restaurantName: parentRest?.name || (item as any).restaurantName || 'Gourmet Partner',
        name: item.name,
        cuisine: item.category || 'Specialty',
        price: item.price,
        vegetarian: item.vegetarian,
        calories: item.calories || 320,
        image: item.image || (item.images && item.images[0]) || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
        description: item.description || 'Prepared fresh with authentic spices & quality ingredients',
        isReal: true,
      };
    });

    // If Firestore has fewer than 3 items for this specific mood, supplement with fallback items
    // but link them to real active restaurant IDs from Firestore so adding to cart is 100% valid!
    if (result.length < 3) {
      const defaultRest = restaurants[0] || { id: 'hunger-kitchen', name: 'Hunger Curated Kitchen' };
      const neededCount = 3 - result.length;

      const supplementary = selectedMood.fallbackDishes
        .filter(f => {
          if (dietaryFilter === 'veg') return f.vegetarian;
          if (dietaryFilter === 'non-veg') return !f.vegetarian;
          return true;
        })
        .slice(0, neededCount)
        .map((f, idx) => ({
          id: `curated-${selectedMood.id}-${idx}`,
          menuItemId: `curated-${selectedMood.id}-${idx}`,
          restaurantId: defaultRest.id || 'hunger-kitchen',
          restaurantName: defaultRest.name || 'Hunger Curated Kitchen',
          name: f.name,
          cuisine: f.cuisine,
          price: f.price,
          vegetarian: f.vegetarian,
          calories: 340,
          image: f.image,
          description: f.description,
          isReal: false,
        }));

      return [...result, ...supplementary];
    }

    return result;
  }, [selectedMood, menuItems, restaurants, dietaryFilter, searchQuery]);

  // Add individual dish to cart
  const handleAddDish = (dish: any) => {
    addItem({
      id: `${dish.menuItemId}-${Date.now()}`,
      menuItemId: dish.menuItemId,
      restaurantId: dish.restaurantId,
      name: dish.name,
      price: dish.price,
      quantity: 1,
      image: dish.image,
      restaurantName: dish.restaurantName,
      addedAt: new Date(),
    });
    setAddedItems(prev => new Set(prev).add(dish.id));
    toast.success(`Added "${dish.name}" from ${dish.restaurantName} to cart! 😋`);
    setTimeout(() => {
      setAddedItems(prev => {
        const next = new Set(prev);
        next.delete(dish.id);
        return next;
      });
    }, 2500);
  };

  // Add entire combo platter (top 3 dishes)
  const handleAddEntirePlatter = () => {
    const platterItems = matchedDishes.slice(0, 3);
    if (platterItems.length === 0) {
      toast.error('No dishes available in this combo platter');
      return;
    }

    platterItems.forEach(dish => {
      addItem({
        id: `${dish.menuItemId}-${Date.now()}-${Math.random()}`,
        menuItemId: dish.menuItemId,
        restaurantId: dish.restaurantId,
        name: dish.name,
        price: dish.price,
        quantity: 1,
        image: dish.image,
        restaurantName: dish.restaurantName,
        addedAt: new Date(),
      });
    });

    toast.success(`Added entire "${selectedMood.name}" combo (${platterItems.length} dishes) to your cart! 🚀`);
  };

  const comboTotal = matchedDishes.slice(0, 3).reduce((sum, d) => sum + d.price, 0);

  return (
    <div className="w-full space-y-8">
      {/* Mood Selector Header Toolbar */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              What Are You Craving Right Now?
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select your emotional vibe &amp; our AI matches real dishes from top local restaurants
            </p>
          </div>

          {/* Dietary Filter & Search */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/60 text-xs font-semibold">
              <button
                onClick={() => setDietaryFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  dietaryFilter === 'all' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setDietaryFilter('veg')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  dietaryFilter === 'veg' ? 'bg-emerald-600 text-white shadow-xs' : 'text-muted-foreground hover:text-emerald-500'
                }`}
              >
                <Leaf className="w-3 h-3" /> Pure Veg
              </button>
              <button
                onClick={() => setDietaryFilter('non-veg')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  dietaryFilter === 'non-veg' ? 'bg-rose-600 text-white shadow-xs' : 'text-muted-foreground hover:text-rose-500'
                }`}
              >
                <Flame className="w-3 h-3" /> Non-Veg
              </button>
            </div>

            <div className="relative w-44 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search dishes..."
                className="pl-8 py-1.5 h-8 text-xs rounded-xl bg-card border-border"
              />
            </div>
          </div>
        </div>

        {/* Mood Selection Pills Bar (Responsive scrollable) */}
        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide py-1">
          {MOOD_PROFILES.map(mood => {
            const isSelected = selectedMood.id === mood.id;
            return (
              <button
                key={mood.id}
                onClick={() => setSelectedMood(mood)}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-300 border ${
                  isSelected
                    ? `bg-gradient-to-r ${mood.color} text-white border-transparent shadow-lg scale-105`
                    : 'bg-card text-muted-foreground border-border/80 hover:border-primary/50 hover:text-foreground'
                }`}
              >
                <span className="text-xl sm:text-2xl filter drop-shadow">{mood.emoji}</span>
                <span>{mood.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hero Mood Platter Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedMood.id}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {/* Ambient Banner */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-96 h-96 bg-gradient-to-br ${selectedMood.color} opacity-10 rounded-full blur-3xl pointer-events-none`} />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 pb-6 border-b border-border/60">
              <div className="flex items-center gap-4">
                <span className="text-4xl sm:text-5xl drop-shadow">{selectedMood.emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${selectedMood.badgeBg} font-bold text-xs`}>
                      Curated For Your Mood
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {matchedDishes.length} Matches Found
                    </span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-foreground mt-1">
                    {selectedMood.name} Feast
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {selectedMood.tagline}
                  </p>
                </div>
              </div>

              {matchedDishes.length > 0 && (
                <div className="flex items-center gap-3 self-start md:self-auto">
                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                      3-Dish Combo Total
                    </span>
                    <span className="text-xl font-black text-primary font-mono">
                      ₹{comboTotal}
                    </span>
                  </div>
                  <Button
                    onClick={handleAddEntirePlatter}
                    size="lg"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-black rounded-2xl shadow-xl shadow-primary/25 gap-2 px-6"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Add Combo ({Math.min(3, matchedDishes.length)} items) • ₹{comboTotal}
                  </Button>
                </div>
              )}
            </div>

            {/* Dishes Grid - Full Screen Responsive (1 col mobile, 2 sm, 3 md, 4 lg, 5 xl) */}
            <div className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-black text-base sm:text-lg flex items-center gap-2 text-foreground">
                  <Utensils className="w-4 h-4 text-primary" />
                  Recommended Dishes from Real Menus
                </h4>
                <span className="text-xs text-muted-foreground font-semibold">
                  Showing {matchedDishes.length} items
                </span>
              </div>

              {matchedDishes.length === 0 ? (
                <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-border p-6 space-y-2">
                  <Utensils className="w-10 h-10 mx-auto text-muted-foreground" />
                  <p className="font-bold text-foreground">No dishes matching current dietary filter</p>
                  <Button variant="outline" size="sm" onClick={() => setDietaryFilter('all')}>
                    Reset to All Dishes
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
                  {matchedDishes.map((dish) => {
                    const isAdded = addedItems.has(dish.id);
                    return (
                      <Card
                        key={dish.id}
                        className="rounded-2xl border border-border/70 hover:border-primary/50 bg-background overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
                      >
                        {/* Image & Badges */}
                        <div className="h-44 relative overflow-hidden bg-muted">
                          <img
                            src={dish.image}
                            alt={dish.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e: any) => {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
                            }}
                          />
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
                          </div>
                          <Badge className="absolute bottom-2.5 right-2.5 bg-black/75 text-white backdrop-blur-md text-[10px] font-mono font-bold">
                            ₹{dish.price}
                          </Badge>
                        </div>

                        {/* Details */}
                        <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                          <div>
                            <h4 className="font-bold text-sm text-foreground line-clamp-1">
                              {dish.name}
                            </h4>
                            <p className="text-[11px] text-primary font-semibold flex items-center gap-1 mt-0.5 truncate">
                              <Store className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{dish.restaurantName}</span>
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">
                              {dish.description}
                            </p>
                          </div>

                          {/* Action Button */}
                          <Button
                            size="sm"
                            variant={isAdded ? "outline" : "default"}
                            onClick={() => handleAddDish(dish)}
                            className={`w-full rounded-xl text-xs font-bold transition-all shadow-md ${
                              isAdded
                                ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <Check className="w-3.5 h-3.5 mr-1" /> Added to Order
                              </>
                            ) : (
                              <>
                                <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Add • ₹{dish.price}
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
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
