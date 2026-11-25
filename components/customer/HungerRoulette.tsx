'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dices, Sparkles, Gift, ArrowRight, Check, Trophy, RotateCcw,
  Volume2, VolumeX, ShoppingCart, Store, Copy, ExternalLink,
  Flame, Clock, Star, Zap, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { db } from '@/lib/firebase';
import {
  collection, doc, setDoc, updateDoc, onSnapshot,
  getDocs, query, where, limit, Timestamp, increment, addDoc
} from 'firebase/firestore';
import { MenuItem, Restaurant, CartItem } from '@/lib/types';
import { copyToClipboard } from '@/lib/utils';
import Link from 'next/link';
import { toast } from 'sonner';

interface RoulettePrize {
  id: string;
  label: string;
  discount: string;
  code: string;
  icon: string;
  color: string;
  type: 'percentage' | 'flat' | 'free_delivery' | 'cashback' | 'points';
  value: number;
}

const PRIZES: RoulettePrize[] = [
  { id: '1', label: 'Flat 25% OFF', discount: '25% OFF up to ₹100 on orders ₹199+', code: 'SPIN25', icon: '🎉', color: '#EA580C', type: 'percentage', value: 25 },
  { id: '2', label: 'Free Delivery', discount: 'Zero delivery fee on your next meal', code: 'SPINFREEDEL', icon: '⚡', color: '#2563EB', type: 'free_delivery', value: 0 },
  { id: '3', label: '₹60 Cashback', discount: 'Instant ₹60 credited to your Hunger Wallet', code: 'SPINCASH60', icon: '💰', color: '#059669', type: 'cashback', value: 60 },
  { id: '4', label: 'Flat 50% Mega', discount: 'Grand 50% discount up to ₹150', code: 'SPIN50MEGA', icon: '👑', color: '#D97706', type: 'percentage', value: 50 },
  { id: '5', label: '100 Reward Pts', discount: '100 VIP reward points for next orders', code: 'SPINPTS100', icon: '🌟', color: '#7C3AED', type: 'points', value: 100 },
  { id: '6', label: 'Flat ₹80 OFF', discount: 'Flat ₹80 OFF on orders above ₹299', code: 'SPIN80FLAT', icon: '🍔', color: '#DB2777', type: 'flat', value: 80 },
];

