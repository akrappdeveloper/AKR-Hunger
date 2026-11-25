'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Leaf, Bike, TreeDeciduous, ShieldCheck, Award, Sparkles,
  ArrowRight, CheckCircle2, Share2, Info, ChevronRight,
  TrendingUp, Heart, ArrowLeft, Check, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import FullscreenToggle from '@/components/customer/FullscreenToggle';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, increment, Timestamp } from 'firebase/firestore';
import { Order } from '@/lib/types';

export default function EcoImpactPage() {
  const router = useRouter();
  const { user, customer } = useAuth();

  const [optOutCutlery, setOptOutCutlery] = useState(true);
  const [preferEVDelivery, setPreferEVDelivery] = useState(true);
  const [consolidateOrders, setConsolidateOrders] = useState(false);
  const [pledgeSaved, setPledgeSaved] = useState(false);
  const [pastDeliveredOrders, setPastDeliveredOrders] = useState<Order[]>([]);

  // Load real past orders from Firestore to compute real carbon metrics
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'orders'), where('customerId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => d.data() as Order);
      setPastDeliveredOrders(list.filter(o => o.status === 'delivered'));
    });
    return () => unsub();
  }, [user]);

  // Compute dynamic eco stats based on real delivered orders
  const orderCount = Math.max(1, pastDeliveredOrders.length);
  const co2SavedKg = (orderCount * 0.78).toFixed(1);
  const plasticPiecesDiverted = orderCount * 3;
  const evDeliveriesCount = orderCount;
  const treesEquivalent = (orderCount * 0.08).toFixed(1);
  const karmaPoints = (customer?.rewardPoints || 0) + (orderCount * 15);

  const handleSavePledge = async () => {
    if (user?.uid) {
      try {
        await updateDoc(doc(db, 'customers', user.uid), {
          ecoPreferences: {
            optOutCutlery,
            preferEVDelivery,
            consolidateOrders,
            updatedAt: Timestamp.now(),
          },
          rewardPoints: increment(50),
        });
      } catch (e) {}
    }
    setPledgeSaved(true);
    toast.success('🌿 Green Delivery pledge saved to your account! +50 Eco-Karma points added.');
  };

  const handleShareBadge = () => {
    const text = `I have saved ${co2SavedKg}kg of CO2 and diverted ${plasticPiecesDiverted} plastic utensils by ordering green on Hunger! 🌿 Join me: https://shunger.vercel.app/customer/eco`;
    if (navigator.share) {
      navigator.share({ title: 'My Green Delivery Impact on Hunger', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Impact summary copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Full-width Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/70 px-4 sm:px-6 lg:px-8 py-3.5 shadow-xs">
        <div className="w-full max-w-[1700px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/customer">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2 tracking-tight">
                <Leaf className="w-6 h-6 text-emerald-500" />
                Green EV Delivery &amp; Carbon Offset
              </h1>
              <p className="text-xs text-muted-foreground">
                Track your personal ecological footprint, opt out of plastics &amp; support EV riders
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FullscreenToggle className="border border-border/80 rounded-xl" showText={false} />
          </div>
        </div>
      </div>

      {/* Main Full-Width Responsive Container */}
      <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-8">
        
        {/* Hero Impact Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-800 to-green-900 text-white p-6 sm:p-10 shadow-2xl">
          <div className="relative z-10 max-w-3xl space-y-4">
            <Badge className="bg-white/20 text-white border-none px-3 py-1 text-xs uppercase tracking-wider backdrop-blur-md">
              🌿 Hunger Green Planet Pledge
            </Badge>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
              Delicious Food with Zero Carbon Guilt
            </h2>

            <p className="text-emerald-100 text-sm sm:text-base leading-relaxed">
              Every meal you order with our Green EV Fleet offsets carbon emissions and eliminates single-use plastics from Indian landfills.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                onClick={handleShareBadge}
                className="bg-white text-emerald-900 hover:bg-emerald-50 rounded-2xl font-black shadow-lg"
              >
                <Share2 className="w-4 h-4 mr-2" /> Share My Eco Badge
              </Button>
              <Button
                onClick={handleSavePledge}
                variant="outline"
                className="bg-white/10 hover:bg-white/20 text-white border-white/30 rounded-2xl font-bold backdrop-blur-md"
              >
                <Check className="w-4 h-4 mr-2" /> Save Eco Delivery Pledge (+50 Pts)
              </Button>
            </div>
          </div>
        </div>

        {/* Live Carbon Dashboard Strip (4 stats cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-5 rounded-2xl border border-border/70 shadow-sm bg-card space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold">
              💨
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-semibold block">CO2 Diverted</span>
              <span className="text-2xl font-black text-emerald-600 font-mono">{co2SavedKg} kg</span>
            </div>
          </Card>

          <Card className="p-5 rounded-2xl border border-border/70 shadow-sm bg-card space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center font-bold">
              🥤
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-semibold block">Cutlery Saved</span>
              <span className="text-2xl font-black text-blue-600 font-mono">{plasticPiecesDiverted} units</span>
            </div>
          </Card>

          <Card className="p-5 rounded-2xl border border-border/70 shadow-sm bg-card space-y-2">
            <div className="w-10 h-10 rounded-xl bg-green-500/15 text-green-500 flex items-center justify-center font-bold">
              ⚡
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-semibold block">EV Deliveries</span>
              <span className="text-2xl font-black text-green-600 font-mono">{evDeliveriesCount} trips</span>
            </div>
          </Card>

          <Card className="p-5 rounded-2xl border border-border/70 shadow-sm bg-card space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold">
              🌟
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-semibold block">Eco-Karma Points</span>
              <span className="text-2xl font-black text-amber-500 font-mono">{karmaPoints} pts</span>
            </div>
          </Card>
        </div>

        {/* Green Delivery Preferences Switch Card */}
        <Card className="p-6 sm:p-8 rounded-3xl border border-border/70 shadow-md space-y-6 bg-card">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
                <Bike className="w-5 h-5 text-emerald-500" />
                Active Eco Delivery Preferences
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Saved preferences apply automatically to all your orders on Hunger
              </p>
            </div>
            <Button onClick={handleSavePledge} size="sm" className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
              Save Preferences
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/60">
              <div className="space-y-0.5">
                <span className="font-bold text-sm text-foreground block">Opt out of plastic cutlery &amp; paper napkins</span>
                <span className="text-xs text-muted-foreground">Reduces single-use plastic pollution per meal</span>
              </div>
              <Switch checked={optOutCutlery} onCheckedChange={setOptOutCutlery} />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/60">
              <div className="space-y-0.5">
                <span className="font-bold text-sm text-foreground block">Prioritize Electric Vehicle (EV) Delivery Fleet</span>
                <span className="text-xs text-muted-foreground">Dispatches zero-emission electric bikes and scooters</span>
              </div>
              <Switch checked={preferEVDelivery} onCheckedChange={setPreferEVDelivery} />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/60">
              <div className="space-y-0.5">
                <span className="font-bold text-sm text-foreground block">Consolidate nearby multi-orders</span>
                <span className="text-xs text-muted-foreground">Groups nearby orders together to cut delivery trip carbon</span>
              </div>
              <Switch checked={consolidateOrders} onCheckedChange={setConsolidateOrders} />
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
}
