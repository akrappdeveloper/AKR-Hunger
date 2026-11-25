'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, Plus, Check, Utensils, Sparkles,
  ArrowRight, ArrowLeft, ShoppingCart, Store, ShieldCheck, Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import FullscreenToggle from '@/components/customer/FullscreenToggle';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, Timestamp } from 'firebase/firestore';
import { MenuItem, Restaurant, CartItem } from '@/lib/types';
import Link from 'next/link';
import { toast } from 'sonner';

interface DayPlan {
  day: string;
  breakfast: string;
  breakfastPrice: number;
  lunch: string;
  lunchPrice: number;
  dinner: string;
  dinnerPrice: number;
  calories: number;
}

const WEEK_PLAN: DayPlan[] = [
  { day: 'Monday', breakfast: 'Idli Vada & Filter Coffee', breakfastPrice: 89, lunch: 'Paneer Butter Masala Thali', lunchPrice: 169, dinner: 'Dal Tadka with Phulkas', dinnerPrice: 139, calories: 1650 },
  { day: 'Tuesday', breakfast: 'Poha with Mint Chutney', breakfastPrice: 79, lunch: 'Rajma Chawal with Kachumber', lunchPrice: 149, dinner: 'Palak Paneer with Roti', dinnerPrice: 159, calories: 1580 },
  { day: 'Wednesday', breakfast: 'Masala Omelette Toast', breakfastPrice: 99, lunch: 'Chicken Dum Biryani Pot', lunchPrice: 229, dinner: 'Mixed Vegetable Khichdi', dinnerPrice: 129, calories: 1720 },
  { day: 'Thursday', breakfast: 'Upma with Coconut Chutney', breakfastPrice: 69, lunch: 'Chole Bhature Deluxe', lunchPrice: 159, dinner: 'Kadai Mushroom with Roti', dinnerPrice: 149, calories: 1690 },
  { day: 'Friday', breakfast: 'Aloo Paratha with Curd', breakfastPrice: 89, lunch: 'Egg Curry Rice Bowl', lunchPrice: 169, dinner: 'Gourmet Personal Pan Pizza', dinnerPrice: 199, calories: 1840 },
  { day: 'Saturday', breakfast: 'Club Sandwich & Fresh Juice', breakfastPrice: 129, lunch: 'Royal Mutton Rogan Josh Thali', lunchPrice: 299, dinner: 'Hakka Noodles & Manchurian', dinnerPrice: 189, calories: 1950 },
  { day: 'Sunday', breakfast: 'South Indian Dosa Feast', breakfastPrice: 119, lunch: 'Special Sunday Grand Thali', lunchPrice: 249, dinner: 'Grilled Sub & Chocolate Brownie', dinnerPrice: 179, calories: 1900 },
];

