'use client';

import { useState, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order } from '@/lib/types';
import { calculateDateRange, filterOrdersByDateRange, calculateMetrics, exportToCSV, formatCurrency, formatPercentage } from '@/lib/analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, TrendingUp, Users, DollarSign, ShoppingCart } from 'lucide-react';

export default function AdminReportsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year'>('month');

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const ordersRef = collection(db, 'orders');
        const snapshot = await getDocs(query(ordersRef));
        const ordersData = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Order[];
        setOrders(ordersData);
      } catch (error) {
        console.error('[v0] Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const dateRangeObj = calculateDateRange(dateRange);
  const filteredOrders = filterOrdersByDateRange(orders, dateRangeObj);
  const metrics = calculateMetrics(filteredOrders);

  const handleExport = () => {
    const reportData = filteredOrders.map((order) => ({
      'Order ID': order.id,
      'Customer': order.customerName,
      'Restaurant': order.restaurantName,
      'Status': order.status,
      'Total': formatCurrency(order.total || 0),
      'Date': order.createdAt instanceof Date ? order.createdAt.toLocaleDateString() : 'N/A',
    }));
    exportToCSV(reportData, `orders-report-${dateRange}`);
  };

  const chartData = [
    { name: 'Mon', orders: 24, revenue: 4000 },
    { name: 'Tue', orders: 13, revenue: 3000 },
    { name: 'Wed', orders: 20, revenue: 2000 },
    { name: 'Thu', orders: 39, revenue: 2210 },
    { name: 'Fri', orders: 29, revenue: 2290 },
    { name: 'Sat', orders: 43, revenue: 2300 },
    { name: 'Sun', orders: 35, revenue: 2100 },
  ];

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-2">View comprehensive business analytics and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-4 py-2 border border-input rounded-lg bg-background text-foreground"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
          <Button onClick={handleExport} className="gap-2">
            <Download size={16} />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalOrders}</div>
            <p className="text-xs text-muted-foreground">{metrics.completedOrders} completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Avg {formatCurrency(metrics.averageOrderValue)}/order</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fulfillment Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(metrics.fulfillmentRate / 100)}</div>
            <p className="text-xs text-muted-foreground">{metrics.cancelledOrders} cancelled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">On-Time Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(metrics.onTimeDeliveryRate / 100)}</div>
            <p className="text-xs text-muted-foreground">Avg delivery {metrics.averageDeliveryTime}min</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Orders Trend</CardTitle>
            <CardDescription>Daily order volume over the week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Daily revenue over the week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>Latest orders from the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left py-2 px-2">Order ID</th>
                  <th className="text-left py-2 px-2">Customer</th>
                  <th className="text-left py-2 px-2">Restaurant</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-right py-2 px-2">Amount</th>
                  <th className="text-left py-2 px-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.slice(0, 10).map((order) => (
                  <tr key={order.id} className="border-b border-border hover:bg-accent">
                    <td className="py-2 px-2 font-mono text-xs">{order.id?.substring(0, 8)}</td>
                    <td className="py-2 px-2">{order.customerName || 'N/A'}</td>
                    <td className="py-2 px-2">{order.restaurantName || 'N/A'}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {order.status || 'pending'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right font-semibold">{formatCurrency(order.total || 0)}</td>
                    <td className="py-2 px-2">
                      {order.createdAt instanceof Date 
                        ? order.createdAt.toLocaleDateString()
                        : new Date(order.createdAt || 0).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
