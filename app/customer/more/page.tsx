'use client';

import React, { useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Users, Calendar, Heart, Sparkles, ChevronRight,
  CheckCircle2, ArrowRight, Share2, Copy, ShieldCheck, Clock,
  UtensilsCrossed, Gift, Crown, Tag, MessageCircle, Wallet, HelpCircle,
  Plus, Check, Video, Compass, Salad, RotateCcw, BookOpen, Smile,
  Dices, Calculator, Lock, Leaf, Search, ArrowLeft, Star, Film,
  Package, Zap, Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import FullscreenToggle from '@/components/customer/FullscreenToggle';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

interface HubFeature {
  id: string;
  title: string;
  tagline: string;
  category: 'smart' | 'campus' | 'health' | 'savings' | 'experience';
  icon: any;
  emoji: string;
  href: string;
  gradient: string;
  accentColor: string;
  badge?: string;
  badgeColor?: string;
}

const ALL_FEATURES: HubFeature[] = [
  {
    id: 'roulette',
    title: 'Food Roulette Wheel',
    tagline: 'Spin the wheel for secret discounts, wallet cashback & mystery dish choices',
    category: 'smart',
    icon: Dices,
    emoji: '🎲',
    href: '/customer/roulette',
    gradient: 'from-purple-600/20 via-fuchsia-600/10 to-transparent border-purple-500/40',
    accentColor: 'text-purple-500',
    badge: 'Popular Game',
    badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
  {
    id: 'mood',
    title: 'Mood Food Matcher',
    tagline: 'Order chef meals crafted for your current emotion (Rainy, Stressed, Midnight)',
    category: 'smart',
    icon: Smile,
    emoji: '😊',
    href: '/customer/mood',
    gradient: 'from-pink-600/20 via-rose-600/10 to-transparent border-pink-500/40',
    accentColor: 'text-pink-500',
    badge: 'AI Vibe Match',
    badgeColor: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  },
  {
    id: 'student',
    title: 'Campus & Student Mode',
    tagline: 'Budget meals under ₹99, hostel midnight food delivery & verified 15% student off',
    category: 'campus',
    icon: GraduationCap,
    emoji: '🎓',
    href: '/customer/student',
    gradient: 'from-blue-600/20 via-indigo-600/10 to-transparent border-blue-500/40',
    accentColor: 'text-blue-500',
    badge: '15% Off',
    badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  {
    id: 'split-bill',
    title: 'Party Bill Splitter',
    tagline: 'Divide hostel room & party food bills equally with automatic WhatsApp UPI links',
    category: 'campus',
    icon: Calculator,
    emoji: '👥',
    href: '/customer/split-bill',
    gradient: 'from-emerald-600/20 via-teal-600/10 to-transparent border-emerald-500/40',
    accentColor: 'text-emerald-500',
    badge: 'UPI Share',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'diet-planner',
    title: 'Diet & Calorie Goal',
    tagline: 'Set daily calorie targets & discover high-protein, keto & healthy macro meals',
    category: 'health',
    icon: Salad,
    emoji: '🍏',
    href: '/customer/diet-planner',
    gradient: 'from-green-600/20 via-emerald-600/10 to-transparent border-green-500/40',
    accentColor: 'text-green-500',
    badge: 'Macro Tracker',
    badgeColor: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
  {
    id: 'meal-planner',
    title: 'Weekly Tiffin Planner',
    tagline: 'Scheduled automated homestyle breakfast, lunch & dinner tiffin subscriptions',
    category: 'health',
    icon: Calendar,
    emoji: '📅',
    href: '/customer/meal-planner',
    gradient: 'from-amber-600/20 via-yellow-600/10 to-transparent border-amber-500/40',
    accentColor: 'text-amber-500',
    badge: 'Tiffin Pass',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  {
    id: 'reorder',
    title: '1-Click Past Reorder',
    tagline: 'Reorder your top comfort foods and past orders in a single instant tap',
    category: 'smart',
    icon: RotateCcw,
    emoji: '🔁',
    href: '/customer/reorder',
    gradient: 'from-cyan-600/20 via-sky-600/10 to-transparent border-cyan-500/40',
    accentColor: 'text-cyan-500',
    badge: 'Instant Repeat',
    badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  },
  {
    id: 'secret-menu',
    title: 'The Secret Vault Menu',
    tagline: 'Classified chef off-menu recipes, midnight kitchen experiments & unlisted specials',
    category: 'experience',
    icon: Lock,
    emoji: '🔒',
    href: '/customer/secret-menu',
    gradient: 'from-purple-950/40 via-violet-900/20 to-transparent border-purple-500/50',
    accentColor: 'text-purple-400',
    badge: 'Classified',
    badgeColor: 'bg-purple-900/60 text-purple-300 border-purple-400/40',
  },
  {
    id: 'mystery-box',
    title: 'Blind Mystery Food Box',
    tagline: 'Chef curated surprise multi-course boxes with up to 45% guaranteed extra value',
    category: 'experience',
    icon: Gift,
    emoji: '🎁',
    href: '/customer/mystery-box',
    gradient: 'from-orange-600/20 via-amber-600/10 to-transparent border-orange-500/40',
    accentColor: 'text-orange-500',
    badge: '45% Extra Value',
    badgeColor: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  },
  {
    id: 'eco',
    title: 'Green EV Delivery & Offset',
    tagline: 'Zero-emission electric delivery fleet, plastic-free orders & Eco-Karma tracking',
    category: 'health',
    icon: Leaf,
    emoji: '🌿',
    href: '/customer/eco',
    gradient: 'from-emerald-700/20 via-green-700/10 to-transparent border-emerald-600/40',
    accentColor: 'text-emerald-500',
    badge: 'Carbon Neutral',
    badgeColor: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30',
  },
  {
    id: 'referral',
    title: 'Refer & Earn Free Cash',
    tagline: 'Invite friends to Hunger: They get ₹50 and you earn ₹50 instant wallet cash',
    category: 'savings',
    icon: Sparkles,
    emoji: '💸',
    href: '/customer/referral',
    gradient: 'from-amber-500/20 via-orange-500/10 to-transparent border-amber-500/40',
    accentColor: 'text-amber-500',
    badge: '₹50 Free',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  {
    id: 'membership',
    title: 'VIP Hunger Club',
    tagline: 'Unlimited free delivery on all orders, zero surge pricing & VIP chef invitations',
    category: 'savings',
    icon: Crown,
    emoji: '👑',
    href: '/customer/membership',
    gradient: 'from-yellow-600/20 via-amber-500/10 to-transparent border-yellow-500/40',
    accentColor: 'text-yellow-500',
    badge: 'VIP Perks',
    badgeColor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  },
  {
    id: 'circle',
    title: 'Hunger Circle Family Care',
    tagline: 'Order nutritious meals remotely for your parents, children & loved ones with live tracking',
    category: 'campus',
    icon: Heart,
    emoji: '❤️',
    href: '/customer/circle',
    gradient: 'from-rose-600/20 via-pink-600/10 to-transparent border-rose-500/40',
    accentColor: 'text-rose-500',
    badge: 'Family Care',
    badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  },
  {
    id: 'group',
    title: 'Group Order Room',
    tagline: 'Create a shared room link so friends and coworkers can pick their own dishes together',
    category: 'campus',
    icon: Users,
    emoji: '🤝',
    href: '/customer/group',
    gradient: 'from-indigo-600/20 via-purple-600/10 to-transparent border-indigo-500/40',
    accentColor: 'text-indigo-500',
    badge: 'Live Cart Sync',
    badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  },
  {
    id: 'cuisines',
    title: '16+ Cuisines Explorer',
    tagline: 'Explore North Indian, Mughlai, Italian, Asian, Coastal & authentic regional cuisines',
    category: 'experience',
    icon: UtensilsCrossed,
    emoji: '🍽️',
    href: '/customer/cuisines',
    gradient: 'from-amber-500/20 via-red-500/10 to-transparent border-amber-500/40',
    accentColor: 'text-amber-500',
    badge: 'Multi-Cuisine',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  {
    id: 'stories',
    title: 'Food Stories & Reels',
    tagline: 'Watch sizzling short video food reels from top restaurant chefs and discover viral meals',
    category: 'experience',
    icon: Film,
    emoji: '🎬',
    href: '/customer/stories',
    gradient: 'from-red-600/20 via-rose-600/10 to-transparent border-red-500/40',
    accentColor: 'text-red-500',
    badge: 'Watch & Order',
    badgeColor: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
];

function MoreFeaturesContent() {
  const router = useRouter();
  const { user, customer } = useAuth();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');

  const filteredFeatures = useMemo(() => {
    return ALL_FEATURES.filter(f => {
      const matchCat = activeCategory === 'all' || f.category === activeCategory;
      const q = searchFilter.toLowerCase();
      const matchSearch = !searchFilter.trim() || f.title.toLowerCase().includes(q) || f.tagline.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [activeCategory, searchFilter]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Full-width Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/70 px-4 sm:px-6 lg:px-8 py-3.5 shadow-xs">
        <div className="w-full max-w-[1700px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/customer">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2 tracking-tight">
                <Sparkles className="w-6 h-6 text-primary" />
                Hunger Features &amp; Ecosystem Hub
              </h1>
              <p className="text-xs text-muted-foreground">
                All 16+ innovative ways to discover, game, plan, save &amp; feast
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Search all features..."
                className="pl-8 py-1.5 h-9 text-xs rounded-xl bg-card border-border"
              />
            </div>
            <FullscreenToggle className="border border-border/80 rounded-xl" showText={false} />
          </div>
        </div>
      </div>

      {/* Main Full-Width Responsive Container */}
      <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-8">
        
        {/* Luxury Ecosystem Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary via-orange-600 to-amber-600 text-white p-6 sm:p-10 shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.2),transparent_70%)]" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <Badge className="bg-white/20 text-white border-none px-3 py-1 text-xs uppercase tracking-wider backdrop-blur-md">
                ⭐ All-In-One Food Innovation
              </Badge>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
                More Than Just Delivery. A Complete Food Ecosystem.
              </h2>
              <p className="text-orange-100 text-sm sm:text-base leading-relaxed">
                Play the Roulette Wheel, match meals to your mood, plan weekly tiffins, split group orders via WhatsApp UPI, and unlock classified off-menu secrets.
              </p>
            </div>

            {/* User Live Account Perks Card */}
            {user && (
              <div className="bg-black/25 backdrop-blur-md rounded-2xl p-5 border border-white/20 space-y-3 shrink-0 sm:min-w-[280px]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-lg">
                    {user.email?.[0].toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm truncate max-w-[170px] capitalize">
                      {customer?.name || (user.email ? user.email.split('@')[0] : 'Member')}
                    </h4>
                    <span className="text-[11px] text-white/80 block">Active Foodie Status</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-t border-white/15 pt-2.5">
                  <div>
                    <span className="text-[10px] text-white/70 block uppercase font-semibold">Wallet</span>
                    <span className="font-mono font-bold text-sm">₹{Number(customer?.walletBalance || 0).toFixed(0)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/70 block uppercase font-semibold">Reward Pts</span>
                    <span className="font-mono font-bold text-sm">{customer?.rewardPoints || 0} pts</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Category Tabs Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide py-1">
          {[
            { id: 'all', label: '🌟 All Features (16)' },
            { id: 'smart', label: '🎲 Games & Smart (Roulette, Mood, Reorder)' },
            { id: 'campus', label: '🎓 Campus & Social (Student, Split, Group)' },
            { id: 'health', label: '🥗 Health & Plans (Diet, Tiffin, Eco)' },
            { id: 'experience', label: '🔒 Secret Vault & Box (Mystery, Off-Menu, Reels)' },
            { id: 'savings', label: '💸 Savings & VIP (Referral, Deals, Club)' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border ${
                activeCategory === tab.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Features Grid - Full Screen Responsive 1 to 4 cols */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredFeatures.map((feat, i) => {
            const Icon = feat.icon;

            return (
              <motion.div
                key={feat.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
              >
                <Link href={feat.href} className="block group h-full">
                  <Card className={`p-6 rounded-3xl border-2 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5 h-full flex flex-col justify-between bg-card ${feat.gradient} hover:border-primary`}>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="w-14 h-14 rounded-2xl bg-background border border-border flex items-center justify-center text-3xl shadow-sm group-hover:scale-110 transition-transform">
                          {feat.emoji}
                        </div>
                        {feat.badge && (
                          <Badge className={`${feat.badgeColor} text-[10px] font-bold px-2.5 py-0.5`}>
                            {feat.badge}
                          </Badge>
                        )}
                      </div>

                      <div>
                        <h3 className="text-xl font-black text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          {feat.title}
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all text-primary" />
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                          {feat.tagline}
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border/50 flex items-center justify-between text-xs font-bold text-primary mt-4">
                      <span>Launch Feature</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

export default function MorePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <MoreFeaturesContent />
    </Suspense>
  );
}
