'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import StatCard from '@/components/admin/StatCard';
import { TimeFilterDropdown, DateRange } from '@/components/admin/TimeFilterDropdown';
import {
  Users, Store, ShoppingCart, TrendingUp, Truck, Activity,
  IndianRupee, CreditCard, Banknote, ShieldCheck, Ticket, UserPlus, FileX2, CheckCircle2, Navigation,
  Megaphone, BarChart3, Clock, AlertTriangle, Star, Frown, ThumbsUp, Zap, Target, Filter, Layers, PieChart as PieChartIcon, Smartphone, Map,
  Plus, Package, Radio, Check, Loader2, ArrowRight
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, Legend,
  RadarChart, Radar as RechartsRadar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ZAxis, ComposedChart, RadialBarChart, RadialBar
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { subDays } from 'date-fns';
import { toast } from 'sonner';

import { DashboardService, DashboardStats } from '@/lib/services/DashboardService';

const PIE_COLORS = ['#10B981', '#F59E0B', '#EF4444'];

interface OrderData {
  id: string;
  total: number;
  createdAt: Timestamp;
  status: string;
  customerName: string;
  items?: any[];
}

function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }
    const duration = 850;
    const start = performance.now();
    let animId: number;
    const frame = (time: number) => {
      const progress = Math.min((time - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(ease * value));
      if (progress < 1) {
        animId = requestAnimationFrame(frame);
      } else {
        setDisplay(value);
      }
    };
    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [value]);

  return <span>{prefix}{display.toLocaleString()}{suffix}</span>;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange>({ from: subDays(new Date(), 7), to: new Date() });

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderData[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const fetchedStats = await DashboardService.getStats(dateRange?.from, dateRange?.to);
      setStats(fetchedStats);

      const orders = await DashboardService.getRecentOrders(15);
      setRecentOrders(orders as unknown as OrderData[]);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingOrderId(orderId);
    try {
      await DashboardService.updateOrderStatus(orderId, newStatus);
      setRecentOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      toast.success(`Order #${orderId.slice(0, 8)} status updated to "${newStatus.replace('_', ' ').toUpperCase()}"!`);
      // Refresh stats quietly
      DashboardService.getStats(dateRange?.from, dateRange?.to).then(setStats).catch(() => {});
    } catch (err: any) {
      console.error('Failed to update status:', err);
      toast.error('Failed to update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleRestockProduct = async (itemId: string) => {
    try {
      await DashboardService.toggleItemAvailability(itemId, true);
      if (stats) {
        setStats({
          ...stats,
          activeProductsCount: stats.activeProductsCount + 1,
          inventoryAlerts: stats.inventoryAlerts.filter(i => i.id !== itemId),
        });
      }
      toast.success('Product restocked and marked as available live!');
    } catch (err: any) {
      console.error('Failed to restock:', err);
      toast.error('Failed to restock item');
    }
  };

  // Derived/Mock data scaled intelligently based on real totalOrders for the 10+ new charts
  const baseScale = stats ? Math.max(1, stats.totalOrders) : 1;

  const funnelData = [
    { name: 'App Visits', value: baseScale * 15, fill: '#8B5CF6' },
    { name: 'Item Views', value: baseScale * 8, fill: '#3B82F6' },
    { name: 'Add to Cart', value: baseScale * 3, fill: '#10B981' },
    { name: 'Purchases', value: baseScale, fill: '#F59E0B' },
  ];

  // Real Device Platforms derived from actual Firestore orders
  const rawDevices = stats?.deviceBreakdown || {
    Android: 0,
    iOS: 0,
    Web: 0,
  };
  const totalDeviceHits = rawDevices.Android + rawDevices.iOS + rawDevices.Web;
  const deviceData = [
    { name: 'Android App', value: rawDevices.Android, fill: '#10B981' },
    { name: 'iOS App', value: rawDevices.iOS, fill: '#3B82F6' },
    { name: 'Web Portal', value: rawDevices.Web, fill: '#F59E0B' },
  ];

  // Real Payment Methods strictly derived from actual Firestore orders (ONLY razorpay, wallet, cod)
  const rawPayments = stats?.paymentBreakdown || {
    razorpay: { count: 0, total: 0 },
    wallet: { count: 0, total: 0 },
    cod: { count: 0, total: 0 },
  };
  const totalPaymentHits = rawPayments.razorpay.count + rawPayments.wallet.count + rawPayments.cod.count;
  const paymentData = [
    {
      name: 'Razorpay',
      key: 'razorpay',
      value: rawPayments.razorpay.count,
      amount: rawPayments.razorpay.total,
      fill: '#3B82F6',
    },
    {
      name: 'Hunger Wallet',
      key: 'wallet',
      value: rawPayments.wallet.count,
      amount: rawPayments.wallet.total,
      fill: '#10B981',
    },
    {
      name: 'Cash on Delivery (COD)',
      key: 'cod',
      value: rawPayments.cod.count,
      amount: rawPayments.cod.total,
      fill: '#F59E0B',
    },
  ];

  const topRestaurants = [
    { name: 'Pizza Paradise', orders: Math.floor(baseScale * 0.12) },
    { name: 'Burger Hub', orders: Math.floor(baseScale * 0.09) },
    { name: 'Sushi Zen', orders: Math.floor(baseScale * 0.08) },
    { name: 'Curry House', orders: Math.floor(baseScale * 0.06) },
    { name: 'Vegan Bowl', orders: Math.floor(baseScale * 0.04) },
  ];

  const zoneData = [
    { zone: 'North', avgTime: 25, orders: Math.floor(baseScale * 0.3) },
    { zone: 'South', avgTime: 35, orders: Math.floor(baseScale * 0.2) },
    { zone: 'East', avgTime: 28, orders: Math.floor(baseScale * 0.25) },
    { zone: 'West', avgTime: 40, orders: Math.floor(baseScale * 0.15) },
    { zone: 'Central', avgTime: 18, orders: Math.floor(baseScale * 0.1) },
  ];

  const goalData = [
    { name: 'Monthly', value: 85, fill: '#3B82F6' },
    { name: 'Weekly', value: 60, fill: '#10B981' },
    { name: 'Daily', value: 40, fill: '#F59E0B' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">

      {/* Header & Global Filters */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground/80 to-muted-foreground tracking-tight mb-2">
            Intelligence Hub
          </h1>
          <p className="text-muted-foreground">Comprehensive analytics and operational overview.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-2 bg-secondary rounded-full px-4 py-2 border border-border/50">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium text-green-500">System Online</span>
          </div>
          <TimeFilterDropdown onRangeChange={setDateRange} />
        </div>
      </div>

      {loading || !stats ? (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-4">
          <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p>Compiling statistics for selected range...</p>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* 1. KEY ANALYTICS CARDS (METRICS) & QUICK ACTIONS                          */}
          {/* ========================================================================= */}
          <div className="space-y-6">
            {/* Quick Action Buttons / Shortcuts Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-primary/15 via-primary/5 to-muted/30 border border-primary/25 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-foreground flex items-center gap-2">
                    Quick Control Options
                    <Badge variant="outline" className="border-primary/40 text-primary text-[10px] font-bold py-0">Admin Shortcuts</Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground">Naya product add karne ya coupon/discount code create karne ka quick option</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  size="sm"
                  onClick={() => router.push('/admin/menus')}
                  className="rounded-xl text-xs font-black gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md h-9 px-4 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  Add New Product / SKU
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push('/admin/promotions')}
                  className="rounded-xl text-xs font-bold gap-1.5 border-border hover:bg-muted h-9 px-4 cursor-pointer"
                >
                  <Ticket className="w-4 h-4 text-primary" />
                  Create Coupon / Discount
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push('/admin/orders')}
                  className="rounded-xl text-xs font-bold gap-1.5 border-border hover:bg-muted h-9 px-4 cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4 text-blue-500" />
                  Manage All Orders
                </Button>
              </div>
            </div>

            {/* 4 Main Key Analytics Cards */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Key Analytics Cards (Metrics)
                </h2>
                <Badge variant="outline" className="text-xs font-bold text-muted-foreground border-border">
                  Real Firebase Telemetry
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Revenue (Total Sales) */}
                <Card className="rounded-3xl border-border bg-gradient-to-br from-emerald-500/10 via-card to-card hover:border-emerald-500/40 transition-all shadow-sm">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Revenue (Total Sales)</span>
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                        ₹
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                        ₹<AnimatedNumber value={stats.totalRevenue} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Store ki total earnings (₹) track karne ke liye
                      </p>
                    </div>
                    <div className="pt-1 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Live Verified Orders Earnings
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Total Orders (with breakdown) */}
                <Card className="rounded-3xl border-border bg-gradient-to-br from-blue-500/10 via-card to-card hover:border-blue-500/40 transition-all shadow-sm">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Orders</span>
                      <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <ShoppingCart className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                        <AnimatedNumber value={stats.totalOrders} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Kitne orders aaye hain (Breakdown)
                      </p>
                    </div>
                    {/* Status Breakdown Pills */}
                    <div className="flex flex-wrap gap-1.5 pt-1 text-[10px] font-bold">
                      <span className="bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                        Pending: {stats.pendingOrders}
                      </span>
                      <span className="bg-blue-500/15 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                        Shipped: {stats.shippedOrders}
                      </span>
                      <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                        Delivered: {stats.completedOrders}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* 3. Active Products / SKUs */}
                <Card className="rounded-3xl border-border bg-gradient-to-br from-purple-500/10 via-card to-card hover:border-purple-500/40 transition-all shadow-sm">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Products / SKUs</span>
                      <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <Package className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                        <AnimatedNumber value={stats.activeProductsCount} suffix=" Live" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Store par live items & SKUs in stock
                      </p>
                    </div>
                    <div className="pt-1 flex items-center justify-between text-[11px]">
                      <span className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Total: {stats.totalProductsCount || stats.activeProductsCount} SKUs
                      </span>
                      {stats.inventoryAlerts.length > 0 && (
                        <span className="text-rose-500 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded-md text-[10px]">
                          {stats.inventoryAlerts.length} OOS
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 4. Total Customers */}
                <Card className="rounded-3xl border-border bg-gradient-to-br from-indigo-500/10 via-card to-card hover:border-indigo-500/40 transition-all shadow-sm">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Customers</span>
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Users className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                        <AnimatedNumber value={stats.totalCustomers} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Unique buyers aur repeat customer count
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-1 text-[10px] font-bold">
                      <span className="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                        Unique: {stats.uniqueBuyersCount}
                      </span>
                      <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                        Repeat: {stats.repeatCustomersCount}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Inventory Alerts Widget */}
            <div className="p-4 sm:p-5 rounded-3xl bg-card border border-border shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${stats.inventoryAlerts.length > 0 ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                      Inventory Alerts
                      {stats.inventoryAlerts.length > 0 ? (
                        <Badge variant="destructive" className="text-[10px] px-2 py-0.2 rounded-full font-bold">
                          {stats.inventoryAlerts.length} Products Low / Out of Stock
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] px-2 py-0.2 rounded-full font-bold border-0">
                          Stock Healthy
                        </Badge>
                      )}
                    </h4>
                    <p className="text-xs text-muted-foreground">Agar koi product ya size stock se khatam hone wala ho toh uska warning alert</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push('/admin/menus')}
                  className="text-xs rounded-xl font-bold border-border hover:bg-muted"
                >
                  Manage Inventory SKUs
                </Button>
              </div>

              {stats.inventoryAlerts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                  {stats.inventoryAlerts.map(item => (
                    <div key={item.id} className="p-3.5 rounded-2xl bg-muted/40 border border-rose-500/30 flex items-center justify-between gap-3 shadow-xs">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{item.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.category || 'General'} • ₹{item.price} • <span className="text-rose-500 font-bold">Unavailable</span>
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleRestockProduct(item.id)}
                        className="h-7 px-3 text-[11px] font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
                      >
                        Restock
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Sabhi products & SKUs live aur stock me uplabdh hain. Koi out-of-stock warning nahi hai.
                </div>
              )}
            </div>
          </div>

          {/* Section 1: Core Financials */}
          <div className="pt-2">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2"><IndianRupee className="w-5 h-5 text-emerald-500" /> Financial Performance</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              <StatCard title="Gross Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} change="vs last period" icon={IndianRupee} color="green" />
              <StatCard title="Avg Order Value" value={`₹${stats.avgOrderValue.toFixed(0)}`} icon={Banknote} color="blue" />
              <StatCard title="Platform Fees" value={`₹${stats.platformFees.toLocaleString()}`} icon={CreditCard} color="orange" />
              <StatCard title="Delivery Fees" value={`₹${stats.deliveryFees.toLocaleString()}`} icon={Truck} color="blue" />
              <StatCard title="Discount Given" value={`₹${stats.discountGiven.toLocaleString()}`} icon={Ticket} color="red" />
            </div>
          </div>

          {/* Section 2: Order Fulfillment */}
          <div className="pt-4">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-blue-500" /> Order Fulfillment</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Orders" value={stats.totalOrders} icon={ShoppingCart} color="blue" />
              <StatCard title="Completed Orders" value={stats.completedOrders} icon={CheckCircle2} color="green" />
              <StatCard title="Pending / Active" value={stats.pendingOrders} icon={Activity} color="orange" />
              <StatCard title="Cancelled Orders" value={stats.cancelledOrders} icon={FileX2} color="red" />
            </div>
          </div>

          {/* Section 3: Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
            <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-secondary/30 pb-4">
                <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-500" /> Revenue Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 pl-0">
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={stats.chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" stroke="#6B7280" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} dy={10} />
                    <YAxis stroke="#6B7280" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(val) => `₹${val}`} dx={-10} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#10B981" fillOpacity={1} fill="url(#colorRev)" isAnimationActive={true} animationDuration={1500} animationEasing="ease-in-out" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-secondary/30 pb-4">
                <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" /> Order Volume
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 pl-0">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={stats.chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" stroke="#6B7280" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} dy={10} />
                    <YAxis stroke="#6B7280" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} dx={-10} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }} />
                    <Bar dataKey="orders" fill="#3B82F6" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={1500} animationEasing="ease-in-out" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Additional Graphs Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
            <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden lg:col-span-1">
              <CardHeader className="border-b border-border/50 bg-secondary/30 pb-4">
                <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-500" /> Order Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Completed', value: stats.completedOrders },
                        { name: 'Pending', value: stats.pendingOrders },
                        { name: 'Cancelled', value: stats.cancelledOrders }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      isAnimationActive={true}
                      animationDuration={1500}
                      animationEasing="ease-in-out"
                    >
                      {[0, 1, 2].map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden lg:col-span-2">
              <CardHeader className="border-b border-border/50 bg-secondary/30 pb-4">
                <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <LineChart className="w-5 h-5 text-orange-500" /> Growth Trajectory (Users vs Revenue)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 pl-0">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={stats.chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" stroke="#6B7280" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} dy={10} />
                    <YAxis yAxisId="left" stroke="#6B7280" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(val) => `₹${val}`} />
                    <YAxis yAxisId="right" orientation="right" stroke="#6B7280" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }} />
                    <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} isAnimationActive={true} animationDuration={1500} animationEasing="ease-in-out" />
                    <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} isAnimationActive={true} animationDuration={1500} animationEasing="ease-in-out" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Section 4: Users & Network */}
          <div className="pt-4">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-purple-500" /> Platform Network Ecosystem</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Customers" value={stats.totalCustomers} change={`+${stats.newCustomers} in range`} icon={Users} color="blue" />
              <StatCard title="Active Users" value={stats.activeUsers} icon={Activity} color="green" />
              <StatCard title="New Signups" value={stats.newCustomers} icon={UserPlus} color="orange" />
              <StatCard title="Support Tickets" value={stats.supportTickets} icon={ShieldCheck} color="red" />

              <StatCard title="Total Restaurants" value={stats.totalRestaurants} change={`+${stats.newRestaurants} in range`} icon={Store} color="orange" />
              <StatCard title="Online Restaurants" value={stats.onlineRestaurants} icon={Store} color="green" />

              <StatCard title="Total Delivery Fleet" value={stats.totalDeliveryPartners} change={`+${stats.newDeliveryPartners} in range`} icon={Truck} color="blue" />
              <StatCard title="Active Drivers" value={stats.activeDrivers} icon={Navigation} color="green" />
            </div>
          </div>

          {/* Section 5: Marketing & Quality */}
          <div className="pt-4">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2"><Megaphone className="w-5 h-5 text-orange-500" /> Marketing & Customer Satisfaction</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Active Promotions" value={stats.activePromotions} icon={Zap} color="orange" />
              <StatCard title="Conversion Rate" value={`${stats.conversionRate}%`} icon={BarChart3} color="blue" />
              <StatCard title="Avg Customer Rating" value={stats.avgRating} icon={Star} color="green" />
              <StatCard title="Negative Reviews" value={Math.floor(stats.totalOrders * 0.02)} icon={Frown} color="red" />
            </div>
          </div>

          {/* Section 6: Delivery Operations Insights */}
          <div className="pt-4">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2"><Truck className="w-5 h-5 text-blue-500" /> Operational Efficiency</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Avg Delivery Time" value={`${stats.avgDeliveryTime} mins`} icon={Clock} color="blue" />
              <StatCard title="Delayed Orders" value={stats.delayedOrders} icon={AlertTriangle} color="red" />
              <StatCard title="On-Time Delivery" value={`${(100 - (stats.delayedOrders / Math.max(1, stats.completedOrders)) * 100).toFixed(1)}%`} icon={ThumbsUp} color="green" />
              <StatCard title="Avg Distance" value="3.4 km" icon={Navigation} color="orange" />
            </div>
          </div>

          {/* Advanced Analytics Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
            <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-secondary/30 pb-4">
                <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Radio className="w-5 h-5 text-indigo-500" /> Platform Strength Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart outerRadius={90} data={[
                    { subject: 'Speed', A: 120, B: 110, fullMark: 150 },
                    { subject: 'Reliability', A: 98, B: 130, fullMark: 150 },
                    { subject: 'Support', A: 86, B: 130, fullMark: 150 },
                    { subject: 'Retention', A: 99, B: 100, fullMark: 150 },
                    { subject: 'Conversion', A: 85, B: 90, fullMark: 150 },
                    { subject: 'App Rating', A: 65, B: 85, fullMark: 150 },
                  ]}>
                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                    <RechartsRadar name="Current Period" dataKey="A" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} isAnimationActive={true} animationDuration={1500} animationEasing="ease-in-out" />
                    <RechartsRadar name="Previous Period" dataKey="B" stroke="#10B981" fill="#10B981" fillOpacity={0.3} isAnimationActive={true} animationDuration={1500} animationEasing="ease-in-out" />
                    <Legend />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-secondary/30 pb-4">
                <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Activity className="w-5 h-5 text-pink-500" /> Order Density (Time vs Volume)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 pl-0">
                <ResponsiveContainer width="100%" height={320}>
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="category" dataKey="name" name="Time" stroke="#6B7280" tick={{ fontSize: 12 }} />
                    <YAxis type="number" dataKey="orders" name="Volume" stroke="#6B7280" tick={{ fontSize: 12 }} />
                    <ZAxis type="number" dataKey="revenue" range={[60, 400]} name="Revenue" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }} />
                    <Scatter name="Orders" data={stats.chartData} fill="#EC4899" isAnimationActive={true} animationDuration={1500} animationEasing="ease-in-out" />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* NEW SECTION: Massive 10+ Analytics Panel */}
          <div className="pt-8">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2 border-b border-border/50 pb-2">
              <Layers className="w-6 h-6 text-indigo-500" /> Deep Dive Analytics & Insights (10+ Metrics)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {/* 1. Customer Conversion Funnel */}
              <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-[100ms] fill-mode-both">
                <CardHeader className="border-b border-border/50 bg-secondary/20 pb-3">
                  <CardTitle className="text-md font-semibold flex items-center gap-2"><Filter className="w-4 h-4 text-purple-500" /> Conversion Funnel</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={funnelData} layout="vertical" margin={{ left: 20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={true} vertical={false} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" stroke="#9CA3AF" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                      <Bar dataKey="value" barSize={20} radius={[0, 4, 4, 0]} isAnimationActive={true} animationDuration={1500} animationEasing="ease-in-out">
                        {funnelData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 2. Target Goals Radial */}
              <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-[200ms] fill-mode-both">
                <CardHeader className="border-b border-border/50 bg-secondary/20 pb-3">
                  <CardTitle className="text-md font-semibold flex items-center gap-2"><Target className="w-4 h-4 text-blue-500" /> Revenue Goal Completion</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" barSize={15} data={goalData} startAngle={90} endAngle={-270}>
                      <RadialBar background={{ fill: 'rgba(255,255,255,0.05)' }} dataKey="value" isAnimationActive={true} animationDuration={1500} />
                      <Legend iconSize={10} layout="vertical" verticalAlign="middle" wrapperStyle={{ right: 0, fontSize: '11px', color: '#9CA3AF' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 3. Top Performing Restaurants */}
              <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-[300ms] fill-mode-both">
                <CardHeader className="border-b border-border/50 bg-secondary/20 pb-3">
                  <CardTitle className="text-md font-semibold flex items-center gap-2"><Store className="w-4 h-4 text-orange-500" /> Top 5 Restaurants</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={topRestaurants} layout="vertical" margin={{ left: 30, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={true} vertical={false} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" stroke="#9CA3AF" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                      <Bar dataKey="orders" fill="#F59E0B" barSize={15} radius={[0, 4, 4, 0]} isAnimationActive={true} animationDuration={1500} animationEasing="ease-in-out" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 4. Delivery Zones Performance */}
              <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-[400ms] fill-mode-both">
                <CardHeader className="border-b border-border/50 bg-secondary/20 pb-3">
                  <CardTitle className="text-md font-semibold flex items-center gap-2"><Map className="w-4 h-4 text-emerald-500" /> Zone Performance</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={zoneData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="zone" stroke="#9CA3AF" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" stroke="#9CA3AF" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                      <Bar yAxisId="left" dataKey="orders" fill="#10B981" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={1500} animationEasing="ease-in-out" />
                      <Line yAxisId="right" type="monotone" dataKey="avgTime" stroke="#EF4444" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={true} animationDuration={1500} animationEasing="ease-in-out" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 5. Device Demographics */}
              <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-[500ms] fill-mode-both">
                <CardHeader className="border-b border-border/50 bg-secondary/20 pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-md font-semibold flex items-center gap-2"><Smartphone className="w-4 h-4 text-pink-500" /> Device Platforms</CardTitle>
                  <Badge variant="outline" className="text-[10px] font-bold text-pink-500 border-pink-500/30">
                    Real App/Web Telemetry
                  </Badge>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <ResponsiveContainer width="100%" height={170}>
                    <PieChart>
                      <Pie
                        data={deviceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={46}
                        outerRadius={68}
                        paddingAngle={5}
                        dataKey="value"
                        isAnimationActive={true}
                        animationDuration={1500}
                        animationEasing="ease-in-out"
                      >
                        {deviceData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip
                        formatter={(val: any, name: any) => [`${val} orders`, name]}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Real Metrics Badges for Android, iOS, Web */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/40 text-center">
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Android</p>
                      <p className="text-xs font-black text-foreground">{rawDevices.Android} <span className="text-[10px] font-normal text-muted-foreground">orders</span></p>
                      <p className="text-[10px] font-bold text-muted-foreground">{totalDeviceHits > 0 ? ((rawDevices.Android / totalDeviceHits) * 100).toFixed(0) : 0}%</p>
                    </div>
                    <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">iOS</p>
                      <p className="text-xs font-black text-foreground">{rawDevices.iOS} <span className="text-[10px] font-normal text-muted-foreground">orders</span></p>
                      <p className="text-[10px] font-bold text-muted-foreground">{totalDeviceHits > 0 ? ((rawDevices.iOS / totalDeviceHits) * 100).toFixed(0) : 0}%</p>
                    </div>
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Web</p>
                      <p className="text-xs font-black text-foreground">{rawDevices.Web} <span className="text-[10px] font-normal text-muted-foreground">orders</span></p>
                      <p className="text-[10px] font-bold text-muted-foreground">{totalDeviceHits > 0 ? ((rawDevices.Web / totalDeviceHits) * 100).toFixed(0) : 0}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 6. Payment Methods (ONLY razorpay, wallet, cod) */}
              <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-[600ms] fill-mode-both">
                <CardHeader className="border-b border-border/50 bg-secondary/20 pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-md font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4 text-indigo-500" /> Payment Methods</CardTitle>
                  <Badge variant="outline" className="text-[10px] font-bold text-indigo-500 border-indigo-500/30">
                    Real Orders Checked
                  </Badge>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <ResponsiveContainer width="100%" height={170}>
                    <PieChart>
                      <Pie
                        data={paymentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={46}
                        outerRadius={68}
                        paddingAngle={5}
                        dataKey="value"
                        isAnimationActive={true}
                        animationDuration={1500}
                        animationEasing="ease-in-out"
                      >
                        {paymentData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip
                        formatter={(val: any, name: any, item: any) => [`${val} orders (₹${(item?.payload?.amount || 0).toLocaleString()})`, name]}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Real Metrics Breakdown strictly for Razorpay, Wallet, COD */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/40 text-center">
                    <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Razorpay</p>
                      <p className="text-xs font-black text-foreground">{rawPayments.razorpay.count} <span className="text-[10px] font-normal text-muted-foreground">orders</span></p>
                      <p className="text-[10px] font-bold text-muted-foreground">₹{rawPayments.razorpay.total.toLocaleString()}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Wallet</p>
                      <p className="text-xs font-black text-foreground">{rawPayments.wallet.count} <span className="text-[10px] font-normal text-muted-foreground">orders</span></p>
                      <p className="text-[10px] font-bold text-muted-foreground">₹{rawPayments.wallet.total.toLocaleString()}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">COD</p>
                      <p className="text-xs font-black text-foreground">{rawPayments.cod.count} <span className="text-[10px] font-normal text-muted-foreground">orders</span></p>
                      <p className="text-[10px] font-bold text-muted-foreground">₹{rawPayments.cod.total.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 7. Financial Margins (Stacked Area) */}
              <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 lg:col-span-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-[700ms] fill-mode-both">
                <CardHeader className="border-b border-border/50 bg-secondary/20 pb-3">
                  <CardTitle className="text-md font-semibold flex items-center gap-2"><IndianRupee className="w-4 h-4 text-green-500" /> Comprehensive Financial Margins</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                      <Area type="monotone" name="Total Revenue" stackId="1" dataKey="revenue" stroke="#10B981" fill="#10B981" fillOpacity={0.6} isAnimationActive={true} animationDuration={1500} />
                      <Area type="monotone" name="Estimated Costs" stackId="2" dataKey={(d) => Math.floor(d.revenue * 0.4)} stroke="#EF4444" fill="#EF4444" fillOpacity={0.6} isAnimationActive={true} animationDuration={1500} />
                      <Area type="monotone" name="Platform Margin" stackId="3" dataKey={(d) => Math.floor(d.revenue * 0.15)} stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} isAnimationActive={true} animationDuration={1500} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

            </div>
          </div>

          {/* ========================================================================= */}
          {/* RECENT ORDERS TABLE / LIST WITH DIRECT STATUS UPDATER                    */}
          {/* ========================================================================= */}
          <Card className="bg-card border-border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden mt-8 rounded-3xl">
            <CardHeader className="border-b border-border/60 bg-muted/20 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-blue-500" /> Recent Orders & Live Status Control
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Latest orders ki list jiska status aap direct &quot;Pending&quot; se &quot;Shipped&quot; ya &quot;Delivered&quot; update kar sako
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-border text-xs font-bold text-muted-foreground">
                  {recentOrders.length} Recent Orders
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push('/admin/orders')}
                  className="rounded-xl text-xs font-bold gap-1 border-border hover:bg-muted"
                >
                  <span>All Orders</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
              {recentOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No recent orders recorded in selected period.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider font-extrabold">
                    <tr>
                      <th className="py-3 px-4">Order ID & Time</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Current Status</th>
                      <th className="py-3 px-4 text-right">Quick Status Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {recentOrders.map((order) => {
                      const isUpdating = updatingOrderId === order.id;
                      const currentStatus = (order.status || 'pending').toLowerCase();

                      return (
                        <tr key={order.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-foreground">
                              #{order.id.slice(0, 8)}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Just now'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-foreground">
                            {order.customerName || 'Customer'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                              ₹{order.total}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${
                                currentStatus === 'delivered'
                                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : currentStatus === 'cancelled'
                                  ? 'border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                  : currentStatus === 'preparing' || currentStatus === 'out_for_delivery' || currentStatus === 'shipped'
                                  ? 'border-blue-500/40 bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                  : 'border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {currentStatus.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {isUpdating ? (
                                <span className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...
                                </span>
                              ) : (
                                <>
                                  {/* Pending button */}
                                  {currentStatus !== 'pending' && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateStatus(order.id, 'pending')}
                                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                                    >
                                      Pending
                                    </button>
                                  )}
                                  {/* Shipped / Out for delivery button */}
                                  {currentStatus !== 'out_for_delivery' && currentStatus !== 'shipped' && currentStatus !== 'delivered' && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateStatus(order.id, 'out_for_delivery')}
                                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-all cursor-pointer"
                                    >
                                      Mark Shipped
                                    </button>
                                  )}
                                  {/* Delivered button */}
                                  {currentStatus !== 'delivered' && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateStatus(order.id, 'delivered')}
                                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer"
                                    >
                                      Mark Delivered
                                    </button>
                                  )}
                                  {/* If already delivered */}
                                  {currentStatus === 'delivered' && (
                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                      <Check className="w-3.5 h-3.5 stroke-[3]" /> Fulfilled
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
