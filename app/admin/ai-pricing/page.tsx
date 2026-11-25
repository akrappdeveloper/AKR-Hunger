'use client';

import React, { useState } from 'react';
import {
  TrendingUp,
  Brain,
  Zap,
  MapPin,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  CloudRain,
  Flame,
  BarChart3,
  Sliders,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface ZoneForecast {
  id: string;
  name: string;
  currentDemand: 'Low' | 'Moderate' | 'High' | 'Surge Critical';
  predictedOrdersNextHour: number;
  riderSupplyRatio: number; // e.g. 0.8 means 80% riders available
  suggestedMultiplier: number;
  riderBonusPerTrip: number;
}

const INITIAL_ZONES: ZoneForecast[] = [
  {
    id: 'zone-tech',
    name: 'Tech Corridor & IT Parks',
    currentDemand: 'Surge Critical',
    predictedOrdersNextHour: 680,
    riderSupplyRatio: 0.65,
    suggestedMultiplier: 1.6,
    riderBonusPerTrip: 45,
  },
  {
    id: 'zone-univ',
    name: 'University & Campus Hub',
    currentDemand: 'High',
    predictedOrdersNextHour: 430,
    riderSupplyRatio: 0.78,
    suggestedMultiplier: 1.3,
    riderBonusPerTrip: 25,
  },
  {
    id: 'zone-downtown',
    name: 'Central Commercial Downtown',
    currentDemand: 'High',
    predictedOrdersNextHour: 520,
    riderSupplyRatio: 0.82,
    suggestedMultiplier: 1.25,
    riderBonusPerTrip: 20,
  },
  {
    id: 'zone-suburb-north',
    name: 'North Residential Suburbs',
    currentDemand: 'Moderate',
    predictedOrdersNextHour: 240,
    riderSupplyRatio: 1.05,
    suggestedMultiplier: 1.0,
    riderBonusPerTrip: 0,
  },
  {
    id: 'zone-suburb-south',
    name: 'South Lake Residences',
    currentDemand: 'Moderate',
    predictedOrdersNextHour: 195,
    riderSupplyRatio: 1.15,
    suggestedMultiplier: 1.0,
    riderBonusPerTrip: 0,
  },
];

export default function AIPricingDemandPage() {
  const [zones, setZones] = useState<ZoneForecast[]>(INITIAL_ZONES);
  const [autoPricingEnabled, setAutoPricingEnabled] = useState(true);
  const [weatherAlert, setWeatherAlert] = useState<'normal' | 'rain' | 'storm'>('rain');
  const [globalAggressiveness, setGlobalAggressiveness] = useState([70]); // 0 to 100%

  const handleApplyPricing = (zoneId: string, newMultiplier: number) => {
    setZones(prev =>
      prev.map(z => (z.id === zoneId ? { ...z, suggestedMultiplier: newMultiplier } : z))
    );
    toast.success(`Dynamic multiplier updated for zone`);
  };

  const handleDeployGlobal = () => {
    toast.success('🚀 AI Dynamic Pricing & Rider Supply Incentives deployed live across all zones!');
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold gap-1">
              <Brain className="w-3.5 h-3.5" /> AI Revenue Engine
            </Badge>
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
              Live Forecasting
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            AI Demand &amp; Dynamic Pricing
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Machine learning forecast models balancing consumer demand, weather events, and rider fleet distribution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => toast.info('Re-running ML forecast pipelines... Updated!')}
            variant="outline"
            className="rounded-xl font-bold gap-2 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh ML Feeds
          </Button>
          <Button
            onClick={handleDeployGlobal}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold gap-2 text-xs shadow-md shadow-primary/20"
          >
            <Zap className="w-4 h-4" /> Deploy Pricing Model
          </Button>
        </div>
      </div>

      {/* AI Overview Metric Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border/80 bg-card">
          <CardContent className="p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Next-Hour Predicted Demand</span>
              <BarChart3 className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-foreground">2,065 orders</p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +18.4% vs last week
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-card">
          <CardContent className="p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Fleet Supply Deficit</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-amber-500">-112 Riders</p>
            <p className="text-[11px] text-muted-foreground">
              Tech Corridor &amp; University demand spike
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-card">
          <CardContent className="p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Weather Impact Factor</span>
              <CloudRain className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl sm:text-3xl font-black text-foreground">Rain Alert</p>
            </div>
            <p className="text-[11px] text-blue-500 font-medium">+35% diner ordering propensity</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-card">
          <CardContent className="p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">Estimated Incremental GMV</span>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">+₹84,200</p>
            <p className="text-[11px] text-muted-foreground">Surge margin &amp; fleet protection</p>
          </CardContent>
        </Card>
      </div>

      {/* Global AI Automation Controls */}
      <Card className="rounded-2xl border-border/80 bg-card p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-base text-foreground">Autonomous Dynamic Pricing Mode</h3>
            </div>
            <p className="text-xs text-muted-foreground max-w-xl">
              When enabled, algorithms automatically balance consumer delivery fee multipliers and rider dispatch payouts every 5 minutes based on live queue depth.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-foreground">
                {autoPricingEnabled ? 'Autonomous Active' : 'Manual Override'}
              </span>
              <Switch checked={autoPricingEnabled} onCheckedChange={setAutoPricingEnabled} />
            </div>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-border/60 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-foreground">Algorithm Sensitivity</span>
              <span className="font-bold text-primary">{globalAggressiveness[0]}% Aggressive</span>
            </div>
            <Slider
              value={globalAggressiveness}
              onValueChange={setGlobalAggressiveness}
              max={100}
              min={10}
              step={5}
              className="py-1"
            />
            <p className="text-[11px] text-muted-foreground">
              Higher sensitivity protects rider fulfillment by prioritizing surge during sudden rain or match endings.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Simulate Weather Condition</label>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={weatherAlert === 'normal' ? 'default' : 'outline'}
                onClick={() => setWeatherAlert('normal')}
                className="text-xs rounded-xl flex-1"
              >
                Clear Sky (1.0x)
              </Button>
              <Button
                size="sm"
                variant={weatherAlert === 'rain' ? 'default' : 'outline'}
                onClick={() => setWeatherAlert('rain')}
                className="text-xs rounded-xl flex-1"
              >
                Moderate Rain (1.35x)
              </Button>
              <Button
                size="sm"
                variant={weatherAlert === 'storm' ? 'default' : 'outline'}
                onClick={() => setWeatherAlert('storm')}
                className="text-xs rounded-xl flex-1"
              >
                Heavy Monsoon (1.8x)
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Zone-by-Zone Live ML Forecast Table */}
      <Card className="rounded-2xl border-border/80 bg-card overflow-hidden shadow-sm">
        <CardHeader className="bg-muted/20 border-b border-border/60 pb-4">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <MapPin className="w-4 h-4 text-primary" />
            Live Zone-by-Zone Forecast &amp; Tariff Multipliers
          </CardTitle>
          <CardDescription className="text-xs">
            Review and adjust dynamic multipliers per operating delivery territory.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border/60">
                <tr>
                  <th className="py-3 px-4">Territory Zone</th>
                  <th className="py-3 px-4">Demand Index</th>
                  <th className="py-3 px-4">Forecast (Next 60m)</th>
                  <th className="py-3 px-4">Fleet Availability</th>
                  <th className="py-3 px-4">Dynamic Tariff</th>
                  <th className="py-3 px-4">Rider Payout Bonus</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {zones.map(z => {
                  const isSurge = z.suggestedMultiplier > 1.0;
                  return (
                    <tr key={z.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-foreground">
                        {z.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          className={`text-[10px] font-bold ${
                            z.currentDemand === 'Surge Critical'
                              ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20'
                              : z.currentDemand === 'High'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          {z.currentDemand === 'Surge Critical' && <Flame className="w-3 h-3 mr-1 inline" />}
                          {z.currentDemand}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        {z.predictedOrdersNextHour} orders
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-semibold ${
                            z.riderSupplyRatio < 0.75
                              ? 'text-red-500'
                              : z.riderSupplyRatio < 0.9
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                          }`}
                        >
                          {Math.round(z.riderSupplyRatio * 100)}% Coverage
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-black">
                        <span
                          className={`px-2 py-0.5 rounded-md ${
                            isSurge ? 'bg-primary/15 text-primary' : 'bg-muted text-foreground'
                          }`}
                        >
                          {z.suggestedMultiplier.toFixed(2)}x
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        {z.riderBonusPerTrip > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            +₹{z.riderBonusPerTrip}/trip
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Standard</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApplyPricing(z.id, z.suggestedMultiplier)}
                          className="h-8 rounded-lg text-[11px] font-semibold"
                        >
                          Lock Tariff
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
