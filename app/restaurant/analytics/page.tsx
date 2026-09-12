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
  Calendar, DollarSign, Package, BarChart3, PieChart as PieChartIcon,
  Clock, Activity, Sparkles, ArrowUpRight, ArrowDownRight, Zap, Lightbulb,
  Target, AlertCircle
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend,
  LineChart, Line, RadialBarChart, RadialBar, ComposedChart
} from 'recharts';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';

// --- Animation Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

// --- Custom Components ---

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 border border-border p-3 rounded-xl shadow-xl backdrop-blur-md text-card-foreground">
        <p className="font-semibold text-foreground mb-2 text-sm">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill || entry.color }} />
            <span className="text-muted-foreground capitalize">{entry.name}:</span>
            <span className="font-bold text-foreground font-mono">
              {entry.name === 'revenue' ? `₹${entry.value}` : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// --- Main Page Component ---

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

      if (dateRange === 'week') startDate.setDate(now.getDate() - 7);
      else if (dateRange === 'month') startDate.setMonth(now.getMonth() - 1);
      else if (dateRange === 'year') startDate.setFullYear(now.getFullYear() - 1);

      // Fetch Orders
      const ordersRef = collection(db, 'orders');
      const ordersQuery = query(
        ordersRef,
        where('restaurantId', '==', user!.uid),
        where('createdAt', '>=', startDate),
        orderBy('createdAt', 'asc')
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersList = ordersSnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as Order[];
      setOrders(ordersList);

      // Fetch Menu Items
      const menuRef = collection(db, 'menuItems');
      const menuQuery = query(menuRef, where('restaurantId', '==', user!.uid));
      const menuSnapshot = await getDocs(menuQuery);
      const menuList = menuSnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as MenuItem[];
      setMenuItems(menuList);

    } catch (error) {
      console.error('[Analytics] Error:', error);
      toast.error("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  // --- Metrics Calculation & Insights Engine ---
  const { metrics, insights } = useMemo(() => {
    const deliveredOrders = orders.filter((o) => o.status === 'delivered');
    const totalRevenue = deliveredOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const avgOrderValue = deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0;
    const uniqueCustomers = new Set(orders.map((o) => o.customerId)).size;

    // Timeline Data
    const timelineMap: Record<string, any> = {};
    orders.forEach((order) => {
      const date = new Date(order.createdAt?.seconds ? order.createdAt.seconds * 1000 : order.createdAt as any);
      const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!timelineMap[dateKey]) timelineMap[dateKey] = { date: dateKey, revenue: 0, orders: 0 };
      timelineMap[dateKey].orders += 1;
      if (order.status === 'delivered') timelineMap[dateKey].revenue += (order.total || 0);
    });
    const timelineData = Object.values(timelineMap);

    // Peak Hours
    const hoursMap = new Array(24).fill(0).map((_, i) => ({ hour: i, count: 0 }));
    orders.forEach((order) => {
      const date = new Date(order.createdAt?.seconds ? order.createdAt.seconds * 1000 : order.createdAt as any);
      hoursMap[date.getHours()].count += 1;
    });
    const peakHoursData = hoursMap.map(h => ({ name: `${h.hour}:00`, orders: h.count }));

    // Item Sales Logic
    const itemSales: Record<string, any> = {};
    const categorySales: Record<string, number> = {};

    orders.forEach((order) => {
      order.items?.forEach((item) => {
        const key = item.menuItemId || item.name;
        if (!itemSales[key]) itemSales[key] = { name: item.name, count: 0, revenue: 0 };
        itemSales[key].count += (item.quantity || 1);
        itemSales[key].revenue += item.price * (item.quantity || 1);

        // Mock Category logic (since it might not be on item directly, we infer or use random for demo if missing)
        // In real app, menuItem would have category. Let's assume we can map it from menuItems state if needed, or simple mock
        const category = menuItems.find(m => m.id === item.menuItemId)?.category || 'Other';
        categorySales[category] = (categorySales[category] || 0) + 1;
      });
    });

    const topItems = Object.values(itemSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const categoryData = Object.entries(categorySales).map(([name, value]) => ({ name, value }));

    // Status Distribution
    const statusCounts = { delivered: 0, cancelled: 0, pending: 0 };
    orders.forEach(o => {
      if (o.status === 'delivered') statusCounts.delivered++;
      else if (o.status === 'cancelled') statusCounts.cancelled++;
      else statusCounts.pending++;
    });

    const fulfillmentRate = orders.length > 0 ? (statusCounts.delivered / orders.length) * 100 : 0;
    const cancelRate = orders.length > 0 ? (statusCounts.cancelled / orders.length) * 100 : 0;

    // --- Smart Insights Generation ---
    const generatedInsights = [];

    if (totalRevenue > 5000) {
      generatedInsights.push({
        type: 'positive',
        title: 'Revenue Milestone',
        description: 'You crossed ₹5k revenue this period! Great growth.',
        icon: TrendingUp
      });
    }

    if (cancelRate > 15) {
      generatedInsights.push({
        type: 'negative',
        title: 'High Cancellation Rate',
        description: `Cancellations are at ${cancelRate.toFixed(1)}%. Check your inventory or prep times.`,
        icon: AlertCircle
      });
    }

    if (avgOrderValue > 400) {
      generatedInsights.push({
        type: 'positive',
        title: 'High Ticket Size',
        description: `Avg order value is healthy at ₹${avgOrderValue.toFixed(0)}. Keep upselling!`,
        icon: DollarSign
      });
    } else {
      generatedInsights.push({
        type: 'neutral',
        title: 'Upsell Opportunity',
        description: 'Try creating combo meals to boost ticket size.',
        icon: Lightbulb
      });
    }

    // Peak hour insight
    const busiestHour = peakHoursData.reduce((max, curr) => curr.orders > max.orders ? curr : max, { orders: 0, name: '' });
    if (busiestHour.orders > 0) {
      generatedInsights.push({
        type: 'info',
        title: 'Peak Time Alert',
        description: `Expect a rush around ${busiestHour.name}. Staff up accordingly.`,
        icon: Clock
      });
    }

    return {
      metrics: {
        totalOrders: orders.length,
        deliveredOrders: deliveredOrders.length,
        totalRevenue,
        avgOrderValue,
        uniqueCustomers,
        topItems,
        timelineData,
        peakHoursData,
        categoryData,
        statusCounts,
        fulfillmentRate
      },
      insights: generatedInsights
    };
  }, [orders, menuItems]);

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'];

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Spinner className="w-12 h-12 text-primary mx-auto" />
          <p className="text-muted-foreground animate-pulse font-medium">Analyzing Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto font-sans transition-colors duration-300">

      {/* Header */}
      <motion.div
        initial="hidden" animate="visible" variants={containerVariants}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border"
      >
        <div>
          <motion.h1 variants={itemVariants} className="text-3xl sm:text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 mb-2">
            Performance Hub
          </motion.h1>
          <motion.p variants={itemVariants} className="text-muted-foreground text-base sm:text-lg">
            Real-time business intelligence for your restaurant
          </motion.p>
        </div>

        <motion.div variants={itemVariants} className="flex bg-muted/80 p-1 rounded-full border border-border backdrop-blur-md">
          {(['week', 'month', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${dateRange === range
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </motion.div>
      </motion.div>

      {/* Smart Insights Panel */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h2 className="text-xl font-bold text-foreground">Smart Insights</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {insights.map((insight, idx) => (
            <Card key={idx} className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-4 flex gap-4 items-start">
                <div className={`p-2.5 rounded-xl shrink-0 ${insight.type === 'positive' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                    insight.type === 'negative' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' :
                      'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                  }`}>
                  <insight.icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground text-sm">{insight.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Revenue', value: `₹${metrics.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500', sub: 'Gross income' },
          { label: 'Total Orders', value: metrics.totalOrders, icon: ShoppingCart, color: 'text-blue-500', sub: `${metrics.fulfillmentRate.toFixed(0)}% Fulfilled` },
          { label: 'Avg Order Value', value: `₹${metrics.avgOrderValue.toFixed(0)}`, icon: Target, color: 'text-purple-500', sub: 'Per customer' },
          { label: 'Active Customers', value: metrics.uniqueCustomers, icon: Users, color: 'text-amber-500', sub: 'Unique users' },
        ].map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + idx * 0.1 }}
          >
            <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
              <div className={`absolute top-0 right-0 p-20 bg-gradient-to-br ${idx === 0 ? 'from-emerald-500/10' : idx === 1 ? 'from-blue-500/10' : idx === 2 ? 'from-purple-500/10' : 'from-amber-500/10'
                } to-transparent blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity`} />

              <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl bg-muted/60 border border-border ${stat.color}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  {/* Trend Indicator */}
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold gap-1">
                    <ArrowUpRight className="w-3 h-3" /> 12%
                  </Badge>
                </div>
                <div>
                  <h3 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">{stat.value}</h3>
                  <p className="text-sm font-medium text-muted-foreground mt-1">{stat.label}</p>
                  <p className="text-xs text-muted-foreground/80 mt-2">{stat.sub}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <div className="flex justify-center mb-8">
          <TabsList className="bg-muted/80 border border-border rounded-full p-1">
            {['overview', 'trends', 'menu', 'customers'].map(tab => (
              <TabsTrigger key={tab} value={tab} className="rounded-full px-6 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Chart */}
            <Card className="lg:col-span-2 bg-card border-border text-card-foreground shadow-sm">
              <CardHeader>
                <CardTitle className="text-foreground font-bold">Revenue Analytics</CardTitle>
                <CardDescription className="text-muted-foreground">Income trend over selected period</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.timelineData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-15" vertical={false} />
                    <XAxis dataKey="date" stroke="currentColor" className="opacity-60" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="currentColor" className="opacity-60" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card className="bg-card border-border text-card-foreground shadow-sm">
              <CardHeader>
                <CardTitle className="text-foreground font-bold">Order Logic</CardTitle>
                <CardDescription className="text-muted-foreground">Fulfillment & Status</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Delivered', value: metrics.statusCounts.delivered, color: '#10b981' },
                        { name: 'Pending', value: metrics.statusCounts.pending, color: '#f59e0b' },
                        { name: 'Cancelled', value: metrics.statusCounts.cancelled, color: '#ef4444' }
                      ]}
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {[
                        { name: 'Delivered', value: metrics.statusCounts.delivered, color: '#10b981' },
                        { name: 'Pending', value: metrics.statusCounts.pending, color: '#f59e0b' },
                        { name: 'Cancelled', value: metrics.statusCounts.cancelled, color: '#ef4444' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-extrabold text-foreground">{metrics.totalOrders}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Orders</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card className="bg-card border-border text-card-foreground shadow-sm">
            <CardHeader>
              <CardTitle className="text-foreground font-bold">Peak Business Hours</CardTitle>
              <CardDescription className="text-muted-foreground">When do your customers order the most?</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.peakHoursData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-15" vertical={false} />
                  <XAxis dataKey="name" stroke="currentColor" className="opacity-60" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="currentColor" className="opacity-60" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                    {metrics.peakHoursData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.orders > 5 ? '#a855f7' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="menu" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Items */}
            <Card className="bg-card border-border text-card-foreground shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground font-bold">
                  <Award className="w-5 h-5 text-amber-500" /> Top Performing Items
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {metrics.topItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border hover:bg-muted/70 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-black ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-gray-300' : 'bg-orange-500 text-white'
                        }`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.count} orders</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">₹{item.revenue}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Category Performance */}
            <Card className="bg-card border-border text-card-foreground shadow-sm">
              <CardHeader>
                <CardTitle className="text-foreground font-bold">Sales by Category</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {metrics.categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent border-border shadow-sm">
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 mx-auto text-blue-500 mb-4" />
                <h3 className="text-4xl font-extrabold text-foreground mb-2">{metrics.uniqueCustomers}</h3>
                <p className="text-muted-foreground font-medium">Total Unique Customers</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-transparent border-border shadow-sm">
              <CardContent className="p-8 text-center">
                <Target className="w-12 h-12 mx-auto text-purple-500 mb-4" />
                <h3 className="text-4xl font-extrabold text-foreground mb-2">₹{(metrics.totalRevenue / metrics.uniqueCustomers || 0).toFixed(0)}</h3>
                <p className="text-muted-foreground font-medium">Revenue per Customer (LTV)</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-transparent border-border shadow-sm">
              <CardContent className="p-8 text-center">
                <Package className="w-12 h-12 mx-auto text-teal-500 mb-4" />
                <h3 className="text-4xl font-extrabold text-foreground mb-2">{(metrics.totalOrders / metrics.uniqueCustomers || 0).toFixed(1)}</h3>
                <p className="text-muted-foreground font-medium">Orders per Customer</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
