'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  onSnapshot,
  where,
  orderBy,
  limit,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Search,
  Tag,
  Zap,
  Clock,
  Percent,
  Gift,
  Copy,
  CheckCircle2,
  Flame,
  Star,
  Sparkles,
  ShoppingBag,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/utils';

interface Deal {
  id: string;
  title: string;
  description: string;
  discountType: 'percentage' | 'flat' | 'free_delivery';
  discountValue: number;
  minOrder?: number;
  maxDiscount?: number;
  code?: string;
  restaurantId?: string;
  restaurantName?: string;
  expiresAt?: any;
  category?: string;
  isActive: boolean;
  emoji?: string;
}

const STATIC_DEALS: Deal[] = [
  {
    id: 's1',
    title: '50% OFF on First Order',
    description: 'New user welcome feast! Enjoy flat 50% off up to ₹120 on your very first order.',
    discountType: 'percentage',
    discountValue: 50,
    minOrder: 199,
    maxDiscount: 120,
    code: 'WELCOME50',
    isActive: true,
    category: 'new_user',
    emoji: '🎉',
  },
  {
    id: 's2',
    title: 'Free Delivery Special',
    description: 'Zero delivery charges on all meals today. No minimum order value required!',
    discountType: 'free_delivery',
    discountValue: 0,
    code: 'FREEDEL',
    isActive: true,
    category: 'delivery',
    emoji: '🛵',
  },
  {
    id: 's3',
    title: 'Flat ₹100 Off on ₹499+',
    description: 'Instant flat ₹100 discount on hearty family orders across all top-rated restaurants.',
    discountType: 'flat',
    discountValue: 100,
    minOrder: 499,
    code: 'HUNGER100',
    isActive: true,
    category: 'flat',
    emoji: '💸',
  },
  {
    id: 's4',
    title: '25% Off Biryani Bonanza',
    description: 'Authentic dum biryani, kebabs, and accompaniments with 25% off up to ₹150.',
    discountType: 'percentage',
    discountValue: 25,
    minOrder: 299,
    maxDiscount: 150,
    code: 'BIRYANI25',
    isActive: true,
    category: 'cuisine',
    emoji: '🍲',
  },
  {
    id: 's5',
    title: 'Midnight Craving 20% Off',
    description: 'Late night cravings sorted! 20% discount on gourmet meals placed between 10 PM & 3 AM.',
    discountType: 'percentage',
    discountValue: 20,
    minOrder: 249,
    maxDiscount: 100,
    code: 'NIGHT20',
    isActive: true,
    category: 'time',
    emoji: '🌙',
  },
  {
    id: 's6',
    title: 'VIP Weekend Feast 30%',
    description: 'Exclusive weekend bonanza: 30% savings up to ₹200 on all participating premium kitchens.',
    discountType: 'percentage',
    discountValue: 30,
    minOrder: 599,
    maxDiscount: 200,
    code: 'WEEKEND30',
    isActive: true,
    category: 'premium',
    emoji: '👑',
  },
];

const FILTERS = ['All', 'New User', 'Free Delivery', 'Flat Off', 'Percentage', 'Premium'];

