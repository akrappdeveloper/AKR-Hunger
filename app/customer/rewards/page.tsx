'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db, realtimeDb } from '@/lib/firebase';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  limit,
  doc,
  getDoc,
  getDocs,
  where,
  updateDoc,
  addDoc,
  serverTimestamp,
  arrayUnion,
  increment,
} from 'firebase/firestore';
import {
  ref as rtdbRef,
  get as rtdbGet,
  update as rtdbUpdate,
} from 'firebase/database';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Star,
  Gift,
  Zap,
  Crown,
  Flame,
  ArrowLeft,
  Trophy,
  ChevronRight,
  Copy,
  Share2,
  Sparkles,
  TrendingUp,
  Clock,
  CheckCircle2,
  Ticket,
  Loader2,
  Coins,
  Wallet,
  Percent,
  Truck,
  IndianRupee,
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
  {
    name: 'Bronze',
    minPoints: 0,
    maxPoints: 499,
    emoji: '🥉',
    color: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
    perks: ['2% Loyalty Cashback', 'Birthday Bonus 50 Pts'],
  },
  {
    name: 'Silver',
    minPoints: 500,
    maxPoints: 1499,
    emoji: '🥈',
    color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
    perks: ['4% Loyalty Cashback', 'Free Delivery Voucher x2/month', 'Priority Support'],
  },
  {
    name: 'Gold',
    minPoints: 1500,
    maxPoints: 3999,
    emoji: '🥇',
    color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
    perks: ['6% Loyalty Cashback', 'Free Delivery x5/month', '24/7 Priority Support', 'Exclusive Deals'],
  },
  {
    name: 'Platinum',
    minPoints: 4000,
    maxPoints: Infinity,
    emoji: '💎',
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    perks: ['10% Loyalty Cashback', 'Unlimited Free Deliveries', 'Dedicated Account Manager', 'Secret Menu Access'],
  },
];

const REWARDS_CATALOG = [
  { id: 'r1', code: 'REWARD50', name: '₹50 Off on Next Order', points: 150, emoji: '🎫', minOrder: 199 },
  { id: 'r2', code: 'FREESHIP', name: '100% Free Delivery Voucher', points: 200, emoji: '🛵', minOrder: 0 },
  { id: 'r3', code: 'REWARD100', name: '₹100 Off on ₹499+', points: 300, emoji: '💰', minOrder: 499 },
  { id: 'r4', code: 'SWEETTREAT', name: 'Free Chef Dessert Item', points: 450, emoji: '🍰', minOrder: 250 },
  { id: 'r5', code: 'FEAST20', name: '20% Off Weekend Feast', points: 600, emoji: '🎉', minOrder: 350 },
  { id: 'r6', code: 'VIP1MONTH', name: '1 Month Hunger Plus VIP', points: 900, emoji: '👑', minOrder: 0 },
];