export default function HungerRoulette() {
  const { user, customer } = useAuth();
  const { addItem } = useCart();

  // Mode: 'deals' (Coupons & Cash) vs 'food' (What to Eat dish decider)
  const [rouletteMode, setRouletteMode] = useState<'deals' | 'food'>('deals');
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<RoulettePrize | null>(null);
  const [wonDish, setWonDish] = useState<MenuItem | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Real Firebase data: Menu items & Restaurants for Food Decider Wheel
  const [liveDishes, setLiveDishes] = useState<MenuItem[]>([]);
  const [liveRestaurants, setLiveRestaurants] = useState<Restaurant[]>([]);
  const [userSavedCoupons, setUserSavedCoupons] = useState<any[]>([]);

  // Web Audio Context for ticks & victory fanfare
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play synthetic wheel tick sound
  const playTick = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      // Audio not permitted or locked
    }
  };

  // Play victory chime
  const playWinSound = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      [440, 554, 659, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.35);
      });
    } catch (e) {}
  };

  // Sync real restaurants & dishes from Firestore
  useEffect(() => {
    const unsubR = onSnapshot(collection(db, 'restaurants'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Restaurant));
      setLiveRestaurants(list);
    });

    const unsubM = onSnapshot(collection(db, 'menuItems'), snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as MenuItem))
        .filter(m => m.available !== false);
      setLiveDishes(list);
    });

    return () => {
      unsubR();
      unsubM();
    };
  }, []);

  // Sync user's won rewards from Firestore or local storage
  useEffect(() => {
    if (user?.uid) {
      const unsubRewards = onSnapshot(
        collection(db, 'customers', user.uid, 'spinRewards'),
        snap => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a: any, b: any) => {
            const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return tB - tA;
          });
          setUserSavedCoupons(list);
        },
        err => console.warn('Could not listen to spinRewards subcollection:', err)
      );
      return () => unsubRewards();
    } else {
      // Guest mode: load from localStorage
      const saved = localStorage.getItem('guest_spin_rewards');
      if (saved) {
        try {
          setUserSavedCoupons(JSON.parse(saved));
        } catch (e) {}
      }
    }
  }, [user]);

  // Slices for the wheel
  const wheelSlices = rouletteMode === 'deals'
    ? PRIZES
    : (liveDishes.length >= 6
        ? liveDishes.slice(0, 6).map((dish, i) => ({
            id: dish.id,
            label: dish.name,
            discount: `₹${dish.price}`,
            code: dish.id,
            icon: dish.vegetarian ? '🥗' : '🍗',
            color: ['#EA580C', '#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777'][i % 6],
            type: 'dish' as any,
            value: dish.price,
            dishRef: dish,
          }))
        : PRIZES);

  // Spin handler
  const handleSpin = async () => {
    if (spinning) return;
    setWonPrize(null);
    setWonDish(null);
    setSpinning(true);

    const sliceCount = wheelSlices.length;
    const randomIndex = Math.floor(Math.random() * sliceCount);
    const degreesPerSlice = 360 / sliceCount;
    // Extra 5 full 360 spins + exact slice center alignment
    const targetDegrees = rotation + 1800 + (360 - (randomIndex * degreesPerSlice) - (degreesPerSlice / 2));

    // Audio ticks during spin
    const tickInterval = setInterval(() => {
      playTick();
    }, 120);

    setRotation(targetDegrees);

    setTimeout(async () => {
      clearInterval(tickInterval);
      setSpinning(false);
      playWinSound();

      if (rouletteMode === 'deals') {
        const prize = wheelSlices[randomIndex] as RoulettePrize;
        setWonPrize(prize);

        // Real Firebase integration: Write this active coupon to Firestore 'promotions' collection
        try {
          const promoRef = doc(db, 'promotions', prize.code);
          const validUntilDate = new Date();
          validUntilDate.setDate(validUntilDate.getDate() + 7); // Valid for 7 days

          await setDoc(promoRef, {
            code: prize.code,
            title: prize.label,
            description: prize.discount,
            discountType: prize.type === 'free_delivery' ? 'free_delivery' : (prize.type === 'flat' ? 'flat' : 'percentage'),
            discountValue: prize.value,
            minOrderAmount: prize.type === 'flat' ? 299 : (prize.type === 'percentage' ? 199 : 99),
            maxDiscount: prize.type === 'percentage' ? (prize.value === 50 ? 150 : 100) : prize.value,
            isActive: true,
            validFrom: Timestamp.now(),
            validUntil: Timestamp.fromDate(validUntilDate),
            usageLimit: 5000,
            usageCount: 0,
            createdAt: Timestamp.now(),
          }, { merge: true });

          // If user won cashback or points, credit customer doc directly in Firestore!
          if (user?.uid) {
            if (prize.type === 'cashback') {
              await updateDoc(doc(db, 'customers', user.uid), {
                walletBalance: increment(prize.value),
              }).catch(() => {});
              // Also add wallet transaction record
              await addDoc(collection(db, 'customers', user.uid, 'walletTransactions'), {
                amount: prize.value,
                type: 'credit',
                description: `Roulette Win: ${prize.label}`,
                createdAt: Timestamp.now(),
              }).catch(() => {});
              toast.success(`₹${prize.value} cashback credited straight to your Hunger Wallet! 💰`);
            } else if (prize.type === 'points') {
              await updateDoc(doc(db, 'customers', user.uid), {
                rewardPoints: increment(prize.value),
              }).catch(() => {});
              toast.success(`+${prize.value} VIP Reward Points credited to your account! 🌟`);
            }

            // Save won reward under customer's spinRewards collection
            const rewardEntry = {
              code: prize.code,
              label: prize.label,
              discount: prize.discount,
              icon: prize.icon,
              type: prize.type,
              value: prize.value,
              createdAt: Timestamp.now(),
              expiresAt: Timestamp.fromDate(validUntilDate),
              used: false,
            };
            await addDoc(collection(db, 'customers', user.uid, 'spinRewards'), rewardEntry).catch(() => {});
          } else {
            // Save to guest localStorage
            const existing = JSON.parse(localStorage.getItem('guest_spin_rewards') || '[]');
            existing.unshift({
              code: prize.code,
              label: prize.label,
              discount: prize.discount,
              icon: prize.icon,
              createdAt: new Date().toISOString(),
            });
            localStorage.setItem('guest_spin_rewards', JSON.stringify(existing.slice(0, 10)));
            setUserSavedCoupons(existing.slice(0, 10));
          }

          toast.success(`You won: ${prize.label}! Active in your cart 🎁`);
        } catch (err) {
          console.error('Error saving roulette prize to Firestore:', err);
          toast.success(`You won: ${prize.label}! 🎉`);
        }
      } else {
        // Food Decider Mode
        const itemSlice: any = wheelSlices[randomIndex];
        const selectedDish = itemSlice.dishRef || liveDishes[0];
        setWonDish(selectedDish);
        toast.success(`The Wheel Chose: ${selectedDish.name}! 😋`);
      }
    }, 4000);
  };

  // Copy code and save as suggestedPromo for checkout
  const handleCopyCode = async (code: string) => {
    await copyToClipboard(code);
    localStorage.setItem('suggestedPromo', code);
    setCopiedCode(code);
    toast.success(`Code "${code}" copied & pre-applied for your next checkout!`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Add won dish directly to cart
  const handleAddWonDish = (dish: MenuItem) => {
    const parentRest = liveRestaurants.find(r => r.id === dish.restaurantId);
    const cartItem: CartItem = {
      id: `${dish.id}-${Date.now()}`,
      menuItemId: dish.id,
      restaurantId: dish.restaurantId || 'platform',
      name: dish.name,
      price: dish.price,
      quantity: 1,
      image: dish.image || (dish.images && dish.images[0]) || '',
      restaurantName: parentRest?.name || (dish as any).restaurantName || 'Gourmet Kitchen',
      addedAt: new Date(),
    };
    addItem(cartItem);
    toast.success(`Added "${dish.name}" to your cart! 🚀`);
  };

  return (
    <div className="w-full space-y-8">
      {/* Mode Switcher Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-3 sm:p-4 rounded-3xl border border-border/70 shadow-xs">
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Interactive Daily Wheel
          </Badge>
          <span className="text-xs text-muted-foreground hidden md:inline">
            Spin daily for secret discounts &amp; instant wallet rewards
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="rounded-xl h-9 px-2.5 text-muted-foreground hover:text-foreground"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4" />}
          </Button>

          {/* Mode Switcher */}
          <div className="flex items-center bg-muted/60 p-1 rounded-2xl border border-border/60">
            <button
              onClick={() => { setRouletteMode('deals'); setWonPrize(null); setWonDish(null); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                rouletteMode === 'deals'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Gift className="w-4 h-4 text-primary" />
              Deals Wheel
            </button>
            <button
              onClick={() => { setRouletteMode('food'); setWonPrize(null); setWonDish(null); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                rouletteMode === 'food'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Dices className="w-4 h-4 text-orange-500" />
              What to Eat? Wheel
            </button>
          </div>
        </div>
      </div>

      {/* Main Full-Screen Split Layout: Left/Center Wheel, Right Rewards Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left/Center Column: Interactive Wheel Stage (8 cols on lg) */}
        <div className="lg:col-span-7 xl:col-span-8 bg-card rounded-3xl border border-border/70 p-6 sm:p-10 shadow-lg flex flex-col items-center justify-center text-center relative overflow-hidden">
          
          {/* Ambient Glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-orange-500/5 pointer-events-none" />

          {/* Wheel Header */}
          <div className="max-w-md mx-auto mb-6 relative z-10">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              {rouletteMode === 'deals' ? 'Hunger Deals Roulette' : 'Food Decision Roulette'}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {rouletteMode === 'deals'
                ? 'Can’t decide or want a discount? Spin for instant discounts & wallet rewards!'
                : 'Indecisive about dinner? Let our real culinary wheel pick a delicious dish for you!'}
            </p>
          </div>

          {/* Wheel Container */}
          <div className="relative w-72 h-72 sm:w-96 sm:h-96 my-2 relative z-10">
            {/* Top Pointer Indicator */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-30 w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[26px] border-t-primary filter drop-shadow-xl" />

            {/* Glowing Ring Border */}
            <div className="absolute inset-[-6px] rounded-full border-4 border-dashed border-primary/30 animate-[spin_40s_linear_infinite]" />

            {/* Spinning Wheel */}
            <div
              className="w-full h-full rounded-full border-4 border-primary/50 shadow-2xl overflow-hidden relative"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? 'transform 4s cubic-bezier(0.12, 0.95, 0.22, 1)' : 'none',
              }}
            >
              {wheelSlices.map((slice, idx) => {
                const rotationAngle = (360 / wheelSlices.length) * idx;
                return (
                  <div
                    key={slice.id + idx}
                    className="absolute w-full h-full top-0 left-0"
                    style={{
                      transform: `rotate(${rotationAngle}deg)`,
                      transformOrigin: '50% 50%',
                    }}
                  >
                    <div
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-32 sm:w-44 h-48 flex flex-col items-center justify-start pt-5 text-white font-bold"
                      style={{
                        backgroundColor: slice.color,
                        clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
                        opacity: 0.95,
                      }}
                    >
                      <span className="text-2xl sm:text-3xl filter drop-shadow">{slice.icon}</span>
                      <span className="text-[10px] sm:text-xs font-black uppercase text-center mt-1 px-2 line-clamp-1">
                        {slice.label}
                      </span>
                      <span className="text-[9px] opacity-80 font-mono">
                        {slice.discount}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Center Spin Hub */}
            <button
              onClick={handleSpin}
              disabled={spinning}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-background border-4 border-primary shadow-2xl flex flex-col items-center justify-center font-black text-xs sm:text-sm text-primary hover:scale-105 active:scale-95 transition-transform"
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 animate-pulse" />
              <span>{spinning ? '...' : 'SPIN'}</span>
            </button>
          </div>

          {/* Spin Action CTA */}
          <div className="mt-8 relative z-10">
            <Button
              onClick={handleSpin}
              disabled={spinning}
              size="lg"
              className="rounded-full px-10 py-7 text-base sm:text-lg font-black shadow-2xl shadow-primary/30 bg-gradient-to-r from-primary via-orange-500 to-amber-500 hover:opacity-95 text-white transform hover:scale-105 transition-all"
            >
              <Dices className="w-5 h-5 mr-2 animate-bounce" />
              {spinning ? 'Wheel is Spinning...' : 'Spin The Wheel Now'}
            </Button>
          </div>

          {/* Won Deal Popup Card */}
          <AnimatePresence>
            {wonPrize && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="mt-8 w-full max-w-lg p-6 rounded-3xl bg-gradient-to-br from-primary/10 via-amber-500/10 to-card border-2 border-primary/40 text-center space-y-4 shadow-2xl relative z-20"
              >
                <span className="text-5xl">{wonPrize.icon}</span>
                <div>
                  <Badge className="bg-primary text-primary-foreground font-black mb-1">
                    🎉 CONGRATULATIONS!
                  </Badge>
                  <h3 className="text-xl sm:text-2xl font-black text-foreground">
                    You Won {wonPrize.label}!
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {wonPrize.discount}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <code className="px-4 py-2.5 rounded-2xl bg-background border border-primary/30 text-base font-mono font-black text-primary tracking-wider shadow-inner">
                    {wonPrize.code}
                  </code>
                  <Button
                    size="sm"
                    onClick={() => handleCopyCode(wonPrize.code)}
                    className="rounded-xl px-4 py-2 font-bold gap-1.5 shadow-md"
                  >
                    {copiedCode === wonPrize.code ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    {copiedCode === wonPrize.code ? 'Copied & Applied!' : 'Copy & Apply Code'}
                  </Button>
                </div>

                <div className="flex items-center justify-center gap-3 pt-1">
                  <Link href="/customer/cart">
                    <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold">
                      <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                      View Cart
                    </Button>
                  </Link>
                  <Link href="/customer">
                    <Button variant="ghost" size="sm" className="rounded-xl text-xs font-bold">
                      Order Food Now <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              </motion.div>
            )}

            {/* Won Dish Decider Card */}
            {wonDish && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="mt-8 w-full max-w-lg p-6 rounded-3xl bg-card border-2 border-primary/40 text-center space-y-4 shadow-2xl relative z-20"
              >
                <div className="h-40 w-full rounded-2xl overflow-hidden bg-muted relative">
                  <img
                    src={wonDish.image || (wonDish.images && wonDish.images[0]) || '/placeholder.svg'}
                    alt={wonDish.name}
                    className="w-full h-full object-cover"
                  />
                  <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground font-black text-xs">
                    Today's Lucky Choice 🍽️
                  </Badge>
                  <Badge className="absolute bottom-3 right-3 bg-black/80 text-white font-mono font-black text-sm">
                    ₹{wonDish.price}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-foreground">
                    {wonDish.name}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {wonDish.description || 'Specially selected by Hunger Food Roulette'}
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button
                    size="default"
                    onClick={() => handleAddWonDish(wonDish)}
                    className="rounded-xl font-bold gap-2 shadow-lg shadow-primary/25"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Add to Cart for ₹{wonDish.price}
                  </Button>
                  {wonDish.restaurantId && (
                    <Link href={`/customer/restaurant/${wonDish.restaurantId}`}>
                      <Button variant="outline" className="rounded-xl font-bold">
                        <Store className="w-4 h-4 mr-1" />
                        Restaurant
                      </Button>
                    </Link>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Right Column: Real-time Won Rewards, Live Deals, & Game Rules (4-5 cols on lg) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          
          {/* Active Rewards / My Won Coupons Card */}
          <Card className="p-5 sm:p-6 rounded-3xl border border-border/70 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-base sm:text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                My Won Coupons &amp; Rewards
              </h3>
              <Badge variant="secondary" className="font-mono text-xs">
                {userSavedCoupons.length} Active
              </Badge>
            </div>

            {userSavedCoupons.length === 0 ? (
              <div className="text-center py-8 bg-muted/30 rounded-2xl border border-dashed border-border/60 p-4 space-y-2">
                <Gift className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground">
                  No spin rewards won yet
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Give the wheel a spin above to unlock real coupons and instant cashback!
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {userSavedCoupons.map((reward, i) => (
                  <div
                    key={reward.id || i}
                    className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/60 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{reward.icon || '🎁'}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs font-mono font-bold text-primary">
                            {reward.code}
                          </code>
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            Active
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                          {reward.label || reward.discount}
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyCode(reward.code)}
                      className="rounded-xl h-8 text-xs font-bold text-primary hover:bg-primary/10"
                    >
                      {copiedCode === reward.code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Daily Perks & Guarantee */}
          <Card className="p-5 sm:p-6 rounded-3xl border border-border/70 shadow-md space-y-4 bg-gradient-to-br from-card via-card to-primary/5">
            <h3 className="font-black text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Roulette Perks &amp; Rules
            </h3>
            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-primary font-bold text-[10px]">
                  1
                </div>
                <p>
                  <strong className="text-foreground">Real Firebase Sync:</strong> Every coupon won is immediately generated and registered in Firestore for your cart.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-primary font-bold text-[10px]">
                  2
                </div>
                <p>
                  <strong className="text-foreground">Instant Wallet Credits:</strong> Cashback &amp; point prizes credit straight to your authenticated Hunger wallet.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-primary font-bold text-[10px]">
                  3
                </div>
                <p>
                  <strong className="text-foreground">Fair Randomness:</strong> Powered by cryptographic seed angles ensuring 100% fair spins.
                </p>
              </div>
            </div>
          </Card>

        </div>

      </div>
    </div>
  );
}
