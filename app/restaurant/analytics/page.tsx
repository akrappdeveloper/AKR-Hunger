'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, MenuItem } from '@/lib/types';
import {
  TrendingUp, Users, ShoppingCart, Award, Download,
  Calendar, DollarSign, Package, BarChart3, PieChart,
  Clock, Activity
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart as RePieChart, Pie, Legend,
  LineChart, Line
} from 'recharts';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1
  }
};

// Custom Tooltip for Charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/90 border border-slate-700 p-3 rounded-lg shadow-xl backdrop-blur-md">
        <p className="font-semibold text-slate-100 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-300 capitalize">{entry.name}:</span>
            <span className="font-bold text-white">
              {entry.name === 'revenue' ? `₹${entry.value}` : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function RestaurantAnalyticsPage() {
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/restaurant/login');
      return;
    }
    fetchAnalyticsData();
  }, [user, authLoading, router, dateRange]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);

      const now = new Date();
      let startDate = new Date();

      if (dateRange === 'week') {
        startDate.setDate(now.getDate() - 7);
      } else if (dateRange === 'month') {
        startDate.setMonth(now.getMonth() - 1);
      } else if (dateRange === 'year') {
        startDate.setFullYear(now.getFullYear() - 1);
      }

      // Fetch orders
      const ordersRef = collection(db, 'orders');
      const ordersQuery = query(
        ordersRef,
        where('restaurantId', '==', user!.uid),
        where('createdAt', '>=', startDate),
        orderBy('createdAt', 'asc') // Fetch ascending for timeline charts
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersList = ordersSnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as Order[];
      setOrders(ordersList);

      // Fetch menu items
      const menuRef = collection(db, 'menuItems');
      const menuQuery = query(menuRef, where('restaurantId', '==', user!.uid));
      const menuSnapshot = await getDocs(menuQuery);
      const menuList = menuSnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as MenuItem[];
      setMenuItems(menuList);
    } catch (error) {
      console.error('[Analytics] Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const metrics = useMemo(() => {
    const deliveredOrders = orders.filter((o) => o.status === 'delivered');
    const totalRevenue = deliveredOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const avgOrderValue = deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0;
    const uniqueCustomers = new Set(orders.map((o) => o.customerId)).size;

    // Timeline Data (Revenue & Orders per day)
    const timelineMap: { [key: string]: { date: string; revenue: number; orders: number } } = {};
    orders.forEach((order) => {
      const date = new Date(order.createdAt?.seconds ? order.createdAt.seconds * 1000 : order.createdAt!);
      const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      if (!timelineMap[dateKey]) {
        timelineMap[dateKey] = { date: dateKey, revenue: 0, orders: 0 };
      }
      timelineMap[dateKey].orders += 1;
      if (order.status === 'delivered') {
        timelineMap[dateKey].revenue += (order.total || 0);
      }
    });
    const timelineData = Object.values(timelineMap);

    // Peak Hours Analysis
    const hoursMap = new Array(24).fill(0).map((_, i) => ({ hour: i, count: 0 }));
    orders.forEach((order) => {
      const date = new Date(order.createdAt?.seconds ? order.createdAt.seconds * 1000 : order.createdAt!);
      const hour = date.getHours();
      hoursMap[hour].count += 1;
    });
    const peakHoursData = hoursMap.map(h => ({
      name: `${h.hour}:00`,
      orders: h.count
    }));

    // Best Selling Items
    const itemSales: { [key: string]: { name: string; count: number; revenue: number } } = {};
    orders.forEach((order) => {
      order.items?.forEach((item) => {
        const key = item.menuItemId || item.name;
        if (!itemSales[key]) {
          itemSales[key] = { name: item.name, count: 0, revenue: 0 };
        }
        itemSales[key].count += item.quantity || 1;
        itemSales[key].revenue += item.price * (item.quantity || 1);
      });
    });

    const topItems = Object.values(itemSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Order Status Distribution
    const statusCounts = {
      delivered: 0,
      cancelled: 0,
      pending: 0,
      others: 0
    };
    orders.forEach(o => {
      if (o.status === 'delivered') statusCounts.delivered++;
      else if (o.status === 'cancelled') statusCounts.cancelled++;
      else if (['pending', 'confirmed', 'preparing', 'ready'].includes(o.status || '')) statusCounts.pending++;
      else statusCounts.others++;
    });

    const statusData = [
      { name: 'Delivered', value: statusCounts.delivered, color: '#10b981' }, // green-500
      { name: 'Pending', value: statusCounts.pending, color: '#f59e0b' },   // amber-500
      { name: 'Cancelled', value: statusCounts.cancelled, color: '#ef4444' }, // red-500
    ].filter(d => d.value > 0);

    return {
      totalOrders: orders.length,
      deliveredOrders: deliveredOrders.length,
      totalRevenue,
      avgOrderValue,
      uniqueCustomers,
      topItems,
      timelineData,
      peakHoursData,
      statusData,
      cancelledOrders: statusCounts.cancelled,
      pendingOrders: statusCounts.pending,
      fulfillmentRate: orders.length > 0 ? (deliveredOrders.length / orders.length) * 100 : 0
    };
  }, [orders]);

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

  const downloadReport = (format: 'csv' | 'json') => {
    // Basic implementation for download logic re-use
    const data = {
      restaurant: restaurant?.name,
      date: new Date().toISOString(),
      range: dateRange,
      metrics
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${dateRange}.json`;
      a.click();
    } else {
      // CSV logic simplified for brevity but functional
      let csv = `Metric,Value\nTotal Revenue,${metrics.totalRevenue}\nTotal Orders,${metrics.totalOrders}\n`;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${dateRange}.csv`;
      a.click();
    }
  };

  if (authLoading || loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-4 md:p-8 space-y-8 min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
    >
      {/* Header Section */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-3">
            <BarChart3 className="w-10 h-10 text-teal-400" />
            Analytics Hub
          </h1>
          <p className="text-slate-400 mt-2 text-lg">Real-time insights for <span className="text-white font-semibold">{restaurant?.name}</span></p>
        </div>

        <div className="flex items-center gap-3 bg-slate-900/50 p-1.5 rounded-xl border border-slate-800 backdrop-blur-md">
          {(['week', 'month', 'year'] as const).map((range) => (
            <Button
              key={range}
              variant={dateRange === range ? 'default' : 'ghost'}
              onClick={() => setDateRange(range)}
              className={`capitalize px-6 rounded-lg transition-all duration-300 ${dateRange === range
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              {range}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* Generate Reports - Moved to Top */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gradient-to-r from-violet-600/20 via-blue-600/20 to-cyan-600/20 border-blue-500/20 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <Download className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Download Reports</h3>
                <p className="text-slate-400 text-sm">Export your analytics data for offline analysis</p>
              </div>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button onClick={() => downloadReport('csv')} variant="outline" className="flex-1 sm:flex-none border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-white gap-2">
                <Download className="w-4 h-4" /> CSV
              </Button>
              <Button onClick={() => downloadReport('json')} className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg gap-2 font-semibold">
                <Download className="w-4 h-4" /> JSON
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main KPI Cards - Vibrant & Colorful */}
      <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            title: 'Total Revenue',
            value: `₹${metrics.totalRevenue.toLocaleString()}`,
            icon: DollarSign,
            gradient: 'from-emerald-600 to-teal-600',
            sub: `Avg. Order: ₹${metrics.avgOrderValue.toFixed(0)}`
          },
          {
            title: 'Total Orders',
            value: metrics.totalOrders,
            icon: ShoppingCart,
            gradient: 'from-blue-600 to-indigo-600',
            sub: `${metrics.deliveredOrders} Completed`
          },
          {
            title: 'Customers',
            value: metrics.uniqueCustomers,
            icon: Users,
            gradient: 'from-violet-600 to-purple-600',
            sub: 'Unique This Period'
          },
          {
            title: 'Success Rate',
            value: `${metrics.fulfillmentRate.toFixed(1)}%`,
            icon: Activity,
            gradient: 'from-orange-500 to-rose-600',
            sub: `${metrics.cancelledOrders} Cancelled`
          },
        ].map((stat, i) => (
          <motion.div key={i} variants={itemVariants}>
            <Card className={`border-none shadow-xl overflow-hidden relative bg-gradient-to-br ${stat.gradient}`}>
              <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-white/80">{stat.title}</p>
                    <h3 className="text-3xl font-bold text-white mt-2 drop-shadow-md">
                      {stat.value}
                    </h3>
                  </div>
                  <div className="p-3 rounded-xl bg-white/20 backdrop-blur-md shadow-inner text-white">
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm text-white/90">
                  <div className="px-2 py-0.5 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-md">
                    {stat.sub}
                  </div>
                </div>
              </CardContent>
              {/* Decorative Circle */}
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-black/10" />
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Tabs Section */}
      <Tabs defaultValue="overview" className="space-y-8">
        <div className="flex justify-center">
          <TabsList className="bg-slate-900/60 border border-slate-800 p-1 h-auto rounded-full backdrop-blur-md">
            {[
              { value: 'overview', label: 'Overview', icon: BarChart3 },
              { value: 'sales', label: 'Sales & Trends', icon: TrendingUp },
              { value: 'menu', label: 'Menu Performance', icon: Package },
              { value: 'customers', label: 'Customer Insights', icon: Users },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-full px-6 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white text-slate-400 gap-2 transition-all"
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Chart */}
            <motion.div variants={itemVariants} className="lg:col-span-2">
              <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl h-full">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    Revenue Trend
                  </CardTitle>
                  <CardDescription className="text-slate-400">Income over selected period</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.timelineData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.4} />
                      <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Order Status Pie Chart */}
            <motion.div variants={itemVariants}>
              <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl h-full">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-purple-400" />
                    Order Status
                  </CardTitle>
                  <CardDescription className="text-slate-400">Distribution by status</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={metrics.statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {metrics.statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ color: '#94a3b8' }} />
                    </RePieChart>
                  </ResponsiveContainer>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pb-8">
                    <p className="text-2xl font-bold text-white">{metrics.totalOrders}</p>
                    <p className="text-xs text-slate-400 uppercase tracking-widest">Total</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* SALES TAB */}
        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Peak Hours Chart */}
            <motion.div variants={itemVariants}>
              <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    Peak Business Hours
                  </CardTitle>
                  <CardDescription className="text-slate-400">Order traffic by hour of day</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.peakHoursData}>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} interval={2} />
                      <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                        {metrics.peakHoursData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.orders > 5 ? '#60a5fa' : '#1e40af'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Daily Orders Trend */}
            <motion.div variants={itemVariants}>
              <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Order Volume Trend
                  </CardTitle>
                  <CardDescription className="text-slate-400">Daily order count</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics.timelineData}>
                      <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.4} />
                      <Line type="monotone" dataKey="orders" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* MENU TAB */}
        <TabsContent value="menu" className="space-y-6">
          <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Items Table */}
            <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-400" />
                  Best Sellers
                </CardTitle>
                <CardDescription className="text-slate-400">Top 5 items by revenue</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.topItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-800 transition">
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-900 ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-slate-300' : 'bg-orange-400'}`}>
                          {i + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{item.name}</p>
                          <p className="text-xs text-slate-400">{item.count} orders</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-400">₹{item.revenue}</p>
                        <p className="text-xs text-slate-500">Revenue</p>
                      </div>
                    </div>
                  ))}
                  {metrics.topItems.length === 0 && (
                    <p className="text-center text-slate-500 py-8">No sales data recorded yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Menu Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-slate-800 bg-slate-900/60 flex flex-col justify-center items-center p-6 text-center">
                <Package className="w-8 h-8 text-blue-400 mb-2" />
                <h3 className="text-3xl font-bold text-white">{menuItems.length}</h3>
                <p className="text-sm text-slate-400">Total Items</p>
              </Card>
              <Card className="border-slate-800 bg-slate-900/60 flex flex-col justify-center items-center p-6 text-center">
                <span className="text-3xl mb-2">🥬</span>
                <h3 className="text-3xl font-bold text-white">{menuItems.filter(m => m.vegetarian).length}</h3>
                <p className="text-sm text-slate-400">Veg Options</p>
              </Card>
              <Card className="border-slate-800 bg-slate-900/60 flex flex-col justify-center items-center p-6 text-center">
                <DollarSign className="w-8 h-8 text-emerald-400 mb-2" />
                <h3 className="text-2xl font-bold text-white">
                  ₹{menuItems.length ? (menuItems.reduce((acc, i) => acc + (i.price || 0), 0) / menuItems.length).toFixed(0) : 0}
                </h3>
                <p className="text-sm text-slate-400">Avg. Item Price</p>
              </Card>
              <Card className="border-slate-800 bg-slate-900/60 flex flex-col justify-center items-center p-6 text-center">
                <Activity className="w-8 h-8 text-rose-400 mb-2" />
                <h3 className="text-2xl font-bold text-white">
                  {menuItems.filter(m => m.isBestSeller).length}
                </h3>
                <p className="text-sm text-slate-400">Marked Best Sellers</p>
              </Card>
            </div>
          </motion.div>
        </TabsContent>

        {/* CUSTOMERS TAB */}
        <TabsContent value="customers" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-slate-800 bg-gradient-to-br from-slate-900/80 to-purple-900/20 backdrop-blur-xl p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400">
                  <Users className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Unique Customers</p>
                  <h3 className="text-3xl font-bold text-white">{metrics.uniqueCustomers}</h3>
                </div>
              </div>
            </Card>
            <Card className="border-slate-800 bg-gradient-to-br from-slate-900/80 to-emerald-900/20 backdrop-blur-xl p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400">
                  <DollarSign className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Revenue / Customer</p>
                  <h3 className="text-3xl font-bold text-white">
                    ₹{metrics.uniqueCustomers ? (metrics.totalRevenue / metrics.uniqueCustomers).toFixed(0) : 0}
                  </h3>
                </div>
              </div>
            </Card>
            <Card className="border-slate-800 bg-gradient-to-br from-slate-900/80 to-blue-900/20 backdrop-blur-xl p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
                  <ShoppingCart className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Orders / Customer</p>
                  <h3 className="text-3xl font-bold text-white">
                    {metrics.uniqueCustomers ? (metrics.totalOrders / metrics.uniqueCustomers).toFixed(1) : 0}
                  </h3>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
