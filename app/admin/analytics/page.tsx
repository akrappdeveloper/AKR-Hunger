'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp, Users, ShoppingCart, Store, Truck, DollarSign,
  Download, Calendar, ArrowUpRight, ArrowDownRight, Activity,
  IndianRupee, Clock, Zap, Target, BarChart3, PieChart as PieChartIcon
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line, ComposedChart,
} from 'recharts';
import { exportToCSV, exportToPDF, generateOrderReport } from '@/lib/export';
import { toast } from 'sonner';

interface PlatformMetrics {
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  totalRestaurants: number;
  totalDeliveryPartners: number;
  activeDeliveryPartners: number;
  deliveredOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  avgOrderValue: number;
  totalDeliveryFees: number;
  totalDriverPayouts: number;
  totalCommission: number;
  totalDriverCashInHand: number;
}

interface TopRestaurant {
  id: string;
  name: string;
  orders: number;
  revenue: number;
  rating: number;
}

interface TopDeliveryPartner {
  id: string;
  name: string;
  deliveries: number;
  rating: number;
}

export interface DeliveryPartnerDetail {
  id: string;
  name: string;
  phone: string;
  email?: string;
  vehicle: string;
  vehicleNumber?: string;
  rating: number;
  status: 'online' | 'offline' | 'on_delivery' | string;
  kycStatus?: string;
  deliveries: number;
  earnings: number;
  cashInHand: number;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/90 border border-border/50 p-3 rounded-xl shadow-2xl backdrop-blur-md">
        <p className="font-semibold text-foreground mb-2 text-sm">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
            <span className="text-muted-foreground capitalize">{entry.name}:</span>
            <span className="font-bold text-foreground font-mono">
              {entry.name.includes('revenue') || entry.name.includes('Revenue') || entry.name === 'value'
                ? `₹${Number(entry.value).toLocaleString()}`
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function AdminAnalyticsPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics>({
    totalOrders: 0, totalRevenue: 0, totalCustomers: 0,
    totalRestaurants: 0, totalDeliveryPartners: 0, activeDeliveryPartners: 0,
    deliveredOrders: 0, cancelledOrders: 0, pendingOrders: 0,
    avgOrderValue: 0, totalDeliveryFees: 0, totalDriverPayouts: 0, totalCommission: 0,
    totalDriverCashInHand: 0,
  });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [topRestaurants, setTopRestaurants] = useState<TopRestaurant[]>([]);
  const [topPartners, setTopPartners] = useState<TopDeliveryPartner[]>([]);
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartnerDetail[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    let partnersCache: any[] = [];
    let ordersCache: any[] = [];

    const recalculateDeliveryAnalytics = () => {
      const deliveriesMap: Record<string, { count: number; earnings: number; cash: number }> = {};

      ordersCache.forEach((order) => {
        if (order.status === 'delivered' && order.deliveryPersonId) {
          const dId = order.deliveryPersonId;
          if (!deliveriesMap[dId]) {
            deliveriesMap[dId] = { count: 0, earnings: 0, cash: 0 };
          }
          deliveriesMap[dId].count++;
          const earning = order.deliveryEarnings ?? Math.round((order.deliveryCharge || 40) * 0.8);
          deliveriesMap[dId].earnings += earning;
          if (order.paymentMethod === 'cod') {
            deliveriesMap[dId].cash += (order.total || 0);
          }
        }
      });

      let activeCount = 0;
      let totalDriverCash = 0;
      let totalDriverEarnings = 0;

      const detailedPartners: DeliveryPartnerDetail[] = partnersCache.map((p) => {
        const orderStats = deliveriesMap[p.id] || { count: 0, earnings: 0, cash: 0 };
        const completedDeliveries = Math.max(
          p.completedDeliveries || p.totalDeliveries || p.deliveriesCount || 0,
          orderStats.count
        );
        const earnings = Math.max(
          p.totalEarnings || p.earnings || 0,
          orderStats.earnings
        );
        const cashInHand = p.walletBalance || p.cashInHand || orderStats.cash || 0;

        const isOnline = p.status === 'online' || p.status === 'on_delivery' || p.isAvailable === true;
        if (isOnline) activeCount++;

        totalDriverCash += cashInHand;
        totalDriverEarnings += earnings;

        return {
          id: p.id,
          name: p.name || p.displayName || 'Delivery Partner',
          phone: p.phone || p.phoneNumber || 'N/A',
          email: p.email || '',
          vehicle: p.vehicle || p.vehicleType || 'Bike',
          vehicleNumber: p.vehicleNumber || 'N/A',
          rating: typeof p.rating === 'number' && p.rating > 0 ? p.rating : 4.8,
          status: p.status || (p.isAvailable ? 'online' : 'offline'),
          kycStatus: p.kycStatus || (p.isVerified ? 'approved' : 'pending'),
          deliveries: completedDeliveries,
          earnings: earnings,
          cashInHand: cashInHand,
        };
      });

      detailedPartners.sort((a, b) => b.deliveries - a.deliveries || b.earnings - a.earnings);
      setDeliveryPartners(detailedPartners);

      // Top partners for leaderboard
      setTopPartners(detailedPartners.slice(0, 5).map(p => ({
        id: p.id,
        name: p.name,
        deliveries: p.deliveries,
        rating: p.rating,
      })));

      setMetrics(prev => ({
        ...prev,
        totalDeliveryPartners: partnersCache.length,
        activeDeliveryPartners: activeCount,
        totalDriverPayouts: totalDriverEarnings,
        totalDriverCashInHand: totalDriverCash,
      }));
    };

    // Listen to customers count
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      setMetrics(prev => ({ ...prev, totalCustomers: snap.size }));
    });

