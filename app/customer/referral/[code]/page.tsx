'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Gift,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Smartphone,
  Flame,
  Award,
  ChevronRight,
  Store,
} from 'lucide-react';

export default function ReferralLandingPage() {
  const params = useParams();
  const router = useRouter();
  const rawCode = (params?.code as string) || '';
  const referralCode = rawCode.toUpperCase().trim();

  const [referrerName, setReferrerName] = useState<string>('A Hunger Foodie');
  const [loading, setLoading] = useState<boolean>(true);
  const [isValidCode, setIsValidCode] = useState<boolean>(true);

  useEffect(() => {
    if (!referralCode) {
      setLoading(false);
      return;
    }

    // Persist code in localStorage so user gets credit even if they navigate away
    try {
      localStorage.setItem('hunger_referral_code', referralCode);
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }

    const checkReferralCode = async () => {
      try {
        // 1. Check in referralCodes registry
        const codeSnap = await getDoc(doc(db, 'referralCodes', referralCode));
        if (codeSnap.exists()) {
          const data = codeSnap.data();
          if (data?.userName) {
            setReferrerName(data.userName);
          }
          setIsValidCode(true);
          setLoading(false);
          return;
        }

        // 2. Check in customers collection
        const q = query(
          collection(db, 'customers'),
          where('referralCode', '==', referralCode)
        );
        const custSnap = await getDocs(q);
        if (!custSnap.empty) {
          const data = custSnap.docs[0].data();
          if (data?.name) {
            setReferrerName(data.name);
          }
          setIsValidCode(true);
        } else {
          // Keep code valid anyway to ensure user still receives ₹50 bonus on sign up
          setIsValidCode(true);
        }
      } catch (err) {
        console.error('Error fetching referrer details:', err);
      } finally {
        setLoading(false);
      }
    };

    checkReferralCode();
  }, [referralCode]);

  const handleClaim = () => {
    router.push(`/customer/login?ref=${encodeURIComponent(referralCode)}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between selection:bg-orange-500 selection:text-white relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-orange-500/20 via-amber-500/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-orange-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative z-10 max-w-4xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center font-black text-xl shadow-lg shadow-orange-500/30">
            🍕
          </div>
          <span className="font-black text-xl tracking-tight text-white">
            HUNGER
          </span>
        </Link>

        <Link href={`/customer/login?ref=${referralCode}`}>
          <Button variant="ghost" className="text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/10">
            Sign In
          </Button>
        </Link>
      </header>

      {/* Hero Invitation Section */}
      <main className="relative z-10 max-w-xl mx-auto w-full px-5 py-8 flex-1 flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6 text-center"
        >
          {/* Inviter Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs sm:text-sm font-semibold backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-orange-400 animate-pulse" />
            <span>{referrerName} invited you to join Hunger</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Claim Your <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-400 bg-clip-text text-transparent">₹50 Free Cash</span> For Food!
          </h1>

          <p className="text-slate-300 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
            Create your account today with this exclusive invite. ₹50 will be credited directly to your Hunger Wallet for delicious meals!
          </p>

          {/* Referral Code Display Card */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-xl relative overflow-hidden max-w-md mx-auto">
            <div className="absolute top-0 right-0 w-28 h-28 bg-orange-500/10 rounded-full blur-xl pointer-events-none" />

            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
              Referral Code Applied
            </div>

            <div className="flex items-center justify-center gap-2 bg-slate-950 py-3 px-6 rounded-2xl border border-orange-500/30">
              <span className="font-mono text-2xl sm:text-3xl font-black tracking-wider text-orange-400">
                {referralCode || 'HUNGER...'}
              </span>
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            </div>

            <div className="mt-3 text-xs text-emerald-400 font-medium flex items-center justify-center gap-1.5">
              <span>✓ Verified invite code • ₹50 bonus activated</span>
            </div>
          </div>

          {/* Call to Action Button */}
          <div className="space-y-3 pt-2 max-w-md mx-auto">
            <Button
              onClick={handleClaim}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black text-lg shadow-xl shadow-orange-500/30 gap-2 transition-all transform active:scale-95"
            >
              <Gift className="w-5 h-5" />
              <span>Claim ₹50 & Create Account</span>
              <ArrowRight className="w-5 h-5 ml-1" />
            </Button>

            <a
              href={`https://shunger.vercel.app/customer/referral/${referralCode}`}
              className="inline-flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-slate-200 py-2 transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Have the Android app? Open via App</span>
            </a>
          </div>

          {/* Perks Grid */}
          <div className="grid grid-cols-3 gap-3 pt-6 max-w-md mx-auto text-left">
            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
              <div className="text-orange-400 text-lg mb-1">🎁</div>
              <div className="text-xs font-bold text-white">Instant ₹50</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Wallet credit</div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
              <div className="text-amber-400 text-lg mb-1">⚡</div>
              <div className="text-xs font-bold text-white">Fast Delivery</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Hot & fresh food</div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
              <div className="text-emerald-400 text-lg mb-1">🛡️</div>
              <div className="text-xs font-bold text-white">Live GPS</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Order tracking</div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-4xl mx-auto w-full px-6 py-6 text-center text-xs text-slate-500">
        © 2026 Hunger Delivery Platform
      </footer>
    </div>
  );
}
