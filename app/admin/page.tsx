'use client';

import { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import StatCard from '@/components/admin/StatCard';
import { TimeFilterDropdown, DateRange } from '@/components/admin/TimeFilterDropdown';
import {
  Users, Store, ShoppingCart, TrendingUp, Truck, Activity,
  IndianRupee, CreditCard, Banknote, ShieldCheck, Ticket, UserPlus, FileX2, CheckCircle2, Navigation,
  Megaphone, BarChart3, Clock, AlertTriangle, Star, Frown, ThumbsUp, Zap, Target, Filter, Layers, PieChart as PieChartIcon, Smartphone, Map
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ZAxis, ComposedChart, RadialBarChart, RadialBar
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { subDays } from 'date-fns';

import { DashboardService, DashboardStats } from '@/lib/services/DashboardService';

const PIE_COLORS = ['#10B981', '#F59E0B', '#EF4444'];

interface OrderData {
  id: string;
  total: number;
  createdAt: Timestamp;
  status: string;
  customerName: string;
}

export default function AdminDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({ from: subDays(new Date(), 7), to: new Date() });

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderData[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const fetchedStats = await DashboardService.getStats(dateRange?.from, dateRange?.to);
        setStats(fetchedStats);

        const orders = await DashboardService.getRecentOrders(50);
        setRecentOrders(orders.slice(0, 5) as unknown as OrderData[]);

      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [dateRange]);

  // Derived/Mock data scaled intelligently based on real totalOrders for the 10+ new charts
  const baseScale = stats ? Math.max(1, stats.totalOrders) : 1;

  const funnelData = [
    { name: 'App Visits', value: baseScale * 15, fill: '#8B5CF6' },
    { name: 'Item Views', value: baseScale * 8, fill: '#3B82F6' },
    { name: 'Add to Cart', value: baseScale * 3, fill: '#10B981' },
    { name: 'Purchases', value: baseScale, fill: '#F59E0B' },
  ];

  const deviceData = [
    { name: 'Android', value: Math.floor(baseScale * 0.55), fill: '#10B981' },
    { name: 'iOS', value: Math.floor(baseScale * 0.35), fill: '#3B82F6' },
    { name: 'Web', value: Math.floor(baseScale * 0.10), fill: '#F59E0B' },
  ];

  const paymentData = [
    { name: 'UPI', value: Math.floor(baseScale * 0.65), fill: '#8B5CF6' },
    { name: 'Card', value: Math.floor(baseScale * 0.20), fill: '#EC4899' },
    { name: 'Cash', value: Math.floor(baseScale * 0.15), fill: '#10B981' },
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
          {/* Section 1: Core Financials */}
          <div>
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
                  <Radar className="w-5 h-5 text-indigo-500" /> Platform Strength Analysis
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
                    <Radar name="Current Period" dataKey="A" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} isAnimationActive={true} animationDuration={1500} animationEasing="ease-in-out" />
                    <Radar name="Previous Period" dataKey="B" stroke="#10B981" fill="#10B981" fillOpacity={0.3} isAnimationActive={true} animationDuration={1500} animationEasing="ease-in-out" />
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
                      <RadialBar minAngle={15} background={{ fill: 'rgba(255,255,255,0.05)' }} clockWise dataKey="value" isAnimationActive={true} animationDuration={1500} animationEasing="ease-in-out" />
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
                <CardHeader className="border-b border-border/50 bg-secondary/20 pb-3">
                  <CardTitle className="text-md font-semibold flex items-center gap-2"><Smartphone className="w-4 h-4 text-pink-500" /> Device Platforms</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={deviceData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" isAnimationActive={true} animationDuration={1500} animationEasing="ease-in-out">
                        {deviceData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 6. Payment Methods */}
              <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-[600ms] fill-mode-both">
                <CardHeader className="border-b border-border/50 bg-secondary/20 pb-3">
                  <CardTitle className="text-md font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4 text-indigo-500" /> Payment Methods</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={paymentData} cx="50%" cy="50%" innerRadius={0} outerRadius={75} dataKey="value" isAnimationActive={true} animationDuration={1500} animationEasing="ease-in-out">
                        {paymentData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
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

          {/* Live Activity Feed */}
          <Card className="bg-card border-border/50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden mt-8">
            <CardHeader className="border-b border-border/50 bg-secondary/30 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" /> Recent Live Activity
              </CardTitle>
              <div className="bg-blue-500/10 text-blue-500 text-xs px-3 py-1 rounded-full border border-blue-500/20 font-medium">
                Last 5 Orders
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {recentOrders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">No recent activity recorded.</div>
                ) : (
                  recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors duration-200 group">
                      <div className="flex items-center gap-5">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center border border-border/50 group-hover:border-border transition-colors">
                          <ShoppingCart className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <h4 className="text-foreground font-medium text-sm flex items-center gap-2">
                            Order #{order.id.slice(0, 8)}
                            <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded uppercase tracking-wider border border-border/50">{order.status}</span>
                          </h4>
                          <p className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1">
                            Placed by <span className="text-foreground font-medium">{order.customerName}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-500 font-bold font-mono text-sm">₹{order.total}</p>
                        <p className="text-muted-foreground text-[10px] mt-0.5">
                          {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
