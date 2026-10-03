'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Crown, Star, Zap, Shield, ArrowLeft, CheckCircle2,
  Sparkles, Gift, Clock, TrendingUp, Loader2, ChevronRight,
  HeartHandshake, Truck, Percent, Phone
} from 'lucide-react';
import { toast } from 'sonner';
import Script from 'next/script';

declare global {
  interface Window { Razorpay: any; }
}

const PLANS = [
  {
    id: 'basic',
    name: 'Hunger Plus',
    emoji: '⚡',
    price: 99,
    period: '/month',
    annualPrice: 799,
    color: 'from-blue-500 to-indigo-600',
    shadowColor: 'shadow-blue-500/25',
    perks: [
      { icon: Truck, text: 'Free delivery on all orders' },
      { icon: Percent, text: '5% cashback on every order' },
      { icon: Star, text: '2x reward points' },
      { icon: Gift, text: 'Monthly surprise voucher ₹50' },
    ],
    popular: false,
  },
  {
    id: 'premium',
    name: 'Hunger Premium',
    emoji: '👑',
    price: 199,
    period: '/month',
    annualPrice: 1599,
    color: 'from-amber-400 to-orange-500',
    shadowColor: 'shadow-amber-400/30',
    perks: [
      { icon: Truck, text: 'Free delivery + priority queue' },
      { icon: Percent, text: '10% cashback on every order' },
      { icon: Star, text: '3x reward points' },
      { icon: Gift, text: 'Monthly surprise voucher ₹150' },
      { icon: Phone, text: 'Dedicated customer support' },
      { icon: Zap, text: 'Early access to new restaurants' },
    ],
    popular: true,
  },
  {
    id: 'vip',
    name: 'Hunger VIP',
    emoji: '💎',
    price: 499,
    period: '/month',
    annualPrice: 3999,
    color: 'from-purple-500 to-violet-700',
    shadowColor: 'shadow-purple-500/30',
    perks: [
      { icon: Truck, text: 'Free delivery + fastest priority' },
      { icon: Percent, text: '15% cashback on every order' },
      { icon: Star, text: '5x reward points' },
      { icon: Gift, text: 'Weekly surprise voucher ₹100' },
      { icon: Phone, text: '24/7 personal account manager' },
      { icon: HeartHandshake, text: 'Exclusive chef collaborations' },
      { icon: Zap, text: 'Unlimited early access & beta features' },
      { icon: Shield, text: 'Full refund guarantee on every order' },
    ],
    popular: false,
  },
];