export default function MealPlannerPage() {
  const { user } = useAuth();
  const { addItem } = useCart();

  const [selectedDay, setSelectedDay] = useState<DayPlan>(WEEK_PLAN[0]);
  const [subscribed, setSubscribed] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [addedSlots, setAddedSlots] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'restaurants'), snap => {
      setRestaurants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Restaurant)));
    });
    return () => unsub();
  }, []);

  const handleSubscribeTiffin = async () => {
    if (user?.uid) {
      try {
        await setDoc(doc(db, 'customers', user.uid, 'mealPlans', 'weekly_subscription'), {
          plan: '7-Day Gourmet Home Tiffin',
          status: 'active',
          activatedAt: Timestamp.now(),
        }, { merge: true });
      } catch (e) {}
    }
    setSubscribed(true);
    toast.success('🎉 Weekly Tiffin Subscription activated in your Hunger account!');
  };

  const handleAddSlotToCart = (slotName: string, mealName: string, price: number) => {
    const defaultRest = restaurants[0] || { id: 'tiffin-hub', name: 'Hunger Home-Style Kitchen' };
    const cartItem: CartItem = {
      id: `tiffin-${selectedDay.day}-${slotName}-${Date.now()}`,
      menuItemId: `tiffin-${mealName.toLowerCase().replace(/\s+/g, '-')}`,
      restaurantId: defaultRest.id || 'tiffin-hub',
      name: `${selectedDay.day} ${slotName}: ${mealName}`,
      price: price,
      quantity: 1,
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
      restaurantName: defaultRest.name || 'Hunger Home-Style Kitchen',
      addedAt: new Date(),
    };
    addItem(cartItem);
    const key = `${selectedDay.day}-${slotName}`;
    setAddedSlots(prev => new Set(prev).add(key));
    toast.success(`Added ${selectedDay.day}'s ${slotName} to cart! 🍲`);
    setTimeout(() => {
      setAddedSlots(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 2000);
  };

  const handleAddFullDayTiffin = () => {
    handleAddSlotToCart('Breakfast', selectedDay.breakfast, selectedDay.breakfastPrice);
    handleAddSlotToCart('Lunch', selectedDay.lunch, selectedDay.lunchPrice);
    handleAddSlotToCart('Dinner', selectedDay.dinner, selectedDay.dinnerPrice);
    toast.success(`Added full day's tiffin for ${selectedDay.day} to cart! 🚀`);
  };

  const dailyTotal = selectedDay.breakfastPrice + selectedDay.lunchPrice + selectedDay.dinnerPrice;

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
                <Calendar className="w-6 h-6 text-primary" />
                Weekly Tiffin &amp; Meal Planner
              </h1>
              <p className="text-xs text-muted-foreground">
                Automated scheduled home-style meals, freshly cooked and delivered daily
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
        
        {/* Day Selector Ribbon */}
        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide py-1">
          {WEEK_PLAN.map(item => {
            const isSelected = selectedDay.day === item.day;
            return (
              <button
                key={item.day}
                onClick={() => setSelectedDay(item)}
                className={`px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-105'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                }`}
              >
                {item.day}
              </button>
            );
          })}
        </div>

        {/* Selected Day Meals Card & 1-Click Order Platter */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Day Meal Slots (8 cols on lg) */}
          <div className="lg:col-span-8 space-y-4">
            <Card className="p-6 sm:p-8 rounded-3xl border border-border/70 shadow-md space-y-6 bg-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl sm:text-3xl font-black text-foreground">{selectedDay.day} Tiffin Menu</h2>
                    <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 font-bold text-xs">
                      Chef Curated Home-Style
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Estimated Daily Nutrition: ~{selectedDay.calories} kcal • Clean Homestyle Oils
                  </p>
                </div>

                <Button
                  onClick={handleAddFullDayTiffin}
                  size="default"
                  className="rounded-2xl font-black bg-primary text-primary-foreground shadow-lg shadow-primary/25 gap-2"
                >
                  <ShoppingCart className="w-4 h-4" /> Add All 3 Meals (₹{dailyTotal})
                </Button>
              </div>

              {/* Meal Slots List */}
              <div className="space-y-4">
                {[
                  { slot: 'Breakfast', time: '8:00 AM - 9:30 AM', meal: selectedDay.breakfast, price: selectedDay.breakfastPrice, icon: '☕', desc: 'Light, energizing morning bite prepared fresh with authentic chutneys' },
                  { slot: 'Lunch', time: '12:30 PM - 2:00 PM', meal: selectedDay.lunch, price: selectedDay.lunchPrice, icon: '🍲', desc: 'Hearty homestyle thali with fresh phulkas, dal and seasonal gravy' },
                  { slot: 'Dinner', time: '7:30 PM - 9:00 PM', meal: selectedDay.dinner, price: selectedDay.dinnerPrice, icon: '🍛', desc: 'Comforting, easily digestible evening meal to end the day satisfied' },
                ].map(({ slot, time, meal, price, icon, desc }) => {
                  const key = `${selectedDay.day}-${slot}`;
                  const isAdded = addedSlots.has(key);

                  return (
                    <div
                      key={slot}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-2xl bg-muted/30 border border-border/60 hover:border-primary/40 transition-all gap-4"
                    >
                      <div className="flex items-start gap-4">
                        <span className="text-3xl sm:text-4xl filter drop-shadow mt-0.5">{icon}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-xs uppercase tracking-wider text-primary">{slot}</span>
                            <span className="text-xs text-muted-foreground">• {time}</span>
                          </div>
                          <h4 className="font-bold text-base text-foreground mt-0.5">{meal}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{desc}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-auto shrink-0">
                        <span className="font-black text-base text-foreground font-mono">₹{price}</span>
                        <Button
                          size="sm"
                          variant={isAdded ? "outline" : "default"}
                          onClick={() => handleAddSlotToCart(slot, meal, price)}
                          className={`rounded-xl text-xs font-bold gap-1 ${
                            isAdded ? 'bg-emerald-600 text-white border-emerald-600' : ''
                          }`}
                        >
                          {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          {isAdded ? 'Added' : 'Add Slot'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Right Column: Weekly Subscription & Perks (4 cols on lg) */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="p-6 rounded-3xl border border-border/70 shadow-md space-y-5 bg-gradient-to-br from-card via-card to-primary/5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="font-black text-lg text-foreground">Weekly Tiffin Pass</h3>
              </div>

              <div className="space-y-3 text-xs text-muted-foreground">
                <p>
                  Never worry about what to eat or cook every day. Our daily tiffin service delivers home-style, low-oil dishes on auto-pilot.
                </p>
                <div className="p-3.5 rounded-2xl bg-card border border-border space-y-1.5 font-semibold text-foreground">
                  <div className="flex justify-between">
                    <span>Weekly 7-Day Plan:</span>
                    <span className="font-bold text-primary">₹1,999 / week</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground font-normal">
                    <span>Free Delivery:</span>
                    <span className="text-emerald-500 font-bold">100% Free</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground font-normal">
                    <span>Cancel Anytime:</span>
                    <span>Yes, 1-Click Pause</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSubscribeTiffin}
                className="w-full rounded-2xl font-black bg-emerald-600 hover:bg-emerald-700 text-white h-11 shadow-lg shadow-emerald-600/20"
              >
                {subscribed ? '✓ Weekly Plan Active' : 'Activate Weekly Tiffin Plan'}
              </Button>
            </Card>
          </div>

        </div>

      </div>
    </div>
  );
}
