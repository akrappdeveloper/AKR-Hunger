'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, MenuItem } from '@/lib/types';
import {
  TrendingUp, Users, ShoppingCart, Award, Download,
  Calendar, DollarSign, Package, BarChart3, PieChart as PieChartIcon,
  Clock, Activity, Sparkles, ArrowUpRight, ArrowDownRight, Zap, Lightbulb,
  Target, AlertCircle, CheckCircle2, XCircle, Hourglass, Utensils,
  ChevronRight, ArrowRight, Filter, Search, Trophy, Wallet, Percent,
  Layers, RefreshCw, ChefHat, Bike, ShieldCheck, FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';

// --- Types ---
interface MenuItemStat {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  imageUrl?: string;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  totalSale: number;
  totalPlatformFee: number;
  netEarnings: number;
  fulfillmentRate: number;
  rank: number;
}

// --- Animation Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { y: 15, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

// --- Custom Tooltip ---
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 border border-border p-3.5 rounded-2xl shadow-2xl backdrop-blur-md text-card-foreground min-w-[170px]">
        <p className="font-bold text-foreground mb-2 text-xs border-b border-border/50 pb-1.5">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-3 text-xs py-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.fill || entry.color }} />
              <span className="text-muted-foreground capitalize text-[11px]">{entry.name}:</span>
            </div>
            <span className="font-bold text-foreground font-mono">
              {['revenue', 'sales', 'platformFee', 'netPayout', 'grossSales'].includes(entry.dataKey)
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

export default function RestaurantAnalyticsPage() {
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month');

  // Menu table controls
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [menuSortBy, setMenuSortBy] = useState<'sales' | 'orders' | 'delivered' | 'cancelled' | 'net'>('sales');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/restaurant/login');
      return;
    }
    fetchAnalyticsData();
  }, [user, restaurant, authLoading, router]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);

      const targetIds = Array.from(new Set([
        user?.uid,
        (user as any)?.restaurantId,
        restaurant?.id
      ].filter(Boolean))) as string[];

      // Fetch all orders for this restaurant across all possible restaurantIds
      const ordersMap = new Map<string, Order>();
      for (const tid of targetIds) {
        const ordersRef = collection(db, 'orders');
        const ordersQuery = query(ordersRef, where('restaurantId', '==', tid));
        const ordersSnapshot = await getDocs(ordersQuery);
        ordersSnapshot.docs.forEach((doc) => {
          ordersMap.set(doc.id, {
            ...doc.data(),
            id: doc.id,
          } as Order);
        });
      }
      const ordersList = Array.from(ordersMap.values());
      setOrders(ordersList);

      // Fetch Menu Items from Firestore
      const menuMap = new Map<string, MenuItem>();
      for (const tid of targetIds) {
        const menuRef = collection(db, 'menuItems');
        const menuQuery = query(menuRef, where('restaurantId', '==', tid));
        const menuSnapshot = await getDocs(menuQuery);
        menuSnapshot.docs.forEach((doc) => {
          menuMap.set(doc.id, {
            ...doc.data(),
            id: doc.id,
          } as MenuItem);
        });
      }
      setMenuItems(Array.from(menuMap.values()));

    } catch (error) {
      console.error('[Analytics] Error:', error);
      toast.error('Failed to load restaurant analytics');
    } finally {
      setLoading(false);
    }
  };

  // Helper to get Date object safely from order.createdAt
  const getOrderDate = (order: Order): Date => {
    if (!order.createdAt) return new Date(0);
    if (typeof (order.createdAt as any).toDate === 'function') {
      return (order.createdAt as any).toDate();
    }
    if ((order.createdAt as any).seconds) {
      return new Date((order.createdAt as any).seconds * 1000);
    }
    const parsed = new Date(order.createdAt as any);
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
  };

  // Filter orders by dateRange
  const filteredOrders = useMemo(() => {
    if (dateRange === 'all') return orders;

    const now = new Date();
    const startDate = new Date();

    if (dateRange === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (dateRange === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else if (dateRange === 'month') {
      startDate.setMonth(now.getMonth() - 1);
    } else if (dateRange === 'year') {
      startDate.setFullYear(now.getFullYear() - 1);
    }

    return orders.filter(o => getOrderDate(o) >= startDate);
  }, [orders, dateRange]);

  // --- Core Metrics Calculation Engine ---
  const { metrics, menuStats, insights } = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const deliveredOrders = filteredOrders.filter((o) => o.status === 'delivered');
    const cancelledOrders = filteredOrders.filter((o) => o.status === 'cancelled');

    // Pending states: pending, confirmed, preparing, ready, out_for_delivery
    const pendingOrders = filteredOrders.filter((o) =>
      o.status && ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status as any)
    );

    const pendingCount = filteredOrders.filter(o => o.status === 'pending').length;
    const confirmedCount = filteredOrders.filter(o => o.status === 'confirmed').length;
    const preparingCount = filteredOrders.filter(o => o.status === 'preparing').length;
    const readyCount = filteredOrders.filter(o => o.status === 'ready').length;
    const outForDeliveryCount = filteredOrders.filter(o => o.status === 'out_for_delivery').length;

    // Gross Sales from delivered orders
    const totalSale = deliveredOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);

    // Active pipeline gross sales (pending orders)
    const pipelineSale = pendingOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);

    // Total Platform Fee (deducted commission, 10% standard or order.platformFee/commission)
    const totalPlatformFee = deliveredOrders.reduce((sum, order) => {
      const explicitFee = Number(order.platformFee) || Number((order as any).commission);
      const calculated = explicitFee ? explicitFee : Math.round(Number(order.total || 0) * 0.10);
      return sum + calculated;
    }, 0);

    // Net Merchant Earnings = Total Sale - Platform Fee
    const netEarnings = Math.max(0, totalSale - totalPlatformFee);

    // Average Order Value
    const avgOrderValue = deliveredOrders.length > 0 ? Math.round(totalSale / deliveredOrders.length) : 0;

    // Unique customer count
    const uniqueCustomers = new Set(filteredOrders.map((o) => (o.customerId || (o as any).customerPhone || 'guest') as string)).size;

    // Rates
    const fulfillmentRate = totalOrders > 0 ? (deliveredOrders.length / totalOrders) * 100 : 0;
    const cancellationRate = totalOrders > 0 ? (cancelledOrders.length / totalOrders) * 100 : 0;

    // --- Timeline Data (Daily Sales & Platform Fee) ---
    const timelineMap: Record<string, { date: string; sales: number; platformFee: number; netPayout: number; orders: number; timestamp: number }> = {};
    filteredOrders.forEach((order) => {
      const date = getOrderDate(order);
      const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

      if (!timelineMap[dateKey]) {
        timelineMap[dateKey] = {
          date: dateKey,
          sales: 0,
          platformFee: 0,
          netPayout: 0,
          orders: 0,
          timestamp: dayStart
        };
      }
      timelineMap[dateKey].orders += 1;

      if (order.status === 'delivered') {
        const orderRev = Number(order.total || 0);
        const fee = Number(order.platformFee) || Number((order as any).commission) || Math.round(orderRev * 0.10);
        timelineMap[dateKey].sales += orderRev;
        timelineMap[dateKey].platformFee += fee;
        timelineMap[dateKey].netPayout += Math.max(0, orderRev - fee);
      }
    });

    const timelineData = Object.values(timelineMap).sort((a, b) => a.timestamp - b.timestamp);

    // --- Peak Hours Data ---
    const hoursMap = new Array(24).fill(0).map((_, i) => ({ hour: i, count: 0, revenue: 0 }));
    filteredOrders.forEach((order) => {
      const date = getOrderDate(order);
      const h = date.getHours();
      hoursMap[h].count += 1;
      if (order.status === 'delivered') {
        hoursMap[h].revenue += Number(order.total || 0);
      }
    });
    const peakHoursData = hoursMap.map(h => ({
      name: `${h.hour % 12 === 0 ? 12 : h.hour % 12} ${h.hour >= 12 ? 'PM' : 'AM'}`,
      orders: h.count,
      revenue: h.revenue
    }));

    // --- Payment Methods Breakdown ---
    const paymentMap: Record<string, { count: number; total: number }> = {
      'Online / UPI': { count: 0, total: 0 },
      'Cash on Delivery': { count: 0, total: 0 },
    };
    filteredOrders.forEach(o => {
      const isCod = (o.paymentMethod || '').toLowerCase().includes('cash') || (o.paymentMethod || '').toLowerCase() === 'cod';
      const key = isCod ? 'Cash on Delivery' : 'Online / UPI';
      paymentMap[key].count += 1;
      if (o.status === 'delivered') {
        paymentMap[key].total += Number(o.total || 0);
      }
    });
    const paymentData = Object.entries(paymentMap).map(([name, data]) => ({
      name,
      orders: data.count,
      total: data.total
    }));

    // --- Category Breakdown ---
    const categorySales: Record<string, { sales: number; count: number }> = {};

    // --- Menu Wise Performance Calculation ---
    // Create base mapping from existing menuItems
    const itemMap: Record<string, MenuItemStat> = {};

    menuItems.forEach((m) => {
      itemMap[m.id || m.name] = {
        id: m.id || m.name,
        name: m.name,
        category: m.category || 'General',
        unitPrice: m.price || 0,
        imageUrl: m.image || (m as any).imageUrl,
        totalOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        pendingOrders: 0,
        totalSale: 0,
        totalPlatformFee: 0,
        netEarnings: 0,
        fulfillmentRate: 0,
        rank: 0,
      };
    });

    // Populate with order items
    filteredOrders.forEach((order) => {
      const isDelivered = order.status === 'delivered';
      const isCancelled = order.status === 'cancelled';
      const isPending = Boolean(order.status && ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status as any));

      order.items?.forEach((item) => {
        const key = item.menuItemId || item.name;
        if (!itemMap[key]) {
          itemMap[key] = {
            id: key,
            name: item.name,
            category: 'General',
            unitPrice: item.price || 0,
            imageUrl: item.image,
            totalOrders: 0,
            deliveredOrders: 0,
            cancelledOrders: 0,
            pendingOrders: 0,
            totalSale: 0,
            totalPlatformFee: 0,
            netEarnings: 0,
            fulfillmentRate: 0,
            rank: 0,
          };
        }

        const qty = item.quantity || 1;
        const lineTotal = (item.price || itemMap[key].unitPrice || 0) * qty;
        const lineFee = Math.round(lineTotal * 0.10);

        itemMap[key].totalOrders += qty;

        if (isDelivered) {
          itemMap[key].deliveredOrders += qty;
          itemMap[key].totalSale += lineTotal;
          itemMap[key].totalPlatformFee += lineFee;
          itemMap[key].netEarnings += Math.max(0, lineTotal - lineFee);

          // Track category
          const cat = itemMap[key].category || 'General';
          if (!categorySales[cat]) categorySales[cat] = { sales: 0, count: 0 };
          categorySales[cat].sales += lineTotal;
          categorySales[cat].count += qty;
        } else if (isCancelled) {
          itemMap[key].cancelledOrders += qty;
        } else if (isPending) {
          itemMap[key].pendingOrders += qty;
        }
      });
    });

    // Compute fulfillment rate and assign ranks
    const sortedMenuStats = Object.values(itemMap)
      .map((item) => {
        const rate = item.totalOrders > 0 ? (item.deliveredOrders / item.totalOrders) * 100 : 0;
        return {
          ...item,
          fulfillmentRate: Math.round(rate),
        };
      })
      .sort((a, b) => b.totalSale - a.totalSale || b.totalOrders - a.totalOrders)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    const categoryData = Object.entries(categorySales).map(([name, data]) => ({
      name,
      value: data.sales,
      orders: data.count,
    }));

    // --- Smart Insights ---
    const generatedInsights = [];

    if (totalSale > 10000) {
      generatedInsights.push({
        type: 'positive',
        title: 'Outstanding GMV',
        description: `Delivered sales reached ₹${totalSale.toLocaleString()}! Net earnings: ₹${netEarnings.toLocaleString()}.`,
        icon: TrendingUp,
      });
    } else {
      generatedInsights.push({
        type: 'neutral',
        title: 'Sales Growth Target',
        description: `Delivered revenue is ₹${totalSale.toLocaleString()}. Run a flash promo to boost daily orders.`,
        icon: Target,
      });
    }

    if (cancellationRate > 10) {
      generatedInsights.push({
        type: 'negative',
        title: 'Attention: Cancel Rate',
        description: `${cancellationRate.toFixed(1)}% of orders were cancelled (${cancelledOrders.length} orders). Audit preparation delays.`,
        icon: AlertCircle,
      });
    } else {
      generatedInsights.push({
        type: 'positive',
        title: 'High Fulfillment Quality',
        description: `${fulfillmentRate.toFixed(1)}% fulfillment rate! Excellent kitchen and delivery handoff.`,
        icon: CheckCircle2,
      });
    }

    if (pendingOrders.length > 0) {
      generatedInsights.push({
        type: 'info',
        title: 'Active Kitchen Pipeline',
        description: `${pendingOrders.length} orders currently active worth ₹${pipelineSale.toLocaleString()} in progress.`,
        icon: ChefHat,
      });
    }

    // Peak rush insight
    const busiest = peakHoursData.reduce((max, cur) => cur.orders > max.orders ? cur : max, { orders: 0, name: '' });
    if (busiest.orders > 0) {
      generatedInsights.push({
        type: 'info',
        title: 'Peak Rush Window',
        description: `Busiest hour is ${busiest.name} with ${busiest.orders} orders. Keep staffing high.`,
        icon: Clock,
      });
    }

    return {
      metrics: {
        totalOrders,
        deliveredOrders: deliveredOrders.length,
        cancelledOrders: cancelledOrders.length,
        pendingOrders: pendingOrders.length,
        pendingCount,
        confirmedCount,
        preparingCount,
        readyCount,
        outForDeliveryCount,
        totalSale,
        pipelineSale,
        totalPlatformFee,
        netEarnings,
        avgOrderValue,
        uniqueCustomers,
        fulfillmentRate,
        cancellationRate,
        timelineData,
        peakHoursData,
        paymentData,
        categoryData,
        topItems: sortedMenuStats.slice(0, 3),
      },
      menuStats: sortedMenuStats,
      insights: generatedInsights,
    };
  }, [filteredOrders, menuItems]);

  // Categories list for filter
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    menuStats.forEach(m => {
      if (m.category) set.add(m.category);
    });
    return ['all', ...Array.from(set)];
  }, [menuStats]);

  // Filtered and Sorted Menu Items
  const displayedMenuItems = useMemo(() => {
    let list = menuStats;

    if (selectedCategory !== 'all') {
      list = list.filter(m => (m.category || '').toLowerCase() === selectedCategory.toLowerCase());
    }

    if (menuSearch.trim()) {
      const q = menuSearch.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
    }

    return [...list].sort((a, b) => {
      if (menuSortBy === 'sales') return b.totalSale - a.totalSale;
      if (menuSortBy === 'orders') return b.totalOrders - a.totalOrders;
      if (menuSortBy === 'delivered') return b.deliveredOrders - a.deliveredOrders;
      if (menuSortBy === 'cancelled') return b.cancelledOrders - a.cancelledOrders;
      if (menuSortBy === 'net') return b.netEarnings - a.netEarnings;
      return 0;
    });
  }, [menuStats, selectedCategory, menuSearch, menuSortBy]);

  // CSV Export Function
  const exportMenuCSV = () => {
    if (!menuStats.length) {
      toast.error('No menu data available to export');
      return;
    }

    const headers = [
      'Rank',
      'Item Name',
      'Category',
      'Unit Price (₹)',
      'Total Orders (Qty)',
      'Delivered Orders',
      'Cancelled Orders',
      'Pending Orders',
      'Total Sales (₹)',
      'Platform Fee (₹)',
      'Net Earnings (₹)',
      'Fulfillment Rate (%)'
    ];

    const rows = menuStats.map(item => [
      item.rank,
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.category}"`,
      item.unitPrice,
      item.totalOrders,
      item.deliveredOrders,
      item.cancelledOrders,
      item.pendingOrders,
      item.totalSale,
      item.totalPlatformFee,
      item.netEarnings,
      `${item.fulfillmentRate}%`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Restaurant_Menu_Analytics_${dateRange}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Menu analytics CSV downloaded successfully');
  };

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#06b6d4', '#ec4899'];

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Spinner className="w-12 h-12 text-primary mx-auto" />
          <p className="text-muted-foreground animate-pulse font-medium text-sm">Aggregating Business Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto font-sans transition-colors duration-300">

      {/* Header Banner */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-bold gap-1 px-2.5 py-0.5">
              <Sparkles className="w-3 h-3 text-emerald-500" /> Live Revenue & Fulfillment Engine
            </Badge>
          </div>
          <motion.h1
            variants={itemVariants}
            className="text-3xl sm:text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 tracking-tight"
          >
            Restaurant Analytics
          </motion.h1>
          <motion.p variants={itemVariants} className="text-muted-foreground text-sm sm:text-base mt-1">
            Comprehensive sales, platform fee deductions, conversion funnel & menu performance
          </motion.p>
        </div>

        {/* Date Filter Pills & Refresh */}
        <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-2">
          <div className="flex bg-muted/80 p-1 rounded-2xl border border-border backdrop-blur-md">
            {(['today', 'week', 'month', 'year', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${dateRange === range
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                {range === 'all' ? 'All Time' : range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalyticsData}
            className="rounded-xl border-border h-9 px-3 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </motion.div>
      </motion.div>

      {/* Smart Insights Panel */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Executive Insights</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {insights.map((insight, idx) => (
            <Card key={idx} className="bg-card border-border text-card-foreground shadow-sm hover:shadow-md transition-all rounded-2xl">
              <CardContent className="p-4 flex gap-3.5 items-start">
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${insight.type === 'positive'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : insight.type === 'negative'
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                    }`}
                >
                  <insight.icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground text-xs">{insight.title}</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{insight.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* --- 7 MAIN EXECUTIVE KPI CARDS --- */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-500" /> Revenue & Order Performance Metrics
          </h2>
          <Badge variant="outline" className="text-[11px] font-mono text-muted-foreground">
            {filteredOrders.length} Orders in Period
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Sales */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
            <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-lg transition-all rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-16 bg-gradient-to-br from-emerald-500/15 to-transparent blur-2xl rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-5 relative z-10 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold">
                    Gross Delivered
                  </Badge>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Total Sales (Gross GMV)
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mt-0.5">
                    ₹{metrics.totalSale.toLocaleString()}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                    <span>AOV:</span>
                    <strong className="text-foreground font-mono">₹{metrics.avgOrderValue}</strong>
                    {metrics.pipelineSale > 0 && (
                      <span className="text-amber-500 font-medium ml-1">
                        (+₹{metrics.pipelineSale} pending)
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 2: Total Platform Fee */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}>
            <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-lg transition-all rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-16 bg-gradient-to-br from-purple-500/15 to-transparent blur-2xl rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-5 relative z-10 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
                    <Percent className="w-5 h-5" />
                  </div>
                  <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[10px] font-bold">
                    Platform Commission
                  </Badge>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Total Platform Fee
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 tracking-tight mt-0.5">
                    ₹{metrics.totalPlatformFee.toLocaleString()}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Deducted at source (10% standard rate)
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 3: Net Merchant Earnings */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
            <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-lg transition-all rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-16 bg-gradient-to-br from-teal-500/15 to-transparent blur-2xl rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-5 relative z-10 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="p-2.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <Badge className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20 text-[10px] font-bold">
                    Take-Home Net
                  </Badge>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Net Merchant Earnings
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-0.5">
                    ₹{metrics.netEarnings.toLocaleString()}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Credited directly to restaurant wallet
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 4: Total Orders */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }}>
            <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-lg transition-all rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-16 bg-gradient-to-br from-blue-500/15 to-transparent blur-2xl rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-5 relative z-10 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="p-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px] font-bold">
                    All Received
                  </Badge>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Total Orders
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mt-0.5">
                    {metrics.totalOrders}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {metrics.uniqueCustomers} unique diners
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 5: Total Delivered Orders */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
            <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-lg transition-all rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-16 bg-gradient-to-br from-emerald-500/15 to-transparent blur-2xl rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-5 relative z-10 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold">
                    {metrics.fulfillmentRate.toFixed(0)}% Rate
                  </Badge>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Total Delivered Orders
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-0.5">
                    {metrics.deliveredOrders}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Successfully fulfilled to customer doorstep
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 6: Total Cancelled Orders */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}>
            <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-lg transition-all rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-16 bg-gradient-to-br from-red-500/15 to-transparent blur-2xl rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-5 relative z-10 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="p-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-[10px] font-bold">
                    {metrics.cancellationRate.toFixed(1)}% Rate
                  </Badge>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Total Cancelled Orders
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-red-600 dark:text-red-400 tracking-tight mt-0.5">
                    {metrics.cancelledOrders}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Rejected, out of stock or cancelled
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 7: Total Pending Orders */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>
            <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-lg transition-all rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-16 bg-gradient-to-br from-amber-500/15 to-transparent blur-2xl rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-5 relative z-10 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                    <Hourglass className="w-5 h-5" />
                  </div>
                  <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-bold animate-pulse">
                    Active Kitchen Pipeline
                  </Badge>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Total Pending Orders
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight mt-0.5">
                    {metrics.pendingOrders}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Prep: {metrics.preparingCount} | Ready: {metrics.readyCount} | Transit: {metrics.outForDeliveryCount}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 8: Average Order Value */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.45 }}>
            <Card className="bg-card border-border text-card-foreground shadow-sm hover:shadow-lg transition-all rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-16 bg-gradient-to-br from-indigo-500/15 to-transparent blur-2xl rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-5 relative z-10 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                    <Target className="w-5 h-5" />
                  </div>
                  <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 text-[10px] font-bold">
                    Per Order Avg
                  </Badge>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Average Order Value (AOV)
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mt-0.5">
                    ₹{metrics.avgOrderValue}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Average spend per successful basket
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* --- ORDER LIFECYCLE FLOW CHART / FUNNEL --- */}
      <Card className="bg-card border-border shadow-sm rounded-3xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" /> Order Lifecycle Flow Chart & Conversion Funnel
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Visual pipeline showing conversion flow from order placement to doorstep delivery & cancellation branch
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Overall Success Rate:</span>
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold">
                {metrics.fulfillmentRate.toFixed(1)}%
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">
          {/* Funnel Flow Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 relative">
            {/* Step 1: Placed */}
            <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 relative group hover:border-blue-500/40 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Step 1 • Placement
                </span>
                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center">
                  1
                </span>
              </div>
              <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-blue-500" /> Placed Orders
              </h4>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl font-black text-foreground">{metrics.totalOrders}</span>
                <span className="text-xs font-bold text-muted-foreground">100% Volume</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Customer completed checkout</p>
            </div>

            {/* Step 2: Confirmed */}
            <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 relative group hover:border-cyan-500/40 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                  Step 2 • Kitchen Accepted
                </span>
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold text-xs flex items-center justify-center">
                  2
                </span>
              </div>
              <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-500" /> Confirmed
              </h4>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl font-black text-foreground">
                  {Math.max(0, metrics.totalOrders - metrics.pendingCount)}
                </span>
                <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                  {metrics.totalOrders > 0
                    ? Math.round(((metrics.totalOrders - metrics.pendingCount) / metrics.totalOrders) * 100)
                    : 0}%
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Restaurant approved order</p>
            </div>

            {/* Step 3: Cooking */}
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 relative group hover:border-amber-500/40 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Step 3 • Preparation
                </span>
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center">
                  3
                </span>
              </div>
              <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                <ChefHat className="w-4 h-4 text-amber-500" /> In Kitchen
              </h4>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl font-black text-foreground">
                  {metrics.preparingCount + metrics.readyCount + metrics.outForDeliveryCount + metrics.deliveredOrders}
                </span>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Active</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Food cooked & packed</p>
            </div>

            {/* Step 4: Dispatched / Out */}
            <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 relative group hover:border-purple-500/40 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Step 4 • Rider Transit
                </span>
                <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold text-xs flex items-center justify-center">
                  4
                </span>
              </div>
              <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                <Bike className="w-4 h-4 text-purple-500" /> Dispatched
              </h4>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl font-black text-foreground">
                  {metrics.outForDeliveryCount + metrics.deliveredOrders}
                </span>
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">En Route</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Handed over to delivery rider</p>
            </div>

            {/* Step 5: Delivered (Goal) */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 relative group shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Step 5 • Success
                </span>
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center">
                  ✓
                </span>
              </div>
              <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Delivered
              </h4>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {metrics.deliveredOrders}
                </span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {metrics.fulfillmentRate.toFixed(0)}% Done
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Order completed & funds settled</p>
            </div>
          </div>

          {/* Cancellation Drop-off Flow Branch */}
          <div className="mt-4 p-3.5 rounded-2xl bg-destructive/5 border border-destructive/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                <XCircle className="w-4 h-4" />
              </div>
              <div>
                <h5 className="font-bold text-xs text-foreground flex items-center gap-2">
                  Drop-off Branch: {metrics.cancelledOrders} Cancelled Orders
                  <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                    {metrics.cancellationRate.toFixed(1)}% of total
                  </Badge>
                </h5>
                <p className="text-[11px] text-muted-foreground">
                  Cancelled by customer or rejected by restaurant due to rush/out of stock.
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-mono font-bold text-muted-foreground">
                Lost Potential GMV: ~₹{Math.round(metrics.cancelledOrders * metrics.avgOrderValue)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --- TOP RANKING MENU SHOWCASE --- */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" /> Top Ranking Best-Seller Dishes
          </h2>
          <span className="text-xs text-muted-foreground">Ranked by Total Revenue Generated</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.topItems.map((item, index) => {
            const badgeColor =
              index === 0
                ? 'from-amber-400 to-yellow-500 text-black shadow-amber-500/20'
                : index === 1
                  ? 'from-slate-300 to-slate-400 text-black shadow-slate-400/20'
                  : 'from-amber-700 to-amber-800 text-white shadow-amber-800/20';

            const rankTitle = index === 0 ? '🏆 #1 Best Seller' : index === 1 ? '🥈 #2 Silver Runner-Up' : '🥉 #3 Bronze Star';

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <Card className="bg-card border-border shadow-sm hover:shadow-lg transition-all rounded-3xl overflow-hidden relative group">
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge className={`bg-gradient-to-r ${badgeColor} font-black text-xs px-2.5 py-0.5 shadow-sm`}>
                        {rankTitle}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {item.category}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="font-black text-lg text-foreground truncate group-hover:text-primary transition-colors">
                        {item.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Base Price: ₹{item.unitPrice} per portion
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-xs">
                      <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40">
                        <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Total Sales</span>
                        <span className="font-mono font-black text-base text-emerald-600 dark:text-emerald-400">
                          ₹{item.totalSale.toLocaleString()}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40">
                        <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Total Sold</span>
                        <span className="font-mono font-black text-base text-foreground">
                          {item.deliveredOrders} <span className="text-xs font-normal text-muted-foreground">portions</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                      <span>Platform Fee: ₹{item.totalPlatformFee}</span>
                      <span className="font-bold text-foreground">Net Payout: ₹{item.netEarnings}</span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
          {metrics.topItems.length === 0 && (
            <div className="col-span-3 p-8 text-center text-muted-foreground bg-muted/20 rounded-3xl border border-dashed border-border">
              <Utensils className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No dish sales recorded in this period yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* --- ALL ANALYTICS CHARTS IN DISTINCT SEPARATE CARDS (NO TABS) --- */}
      <div className="space-y-6">
        <div>
          <h2 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> Visual Analytics & Performance Charts
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time visual breakdowns of revenue, commission deductions, fulfillment pip distribution, peak demand hours, and category sales
          </p>
        </div>

        {/* CARD 1: REVENUE & COMMISSION ANALYTICS */}
        <Card className="bg-card border-border shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" /> Revenue & Commission Analytics
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Daily timeline showing Gross Sales vs Platform Fee deductions (10%) vs Net Merchant Take-Home Payout
                </CardDescription>
              </div>

              {/* Stat Chips */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Gross Sales: ₹{metrics.totalSale.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Platform Fee: ₹{metrics.totalPlatformFee.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                  <span>Net Payout: ₹{metrics.netEarnings.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[360px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.timelineData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorFee" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
                <XAxis dataKey="date" stroke="currentColor" className="opacity-50" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="currentColor" className="opacity-50" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="sales" name="Gross Sales" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="netPayout" name="Net Payout" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorNet)" />
                <Area type="monotone" dataKey="platformFee" name="Platform Fee" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorFee)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 2-COLUMN GRID: CARD 2 (ORDER STATUS PIP) & CARD (PAYMENT METHODS) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CARD 2: ORDER STATUS (PIP / DONUT CHART) */}
          <Card className="bg-card border-border shadow-sm rounded-3xl overflow-hidden flex flex-col justify-between">
            <CardHeader className="pb-2 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-amber-500" /> Order Status Distribution (Pip Chart)
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Fulfillment proportion across all orders in the current period
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-mono font-bold">
                  {metrics.totalOrders} Total
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 flex-1 flex flex-col justify-between">
              <div className="h-[280px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Delivered', value: metrics.deliveredOrders, color: '#10b981' },
                        { name: 'Pending / In Progress', value: metrics.pendingOrders, color: '#f59e0b' },
                        { name: 'Cancelled', value: metrics.cancelledOrders, color: '#ef4444' }
                      ]}
                      innerRadius={68}
                      outerRadius={105}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {[
                        { name: 'Delivered', value: metrics.deliveredOrders, color: '#10b981' },
                        { name: 'Pending / In Progress', value: metrics.pendingOrders, color: '#f59e0b' },
                        { name: 'Cancelled', value: metrics.cancelledOrders, color: '#ef4444' }
                      ].map((entry, index) => (
                        <Cell key={`cell-status-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                  <span className="text-3xl font-black text-foreground">{metrics.totalOrders}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Total Orders</span>
                </div>
              </div>

              {/* Status details pill row */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50 text-center text-xs">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Delivered</span>
                  <span className="font-mono font-black text-base text-foreground">{metrics.deliveredOrders}</span>
                  <span className="text-[10px] text-muted-foreground block font-mono">{metrics.fulfillmentRate.toFixed(0)}%</span>
                </div>
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block">Pending</span>
                  <span className="font-mono font-black text-base text-foreground">{metrics.pendingOrders}</span>
                  <span className="text-[10px] text-muted-foreground block font-mono">
                    {metrics.totalOrders > 0 ? ((metrics.pendingOrders / metrics.totalOrders) * 100).toFixed(0) : 0}%
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
                  <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 block">Cancelled</span>
                  <span className="font-mono font-black text-base text-foreground">{metrics.cancelledOrders}</span>
                  <span className="text-[10px] text-muted-foreground block font-mono">{metrics.cancellationRate.toFixed(0)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CARD: PAYMENT METHODS BREAKDOWN */}
          <Card className="bg-card border-border shadow-sm rounded-3xl overflow-hidden flex flex-col justify-between">
            <CardHeader className="pb-2 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-blue-500" /> Payment Methods Distribution
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Prepaid online (UPI/Card) vs Cash on Delivery (COD) volume & gross values
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-mono font-bold">
                  Payment Channels
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 flex-1 flex flex-col justify-between">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.paymentData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" horizontal={false} />
                    <XAxis type="number" stroke="currentColor" className="opacity-50" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" stroke="currentColor" className="opacity-80" fontSize={11} tickLine={false} axisLine={false} width={130} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="orders" name="Order Count" fill="#3b82f6" radius={[0, 6, 6, 0]}>
                      {metrics.paymentData.map((_, index) => (
                        <Cell key={`pay-${index}`} fill={index === 0 ? '#10b981' : '#f59e0b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Payment Summary */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/50 text-xs">
                {metrics.paymentData.map((p, idx) => (
                  <div key={idx} className="p-2 rounded-xl bg-muted/40 border border-border/60">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">{p.name}</span>
                    <div className="flex items-baseline justify-between mt-0.5">
                      <span className="font-mono font-black text-sm text-foreground">{p.orders} orders</span>
                      <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">₹{p.total.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 2-COLUMN GRID: CARD 3 (PEAK HOURS) & CARD 4 (CATEGORIES) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CARD 3: PEAK DEMAND & RUSH HOURS */}
          <Card className="bg-card border-border shadow-sm rounded-3xl overflow-hidden flex flex-col justify-between">
            <CardHeader className="pb-2 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-500" /> Peak Business Hours
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Order frequency across the 24-hour cycle to optimize kitchen staffing
                  </CardDescription>
                </div>
                <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px] font-bold">
                  Rush Hours
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 flex-1">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.peakHoursData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
                    <XAxis dataKey="name" stroke="currentColor" className="opacity-50" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="currentColor" className="opacity-50" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="orders" name="Orders" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                      {metrics.peakHoursData.map((entry, index) => (
                        <Cell
                          key={`hour-cell-${index}`}
                          fill={entry.orders > 5 ? '#a855f7' : entry.orders > 2 ? '#3b82f6' : '#94a3b8'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/50 mt-2">
                <span>Lunch Rush: 12:00 PM – 3:00 PM</span>
                <span>Dinner Rush: 7:00 PM – 10:30 PM</span>
              </div>
            </CardContent>
          </Card>

          {/* CARD 4: CATEGORIES PERFORMANCE */}
          <Card className="bg-card border-border shadow-sm rounded-3xl overflow-hidden flex flex-col justify-between">
            <CardHeader className="pb-2 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <Utensils className="w-5 h-5 text-teal-500" /> Sales by Menu Categories
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Revenue contribution and sales share by food category
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-mono font-bold">
                  {metrics.categoryData.length} Categories
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 flex-1">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={105}
                      label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {metrics.categoryData.map((_, index) => (
                        <Cell key={`cat-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="text-center text-[11px] text-muted-foreground pt-2 border-t border-border/50 mt-2">
                Visual revenue breakdown across menu categories
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* --- MENU-WISE COMPREHENSIVE PERFORMANCE TABLE --- */}
      <Card className="bg-card border-border shadow-sm rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                <Utensils className="w-5 h-5 text-primary" /> Menu-Wise Detailed Performance Breakdown
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Dish-by-dish financial and operational audit: Total Sales, Platform Fee, Net Payout, Total Orders, Delivered, Cancelled & Pending
              </CardDescription>
            </div>

            {/* Export and action */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={exportMenuCSV}
                variant="outline"
                size="sm"
                className="h-9 px-3.5 rounded-xl border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs font-bold gap-1.5 shadow-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Export Menu CSV
              </Button>
            </div>
          </div>

          {/* Search, Category Filter, and Sort Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-3 border-t border-border/40">
            {/* Search input */}
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
              <Input
                placeholder="Search dish or category..."
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl border-border bg-muted/30"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground shrink-0">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-9 rounded-xl border border-border bg-card px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {categoriesList.map((c) => (
                  <option key={c} value={c}>
                    {c === 'all' ? 'All Categories' : c}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort by */}
            <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-2">
              <span className="text-xs font-semibold text-muted-foreground shrink-0">Sort By:</span>
              <div className="flex flex-wrap gap-1">
                {[
                  { key: 'sales', label: 'Total Sales' },
                  { key: 'orders', label: 'Total Orders' },
                  { key: 'delivered', label: 'Delivered' },
                  { key: 'cancelled', label: 'Cancelled' },
                  { key: 'net', label: 'Net Payout' },
                ].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setMenuSortBy(s.key as any)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${menuSortBy === s.key
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border font-bold">
                <tr>
                  <th className="py-3 px-4"># Rank</th>
                  <th className="py-3 px-4">Dish / Menu Item</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Price</th>
                  <th className="py-3 px-4 text-right font-black text-foreground">Total Sale</th>
                  <th className="py-3 px-4 text-right text-purple-600 dark:text-purple-400">Platform Fee</th>
                  <th className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">Net Earnings</th>
                  <th className="py-3 px-4 text-center">Total Orders</th>
                  <th className="py-3 px-4 text-center text-emerald-600 dark:text-emerald-400">Delivered</th>
                  <th className="py-3 px-4 text-center text-red-600 dark:text-red-400">Cancelled</th>
                  <th className="py-3 px-4 text-center text-amber-600 dark:text-amber-400">Pending</th>
                  <th className="py-3 px-4 text-center">Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {displayedMenuItems.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    {/* Rank */}
                    <td className="py-3 px-4 font-mono font-bold">
                      {item.rank <= 3 ? (
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${item.rank === 1
                            ? 'bg-amber-400 text-black'
                            : item.rank === 2
                              ? 'bg-slate-300 text-black'
                              : 'bg-amber-700 text-white'
                            }`}
                        >
                          {item.rank}
                        </span>
                      ) : (
                        <span className="text-muted-foreground ml-1.5">{item.rank}</span>
                      )}
                    </td>

                    {/* Item Name */}
                    <td className="py-3 px-4 font-bold text-foreground">
                      <div className="max-w-[200px] truncate" title={item.name}>
                        {item.name}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px] py-0 font-medium text-muted-foreground">
                        {item.category}
                      </Badge>
                    </td>

                    {/* Price */}
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                      ₹{item.unitPrice}
                    </td>

                    {/* Total Sale */}
                    <td className="py-3 px-4 text-right font-mono font-black text-foreground">
                      ₹{item.totalSale.toLocaleString()}
                    </td>

                    {/* Platform Fee */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                      ₹{item.totalPlatformFee.toLocaleString()}
                    </td>

                    {/* Net Earnings */}
                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                      ₹{item.netEarnings.toLocaleString()}
                    </td>

                    {/* Total Orders */}
                    <td className="py-3 px-4 text-center font-mono font-bold text-foreground">
                      {item.totalOrders}
                    </td>

                    {/* Delivered Orders */}
                    <td className="py-3 px-4 text-center font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {item.deliveredOrders}
                    </td>

                    {/* Cancelled Orders */}
                    <td className="py-3 px-4 text-center font-mono font-semibold text-red-600 dark:text-red-400">
                      {item.cancelledOrders}
                    </td>

                    {/* Pending Orders */}
                    <td className="py-3 px-4 text-center font-mono font-semibold text-amber-600 dark:text-amber-400">
                      {item.pendingOrders}
                    </td>

                    {/* Fulfillment Rate */}
                    <td className="py-3 px-4 text-center">
                      <Badge
                        className={`text-[10px] font-bold ${item.fulfillmentRate >= 80
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : item.fulfillmentRate >= 50
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                            : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                          }`}
                      >
                        {item.fulfillmentRate}%
                      </Badge>
                    </td>
                  </tr>
                ))}
                {displayedMenuItems.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-muted-foreground">
                      No menu item records match your filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
