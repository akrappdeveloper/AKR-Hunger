'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, Timestamp, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  CalendarDays, Utensils, Clock, CheckCircle2, Search,
  Users, RefreshCw, ChefHat, Sun, Moon, Coffee, ArrowUpRight
} from 'lucide-react';

interface MealPlanSubscription {
  id: string;
  customerId: string;
  customerName: string;
  phone?: string;
  planType: '5_day' | '7_day' | 'custom';
  dietPreference: 'pure_veg' | 'non_veg' | 'fitness_keto';
  slots: {
    breakfast: boolean;
    lunch: boolean;
    dinner: boolean;
  };
  startDate: any;
  status: 'active' | 'paused' | 'completed';
  dailyTotal: number;
}

export default function MealPlansAdminPage() {
  const [plans, setPlans] = useState<MealPlanSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Listen to customers with meal plans
    const q = query(collection(db, 'customers'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: MealPlanSubscription[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.mealPlans) {
          const mp = data.mealPlans;
          list.push({
            id: d.id,
            customerId: d.id,
            customerName: data.name || 'Subscriber',
            phone: data.phone || '',
            planType: mp.planType || '7_day',
            dietPreference: mp.dietPreference || 'pure_veg',
            slots: mp.slots || { breakfast: true, lunch: true, dinner: true },
            startDate: mp.startDate?.toDate?.() || new Date(),
            status: mp.status || 'active',
            dailyTotal: mp.dailyTotal || 249,
          });
        }
      });

      // Sample data if none in database yet
      if (list.length === 0) {
        list.push(
          {
            id: 'MP-901',
            customerId: 'CUST-104',
            customerName: 'Aarav Mehta',
            phone: '+91 98765 43210',
            planType: '7_day',
            dietPreference: 'pure_veg',
            slots: { breakfast: true, lunch: true, dinner: true },
            startDate: new Date(),
            status: 'active',
            dailyTotal: 299,
          },
          {
            id: 'MP-902',
            customerId: 'CUST-108',
            customerName: 'Priya Sharma',
            phone: '+91 98123 45678',
            planType: '5_day',
            dietPreference: 'fitness_keto',
            slots: { breakfast: false, lunch: true, dinner: true },
            startDate: new Date(),
            status: 'active',
            dailyTotal: 220,
          }
        );
      }

      setPlans(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching meal plans:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filtered = plans.filter(p =>
    p.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <CalendarDays className="w-8 h-8 text-primary" />
          Weekly Tiffin &amp; Meal Planner Subscriptions
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage weekly meal subscriptions created via /customer/meal-planner. Monitor daily breakfast, lunch, and dinner kitchen prep schedules.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              Active Subscribers
              <Users className="w-4 h-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{plans.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Weekly subscribers</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center justify-between">
              Breakfast Prep
              <Coffee className="w-4 h-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-500">
              {plans.filter(p => p.slots.breakfast).length} meals
            </div>
            <p className="text-xs text-muted-foreground mt-1">Morning dispatch: 8:00 AM</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-orange-500 flex items-center justify-between">
              Lunch Prep
              <Sun className="w-4 h-4 text-orange-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-orange-500">
              {plans.filter(p => p.slots.lunch).length} meals
            </div>
            <p className="text-xs text-muted-foreground mt-1">Noon dispatch: 12:30 PM</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-purple-500 flex items-center justify-between">
              Dinner Prep
              <Moon className="w-4 h-4 text-purple-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-purple-500">
              {plans.filter(p => p.slots.dinner).length} meals
            </div>
            <p className="text-xs text-muted-foreground mt-1">Evening dispatch: 7:30 PM</p>
          </CardContent>
        </Card>
      </div>

      {/* Plans Table */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-md overflow-hidden">
        <CardHeader className="border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold text-foreground">Subscriptions</CardTitle>
              <CardDescription className="text-xs">
                Subscribed tiffin plans and daily fulfillment routes.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search subscriber..."
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
                <TableHead className="font-bold">Subscriber</TableHead>
                <TableHead className="font-bold">Plan</TableHead>
                <TableHead className="font-bold">Diet</TableHead>
                <TableHead className="font-bold">Active Slots</TableHead>
                <TableHead className="font-bold">Daily Value</TableHead>
                <TableHead className="text-right font-bold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading meal plan subscriptions...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No subscriptions found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id} className="border-border/40 hover:bg-muted/20">
                    <TableCell>
                      <p className="font-semibold text-sm text-foreground">{p.customerName}</p>
                      <p className="text-xs text-muted-foreground">{p.phone || p.id}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-medium text-xs">
                        {p.planType === '7_day' ? '7-Day Full Week' : '5-Day Work Week'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold capitalize text-foreground">
                        {p.dietPreference.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        {p.slots.breakfast && <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30 text-[10px]">B'fast</Badge>}
                        {p.slots.lunch && <Badge className="bg-orange-500/15 text-orange-500 border-orange-500/30 text-[10px]">Lunch</Badge>}
                        {p.slots.dinner && <Badge className="bg-purple-500/15 text-purple-500 border-purple-500/30 text-[10px]">Dinner</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-foreground">
                      ₹{p.dailyTotal}/day
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 gap-1 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Active
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
