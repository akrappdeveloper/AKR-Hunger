'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, TrendingUp, Award, Clock, Star, Bike, IndianRupee, Target, Flame, Zap } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function PerformancePage() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  const stats = {
    daily: { deliveries: 8, onTime: 7, avgTime: 28, rating: 4.8, earnings: 640, tips: 120, distance: 32 },
    weekly: { deliveries: 42, onTime: 38, avgTime: 26, rating: 4.7, earnings: 3360, tips: 580, distance: 168 },
    monthly: { deliveries: 156, onTime: 142, avgTime: 27, rating: 4.7, earnings: 12480, tips: 2100, distance: 624 },
  };

  const data = stats[period];
  const onTimeRate = Math.round((data.onTime / data.deliveries) * 100);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/delivery/dashboard">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-black flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Performance Stats
            </h1>
            <p className="text-xs text-muted-foreground">Track your delivery performance</p>
          </div>
        </div>

        {/* Period Toggle */}
        <div className="flex gap-2 bg-muted rounded-full p-1">
          {(['daily', 'weekly', 'monthly'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-2 rounded-full text-sm font-semibold capitalize transition-all ${
                period === p ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Deliveries', value: data.deliveries, icon: Bike, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'On-Time Rate', value: `${onTimeRate}%`, icon: Clock, color: 'text-green-500', bg: 'bg-green-500/10' },
            { label: 'Avg Time', value: `${data.avgTime} min`, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            { label: 'Rating', value: data.rating.toFixed(1), icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
            { label: 'Earnings', value: `₹${data.earnings}`, icon: IndianRupee, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { label: 'Tips', value: `₹${data.tips}`, icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10' },
            { label: 'Distance', value: `${data.distance} km`, icon: Target, color: 'text-purple-500', bg: 'bg-purple-500/10' },
            { label: 'Score', value: onTimeRate >= 90 ? 'Excellent' : onTimeRate >= 80 ? 'Good' : 'Improve', icon: Award, color: 'text-pink-500', bg: 'bg-pink-500/10' },
          ].map(({ label, value, icon: Icon, color, bg }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="p-4">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-2`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <p className="text-xl font-black">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Performance Badge */}
        <Card className="p-6 text-center bg-gradient-to-br from-primary/5 to-orange-500/5 border-primary/20">
          <Award className="w-12 h-12 mx-auto text-primary mb-3" />
          <h2 className="text-lg font-black">
            {onTimeRate >= 90 ? '🏆 Gold Partner' : onTimeRate >= 80 ? '🥈 Silver Partner' : '🥉 Bronze Partner'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {onTimeRate >= 90
              ? "Outstanding performance! You're among our top delivery partners."
              : onTimeRate >= 80
                ? 'Great work! Keep up the good performance.'
                : 'Keep improving to unlock more rewards and bonuses.'}
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <Badge variant="outline" className="text-xs font-bold">
              {data.deliveries} deliveries this {period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month'}
            </Badge>
            <Badge variant="outline" className="text-xs font-bold text-primary border-primary/30 bg-primary/5">
              {onTimeRate}% on-time
            </Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}
