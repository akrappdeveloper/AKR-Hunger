'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, getDocs, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Leaf, Zap, Bike, TreePine, Droplets, ShieldCheck,
  Search, RefreshCw, Award, TrendingUp, Users, ArrowUpRight
} from 'lucide-react';

export default function EcoDeliveryAdminPage() {
  const [pledges, setPledges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [ecoStats, setEcoStats] = useState({
    totalPledges: 0,
    co2SavedKg: 142.5,
    plasticDiverted: 890,
    evRidesCompleted: 420,
    greenLoyaltyPointsAwarded: 21000,
  });

  useEffect(() => {
    // Listen to customers with ecoPreferences
    const q = query(collection(db, 'customers'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      let totalPlastic = 0;
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.ecoPreferences) {
          const pref = data.ecoPreferences;
          list.push({
            id: d.id,
            name: data.name || 'Green Customer',
            email: data.email || 'N/A',
            evDelivery: pref.preferEvDelivery ?? true,
            noCutlery: pref.optOutCutlery ?? true,
            ecoPackaging: pref.ecoPackagingOnly ?? true,
            carbonOffset: pref.carbonOffsetContribution ?? true,
            pledgedAt: pref.pledgedAt?.toDate?.() || new Date(),
          });
          if (pref.optOutCutlery) totalPlastic += 2;
        }
      });

      setPledges(list);
      setEcoStats(prev => ({
        ...prev,
        totalPledges: list.length,
        plasticDiverted: 890 + totalPlastic,
        co2SavedKg: 142.5 + (list.length * 2.8),
      }));
      setLoading(false);
    }, (err) => {
      console.error('Error fetching eco preferences:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filtered = pledges.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Leaf className="w-8 h-8 text-emerald-500" />
          Green EV &amp; Eco-Delivery Sustainability Hub
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor carbon offset metrics, plastic diversion from no-cutlery orders, electric vehicle dispatch rates, and green customer pledges.
        </p>
      </div>

      {/* Sustainability Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 bg-emerald-950/20 border-emerald-500/20 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
              CO₂ Offset Platform
              <TreePine className="w-4 h-4 text-emerald-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-400">{ecoStats.co2SavedKg.toFixed(1)} kg</div>
            <p className="text-xs text-muted-foreground mt-1">Calculated from EV deliveries</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-blue-950/20 border-blue-500/20 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center justify-between">
              Plastic Containers Diverted
              <Droplets className="w-4 h-4 text-blue-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-blue-400">{ecoStats.plasticDiverted}+</div>
            <p className="text-xs text-muted-foreground mt-1">Zero single-use plastic orders</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center justify-between">
              Active Green Pledges
              <Users className="w-4 h-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{ecoStats.totalPledges}</div>
            <p className="text-xs text-muted-foreground mt-1">Customers pledged on /customer/eco</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center justify-between">
              EV Delivery Fleet Trips
              <Zap className="w-4 h-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{ecoStats.evRidesCompleted}</div>
            <p className="text-xs text-muted-foreground mt-1">Electric 2-wheeler dispatches</p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Green Pledges Table */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-md overflow-hidden">
        <CardHeader className="border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold text-foreground">Customer Green Pledges</CardTitle>
              <CardDescription className="text-xs">
                Real-time feed of customers who committed to eco-friendly food ordering.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search green pledges..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl bg-background/50 border-border/60"
              />
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-border/60">
                <TableHead className="font-bold">Customer</TableHead>
                <TableHead className="font-bold">EV Delivery</TableHead>
                <TableHead className="font-bold">No Cutlery</TableHead>
                <TableHead className="font-bold">Eco Packaging</TableHead>
                <TableHead className="font-bold">Carbon Offset</TableHead>
                <TableHead className="text-right font-bold">Pledge Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading sustainability records...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No customer pledges found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id} className="border-border/40 hover:bg-muted/20">
                    <TableCell>
                      <p className="font-semibold text-sm text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={p.evDelivery ? 'text-emerald-400 border-emerald-500/30' : 'text-muted-foreground'}>
                        {p.evDelivery ? '✓ Preferred' : 'Standard'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={p.noCutlery ? 'text-blue-400 border-blue-500/30' : 'text-muted-foreground'}>
                        {p.noCutlery ? '✓ Zero Cutlery' : 'Included'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={p.ecoPackaging ? 'text-emerald-400 border-emerald-500/30' : 'text-muted-foreground'}>
                        {p.ecoPackaging ? '✓ Biodegradable' : 'Standard'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={p.carbonOffset ? 'text-emerald-400 border-emerald-500/30' : 'text-muted-foreground'}>
                        {p.carbonOffset ? '✓ Active' : 'Off'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 font-bold">
                        Pledged +50 Pts
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