export default function RewardsPage() {
  const { user, customer } = useAuth();
  const router = useRouter();

  const [points, setPoints] = useState(0);
  const [activities, setActivities] = useState<PointActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [referralCode] = useState(() => `HUNGER${(user?.uid || 'VIP').substring(0, 5).toUpperCase()}`);
  const [voucherInput, setVoucherInput] = useState('');
  const [isApplyingVoucher, setIsApplyingVoucher] = useState(false);
  const [redeemedVoucherInfo, setRedeemedVoucherInfo] = useState<{
    code: string;
    benefitText: string;
    type: string;
  } | null>(null);

  const handleApplyVoucherCode = async () => {
    if (!user) {
      toast.error('Please log in to redeem voucher codes');
      return;
    }
    const cleanCode = voucherInput.trim().toUpperCase();
    if (!cleanCode) {
      toast.error('Please enter a voucher code');
      return;
    }

    setIsApplyingVoucher(true);
    try {
      // 1. Check if user already claimed this code
      const customerDocSnap = await getDoc(doc(db, 'customers', user.uid));
      const customerData = customerDocSnap.data() || {};
      const claimedCodes: string[] = customerData.redeemedCodes || [];
      if (claimedCodes.includes(cleanCode)) {
        toast.error('You have already redeemed this code!');
        setIsApplyingVoucher(false);
        return;
      }

      // 2. Lookup in Firestore (/redeemCodes)
      let matchedCode: any = null;
      let matchedDocRef: any = null;

      try {
        const qFs = query(collection(db, 'redeemCodes'), where('code', '==', cleanCode));
        const fsSnap = await getDocs(qFs);
        if (!fsSnap.empty) {
          matchedDocRef = fsSnap.docs[0].ref;
          matchedCode = fsSnap.docs[0].data();
        }
      } catch (fsErr) {
        console.warn('Firestore code check notice:', fsErr);
      }

      // 3. Fallback to Realtime Database (/redeem_codes)
      if (!matchedCode) {
        try {
          const rtdbSnapshot = await rtdbGet(rtdbRef(realtimeDb, 'redeem_codes'));
          if (rtdbSnapshot.exists()) {
            const allCodes = rtdbSnapshot.val();
            for (const key of Object.keys(allCodes)) {
              if (allCodes[key].code?.toUpperCase() === cleanCode) {
                matchedCode = { ...allCodes[key], rtdbKey: key };
                break;
              }
            }
          }
        } catch (rtdbErr) {
          console.warn('RTDB code check notice:', rtdbErr);
        }
      }

      if (!matchedCode) {
        toast.error('Invalid voucher code. Please check spelling and try again.');
        setIsApplyingVoucher(false);
        return;
      }

      // Validate status
      if (matchedCode.isActive === false) {
        toast.error('This redeem code is paused or inactive.');
        setIsApplyingVoucher(false);
        return;
      }

      // Validate expiration
      if (matchedCode.expiresAt) {
        const expDate = new Date(matchedCode.expiresAt);
        if (new Date() > expDate) {
          toast.error('This voucher code has expired.');
          setIsApplyingVoucher(false);
          return;
        }
      }

      // Validate max usages
      if (
        matchedCode.maxRedemptions &&
        (matchedCode.redemptionCount || 0) >= matchedCode.maxRedemptions
      ) {
        toast.error('This voucher has reached its redemption limit.');
        setIsApplyingVoucher(false);
        return;
      }

      const benefitType = matchedCode.benefitType || matchedCode.type || 'points';
      const rewardVal = Number(matchedCode.value) || 0;
      let benefitDesc = '';

      // Credit based on Benefit Type
      if (benefitType === 'wallet') {
        await updateDoc(doc(db, 'customers', user.uid), {
          walletBalance: increment(rewardVal),
          redeemedCodes: arrayUnion(cleanCode),
          updatedAt: serverTimestamp(),
        });
        await addDoc(collection(db, 'customers', user.uid, 'walletTransactions'), {
          type: 'credit',
          amount: rewardVal,
          description: `Voucher Credit: ${cleanCode}`,
          createdAt: serverTimestamp(),
        });
        benefitDesc = `₹${rewardVal} Instant Wallet Cash`;
      } else if (benefitType === 'points') {
        await updateDoc(doc(db, 'customers', user.uid), {
          rewardPoints: increment(rewardVal),
          redeemedCodes: arrayUnion(cleanCode),
          updatedAt: serverTimestamp(),
        });
        await addDoc(collection(db, 'customers', user.uid, 'pointActivities'), {
          type: 'bonus',
          points: rewardVal,
          description: `Redeemed Code: ${cleanCode}`,
          createdAt: serverTimestamp(),
        });
        benefitDesc = `+${rewardVal} Loyalty Reward Points`;
      } else if (benefitType === 'delivery') {
        await updateDoc(doc(db, 'customers', user.uid), {
          savedCoupons: arrayUnion(cleanCode),
          redeemedCodes: arrayUnion(cleanCode),
          updatedAt: serverTimestamp(),
        });
        benefitDesc = '100% Free Express Delivery Voucher';
      } else {
        await updateDoc(doc(db, 'customers', user.uid), {
          savedCoupons: arrayUnion(cleanCode),
          redeemedCodes: arrayUnion(cleanCode),
          updatedAt: serverTimestamp(),
        });
        benefitDesc =
          matchedCode.discountType === 'percentage'
            ? `${rewardVal}% Cart Discount Coupon`
            : `₹${rewardVal} Flat Discount Voucher`;
      }

      // Increment count on code records
      if (matchedDocRef) {
        await updateDoc(matchedDocRef, {
          redemptionCount: increment(1),
        }).catch(() => {});
      }
      if (matchedCode.rtdbKey) {
        try {
          await rtdbUpdate(rtdbRef(realtimeDb, `redeem_codes/${matchedCode.rtdbKey}`), {
            redemptionCount: (matchedCode.redemptionCount || 0) + 1,
          });
        } catch (_) {}
      }

      toast.success(`🎉 Voucher Redeemed! ${benefitDesc} added to your account!`);
      setRedeemedVoucherInfo({
        code: cleanCode,
        benefitText: benefitDesc,
        type: benefitType,
      });
      setVoucherInput('');
    } catch (err: any) {
      console.error('Voucher redeem error:', err);
      toast.error('Failed to apply voucher. Please try again.');
    } finally {
      setIsApplyingVoucher(false);
    }
  };

  // Sync real-time points from customer profile
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubCustomer = onSnapshot(doc(db, 'customers', user.uid), (snap) => {
      if (snap.exists()) {
        setPoints(snap.data().rewardPoints || 0);
      }
    });

    const q = query(
      collection(db, 'customers', user.uid, 'pointActivities'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubActivities = onSnapshot(
      q,
      (snap) => {
        setActivities(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PointActivity)));
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => {
      unsubCustomer();
      unsubActivities();
    };
  }, [user]);

  const currentTier = TIERS.reduce(
    (acc, tier) => (points >= tier.minPoints ? tier : acc),
    TIERS[0]
  );
  const nextTier = TIERS.find((t) => t.minPoints > points);
  const progressToNext = nextTier
    ? Math.min(100, Math.max(0, ((points - currentTier.minPoints) / (nextTier.minPoints - currentTier.minPoints)) * 100))
    : 100;

  const copyReferralCode = async () => {
    await copyToClipboard(referralCode);
    toast.success('Referral code copied to clipboard!');
  };

  const handleRedeem = async (reward: (typeof REWARDS_CATALOG)[0]) => {
    if (!user) {
      toast.error('Please log in to redeem points');
      return;
    }

    if (points < reward.points) {
      toast.error(`You need ${reward.points - points} more points to unlock this reward`);
      return;
    }

    setRedeemingId(reward.id);
    try {
      const newPoints = points - reward.points;

      // 1. Deduct points & add to saved coupons
      await updateDoc(doc(db, 'customers', user.uid), {
        rewardPoints: newPoints,
        savedCoupons: arrayUnion(reward.code),
        updatedAt: serverTimestamp(),
      });

      // 2. Add activity transaction record
      await addDoc(collection(db, 'customers', user.uid, 'pointActivities'), {
        type: 'redeemed',
        points: reward.points,
        description: `Redeemed ${reward.name} (Code: ${reward.code})`,
        createdAt: serverTimestamp(),
      });

      toast.success(`🎉 Redeemed "${reward.name}"! Coupon code ${reward.code} added to your account.`);
    } catch (err) {
      console.error('Redeem error:', err);
      toast.error('Failed to redeem reward. Please try again.');
    } finally {
      setRedeemingId(null);
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
                  <Trophy className="w-5 h-5" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  Rewards & Loyalty Points
                </h1>
                <Badge className={`${currentTier.color} font-black text-xs px-2.5 py-0.5 rounded-full border`}>
                  {currentTier.emoji} {currentTier.name} Tier
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                Earn points with every meal, unlock exclusive discount vouchers, and level up your foodie tier.
              </p>
            </div>

            {/* Total Points Balance Widget */}
            <div className="flex items-center gap-4 p-4 rounded-3xl bg-card border border-border/80 shadow-lg shadow-black/5 self-start md:self-auto">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-black">
                ⭐
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Available Balance</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl sm:text-3xl font-black text-foreground">{points}</span>
                  <span className="text-xs font-semibold text-primary">Points</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Tier Progress Card */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-3xl border border-border/70 bg-card p-6 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                  <span>{currentTier.emoji}</span> You are in {currentTier.name} Tier
                </h3>
                <p className="text-xs text-muted-foreground">
                  {nextTier
                    ? `${nextTier.minPoints - points} points needed to reach ${nextTier.name}`
                    : 'Congratulations! You have unlocked maximum Platinum status'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {currentTier.perks.map((p, i) => (
                  <Badge key={i} variant="secondary" className="text-[11px] font-semibold py-1">
                    {p}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-500 to-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressToNext}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                <span>{currentTier.name} (0 pts)</span>
                <span>{nextTier ? `${nextTier.name} (${nextTier.minPoints} pts)` : 'Top Tier'}</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Redeem Gift Voucher Card */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="rounded-3xl border border-primary/25 bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-md overflow-hidden relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Gift className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-black text-foreground">Have a Gift Voucher or Promo Code?</h3>
                  <Badge variant="outline" className="border-primary/30 text-primary text-[10px] font-bold">
                    All Benefits Supported
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter your voucher code to claim instant <strong>Wallet Cash (₹)</strong>, <strong>Loyalty Coins</strong>, <strong>Cart Discounts</strong>, or <strong>Free Delivery Passes</strong>.
                </p>
              </div>

              {/* Form Input + Button */}
              <div className="flex items-center gap-2.5 w-full md:w-auto">
                <Input
                  placeholder="Enter code e.g. WELCOME2026"
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyVoucherCode()}
                  className="h-11 rounded-2xl bg-background border-border text-foreground font-mono font-bold text-sm tracking-wider uppercase w-full md:w-64"
                />
                <Button
                  onClick={handleApplyVoucherCode}
                  disabled={isApplyingVoucher || !voucherInput.trim()}
                  className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground font-bold shadow-md hover:bg-primary/90 shrink-0 cursor-pointer"
                >
                  {isApplyingVoucher ? (
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </div>
                  ) : (
                    <span>Redeem Code</span>
                  )}
                </Button>
              </div>
            </div>

            {/* Success Celebration Alert if claimed */}
            {redeemedVoucherInfo && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🎉</span>
                  <div>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      Code "{redeemedVoucherInfo.code}" Applied Successfully!
                    </p>
                    <p className="text-[11px] text-muted-foreground">{redeemedVoucherInfo.benefitText}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRedeemedVoucherInfo(null)}
                  className="text-xs text-muted-foreground hover:text-foreground font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </motion.div>
            )}
          </Card>
        </motion.div>

        {/* Redeem Rewards Catalog */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                <Gift className="w-5 h-5 text-primary" /> Redeem Points for Vouchers
              </h2>
              <p className="text-xs text-muted-foreground">
                Exchange points instantly for promo codes credited to your cart.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {REWARDS_CATALOG.map((reward, index) => {
              const canRedeem = points >= reward.points;
              const isRedeeming = redeemingId === reward.id;

              return (
                <motion.div
                  key={reward.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.04 }}
                >
                  <Card className="rounded-3xl border border-border/70 bg-card hover:border-primary/40 hover:shadow-lg transition-all duration-300 p-5 flex flex-col justify-between h-full group">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-3xl p-2.5 rounded-2xl bg-muted/80">{reward.emoji}</span>
                        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-black text-xs px-2.5 py-0.5 rounded-full">
                          ⭐ {reward.points} Pts
                        </Badge>
                      </div>

                      <h3 className="font-black text-base text-foreground mb-1 group-hover:text-primary transition-colors">
                        {reward.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        {reward.minOrder > 0
                          ? `Applicable on orders above ₹${reward.minOrder}`
                          : 'Valid on all orders with zero minimum order limit'}
                      </p>
                    </div>

                    <Button
                      onClick={() => handleRedeem(reward)}
                      disabled={!canRedeem || isRedeeming}
                      size="sm"
                      className={`w-full rounded-xl font-bold transition-all ${
                        canRedeem
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20'
                          : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                      }`}
                    >
                      {isRedeeming ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Redeeming...
                        </>
                      ) : canRedeem ? (
                        'Redeem Now'
                      ) : (
                        `Need ${reward.points - points} more pts`
                      )}
                    </Button>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Refer & Earn Banner */}
        <Card className="rounded-3xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card to-card p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <Share2 className="w-4 h-4" /> Refer & Earn Rewards
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-foreground">
                Invite Friends & Earn 100 Points Each
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-lg">
                Your friends get ₹50 off on their first feast, and you get 100 loyalty points the moment they complete their first order.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="flex items-center gap-2 p-2 bg-card rounded-2xl border border-border shadow-sm">
                <div className="px-4 py-2 font-mono font-black text-base tracking-widest text-primary">
                  {customer?.referralCode || referralCode}
                </div>
                <Button
                  onClick={copyReferralCode}
                  size="sm"
                  className="rounded-xl font-bold gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </Button>
              </div>

              <Link href="/customer/referral">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl font-bold gap-1 border-primary/40 text-primary hover:bg-primary/10"
                >
                  <span>Live Tracking</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {/* Point Activities Transaction Ledger */}
        <div className="space-y-3">
          <h3 className="text-lg font-black text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" /> Point Activities
          </h3>

          {activities.length > 0 ? (
            <div className="space-y-2">
              {activities.map((act) => {
                const isEarned = act.type === 'earned' || act.type === 'bonus';
                return (
                  <div
                    key={act.id}
                    className="p-3.5 rounded-2xl bg-card border border-border/60 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-foreground">{act.description}</p>
                      <span className="text-[11px] text-muted-foreground">
                        {act.createdAt?.toDate
                          ? act.createdAt.toDate().toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Recent'}
                      </span>
                    </div>

                    <span
                      className={`font-black text-sm ${
                        isEarned ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {isEarned ? `+${act.points}` : `-${act.points}`} pts
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4">No recent point activity recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
