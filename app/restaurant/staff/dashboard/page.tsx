'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { motion } from 'framer-motion';
import {
  ChefHat, Shield, Users, UserCheck, ShoppingBag, Package,
  Calendar, Star, Wallet, BarChart3, Settings, HelpCircle,
  MapPin, Clock, CheckCircle2, AlertCircle, ArrowUpRight,
  LogOut, Sparkles, Utensils, Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const ROLE_INFO: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  manager: { label: 'Store Manager', icon: Shield, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  chef: { label: 'Head Chef', icon: ChefHat, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  cashier: { label: 'Cashier / Counter', icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  helper: { label: 'Kitchen Crew', icon: UserCheck, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
};

export default function StaffDashboardPage() {
  const router = useRouter();
  const { user, restaurant, isStaff, staffRole, permissions, hasPermission, logout, loading } = useRestaurantAuth();
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!restaurant?.id) return;
    const ordersQ = query(
      collection(db, 'orders'),
      where('restaurantId', '==', restaurant.id),
      where('status', 'in', ['confirmed', 'preparing', 'ready', 'out_for_delivery'])
    );
    const unsub = onSnapshot(ordersQ, (snap) => {
      setActiveOrdersCount(snap.docs.length);
    }, (err) => {
      console.warn('[Staff Dashboard] Order listener notice:', err);
    });
    return () => unsub();
  }, [restaurant?.id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  const roleMeta = ROLE_INFO[staffRole || 'helper'] || ROLE_INFO.helper;
  const RoleIcon = roleMeta.icon;

  const modules = [
    {
      id: 'orders',
      title: 'Kitchen & Live Orders',
      desc: 'Process incoming customer food orders in real-time',
      icon: ShoppingBag,
      href: '/restaurant/orders',
      badge: activeOrdersCount > 0 ? `${activeOrdersCount} Active` : '0 Active',
      badgeColor: activeOrdersCount > 0 ? 'bg-amber-500 text-white animate-pulse' : 'bg-muted text-muted-foreground',
      color: 'from-amber-500 to-orange-600',
    },
    {
      id: 'orders_tracking',
      permission: 'orders',
      title: 'Live Rider Tracking',
      desc: 'Track delivery partners picking up orders',
      icon: MapPin,
      href: '/restaurant/orders/tracking',
      color: 'from-blue-500 to-cyan-600',
    },
    {
      id: 'menu',
      title: 'Menu & Food Stock',
      desc: 'View dishes, pricing, and toggle item availability',
      icon: Package,
      href: '/restaurant/menu',
      color: 'from-emerald-500 to-teal-600',
    },
    {
      id: 'schedule',
      title: 'Operating Hours & Breaks',
      desc: 'Check restaurant schedule, breaks, and live status',
      icon: Calendar,
      href: '/restaurant/schedule',
      color: 'from-purple-500 to-indigo-600',
    },
    {
      id: 'quality',
      title: 'Food Quality & Prep Time',
      desc: 'Track preparation efficiency and dish metrics',
      icon: BarChart3,
      href: '/restaurant/quality',
      color: 'from-rose-500 to-pink-600',
    },
    {
      id: 'reviews',
      title: 'Customer Feedback & Ratings',
      desc: 'Read customer reviews and dish ratings',
      icon: Star,
      href: '/restaurant/reviews',
      color: 'from-yellow-500 to-amber-600',
    },
    {
      id: 'wallet',
      title: 'Payments & Settlement',
      desc: 'Daily register collections and payouts',
      icon: Wallet,
      href: '/restaurant/wallet',
      color: 'from-green-500 to-emerald-600',
    },
    {
      id: 'analytics',
      title: 'Kitchen Analytics',
      desc: 'Sales performance and peak hour charts',
      icon: BarChart3,
      href: '/restaurant/analytics',
      color: 'from-indigo-500 to-violet-600',
    },
    {
      id: 'staff',
      title: 'Staff Directory',
      desc: 'View team members and kitchen roster',
      icon: Users,
      href: '/restaurant/staff',
      color: 'from-fuchsia-500 to-pink-600',
    },
    {
      id: 'settings',
      title: 'Restaurant Settings',
      desc: 'Store profile, kitchen preferences and alerts',
      icon: Settings,
      href: '/restaurant/settings',
      color: 'from-slate-600 to-zinc-700',
    },
  ];

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out from staff session');
    router.push('/restaurant/staff/dashboard/login');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${roleMeta.bg} ${roleMeta.color} bg-white/10 text-white border border-white/20 backdrop-blur-md`}>
                <RoleIcon className="w-3.5 h-3.5" />
                {roleMeta.label}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Shift Active
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Welcome back, {user?.staffName || user?.displayName || 'Team Member'}! 👋
            </h1>

            <p className="text-sm sm:text-base text-slate-300 flex items-center gap-2">
              <Utensils className="w-4 h-4 text-purple-400" />
              <span>{restaurant?.name || 'Restaurant Workspace'}</span>
              <span className="text-slate-500">•</span>
              <span className="text-xs text-slate-400">ID: {restaurant?.id || user?.restaurantId}</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="px-4 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center min-w-[130px]">
              <p className="text-[11px] uppercase tracking-wider text-slate-300 font-semibold">Local Time</p>
              <p className="text-lg font-black tracking-wide font-mono text-white">{currentTime}</p>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-2xl gap-2 font-medium"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Permissions Overview Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-500 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Role Permissions Granted:
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {permissions && permissions.length > 0 ? (
            permissions.map((p) => (
              <Badge key={p} variant="secondary" className="text-xs font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                ✓ {p}
              </Badge>
            ))
          ) : (
            <Badge variant="secondary" className="text-xs font-semibold">
              Standard Crew Access
            </Badge>
          )}
        </div>
      </div>

      {/* Module Cards Grid */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" /> Authorized Workstations
          </h2>
          <p className="text-xs text-muted-foreground">Select a tool to start working. Restricted modules are governed by your role.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((m) => {
            const permKey = m.permission || m.id;
            const allowed = hasPermission(permKey);
            const Icon = m.icon;

            if (!allowed) {
              return (
                <div
                  key={m.id}
                  className="p-5 rounded-2xl border border-dashed border-border/80 bg-muted/20 opacity-60 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-muted-foreground line-through">{m.title}</h3>
                      <p className="text-xs text-muted-foreground/80 mt-1">{m.desc}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Permission Required</span>
                    <Badge variant="outline" className="text-[10px] font-mono">{permKey}</Badge>
                  </div>
                </div>
              );
            }

            return (
              <motion.div
                key={m.id}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className="h-full"
              >
                <Link href={m.href} className="block h-full">
                  <Card className="h-full border-border/70 shadow-sm hover:shadow-xl transition-all duration-300 hover:border-purple-500/50 group flex flex-col justify-between">
                    <CardHeader className="p-5 pb-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${m.color} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-200`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        {m.badge ? (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${m.badgeColor}`}>
                            {m.badge}
                          </span>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            <ArrowUpRight className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">
                        {m.title}
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {m.desc}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-5 pt-0">
                      <div className="flex items-center justify-between text-xs text-primary font-semibold pt-3 border-t border-border/50">
                        <span>Open Workstation</span>
                        <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
