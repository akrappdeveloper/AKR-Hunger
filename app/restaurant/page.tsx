'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingCart,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  Package,
  DollarSign,
  Eye,
  Utensils,
  Star,
  Users,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order } from '@/lib/types';

export default function RestaurantDashboard() {
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();

  const [todayOrders, setTodayOrders] = useState(0);
  const [activeOrders, setActiveOrders] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [pendingMenuItems, setPendingMenuItems] = useState(0);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/restaurant/login');
      return;
    }

    fetchDashboardData();
  }, [user, authLoading, router]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Get today's date
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const ordersRef = collection(db, 'orders');

      // Today's orders
      const todayQuery = query(
        ordersRef,
        where('restaurantId', '==', user!.uid),
        where('createdAt', '>=', today),
        orderBy('createdAt', 'desc')
      );
      const todaySnapshot = await getDocs(todayQuery);
      setTodayOrders(todaySnapshot.docs.length);

      // Active orders
      const activeQuery = query(
        ordersRef,
        where('restaurantId', '==', user!.uid),
        where('status', 'in', ['confirmed', 'preparing', 'ready', 'out_for_delivery']),
        orderBy('createdAt', 'desc')
      );
      const activeSnapshot = await getDocs(activeQuery);
      setActiveOrders(activeSnapshot.docs.length);

      // Calculate revenue
      let revenue = 0;
      todaySnapshot.docs.forEach((doc) => {
        const order = doc.data() as Order;
        if (order.paymentStatus === 'completed' && order.status === 'delivered') {
          revenue += order.total || 0;
        }
      });
      setTotalRevenue(revenue);

      // Recent orders
      const recentQuery = query(
        ordersRef,
        where('restaurantId', '==', user!.uid),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const recentSnapshot = await getDocs(recentQuery);
      setRecentOrders(
        recentSnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Order[]
      );

      // Get pending menu items
      const menuItemsRef = collection(db, 'menuItems');
      const pendingItemsQuery = query(
        menuItemsRef,
        where('restaurantId', '==', user!.uid),
        where('approvalStatus', '==', 'pending')
      );
      const pendingSnapshot = await getDocs(pendingItemsQuery);
      setPendingMenuItems(pendingSnapshot.docs.length);

    } catch (error) {
      console.error('[Dashboard] Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-100';
      case 'preparing':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100';
      case 'confirmed':
        return 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-100';
      case 'ready':
        return 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-100';
      case 'out_for_delivery':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-100';
      case 'cancelled':
        return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100';
      default:
        return 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-100';
    }
  };

  if (authLoading || loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-16 bg-muted rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 via-red-400 to-orange-300 bg-clip-text text-transparent flex items-center gap-3">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 via-red-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-500/30 ring-4 ring-orange-500/20">
              <Utensils className="w-7 h-7 text-white" />
            </div>
            Dashboard
          </h1>
          <p className="text-gray-200 mt-3 text-lg font-medium">Welcome back, <strong className="text-white">{restaurant?.name}</strong></p>
        </div>
        <div className="flex items-center gap-3">
          {restaurant?.isOpen ? (
            <Badge className="bg-green-500 hover:bg-green-600 px-5 py-2.5 text-base font-bold shadow-lg shadow-green-500/30 ring-2 ring-green-500/30">
              <div className="w-2.5 h-2.5 bg-white rounded-full mr-2 animate-pulse" />
              Open Now
            </Badge>
          ) : (
            <Badge variant="secondary" className="px-5 py-2.5 text-base font-bold bg-gray-800 text-gray-200 border-2 border-gray-700">
              <AlertCircle className="w-4 h-4 mr-2" />
              Closed
            </Badge>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Today's Orders */}
        <Card className="relative overflow-hidden group hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 bg-gradient-to-br from-blue-900/30 to-gray-900/50 border-blue-500/20 backdrop-blur-sm">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-500/20 rounded-xl group-hover:scale-110 transition-transform ring-2 ring-blue-500/30">
                <ShoppingCart className="w-6 h-6 text-blue-300" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-sm text-blue-200 font-bold uppercase tracking-wider">Today's Orders</p>
            <p className="text-4xl font-bold text-white mt-2">{todayOrders}</p>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent rounded-tl-full" />
          </div>
        </Card>

        {/* Active Orders */}
        <Card className="relative overflow-hidden group hover:shadow-2xl hover:shadow-orange-500/20 transition-all duration-300 bg-gradient-to-br from-orange-900/30 to-gray-900/50 border-orange-500/20 backdrop-blur-sm">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-500/20 rounded-xl group-hover:scale-110 transition-transform ring-2 ring-orange-500/30">
                <Clock className="w-6 h-6 text-orange-300" />
              </div>
              {activeOrders > 0 && (
                <Badge variant="destructive" className="animate-pulse font-bold text-sm px-3 py-1 shadow-lg shadow-red-500/30">{activeOrders}</Badge>
              )}
            </div>
            <p className="text-sm text-orange-200 font-bold uppercase tracking-wider">Active Orders</p>
            <p className="text-4xl font-bold text-white mt-2">{activeOrders}</p>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500/20 to-transparent rounded-tl-full" />
          </div>
        </Card>

        {/* Revenue */}
        <Card className="relative overflow-hidden group hover:shadow-2xl hover:shadow-green-500/20 transition-all duration-300 bg-gradient-to-br from-green-900/30 to-gray-900/50 border-green-500/20 backdrop-blur-sm">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-500/20 rounded-xl group-hover:scale-110 transition-transform ring-2 ring-green-500/30">
                <TrendingUp className="w-6 h-6 text-green-300" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-green-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-sm text-green-200 font-bold uppercase tracking-wider">Today's Revenue</p>
            <p className="text-4xl font-bold text-white mt-2">₹{totalRevenue.toFixed(0)}</p>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/20 to-transparent rounded-tl-full" />
          </div>
        </Card>

        {/* Pending Menu Items */}
        <Card className="p-6 relative overflow-hidden group hover:shadow-2xl transition-all bg-gray-800/50 border-purple-700/30">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/20 rounded-xl border border-purple-500/30 group-hover:scale-110 transition-transform">
              <Package className="w-6 h-6 text-purple-400" />
            </div>
            {pendingMenuItems > 0 && (
              <Badge className="bg-purple-500 font-bold shadow-lg">{pendingMenuItems}</Badge>
            )}
          </div>
          <p className="text-sm text-gray-300 font-semibold uppercase tracking-wide">Pending Items</p>
          <p className="text-4xl font-bold text-white mt-2">{pendingMenuItems}</p>
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-transparent rounded-tl-full" />
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Button
          onClick={() => router.push('/restaurant/orders')}
          className="h-28 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:via-blue-700 hover:to-blue-800 text-lg font-bold shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 transition-all transform hover:scale-105"
        >
          <Eye className="w-7 h-7 mr-3" />
          View All Orders
        </Button>
        <Button
          onClick={() => router.push('/restaurant/menu')}
          className="h-28 bg-gradient-to-r from-orange-500 via-orange-600 to-red-600 hover:from-orange-600 hover:via-orange-700 hover:to-red-700 text-lg font-bold shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40 transition-all transform hover:scale-105"
        >
          <Utensils className="w-7 h-7 mr-3" />
          Manage Menu
        </Button>
        <Button
          onClick={() => router.push('/restaurant/analytics')}
          className="h-28 bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 hover:from-gray-800 hover:via-gray-900 hover:to-black text-lg font-bold border-2 border-gray-600 shadow-xl shadow-gray-900/30 hover:shadow-2xl hover:shadow-gray-900/40 transition-all transform hover:scale-105"
        >
          <TrendingUp className="w-7 h-7 mr-3" />
          Analytics
        </Button>
      </div>

      {/* Recent Orders */}
      <Card className="overflow-hidden bg-gray-900/50 border-gray-800 backdrop-blur-sm shadow-2xl">
        <div className="p-6 border-b border-gray-800 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg ring-2 ring-blue-500/30">
                <ShoppingCart className="w-6 h-6 text-blue-400" />
              </div>
              Recent Orders
            </h2>
            <Button
              variant="ghost"
              onClick={() => router.push('/restaurant/orders')}
              className="text-white hover:text-white hover:bg-gray-800 font-semibold"
            >
              View All
              <ArrowUpRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        <div className="p-6 bg-gray-900/30">
          {recentOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 mx-auto text-gray-500 mb-4 opacity-50" />
              <p className="text-gray-300 text-lg font-semibold">No orders yet</p>
              <p className="text-sm text-gray-400 mt-2 font-medium">Orders will appear here once customers start ordering</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-5 bg-gray800/50 hover:bg-gray-800/70 rounded-xl transition-all cursor-pointer group border border-gray-700/50 hover:border-gray-600 shadow-lg"
                  onClick={() => router.push(`/restaurant/orders/${order.id}`)}
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 bg-blue-500/20 rounded-lg group-hover:scale-110 transition-transform ring-2 ring-blue-500/30">
                      <ShoppingCart className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-white text-lg">Order #{order.id?.slice(0, 8).toUpperCase()}</p>
                        <Badge variant="outline" className="text-xs bg-gray-700 text-gray-200 border-gray-600 font-semibold">{order.customerName}</Badge>
                      </div>
                      <p className="text-sm text-gray-300 font-medium">
                        {order.items?.length || 0} items • <span className="text-green-400 font-bold">₹{order.total?.toFixed(0)}</span>
                      </p>
                      {order.createdAt && (
                        <p className="text-xs text-gray-400 mt-1 font-medium">
                          {new Date(order.createdAt.seconds * 1000).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge className={`${getStatusColor(order.status)} capitalize mt-2 md:mt-0 font-bold px-4 py-1.5 shadow-lg`}>
                    {order.status?.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
