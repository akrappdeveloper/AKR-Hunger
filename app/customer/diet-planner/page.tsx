'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Apple, Flame, Target, Beef, Wheat, Droplets,
  Sparkles, UtensilsCrossed, TrendingDown, Dumbbell, Heart,
  ShoppingCart, Store, Leaf, Check, Plus
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import FullscreenToggle from '@/components/customer/FullscreenToggle';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { MenuItem, Restaurant, CartItem } from '@/lib/types';
import { toast } from 'sonner';

const GOALS = [
  { id: 'weight_loss', name: 'Weight Loss & Cut', icon: TrendingDown, color: 'text-blue-500', bg: 'bg-blue-500/10', cal: 1500, p: 130, c: 120, f: 45 },
  { id: 'muscle_gain', name: 'Lean Muscle Bulk', icon: Dumbbell, color: 'text-orange-500', bg: 'bg-orange-500/10', cal: 2600, p: 180, c: 280, f: 75 },
  { id: 'maintenance', name: 'Active Maintenance', icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-500/10', cal: 2000, p: 120, c: 220, f: 60 },
  { id: 'healthy_eating', name: 'Clean & Detox', icon: Heart, color: 'text-pink-500', bg: 'bg-pink-500/10', cal: 1750, p: 100, c: 190, f: 50 },
];

export default function DietPlannerPage() {
  const { user, customer } = useAuth();
  const { addItem } = useCart();

  const [selectedGoal, setSelectedGoal] = useState<string>('maintenance');
  const [calorieTarget, setCalorieTarget] = useState(2000);
  const [vegetarianOnly, setVegetarianOnly] = useState(false);
  const [highProteinOnly, setHighProteinOnly] = useState(false);

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [addedItemIds, setAddedItemIds] = useState<Set<string>>(new Set());

  // Real-time Firestore sync
  useEffect(() => {
    const unsubR = onSnapshot(collection(db, 'restaurants'), snap => {
      setRestaurants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Restaurant)));
    });
    const unsubM = onSnapshot(collection(db, 'menuItems'), snap => {
      setMenuItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as MenuItem)).filter(m => m.available !== false));
    });
    return () => {
      unsubR();
      unsubM();
    };
  }, []);

  // Save goal to Firestore
  const handleSaveDietGoal = async (goalId: string, cal: number) => {
    setSelectedGoal(goalId);
    setCalorieTarget(cal);
    if (!user) return;
    try {
      await updateDoc(doc(db, 'customers', user.uid), {
        dietProfile: {
          goal: goalId,
          calorieTarget: cal,
          vegetarianOnly,
          updatedAt: Timestamp.now(),
        }
      });
      toast.success('Diet profile updated in your account!');
    } catch (e) {}
  };

  const activeGoal = GOALS.find(g => g.id === selectedGoal) || GOALS[2];

  // Matched real healthy dishes from Firestore
  const matchingDishes = useMemo(() => {
    const healthyKeywords = ['salad', 'quinoa', 'oats', 'smoothie', 'boiled', 'protein', 'paneer', 'grilled', 'soup', 'bowl', 'sprout', 'egg', 'fish', 'chicken breast', 'diet', 'green'];
    return menuItems.filter(item => {
      const name = item.name.toLowerCase();
      const cat = (item.category || '').toLowerCase();
      const isHealthyKw = healthyKeywords.some(kw => name.includes(kw) || cat.includes(kw));
      if (!isHealthyKw && (item.calories || 300) > 600) return false;
      if (vegetarianOnly && !item.vegetarian) return false;
      if (highProteinOnly && (item.calories || 300) < 350) return false;
      return true;
    }).slice(0, 15);
  }, [menuItems, vegetarianOnly, highProteinOnly]);

  const handleAddToCart = (dish: MenuItem) => {
    const parentRest = restaurants.find(r => r.id === dish.restaurantId);
    const cartItem: CartItem = {
      id: `${dish.id}-${Date.now()}`,
      menuItemId: dish.id,
      restaurantId: dish.restaurantId || 'healthy-cloud',
      name: dish.name,
      price: dish.price,
      quantity: 1,
      image: dish.image || (dish.images && dish.images[0]) || '',
      restaurantName: parentRest?.name || (dish as any).restaurantName || 'Healthy Gourmet',
      addedAt: new Date(),
    };
    addItem(cartItem);
    setAddedItemIds(prev => new Set(prev).add(dish.id));
    toast.success(`Added "${dish.name}" to cart! 🥗`);
    setTimeout(() => {
      setAddedItemIds(prev => {
        const next = new Set(prev);
        next.delete(dish.id);
        return next;
      });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Full-width Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/70 px-4 sm:px-6 lg:px-8 py-3.5 shadow-xs">
        <div className="w-full max-w-[1700px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/customer">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2 tracking-tight">
                <Apple className="w-6 h-6 text-emerald-500" />
                Diet &amp; Calorie Goal Planner
              </h1>
              <p className="text-xs text-muted-foreground">
                Set personalized calorie targets &amp; discover real macro-balanced dishes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FullscreenToggle className="border border-border/80 rounded-xl" showText={false} />
          </div>
        </div>
      </div>

      {/* Main Full-Width Responsive Container */}
      <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-8">
        
        {/* Goal Selector Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-black flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" /> Select Your Fitness Target
            </h2>
            <span className="text-xs text-muted-foreground font-semibold">Active: {activeGoal.name}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {GOALS.map((goal) => {
              const Icon = goal.icon;
              const isSelected = selectedGoal === goal.id;
              return (
                <Card
                  key={goal.id}
                  onClick={() => handleSaveDietGoal(goal.id, goal.cal)}
                  className={`p-5 cursor-pointer rounded-2xl transition-all border-2 flex items-center justify-between bg-card ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/30 shadow-lg shadow-primary/15'
                      : 'border-border/70 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`w-12 h-12 rounded-xl ${goal.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-6 h-6 ${goal.color}`} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{goal.name}</h4>
                      <p className="text-xs text-primary font-black font-mono mt-0.5">{goal.cal} kcal / day</p>
                    </div>
                  </div>
                  {isSelected && <Badge className="bg-primary text-primary-foreground font-bold text-[10px]">Selected</Badge>}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Macro Targets Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-5 rounded-3xl bg-muted/30 border border-border/70">
          <div className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase">
              <Flame className="w-3.5 h-3.5 text-orange-500" /> Daily Calories
            </span>
            <span className="text-2xl font-black text-foreground font-mono">{calorieTarget} kcal</span>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase">
              <Beef className="w-3.5 h-3.5 text-rose-500" /> Protein Goal
            </span>
            <span className="text-2xl font-black text-rose-600 font-mono">~{activeGoal.p}g</span>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase">
              <Wheat className="w-3.5 h-3.5 text-amber-500" /> Carbs Target
            </span>
            <span className="text-2xl font-black text-amber-600 font-mono">~{activeGoal.c}g</span>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase">
              <Droplets className="w-3.5 h-3.5 text-blue-500" /> Healthy Fats
            </span>
            <span className="text-2xl font-black text-blue-600 font-mono">~{activeGoal.f}g</span>
          </div>
        </div>

        {/* Real Healthy Dishes from Firestore */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg sm:text-2xl font-black text-foreground flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-emerald-500" />
                Dishes Matching Your {activeGoal.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                Showing {matchingDishes.length} nutrient-rich options from local restaurant menus
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={vegetarianOnly ? "default" : "outline"}
                onClick={() => setVegetarianOnly(!vegetarianOnly)}
                className={`rounded-xl text-xs font-bold h-9 gap-1 ${
                  vegetarianOnly ? 'bg-emerald-600 text-white' : ''
                }`}
              >
                <Leaf className="w-3.5 h-3.5" /> Pure Veg Only
              </Button>
              <Button
                size="sm"
                variant={highProteinOnly ? "default" : "outline"}
                onClick={() => setHighProteinOnly(!highProteinOnly)}
                className={`rounded-xl text-xs font-bold h-9 gap-1 ${
                  highProteinOnly ? 'bg-blue-600 text-white' : ''
                }`}
              >
                <Beef className="w-3.5 h-3.5" /> High Protein
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
            {matchingDishes.map((dish) => {
              const parentRest = restaurants.find(r => r.id === dish.restaurantId);
              const isAdded = addedItemIds.has(dish.id);

              return (
                <Card
                  key={dish.id}
                  className="rounded-2xl border border-border/70 hover:border-emerald-500/50 bg-card overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
                >
                  <div className="h-44 relative overflow-hidden bg-muted">
                    <img
                      src={dish.image || (dish.images && dish.images[0]) || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'}
                      alt={dish.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <Badge className="absolute top-2.5 left-2.5 bg-emerald-600 text-white text-[10px] font-bold">
                      🔥 ~{dish.calories || 320} kcal
                    </Badge>
                    <Badge className="absolute bottom-2.5 right-2.5 bg-black/80 text-white font-mono font-bold text-xs">
                      ₹{dish.price}
                    </Badge>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="font-bold text-sm text-foreground line-clamp-1">{dish.name}</h4>
                      {parentRest && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                          <Store className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="truncate">{parentRest.name}</span>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {dish.description || 'Nutrient-dense recipe made with fresh ingredients'}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleAddToCart(dish)}
                      className={`w-full rounded-xl text-xs font-bold transition-all shadow-sm ${
                        isAdded
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
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
        </div>

      </div>
    </div>
  );
}
