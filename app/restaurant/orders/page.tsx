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
  Search, Package,
  ChefHat, ArrowRight, Timer, Users, Radio, Filter, MapPin
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
      setActiveOrders(allOrders.filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)).length);
      setPendingOrders(allOrders.filter(o => o.status === 'pending').length);
      setCompletedToday(todayOrdersList.filter(o => o.status === 'delivered').length);

      if (filter === 'active') {
        allOrders = allOrders.filter(order => ['pending', 'confirmed', 'preparing', 'ready'].includes(order.status) && !order.deliveryPersonId);
      } else if (filter === 'shipped') {
        allOrders = allOrders.filter(order => order.status === 'out_for_delivery' || (['ready', 'confirmed'].includes(order.status) && !!order.deliveryPersonId));
      } else if (filter === 'completed') {
        allOrders = allOrders.filter(order => ['delivered', 'cancelled'].includes(order.status));
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
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus, updatedAt: new Date() });
      setOrders(orders.map((order) => order.id === orderId ? { ...order, status: newStatus } : order));
      if (selectedOrder?.id === orderId) setSelectedOrder({ ...selectedOrder, status: newStatus });
      fetchOrders();
    } catch (error) { toast.error('Failed to update order status'); }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      case 'confirmed': return <CheckCircle className="w-5 h-5 text-blue-400" />;
      case 'preparing': return <ChefHat className="w-5 h-5 text-orange-400" />;
      case 'ready': return <Package className="w-5 h-5 text-emerald-400" />;
      case 'out_for_delivery': return <Truck className="w-5 h-5 text-purple-400" />;
      case 'delivered': return <CheckCircle className="w-5 h-5 text-green-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20';
      case 'confirmed': return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
      case 'preparing': return 'bg-orange-500/10 text-orange-300 border-orange-500/20';
      case 'ready': return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
      case 'out_for_delivery': return 'bg-purple-500/10 text-purple-300 border-purple-500/20';
      case 'delivered': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-white/5 text-gray-400 border-white/10';
    }
  };

  const openBroadcastModal = async () => {
    setOpenBroadcastDialog(true);
    setLoadingPartners(true);
    try {
      const q = query(collection(db, 'deliveryPersons'));
      const snapshot = await getDocs(q);
      const partners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAvailablePartners(partners);
      const onlineIds = partners.filter((p: any) => p.isAvailable).map((p: any) => p.id);
      setSelectedPartnerIds(onlineIds);
    } catch (error) { toast.error("Failed to load partners"); }
    finally { setLoadingPartners(false); }
  };

  const handleBroadcast = async () => {
    if (!selectedOrder) return;
    if (selectedPartnerIds.length === 0) { toast.warning("Select at least one partner"); return; }
    try {
      await updateDoc(doc(db, 'orders', selectedOrder.id!), {
        status: 'ready', targetDeliveryIds: selectedPartnerIds, broadcastVerified: true, updatedAt: new Date()
      });
      setOpenBroadcastDialog(false);
      toast.success(`Broadcasted to ${selectedPartnerIds.length} partners!`);
      fetchOrders();
    } catch (error) { toast.error("Broadcast failed"); }
  };

  const togglePartnerSelection = (id: string) => {
    setSelectedPartnerIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
  };

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return order.id?.toLowerCase().includes(query) || order.customerName?.toLowerCase().includes(query);
  });

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Spinner className="w-8 h-8 text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 md:p-8 space-y-8 selection:bg-blue-500/30 font-sans">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 bg-clip-text text-transparent flex items-center gap-3">
            <ShoppingCart className="w-10 h-10 text-blue-500" /> Live Orders
          </h1>
          <p className="text-gray-400 mt-2 text-lg">Manage and fulfill your customer orders in real-time</p>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Today', value: todayOrders, icon: ShoppingCart, color: 'text-blue-400', gradient: 'from-blue-500/20 to-indigo-500/20' },
          { label: 'Active', value: activeOrders, icon: Clock, color: 'text-orange-400', gradient: 'from-orange-500/20 to-red-500/20' },
          { label: 'Pending', value: pendingOrders, icon: AlertCircle, color: 'text-yellow-400', gradient: 'from-yellow-500/20 to-amber-500/20' },
          { label: 'Completed', value: completedToday, icon: CheckCircle, color: 'text-emerald-400', gradient: 'from-emerald-500/20 to-green-500/20' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}>
            <Card className={`p-5 bg-gradient-to-br ${stat.gradient} border-white/5 backdrop-blur-md relative overflow-hidden group hover:border-white/20 transition-all`}>
              <div className="flex items-center gap-4 relative z-10">
                <div className={`p-3 rounded-xl bg-black/20 ${stat.color} ring-1 ring-white/10`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-400 font-medium uppercase tracking-wider">{stat.label}</p>
                  <p className="text-3xl font-bold text-white tracking-tight">{stat.value}</p>
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
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
          <Input
            placeholder="Search Order ID, Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-12 rounded-xl focus:border-blue-500/50 focus:ring-blue-500/20 transition-all"
          />
        </div>
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
          {(['all', 'active', 'shipped', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${filter === f
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
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
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            {filter === 'all' ? 'All Orders' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Orders`}
          </h2>
          <div className="space-y-3">
            <AnimatePresence>
              {filteredOrders.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 text-center bg-white/5 border-white/10 border-dashed rounded-3xl">
                  <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg">No orders found matching your criteria</p>
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
                    <Card className={`p-5 cursor-pointer transition-all border-white/10 hover:border-blue-500/50 hover:bg-white/[0.07] group ${selectedOrder?.id === order.id ? 'bg-blue-900/20 border-blue-500/50 ring-1 ring-blue-500/50' : 'bg-white/5'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl bg-black/40 border border-white/5`}>
                            {getStatusIcon(order.status)}
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-lg">#{order.id?.slice(0, 8).toUpperCase()}</h4>
                            <p className="text-sm text-gray-400">{order.customerName} • {order.items?.length} items</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-white mb-1">₹{order.total}</p>
                          <Badge variant="outline" className={`${getStatusColor(order.status)} border-0 font-medium`}>
                            {order.status.replace('_', ' ')}
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
              className="sticky bottom-6 z-20 p-4 bg-[#111] border border-white/10 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center gap-4 backdrop-blur-xl"
            >
              <div className="flex-1 flex gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 hide-scrollbar">
                {statusSteps.filter(s => !['out_for_delivery', 'delivered'].includes(s)).map((status) => (
                  <Button
                    key={status}
                    onClick={() => handleStatusUpdate(selectedOrder.id!, status)}
                    disabled={selectedOrder.status === status}
                    size="sm"
                    variant="outline"
                    className={`shrink-0 border-white/10 ${selectedOrder.status === status ? 'bg-blue-600 text-white border-blue-500' : 'bg-white/5 text-gray-400 hover:text-white'}`}
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
          <h2 className="text-xl font-bold text-white">Order Details</h2>
          <AnimatePresence mode="wait">
            {selectedOrder ? (
              <motion.div
                key={selectedOrder.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Card className="bg-[#0A0A0A] border-white/10 overflow-hidden shadow-2xl sticky top-8">
                  <div className="p-6 border-b border-white/10 bg-gradient-to-br from-gray-900 to-black">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <Badge variant="outline" className="mb-2 border-white/10 text-gray-400 font-mono">#{selectedOrder.id?.slice(0, 8)}</Badge>
                        <h3 className="text-3xl font-bold text-white">₹{selectedOrder.total}</h3>
                      </div>
                      <div className={`p-2 rounded-lg ${getStatusColor(selectedOrder.status)}`}>
                        {getStatusIcon(selectedOrder.status)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-400 bg-white/5 p-2 rounded-lg">
                      <MapPin className="w-4 h-4 text-blue-400" />
                      <span className="truncate max-w-[250px]">{typeof selectedOrder.deliveryAddress === 'string' ? selectedOrder.deliveryAddress : 'Address details'}</span>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Items</h4>
                      <div className="space-y-3">
                        {selectedOrder.items?.map((item, i) => (
                          <div key={i} className="flex justify-between items-center text-sm p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center justify-center w-6 h-6 rounded bg-white/10 text-white text-xs font-bold">{item.quantity}x</span>
                              <span className="text-white font-medium">{item.name}</span>
                            </div>
                            <span className="text-gray-400">₹{(item.price * item.quantity).toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/10 space-y-2 text-sm">
                      <div className="flex justify-between text-gray-400">
                        <span>Subtotal</span>
                        <span>₹{selectedOrder.subtotal}</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Delivery</span>
                        <span>₹{selectedOrder.deliveryCharge}</span>
                      </div>
                      <div className="flex justify-between text-white font-bold text-lg pt-2">
                        <span>Total</span>
                        <span className="text-green-400">₹{selectedOrder.total}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-gray-500 border border-white/5 rounded-2xl bg-white/[0.02]">
                <Package className="w-12 h-12 mb-3 opacity-50" />
                <p>Select an order to view details</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Broadcast Dialog */}
      <Dialog open={openBroadcastDialog} onOpenChange={setOpenBroadcastDialog}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Broadcast Request</DialogTitle>
            <DialogDescription className="text-gray-400">
              Found {availablePartners.length} partners. Select who should receive this order.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 max-h-[300px] overflow-y-auto">
            {availablePartners.map(partner => (
              <div key={partner.id} onClick={() => togglePartnerSelection(partner.id)} className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${selectedPartnerIds.includes(partner.id) ? 'bg-blue-900/30 border-blue-500/50' : 'bg-white/5 border-white/10'}`}>
                <div className="flex-1">
                  <p className="font-bold text-white">{partner.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className={partner.isAvailable ? 'text-green-400 border-green-500/30' : 'text-gray-500'}>{partner.isAvailable ? 'Online' : 'Offline'}</Badge>
                    <span className="text-xs text-gray-500">{partner.vehicle}</span>
                  </div>
                </div>
                <Checkbox checked={selectedPartnerIds.includes(partner.id)} className="border-white/30 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600" />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={handleBroadcast} className="w-full bg-blue-600 hover:bg-blue-700 font-bold" disabled={selectedPartnerIds.length === 0}>
              Broadcast Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
