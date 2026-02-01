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
  Package,
  Utensils,
  ArrowUpRight,
  Sparkles,
  Zap,
  BrainCircuit,
  BarChart3
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
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'preparing':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'confirmed':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'ready':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'out_for_delivery':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'cancelled':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 via-rose-500 to-amber-500 bg-clip-text text-transparent flex items-center gap-3 animate-in slide-in-from-left duration-500">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Utensils className="w-7 h-7 text-white" />
            </div>
            Dashboard
          </h1>
          <p className="text-slate-400 mt-2 text-lg">
            Welcome back, <strong className="text-white">{restaurant?.name}</strong>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {restaurant?.isOpen ? (
            <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30 px-4 py-2 text-sm font-bold border border-green-500/50">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
              Open for Business
            </Badge>
          ) : (
            <Badge variant="secondary" className="px-4 py-2 text-sm font-bold bg-red-500/20 text-red-400 border border-red-500/50">
              <AlertCircle className="w-4 h-4 mr-2" />
              Closed
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* --- AI Insights Card --- */}
        <div className="lg:col-span-3">
          <Card className="relative overflow-hidden border-none bg-gradient-to-r from-violet-900/40 via-purple-900/40 to-fuchsia-900/40 border border-purple-500/30">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500" />
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-purple-500/20 blur-3xl rounded-full" />

            <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl shadow-lg shadow-violet-500/30 shrink-0">
                  <BrainCircuit className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    AI Business Insights <Badge className="bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/50 text-[10px]">BETA</Badge>
                  </h3>
                  <div className="mt-2 space-y-1">
                    <p className="text-slate-300 text-sm flex items-center gap-2">
                      <Sparkles className="w-3 h-3 text-yellow-400" />
                      <span>Prediction: <strong className="text-white">High demand expected today between 7 PM - 9 PM</strong> due to weekend trends.</span>
                    </p>
                    <p className="text-slate-300 text-sm flex items-center gap-2">
                      <Zap className="w-3 h-3 text-orange-400" />
                      <span>Action: Stock up on <strong className="text-white">Chicken Biryani</strong>, it's your top trending item.</span>
                    </p>
                  </div>
                </div>
              </div>
              <Button className="bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-sm whitespace-nowrap">
                View Full Report
              </Button>
            </div>
          </Card>
        </div>

        {/* Stats Grid */}

        {/* Today's Orders */}
        <Card className="relative overflow-hidden bg-slate-900/50 border-slate-800 hover:border-blue-500/50 transition-all group p-6">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ShoppingCart className="w-16 h-16 text-blue-500" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform duration-300">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div className="flex items-center text-xs font-medium text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
              <TrendingUp className="w-3 h-3 mr-1" /> +12%
            </div>
          </div>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Today's Orders</p>
          <p className="text-3xl font-bold text-white mt-1">{todayOrders}</p>
        </Card>

        {/* Active Orders */}
        <Card className="relative overflow-hidden bg-slate-900/50 border-slate-800 hover:border-orange-500/50 transition-all group p-6">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock className="w-16 h-16 text-orange-500" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20 text-orange-400 group-hover:scale-110 transition-transform duration-300">
              <Clock className="w-6 h-6" />
            </div>
            {activeOrders > 0 && (
              <div className="flex items-center text-xs font-bold text-orange-400 bg-orange-500/10 px-2 py-1 rounded-full animate-pulse">
                Live
              </div>
            )}
          </div>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Active Orders</p>
          <p className="text-3xl font-bold text-white mt-1">{activeOrders}</p>
        </Card>

        {/* Total Revenue */}
        <Card className="relative overflow-hidden bg-slate-900/50 border-slate-800 hover:border-green-500/50 transition-all group p-6">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <BarChart3 className="w-16 h-16 text-green-500" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20 text-green-400 group-hover:scale-110 transition-transform duration-300">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Today's Revenue</p>
          <p className="text-3xl font-bold text-white mt-1">₹{totalRevenue.toLocaleString()}</p>
        </Card>

      </div>

      {/* Recent Orders Section */}
      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Recently Received
          </h2>
          <Button variant="ghost" className="text-white hover:text-slate-200 hover:bg-slate-800" onClick={() => router.push('/restaurant/orders')}>
            View All <ArrowUpRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
        <div className="p-0">
          {recentOrders.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500">No orders received yet today.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {recentOrders.map((order) => (
                <div key={order.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => router.push(`/restaurant/orders/${order.id}`)}>
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-800 rounded-lg text-slate-400">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-white">Order #{order.id?.slice(0, 8).toUpperCase()}</p>
                      <p className="text-sm text-slate-400">{order.customerName} • {order.items?.length} Items</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
                    <Badge variant="outline" className={`${getStatusColor(order.status)} capitalize border-none`}>
                      {order.status?.replace('_', ' ')}
                    </Badge>
                    <p className="font-bold text-white w-20 text-right">₹{order.total}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

    </div>
  );
}
