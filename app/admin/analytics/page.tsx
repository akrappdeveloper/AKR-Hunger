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
  deliveredOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  avgOrderValue: number;
  totalDeliveryFees: number;
  totalCommission: number;
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

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black/90 border border-white/10 p-3 rounded-xl shadow-2xl backdrop-blur-md">
        <p className="font-semibold text-white mb-2 text-sm">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
            <span className="text-gray-400 capitalize">{entry.name}:</span>
            <span className="font-bold text-white font-mono">
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
    totalRestaurants: 0, totalDeliveryPartners: 0,
    deliveredOrders: 0, cancelledOrders: 0, pendingOrders: 0,
    avgOrderValue: 0, totalDeliveryFees: 0, totalCommission: 0,
  });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [topRestaurants, setTopRestaurants] = useState<TopRestaurant[]>([]);
  const [topPartners, setTopPartners] = useState<TopDeliveryPartner[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    // Listen to customers count
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      setMetrics(prev => ({ ...prev, totalCustomers: snap.size }));
    });

    // Listen to restaurants
    const unsubRestaurants = onSnapshot(collection(db, 'restaurants'), (snap) => {
      const restaurants = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMetrics(prev => ({ ...prev, totalRestaurants: snap.size }));
    });

    // Listen to delivery partners
    const unsubDelivery = onSnapshot(collection(db, 'delivery_partners'), (snap) => {
      const partners = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setMetrics(prev => ({ ...prev, totalDeliveryPartners: snap.size }));

      // Process top delivery partners
      const sorted = partners
        .map(p => ({
          id: p.id,
          name: p.name || 'Unknown',
          deliveries: p.completedDeliveries || 0,
          rating: p.rating || 0,
        }))
        .sort((a, b) => b.deliveries - a.deliveries)
        .slice(0, 5);
      setTopPartners(sorted);
    });

    // Listen to all orders
    const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
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
    { title: 'Delivery Partners', value: metrics.totalDeliveryPartners.toLocaleString(), icon: Truck, color: 'pink', change: 'Registered drivers' },
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
          <p className="text-gray-400">Loading analytics...</p>
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
          <p className="text-gray-400">Comprehensive insights across your entire platform.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/5 rounded-lg border border-white/10 p-0.5">
            {(['week', 'month', 'year'] as const).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 rounded-md text-xs font-medium transition-all capitalize ${dateRange === range
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                {range}
              </button>
            ))}
          </div>
          <Button
            onClick={handleExport}
            variant="outline"
            className="gap-2 bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
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
                  <Activity className="w-3 h-3 text-gray-600" />
                </div>
                <p className="text-2xl font-bold text-white font-mono">{stat.value}</p>
                <p className="text-[11px] text-gray-400 mt-1">{stat.title}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{stat.change}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revenue & Order Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-black/40 border-white/10 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Revenue & Orders Trend
            </CardTitle>
            <CardDescription className="text-gray-500">Monthly breakdown</CardDescription>
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

        <Card className="bg-black/40 border-white/10 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-blue-400" />
              Order Status Distribution
            </CardTitle>
            <CardDescription className="text-gray-500">All-time breakdown</CardDescription>
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
                  formatter={(value) => <span className="text-gray-300">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Peak Hours & Customer Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-black/40 border-white/10 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-400" />
              Peak Order Hours
            </CardTitle>
            <CardDescription className="text-gray-500">Hourly order volume</CardDescription>
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

        <Card className="bg-black/40 border-white/10 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              Customer Growth
            </CardTitle>
            <CardDescription className="text-gray-500">Monthly unique customers</CardDescription>
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
        <Card className="bg-black/40 border-white/10 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-400" />
                Top Restaurants
              </CardTitle>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px]">By Revenue</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5">
              {topRestaurants.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">No restaurant data yet</div>
              ) : (
                topRestaurants.map((rest, i) => (
                  <div key={rest.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-gray-400/20 text-gray-300' : i === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-gray-500'}`}>
                        #{i + 1}
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{rest.name}</p>
                        <p className="text-gray-500 text-xs">{rest.orders} orders</p>
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

        <Card className="bg-black/40 border-white/10 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-400" />
                Top Delivery Partners
              </CardTitle>
              <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10 text-[10px]">By Deliveries</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5">
              {topPartners.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">No delivery data yet</div>
              ) : (
                topPartners.map((partner, i) => (
                  <div key={partner.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-gray-400/20 text-gray-300' : i === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-gray-500'}`}>
                        #{i + 1}
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{partner.name}</p>
                        <p className="text-gray-500 text-xs">⭐ {partner.rating.toFixed(1)} rating</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-400 font-bold font-mono text-sm">{partner.deliveries}</p>
                      <p className="text-gray-600 text-[10px]">deliveries</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
