'use client';

/**
 * Hunger Student Mode Page
 * =========================
 * Budget-friendly meals, hostel delivery, student deals,
 * late-night food, and student wallet. 🎓
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  GraduationCap, BookOpen, Moon, Users, Wallet,
  Star, Clock, ChevronRight, Tag, Zap, Shield
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const BUDGET_CATEGORIES = [
  {
    price: '₹99',
    label: 'Lite Bites',
    emoji: '🥗',
    description: 'Snacks & light meals',
    color: 'from-green-500/20 to-emerald-500/10 border-green-500/30',
    badge: 'green',
    items: ['Veg Roll', 'Masala Dosa', 'Poha', 'Upma', 'Bread Omelette'],
  },
  {
    price: '₹149',
    label: 'Campus Meal',
    emoji: '🍛',
    description: 'Full meals for students',
    color: 'from-orange-500/20 to-amber-500/10 border-orange-500/30',
    badge: 'orange',
    items: ['Dal Rice', 'Veg Thali', 'Chole Bhature', 'Egg Fried Rice', 'Paneer Wrap'],
  },
  {
    price: '₹199',
    label: 'Power Meal',
    emoji: '💪',
    description: 'High-protein, filling meals',
    color: 'from-purple-500/20 to-violet-500/10 border-purple-500/30',
    badge: 'purple',
    items: ['Chicken Biryani', 'Butter Paneer + Roti', 'Egg Curry Rice', 'Chicken Roll', 'Fish Fry Rice'],
  },
];

const WEEKLY_OFFERS = [
  { day: 'Mon', offer: '20% off on all veg meals', emoji: '🌱' },
  { day: 'Tue', offer: 'Buy 2 get 1 free drinks', emoji: '🥤' },
  { day: 'Wed', offer: 'Free delivery on ₹99+ orders', emoji: '🛵' },
  { day: 'Thu', offer: '₹30 off on biryani', emoji: '🍲' },
  { day: 'Fri', offer: 'Late night 25% off (10PM–2AM)', emoji: '🌙' },
  { day: 'Sat', offer: 'Group order bonus 50 pts', emoji: '👥' },
  { day: 'Sun', offer: 'Brunch special ₹99 combos', emoji: '☕' },
];

const FEATURES = [
  {
    icon: GraduationCap,
    title: 'Student-Only Deals',
    desc: 'Exclusive discounts verified students get every day',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Moon,
    title: 'Late Night Food',
    desc: 'Open till 2 AM for hostel students',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
  },
  {
    icon: Users,
    title: 'Group Ordering',
    desc: 'Order together, split the bill easily',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
  },
  {
    icon: Wallet,
    title: 'Student Wallet',
    desc: 'Load money once, use for the whole month',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: Star,
    title: 'Meal Subscriptions',
    desc: 'Weekly/monthly meal plans from ₹1499',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  {
    icon: Zap,
    title: 'Hostel Delivery',
    desc: 'Direct delivery to your hostel room',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
  },
];

interface StudentModePageProps {
  isStudentVerified?: boolean;
  onEnableStudentMode?: () => void;
}

export default function StudentModePage({
  isStudentVerified = false,
  onEnableStudentMode,
}: StudentModePageProps) {
  const [activeDay, setActiveDay] = useState(new Date().getDay());
  const today = WEEKLY_OFFERS[activeDay === 0 ? 6 : activeDay - 1];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 px-6 pt-14 pb-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="absolute top-4 right-4 text-8xl opacity-10 select-none pointer-events-none">🎓</div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative text-white"
        >
          <div className="flex items-center gap-3 mb-3">
            <GraduationCap className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">Hunger Student</h1>
              <p className="text-white/70 text-sm">Food that fits your budget & schedule</p>
            </div>
          </div>

          {isStudentVerified ? (
            <Badge className="bg-emerald-500/30 text-emerald-200 border-emerald-400/40">
              <Shield className="w-3 h-3 mr-1" /> Verified Student
            </Badge>
          ) : (
            <Badge className="bg-white/20 text-white/80 border-white/30">
              Verification optional
            </Badge>
          )}
        </motion.div>
      </div>

      {/* Today's highlight */}
      <div className="mx-4 -mt-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xl shadow-amber-500/30"
        >
          <div className="flex items-center gap-2 mb-1">
            <Tag className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Today&apos;s Offer</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{today.emoji}</span>
            <span className="font-bold">{today.offer}</span>
          </div>
        </motion.div>
      </div>

      {/* Budget Categories */}
      <div className="px-4 mt-6">
        <h2 className="text-base font-bold mb-3">Budget Meals</h2>
        <div className="grid grid-cols-3 gap-3">
          {BUDGET_CATEGORIES.map((cat, i) => (
            <motion.div
              key={cat.price}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileTap={{ scale: 0.97 }}
              className={`p-4 rounded-2xl bg-gradient-to-br border cursor-pointer ${cat.color}`}
            >
              <div className="text-3xl mb-2">{cat.emoji}</div>
              <div className="text-lg font-bold">{cat.price}</div>
              <div className="text-xs font-semibold">{cat.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{cat.description}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Weekly Offers */}
      <div className="px-4 mt-6">
        <h2 className="text-base font-bold mb-3">Weekly Offers</h2>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {WEEKLY_OFFERS.map((item, i) => (
            <button
              key={item.day}
              onClick={() => setActiveDay(i === 6 ? 0 : i + 1)}
              className={`flex-shrink-0 flex flex-col items-center p-3 rounded-xl border transition-all ${
                (i === 6 ? 0 : i + 1) === activeDay
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                  : 'bg-muted/30 border-border text-muted-foreground'
              }`}
            >
              <span className="text-lg">{item.emoji}</span>
              <span className="text-xs font-semibold mt-1">{item.day}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-300">
          📅 {today.offer}
        </div>
      </div>

      {/* Features Grid */}
      <div className="px-4 mt-6">
        <h2 className="text-base font-bold mb-3">Student Benefits</h2>
        <div className="grid grid-cols-2 gap-3">
          {FEATURES.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.07 }}
              className="p-4 rounded-2xl bg-card border border-border"
            >
              <div className={`inline-flex p-2.5 rounded-xl ${feat.bg} mb-3`}>
                <feat.icon className={`w-5 h-5 ${feat.color}`} />
              </div>
              <div className="font-semibold text-sm">{feat.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{feat.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Subscription CTA */}
      <div className="px-4 mt-6">
        <motion.div
          whileTap={{ scale: 0.98 }}
          className="p-5 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/10 border border-violet-500/30"
        >
          <div className="flex items-start gap-4">
            <div className="text-3xl">📅</div>
            <div className="flex-1">
              <h3 className="font-bold">Student Lunch Plan</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Lunch every weekday from selected restaurants
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xl font-bold text-violet-400">₹1,499</span>
                <span className="text-sm text-muted-foreground">/month</span>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                  Save 35%
                </Badge>
              </div>
            </div>
          </div>
          <Link href="/customer/subscriptions">
            <Button className="mt-4 w-full bg-gradient-to-r from-violet-500 to-purple-600 text-white">
              View All Plans <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </motion.div>
      </div>

      {/* Verification CTA */}
      {!isStudentVerified && (
        <div className="px-4 mt-4 mb-6">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-6 h-6 text-blue-400 flex-shrink-0" />
              <div>
                <div className="font-semibold text-sm">Verify Student Status</div>
                <div className="text-xs text-muted-foreground">
                  Upload college ID for extra 10% off on all orders
                </div>
              </div>
            </div>
            <Button
              onClick={onEnableStudentMode}
              variant="outline"
              className="mt-3 w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              size="sm"
            >
              Verify Now (Optional)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
