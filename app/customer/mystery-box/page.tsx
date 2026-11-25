'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package, Gift, Sparkles, ShieldCheck, CheckCircle2,
  ShoppingCart, Dices, Flame, Leaf, Heart, RotateCcw,
  Star, Award, ArrowLeft, Check, Store
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import FullscreenToggle from '@/components/customer/FullscreenToggle';
import { toast } from 'sonner';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, Timestamp } from 'firebase/firestore';
import { Restaurant, CartItem } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';

type BoxTier = 'bronze' | 'silver' | 'gold';
type FoodPref = 'veg' | 'nonveg' | 'dessert' | 'fit';
type SpiceLevel = 'mild' | 'medium' | 'hot';

export default function MysteryBoxPage() {
  const { addItem } = useCart();
  const { user } = useAuth();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [tier, setTier] = useState<BoxTier>('silver');
  const [pref, setPref] = useState<FoodPref>('nonveg');
  const [spice, setSpice] = useState<SpiceLevel>('medium');
  const [isRevealed, setIsRevealed] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'restaurants'), snap => {
      setRestaurants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Restaurant)));
    });
    return () => unsub();
  }, []);

  const TIER_DATA = {
    bronze: {
      name: 'Bronze Mystery Box',
      price: 199,
      worth: '₹350+',
      itemsCount: '2 Items (1 Gourmet Main + 1 Side)',
      color: 'from-amber-700 to-amber-900',
      badge: 'Bite Size Wonder',
      desc: 'Affordable surprise meal curated by top local cloud kitchens',
    },
    silver: {
      name: 'Silver Surprise Feast',
      price: 399,
      worth: '₹650+',
      itemsCount: '3 Items (2 Signature Dishes + 1 Dessert/Beverage)',
      color: 'from-slate-400 to-slate-700',
      badge: 'Most Popular',
      desc: 'Our bestselling blind box featuring chef-curated signature combos',
    },
    gold: {
      name: 'Gold Chef Royal Box',
      price: 699,
      worth: '₹1,150+',
      itemsCount: '5 Items (3 Royal Mains + 2 Starters + Premium Dessert)',
      color: 'from-amber-400 to-yellow-600',
      badge: 'Grand Feast',
      desc: 'Luxury multi-course feast featuring premium ingredients and royal desserts',
    },
  };

  const activeBox = TIER_DATA[tier];

  const handleShakeBox = () => {
    setIsShaking(true);
    setTimeout(() => {
      setIsShaking(false);
      setIsRevealed(true);
      toast.success('🎉 Mystery Box contents curated by 4.5★+ top chefs in your city!');
    }, 700);
  };

  const handleOrderBox = async () => {
    const selected = TIER_DATA[tier];
    const defaultRest = restaurants[0] || { id: 'mystery-hub', name: 'Hunger Mystery Chef Hub' };
    const boxId = `mystery-${tier}-${pref}-${Date.now()}`;

    const cartItem: CartItem = {
      id: boxId,
      menuItemId: boxId,
      restaurantId: defaultRest.id || 'mystery-hub',
      name: `🎁 ${selected.name} (${pref.toUpperCase()} - ${spice.toUpperCase()})`,
      price: selected.price,
      quantity: 1,
      image:
        tier === 'gold'
          ? 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600'
          : tier === 'silver'
          ? 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600'
          : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600',
      restaurantName: defaultRest.name || 'Hunger Mystery Chef Hub',
      addedAt: new Date(),
    };

    addItem(cartItem);

    if (user?.uid) {
      try {
        await setDoc(doc(db, 'customers', user.uid, 'mysteryBoxes', boxId), {
          tier,
          pref,
          spice,
          price: selected.price,
          name: selected.name,
          createdAt: Timestamp.now(),
        });
      } catch (e) {}
    }

    toast.success(`Added ${selected.name} to cart! Check out to get surprised! 🚀`);
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
                <Gift className="w-6 h-6 text-primary" />
                Blind Mystery Food Box
              </h1>
              <p className="text-xs text-muted-foreground">
                Chef-curated surprise feasts at up to 45% discount value
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
        
        {/* Tier Cards Grid (3 Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(Object.keys(TIER_DATA) as BoxTier[]).map((t) => {
            const b = TIER_DATA[t];
            const isSelected = tier === t;
            return (
              <Card
                key={t}
                onClick={() => setTier(t)}
                className={`cursor-pointer rounded-3xl p-6 sm:p-7 border-2 transition-all relative overflow-hidden flex flex-col justify-between h-72 ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/30 shadow-2xl scale-[1.02] bg-card'
                    : 'border-border/70 hover:border-primary/40 bg-card/60'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
                      {b.badge}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-semibold">Worth {b.worth}</span>
                  </div>

                  <h3 className="text-2xl font-black text-foreground">{b.name}</h3>
                  <p className="text-xs text-muted-foreground">{b.desc}</p>
                </div>

                <div className="pt-4 border-t border-border/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Mystery Price</span>
                    <span className="text-2xl sm:text-3xl font-black text-primary font-mono">₹{b.price}</span>
                  </div>
                  <Badge variant={isSelected ? "default" : "outline"} className="text-xs font-bold">
                    {b.itemsCount.split('(')[0].trim()}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Customizer Box & Interactive Shake Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-card p-6 sm:p-10 rounded-3xl border border-border/70 shadow-lg">
          
          {/* Left Customizer Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-foreground">
                Customize Your {activeBox.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Our chefs craft your meal strictly adhering to your dietary and spice choices
              </p>
            </div>

            {/* Dietary Preference */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase block mb-2">Dietary Category</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: 'nonveg', label: '🍗 Non-Veg Feast' },
                  { id: 'veg', label: '🥗 Pure Vegetarian' },
                  { id: 'fit', label: '🏋️ High Protein Fit' },
                  { id: 'dessert', label: '🍰 Sweet Tooth Box' },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPref(p.id as FoodPref)}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition-all ${
                      pref === p.id
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-muted/40 border-border hover:border-primary/40'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Spice Level */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase block mb-2">Spice Level</label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'mild', label: '🌿 Mild & Flavorful' },
                  { id: 'medium', label: '🌶️ Regular Indian Spice' },
                  { id: 'hot', label: '🔥 Extra Hot & Spicy' },
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSpice(s.id as SpiceLevel)}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition-all ${
                      spice === s.id
                        ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                        : 'bg-muted/40 border-border hover:border-orange-500/40'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Add to Cart CTA */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <Button
                onClick={handleOrderBox}
                size="lg"
                className="w-full sm:w-auto rounded-2xl font-black bg-primary text-primary-foreground shadow-xl shadow-primary/25 h-13 px-8 gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                Add Mystery Box to Cart • ₹{activeBox.price}
              </Button>
              <Button
                onClick={handleShakeBox}
                size="lg"
                variant="outline"
                className="w-full sm:w-auto rounded-2xl font-bold h-13 px-6 gap-2"
              >
                <Dices className="w-5 h-5 text-amber-500" />
                Shake Box for Hint
              </Button>
            </div>
          </div>

          {/* Right Visual 3D Shake Box (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center text-center p-6 sm:p-8 rounded-3xl bg-muted/20 border border-border/60">
            <motion.div
              animate={isShaking ? { rotate: [-10, 10, -10, 10, 0], scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.5 }}
              className="text-8xl sm:text-9xl filter drop-shadow-2xl my-2 select-none cursor-pointer"
              onClick={handleShakeBox}
            >
              🎁
            </motion.div>

            <h4 className="font-black text-lg text-foreground mt-2">{activeBox.name}</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Guaranteed minimum {activeBox.worth} food value with fresh packaging &amp; hot sealed delivery.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