export default function MembershipPage() {
  const { user, customer } = useAuth();
  const router = useRouter();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState('premium');
  const [loading, setLoading] = useState(false);
  const [currentMembership, setCurrentMembership] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), snap => {
      const data = snap.data();
      setCurrentMembership(data?.membership || null);
    }, () => {});
    return () => unsub();
  }, [user]);

  const handleSubscribe = async (planId: string) => {
    if (!user) { toast.error('Please log in'); return; }
    const plan = PLANS.find(p => p.id === planId);
    if (!plan) return;
    setLoading(true);

    const amount = billing === 'annual' ? plan.annualPrice : plan.price;

    try {
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: amount * 100,
        currency: 'INR',
        name: 'AKR Hunger',
        description: `${plan.name} — ${billing === 'annual' ? 'Annual' : 'Monthly'} Subscription`,
        handler: (response: any) => {
          toast.success(`🎉 Welcome to ${plan.name}! Your subscription is active.`);
          setLoading(false);
        },
        modal: { ondismiss: () => setLoading(false) },
        prefill: {
          name: customer?.displayName || '',
          email: user.email || '',
        },
        theme: { color: '#f97316' },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error('Payment initialization failed');
      setLoading(false);
    }
  };

  const isActive = (planId: string) =>
    currentMembership?.planId === planId && currentMembership?.status === 'active';

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <div className="min-h-screen bg-background">
        {/* Hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 pt-10 pb-24">
          <div className="absolute inset-0 opacity-10 text-8xl select-none pointer-events-none">
            <span className="absolute top-4 left-6">👑</span>
            <span className="absolute top-16 right-12 text-6xl">✨</span>
            <span className="absolute bottom-4 left-1/3 text-4xl">💎</span>
          </div>
          <div className="container max-w-4xl mx-auto px-4">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-white/80 hover:text-white mb-8">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-2 mb-4 backdrop-blur-sm">
                <Crown className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-medium">Membership Plans</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
                Upgrade Your
                <br />Food Experience
              </h1>
              <p className="text-white/80 text-lg max-w-md mx-auto">
                Free deliveries, cashback, exclusive perks & more. Pick a plan that fits your appetite.
              </p>

              {/* Billing Toggle */}
              <div className="inline-flex items-center gap-1 bg-white/20 rounded-2xl p-1 mt-6 backdrop-blur-sm">
                <button
                  onClick={() => setBilling('monthly')}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                    billing === 'monthly' ? 'bg-white text-orange-600 shadow' : 'text-white'
                  }`}
                >Monthly</button>
                <button
                  onClick={() => setBilling('annual')}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 ${
                    billing === 'annual' ? 'bg-white text-orange-600 shadow' : 'text-white'
                  }`}
                >
                  Annual
                  <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full">Save 33%</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Plans */}
        <div className="container max-w-4xl mx-auto px-4 -mt-14 pb-20">
          <div className="grid md:grid-cols-3 gap-5">
            {PLANS.map((plan, i) => {
              const active = isActive(plan.id);
              const price = billing === 'annual' ? plan.annualPrice : plan.price;
              const period = billing === 'annual' ? '/year' : '/month';
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={plan.popular ? 'md:-mt-4' : ''}
                >
                  <Card className={`rounded-3xl border-0 shadow-2xl ${plan.shadowColor} overflow-hidden transition-transform hover:-translate-y-1 duration-300 ${
                    selectedPlan === plan.id ? 'ring-2 ring-orange-400' : ''
                  }`}>
                    {plan.popular && (
                      <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-center py-2 text-xs font-bold tracking-wide">
                        🔥 MOST POPULAR
                      </div>
                    )}
                    <div className={`bg-gradient-to-br ${plan.color} p-6 text-white`}>
                      <div className="text-3xl mb-2">{plan.emoji}</div>
                      <h3 className="text-xl font-black">{plan.name}</h3>
                      <div className="mt-3">
                        <span className="text-4xl font-black">₹{price}</span>
                        <span className="text-white/70 ml-1">{period}</span>
                      </div>
                      {billing === 'annual' && (
                        <p className="text-white/60 text-xs mt-1 line-through">₹{plan.price * 12}/year</p>
                      )}
                    </div>
                    <CardContent className="p-5">
                      <div className="space-y-3 mb-5">
                        {plan.perks.map((perk, j) => {
                          const Icon = perk.icon;
                          return (
                            <div key={j} className="flex items-center gap-3">
                              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${plan.color} flex items-center justify-center flex-shrink-0`}>
                                <Icon className="w-3.5 h-3.5 text-white" />
                              </div>
                              <span className="text-sm">{perk.text}</span>
                            </div>
                          );
                        })}
                      </div>
                      {active ? (
                        <Button disabled className="w-full rounded-2xl bg-emerald-500 text-white gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Active Plan
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleSubscribe(plan.id)}
                          disabled={loading}
                          className={`w-full rounded-2xl bg-gradient-to-r ${plan.color} text-white border-0 hover:opacity-90 gap-2 font-semibold`}
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          Get Started
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Current Membership Status */}
          {currentMembership && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
              <Card className="mt-8 rounded-3xl border-0 shadow-lg">
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-500" />
                    Current Membership
                  </h3>
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/40">
                    <div>
                      <p className="font-semibold">{currentMembership.planName || 'Unknown Plan'}</p>
                      <p className="text-sm text-muted-foreground">
                        Expires: {currentMembership.expiresAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                      </p>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 border-0">Active</Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* FAQ */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="mt-8 rounded-3xl border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-base">Frequently Asked Questions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    q: 'Can I cancel anytime?',
                    a: 'Yes! You can cancel your membership anytime. Your perks remain active until the end of the billing period.'
                  },
                  {
                    q: 'How does cashback work?',
                    a: 'Cashback is automatically credited to your Hunger Wallet after each order is delivered.'
                  },
                  {
                    q: 'Are there any hidden charges?',
                    a: 'No hidden charges. You pay the plan price, no extra costs.'
                  },
                  {
                    q: 'Does free delivery apply to all restaurants?',
                    a: 'Yes, free delivery applies to all partner restaurants in your city.'
                  },
                ].map((faq, i) => (
                  <div key={i} className="border-b border-border last:border-0 pb-4 last:pb-0">
                    <p className="font-semibold text-sm mb-1">{faq.q}</p>
                    <p className="text-sm text-muted-foreground">{faq.a}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </>
  );
}
