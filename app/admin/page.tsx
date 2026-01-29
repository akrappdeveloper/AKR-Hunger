'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import StatCard from '@/components/admin/StatCard';
import {
  Users,
  Store,
  ShoppingCart,
  TrendingUp,
  Truck,
  Activity,
  Euro,
  DollarSign,
  IndianRupee
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface DashboardStats {
  totalCustomers: number;
  totalRestaurants: number;
  totalOrders: number;
  totalDeliveryPartners: number;
  totalRevenue: number;
}

interface OrderData {
  id: string;
  total: number;
  createdAt: Timestamp;
  status: string;
  customerName: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    totalRestaurants: 0,
    totalOrders: 0,
    totalDeliveryPartners: 0,
    totalRevenue: 0,
  });

  const [recentOrders, setRecentOrders] = useState<OrderData[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to Customers
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      setStats(prev => ({ ...prev, totalCustomers: snap.size }));
    });

    // Listen to Restaurants
    const unsubRestaurants = onSnapshot(collection(db, 'restaurants'), (snap) => {
      setStats(prev => ({ ...prev, totalRestaurants: snap.size }));
    });

    // Listen to Delivery Partners
    const unsubDelivery = onSnapshot(collection(db, 'delivery_partners'), (snap) => {
      setStats(prev => ({ ...prev, totalDeliveryPartners: snap.size }));
    });

    // Listen to Orders (Core Logic for Revenue & Charts)
    const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      let revenue = 0;
      const orders = snap.docs.map(doc => {
        const data = doc.data();
        revenue += data.total || 0;
        return { id: doc.id, ...data } as OrderData;
      });

      setStats(prev => ({ ...prev, totalOrders: snap.size, totalRevenue: revenue }));
      setRecentOrders(orders.slice(0, 5)); // Top 5 recent orders

      // Process Chart Data (Group by Month)
      const monthlyData: { [key: string]: { name: string; orders: number; revenue: number } } = {};
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      orders.forEach(order => {
        if (order.createdAt?.toDate) {
          const date = order.createdAt.toDate();
          const monthIndex = date.getMonth();
          const monthName = months[monthIndex];

          if (!monthlyData[monthName]) {
            monthlyData[monthName] = { name: monthName, orders: 0, revenue: 0 };
          }
          monthlyData[monthName].orders += 1;
          monthlyData[monthName].revenue += order.total || 0;
        }
      });

      // Convert to array and sort by month index
      const processedChartData = Object.values(monthlyData).sort((a, b) => {
        return months.indexOf(a.name) - months.indexOf(b.name);
      });

      // If no data, show empty placeholders or processed data
      setChartData(processedChartData.length > 0 ? processedChartData : months.slice(0, 6).map(m => ({ name: m, orders: 0, revenue: 0 })));
      setLoading(false);
    });

    return () => {
      unsubCustomers();
      unsubRestaurants();
      unsubDelivery();
      unsubOrders();
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Real-time overview of AKR Hunger platform performance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          title="Total Customers"
          value={stats.totalCustomers}
          change="Real-time"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Total Restaurants"
          value={stats.totalRestaurants}
          change="Real-time"
          icon={Store}
          color="green"
        />
        <StatCard
          title="Total Orders"
          value={stats.totalOrders}
          change="Real-time"
          icon={ShoppingCart}
          color="orange"
        />
        <StatCard
          title="Delivery Partners"
          value={stats.totalDeliveryPartners}
          change="Real-time"
          icon={Truck}
          color="blue"
        />
        <StatCard
          title="Total Revenue"
          value={`₹${(stats.totalRevenue).toLocaleString()}`}
          change="Real-time"
          icon={IndianRupee}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">Revenue Trend (Monthly)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10B981"
                  strokeWidth={2}
                  name="Revenue (₹)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">Orders Volume (Monthly)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Legend />
                <Bar dataKey="orders" fill="#3B82F6" name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-400" />
            Recent Live Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading ? (
              <p className="text-gray-400 text-center py-4">Waiting for live data...</p>
            ) : recentOrders.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No recent activity.</p>
            ) : (
              recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 bg-gray-800/40 border border-gray-700/50 rounded-lg hover:bg-gray-800/60 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                      <ShoppingCart className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">New Order #{order.id.slice(0, 6)}</p>
                      <p className="text-gray-400 text-sm">by {order.customerName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-medium font-mono">₹{order.total}</p>
                    <p className="text-gray-500 text-xs">
                      {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
