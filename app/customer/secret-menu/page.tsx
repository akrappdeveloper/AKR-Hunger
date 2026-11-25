'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Lock, Unlock, KeyRound, Sparkles, Flame, Clock,
  ShoppingCart, CheckCircle2, Moon, Zap, ShieldCheck,
  ChevronRight, Eye, AlertCircle, ArrowLeft, Check, Store
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import FullscreenToggle from '@/components/customer/FullscreenToggle';
import { toast } from 'sonner';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { MenuItem, Restaurant, CartItem } from '@/lib/types';

export default function SecretMenuPage() {
  const { addItem } = useCart();
  const { user } = useAuth();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [addedItemIds, setAddedItemIds] = useState<Set<string>>(new Set());

  // Firestore live sync
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

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = passcode.trim().toUpperCase();
    if (clean === 'HUNGERSECRET' || clean === 'VAULT' || clean === 'CHEF' || clean === 'VIP' || clean === 'SECRET') {
      setIsUnlocked(true);
      toast.success('🔓 Secret Vault Unlocked! Welcome to the Chef’s Off-Menu Archives.');
    } else {
      toast.error('Invalid vault passcode. (Hint: Try "HUNGERSECRET" or "VIP")');
    }
  };

  // Filter secret / chef special / limited edition dishes from Firestore
  const secretDishes = useMemo(() => {
    const specials = menuItems.filter(m =>
      m.isChefSpecial || m.isLimitedEdition || m.isMustTry || m.isBestSeller || m.price >= 250
    );
    return specials.length >= 4 ? specials.slice(0, 15) : menuItems.slice(0, 12);
  }, [menuItems]);

  const handleAddToCart = (dish: MenuItem) => {
    const parentRest = restaurants.find(r => r.id === dish.restaurantId);
    const cartItem: CartItem = {
      id: `secret-${dish.id}-${Date.now()}`,
      menuItemId: dish.id,
      restaurantId: dish.restaurantId || 'secret-vault',
      name: `🔒 [Off-Menu] ${dish.name}`,
      price: dish.price,
      quantity: 1,
      image: dish.image || (dish.images && dish.images[0]) || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
      restaurantName: parentRest?.name || (dish as any).restaurantName || 'Secret Kitchen',
      addedAt: new Date(),
    };
    addItem(cartItem);
    setAddedItemIds(prev => new Set(prev).add(dish.id));
    toast.success(`Unlocked & added "${dish.name}" to cart! 🔒`);
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
                <Lock className="w-6 h-6 text-purple-500" />
                The Secret Vault Menu
              </h1>
              <p className="text-xs text-muted-foreground">
                Off-menu chef experiments, midnight recipes &amp; unlisted culinary creations
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
        
        {/* Vault Status Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-10 shadow-2xl border border-purple-800/40">
          <div className="relative z-10 max-w-3xl space-y-4">
            <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs uppercase tracking-wider">
              {isUnlocked ? '🔓 Vault Access Granted' : '🔒 Classified Chef Archives'}
            </Badge>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
              Exclusive Off-Menu Dishes You Won&apos;t Find on Regular Menus
            </h2>

            <p className="text-purple-200 text-sm sm:text-base leading-relaxed">
              Top culinary chefs secretly test limited batches of avant-garde recipes right here. Once portions run out for the day, they disappear back into the vault.
            </p>

            {!isUnlocked ? (
              <form onSubmit={handleUnlock} className="flex flex-col sm:flex-row items-center gap-3 pt-2 max-w-md">
                <Input
                  value={passcode}
                  onChange={e => setPasscode(e.target.value)}
                  placeholder="Enter Passcode (e.g. HUNGERSECRET)"
                  className="rounded-2xl bg-black/50 border-purple-500/40 text-white placeholder:text-white/40 h-12 text-sm"
                />
                <Button type="submit" size="lg" className="w-full sm:w-auto rounded-2xl font-black bg-purple-600 hover:bg-purple-700 text-white h-12 px-6">
                  <KeyRound className="w-4 h-4 mr-2" /> Unlock Vault
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={() => setIsUnlocked(false)}
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-purple-400/40 text-purple-300 hover:bg-purple-900/30 text-xs font-bold"
                >
                  <Lock className="w-3.5 h-3.5 mr-1" /> Re-lock Vault
                </Button>
                <span className="text-xs text-purple-300 font-mono">
                  {secretDishes.length} Vault Specials Available
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Vault Dishes Grid - 1 to 5 cols responsive */}
        {isUnlocked ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Live Vault Specials
              </h3>
              <span className="text-xs text-muted-foreground font-semibold">
                Instant 1-Click Order to Cart
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
              {secretDishes.map((dish) => {
                const parentRest = restaurants.find(r => r.id === dish.restaurantId);
                const isAdded = addedItemIds.has(dish.id);

                return (
                  <Card
                    key={dish.id}
                    className="overflow-hidden border-2 border-purple-500/30 hover:border-purple-500 transition-all hover:shadow-2xl flex flex-col justify-between group bg-card rounded-2xl"
                  >
                    <div className="relative h-44 w-full bg-muted overflow-hidden">
                      <img
                        src={dish.image || (dish.images && dish.images[0]) || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600'}
                        alt={dish.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <Badge className="absolute top-2.5 left-2.5 bg-purple-900/80 text-purple-200 border border-purple-500/40 text-[10px] font-bold backdrop-blur-md">
                        🔒 Secret Item
                      </Badge>
                      <Badge className="absolute bottom-2.5 right-2.5 bg-black/80 text-white font-mono font-bold text-xs">
                        ₹{dish.price}
                      </Badge>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="font-bold text-sm text-foreground line-clamp-1">{dish.name}</h4>
                        {parentRest && (
                          <p className="text-[11px] text-primary flex items-center gap-1 mt-0.5 truncate">
                            <Store className="w-3 h-3 shrink-0" />
                            <span className="truncate">{parentRest.name}</span>
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {dish.description || 'Classified off-menu delicacy crafted with secret culinary spices'}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleAddToCart(dish)}
                        className={`w-full rounded-xl text-xs font-bold transition-all shadow-md ${
                          isAdded
                            ? 'bg-emerald-600 text-white'
                            : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1" /> Added to Cart
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Order Secret Dish • ₹{dish.price}
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="py-16 text-center max-w-md mx-auto bg-card rounded-3xl border border-dashed border-purple-500/40 p-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="font-black text-xl text-foreground">Vault is Locked</h3>
            <p className="text-xs text-muted-foreground">
              Enter passcode <code className="bg-muted px-2 py-0.5 rounded font-bold text-foreground">HUNGERSECRET</code> above or tap below to unlock instant access.
            </p>
            <Button
              onClick={() => { setPasscode('HUNGERSECRET'); setIsUnlocked(true); }}
              className="rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white text-xs"
            >
              1-Tap Instant Unlock
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
