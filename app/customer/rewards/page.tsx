'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Star, Gift, Zap, Crown, Flame, ArrowLeft, Trophy,
  ChevronRight, Copy, Share2, Sparkles, TrendingUp, Clock, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/utils';

interface PointActivity {
  id: string;
  type: 'earned' | 'redeemed' | 'bonus' | 'expired';
  points: number;
  description: string;
  createdAt: any;
}

const TIERS = [
  { name: 'Bronze', minPoints: 0, maxPoints: 499, color: 'from-amber-600 to-orange-700', emoji: '🥉', perks: ['2% Cashback', 'Birthday Bonus 50pts'] },
  { name: 'Silver', minPoints: 500, maxPoints: 1499, color: 'from-slate-400 to-gray-500', emoji: '🥈', perks: ['4% Cashback', 'Priority Support', 'Free Delivery x2/month'] },
  { name: 'Gold', minPoints: 1500, maxPoints: 3999, color: 'from-yellow-400 to-amber-500', emoji: '🥇', perks: ['6% Cashback', '24/7 Priority Support', 'Free Delivery x5/month', 'Exclusive Deals'] },
  { name: 'Platinum', minPoints: 4000, maxPoints: Infinity, color: 'from-cyan-400 to-blue-500', emoji: '💎', perks: ['10% Cashback', 'Dedicated Manager', 'Free Delivery Unlimited', 'Early Access', 'Surprise Gifts'] },
];

const REWARDS_CATALOG = [
  { id: '1', name: '₹50 off on next order', points: 200, icon: '🎫', color: 'from-green-500 to-emerald-600' },
  { id: '2', name: 'Free Delivery (1 use)', points: 150, icon: '🛵', color: 'from-blue-500 to-indigo-600' },
  { id: '3', name: '₹100 off on ₹500+', points: 350, icon: '💰', color: 'from-purple-500 to-violet-600' },
  { id: '4', name: 'Free Dessert Dish', points: 500, icon: '🍰', color: 'from-pink-500 to-rose-600' },
  { id: '5', name: '20% off Weekend Special', points: 600, icon: '🎉', color: 'from-orange-500 to-amber-600' },
  { id: '6', name: 'Premium Membership (1 month)', points: 1000, icon: '👑', color: 'from-yellow-500 to-orange-600' },
];