export default function DealsPage() {
  const { user, customer } = useAuth();
  const router = useRouter();

  const [dbDeals, setDbDeals] = useState<Deal[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [savedCoupons, setSavedCoupons] = useState<string[]>([]);

  // Load live promotions from Firestore
  useEffect(() => {
    const q = query(
      collection(db, 'promotions'),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setDbDeals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Deal)));
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // Sync saved coupons from customer profile
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'customers', user.uid), (snap) => {
      if (snap.exists()) {
        setSavedCoupons(snap.data().savedCoupons || []);
      }
    });
    return () => unsub();
  }, [user]);

  const allDeals = [...dbDeals, ...STATIC_DEALS];

  const filtered = allDeals.filter((d) => {
    const matchSearch =
      !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.code && d.code.toLowerCase().includes(search.toLowerCase())) ||
      d.description.toLowerCase().includes(search.toLowerCase());

    const matchFilter =
      filter === 'All' ||
      (filter === 'New User' && d.category === 'new_user') ||
      (filter === 'Free Delivery' && d.discountType === 'free_delivery') ||
      (filter === 'Flat Off' && d.discountType === 'flat') ||
      (filter === 'Percentage' && d.discountType === 'percentage') ||
      (filter === 'Premium' && d.category === 'premium');

    return matchSearch && matchFilter;
  });

  const copyCode = async (code: string) => {
    await copyToClipboard(code);
    setCopiedCode(code);
    toast.success(`Coupon code "${code}" copied to clipboard!`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const applyAndGoToCart = (code: string) => {
    localStorage.setItem('pendingPromoCode', code);
    toast.success(`Coupon ${code} selected! Redirecting to cart...`);
    router.push('/customer/cart');
  };

  const toggleSaveCoupon = async (code: string) => {
    if (!user) {
      toast.error('Please log in to save coupons to your account');
      return;
    }

    try {
      const isSaved = savedCoupons.includes(code);
      await updateDoc(doc(db, 'customers', user.uid), {
        savedCoupons: isSaved ? arrayRemove(code) : arrayUnion(code),
      });
      toast.success(isSaved ? `Removed ${code} from saved` : `Saved ${code} to your account!`);
    } catch (err) {
      toast.error('Failed to update saved coupons');
    }
  };

  const getDiscountBadge = (deal: Deal) => {
    if (deal.discountType === 'free_delivery') return 'FREE DELIVERY';
    if (deal.discountType === 'percentage') return `${deal.discountValue}% OFF`;
    if (deal.discountType === 'flat') return `₹${deal.discountValue} OFF`;
    return 'HOT DEAL';
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 selection:bg-primary/20">
      {/* Top Header Banner matching Customer Panel */}
      <div className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-primary/5 to-transparent border-b border-border/50 py-8 sm:py-12">
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link
              href="/customer"
              className="inline-flex items-center gap-1.5 hover:text-foreground font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Link>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shadow-inner">
                  <Tag className="w-5 h-5" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  Deals & Exclusive Offers
                </h1>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-bold">
                  {filtered.length} Active
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                Unlock handpicked coupon discounts, free delivery codes, and instant savings on your orders.
              </p>
            </div>

            {/* Deals Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search deals, promo codes..."
                value={search}
                onChange={(e) => setSearch}
                className="pl-10 pr-4 h-11 rounded-2xl bg-card border-border/70 text-sm shadow-sm"
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2 mt-6">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3.5 py-1.5 rounded-full font-bold transition-all ${
                  filter === f
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105'
                    : 'bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Deals Grid */}
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-56 rounded-3xl bg-muted/40 animate-pulse border border-border/50"
              />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filtered.map((deal, index) => {
                const code = deal.code || `DEAL${index + 1}`;
                const isCopied = copiedCode === code;
                const isSaved = savedCoupons.includes(code);

                return (
                  <motion.div
                    key={deal.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.04 }}
                  >
                    <Card className="rounded-3xl border border-border/70 bg-card hover:border-primary/50 hover:shadow-xl transition-all duration-300 overflow-hidden group flex flex-col justify-between h-full relative">
                      {/* Top Decorative Header */}
                      <div className="p-5 sm:p-6 pb-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl p-2 rounded-2xl bg-muted/80 flex-shrink-0">
                              {deal.emoji || '🎁'}
                            </span>
                            <div>
                              <Badge className="bg-primary/10 text-primary border-primary/20 font-black text-xs px-2.5 py-0.5 rounded-full mb-1">
                                {getDiscountBadge(deal)}
                              </Badge>
                              <h3 className="font-black text-base sm:text-lg text-foreground leading-snug group-hover:text-primary transition-colors">
                                {deal.title}
                              </h3>
                            </div>
                          </div>

                          {/* Save to Account Bookmark */}
                          <button
                            onClick={() => toggleSaveCoupon(code)}
                            title={isSaved ? 'Coupon Saved' : 'Save Coupon'}
                            className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
                          >
                            {isSaved ? (
                              <BookmarkCheck className="w-5 h-5 text-primary fill-primary" />
                            ) : (
                              <Bookmark className="w-5 h-5" />
                            )}
                          </button>
                        </div>

                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-4">
                          {deal.description}
                        </p>

                        {/* Terms Badges */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground font-medium">
                          {deal.minOrder && (
                            <span className="px-2 py-0.5 rounded-md bg-muted/60 border border-border/50">
                              Min. order: ₹{deal.minOrder}
                            </span>
                          )}
                          {deal.maxDiscount && (
                            <span className="px-2 py-0.5 rounded-md bg-muted/60 border border-border/50">
                              Max discount: ₹{deal.maxDiscount}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Notched Coupon Code Bar */}
                      <div className="relative border-t border-dashed border-border/80 bg-muted/30 px-5 sm:px-6 py-4 flex items-center justify-between gap-3">
                        {/* Notch Circles */}
                        <div className="absolute -left-3 top-[-10px] w-5 h-5 rounded-full bg-background border border-border/80" />
                        <div className="absolute -right-3 top-[-10px] w-5 h-5 rounded-full bg-background border border-border/80" />

                        {/* Promo Code Box */}
                        <div className="flex items-center gap-2">
                          <div className="px-3 py-1.5 rounded-xl border border-primary/40 bg-primary/5 text-primary font-mono font-black text-sm tracking-wider select-all">
                            {code}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyCode(code)}
                            className="h-8 px-2.5 rounded-xl text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            {isCopied ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-emerald-500 font-bold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Apply Now Button */}
                        <Button
                          size="sm"
                          onClick={() => applyAndGoToCart(code)}
                          className="rounded-xl px-3.5 h-8 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                        >
                          <ShoppingBag className="w-3.5 h-3.5 mr-1" /> Apply
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          /* Empty State */
          <div className="max-w-md mx-auto text-center py-16 px-4">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-muted/60 border border-border/60 flex items-center justify-center text-muted-foreground mb-4">
              <Tag className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">No offers match your criteria</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-6">
              Try searching for something else or reset your category filter to explore all available coupons.
            </p>
            <Button
              onClick={() => {
                setSearch('');
                setFilter('All');
              }}
              variant="outline"
              className="rounded-2xl font-semibold"
            >
              Reset Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
