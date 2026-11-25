'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/admin/ProtectedRoute';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Zap, CloudRain, Clock, Moon, Flame, AlertTriangle, ShieldAlert, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSurgePage() {
  const [globalSurgeActive, setGlobalSurgeActive] = useState(false);
  const [rainMode, setRainMode] = useState(false);
  const [rainMultiplier, setRainMultiplier] = useState(1.25);

  const [dinnerPeak, setDinnerPeak] = useState(true);
  const [dinnerMultiplier, setDinnerMultiplier] = useState(1.15);

  const [midnightSurge, setMidnightSurge] = useState(false);
  const [midnightMultiplier, setMidnightMultiplier] = useState(1.30);

  const [highDemandMultiplier, setHighDemandMultiplier] = useState(1.20);

  const handleSave = () => {
    toast.success('Surge pricing parameters updated across all zones! ⚡');
  };

  return (
    <ProtectedRoute allowedRoles={['super_admin', 'operations_admin']}>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500 fill-amber-500" />
            Dynamic Surge &amp; Peak Hours Control
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Configure dynamic delivery fare multipliers for severe weather, peak meal hours, and high-demand events.
          </p>
        </div>

        {/* Global Master Switch */}
        <Card className={`p-6 border-2 transition-all ${
          globalSurgeActive
            ? 'border-amber-500 bg-amber-500/5'
            : 'border-border'
        }`}>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-black text-base text-foreground">Global Master Surge Switch</span>
                <Badge variant={globalSurgeActive ? 'default' : 'outline'} className={globalSurgeActive ? 'bg-amber-500 text-black font-bold' : ''}>
                  {globalSurgeActive ? 'Active in All Zones' : 'Standard Rates'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                When enabled, active condition multipliers below will dynamically apply to delivery fees.
              </p>
            </div>
            <Switch
              checked={globalSurgeActive}
              onCheckedChange={setGlobalSurgeActive}
            />
          </div>
        </Card>

        {/* Condition Multipliers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Rain Mode Surge */}
          <Card className="p-5 space-y-4 border-border/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <CloudRain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Monsoon / Heavy Rain Surge</h3>
                  <p className="text-[11px] text-muted-foreground">Protects delivery partner compensation</p>
                </div>
              </div>
              <Switch checked={rainMode} onCheckedChange={setRainMode} />
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-muted-foreground">Fee Multiplier:</span>
                <span className="text-blue-500 font-mono text-sm">{rainMultiplier.toFixed(2)}x</span>
              </div>
              <Slider
                value={[rainMultiplier]}
                min={1.0}
                max={2.0}
                step={0.05}
                onValueChange={([v]) => setRainMultiplier(v)}
                disabled={!rainMode}
              />
            </div>
          </Card>

          {/* Dinner Peak Hours */}
          <Card className="p-5 space-y-4 border-border/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Dinner Rush (7:30 - 10:30 PM)</h3>
                  <p className="text-[11px] text-muted-foreground">Automatic peak window multiplier</p>
                </div>
              </div>
              <Switch checked={dinnerPeak} onCheckedChange={setDinnerPeak} />
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-muted-foreground">Fee Multiplier:</span>
                <span className="text-orange-500 font-mono text-sm">{dinnerMultiplier.toFixed(2)}x</span>
              </div>
              <Slider
                value={[dinnerMultiplier]}
                min={1.0}
                max={1.8}
                step={0.05}
                onValueChange={([v]) => setDinnerMultiplier(v)}
                disabled={!dinnerPeak}
              />
            </div>
          </Card>

          {/* Late Night Surge */}
          <Card className="p-5 space-y-4 border-border/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Midnight Hours (11:00 PM - 4:00 AM)</h3>
                  <p className="text-[11px] text-muted-foreground">Incentivizes late-night rider availability</p>
                </div>
              </div>
              <Switch checked={midnightSurge} onCheckedChange={setMidnightSurge} />
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-muted-foreground">Fee Multiplier:</span>
                <span className="text-purple-500 font-mono text-sm">{midnightMultiplier.toFixed(2)}x</span>
              </div>
              <Slider
                value={[midnightMultiplier]}
                min={1.0}
                max={2.5}
                step={0.05}
                onValueChange={([v]) => setMidnightMultiplier(v)}
                disabled={!midnightSurge}
              />
            </div>
          </Card>

          {/* High Demand Auto Multiplier */}
          <Card className="p-5 space-y-4 border-border/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Driver Scarcity Buffer</h3>
                  <p className="text-[11px] text-muted-foreground">When available drivers in zone &lt; 20%</p>
                </div>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-[10px]">Auto</Badge>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-muted-foreground">Fee Multiplier:</span>
                <span className="text-emerald-500 font-mono text-sm">{highDemandMultiplier.toFixed(2)}x</span>
              </div>
              <Slider
                value={[highDemandMultiplier]}
                min={1.0}
                max={1.6}
                step={0.05}
                onValueChange={([v]) => setHighDemandMultiplier(v)}
              />
            </div>
          </Card>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} className="bg-primary text-primary-foreground font-bold rounded-xl px-6 gap-2">
            <Check className="w-4 h-4" /> Save Surge Settings
          </Button>
        </div>
      </div>
    </ProtectedRoute>
  );
}
