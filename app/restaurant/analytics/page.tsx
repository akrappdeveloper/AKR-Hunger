'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, MenuItem } from '@/lib/types';
import {
  TrendingUp, Users, ShoppingCart, Award, Download,
  Calendar, DollarSign, Package, BarChart3, PieChart
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

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
        orderBy('createdAt', 'desc')
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

  const calculateMetrics = () => {
    const deliveredOrders = orders.filter((o) => o.status === 'delivered');
    const totalRevenue = deliveredOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const avgOrderValue = deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0;
    const uniqueCustomers = new Set(orders.map((o) => o.customerId)).size;

    // Best selling items
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
      .slice(0, 10);

    // Revenue by day
    const revenueByDay: { [key: string]: number } = {};
    deliveredOrders.forEach((order) => {
      const date = new Date(order.createdAt?.seconds ? order.createdAt.seconds * 1000 : order.createdAt!);
      const dateKey = date.toLocaleDateString();
      revenueByDay[dateKey] = (revenueByDay[dateKey] || 0) + (order.total || 0);
    });

    return {
      totalOrders: orders.length,
      deliveredOrders: deliveredOrders.length,
      totalRevenue,
      avgOrderValue,
      uniqueCustomers,
      topItems,
      cancelledOrders: orders.filter((o) => o.status === 'cancelled').length,
      pendingOrders: orders.filter((o) => ['pending', 'confirmed', 'preparing'].includes(o.status || '')).length,
      revenueByDay,
    };
  };

  const downloadCSVReport = () => {
    const metrics = calculateMetrics();

    // Create CSV content
    let csv = 'AKR Hunger - Restaurant Analytics Report\n';
    csv += `Restaurant: ${restaurant?.name}\n`;
    csv += `Period: ${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}\n`;
    csv += `Generated: ${new Date().toLocaleString()}\n\n`;

    csv += 'SUMMARY METRICS\n';
    csv += 'Metric,Value\n';
    csv += `Total Orders,${metrics.totalOrders}\n`;
    csv += `Delivered Orders,${metrics.deliveredOrders}\n`;
    csv += `Cancelled Orders,${metrics.cancelledOrders}\n`;
    csv += `Pending Orders,${metrics.pendingOrders}\n`;
    csv += `Total Revenue,₹${metrics.totalRevenue.toFixed(2)}\n`;
    csv += `Average Order Value,₹${metrics.avgOrderValue.toFixed(2)}\n`;
    csv += `Unique Customers,${metrics.uniqueCustomers}\n`;
    csv += `Fulfillment Rate,${metrics.totalOrders > 0 ? ((metrics.deliveredOrders / metrics.totalOrders) * 100).toFixed(1) : 0}%\n\n`;

    csv += 'TOP SELLING ITEMS\n';
    csv += 'Item Name,Quantity Sold,Total Revenue\n';
    metrics.topItems.forEach(item => {
      csv += `${item.name},${item.count},₹${item.revenue.toFixed(2)}\n`;
    });

    csv += '\nMENU INSIGHTS\n';
    csv += `Total Menu Items,${menuItems.length}\n`;
    csv += `Vegetarian Items,${menuItems.filter(m => m.vegetarian).length}\n`;
    csv += `Best Sellers,${menuItems.filter(m => m.isBestSeller).length}\n`;
    csv += `New Items,${menuItems.filter(m => m.isNew).length}\n`;
    csv += `Average Price,₹${(menuItems.reduce((sum, item) => sum + (item.price || 0), 0) / (menuItems.length || 1)).toFixed(2)}\n`;

    // Download file
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-report-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadJSONReport = () => {
    const metrics = calculateMetrics();

    const report = {
      restaurant: restaurant?.name,
      period: dateRange,
      generatedAt: new Date().toISOString(),
      summary: {
        totalOrders: metrics.totalOrders,
        deliveredOrders: metrics.deliveredOrders,
        cancelledOrders: metrics.cancelledOrders,
        pendingOrders: metrics.pendingOrders,
        totalRevenue: metrics.totalRevenue,
        avgOrderValue: metrics.avgOrderValue,
        uniqueCustomers: metrics.uniqueCustomers,
        fulfillmentRate: metrics.totalOrders > 0 ? (metrics.deliveredOrders / metrics.totalOrders) * 100 : 0,
      },
      topSellingItems: metrics.topItems,
      menuInsights: {
        totalItems: menuItems.length,
        vegetarianItems: menuItems.filter(m => m.vegetarian).length,
        bestSellers: menuItems.filter(m => m.isBestSeller).length,
        newItems: menuItems.filter(m => m.isNew).length,
        averagePrice: menuItems.reduce((sum, item) => sum + (item.price || 0), 0) / (menuItems.length || 1),
      },
      revenueByDay: metrics.revenueByDay,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-report-${dateRange}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (authLoading || loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const metrics = calculateMetrics();

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-300 bg-clip-text text-transparent flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            Analytics & Reports
          </h1>
          <p className="text-gray-200 mt-2 text-lg font-medium">Track your restaurant performance</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['week', 'month', 'year'] as const).map((range) => (
            <Button
              key={range}
              variant={dateRange === range ? 'default' : 'outline'}
              onClick={() => setDateRange(range)}
              className={dateRange === range ? 'bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg shadow-blue-500/30 font-bold' : 'bg-gray-800/50 border-gray-700 text-white hover:bg-gray-700 font-semibold'}
            >
              <Calendar className="w-4 h-4 mr-2" />
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Download Reports */}
      <Card className="p-5 bg-gradient-to-r from-orange-900/30 to-red-900/30 border-orange-500/30 backdrop-blur-sm shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-white text-lg">Download Reports</h3>
            <p className="text-sm text-orange-200 font-medium">Export your analytics data</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={downloadCSVReport} variant="outline" className="gap-2 bg-gray-800/50 border-gray-700 text-white hover:bg-gray-700">
              <Download className="w-4 h-4" />
              CSV Report
            </Button>
            <Button onClick={downloadJSONReport} className="gap-2 bg-gradient-to-r from-orange-500 to-red-500 shadow-lg font-bold">
              <Download className="w-4 h-4" />
              JSON Report
            </Button>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 relative overflow-hidden group hover:shadow-xl transition bg-gray-800/50 border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30">
                  <ShoppingCart className="w-6 h-6 text-blue-400" />
                </div>
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30">{dateRange}</Badge>
              </div>
              <p className="text-sm text-gray-300 font-semibold uppercase tracking-wide">Total Orders</p>
              <p className="text-4xl font-bold text-white mt-2">{metrics.totalOrders}</p>
              <p className="text-sm text-gray-400 mt-1 font-medium">{metrics.deliveredOrders} delivered</p>
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent rounded-tl-full" />
            </Card>

            <Card className="p-6 relative overflow-hidden group hover:shadow-xl transition bg-gray-800/50 border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-500/20 rounded-xl border border-green-500/30">
                  <DollarSign className="w-6 h-6 text-green-400" />
                </div>
                <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">{dateRange}</Badge>
              </div>
              <p className="text-sm text-gray-300 font-semibold uppercase tracking-wide">Total Revenue</p>
              <p className="text-4xl font-bold text-white mt-2">₹{metrics.totalRevenue.toFixed(0)}</p>
              <p className="text-sm text-gray-400 mt-1 font-medium">Avg: ₹{metrics.avgOrderValue.toFixed(0)}</p>
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/20 to-transparent rounded-tl-full" />
            </Card>

            <Card className="p-6 relative overflow-hidden group hover:shadow-xl transition bg-gray-800/50 border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-500/20 rounded-xl border border-purple-500/30">
                  <Users className="w-6 h-6 text-purple-400" />
                </div>
                <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">{dateRange}</Badge>
              </div>
              <p className="text-sm text-gray-300 font-semibold uppercase tracking-wide">Customers</p>
              <p className="text-4xl font-bold text-white mt-2">{metrics.uniqueCustomers}</p>
              <p className="text-sm text-gray-400 mt-1 font-medium">
                {metrics.totalOrders > 0 ? (metrics.totalOrders / metrics.uniqueCustomers).toFixed(1) : 0} orders/customer
              </p>
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-transparent rounded-tl-full" />
            </Card>

            <Card className="p-6 relative overflow-hidden group hover:shadow-xl transition bg-gray-800/50 border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-orange-500/20 rounded-xl border border-orange-500/30">
                  <Award className="w-6 h-6 text-orange-400" />
                </div>
                <Badge variant="secondary" className="bg-orange-500/20 text-orange-300 border-orange-500/30">{dateRange}</Badge>
              </div>
              <p className="text-sm text-gray-300 font-semibold uppercase tracking-wide">Success Rate</p>
              <p className="text-4xl font-bold text-white mt-2">
                {metrics.totalOrders > 0 ? Math.round((metrics.deliveredOrders / metrics.totalOrders) * 100) : 0}%
              </p>
              <p className="text-sm text-gray-400 mt-1 font-medium">{metrics.cancelledOrders} cancelled</p>
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500/20 to-transparent rounded-tl-full" />
            </Card>
          </div>
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Selling Items */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Top Selling Items
                </h2>
                <Badge>{metrics.topItems.length} items</Badge>
              </div>
              <div className="space-y-2">
                {metrics.topItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No sales data yet</p>
                ) : (
                  metrics.topItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-secondary hover:bg-secondary/80 rounded-lg transition">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary">
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{item.count} sold</p>
                        </div>
                      </div>
                      <p className="font-bold text-foreground">₹{item.revenue.toFixed(0)}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Order Status Breakdown */}
            <Card className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Order Status Breakdown
              </h2>
              <div className="space-y-3">
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-green-900 dark:text-green-100">Delivered</span>
                    <span className="text-lg font-bold text-green-900 dark:text-green-100">{metrics.deliveredOrders}</span>
                  </div>
                  <div className="mt-2 h-2 bg-green-200 dark:bg-green-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${metrics.totalOrders > 0 ? (metrics.deliveredOrders / metrics.totalOrders) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-yellow-900 dark:text-yellow-100">Pending</span>
                    <span className="text-lg font-bold text-yellow-900 dark:text-yellow-100">{metrics.pendingOrders}</span>
                  </div>
                  <div className="mt-2 h-2 bg-yellow-200 dark:bg-yellow-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500"
                      style={{ width: `${metrics.totalOrders > 0 ? (metrics.pendingOrders / metrics.totalOrders) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-red-900 dark:text-red-100">Cancelled</span>
                    <span className="text-lg font-bold text-red-900 dark:text-red-100">{metrics.cancelledOrders}</span>
                  </div>
                  <div className="mt-2 h-2 bg-red-200 dark:bg-red-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${metrics.totalOrders > 0 ? (metrics.cancelledOrders / metrics.totalOrders) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Menu Tab */}
        <TabsContent value="menu" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6">
              <Package className="w-8 h-8 text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Total Menu Items</p>
              <p className="text-3xl font-bold text-foreground mt-2">{menuItems.length}</p>
            </Card>

            <Card className="p-6">
              <span className="text-2xl mb-3 block">🥬</span>
              <p className="text-sm text-muted-foreground">Vegetarian Items</p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {menuItems.filter((m) => m.vegetarian).length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {menuItems.length > 0 ? Math.round((menuItems.filter(m => m.vegetarian).length / menuItems.length) * 100) : 0}% of menu
              </p>
            </Card>

            <Card className="p-6">
              <DollarSign className="w-8 h-8 text-green-500 mb-3" />
              <p className="text-sm text-muted-foreground">Average Price</p>
              <p className="text-3xl font-bold text-foreground mt-2">
                ₹{(menuItems.reduce((sum, item) => sum + (item.price || 0), 0) / (menuItems.length || 1)).toFixed(0)}
              </p>
            </Card>
          </div>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6">
              <Users className="w-8 h-8 text-purple-500 mb-3" />
              <p className="text-sm text-muted-foreground">Unique Customers</p>
              <p className="text-3xl font-bold text-foreground mt-2">{metrics.uniqueCustomers}</p>
            </Card>

            <Card className="p-6">
              <ShoppingCart className="w-8 h-8 text-blue-500 mb-3" />
              <p className="text-sm text-muted-foreground">Orders per Customer</p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {metrics.uniqueCustomers > 0 ? (metrics.totalOrders / metrics.uniqueCustomers).toFixed(1) : 0}
              </p>
            </Card>

            <Card className="p-6">
              <DollarSign className="w-8 h-8 text-green-500 mb-3" />
              <p className="text-sm text-muted-foreground">Avg Customer Value</p>
              <p className="text-3xl font-bold text-foreground mt-2">
                ₹{metrics.uniqueCustomers > 0 ? (metrics.totalRevenue / metrics.uniqueCustomers).toFixed(0) : 0}
              </p>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
