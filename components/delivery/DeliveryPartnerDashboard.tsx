'use client';

/**
 * Hunger Delivery Partner Fairness Dashboard
 * ============================================
 * Shows earnings, orders, distance, bonuses, rating,
 * Fair Route Score, and earnings per km/hour.
 * UI kept extremely simple for quick rider interaction.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, Star, MapPin, Clock, Zap,
  IndianRupee, Package, Award, ChevronRight,
  Gauge, BadgeCheck
} from 'lucide-react';
import { PartnerEarningsStats } from '@/lib/hunger-types-client';

// Mock data - in production, fetched from Firestore
const MOCK_STATS: PartnerEarningsStats = {
  partnerId: 'demo',
  date: new Date().toISOString().split('T')[0],
  totalOrders: 18,
  completedOrders: 18,
  baseEarnings: 666,
  bonusEarnings: 120,
  incentives: 0,
  totalEarnings: 786,
  pendingSettlement: 120,
  totalDistanceKm: 64,
  totalTimeMinutes: 380,
  waitingTimeMinutes: 45,
  earningsPerKm: 12.28,
  earningsPerHour: 124,
  fairRouteScore: 87,
  averageRating: 4.9,
  avgOrderValue: 43.67,
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  bgColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  color: string;
  bgColor: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-4 rounded-2xl bg-card border border-border"
    >
      <div className={`inline-flex p-2.5 rounded-xl ${bgColor} mb-3`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-0.5">{label}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </motion.div>
  );
}

export default function DeliveryPartnerDashboard() {
  const [stats] = useState<PartnerEarningsStats>(MOCK_STATS);
  const [greeting, setGreeting] = useState('Good day');

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Good morning');
    else if (h < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const routeScoreColor =
    stats.fairRouteScore >= 80 ? 'text-emerald-400' :
    stats.fairRouteScore >= 60 ? 'text-amber-400' : 'text-red-400';

  const routeScoreBg =
    stats.fairRouteScore >= 80 ? 'bg-emerald-500/20' :
    stats.fairRouteScore >= 60 ? 'bg-amber-500/20' : 'bg-red-500/20';

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-black px-5 pt-14 pb-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.15),transparent_60%)]" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <p className="text-slate-400 text-sm">{greeting}, Partner! 👋</p>
          <h1 className="text-2xl font-bold text-white mt-1">Today&apos;s Performance</h1>
          <p className="text-slate-500 text-xs mt-1">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </motion.div>

        {/* Total Earnings Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative mt-6 p-5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-500/25"
        >
          <div className="flex items-end justify-between">
            <div>
              <div className="text-blue-100 text-sm font-medium">Total Earnings</div>
              <div className="text-4xl font-bold text-white mt-1">₹{stats.totalEarnings}</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs bg-white/20 rounded-full px-2 py-0.5 text-white/80">
                  Base: ₹{stats.baseEarnings}
                </span>
                <span className="text-xs bg-emerald-400/20 rounded-full px-2 py-0.5 text-emerald-200">
                  +₹{stats.bonusEarnings} bonus
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-blue-200 text-xs">Pending</div>
              <div className="text-xl font-bold text-amber-300">₹{stats.pendingSettlement}</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Stats Grid */}
      <div className="px-4 py-4 grid grid-cols-2 gap-3">
        <StatCard
          icon={Package}
          label="Orders"
          value={`${stats.totalOrders}`}
          sub={`${stats.completedOrders} completed`}
          color="text-blue-400"
          bgColor="bg-blue-500/10"
        />
        <StatCard
          icon={MapPin}
          label="Distance"
          value={`${stats.totalDistanceKm} km`}
          sub="Today's total"
          color="text-orange-400"
          bgColor="bg-orange-500/10"
        />
        <StatCard
          icon={Star}
          label="Rating"
          value={`${stats.averageRating}⭐`}
          sub="Customer rating"
          color="text-amber-400"
          bgColor="bg-amber-500/10"
        />
        <StatCard
          icon={IndianRupee}
          label="Avg/Order"
          value={`₹${stats.avgOrderValue.toFixed(0)}`}
          sub="Per delivery"
          color="text-emerald-400"
          bgColor="bg-emerald-500/10"
        />
      </div>

      {/* Efficiency Metrics */}
      <div className="px-4 mb-4">
        <h2 className="text-base font-bold mb-3">Earnings Efficiency</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/5 border border-emerald-500/25">
            <div className="flex items-center gap-2 mb-1">
              <Gauge className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">Per KM</span>
            </div>
            <div className="text-2xl font-bold">₹{stats.earningsPerKm.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">earnings per km</div>
          </div>
          <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/15 to-purple-500/5 border border-violet-500/25">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-medium text-violet-400">Per Hour</span>
            </div>
            <div className="text-2xl font-bold">₹{stats.earningsPerHour}</div>
            <div className="text-xs text-muted-foreground">earnings per hour</div>
          </div>
        </div>
      </div>

      {/* Fair Route Score */}
      <div className="px-4 mb-4">
        <div className="p-5 rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-blue-400" />
              <div>
                <div className="font-bold text-sm">Fair Route Score</div>
                <div className="text-xs text-muted-foreground">How efficient your assigned routes are</div>
              </div>
            </div>
            <div className={`text-3xl font-bold ${routeScoreColor}`}>
              {stats.fairRouteScore}
            </div>
          </div>

          {/* Score bar */}
          <div className="w-full h-3 rounded-full bg-border mb-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stats.fairRouteScore}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                stats.fairRouteScore >= 80 ? 'bg-gradient-to-r from-emerald-400 to-teal-400' :
                stats.fairRouteScore >= 60 ? 'bg-gradient-to-r from-amber-400 to-orange-400' :
                'bg-gradient-to-r from-red-400 to-rose-400'
              }`}
            />
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 — Inefficient</span>
            <span>{stats.fairRouteScore >= 80 ? '✅ Excellent' : stats.fairRouteScore >= 60 ? '⚠️ Average' : '❗ Review needed'}</span>
            <span>100 — Optimal</span>
          </div>

          <div className="mt-3 p-3 rounded-xl bg-muted/30 text-xs text-muted-foreground">
            💡 Fair Route Score measures route efficiency. A high score means you&apos;re getting well-optimized deliveries.
          </div>
        </div>
      </div>

      {/* Time Breakdown */}
      <div className="px-4 mb-4">
        <h2 className="text-base font-bold mb-3">Time Breakdown</h2>
        <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
          {[
            { label: 'Active Delivery Time', value: `${stats.totalTimeMinutes - stats.waitingTimeMinutes} min`, color: 'bg-blue-400' },
            { label: 'Waiting Time', value: `${stats.waitingTimeMinutes} min`, color: 'bg-amber-400' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${item.color}`} />
                <span className="text-sm">{item.label}</span>
              </div>
              <span className="font-semibold text-sm">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Incentives & Bonus */}
      {stats.bonusEarnings > 0 && (
        <div className="px-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center gap-3"
          >
            <Award className="w-8 h-8 text-amber-400 flex-shrink-0" />
            <div>
              <div className="font-bold text-amber-400">₹{stats.bonusEarnings} Bonus Earned!</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Completed 18 orders — Peak hour bonus applied
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
