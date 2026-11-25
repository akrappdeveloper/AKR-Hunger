'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trophy, Medal, Star, Bike, Crown, Flame, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const LEADERBOARD_DATA = [
  { rank: 1, name: 'Rajesh K.', deliveries: 312, rating: 4.9, earnings: 24960, badge: 'gold', streak: 15 },
  { rank: 2, name: 'Suresh M.', deliveries: 287, rating: 4.8, earnings: 22960, badge: 'gold', streak: 12 },
  { rank: 3, name: 'Amit S.', deliveries: 265, rating: 4.8, earnings: 21200, badge: 'gold', streak: 10 },
  { rank: 4, name: 'Priya D.', deliveries: 243, rating: 4.7, earnings: 19440, badge: 'silver', streak: 8 },
  { rank: 5, name: 'Vikram P.', deliveries: 231, rating: 4.7, earnings: 18480, badge: 'silver', streak: 7 },
  { rank: 6, name: 'Deepak R.', deliveries: 218, rating: 4.6, earnings: 17440, badge: 'silver', streak: 6 },
  { rank: 7, name: 'Anita K.', deliveries: 205, rating: 4.6, earnings: 16400, badge: 'bronze', streak: 5 },
  { rank: 8, name: 'Ravi T.', deliveries: 198, rating: 4.5, earnings: 15840, badge: 'bronze', streak: 4 },
  { rank: 9, name: 'Meena S.', deliveries: 186, rating: 4.5, earnings: 14880, badge: 'bronze', streak: 3 },
  { rank: 10, name: 'Kiran L.', deliveries: 174, rating: 4.4, earnings: 13920, badge: 'rising_star', streak: 2 },
];

const getBadgeConfig = (badge: string) => {
  switch (badge) {
    case 'gold': return { color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: '🏆 Gold' };
    case 'silver': return { color: 'text-gray-400', bg: 'bg-gray-400/10', border: 'border-gray-400/30', label: '🥈 Silver' };
    case 'bronze': return { color: 'text-orange-600', bg: 'bg-orange-600/10', border: 'border-orange-600/30', label: '🥉 Bronze' };
    default: return { color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30', label: '⭐ Rising Star' };
  }
};

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'alltime'>('monthly');

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
              <Trophy className="w-5 h-5 text-amber-500" />
              Leaderboard
            </h1>
            <p className="text-xs text-muted-foreground">Top delivery partners</p>
          </div>
        </div>

        {/* Period Toggle */}
        <div className="flex gap-2 bg-muted rounded-full p-1">
          {(['weekly', 'monthly', 'alltime'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-2 rounded-full text-sm font-semibold capitalize transition-all ${
                period === p ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p === 'alltime' ? 'All Time' : p}
            </button>
          ))}
        </div>

        {/* Top 3 Podium */}
        <div className="flex items-end justify-center gap-3 py-4">
          {[1, 0, 2].map(idx => {
            const entry = LEADERBOARD_DATA[idx];
            const isFirst = idx === 0;
            return (
              <motion.div
                key={entry.rank}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`text-center ${isFirst ? 'order-2' : idx === 1 ? 'order-1' : 'order-3'}`}
              >
                <div className={`relative mb-2 ${isFirst ? 'w-20 h-20' : 'w-16 h-16'} mx-auto`}>
                  <div className={`w-full h-full rounded-full bg-gradient-to-br ${
                    isFirst ? 'from-amber-400 to-amber-600' : idx === 1 ? 'from-gray-300 to-gray-500' : 'from-orange-400 to-orange-600'
                  } flex items-center justify-center`}>
                    <span className={`font-black text-white ${isFirst ? 'text-2xl' : 'text-xl'}`}>#{entry.rank}</span>
                  </div>
                  {isFirst && <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 text-amber-500" />}
                </div>
                <p className="font-bold text-sm">{entry.name}</p>
                <p className="text-xs text-muted-foreground">{entry.deliveries} deliveries</p>
                <div className={`mt-1 h-${isFirst ? '28' : idx === 1 ? '20' : '16'} bg-gradient-to-t ${
                  isFirst ? 'from-amber-500/20 to-transparent' : idx === 1 ? 'from-gray-500/20 to-transparent' : 'from-orange-500/20 to-transparent'
                } rounded-t-xl w-24 mx-auto`} style={{ height: isFirst ? '7rem' : idx === 1 ? '5rem' : '4rem' }} />
              </motion.div>
            );
          })}
        </div>

        {/* Full Leaderboard */}
        <div className="space-y-2">
          {LEADERBOARD_DATA.map((entry, i) => {
            const badgeConfig = getBadgeConfig(entry.badge);
            return (
              <motion.div
                key={entry.rank}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className={`p-4 flex items-center gap-4 transition-all hover:shadow-md ${
                  entry.rank <= 3 ? 'border-primary/30 bg-primary/5' : ''
                }`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${
                    entry.rank === 1 ? 'bg-amber-500 text-white' :
                    entry.rank === 2 ? 'bg-gray-400 text-white' :
                    entry.rank === 3 ? 'bg-orange-500 text-white' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    #{entry.rank}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm">{entry.name}</p>
                      <Badge className={`text-[10px] ${badgeConfig.bg} ${badgeConfig.color} ${badgeConfig.border}`}>
                        {badgeConfig.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-0.5"><Bike className="w-3 h-3" /> {entry.deliveries}</span>
                      <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-amber-500" /> {entry.rating}</span>
                      <span className="flex items-center gap-0.5"><Flame className="w-3 h-3 text-orange-500" /> {entry.streak} day streak</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-primary">₹{entry.earnings.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">earned</p>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
