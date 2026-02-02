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
        return { ...data, id: doc.id } as OrderData;
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-gray-400 tracking-tight mb-2">
            Dashboard Overview
          </h1>
          <p className="text-gray-400">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 rounded-full px-4 py-2 border border-white/10">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-green-400">System Online</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <StatCard
          title="Total Customers"
          value={stats.totalCustomers}
          change="Updated live"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Restaurants"
          value={stats.totalRestaurants}
          change="Active partners"
          icon={Store}
          color="green"
        />
        <StatCard
          title="Total Orders"
          value={stats.totalOrders}
          change="Processing now"
          icon={ShoppingCart}
          color="orange"
        />
        <StatCard
          title="Delivery Partners"
          value={stats.totalDeliveryPartners}
          change="On the road"
          icon={Truck}
          color="blue"
        />
        <StatCard
          title="Total Revenue"
          value={`₹${(stats.totalRevenue).toLocaleString()}`}
          change="Gross volume"
          icon={IndianRupee}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-black/40 border-white/10 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 pl-0">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#6B7280"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  dy={10}
                />
                <YAxis
                  stroke="#6B7280"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  tickFormatter={(value) => `₹${value}`}
                  dx={-10}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '12px',
                    color: '#fff',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                  }}
                  itemStyle={{ color: '#fff' }}
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#10B981', strokeWidth: 0 }}
                  activeDot={{ r: 8, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                  fill="url(#colorRevenue)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/10 backdrop-blur-md shadow-xl overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              Order Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 pl-0">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#6B7280"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  dy={10}
                />
                <YAxis
                  stroke="#6B7280"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  dx={-10}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '12px',
                    color: '#fff',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                  }}
                />
                <Bar
                  dataKey="orders"
                  fill="#3B82F6"
                  radius={[6, 6, 0, 0]}
                  barSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-black/40 border-white/10 backdrop-blur-md shadow-xl overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-white/5 pb-4 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-400" />
            Recent Live Activity
          </CardTitle>
          <div className="bg-blue-500/10 text-blue-400 text-xs px-3 py-1 rounded-full border border-blue-500/20 font-medium">
            Last 5 Orders
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-white/5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
                <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p>Connecting to live stream...</p>
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No recent activity recorded today.</div>
            ) : (
              recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors duration-200 group">
                  <div className="flex items-center gap-5">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center border border-white/5 group-hover:border-white/10 transition-colors">
                      <ShoppingCart className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-medium text-sm flex items-center gap-2">
                        Order #{order.id.slice(0, 8)}
                        <span className="text-[10px] bg-white/10 text-gray-400 px-1.5 py-0.5 rounded uppercase tracking-wider">{order.status}</span>
                      </h4>
                      <p className="text-gray-400 text-xs mt-0.5 flex items-center gap-1">
                        Placed by <span className="text-gray-300 font-medium">{order.customerName}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-400 font-bold font-mono text-sm">₹{order.total}</p>
                    <p className="text-gray-500 text-[10px] mt-0.5">
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
