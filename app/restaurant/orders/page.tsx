'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { collection, query, where, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order } from '@/lib/types';
import {
  Clock, CheckCircle, Truck, AlertCircle, ShoppingCart,
  TrendingUp, Search, Phone, MapPin, Printer, Package,
  ChefHat, ArrowRight, Calendar, Timer, Bike, User, Users, Radio
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';

const statusSteps: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];

export default function RestaurantOrdersPage() {
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'shipped' | 'completed'>('active');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deliveryPartner, setDeliveryPartner] = useState<any>(null);

  // Broadcast Dialog
  const [openBroadcastDialog, setOpenBroadcastDialog] = useState(false);
  const [availablePartners, setAvailablePartners] = useState<any[]>([]);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);

  // Statistics
  const [todayOrders, setTodayOrders] = useState(0);
  const [activeOrders, setActiveOrders] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/restaurant/login');
      return;
    }

    fetchOrders();
  }, [user, authLoading, router, filter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const ordersRef = collection(db, 'orders');
      const q = query(
        ordersRef,
        where('restaurantId', '==', user!.uid)
      );

      const snapshot = await getDocs(q);
      let allOrders = snapshot.docs.map((docSnap) => ({
        ...docSnap.data(),
        id: docSnap.id,
      })) as Order[];

      // Sort by createdAt (newest first)
      allOrders = allOrders.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      // Calculate statistics
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayOrdersList = allOrders.filter(order => {
        const orderDate = order.createdAt?.toDate?.() || new Date(0);
        return orderDate >= today;
      });

      setTodayOrders(todayOrdersList.length);
      setActiveOrders(allOrders.filter(o => ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status)).length);
      setPendingOrders(allOrders.filter(o => o.status === 'pending').length);
      setCompletedToday(todayOrdersList.filter(o => o.status === 'delivered').length);

      // Filter based on selected filter
      // Filter based on selected filter
      if (filter === 'active') {
        allOrders = allOrders.filter(order =>
          ['pending', 'confirmed', 'preparing', 'ready'].includes(order.status) && !order.deliveryPersonId
        );
      } else if (filter === 'shipped') {
        allOrders = allOrders.filter(order =>
          order.status === 'out_for_delivery' || (['ready', 'confirmed'].includes(order.status) && !!order.deliveryPersonId)
        );
      } else if (filter === 'completed') {
        allOrders = allOrders.filter(order =>
          ['delivered', 'cancelled'].includes(order.status)
        );
      }

      setOrders(allOrders);
    } catch (error) {
      console.error('[Orders] Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: new Date(),
      });

      setOrders(orders.map((order) =>
        order.id === orderId ? { ...order, status: newStatus } : order
      ));

      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }

      // Refresh to update statistics
      fetchOrders();
    } catch (error) {
      console.error('[Orders] Error updating order:', error);
      toast.error('Failed to update order status');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      case 'confirmed':
        return <CheckCircle className="w-5 h-5 text-blue-400" />;
      case 'preparing':
        return <ChefHat className="w-5 h-5 text-orange-400" />;
      case 'ready':
        return <Package className="w-5 h-5 text-green-400" />;
      case 'out_for_delivery':
        return <Truck className="w-5 h-5 text-purple-400" />;
      case 'delivered':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'confirmed':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'preparing':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'ready':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'out_for_delivery':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'delivered':
        return 'bg-green-600/30 text-green-200 border-green-600/40';
      case 'cancelled':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getTimeSince = (date: any) => {
    if (!date) return '';
    const orderDate = date.toDate?.() || new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - orderDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const downloadInvoice = () => {
    if (!selectedOrder) return;

    // Create invoice HTML
    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice #${selectedOrder.id?.slice(0, 8).toUpperCase()}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Arial', sans-serif; padding: 40px; background: white; }
          .invoice-container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #ff6b00; padding-bottom: 20px; margin-bottom: 30px; }
          .logo-section { display: flex; align-items: center; gap: 15px; }
          .logo { width: 60px; height: 60px; }
          .company-name { font-size: 28px; font-weight: bold; color: #ff6b00; }
          .invoice-title { text-align: right; }
          .invoice-title h1 { font-size: 32px; color: #333; margin-bottom: 5px; }
          .invoice-number { color: #666; font-size: 14px; }
          .info-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .info-box { flex: 1; }
          .info-box h3 { color: #ff6b00; font-size: 14px; margin-bottom: 10px; text-transform: uppercase; }
          .info-box p { color: #333; line-height: 1.6; margin-bottom: 5px; }
          .items-table { width: 100%; border-collapse: collapse; margin: 30px 0; }
          .items-table th { background: #ff6b00; color: white; padding: 12px; text-align: left; }
          .items-table td { padding: 12px; border-bottom: 1px solid #eee; }
          .items-table tr:hover { background: #f9f9f9; }
          .totals { margin-top: 20px; text-align: right; }
          .total-row { display: flex; justify-content: flex-end; gap: 100px; padding: 8px 0; font-size: 14px; }
          .total-row.grand { font-size: 18px; font-weight: bold; color: #ff6b00; border-top: 2px solid #333; margin-top: 10px; padding-top: 15px; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee; text-align: center; color: #666; font-size: 12px; }
          .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; text-transform: uppercase; font-size: 12px; font-weight: bold; }
          .status-pending { background: #fff3cd; color: #856404; }
          .status-confirmed { background: #e3f2fd; color: #1976d2; }
          .status-preparing { background: #ffe0b2; color: #e65100; }
          .status-ready { background: #c8e6c9; color: #2e7d32; }
          .status-out_for_delivery { background: #e1bee7; color: #6a1b9a; }
          .status-delivered { background: #e8f5e9; color: #388e3c; }
          .payment-info { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
          @media print {
            body { padding: 0; background: white; }
            .invoice-container { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- Header -->
          <div class="header">
            <div class="logo-section">
              <img src="/akrhunger.png" alt="AKR Hunger Logo" class="logo">
              <div class="company-name">AKR Hunger</div>
            </div>
            <div class="invoice-title">
              <h1>INVOICE</h1>
              <p class="invoice-number">#${selectedOrder.id?.slice(0, 8).toUpperCase()}</p>
              <p class="invoice-number">${new Date(selectedOrder.createdAt?.toDate?.() || new Date()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          </div>

          <!-- Restaurant & Customer Info -->
          <div class="info-section">
            <div class="info-box">
              <h3>From: Restaurant</h3>
              <p><strong>${restaurant?.name || 'Restaurant Name'}</strong></p>
              <p>${restaurant?.street || restaurant?.address || 'Restaurant Address'}</p>
              <p>${restaurant?.city ? `${restaurant.city}, ${restaurant.state || ''} - ${restaurant.pincode || ''}` : ''}</p>
            </div>
            <div class="info-box">
              <h3>To: Customer</h3>
              <p><strong>${selectedOrder.customerName}</strong></p>
              <p>Phone: ${selectedOrder.customerPhone}</p>
              <p>${formatAddress(selectedOrder.deliveryAddress)}</p>
            </div>
            <div class="info-box">
              <h3>Order Status</h3>
              <p><span class="status-badge status-${selectedOrder.status}">${selectedOrder.status?.replace('_', ' ').toUpperCase()}</span></p>
              <p style= "margin-top: 10px;"><strong>Order Date:</strong><br/>${new Date(selectedOrder.createdAt?.toDate?.() || new Date()).toLocaleString('en-IN')}</p>
            </div>
          </div>

          <!-- Items Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${selectedOrder.items?.map(item => `
                <tr>
                  <td><strong>${item.name}</strong></td>
                  <td>${item.quantity}</td>
                  <td>₹${item.price.toFixed(2)}</td>
                  <td>₹${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Payment Details -->
          <div class="payment-info">
            <h3 style="color: #ff6b00; margin-bottom: 10px;">Payment Information</h3>
            <p><strong>Payment Method:</strong> ${selectedOrder.paymentMethod || 'Cash on Delivery'}</p>
            <p><strong>Payment Status:</strong> ${selectedOrder.paymentStatus || 'Pending'}</p>
          </div>

          <!-- Totals -->
          <div class="totals">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>₹${selectedOrder.subtotal}</span>
            </div>
            <div class="total-row">
              <span>Delivery Charges:</span>
              <span>₹${selectedOrder.deliveryCharge}</span>
            </div>
            <div class="total-row">
              <span>Tax & Fees:</span>
              <span>₹${selectedOrder.taxes}</span>
            </div>
            <div class="total-row grand">
              <span>GRAND TOTAL:</span>
              <span>₹${selectedOrder.total}</span>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p><strong>Thank you for your order!</strong></p>
            <p>AKR Hunger - Food Delivery Platform | www.akrhunger.com</p>
            <p>For any queries, contact us at support@akrhunger.com</p>
          </div>
        </div>
        <script>
          // Auto print on load
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    // Open in new window and trigger print
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(invoiceHTML);
      printWindow.document.close();
    }
  };

  const getNextStatus = (currentStatus: OrderStatus): OrderStatus | null => {
    const currentIndex = statusSteps.indexOf(currentStatus);
    if (currentIndex === -1 || currentIndex === statusSteps.length - 1) return null;
    return statusSteps[currentIndex + 1];
  };

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.id?.toLowerCase().includes(query) ||
      order.customerName?.toLowerCase().includes(query) ||
      order.customerPhone?.includes(query)
    );
  });

  const getCurrentStepIndex = (status: OrderStatus) => {
    return statusSteps.indexOf(status);
  };

  const formatAddress = (address: any): string => {
    if (!address) return 'Not provided';
    if (typeof address === 'string') return address;

    // If it's an object, format it nicely
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.pincode) parts.push(address.pincode);
    if (address.country) parts.push(address.country);

    return parts.length > 0 ? parts.join(', ') : 'Not provided';
  };

  const fetchDeliveryPartner = async (partnerId: string) => {
    if (!partnerId) {
      setDeliveryPartner(null);
      return;
    }

    try {
      const partnerDoc = await getDoc(doc(db, 'deliveryPartners', partnerId));
      if (partnerDoc.exists()) {
        setDeliveryPartner({ id: partnerDoc.id, ...partnerDoc.data() });
      } else {
        setDeliveryPartner(null);
      }
    } catch (error) {
      console.error('[Orders] Error fetching delivery partner:', error);
      setDeliveryPartner(null);
    }
  };

  // Fetch delivery partner when selected order changes
  useEffect(() => {
    if (selectedOrder?.deliveryPartnerId) {
      fetchDeliveryPartner(selectedOrder.deliveryPartnerId);
    } else {
      setDeliveryPartner(null);
    }
  }, [selectedOrder]);

  const openBroadcastModal = async () => {
    setOpenBroadcastDialog(true);
    setLoadingPartners(true);
    try {
      const q = query(collection(db, 'deliveryPersons'));
      const snapshot = await getDocs(q);
      const partners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAvailablePartners(partners);
      // Default to select all available (online) partners
      const onlineIds = partners.filter((p: any) => p.isAvailable).map((p: any) => p.id);
      setSelectedPartnerIds(onlineIds);
    } catch (error) {
      console.error("Error fetching partners:", error);
      toast.error("Failed to load delivery partners");
    } finally {
      setLoadingPartners(false);
    }
  };

  const handleBroadcast = async () => {
    if (!selectedOrder) return;

    // logic: if ALL selected or specific selected
    // If selectedPartnerIds matches all available partners, we can treat it as 'broadcast to all' 
    // or we just save the list. saving list is safer for targeting.
    // If list is empty -> select all (fallback) or error? Let's error if none selected.

    if (selectedPartnerIds.length === 0) {
      toast.warning("Please select at least one delivery partner");
      return;
    }

    try {
      await updateDoc(doc(db, 'orders', selectedOrder.id!), {
        status: 'ready', // Ensure listening apps pick it up
        targetDeliveryIds: selectedPartnerIds,
        broadcastVerified: true, // Internal flag
        updatedAt: new Date()
      });

      setOpenBroadcastDialog(false);
      toast.success(`Order broadcasted to ${selectedPartnerIds.length} partners!`);
      fetchOrders();
    } catch (error) {
      console.error("Error broadcasting:", error);
      toast.error("Failed to broadcast order");
    }
  };

  const togglePartnerSelection = (id: string) => {
    setSelectedPartnerIds(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const selectAllPartners = (onlineOnly: boolean) => {
    if (onlineOnly) {
      setSelectedPartnerIds(availablePartners.filter((p: any) => p.isAvailable).map((p: any) => p.id));
    } else {
      setSelectedPartnerIds(availablePartners.map(p => p.id));
    }
  };

  if (authLoading || loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-800/50 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-300 bg-clip-text text-transparent flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <ShoppingCart className="w-7 h-7 text-white" />
            </div>
            Orders
          </h1>
          <p className="text-gray-200 mt-2 text-lg font-medium">Manage and fulfill customer orders</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-900/30 to-gray-900/50 border-blue-500/20 backdrop-blur-sm hover:shadow-xl hover:shadow-blue-500/20 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 rounded-lg ring-2 ring-blue-500/30">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-blue-200 font-semibold">Today</p>
              <p className="text-2xl font-bold text-white">{todayOrders}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-orange-900/30 to-gray-900/50 border-orange-500/20 backdrop-blur-sm hover:shadow-xl hover:shadow-orange-500/20 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-500/20 rounded-lg ring-2 ring-orange-500/30">
              <Clock className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-orange-200 font-semibold">Active</p>
              <p className="text-2xl font-bold text-white">{activeOrders}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-yellow-900/30 to-gray-900/50 border-yellow-500/20 backdrop-blur-sm hover:shadow-xl hover:shadow-yellow-500/20 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-500/20 rounded-lg ring-2 ring-yellow-500/30">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-yellow-200 font-semibold">Pending</p>
              <p className="text-2xl font-bold text-white">{pendingOrders}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-900/30 to-gray-900/50 border-green-500/20 backdrop-blur-sm hover:shadow-xl hover:shadow-green-500/20 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/20 rounded-lg ring-2 ring-green-500/30">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-green-200 font-semibold">Completed</p>
              <p className="text-2xl font-bold text-white">{completedToday}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Search by order ID, customer name, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 h-12"
          />
        </div>
        <div className="flex gap-3">
          {(['all', 'active', 'shipped', 'completed'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => setFilter(f)}
              className={filter === f
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 font-bold'
                : 'bg-gray-800/50 border-gray-700 text-white hover:bg-gray-700 font-semibold'}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders List */}
        {/* Orders List & Quick Actions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="space-y-3">
            {filteredOrders.length === 0 ? (
              <Card className="p-12 text-center bg-gray-900/50 border-gray-800 backdrop-blur-sm">
                <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-300 text-lg font-semibold">No orders found</p>
                <p className="text-gray-400 text-sm mt-2 font-medium">
                  {searchQuery ? 'Try a different search term' : 'Orders will appear here once customers place them'}
                </p>
              </Card>
            ) : (
              filteredOrders.map((order) => (
                <Card
                  key={order.id}
                  className={`p-5 cursor-pointer transition-all bg-gray-800/50 border-gray-700 hover:bg-gray-800/70 hover:border-gray-600 shadow-lg hover:shadow-xl ${selectedOrder?.id === order.id ? 'ring-2 ring-blue-500 bg-gray-800/70' : ''
                    }`}
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(order.status)}
                        <div>
                          <p className="font-bold text-white text-lg">
                            Order #{order.id?.slice(0, 8).toUpperCase()}
                          </p>
                          <p className="text-sm text-gray-300 font-medium">
                            {order.customerName || 'Customer'} • {order.items?.length || 0} items
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                        <Timer className="w-3 h-3" />
                        {getTimeSince(order.createdAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-white text-xl mb-2">₹{order.total}</p>
                      <Badge className={`${getStatusColor(order.status)} font-bold px-3 py-1 border`}>
                        {order.status?.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Quick Status Actions - Now inside the main column */}
          {selectedOrder &&
            selectedOrder.status !== 'delivered' &&
            selectedOrder.status !== 'cancelled' &&
            selectedOrder.status !== 'out_for_delivery' &&
            !selectedOrder.deliveryPersonId && (
              <Card className="p-5 bg-gray-900/50 border-gray-800 backdrop-blur-sm sticky bottom-4 shadow-2xl ring-1 ring-white/10">
                <h3 className="text-white font-bold mb-4 text-lg flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-blue-400" />
                  Quick Status Actions
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {statusSteps.filter(s => !['out_for_delivery', 'delivered'].includes(s)).map((status) => (
                    <Button
                      key={status}
                      onClick={() => handleStatusUpdate(selectedOrder.id || '', status)}
                      disabled={selectedOrder.status === status}
                      size="sm"
                      className={`${selectedOrder.status === status
                        ? getStatusColor(status) + ' text-white ring-2 ring-white/30'
                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border-gray-700'
                        } font-semibold transition-all flex items-center justify-center gap-2 h-12`}
                    >
                      {getStatusIcon(status)}
                      <span className="text-xs capitalize">{status.replace('_', ' ')}</span>
                    </Button>
                  ))}
                </div>

                {/* Broadcast Button */}
                {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && !selectedOrder.deliveryPersonId && (
                  <Button
                    onClick={openBroadcastModal}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold shadow-lg shadow-purple-500/30 h-12"
                  >
                    <Users className="w-5 h-5 mr-2" />
                    Broadcast to Delivery Partners
                  </Button>
                )}
              </Card>
            )}
        </div>

        {/* Broadcast Dialog */}
        <Dialog open={openBroadcastDialog} onOpenChange={setOpenBroadcastDialog}>
          <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>Broadcast Order</DialogTitle>
              <DialogDescription className="text-gray-400">
                Select delivery partners to receive this order request.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectAllPartners(true)}
                  className="flex-1 bg-gray-800 border-gray-700 hover:bg-gray-700 text-white"
                >
                  Select Online ({availablePartners.filter((p: any) => p.isAvailable).length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectAllPartners(false)}
                  className="flex-1 bg-gray-800 border-gray-700 hover:bg-gray-700 text-white"
                >
                  Select All ({availablePartners.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPartnerIds([])}
                  className="bg-gray-800 border-gray-700 hover:bg-gray-700 text-white"
                >
                  Clear
                </Button>
              </div>

              <ScrollArea className="h-[300px] rounded-md border border-gray-800 bg-gray-900/50 p-4">
                {loadingPartners ? (
                  <div className="flex justify-center items-center h-full text-gray-400">Loading partners...</div>
                ) : availablePartners.length === 0 ? (
                  <div className="flex justify-center items-center h-full text-gray-400">No delivery partners found</div>
                ) : (
                  <div className="space-y-2">
                    {availablePartners.map((partner: any) => (
                      <div
                        key={partner.id}
                        className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedPartnerIds.includes(partner.id)
                          ? 'bg-blue-900/20 border-blue-500/50'
                          : 'bg-gray-800/30 border-gray-800 hover:bg-gray-800'
                          }`}
                        onClick={() => togglePartnerSelection(partner.id)}
                      >
                        <Checkbox
                          checked={selectedPartnerIds.includes(partner.id)}
                          // onClick handled by parent div for better UX
                          className="border-gray-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        />
                        <div className="flex-1">
                          <div className="flex justify-between items-center">
                            <p className="font-medium text-white">{partner.name || 'Unnamed Partner'}</p>
                            <Badge className={`text-[10px] px-2 py-0 h-5 ${partner.isAvailable
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/20'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-700'
                              }`}>
                              {partner.isAvailable ? 'ONLINE' : 'OFFLINE'}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-400">{partner.vehicle || 'Unknown Vehicle'} • {partner.phone || 'No Phone'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="flex justify-between items-center text-sm text-gray-400 px-1">
                <span>Selected: <span className="text-white font-bold">{selectedPartnerIds.length}</span></span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpenBroadcastDialog(false)} className="text-gray-400 hover:text-white">Cancel</Button>
              <Button
                onClick={handleBroadcast}
                disabled={selectedPartnerIds.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                <Radio className={`w-4 h-4 mr-2 ${selectedPartnerIds.length > 0 ? 'animate-pulse' : ''}`} />
                Broadcast Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Order Details */}
        {selectedOrder ? (
          <Card className="p-6 lg:sticky lg:top-8 lg:h-fit bg-gray-900/50 border-gray-800 backdrop-blur-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-700">
              <h2 className="text-2xl font-bold text-white">
                Order #{selectedOrder.id?.slice(0, 8).toUpperCase()}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadInvoice}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 border-0 text-white shadow-lg shadow-green-500/30"
              >
                <Package className="w-4 h-4 mr-2" />
                Download Invoice
              </Button>
            </div>

            {/* Order Timeline */}
            {selectedOrder.status !== 'cancelled' && (
              <div className="mb-6 pb-6 border-b border-gray-700">
                <h3 className="font-bold text-white mb-4 text-lg">Order Progress</h3>
                <div className="relative">
                  {statusSteps.map((step, idx) => {
                    const currentIndex = getCurrentStepIndex(selectedOrder.status as OrderStatus);
                    const isCompleted = idx <= currentIndex;
                    const isCurrent = idx === currentIndex;

                    return (
                      <div key={step} className="flex items-center gap-3 mb-4 last:mb-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${isCompleted
                          ? 'bg-blue-500 border-blue-500'
                          : 'bg-gray-800 border-gray-600'
                          } ${isCurrent ? 'ring-4 ring-blue-500/30 scale-110' : ''}`}>
                          {getStatusIcon(step)}
                        </div>
                        <div className="flex-1">
                          <p className={`font-semibold text-sm ${isCompleted ? 'text-white' : 'text-gray-400'
                            }`}>
                            {step.replace('_', ' ').toUpperCase()}
                          </p>
                        </div>
                        {isCurrent && (
                          <Badge className="bg-blue-500 text-white font-bold animate-pulse">
                            Current
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Status Update - conditioned to hide if next status is restricted or not available */}
            {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' &&
              getNextStatus(selectedOrder.status as OrderStatus) &&
              !['out_for_delivery', 'delivered'].includes(getNextStatus(selectedOrder.status as OrderStatus)!) && (
                <div className="mb-6 pb-6 border-b border-gray-700">
                  <h3 className="text-white font-bold mb-3 text-lg">Quick Actions</h3>
                  <Button
                    onClick={() => handleStatusUpdate(selectedOrder.id || '', getNextStatus(selectedOrder.status as OrderStatus)!)}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 font-bold shadow-lg shadow-blue-500/30 mb-2"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Move to {getNextStatus(selectedOrder.status as OrderStatus)?.replace('_', ' ')}
                  </Button>
                </div>
              )}

            {/* Items */}
            <div className="mb-6 pb-6 border-b border-gray-700">
              <h3 className="font-bold text-white mb-3 text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-400" />
                Items
              </h3>
              <div className="space-y-2 bg-gray-800/30 rounded-lg p-4">
                {selectedOrder.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm py-2 border-b border-gray-700/50 last:border-0">
                    <span className="text-gray-200 font-medium">
                      {item.quantity}x {item.name}
                    </span>
                    <span className="font-bold text-white">₹{(item.price * (item.quantity || 1)).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer & Delivery Info */}
            <div className="mb-6 pb-6 border-b border-gray-700">
              <h3 className="font-bold text-white mb-3 text-lg">Customer & Delivery</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 bg-gray-800/30 rounded-lg p-3">
                  <Phone className="w-5 h-5 text-green-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-400 font-semibold">Customer</p>
                    <p className="text-white font-medium">{selectedOrder.customerName}</p>
                    <a href={`tel:${selectedOrder.customerPhone}`} className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                      {selectedOrder.customerPhone}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-gray-800/30 rounded-lg p-3">
                  <MapPin className="w-5 h-5 text-red-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-400 font-semibold">Delivery Address</p>
                    <p className="text-gray-200 text-sm font-medium">{formatAddress(selectedOrder.deliveryAddress)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery Partner Info */}
            {deliveryPartner && selectedOrder.status !== 'pending' && selectedOrder.status !== 'cancelled' && (
              <div className="mb-6 pb-6 border-b border-gray-700">
                <h3 className="font-bold text-white mb-3 text-lg flex items-center gap-2">
                  <Bike className="w-5 h-5 text-purple-400" />
                  Delivery Partner
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-purple-900/20 rounded-lg p-3 border border-purple-500/30">
                    <User className="w-5 h-5 text-purple-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-purple-300 font-semibold">Partner Name</p>
                      <p className="text-white font-medium">{deliveryPartner.name || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-green-900/20 rounded-lg p-3 border border-green-500/30">
                    <Phone className="w-5 h-5 text-green-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-green-300 font-semibold">Contact Number</p>
                      <a
                        href={`tel:${deliveryPartner.phone}`}
                        className="text-green-300 hover:text-green-200 font-medium text-base flex items-center gap-2 transition-colors"
                      >
                        {deliveryPartner.phone}
                        <Phone className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-blue-900/20 rounded-lg p-3 border border-blue-500/30">
                    <Truck className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-blue-300 font-semibold">Vehicle Type</p>
                      <p className="text-white font-medium capitalize">{deliveryPartner.vehicleType || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Show message if no delivery partner assigned yet */}
            {!deliveryPartner && (selectedOrder.status === 'out_for_delivery' || selectedOrder.status === 'ready' || selectedOrder.status === 'developing' || selectedOrder.status === 'prepared' || selectedOrder.status === 'preparing' || selectedOrder.status === 'confirmed') && (
              <div className="mb-6 pb-6 border-b border-gray-700">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3 bg-yellow-900/20 rounded-lg p-3 border border-yellow-500/30">
                    <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-yellow-300 font-semibold">Delivery Partner</p>
                      <p className="text-gray-300 text-sm">No delivery partner assigned yet</p>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      // Broadcast Logic: Ensure status is ready/preparing which delivery partners listen to
                      // We'll set it to 'ready' if it's confirmed or preparing, or just re-trigger update to refresh timestamps
                      handleStatusUpdate(selectedOrder.id || '', 'ready');
                      alert("Order broadcasted to all online delivery partners!");
                    }}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold shadow-lg shadow-purple-500/30"
                  >
                    <Truck className="w-4 h-4 mr-2" />
                    Send to Delivery Partners
                  </Button>
                </div>
              </div>
            )}

            {/* Items Section - moved below delivery partner */}
            <div className="mb-6 pb-6 border-b border-gray-700">
              <h3 className="font-bold text-white mb-3 text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-400" />
                Items
              </h3>
              <div className="space-y-2 bg-gray-800/30 rounded-lg p-4">
                {selectedOrder.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm py-2 border-b border-gray-700/50 last:border-0">
                    <span className="text-gray-200 font-medium">
                      {item.quantity}x {item.name}
                    </span>
                    <span className="font-bold text-white">₹{(item.price * (item.quantity || 1)).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Summary */}
            <div className="mb-6 space-y-2 bg-gray-800/30 rounded-lg p-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300 font-medium">Subtotal</span>
                <span className="text-white font-semibold">₹{selectedOrder.subtotal}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-300 font-medium">Delivery</span>
                <span className="text-white font-semibold">₹{selectedOrder.deliveryCharge}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-300 font-medium">Tax</span>
                <span className="text-white font-semibold">₹{selectedOrder.taxes}</span>
              </div>
              <div className="flex justify-between font-bold pt-3 border-t border-gray-700 text-lg">
                <span className="text-white">Total</span>
                <span className="text-green-400">₹{selectedOrder.total}</span>
              </div>
            </div>

            {/* Cancel Order */}
            {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
              <Button
                variant="destructive"
                className="w-full font-bold shadow-lg shadow-red-500/30 hover:shadow-xl"
                onClick={() => {
                  if (confirm('Are you sure you want to cancel this order?')) {
                    handleStatusUpdate(selectedOrder.id || '', 'cancelled');
                  }
                }}
              >
                Cancel Order
              </Button>
            )}
          </Card>
        ) : (
          <Card className="p-12 text-center bg-gray-900/50 border-gray-800 backdrop-blur-sm">
            <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-300 font-semibold">Select an order to view details</p>
          </Card>
        )}
      </div>
    </div>
  );
}
