'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import {
  doc,
  updateDoc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Crown,
  Star,
  Zap,
  Shield,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Gift,
  Clock,
  TrendingUp,
  Loader2,
  ChevronRight,
  HeartHandshake,
  Truck,
  Percent,
  Phone,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

const PLANS = [
  {
    id: 'plus',
    name: 'Hunger Plus',
    emoji: '⚡',
    price: 99,
    period: '/month',
    annualPrice: 799,
    tagline: 'Essential perks for frequent foodies',
    perks: [
      { icon: Truck, text: 'Unlimited Free Delivery on orders over ₹199' },
      { icon: Percent, text: 'Flat 5% Extra Cashback on every order' },
      { icon: Star, text: '2x Hunger Loyalty Reward Points' },
      { icon: Gift, text: 'Monthly surprise restaurant voucher ₹50' },
    ],
    popular: false,
    badgeColor: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  {
    id: 'premium',
    name: 'Hunger Premium',
    emoji: '👑',
    price: 199,
    period: '/month',
    annualPrice: 1599,
    tagline: 'Our most loved club for true food enthusiasts',
    perks: [
      { icon: Truck, text: 'Zero Delivery Fee on ALL orders without minimum' },
      { icon: Zap, text: 'Express Kitchen Priority Queue on peak hours' },
      { icon: Percent, text: '10% Extra Cashback credited instantly to wallet' },
      { icon: Star, text: '3x Loyalty Reward Points on all purchases' },
      { icon: Gift, text: 'Monthly surprise gourmet voucher ₹150' },
      { icon: Phone, text: 'Dedicated 24/7 VIP Support Helpline' },
    ],
    popular: true,
    badgeColor: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
  {
    id: 'vip',
    name: 'Hunger VIP Elite',
    emoji: '💎',
    price: 499,
    period: '/month',
    annualPrice: 3999,
    tagline: 'The ultimate luxury dining concierge',
    perks: [
      { icon: Truck, text: 'Unlimited Free Express Delivery with zero surge' },
      { icon: Percent, text: '15% Extra Cashback on every meal & drink' },
      { icon: Star, text: '5x Reward Points + Exclusive Birthday Feast Gift' },
      { icon: Gift, text: 'Weekly Chef Curated Tasting Voucher ₹100' },
      { icon: Phone, text: 'Personal Concierge Manager via WhatsApp/Call' },
      { icon: HeartHandshake, text: 'VIP Access to Secret Menus & Masterclasses' },
      { icon: Shield, text: '100% Instant Refund Guarantee on any dish dispute' },
    ],
    popular: false,
    badgeColor: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  },
];

export default function MembershipPage() {
  const { user, customer } = useAuth();
  const router = useRouter();

  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);
  const [membershipData, setMembershipData] = useState<any>(null);

  // Sync real-time customer membership status from Firestore
  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(doc(db, 'customers', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setMembershipData({
          status: data.membershipStatus || 'none',
          tier: data.membershipTier || null,
          expiresAt: data.membershipExpiresAt || null,
        });
      }
    });

    return () => unsub();
  }, [user]);

  const activeTierId = membershipData?.status === 'approved' ? membershipData?.tier : null;

  const handleSubscribe = async (planId: string) => {
    if (!user) {
      toast.error('Please log in to activate VIP membership');
      router.push('/customer/login');
      return;
    }

    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) return;

    setLoading(true);
    try {
      const expirationDate = new Date();
      if (billing === 'annual') {
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);
      } else {
        expirationDate.setMonth(expirationDate.getMonth() + 1);
      }

      // Save directly to Firestore customers/{user.uid}
      await updateDoc(doc(db, 'customers', user.uid), {
        membershipStatus: 'approved',
        membershipTier: plan.id,
        membershipPlan: plan.name,
        membershipBilling: billing,
        membershipExpiresAt: expirationDate,
        updatedAt: serverTimestamp(),
      });

      // Also set in users/{user.uid} for cross-compatibility
      try {
        await setDoc(
          doc(db, 'users', user.uid),
          {
            membership: {
              status: 'approved',
              tier: plan.id,
              name: plan.name,
              expiresAt: expirationDate,
            },
          },
          { merge: true }
        );
      } catch (_) {}

      toast.success(`🎉 Welcome to ${plan.name}! Your VIP benefits are now active.`);
    } catch (err) {
      console.error('Membership update error:', err);
      toast.error('Failed to activate membership. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelMembership = async () => {
    if (!user) return;
    if (!confirm('Are you sure you want to cancel your VIP membership benefits?')) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'customers', user.uid), {
        membershipStatus: 'none',
        membershipTier: null,
        updatedAt: serverTimestamp(),
      });
      toast.info('Your membership has been deactivated');
    } catch (err) {
      toast.error('Failed to update membership');
    } finally {
      setLoading(false);
    }
  };

  const formatExpiry = (val: any) => {
    if (!val) return 'Active';
    try {
      const d = val.toDate ? val.toDate() : new Date(val);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (_) {
      return 'Active';
    }
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
                  <Crown className="w-5 h-5" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  VIP Club Membership
                </h1>
                {activeTierId && (
                  <Badge className="bg-amber-500 text-white font-black text-xs px-2.5 py-0.5 rounded-full shadow-sm">
                    ACTIVE MEMBER
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                Unlimited free deliveries, higher cashback, priority cooking queues, and exclusive monthly gifts.
              </p>
            </div>

            {/* Monthly / Annual Toggle */}
            <div className="flex items-center p-1.5 bg-muted/80 rounded-2xl border border-border/60 self-start md:self-auto">
              <button
                onClick={() => setBilling('monthly')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  billing === 'monthly'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('annual')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                  billing === 'annual'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Annual
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black">
                  SAVE 35%
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Active Membership Banner (if user is active member) */}
        {activeTierId && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="rounded-3xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-card to-card p-6 shadow-xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-2xl shadow-lg shadow-amber-500/25">
                    👑
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
                        Active Subscription
                      </span>
                      <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600 dark:text-amber-400">
                        Renews {formatExpiry(membershipData?.expiresAt)}
                      </Badge>
                    </div>
                    <h3 className="text-xl font-black text-foreground">
                      {PLANS.find((p) => p.id === activeTierId)?.name || 'VIP Member'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      All VIP benefits and free delivery active on your account
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelMembership}
                  className="rounded-xl border-border/80 text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs font-semibold self-start sm:self-auto"
                >
                  Manage / Cancel
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Pricing Tiers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan, index) => {
            const isCurrent = activeTierId === plan.id;
            const price = billing === 'annual' ? plan.annualPrice : plan.price;
            const periodLabel = billing === 'annual' ? '/year' : '/month';

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.08 }}
                className="h-full"
              >
                <Card
                  className={`rounded-3xl border bg-card transition-all duration-300 h-full flex flex-col justify-between overflow-hidden relative ${
                    plan.popular
                      ? 'border-primary ring-2 ring-primary/20 shadow-xl shadow-primary/5'
                      : 'border-border/70 hover:border-primary/40 hover:shadow-lg'
                  }`}
                >
                  {/* Popular Flag */}
                  {plan.popular && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-primary text-primary-foreground text-[10px] font-black tracking-widest uppercase px-4 py-1 rounded-bl-2xl shadow-sm">
                        MOST POPULAR
                      </div>
                    </div>
                  )}

                  <CardContent className="p-6 sm:p-7 flex flex-col justify-between flex-1">
                    <div>
                      {/* Plan Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-3xl p-2.5 rounded-2xl bg-muted/80">{plan.emoji}</span>
                        <div>
                          <Badge className={`${plan.badgeColor} font-black text-xs px-2.5 py-0.5 rounded-full mb-1`}>
                            {plan.name}
                          </Badge>
                          <p className="text-xs text-muted-foreground leading-tight">{plan.tagline}</p>
                        </div>
                      </div>

                      {/* Pricing Tag */}
                      <div className="my-5 pb-5 border-b border-border/60">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-black text-foreground">₹{price}</span>
                          <span className="text-xs font-semibold text-muted-foreground">{periodLabel}</span>
                        </div>
                        {billing === 'annual' && (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                            Equivalent to ₹{Math.round(price / 12)}/month
                          </p>
                        )}
                      </div>

                      {/* Perks Checklist */}
                      <div className="space-y-3 mb-6">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Included Benefits:
                        </p>
                        {plan.perks.map((perk, i) => {
                          const IconComp = perk.icon;
                          return (
                            <div key={i} className="flex items-start gap-2.5 text-xs text-foreground/90 font-medium">
                              <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Check className="w-3 h-3" />
                              </div>
                              <span className="leading-snug">{perk.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-2">
                      <Button
                        onClick={() => handleSubscribe(plan.id)}
                        disabled={loading || isCurrent}
                        className={`w-full rounded-2xl font-bold py-6 text-sm transition-all ${
                          isCurrent
                            ? 'bg-muted text-muted-foreground cursor-default'
                            : plan.popular
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 hover:scale-[1.02]'
                            : 'bg-foreground text-background hover:bg-foreground/90'
                        }`}
                      >
                        {isCurrent ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" /> Active Plan
                          </>
                        ) : loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Activating...
                          </>
                        ) : (
                          `Join ${plan.name}`
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