    // Listen to restaurants
    const unsubRestaurants = onSnapshot(collection(db, 'restaurants'), (snap) => {
      const restaurants = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMetrics(prev => ({ ...prev, totalRestaurants: snap.size }));
    });

    // Listen to delivery partners in deliveryPersons collection
    const unsubDelivery = onSnapshot(collection(db, 'deliveryPersons'), (snap) => {
      partnersCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      recalculateDeliveryAnalytics();
    });

    // Listen to all orders
    const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      ordersCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      recalculateDeliveryAnalytics();
      let revenue = 0;
      let deliveryFees = 0;
      let delivered = 0;
      let cancelled = 0;
      let pending = 0;
      const restaurantStats: Record<string, { name: string; orders: number; revenue: number; rating: number }> = {};
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyAgg: Record<string, { name: string; orders: number; revenue: number; customers: Set<string> }> = {};
      const hourlyAgg: Record<number, number> = {};

      snap.docs.forEach(doc => {
        const data = doc.data();
        const total = data.total || 0;
        revenue += total;
        deliveryFees += data.deliveryCharge || 0;

        if (data.status === 'delivered') delivered++;
        else if (data.status === 'cancelled') cancelled++;
        else pending++;

        // Restaurant aggregation
        if (data.restaurantId) {
          if (!restaurantStats[data.restaurantId]) {
            restaurantStats[data.restaurantId] = {
              name: data.restaurantName || 'Unknown',
              orders: 0,
              revenue: 0,
              rating: 0,
            };
          }
          restaurantStats[data.restaurantId].orders++;
          restaurantStats[data.restaurantId].revenue += total;
        }

        // Monthly aggregation
        if (data.createdAt?.toDate) {
          const date = data.createdAt.toDate();
          const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
          const monthName = months[date.getMonth()];
          if (!monthlyAgg[monthKey]) {
            monthlyAgg[monthKey] = { name: monthName, orders: 0, revenue: 0, customers: new Set() };
          }
          monthlyAgg[monthKey].orders++;
          monthlyAgg[monthKey].revenue += total;
          if (data.customerId) monthlyAgg[monthKey].customers.add(data.customerId);

          // Hourly aggregation
          const hour = date.getHours();
          hourlyAgg[hour] = (hourlyAgg[hour] || 0) + 1;
        }
      });

      const avgOrder = snap.size > 0 ? revenue / snap.size : 0;
      const commissionRate = 0.20;

      setMetrics(prev => ({
        ...prev,
        totalOrders: snap.size,
        totalRevenue: revenue,
        deliveredOrders: delivered,
        cancelledOrders: cancelled,
        pendingOrders: pending,
        avgOrderValue: avgOrder,
        totalDeliveryFees: deliveryFees,
        totalCommission: revenue * commissionRate,
      }));

