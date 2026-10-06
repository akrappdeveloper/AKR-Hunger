'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, formatOrderId } from '@/lib/types';
import {
  Clock, CheckCircle, Truck, AlertCircle, ShoppingCart,
  Search, Package,
  ChefHat, ArrowRight, Timer, Users, Radio, Filter, MapPin,
  Ban, IndianRupee, X, RotateCcw
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
import { Spinner } from '@/components/ui/spinner';
import { motion, AnimatePresence } from 'framer-motion';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
const statusSteps: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];

const RESTAURANT_CANCEL_REASONS = [
  'Out of stock / ingredients not available',
  'Restaurant too busy to fulfill',
  'Order placed incorrectly',
  'Technical issue',
  'Cannot deliver to this location',
  'Other',
];

export default function RestaurantOrdersPage() {
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'shipped' | 'completed'>('active');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Broadcast Dialog
  const [openBroadcastDialog, setOpenBroadcastDialog] = useState(false);
  const [availablePartners, setAvailablePartners] = useState<any[]>([]);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [broadcastMode, setBroadcastMode] = useState<'all' | 'selected'>('all');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  // Cancel Dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTargetOrder, setCancelTargetOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelCustomReason, setCancelCustomReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

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
      const q = query(ordersRef, where('restaurantId', '==', user!.uid));
      const snapshot = await getDocs(q);
      let allOrders = snapshot.docs.map((docSnap) => ({ ...docSnap.data(), id: docSnap.id })) as Order[];

      allOrders = allOrders.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrdersList = allOrders.filter(order => (order.createdAt?.toDate?.() || new Date(0)) >= today);

      setTodayOrders(todayOrdersList.length);
      setActiveOrders(allOrders.filter(o => o.status && ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)).length);
      setPendingOrders(allOrders.filter(o => o.status === 'pending').length);
      setCompletedToday(todayOrdersList.filter(o => o.status === 'delivered').length);

      if (filter === 'active') {
        allOrders = allOrders.filter(order => order.status && ['pending', 'confirmed', 'preparing', 'ready'].includes(order.status) && !order.deliveryPersonId);
      } else if (filter === 'shipped') {
        allOrders = allOrders.filter(order => order.status === 'out_for_delivery' || (order.status && ['ready', 'confirmed'].includes(order.status) && !!order.deliveryPersonId));
      } else if (filter === 'completed') {
        allOrders = allOrders.filter(order => order.status && ['delivered', 'cancelled'].includes(order.status));
      }

      setOrders(allOrders);
    } catch (error) {
      console.error('[Orders] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: new Date()
      });

      // Trigger Notification
      fetch('/api/notifications/order-status', {
        method: 'POST',
        body: JSON.stringify({ orderId, status: newStatus })
      }).catch(err => console.error("Failed to trigger status notification", err));

      fetchOrders();
    } catch (error) { toast.error('Failed to update order status'); }
  };

  const openCancelDialog = (order: Order) => {
    setCancelTargetOrder(order);
    setCancelReason('');
    setCancelCustomReason('');
    setCancelDialogOpen(true);
  };

  const handleRestaurantCancel = async () => {
    if (!cancelTargetOrder?.id || !user) return;
    const reason = cancelReason === 'Other' ? (cancelCustomReason.trim() || 'Other') : cancelReason;
    if (!reason) { toast.error('Please select a cancellation reason'); return; }

    setIsCancelling(true);
    try {
      // Update order status
      await updateDoc(doc(db, 'orders', cancelTargetOrder.id), {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancellationReason: reason,
        cancelledBy: 'RESTAURANT',
        updatedAt: serverTimestamp(),
      });

      // Log cancellation
      await addDoc(collection(db, 'orderCancellations'), {
        orderId: cancelTargetOrder.id,
        userId: cancelTargetOrder.customerId,
        restaurantId: user.uid,
        cancelledBy: 'RESTAURANT',
        reason,
        cancelledAt: serverTimestamp(),
        refundRequired: ['online', 'wallet'].includes(cancelTargetOrder.paymentMethod || '') && cancelTargetOrder.paymentStatus === 'completed',
      });

      // Audit log
      await addDoc(collection(db, 'auditLogs'), {
        action: 'RESTAURANT_CANCELLED',
        orderId: cancelTargetOrder.id,
        restaurantId: user.uid,
        userId: cancelTargetOrder.customerId,
        reason,
        performedBy: 'RESTAURANT',
        timestamp: serverTimestamp(),
      });

      // Customer notification
      if (cancelTargetOrder.customerId) {
        await addDoc(collection(db, 'notifications'), {
          userId: cancelTargetOrder.customerId,
          userType: 'customer',
          type: 'order',
          subType: 'restaurant-cancelled',
          title: 'Order Cancelled by Restaurant',
          message: `Your order #${cancelTargetOrder.id?.substring(0, 8).toUpperCase()} was cancelled by the restaurant. Reason: ${reason}. Our team will process any applicable refund.`,
          isRead: false,
          read: false,
          deleted: false,
          orderId: cancelTargetOrder.id,
          createdAt: serverTimestamp(),
        });
      }

      toast.success('Order cancelled. Refund will be processed automatically.');
      setCancelDialogOpen(false);
      fetchOrders();
    } catch (err) {
      toast.error('Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'pending': return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'confirmed': return <CheckCircle className="w-5 h-5 text-blue-500" />;
      case 'preparing': return <ChefHat className="w-5 h-5 text-orange-500" />;
      case 'ready': return <Package className="w-5 h-5 text-emerald-500" />;
      case 'out_for_delivery': return <Truck className="w-5 h-5 text-purple-500" />;
      case 'delivered': return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      default: return null;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'confirmed': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'preparing': return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
      case 'ready': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'out_for_delivery': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'delivered': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const isPartnerOnline = (p: any) => p.isAvailable === true || p.status === 'online' || p.isOnline === true;

  const openBroadcastModal = async () => {
    setOpenBroadcastDialog(true);
    setLoadingPartners(true);
    try {
      const q = query(collection(db, 'deliveryPersons'));
      const snapshot = await getDocs(q);
      const partners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAvailablePartners(partners);
      const onlineIds = partners.filter(isPartnerOnline).map((p: any) => p.id);
      setSelectedPartnerIds(onlineIds.length > 0 ? onlineIds : partners.map((p: any) => p.id));
      setBroadcastMode('all');
    } catch (error) {
      console.error("Failed to load delivery partners:", error);
      toast.error("Failed to load partners");
    } finally {
      setLoadingPartners(false);
    }
  };

  const handleBroadcast = async () => {
    if (!selectedOrder) return;
    if (broadcastMode === 'selected' && selectedPartnerIds.length === 0) {
      toast.warning("Select at least one partner or choose 'Broadcast to All'");
      return;
    }
    setIsBroadcasting(true);
    try {
      const onlineIds = availablePartners.filter(isPartnerOnline).map((p: any) => p.id);
      // Empty array in targetDeliveryIds allows any online driver to claim
      const targetIds = broadcastMode === 'all'
        ? (onlineIds.length > 0 ? onlineIds : [])
        : selectedPartnerIds;

      await updateDoc(doc(db, 'orders', selectedOrder.id!), {
        status: 'ready',
        targetDeliveryIds: targetIds,
        broadcastVerified: true,
        broadcastAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setSelectedOrder(prev => prev ? {
        ...prev,
        status: 'ready',
        targetDeliveryIds: targetIds,
        broadcastVerified: true
      } : null);

      setOpenBroadcastDialog(false);
      const countLabel = broadcastMode === 'all'
        ? (onlineIds.length > 0 ? `${onlineIds.length} online` : 'all available')
        : `${selectedPartnerIds.length}`;
      toast.success(`Broadcasted to ${countLabel} delivery partners! 🛵`);

      // Trigger In-app notifications in Firestore
      try {
        const notifTargets = broadcastMode === 'all'
          ? (onlineIds.length > 0 ? onlineIds : availablePartners.map((p: any) => p.id))
          : selectedPartnerIds;

        for (const pid of notifTargets) {
          addDoc(collection(db, 'notifications'), {
            userId: pid,
            type: 'order',
            title: '🛵 New Delivery Request',
            message: `Order #${formatOrderId(selectedOrder.id)} from ${selectedOrder.restaurantName || 'Restaurant'} is ready for pickup!`,
            orderId: selectedOrder.id,
            read: false,
            isRead: false,
            createdAt: serverTimestamp()
          }).catch(() => {});
        }
      } catch (e) {
        console.warn("Could not write in-app notifications:", e);
      }

      // Trigger FCM Push Notification
      fetch('/api/notifications/delivery-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          partnerIds: broadcastMode === 'all' ? availablePartners.map((p: any) => p.id) : selectedPartnerIds
        })
      }).catch(err => console.error("Failed to trigger delivery notification", err));

      fetchOrders();
    } catch (error) {
      console.error("Broadcast failed:", error);
      toast.error("Broadcast failed");
    } finally {
      setIsBroadcasting(false);
    }
  };

  const togglePartnerSelection = (id: string) => {
    setSelectedPartnerIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
  };

  const selectAllPartners = () => {
    setSelectedPartnerIds(availablePartners.map((p: any) => p.id));
  };

  const selectOnlyOnlinePartners = () => {
    const onlineIds = availablePartners.filter(isPartnerOnline).map((p: any) => p.id);
    setSelectedPartnerIds(onlineIds);
  };

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return order.id?.toLowerCase().includes(query) || order.customerName?.toLowerCase().includes(query);
  });

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 space-y-8 selection:bg-primary/30 font-sans transition-colors duration-300">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-primary via-indigo-500 to-purple-500 bg-clip-text text-transparent flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 md:w-10 md:h-10 text-primary" /> Live Orders
          </h1>
          <p className="text-muted-foreground mt-2 text-base md:text-lg">Manage and fulfill your customer orders in real-time</p>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Today', value: todayOrders, icon: ShoppingCart, color: 'text-blue-500', gradient: 'from-blue-500/10 to-indigo-500/10' },
          { label: 'Active', value: activeOrders, icon: Clock, color: 'text-orange-500', gradient: 'from-orange-500/10 to-red-500/10' },
          { label: 'Pending', value: pendingOrders, icon: AlertCircle, color: 'text-amber-500', gradient: 'from-amber-500/10 to-yellow-500/10' },
          { label: 'Completed', value: completedToday, icon: CheckCircle, color: 'text-emerald-500', gradient: 'from-emerald-500/10 to-green-500/10' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}>
            <Card className={`p-5 bg-card/60 bg-gradient-to-br ${stat.gradient} border-border backdrop-blur-md relative overflow-hidden group hover:border-primary/30 transition-all`}>
              <div className="flex items-center gap-4 relative z-10">
                <div className={`p-3 rounded-xl bg-muted/60 ${stat.color} ring-1 ring-border`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{stat.value}</p>
                </div>
              </div>
              <div className={`absolute -right-6 -bottom-6 w-24 h-24 bg-current opacity-10 blur-3xl rounded-full ${stat.color}`} />
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search Order ID, Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 bg-card border-border text-foreground placeholder:text-muted-foreground h-12 rounded-xl focus:border-primary/50 focus:ring-primary/20 transition-all"
          />
        </div>
        <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
          {(['all', 'active', 'shipped', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 sm:px-6 py-2 rounded-lg text-sm font-semibold transition-all ${filter === f
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Orders List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Filter className="w-5 h-5 text-muted-foreground" />
            {filter === 'all' ? 'All Orders' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Orders`}
          </h2>
          <div className="space-y-3">
            <AnimatePresence>
              {filteredOrders.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 text-center bg-card/40 border-border border-dashed rounded-3xl">
                  <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-60" />
                  <p className="text-muted-foreground text-lg">No orders found matching your criteria</p>
                </motion.div>
              ) : (
                filteredOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    layout
                    onClick={() => setSelectedOrder(order)}
                  >
                    <Card className={`p-5 cursor-pointer transition-all border-border hover:border-primary/50 hover:bg-muted/30 group ${selectedOrder?.id === order.id ? 'bg-primary/10 border-primary ring-1 ring-primary/50' : 'bg-card'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl bg-muted border border-border`}>
                            {getStatusIcon(order.status)}
                          </div>
                          <div>
                            <h4 className="font-bold text-foreground text-lg">#{formatOrderId(order.id)}</h4>
                            <p className="text-sm text-muted-foreground">{order.customerName} • {order.items?.length} items</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-foreground mb-1">₹{order.total}</p>
                          <Badge variant="outline" className={`${getStatusColor(order.status)} border font-medium`}>
                            {order.status?.replace('_', ' ') || 'Pending'}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Quick Actions Panel (Sticky) */}
          {selectedOrder && selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && !selectedOrder.deliveryPersonId && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="sticky bottom-6 z-20 p-4 bg-card/95 border border-border rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center gap-4 backdrop-blur-xl"
            >
              <div className="flex-1 flex gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 hide-scrollbar">
                {statusSteps.filter(s => !['out_for_delivery', 'delivered'].includes(s)).map((status) => (
                  <Button
                    key={status}
                    onClick={() => handleStatusUpdate(selectedOrder.id!, status)}
                    disabled={selectedOrder.status === status}
                    size="sm"
                    variant="outline"
                    className={`shrink-0 border-border ${selectedOrder.status === status ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  >
                    {status.replace('_', ' ')}
                  </Button>
                ))}
              </div>
              <Button
                onClick={openBroadcastModal}
                className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-900/40 whitespace-nowrap"
              >
                <Radio className="w-4 h-4 mr-2 animate-pulse" /> Broadcast
              </Button>
            </motion.div>
          )}
        </div>

        {/* Order Details Panel */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-foreground">Order Details</h2>
          <AnimatePresence mode="wait">
            {selectedOrder ? (
              <motion.div
                key={selectedOrder.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Card className="bg-card border-border overflow-hidden shadow-2xl sticky top-8">
                  <div className="p-6 border-b border-border bg-muted/40">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <Badge variant="outline" className="mb-2 border-border text-muted-foreground font-mono">#{formatOrderId(selectedOrder.id)}</Badge>
                        <h3 className="text-3xl font-bold text-foreground">₹{selectedOrder.total}</h3>
                      </div>
                      <div className={`p-2 rounded-lg ${getStatusColor(selectedOrder.status)}`}>
                        {getStatusIcon(selectedOrder.status)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background/50 p-2.5 rounded-lg border border-border/50">
                      <MapPin className="w-4 h-4 text-primary shrink-0" />
                      <span className="truncate max-w-[250px]">{typeof selectedOrder.deliveryAddress === 'string' ? selectedOrder.deliveryAddress : 'Address details'}</span>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Items</h4>
                      <div className="space-y-3">
                        {selectedOrder.items?.map((item, i) => (
                          <div key={i} className="flex justify-between items-center text-sm p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors border border-border/40">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center justify-center w-6 h-6 rounded bg-primary/10 text-primary text-xs font-bold">{item.quantity}x</span>
                              <span className="text-foreground font-medium">{item.name}</span>
                            </div>
                            <span className="text-muted-foreground font-semibold">₹{(item.price * item.quantity).toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border space-y-2 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span>₹{selectedOrder.subtotal}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Delivery</span>
                        <span>₹{selectedOrder.deliveryCharge}</span>
                      </div>
                      <div className="flex justify-between text-foreground font-bold text-lg pt-2 border-t border-border">
                        <span>Total</span>
                        <span className="text-emerald-500">₹{selectedOrder.total}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border border-border border-dashed rounded-2xl bg-card/40">
                <Package className="w-12 h-12 mb-3 opacity-40" />
                <p>Select an order to view details</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Broadcast Dialog */}
      <Dialog open={openBroadcastDialog} onOpenChange={setOpenBroadcastDialog}>
        <DialogContent className="bg-card border-border text-card-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Radio className="w-5 h-5 text-purple-500 animate-pulse" />
              Broadcast Delivery Request
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Order #{formatOrderId(selectedOrder?.id)} · ₹{selectedOrder?.total}
            </DialogDescription>
          </DialogHeader>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setBroadcastMode('all')}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                broadcastMode === 'all'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              ⚡ All Online Riders
            </button>
            <button
              type="button"
              onClick={() => setBroadcastMode('selected')}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                broadcastMode === 'selected'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              🎯 Specific Riders
            </button>
          </div>

          {broadcastMode === 'all' ? (
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-2">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500"></span>
                </span>
                Open Broadcast to All Riders
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This order will be broadcast to all online delivery partners ({availablePartners.filter(isPartnerOnline).length} currently online). The first partner to accept claims the delivery!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">
                  {selectedPartnerIds.length} of {availablePartners.length} selected
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectOnlyOnlinePartners}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Online Only
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={selectAllPartners}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Select All
                  </button>
                </div>
              </div>

              <div className="py-2 space-y-2 max-h-[260px] overflow-y-auto">
                {availablePartners.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No registered delivery partners found.
                  </div>
                ) : (
                  availablePartners.map(partner => {
                    const online = isPartnerOnline(partner);
                    return (
                      <div
                        key={partner.id}
                        onClick={() => togglePartnerSelection(partner.id)}
                        className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${
                          selectedPartnerIds.includes(partner.id)
                            ? 'bg-primary/10 border-primary/50 ring-1 ring-primary/30'
                            : 'bg-muted/30 border-border hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex-1">
                          <p className="font-bold text-foreground text-sm">{partner.name || 'Partner'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className={
                                online
                                  ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
                                  : 'text-muted-foreground border-border'
                              }
                            >
                              {online ? 'Online' : 'Offline'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{partner.vehicle || 'Bike'}</span>
                          </div>
                        </div>
                        <Checkbox
                          checked={selectedPartnerIds.includes(partner.id)}
                          className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={handleBroadcast}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold h-11"
              disabled={isBroadcasting || (broadcastMode === 'selected' && selectedPartnerIds.length === 0)}
            >
              {isBroadcasting ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" /> Broadcasting...
                </>
              ) : (
                <>
                  <Radio className="w-4 h-4 mr-2 animate-pulse" /> Broadcast Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restaurant Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="bg-card border-border text-card-foreground max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-500" /> Cancel Order
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Order #{formatOrderId(cancelTargetOrder?.id)} · ₹{cancelTargetOrder?.total}
            </DialogDescription>
          </DialogHeader>

          {cancelTargetOrder && ['online', 'wallet'].includes(cancelTargetOrder.paymentMethod || '') && cancelTargetOrder.paymentStatus === 'completed' && (
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <IndianRupee className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                This order was paid online. A refund of ₹{cancelTargetOrder.total?.toFixed(2)} will be automatically processed after cancellation.
              </p>
            </div>
          )}

          <p className="text-sm font-bold mt-1">Reason for cancellation</p>
          <div className="space-y-2">
            {RESTAURANT_CANCEL_REASONS.map(r => (
              <button key={r}
                onClick={() => setCancelReason(r)}
                className={`w-full text-left px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all ${
                  cancelReason === r
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'border-border hover:bg-muted'
                }`}>
                {cancelReason === r ? '✔ ' : ''}{r}
              </button>
            ))}
          </div>

          {cancelReason === 'Other' && (
            <textarea
              value={cancelCustomReason}
              onChange={e => setCancelCustomReason(e.target.value)}
              placeholder="Please describe your reason..."
              rows={2}
              className="w-full rounded-2xl border border-border bg-muted/40 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}

          <DialogFooter className="gap-3 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}
              className="flex-1 rounded-xl" disabled={isCancelling}>
              Keep Order
            </Button>
            <Button
              id="restaurant-confirm-cancel-btn"
              onClick={handleRestaurantCancel}
              disabled={!cancelReason || isCancelling}
              className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white border-0 font-bold gap-2">
              {isCancelling ? (
                <><RotateCcw className="w-4 h-4 animate-spin" /> Cancelling...</>
              ) : (
                <><Ban className="w-4 h-4" /> Cancel Order</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

