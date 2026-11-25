'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Flame, MapPin, Zap, TrendingUp, Navigation, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface Hotspot {
  id: string;
  area: string;
  restaurantCount: number;
  orderDemand: 'VERY_HIGH' | 'HIGH' | 'MODERATE';
  surgeBonus: number;
  averageWaitMinutes: number;
  distanceKm: number;
}

const SAMPLE_HOTSPOTS: Hotspot[] = [
  { id: '1', area: 'Central Market & Food Plaza', restaurantCount: 28, orderDemand: 'VERY_HIGH', surgeBonus: 25, averageWaitMinutes: 4, distanceKm: 1.2 },
  { id: '2', area: 'Tech Park IT Hub & Cafes', restaurantCount: 19, orderDemand: 'HIGH', surgeBonus: 20, averageWaitMinutes: 6, distanceKm: 2.8 },
  { id: '3', area: 'University Campus Food Street', restaurantCount: 22, orderDemand: 'HIGH', surgeBonus: 15, averageWaitMinutes: 7, distanceKm: 3.5 },
  { id: '4', area: 'South Extension Dining District', restaurantCount: 15, orderDemand: 'MODERATE', surgeBonus: 10, averageWaitMinutes: 9, distanceKm: 4.1 },
];

export default function DeliveryHotspotsPage() {
  const handleNavigate = (area: string) => {
    toast.success(`GPS route loaded for ${area}! 🗺️`);
  };

  return (
    <div className="space-y-6 max-w-4xl p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Flame className="w-6 h-6 text-orange-500 fill-orange-500" />
          High Demand Hotspots
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
          Position yourself near these high-density food zones to receive back-to-back delivery orders and surge bonuses.
        </p>
      </div>

      {/* Surge Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-transparent border border-orange-500/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-black text-xl">
            ⚡
          </div>
          <div>
            <p className="font-bold text-sm text-white">Active Surge Zones: Earn up to +₹25 extra / order</p>
            <p className="text-xs text-gray-400">Surge payouts credited instantly to your partner wallet upon delivery completion.</p>
          </div>
        </div>
      </div>

      {/* Hotspots List */}
      <div className="space-y-3">
        {SAMPLE_HOTSPOTS.map(spot => (
          <Card key={spot.id} className="p-4 bg-zinc-900 border-zinc-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-white">{spot.area}</span>
                <Badge className={
                  spot.orderDemand === 'VERY_HIGH'
                    ? 'bg-red-500/20 text-red-400 border-red-500/30 font-bold'
                    : 'bg-orange-500/20 text-orange-400 border-orange-500/30 font-bold'
                }>
                  🔥 {spot.orderDemand.replace('_', ' ')} DEMAND
                </Badge>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-400 pt-0.5">
                <span>{spot.restaurantCount} Active Kitchens</span>
                <span>•</span>
                <span>~{spot.averageWaitMinutes} min dispatch wait</span>
                <span>•</span>
                <span>{spot.distanceKm} km away</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs text-gray-400">Bonus</span>
                <p className="font-black text-base text-emerald-400">+₹{spot.surgeBonus}</p>
              </div>

              <Button
                onClick={() => handleNavigate(spot.area)}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-1 text-xs font-bold"
              >
                <Navigation className="w-3.5 h-3.5" /> Head Here
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
