'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/spinner';
import {
  MapPin,
  Phone,
  Clock,
  DollarSign,
  Navigation,
  CheckCircle,
  Smartphone,
  Power,
  ShoppingBag,
  X,
  Package,
  Bike,
  ArrowRight,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { Order } from '@/lib/types';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  updateDoc,
  doc,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from 'framer-motion';

export default function DeliveryDashboard() {
  const router = useRouter();
  const { user, deliveryPartner, loading: authLoading } = useDeliveryAuth();
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/delivery/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (deliveryPartner) {
      setIsOnline(deliveryPartner.isAvailable || false);
    }
  }, [deliveryPartner]);

  // Toggle Online Status
  const toggleOnlineStatus = async () => {
    if (!user) return;
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    try {
      await updateDoc(doc(db, 'deliveryPersons', user.uid), {
        isAvailable: newStatus,
        status: newStatus ? 'online' : 'offline'
      });
      toast.success(newStatus ? 'You are now ONLINE' : 'You are now OFFLINE');
    } catch (error) {
      console.error("Error updating status:", error);
      setIsOnline(!newStatus);
      toast.error("Failed to update status");
    }
  };

  const [deniedOrderIds, setDeniedOrderIds] = useState<string[]>([]);
  const lastAlertedOrderId = useRef<string | null>(null);

  // Listen for available CONFIRMED orders (when online)
  useEffect(() => {
    if (!user || !isOnline) {
      setAvailableOrders([]);
      return;
    }

    const q = query(
      collection(db, 'orders'),
      where('status', 'in', ['confirmed', 'preparing', 'ready']),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let orders = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Order[];

      // Filter out orders that are already assigned
      orders = orders.filter(o => !o.deliveryPersonId);

      // Filter out locally denied orders
      orders = orders.filter(o => !deniedOrderIds.includes(o.id || ''));

      // Client-side filtering for targeted broadcasts
      if (user) {
        orders = orders.filter(order => {
          if (!order.targetDeliveryIds || order.targetDeliveryIds.length === 0) return true;
          return order.targetDeliveryIds.includes(user.uid);
        });
      }

      setAvailableOrders(orders);
    }, (error) => {
      console.error("Error fetching available orders:", error);
    });

    return () => unsubscribe();
  }, [user, isOnline, deniedOrderIds]);

  // Handle New Order Alert Logic
  useEffect(() => {
    if (availableOrders.length > 0) {
      const topOrder = availableOrders[0];
      if (topOrder.id !== lastAlertedOrderId.current) {
        setSelectedOrder(topOrder);
        setShowAcceptDialog(true);
        lastAlertedOrderId.current = topOrder.id || null;
      }
    } else {
      if (showAcceptDialog && !selectedOrder) {
        setShowAcceptDialog(false);
      }
    }
  }, [availableOrders]);

  // Listen for my assigned orders
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(
      collection(db, 'orders'),
      where('deliveryPersonId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Order[];
      setMyOrders(orders);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching my orders:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const acceptOrder = async (order: Order) => {
    if (!user) {
      toast.error("You must be logged in to accept orders");
      return;
    }
    if (!order.id) {
      toast.error("Invalid order data.");
      return;
    }

    try {
      let currentRestaurantAddress = order.restaurantAddress;
      if (!currentRestaurantAddress && order.restaurantId) {
        try {
          const restaurantDoc = await getDoc(doc(db, 'restaurants', order.restaurantId));
          if (restaurantDoc.exists()) {
            const data = restaurantDoc.data();
            currentRestaurantAddress = data.address || '';
          }
        } catch (fetchErr) {
          console.error("Error fetching restaurant address:", fetchErr);
        }
      }

      await updateDoc(doc(db, 'orders', order.id!), {
        deliveryPersonId: user.uid,
        deliveryPersonName: deliveryPartner?.name || 'Assigned Partner',
        deliveryPersonPhone: deliveryPartner?.phone || '',
        deliveryVehicle: deliveryPartner?.vehicle || 'Vehicle',
        restaurantAddress: currentRestaurantAddress || order.restaurantName || 'Unknown Location',
        status: 'ready',
        deliveryStatus: 'going_to_restaurant',
        updatedAt: serverTimestamp()
      });

      toast.success('Order accepted! Navigate to restaurant.');
      setShowAcceptDialog(false);
      setSelectedOrder(null);
    } catch (error) {
      console.error("Error accepting order:", error);
      toast.error("Failed to accept order.");
    }
  };

  const denyOrder = () => {
    if (selectedOrder?.id) {
      setDeniedOrderIds(prev => [...prev, selectedOrder.id!]);
    }
    setShowAcceptDialog(false);
    setSelectedOrder(null);
  };

  const markPickedUp = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'out_for_delivery',
        deliveryStatus: 'going_to_customer',
        updatedAt: serverTimestamp()
      });
      toast.success('Picked up! Now deliver to customer.');
    } catch (error) {
      toast.error("Failed to update");
    }
  };

  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);

  const markDelivered = (orderId: string, orderOtp?: string) => {
    if (orderOtp) {
      setVerifyingOrderId(orderId);
      setOtpInput('');
      setShowOtpDialog(true);
      return;
    }
    completeDelivery(orderId);
  };

  const completeDelivery = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'delivered',
        deliveryStatus: 'delivered',
        paymentStatus: 'paid',
        deliveredAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('Order delivered & Payment marked as Paid!');
      setShowOtpDialog(false);
      setVerifyingOrderId(null);
    } catch (error) {
      toast.error("Failed to mark delivered");
    }
  };

  const verifyAndCompleteDelivery = () => {
    const targetOrder = activeOrders.find(o => o.id === verifyingOrderId);
    if (!targetOrder) return;

    if (otpInput === targetOrder.deliveryOtp) {
      completeDelivery(verifyingOrderId!);
    } else {
      toast.error("Incorrect OTP. Please ask customer.");
    }
  };

  const openMaps = (address: string) => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(mapsUrl, '_blank');
  };

  const activeOrders = myOrders.filter(o =>
    !['delivered', 'cancelled'].includes(o.status || '')
  );

  const deliveredToday = myOrders.filter(o => {
    if (o.status !== 'delivered' || !o.deliveredAt) return false;
    const deliveredDate = (o.deliveredAt as any).toDate ? (o.deliveredAt as any).toDate() : new Date(o.deliveredAt as any);
    const today = new Date();
    return deliveredDate.getDate() === today.getDate() &&
      deliveredDate.getMonth() === today.getMonth() &&
      deliveredDate.getFullYear() === today.getFullYear();
  }).length;

  const totalEarnings = myOrders
    .filter(o => o.status === 'delivered')
    .reduce((acc, curr) => acc + ((curr.deliveryCharge || 0) * 0.70), 0);

  const formatAddress = (addr: any): string => {
    if (typeof addr === 'string') return addr;
    if (addr && typeof addr === 'object') {
      return `${addr.street || ''}, ${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}`.trim();
    }
    return 'Address not available';
  };

  if (authLoading || (user && loading)) {
    return (
      <div className="flex items-center justify-center h-screen bg-transparent text-white">
        <Loader />
      </div>
    );
  }

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto pb-24 md:pb-8"
    >
      {/* Dynamic Header */}
      <motion.div variants={itemVariants} className="relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-end gap-6 p-6 rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 opacity-50" />
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-blue-500/30 rounded-full blur-[100px]" />

        <div className="relative z-10 w-full md:w-auto">
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="border-blue-500/50 text-blue-300 bg-blue-500/10 px-3 py-1">
              {deliveryPartner?.vehicle || 'Delivery Partner'}
            </Badge>
            <span className="text-xs text-gray-400 font-mono tracking-widest uppercase">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            Hello, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">{deliveryPartner?.name?.split(' ')[0] || 'Partner'}</span> 👋
          </h1>
          <p className="text-gray-400 mt-2 max-w-md text-sm leading-relaxed">
            Ready to hit the road? Stay safe and drive carefully. You have <span className="text-white font-bold">{activeOrders.length} active orders</span> right now.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-4 w-full md:w-auto">
          <div className="flex-1 md:flex-none">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Status</p>
            <div onClick={toggleOnlineStatus} className={`cursor-pointer group relative flex items-center justify-between gap-4 px-1 py-1 rounded-full border border-white/10 backdrop-blur-md transition-all duration-300 ${isOnline ? 'bg-green-500/20 border-green-500/30' : 'bg-red-500/20 border-red-500/30'} w-full md:w-48`}>
              <span className={`text-xs font-bold ml-4 tracking-wide ${isOnline ? 'text-green-300' : 'text-red-300'}`}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
              <div className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all duration-500 transform ${isOnline ? 'bg-green-500 translate-x-0 rotate-0' : 'bg-red-500 rotate-180'}`}>
                <Power className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Orders', value: activeOrders.length, icon: ShoppingBag, color: 'blue' },
          { label: 'Delivered', value: deliveredToday, icon: CheckCircle, color: 'green' },
          { label: 'Earnings', value: `₹${totalEarnings.toFixed(0)}`, icon: DollarSign, color: 'yellow' },
          { label: 'Rating', value: deliveryPartner?.rating || '5.0', icon: CheckCircle, color: 'purple' } // Changed icon to verify
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            variants={itemVariants}
            whileHover={{ y: -5 }}
            className={`relative overflow-hidden group p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl`}
          >
            <div className={`absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity bg-gradient-to-br from-${stat.color}-500 to-transparent rounded-bl-3xl`}>
              <stat.icon className={`w-8 h-8 text-${stat.color}-400`} />
            </div>
            <div className="relative z-10">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-${stat.color}-500/10 border border-${stat.color}-500/20 mb-3`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-400`} />
              </div>
              <h3 className="text-3xl font-black text-white tracking-tight">{stat.value}</h3>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mt-1">{stat.label}</p>
            </div>
            {/* Glow Effect */}
            <div className={`absolute -bottom-10 -right-10 w-24 h-24 bg-${stat.color}-500/20 blur-[50px] group-hover:bg-${stat.color}-500/30 transition-all`} />
          </motion.div>
        ))}
      </div>

      {/* Active Tasks Section */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            Current Tasks
            {activeOrders.length > 0 && <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">{activeOrders.length}</span>}
          </h2>
          {activeOrders.length === 0 && isOnline && (
            <p className="text-sm text-blue-400 animate-pulse">Scanning for new orders...</p>
          )}
        </div>

        <div className="grid gap-6">
          <AnimatePresence>
            {activeOrders.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 border border-dashed border-white/10 rounded-3xl bg-white/[0.02]"
              >
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping opacity-20" />
                  <MapPin className="w-8 h-8 text-gray-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Active Orders</h3>
                <p className="text-gray-500 max-w-sm text-center text-sm">
                  {isOnline ? "You're online! We'll notify you when a new order arrives." : "You are currently offline. Go online to start receiving delivery requests."}
                </p>
              </motion.div>
            ) : (
              activeOrders.map((order) => (
                <motion.div
                  layout
                  key={order.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl transition-all hover:border-blue-500/30"
                >
                  {/* Status Bar */}
                  <div className={`h-1.5 w-full bg-gradient-to-r ${order.deliveryStatus === 'going_to_restaurant' ? 'from-orange-500 via-yellow-500 to-orange-500' :
                      'from-blue-500 via-indigo-500 to-blue-500'
                    } animate-progress-flow`} />

                  <div className="p-6 md:p-8 relative">
                    {/* Background Glows */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-b from-blue-600/10 to-transparent blur-3xl opacity-50" />

                    <div className="relative z-10 flex flex-col md:flex-row gap-8">
                      {/* Order Info */}
                      <div className="flex-1 space-y-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <Badge className={`border-none px-3 py-1 font-bold ${order.deliveryStatus === 'going_to_restaurant' ? 'bg-orange-500/20 text-orange-300' : 'bg-blue-500/20 text-blue-300'
                                }`}>
                                {order.deliveryStatus === 'going_to_restaurant' ? 'PICKUP PHASE' : 'DELIVERY PHASE'}
                              </Badge>
                              <span className="text-xs text-gray-500 font-mono">#{order.id?.slice(0, 8)}</span>
                            </div>
                            <h3 className="text-2xl font-black text-white">{order.restaurantName}</h3>
                          </div>
                          <div className="text-right">
                            <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400">₹{order.total?.toFixed(0)}</p>
                            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">Cash on Delivery</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {/* Steps */}
                          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                            {/* Pickup Point */}
                            <div className={`relative transition-opacity ${order.deliveryStatus !== 'going_to_restaurant' ? 'opacity-50' : 'opacity-100'}`}>
                              <div className={`absolute -left-[29px] top-1 w-4 h-4 rounded-full border-2 ${order.deliveryStatus === 'going_to_restaurant' ? 'border-orange-500 bg-orange-500 animate-pulse' : 'border-gray-600 bg-black'}`} />
                              <p className="text-xs text-orange-400 font-bold uppercase tracking-wider mb-1">Pickup</p>
                              <p
                                onClick={() => openMaps(order.restaurantAddress || order.restaurantName || '')}
                                className="text-white hover:text-blue-400 cursor-pointer transition-colors text-lg font-medium underline underline-offset-4 decoration-white/20"
                              >
                                {order.restaurantAddress || order.restaurantName || 'Restaurant Location'}
                              </p>
                            </div>

                            {/* Dropoff Point */}
                            <div className={`relative transition-opacity ${order.deliveryStatus === 'going_to_customer' ? 'opacity-100' : 'opacity-50'}`}>
                              <div className={`absolute -left-[29px] top-1 w-4 h-4 rounded-full border-2 ${order.deliveryStatus === 'going_to_customer' ? 'border-blue-500 bg-blue-500 animate-pulse' : 'border-gray-600 bg-black'}`} />
                              <p className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">Dropoff</p>
                              <p
                                onClick={() => openMaps(formatAddress(order.deliveryAddress))}
                                className="text-white hover:text-blue-400 cursor-pointer transition-colors text-lg font-medium underline underline-offset-4 decoration-white/20"
                              >
                                {formatAddress(order.deliveryAddress)}
                              </p>
                              <div className="flex items-center gap-4 mt-2">
                                <a href={`tel:${order.customerPhone}`} className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white bg-white/5 px-3 py-1.5 rounded-full border border-white/5 transition-colors">
                                  <Phone className="w-3 h-3" />
                                  Call Customer
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="md:w-72 flex flex-col gap-3 justify-center">
                        {order.deliveryStatus === 'going_to_restaurant' ? (
                          <Button
                            onClick={() => markPickedUp(order.id!)}
                            className="h-16 text-lg font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 shadow-xl shadow-orange-900/40 border-0"
                          >
                            <Package className="w-5 h-5 mr-3" />
                            Confirm Pickup
                          </Button>
                        ) : (
                          <Button
                            onClick={() => markDelivered(order.id!, order.deliveryOtp)}
                            className="h-16 text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-900/40 border-0"
                          >
                            <CheckCircle className="w-5 h-5 mr-3" />
                            Complete Delivery
                          </Button>
                        )}
                        <p className="text-xs text-center text-gray-500">
                          {order.deliveryStatus === 'going_to_restaurant'
                            ? "Swipe or click to confirm you have the food"
                            : "Verify OTP with customer to complete"}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Order Acceptance Dialog */}
      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent className="bg-black/90 border-white/10 text-white backdrop-blur-2xl p-0 overflow-hidden gap-0 sm:max-w-md">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/10 to-purple-600/10 pointer-events-none" />

          {selectedOrder && (
            <>
              <div className="p-6 bg-gradient-to-br from-white/5 to-transparent border-b border-white/5">
                <div className="flex justify-between items-center mb-6">
                  <Badge className="bg-green-500/20 text-green-300 border-none px-3 py-1">New Request</Badge>
                  <span className="text-xs font-mono text-gray-400">#{selectedOrder.id?.slice(0, 6)}</span>
                </div>
                <div className="text-center mb-2">
                  <p className="text-sm text-gray-400 uppercase tracking-widest font-bold mb-1">Estimated Earnings</p>
                  <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">₹{selectedOrder.total?.toFixed(0)}</h2>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 border border-orange-500/20">
                      <ShoppingBag className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-lg">{selectedOrder.restaurantName}</h4>
                      <p className="text-gray-400 text-sm">{order.restaurantAddress || 'Restaurant Location'}</p>
                    </div>
                  </div>

                  <div className="w-0.5 h-6 bg-white/10 ml-5" />

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                      <MapPin className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 w-full">
                      <h4 className="text-gray-200 font-medium text-sm leading-relaxed">{formatAddress(selectedOrder.deliveryAddress)}</h4>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>25-30 mins est.</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={denyOrder}
                    className="h-14 border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 text-gray-400"
                  >
                    <X className="w-5 h-5 mr-2" />
                    Decline
                  </Button>
                  <Button
                    onClick={() => selectedOrder && acceptOrder(selectedOrder)}
                    className="h-14 bg-white text-black hover:bg-gray-200 font-bold text-lg shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] transition-all"
                  >
                    Accept Order
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* OTP Verification Dialog */}
      <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
        <DialogContent className="bg-black/95 border-white/10 text-white backdrop-blur-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-blue-500" />
              Customer Verification
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Please enter the 4-digit code provided by the customer.
            </DialogDescription>
          </DialogHeader>

          <div className="py-8 flex justify-center">
            <input
              type="text"
              maxLength={4}
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0000"
              className="bg-white/5 border border-white/10 rounded-2xl text-center text-5xl font-mono tracking-[0.5em] w-full py-6 text-white focus:outline-none focus:border-blue-500 focus:bg-blue-500/5 transition-all shadow-inner"
              autoFocus
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3">
            <Button variant="ghost" onClick={() => setShowOtpDialog(false)} className="text-gray-400 hover:text-white">
              Cancel
            </Button>
            <Button
              onClick={verifyAndCompleteDelivery}
              disabled={otpInput.length !== 4}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-8 flex-1"
            >
              Verify & Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
