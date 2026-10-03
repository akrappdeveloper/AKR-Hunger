'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Search, Tag, Zap, Clock, Percent, Gift,
  Copy, CheckCircle2, Flame, Star, Filter, Loader2, Sparkles
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
  usageLimit?: number;
  usageCount?: number;
  emoji?: string;
}

const STATIC_DEALS: Deal[] = [
  {
    id: 's1', title: '50% OFF on First Order', description: 'New user exclusive! Get flat 50% off up to ₹100 on your first order.',
    discountType: 'percentage', discountValue: 50, minOrder: 200, maxDiscount: 100,
    code: 'NEWUSER50', isActive: true, category: 'new_user', emoji: '🎉',
    expiresAt: null
  },
  {
    id: 's2', title: 'Free Delivery Weekend', description: 'Free delivery on all orders Saturday & Sunday. No minimum order!',
    discountType: 'free_delivery', discountValue: 0, code: 'FREEWEEKEND',
    isActive: true, category: 'delivery', emoji: '🛵', expiresAt: null
  },
  {
    id: 's3', title: '₹100 Off on ₹499+', description: 'Flat ₹100 discount on orders above ₹499 from any restaurant.',
    discountType: 'flat', discountValue: 100, minOrder: 499, code: 'FLAT100',
    isActive: true, category: 'flat', emoji: '💸', expiresAt: null
  },
  {
    id: 's4', title: '20% Off — Biryani Bonanza', description: 'Enjoy 20% off on all biryani orders today. Limited time!',
    discountType: 'percentage', discountValue: 20, minOrder: 300, maxDiscount: 80,
    code: 'BIRYANI20', isActive: true, category: 'cuisine', emoji: '🍲', expiresAt: null
  },
  {
    id: 's5', title: 'Late Night Special — 15% Off', description: '15% off on all orders placed between 10 PM – 2 AM.',
    discountType: 'percentage', discountValue: 15, minOrder: 250, maxDiscount: 60,
    code: 'LATENIGHT15', isActive: true, category: 'time', emoji: '🌙', expiresAt: null
  },
  {
    id: 's6', title: 'Hunger Premium — Double Points', description: 'Premium members get 2x reward points on all orders this week!',
    discountType: 'percentage', discountValue: 0, code: 'PREMIUM2X',
    isActive: true, category: 'premium', emoji: '👑', expiresAt: null
  },
];

const FILTERS = ['All', 'New User', 'Free Delivery', 'Flat Off', 'Percentage', 'Premium'];

const categoryColorMap: Record<string, string> = {
  new_user: 'from-emerald-500 to-teal-600',
  delivery: 'from-blue-500 to-indigo-600',
  flat: 'from-rose-500 to-pink-600',
  cuisine: 'from-orange-500 to-amber-600',
  time: 'from-purple-500 to-violet-700',
  premium: 'from-yellow-400 to-amber-500',
};

export default function DealsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [dbDeals, setDbDeals] = useState<Deal[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'promotions'),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    const unsub = onSnapshot(q, snap => {
      setDbDeals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Deal)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const allDeals = [...STATIC_DEALS, ...dbDeals];

  const filtered = allDeals.filter(d => {
    const matchSearch = !search || d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.code?.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' ||
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
    toast.success(`Code "${code}" copied!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getDiscountLabel = (deal: Deal) => {
    if (deal.discountType === 'free_delivery') return 'FREE DELIVERY';
    if (deal.discountType === 'percentage') return `${deal.discountValue}% OFF`;
    if (deal.discountType === 'flat') return `₹${deal.discountValue} OFF`;
    return 'SPECIAL';
  };

  const getGradient = (deal: Deal) => categoryColorMap[deal.category || ''] || 'from-orange-500 to-amber-600';

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 pt-8 pb-20">
        <div className="absolute inset-0 opacity-10 select-none pointer-events-none text-7xl">
          <span className="absolute top-4 left-6">🔥</span>
          <span className="absolute top-12 right-10 text-5xl">🎁</span>
          <span className="absolute bottom-4 left-1/3 text-4xl">✨</span>
        </div>
        <div className="container max-w-4xl mx-auto px-4">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/80 hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="text-center">
            <div className="text-5xl mb-3">🔥</div>
            <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Deals & Offers</h1>
            <p className="text-white/80">Handpicked discounts & exclusive codes just for you</p>
            <div className="relative max-w-md mx-auto mt-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input
                type="text"
                placeholder="Search deals or codes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/20 backdrop-blur-sm text-white placeholder:text-white/50 border border-white/30 focus:outline-none focus:border-white/60"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-4xl mx-auto px-4 -mt-8 pb-20">
        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                  : 'bg-card border border-border text-foreground hover:border-orange-500/40'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🎁</div>
            <h3 className="text-xl font-bold mb-2">No deals found</h3>
            <p className="text-muted-foreground">Try a different filter or search term</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filtered.map((deal, i) => (
              <motion.div
                key={deal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="rounded-2xl border-0 shadow-lg overflow-hidden hover:shadow-xl transition-shadow group">
                  <div className={`bg-gradient-to-r ${getGradient(deal)} p-5 relative`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-3xl">{deal.emoji || '🎫'}</span>
                      <Badge className="bg-white/20 text-white border-0 font-bold text-sm">
                        {getDiscountLabel(deal)}
                      </Badge>
                    </div>
                    <h3 className="text-white font-bold text-lg leading-tight">{deal.title}</h3>
                  </div>
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground mb-4">{deal.description}</p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {deal.minOrder && (
                        <Badge variant="outline" className="text-xs rounded-lg">
                          Min order ₹{deal.minOrder}
                        </Badge>
                      )}
                      {deal.maxDiscount && (
                        <Badge variant="outline" className="text-xs rounded-lg">
                          Max ₹{deal.maxDiscount}
                        </Badge>
                      )}
                      {deal.expiresAt && (
                        <Badge variant="outline" className="text-xs rounded-lg gap-1">
                          <Clock className="w-3 h-3" />
                          Expires {deal.expiresAt?.toDate?.()?.toLocaleDateString()}
                        </Badge>
                      )}
                    </div>

                    {deal.code && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 border-2 border-dashed border-orange-400/50 rounded-xl px-4 py-2 bg-orange-50 dark:bg-orange-950/10">
                          <p className="text-xs text-muted-foreground mb-0.5">Promo Code</p>
                          <p className="font-black text-orange-600 tracking-widest text-sm">{deal.code}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => copyCode(deal.code!)}
                          className={`rounded-xl gap-1.5 transition-all ${
                            copiedCode === deal.code
                              ? 'bg-emerald-500 text-white'
                              : 'bg-orange-500 hover:bg-orange-600 text-white'
                          }`}
                        >
                          {copiedCode === deal.code
                            ? <><CheckCircle2 className="w-4 h-4" />Copied</>
                            : <><Copy className="w-4 h-4" />Copy</>
                          }
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Tip Banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 p-5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-yellow-300 flex-shrink-0" />
            <div>
              <p className="font-bold">💡 Pro Tip: Stack Your Savings!</p>
              <p className="text-sm text-white/80 mt-1">
                Use promo codes at checkout combined with Hunger Premium cashback to maximize your savings on every order!
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
