'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Gift,
  Share2,
  Copy,
  Check,
  Users,
  Wallet,
  ArrowLeft,
  Sparkles,
  ExternalLink,
  MessageCircle,
  Clock,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  Loader2,
  Zap,
} from 'lucide-react';
import FullscreenToggle from '@/components/customer/FullscreenToggle';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/utils';

interface ReferralTrackItem {
  id: string;
  referrerId: string;
  referredUserId: string;
  referredUserName: string;
  referredUserEmail?: string;
  referredUserPhone?: string;
  referralCode: string;
  rewardAmount: number;
  status: string;
  channel?: string;
  createdAt: any;
}

const PLATFORM_REFERRAL_BASE_URL = 'https://shunger.vercel.app/customer/referral/';

export default function CustomerReferralPage() {
  const { user, customer, loading: authLoading } = useAuth();
  const router = useRouter();

  const [referralCode, setReferralCode] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [referredFriends, setReferredFriends] = useState<ReferralTrackItem[]>([]);
  const [loadingTracking, setLoadingTracking] = useState(true);
  const [generatingCode, setGeneratingCode] = useState(false);

  // Generate unique code helper
  const generateUniqueCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'HUNGER';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Auth Guard & Load or Auto-Generate Referral Code
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/customer/login?redirect=/customer/referral');
      return;
    }

    const initReferralCode = async () => {
      try {
        if (customer?.referralCode && customer.referralCode.trim() !== '') {
          setReferralCode(customer.referralCode);
          return;
        }

        // Fetch fresh customer doc from Firestore
        const custRef = doc(db, 'customers', user.uid);
        const custSnap = await getDoc(custRef);

        if (custSnap.exists() && custSnap.data()?.referralCode) {
          const code = custSnap.data().referralCode;
          setReferralCode(code);
        } else {
          // Auto generate unique referral code
          setGeneratingCode(true);
          const newCode = generateUniqueCode();
          setReferralCode(newCode);

          // Save to customer doc
          await setDoc(custRef, {
            referralCode: newCode,
            updatedAt: serverTimestamp(),
          }, { merge: true });

          // Register in global referralCodes registry
          await setDoc(doc(db, 'referralCodes', newCode), {
            code: newCode,
            uid: user.uid,
            userId: user.uid,
            userName: customer?.name || user.displayName || 'Customer',
            userEmail: customer?.email || user.email || '',
            createdAt: serverTimestamp(),
          }, { merge: true });

          setGeneratingCode(false);
        }
      } catch (err) {
        console.error('Error ensuring referral code:', err);
        setGeneratingCode(false);
      }
    };

    initReferralCode();
  }, [user, customer, authLoading, router]);

  // Real-time Live Tracking of Referred Friends
  useEffect(() => {
    if (!user) return;

    setLoadingTracking(true);
    const q = query(
      collection(db, 'referrals'),
      where('referrerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: ReferralTrackItem[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            referrerId: d.referrerId || '',
            referredUserId: d.referredUserId || '',
            referredUserName: d.referredUserName || 'Hunger Customer',
            referredUserEmail: d.referredUserEmail || '',
            referredUserPhone: d.referredUserPhone || '',
            referralCode: d.referralCode || '',
            rewardAmount: typeof d.rewardAmount === 'number' ? d.rewardAmount : 50,
            status: d.status || 'completed',
            channel: d.channel || 'web',
            createdAt: d.createdAt,
          };
        });

        // Client-side sort descending by createdAt
        items.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });

        setReferredFriends(items);
        setLoadingTracking(false);
      },
      (error) => {
        console.error('Error tracking referrals:', error);
        setLoadingTracking(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const platformLink = referralCode ? `${PLATFORM_REFERRAL_BASE_URL}${referralCode}` : '';

  const copyCode = async () => {
    if (!referralCode) return;
    const ok = await copyToClipboard(referralCode);
    if (ok) {
      setCopiedCode(true);
      toast.success('Referral code copied to clipboard!');
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      toast.error('Failed to copy code');
    }
  };

  const copyLink = async () => {
    if (!platformLink) return;
    const ok = await copyToClipboard(platformLink);
    if (ok) {
      setCopiedLink(true);
      toast.success('Referral link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      toast.error('Failed to copy link');
    }
  };

  const shareWhatsApp = () => {
    if (!referralCode || !platformLink) return;
    const text = `Hey! Hungry? 🍕 Order delicious food on Hunger!\n\nSign up using my referral link and get ₹50 FREE wallet balance on your first order:\n👉 ${platformLink}\n\nOr use my invite code: *${referralCode}*`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareNative = async () => {
    if (!referralCode || !platformLink) return;
    const shareData = {
      title: 'Join Hunger - Get ₹50 Free Wallet Balance!',
      text: `Join me on Hunger! Use my referral code ${referralCode} and get ₹50 free wallet balance for your food orders!\n\nTap to join:`,
      url: platformLink,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          copyLink();
        }
      }
    } else {
      copyLink();
    }
  };

  // Calculate live statistics
  const totalEarnings = referredFriends.reduce((acc, curr) => acc + (curr.rewardAmount || 50), 0);
  const totalFriends = referredFriends.length;
  const currentWallet = customer?.walletBalance || 0;

  if (authLoading || (loadingTracking && !referralCode)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <p className="text-sm font-medium text-slate-500">Loading referral dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/customer"
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-200" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
                <Gift className="w-4 h-4" />
              </div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Refer &amp; Earn</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/customer/wallet">
              <Button variant="outline" size="sm" className="gap-2 border-orange-200 dark:border-orange-900/40 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30">
                <Wallet className="w-4 h-4" />
                <span className="font-bold">₹{currentWallet.toFixed(0)}</span>
              </Button>
            </Link>
            <FullscreenToggle className="border border-border/80 rounded-xl" showText={false} />
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 pt-6 space-y-6">
        {/* Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 text-white p-6 sm:p-8 shadow-xl shadow-orange-500/15"
        >
          {/* Background Decorative Rings */}
          <div className="absolute -top-16 -right-16 w-52 h-52 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-amber-400/20 rounded-full blur-xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold uppercase tracking-wider text-white">
                <Sparkles className="w-3.5 h-3.5 text-yellow-200" />
                Special Hunger Referral Program
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Invite Friends, Get ₹50 Free Cash!
              </h2>
              <p className="text-orange-50 text-sm sm:text-base leading-relaxed">
                Share your unique link. When your friend joins Hunger, they get <span className="font-bold text-white underline underline-offset-2">₹50 in their wallet</span> and you automatically get <span className="font-bold text-white underline underline-offset-2">₹50 credited</span> to your Hunger Wallet instantly!
              </p>
            </div>

            <div className="flex md:flex-col items-center justify-center p-4 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 text-center shrink-0">
              <div className="text-3xl sm:text-4xl font-black text-white">₹50</div>
              <div className="text-xs font-medium text-orange-100 uppercase tracking-wide mt-1">Per Referral</div>
            </div>
          </div>
        </motion.div>

        {/* Real Platform Link & Code Share Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
            <CardContent className="p-6 space-y-6">
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Your Unique Referral Code
                </span>
                <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-orange-500/20 shrink-0">
                      🎁
                    </div>
                    <div>
                      <div className="text-2xl font-black tracking-wider text-orange-600 dark:text-orange-400 font-mono">
                        {generatingCode ? 'Generating...' : referralCode || 'HUNGER...'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Give this code to friends during signup
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={copyCode}
                    variant="outline"
                    className="gap-2 border-orange-300 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-950 font-semibold"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-orange-600 dark:text-orange-400" />}
                    <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                  </Button>
                </div>
              </div>

              {/* Real Platform Link */}
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Real Platform Referral Link
                </span>
                <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="font-mono text-xs sm:text-sm text-slate-700 dark:text-slate-300 truncate select-all px-2">
                    {platformLink || 'https://shunger.vercel.app/customer/referral/...'}
                  </span>

                  <Button
                    onClick={copyLink}
                    variant="secondary"
                    size="sm"
                    className="shrink-0 gap-2 font-medium"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                  </Button>
                </div>
              </div>

              {/* Quick Share Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Button
                  onClick={shareWhatsApp}
                  className="w-full gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold h-12 rounded-2xl shadow-lg shadow-green-500/10 text-base"
                >
                  <MessageCircle className="w-5 h-5 fill-current" />
                  <span>Share on WhatsApp</span>
                </Button>

                <Button
                  onClick={shareNative}
                  className="w-full gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold h-12 rounded-2xl shadow-lg shadow-orange-500/20 text-base"
                >
                  <Share2 className="w-5 h-5" />
                  <span>Share Link to Friends</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Live Performance Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {totalFriends}
                </div>
                <div className="text-xs font-medium text-slate-500">Friends Joined</div>
              </div>
            </div>
          </Card>

          <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  ₹{totalEarnings}
                </div>
                <div className="text-xs font-medium text-slate-500">Total Rewards Earned</div>
              </div>
            </div>
          </Card>

          <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  ₹{currentWallet.toFixed(0)}
                </div>
                <div className="text-xs font-medium text-slate-500">Current Wallet Balance</div>
              </div>
            </div>
          </Card>
        </div>

        {/* How it Works Stepper */}
        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold text-base text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            How the Referral Program Works
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center text-xs">
                1
              </div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Share Your Link</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Send your real platform referral link via WhatsApp, SMS, or Social Media.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center text-xs">
                2
              </div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Friend Creates Account</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your friend taps your link and completes signup. They instantly receive ₹50.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-xs">
                3
              </div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Instant ₹50 Reward!</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You immediately get ₹50 credited into your Hunger wallet for tasty food orders!
              </p>
            </div>
          </div>
        </Card>

        {/* Live Referral Tracking List */}
        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping absolute" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  Live Referral Tracking
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time list of all users who created accounts via your referral link
                </p>
              </div>
            </div>

            <Badge variant="outline" className="border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40">
              {totalFriends} Joined
            </Badge>
          </div>

          <CardContent className="p-0">
            {loadingTracking ? (
              <div className="p-8 text-center flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                <p className="text-xs text-slate-500">Connecting to live tracking stream...</p>
              </div>
            ) : referredFriends.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center space-y-3">
                <div className="w-16 h-16 rounded-3xl bg-orange-500/10 text-orange-500 flex items-center justify-center text-3xl mb-1">
                  👥
                </div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-base">
                  No Friends Joined Yet
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Share your referral link on WhatsApp or copy it to invite friends. As soon as they sign up, they will appear here live with your ₹50 reward!
                </p>
                <Button
                  onClick={shareWhatsApp}
                  size="sm"
                  className="gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl mt-2"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Invite Friends Now</span>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {referredFriends.map((item, index) => {
                  const initial = item.referredUserName ? item.referredUserName.charAt(0).toUpperCase() : 'H';
                  let formattedDate = 'Recently';
                  if (item.createdAt) {
                    try {
                      const d = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
                      formattedDate = d.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                    } catch {
                      formattedDate = 'Recently';
                    }
                  }

                  return (
                    <motion.div
                      key={item.id || index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 text-white font-bold text-base flex items-center justify-center shadow-sm shrink-0">
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                              {item.referredUserName}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                              ✓ Verified
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{formattedDate}</span>
                            <span>•</span>
                            <span className="capitalize">{item.channel === 'android' ? '📱 App' : '🌐 Web'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 pl-3">
                        <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
                          +₹{item.rewardAmount || 50}
                        </div>
                        <div className="text-[11px] font-medium text-slate-400">
                          Wallet Credited
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