      // Status data for pie chart
      setStatusData([
        { name: 'Delivered', value: delivered, fill: '#10B981' },
        { name: 'Cancelled', value: cancelled, fill: '#EF4444' },
        { name: 'Pending', value: pending, fill: '#F59E0B' },
      ]);

      // Top restaurants
      const topRest = Object.entries(restaurantStats)
        .map(([id, stats]) => ({ id, ...stats }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      setTopRestaurants(topRest);

      // Monthly chart
      const sortedMonthly = Object.values(monthlyAgg)
        .map(m => ({ ...m, customers: m.customers.size }))
        .sort((a, b) => months.indexOf(a.name) - months.indexOf(b.name));
      setMonthlyData(sortedMonthly.length > 0 ? sortedMonthly : months.slice(0, 6).map(m => ({ name: m, orders: 0, revenue: 0, customers: 0 })));

      // Hourly heatmap data
      const hourData = Array.from({ length: 24 }, (_, i) => ({
        hour: `${i.toString().padStart(2, '0')}:00`,
        orders: hourlyAgg[i] || 0,
      }));
      setHourlyData(hourData);

      setLoading(false);
    });

    return () => {
      unsubCustomers();
      unsubRestaurants();
      unsubDelivery();
      unsubOrders();
    };
  }, []);

  const handleExport = async () => {
    try {
      toast.promise(async () => {
        const snapshot = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const reportData = generateOrderReport(orders as any[]);
        exportToCSV(reportData, 'Platform_Analytics_Report');
      }, { loading: 'Generating report...', success: 'Report downloaded!', error: 'Failed to export' });
    } catch (e) { console.error(e); }
  };

  const fulfillmentRate = metrics.totalOrders > 0
    ? ((metrics.deliveredOrders / metrics.totalOrders) * 100).toFixed(1)
    : '0';

  const statCards = [
    { title: 'Total Revenue', value: `₹${metrics.totalRevenue.toLocaleString()}`, icon: IndianRupee, color: 'emerald', change: `₹${metrics.totalCommission.toLocaleString()} commission` },
    { title: 'Total Orders', value: metrics.totalOrders.toLocaleString(), icon: ShoppingCart, color: 'blue', change: `${metrics.pendingOrders} active now` },
    { title: 'Avg Order Value', value: `₹${metrics.avgOrderValue.toFixed(0)}`, icon: TrendingUp, color: 'purple', change: `${fulfillmentRate}% fulfillment` },
    { title: 'Customers', value: metrics.totalCustomers.toLocaleString(), icon: Users, color: 'orange', change: 'All registered' },
    { title: 'Restaurants', value: metrics.totalRestaurants.toLocaleString(), icon: Store, color: 'cyan', change: 'Active partners' },
    { title: 'Delivery Partners', value: metrics.totalDeliveryPartners.toLocaleString(), icon: Truck, color: 'pink', change: `${metrics.activeDeliveryPartners} active now • ₹${metrics.totalDriverPayouts.toLocaleString()} payouts` },
  ];

  const colorMap: Record<string, string> = {
    emerald: 'from-emerald-600/20 to-emerald-600/5 border-emerald-500/20',
    blue: 'from-blue-600/20 to-blue-600/5 border-blue-500/20',
    purple: 'from-purple-600/20 to-purple-600/5 border-purple-500/20',
    orange: 'from-orange-600/20 to-orange-600/5 border-orange-500/20',
    cyan: 'from-cyan-600/20 to-cyan-600/5 border-cyan-500/20',
    pink: 'from-pink-600/20 to-pink-600/5 border-pink-500/20',
  };

  const iconColorMap: Record<string, string> = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    cyan: 'text-cyan-400',
    pink: 'text-pink-400',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-gray-400 tracking-tight mb-2">
            Platform Analytics
          </h1>
          <p className="text-muted-foreground">Comprehensive insights across your entire platform.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-card/5 rounded-lg border border-border/50 p-0.5">
            {(['week', 'month', 'year'] as const).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 rounded-md text-xs font-medium transition-all capitalize ${dateRange === range
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                {range}
              </button>
            ))}
          </div>
          <Button
            onClick={handleExport}
            variant="outline"
            className="gap-2 bg-card/5 border-border/50 text-foreground hover:bg-card/10 hover:text-foreground"
          >
            <Download size={16} />
            Export
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className={`bg-gradient-to-br ${colorMap[stat.color]} border backdrop-blur-md shadow-xl overflow-hidden`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <Icon className={`w-5 h-5 ${iconColorMap[stat.color]}`} />
                  <Activity className="w-3 h-3 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold text-foreground font-mono">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{stat.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{stat.change}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revenue & Order Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-background/40 border-border/50 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-card/5 pb-4">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Revenue & Orders Trend
            </CardTitle>
            <CardDescription className="text-muted-foreground">Monthly breakdown</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 pl-0">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={monthlyData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#6B7280" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                <YAxis yAxisId="left" stroke="#6B7280" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} tickFormatter={(v) => `₹${v}`} />
                <YAxis yAxisId="right" orientation="right" stroke="#6B7280" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
                <Area yAxisId="left" type="monotone" dataKey="revenue" fill="url(#colorRev)" stroke="#10B981" strokeWidth={2} name="Revenue" />
                <Bar yAxisId="right" dataKey="orders" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={24} name="Orders" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-background/40 border-border/50 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-card/5 pb-4">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-blue-400" />
              Order Status Distribution
            </CardTitle>
            <CardDescription className="text-muted-foreground">All-time breakdown</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ color: '#9CA3AF', fontSize: 12, paddingTop: '20px' }}
                  formatter={(value) => <span className="text-muted-foreground">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Peak Hours & Customer Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-background/40 border-border/50 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-card/5 pb-4">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-400" />
              Peak Order Hours
            </CardTitle>
            <CardDescription className="text-muted-foreground">Hourly order volume</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 pl-0">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hourlyData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="hour" stroke="#6B7280" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} interval={2} />
                <YAxis stroke="#6B7280" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="orders" fill="#F59E0B" radius={[3, 3, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-background/40 border-border/50 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-card/5 pb-4">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              Customer Growth
            </CardTitle>
            <CardDescription className="text-muted-foreground">Monthly unique customers</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 pl-0">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={monthlyData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorCustomers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#6B7280" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                <YAxis stroke="#6B7280" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="customers" stroke="#8B5CF6" fill="url(#colorCustomers)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Restaurants & Top Partners */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-background/40 border-border/50 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-card/5 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-400" />
                Top Restaurants
              </CardTitle>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px]">By Revenue</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5">
              {topRestaurants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No restaurant data yet</div>
              ) : (
                topRestaurants.map((rest, i) => (
                  <div key={rest.id} className="flex items-center justify-between p-4 hover:bg-card/5 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-gray-400/20 text-muted-foreground' : i === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-card/5 text-muted-foreground'}`}>
                        #{i + 1}
                      </div>
                      <div>
                        <p className="text-foreground font-medium text-sm">{rest.name}</p>
                        <p className="text-muted-foreground text-xs">{rest.orders} orders</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 font-bold font-mono text-sm">₹{rest.revenue.toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background/40 border-border/50 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-card/5 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-400" />
                Top Delivery Partners
              </CardTitle>
              <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10 text-[10px]">
                {metrics.activeDeliveryPartners} Active Online
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5">
              {deliveryPartners.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No delivery partner data found</div>
              ) : (
                deliveryPartners.slice(0, 5).map((partner, i) => (
                  <div key={partner.id} className="flex items-center justify-between p-4 hover:bg-card/5 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-gray-400/20 text-muted-foreground' : i === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-card/5 text-muted-foreground'}`}>
                        #{i + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-foreground font-medium text-sm">{partner.name}</p>
                          <span className={`w-2 h-2 rounded-full ${
                            partner.status === 'online' ? 'bg-emerald-400 animate-pulse' :
                            partner.status === 'on_delivery' ? 'bg-amber-400' : 'bg-gray-600'
                          }`} />
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {partner.vehicle} • {partner.phone} • ⭐ {partner.rating.toFixed(1)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-400 font-bold font-mono text-sm">{partner.deliveries} orders</p>
                      <p className="text-emerald-400 text-xs font-mono font-medium">₹{partner.earnings.toLocaleString()} earned</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comprehensive Delivery Partners Fleet Details & Performance Section */}
      <Card className="bg-background/40 border-border/50 backdrop-blur-md shadow-xl overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-card/5 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Truck className="w-5 h-5" />
                </div>
                Delivery Partners Fleet Overview & Performance
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1">
                Real-time tracking of drivers, completed deliveries, 80% earnings payouts, and cash in hand.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/15 border-emerald-500/30 text-emerald-400 text-xs py-1 px-3">
                {metrics.activeDeliveryPartners} Drivers Online
              </Badge>
              <Badge className="bg-blue-500/15 border-blue-500/30 text-blue-400 text-xs py-1 px-3">
                {metrics.totalDeliveryPartners} Total Fleet
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Fleet Performance Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-card/5 border border-border/50">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Total Fleet Size</span>
              <p className="text-2xl font-black text-foreground mt-1 font-mono">{metrics.totalDeliveryPartners}</p>
              <span className="text-[11px] text-emerald-400 mt-0.5 block">{metrics.activeDeliveryPartners} currently active</span>
            </div>
            <div className="p-4 rounded-2xl bg-card/5 border border-border/50">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Completed Deliveries</span>
              <p className="text-2xl font-black text-blue-400 mt-1 font-mono">
                {deliveryPartners.reduce((acc, p) => acc + p.deliveries, 0)}
              </p>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">Total dropped orders</span>
            </div>
            <div className="p-4 rounded-2xl bg-card/5 border border-border/50">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Total Driver Payouts</span>
              <p className="text-2xl font-black text-emerald-400 mt-1 font-mono">
                ₹{metrics.totalDriverPayouts.toLocaleString()}
              </p>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">80% delivery fee share</span>
            </div>
            <div className="p-4 rounded-2xl bg-card/5 border border-border/50">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Driver Cash in Hand</span>
              <p className="text-2xl font-black text-amber-400 mt-1 font-mono">
                ₹{metrics.totalDriverCashInHand.toLocaleString()}
              </p>
              <span className="text-[11px] text-amber-300/70 mt-0.5 block">Pending COD collections</span>
            </div>
          </div>

          {/* Delivery Partners Table */}
          <div className="overflow-x-auto rounded-xl border border-border/50">
            <table className="w-full text-left text-sm text-muted-foreground">
              <thead className="bg-card/5 text-xs uppercase tracking-wider text-muted-foreground border-b border-border/50">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Driver</th>
                  <th className="py-3.5 px-4 font-semibold">Contact & Phone</th>
                  <th className="py-3.5 px-4 font-semibold">Vehicle</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">KYC</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Deliveries</th>
                  <th className="py-3.5 px-4 font-semibold text-right">80% Earnings</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Cash / Dues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {deliveryPartners.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground">
                      No delivery partners registered in the platform yet.
                    </td>
                  </tr>
                ) : (
                  deliveryPartners.map((partner) => (
                    <tr key={partner.id} className="hover:bg-card/5 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-foreground flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {partner.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground leading-tight">{partner.name}</p>
                          <span className="text-[11px] text-muted-foreground font-mono">ID: {partner.id.slice(0, 8)}...</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground font-mono text-xs">
                        {partner.phone}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground text-xs">
                        <span className="capitalize">{partner.vehicle}</span>
                        {partner.vehicleNumber && partner.vehicleNumber !== 'N/A' && (
                          <span className="block text-[10px] text-muted-foreground font-mono">{partner.vehicleNumber}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          partner.status === 'online'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : partner.status === 'on_delivery'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-secondary text-muted-foreground border border-border/50'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            partner.status === 'online' ? 'bg-emerald-400' :
                            partner.status === 'on_delivery' ? 'bg-amber-400' : 'bg-gray-500'
                          }`} />
                          {partner.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant="outline" className={`text-[10px] uppercase font-bold ${
                          partner.kycStatus === 'approved'
                            ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                            : 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'
                        }`}>
                          {partner.kycStatus || 'pending'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground">
                        {partner.deliveries}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                        ₹{partner.earnings.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-amber-300">
                        ₹{partner.cashInHand.toFixed(0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