export default function RewardsPage() {
  const { user, customer } = useAuth();
  const router = useRouter();
  const [activities, setActivities] = useState<PointActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [referralCode] = useState(() => `HUNGER${Math.random().toString(36).substring(2, 7).toUpperCase()}`);

  const totalPoints = customer?.rewardPoints || 0;

  const currentTier = TIERS.reduce((acc, tier) =>
    totalPoints >= tier.minPoints ? tier : acc, TIERS[0]
  );
  const nextTier = TIERS.find(t => t.minPoints > totalPoints);
  const progressToNext = nextTier
    ? ((totalPoints - currentTier.minPoints) / (nextTier.minPoints - currentTier.minPoints)) * 100
    : 100;

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'pointActivities'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(
      q,
      snap => {
        setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() } as PointActivity)));
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  const copyReferralCode = async () => {
    await copyToClipboard(referralCode);
    toast.success('Referral code copied!');
  };

  const getActivityColor = (type: string) => ({
    earned: 'text-emerald-500',
    redeemed: 'text-rose-500',
    bonus: 'text-amber-500',
    expired: 'text-muted-foreground',
  }[type] || 'text-foreground');

  const getActivityPrefix = (type: string) => ({
    earned: '+', redeemed: '-', bonus: '+', expired: '-',
  }[type] || '+');

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className={`relative overflow-hidden bg-gradient-to-br ${currentTier.color} pt-8 pb-20`}>
        <div className="absolute inset-0 opacity-10 text-7xl select-none">
          <span className="absolute top-4 left-8">⭐</span>
          <span className="absolute bottom-4 right-12 text-5xl">🎁</span>
          <span className="absolute top-12 right-24 text-4xl">✨</span>
        </div>
        <div className="container max-w-2xl mx-auto px-4">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/80 hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="text-center">
            <div className="text-5xl mb-3">{currentTier.emoji}</div>
            <Badge className="bg-white/20 text-white border-white/30 mb-3 text-sm px-3 py-1">
              {currentTier.name} Member
            </Badge>
            <div className="text-5xl font-black text-white mb-1">
              {totalPoints.toLocaleString()}
            </div>
            <p className="text-white/80 text-sm">Total Points</p>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 -mt-12 pb-20 space-y-6">
        {/* Tier Progress Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-3xl shadow-xl border-0 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <span className="font-bold">Tier Progress</span>
                </div>
                {nextTier && (
                  <span className="text-xs text-muted-foreground">
                    {nextTier.minPoints - totalPoints} pts to {nextTier.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mb-3">
                {TIERS.map((tier, i) => (
                  <div key={tier.name} className="flex items-center gap-1">
                    <div className={`flex flex-col items-center ${tier.name === currentTier.name ? 'scale-110' : 'opacity-60'}`}>
                      <span className="text-xl">{tier.emoji}</span>
                      <span className="text-xs font-medium mt-0.5">{tier.name}</span>
                    </div>
                    {i < TIERS.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                  </div>
                ))}
              </div>
              <Progress value={progressToNext} className="h-3 rounded-full" />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>{currentTier.minPoints} pts</span>
                <span>{nextTier ? `${nextTier.minPoints} pts` : 'MAX'}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Current Tier Perks */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="rounded-3xl border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Crown className="w-5 h-5 text-amber-500" />
                Your {currentTier.name} Perks
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 gap-2">
                {currentTier.perks.map((perk, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-sm font-medium">{perk}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Rewards Catalog */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-500" /> Redeem Rewards
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {REWARDS_CATALOG.map((reward, i) => (
              <motion.div
                key={reward.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.05 }}
              >
                <Card className="rounded-2xl border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer group">
                  <CardContent className="p-4">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${reward.color} flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform`}>
                      {reward.icon}
                    </div>
                    <p className="text-sm font-semibold leading-tight mb-2">{reward.name}</p>
                    <div className="flex items-center justify-between">
                      <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                        <Star className="w-3 h-3 mr-1" />{reward.points} pts
                      </Badge>
                      <Button
                        size="sm"
                        disabled={totalPoints < reward.points}
                        className="h-7 text-xs px-3 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 text-white border-0 disabled:opacity-40"
                        onClick={() => {
                          if (totalPoints < reward.points) {
                            toast.error(`Need ${reward.points - totalPoints} more points`);
                          } else {
                            toast.success('Reward redeemed! Check your coupons.');
                          }
                        }}
                      >
                        Redeem
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Referral Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Share2 className="w-5 h-5" />
                <span className="font-bold text-lg">Refer & Earn</span>
              </div>
              <p className="text-white/80 text-sm mb-4">Share your code and earn 100 points for every friend who orders!</p>
              <div className="bg-white/20 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/70 mb-1">Your Referral Code</p>
                  <p className="text-2xl font-black tracking-widest">{referralCode}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={copyReferralCode}
                    className="bg-white text-indigo-600 hover:bg-white/90 rounded-xl gap-1 font-semibold"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { label: 'You Earn', value: '100 pts', emoji: '⭐' },
                  { label: 'Friend Gets', value: '₹50 off', emoji: '🎁' },
                  { label: 'No Limit', value: 'Unlimited', emoji: '♾️' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white/15 rounded-xl p-3 text-center">
                    <div className="text-lg mb-1">{stat.emoji}</div>
                    <div className="font-bold text-sm">{stat.value}</div>
                    <div className="text-xs text-white/70">{stat.label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* How to Earn */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="rounded-3xl border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="w-5 h-5 text-amber-500" />
                How to Earn Points
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {[
                { action: 'Place any order', points: '1 pt per ₹10 spent', icon: '🛒' },
                { action: 'Write a review', points: '20 pts', icon: '✍️' },
                { action: 'Refer a friend', points: '100 pts', icon: '👥' },
                { action: 'Birthday bonus', points: '500 pts', icon: '🎂' },
                { action: 'First order of the week', points: '50 pts bonus', icon: '🚀' },
                { action: 'Complete your profile', points: '30 pts', icon: '👤' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <span className="text-sm font-medium">{item.action}</span>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">+{item.points}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Point Activity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" /> Points History
          </h2>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : activities.length === 0 ? (
            <Card className="rounded-2xl border-dashed">
              <CardContent className="py-10 text-center">
                <div className="text-5xl mb-3">⭐</div>
                <p className="text-muted-foreground">Start ordering to earn your first points!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {activities.map(act => (
                <div key={act.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{act.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {act.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                      </p>
                    </div>
                  </div>
                  <span className={`font-bold text-sm ${getActivityColor(act.type)}`}>
                    {getActivityPrefix(act.type)}{act.points} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
