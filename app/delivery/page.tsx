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
  Calendar,
  Satellite,
  Signal,
  Map
} from 'lucide-react';
import { Order, DeliveryStage, DeliveryFlow, getStageLabel, getStageColor, getRouteDestination } from '@/lib/types';
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
  getDoc,
  runTransaction,
  increment
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
import { useDriverLocation } from '@/hooks/useDriverLocation';

export default function DeliveryDashboard() {
  const router = useRouter();
  const { user, deliveryPartner, loading: authLoading } = useDeliveryAuth();
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // GPS Tracking - auto starts when online
  const activeOrdersList = myOrders.filter(o => !['delivered', 'cancelled'].includes(o.status || ''));
  const { position: gpsPosition, isTracking: gpsActive, accuracy: gpsAccuracy, speedKmh, permissionStatus: gpsPermission } = useDriverLocation({
    driverId: user?.uid || null,
    isOnline,
    hasActiveDelivery: activeOrdersList.length > 0,
    activeOrderId: activeOrdersList[0]?.id,
  });

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
      let restaurantLat = order.restaurantLocation?.lat || 0;
      let restaurantLng = order.restaurantLocation?.lng || 0;

      if (order.restaurantId) {
        try {
          const restaurantDoc = await getDoc(doc(db, 'restaurants', order.restaurantId));
          if (restaurantDoc.exists()) {
            const data = restaurantDoc.data();
            if (!currentRestaurantAddress) currentRestaurantAddress = data.address || '';
            if (!restaurantLat && data.latitude) restaurantLat = data.latitude;
            if (!restaurantLng && data.longitude) restaurantLng = data.longitude;
          }
        } catch (fetchErr) {
          console.error("Error fetching restaurant data:", fetchErr);
        }
      }

      // Build customer drop coordinates
      let dropLat = 0, dropLng = 0, dropAddress = '';
      const addr = order.deliveryAddress;
      if (addr && typeof addr !== 'string' && addr.latitude && addr.longitude) {
        dropLat = addr.latitude;
        dropLng = addr.longitude;
        dropAddress = `${addr.street || ''}, ${addr.city || ''} ${addr.pincode || ''}`.trim();
      } else if (typeof addr === 'string') {
        dropAddress = addr;
      }

      // Build professional delivery flow object
      const deliveryFlow: DeliveryFlow = {
        driverId: user.uid,
        stage: 'TO_PICKUP',
        pickup: {
          restaurantId: order.restaurantId || '',
          latitude: restaurantLat,
          longitude: restaurantLng,
          address: currentRestaurantAddress || order.restaurantName || 'Restaurant',
        },
        drop: {
          customerId: order.customerId || '',
          latitude: dropLat,
          longitude: dropLng,
          address: dropAddress || 'Customer',
        },
        assignedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'orders', order.id!), {
        deliveryPersonId: user.uid,
        deliveryPersonName: deliveryPartner?.name || 'Assigned Partner',
        deliveryPersonPhone: deliveryPartner?.phone || '',
        deliveryVehicle: deliveryPartner?.vehicle || 'Vehicle',
        restaurantAddress: currentRestaurantAddress || order.restaurantName || 'Unknown Location',
        status: 'ready',
        deliveryStatus: 'going_to_restaurant',
        delivery: deliveryFlow,
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

  // ==========================================
  // Stage Transition Functions
  // ==========================================
  const updateDeliveryStage = async (orderId: string, newStage: DeliveryStage, extraFields: Record<string, any> = {}) => {
    try {
      const stageTimestampMap: Record<string, string> = {
        'ARRIVED_PICKUP': 'delivery.arrivedPickupAt',
        'PICKED_UP': 'delivery.pickedUpAt',
        'TO_CUSTOMER': 'delivery.pickedUpAt',
        'ARRIVED_CUSTOMER': 'delivery.arrivedCustomerAt',
        'DELIVERED': 'delivery.deliveredAt',
      };

      const updates: Record<string, any> = {
        'delivery.stage': newStage,
        updatedAt: serverTimestamp(),
        ...extraFields,
      };

      if (stageTimestampMap[newStage]) {
        updates[stageTimestampMap[newStage]] = serverTimestamp();
      }

      await updateDoc(doc(db, 'orders', orderId), updates);
    } catch (error) {
      console.error(`Failed to update stage to ${newStage}:`, error);
      toast.error('Failed to update status');
      throw error;
    }
  };

  const markArrivedAtRestaurant = async (orderId: string) => {
    await updateDeliveryStage(orderId, 'ARRIVED_PICKUP', {
      deliveryStatus: 'going_to_restaurant',
    });
    toast.success('Marked arrived at restaurant!');
  };

  const markPickedUp = async (orderId: string) => {
    await updateDeliveryStage(orderId, 'TO_CUSTOMER', {
      status: 'out_for_delivery',
      deliveryStatus: 'going_to_customer',
    });
    fetch('/api/notifications/order-status', {
      method: 'POST',
      body: JSON.stringify({ orderId, status: 'out_for_delivery' })
    }).catch(err => console.error("Failed to trigger status notification", err));
    toast.success('Order picked up! Navigate to customer.');
  };

  const markArrivedAtCustomer = async (orderId: string) => {
    await updateDeliveryStage(orderId, 'ARRIVED_CUSTOMER', {
      deliveryStatus: 'going_to_customer',
    });
    toast.success('Arrived at customer! Complete delivery.');
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
      if (!user) return;

      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', orderId);
        const orderDoc = await transaction.get(orderRef);

        if (!orderDoc.exists()) {
          throw new Error("Order does not exist!");
        }

        const orderData = orderDoc.data() as Order;
        const deliveryCharge = orderData.deliveryCharge || 0;
        const earnings = deliveryCharge * 0.70;
        const totalAmount = orderData.total || 0;
        const isCOD = orderData.paymentMethod === 'cod';

        // Calculate Wallet Impact
        // Positive Wallet Balance = Delivery Person OWES Platform (Cash in hand)
        // Negative Wallet Balance = Platform OWES Delivery Person (Earnings)

        let walletChange = 0;

        if (isCOD) {
          // Driver collected Cash (Total).
          // Driver keeps 'Earnings'.
          // Driver owes 'Total - Earnings' to Platform.
          // Example: Total 100, Earn 20. Coll 100. Keeps 20. Owes 80.
          // Balance Change = + (100 - 20) = +80.
          walletChange = totalAmount - earnings;
        } else {
          // Online Payment (Platform has money).
          // Platform owes 'Earnings' to Driver.
          // Balance Change = - Earnings.
          // Example: Earn 20. Balance Change = -20.
          walletChange = -earnings;
        }

        // Update Order
        transaction.update(orderRef, {
          status: 'delivered',
          deliveryStatus: 'delivered',
          'delivery.stage': 'DELIVERED',
          'delivery.deliveredAt': serverTimestamp(),
          paymentStatus: 'paid',
          deliveredAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Update Delivery Person Wallet
        const driverRef = doc(db, 'deliveryPersons', user.uid);
        transaction.update(driverRef, {
          walletBalance: increment(walletChange)
        });

        // Log Transaction
        const walletTxRef = doc(collection(driverRef, 'walletTransactions'));
        transaction.set(walletTxRef, {
          amount: Math.abs(walletChange),
          type: walletChange > 0 ? 'cod_collection' : 'earnings', // Simplified type
          description: isCOD
            ? `Order #${orderId.slice(0, 6)} (COD: ₹${totalAmount} - Earn: ₹${earnings})`
            : `Order #${orderId.slice(0, 6)} Earnings`,
          orderId: orderId,
          isDebit: walletChange > 0, // True if debt increases (Driver owes more)
          createdAt: serverTimestamp()
        });
      });

      toast.success('Order delivered & Wallet Updated!');
      fetch('/api/notifications/order-status', {
        method: 'POST',
        body: JSON.stringify({ orderId, status: 'delivered' })
      }).catch(err => console.error("Failed to trigger delivered notification", err));
      setShowOtpDialog(false);
      setVerifyingOrderId(null);
    } catch (error) {
      console.error("Delivery Error:", error);
      toast.error("Failed to update status");
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
    visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 100 } }
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
          {/* GPS Status Indicator */}
          {isOnline && (
            <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-2">
              {gpsActive ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-green-400">GPS</span>
                  <span className="text-[10px] text-gray-500">±{gpsAccuracy || '?'}m</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[10px] font-bold text-red-400">No GPS</span>
                </>
              )}
            </div>
          )}

          {/* Live Map Button */}
          <Button
            onClick={() => router.push('/delivery/tracking')}
            variant="outline"
            className="border-blue-500/30 text-blue-300 hover:bg-blue-500/10 bg-blue-500/5 rounded-full h-10 gap-2"
          >
            <Map className="w-4 h-4" />
            Live Map
          </Button>

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
              activeOrders.map((order) => {
                const stage = order.delivery?.stage || (order.deliveryStatus === 'going_to_restaurant' ? 'TO_PICKUP' : order.deliveryStatus === 'going_to_customer' ? 'TO_CUSTOMER' : 'TO_PICKUP') as DeliveryStage;
                const stageColors = getStageColor(stage);
                const isPickupPhase = stage === 'TO_PICKUP' || stage === 'ARRIVED_PICKUP';
                const isDeliveryPhase = stage === 'PICKED_UP' || stage === 'TO_CUSTOMER' || stage === 'ARRIVED_CUSTOMER';

                // Stage progress: 6 steps
                const stageSteps: { key: DeliveryStage; label: string; icon: string }[] = [
                  { key: 'TO_PICKUP', label: 'En Route', icon: '🛵' },
                  { key: 'ARRIVED_PICKUP', label: 'At Restaurant', icon: '🍔' },
                  { key: 'TO_CUSTOMER', label: 'Picked Up', icon: '📦' },
                  { key: 'ARRIVED_CUSTOMER', label: 'At Customer', icon: '🏠' },
                  { key: 'DELIVERED', label: 'Delivered', icon: '✅' },
                ];
                const currentStepIdx = stageSteps.findIndex(s => s.key === stage);

                return (
                  <motion.div
                    layout
                    key={order.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl transition-all hover:border-blue-500/30"
                  >
                    {/* Stage Progress Bar */}
                    <div className={`h-1.5 w-full bg-gradient-to-r ${isPickupPhase ? 'from-orange-500 via-yellow-500 to-orange-500' : 'from-blue-500 via-indigo-500 to-blue-500'} animate-progress-flow`} />

                    <div className="p-6 md:p-8 relative">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-b from-blue-600/10 to-transparent blur-3xl opacity-50" />

                      <div className="relative z-10 flex flex-col gap-6">
                        {/* Header */}
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <Badge className={`border ${stageColors.border} px-3 py-1 font-bold ${stageColors.bg} ${stageColors.text}`}>
                                {getStageLabel(stage)}
                              </Badge>
                              <span className="text-xs text-gray-500 font-mono">#{order.id?.slice(0, 8)}</span>
                            </div>
                            <h3 className="text-2xl font-black text-white">{order.restaurantName}</h3>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400">₹{order.total?.toFixed(0)}</p>
                            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">{order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Paid'}</p>
                          </div>
                        </div>

                        {/* Mini Stage Progress */}
                        <div className="flex items-center gap-1">
                          {stageSteps.map((step, i) => (
                            <React.Fragment key={step.key}>
                              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold transition-all ${
                                i <= currentStepIdx
                                  ? i === currentStepIdx ? `${stageColors.bg} ${stageColors.text} ring-1 ring-current scale-105` : 'bg-white/10 text-gray-400'
                                  : 'bg-white/5 text-gray-600'
                              }`}>
                                <span>{step.icon}</span>
                                <span className="hidden sm:inline">{step.label}</span>
                              </div>
                              {i < stageSteps.length - 1 && (
                                <div className={`flex-1 h-0.5 rounded-full ${i < currentStepIdx ? 'bg-white/20' : 'bg-white/5'}`} />
                              )}
                            </React.Fragment>
                          ))}
                        </div>

                        <div className="flex flex-col md:flex-row gap-6">
                          {/* Route Points */}
                          <div className="flex-1 space-y-4">
                            <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                              {/* Pickup */}
                              <div className={`relative transition-opacity ${isDeliveryPhase ? 'opacity-40' : 'opacity-100'}`}>
                                <div className={`absolute -left-[29px] top-1 w-4 h-4 rounded-full border-2 ${
                                  isPickupPhase ? 'border-orange-500 bg-orange-500 animate-pulse' :
                                  isDeliveryPhase ? 'border-green-500 bg-green-500' : 'border-gray-600 bg-black'
                                }`} />
                                <p className="text-xs text-orange-400 font-bold uppercase tracking-wider mb-1">
                                  {isDeliveryPhase ? '✓ Picked Up' : 'Pickup'}
                                </p>
                                <p onClick={() => openMaps(order.restaurantAddress || order.restaurantName || '')} className="text-white hover:text-blue-400 cursor-pointer transition-colors text-base font-medium">
                                  {order.delivery?.pickup?.address || order.restaurantAddress || order.restaurantName || 'Restaurant'}
                                </p>
                              </div>

                              {/* Dropoff */}
                              <div className={`relative transition-opacity ${isDeliveryPhase ? 'opacity-100' : 'opacity-50'}`}>
                                <div className={`absolute -left-[29px] top-1 w-4 h-4 rounded-full border-2 ${
                                  isDeliveryPhase ? 'border-blue-500 bg-blue-500 animate-pulse' : 'border-gray-600 bg-black'
                                }`} />
                                <p className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">Dropoff</p>
                                <p onClick={() => openMaps(formatAddress(order.deliveryAddress))} className="text-white hover:text-blue-400 cursor-pointer transition-colors text-base font-medium">
                                  {order.delivery?.drop?.address || formatAddress(order.deliveryAddress)}
                                </p>
                                <div className="flex items-center gap-3 mt-2">
                                  {order.customerPhone && (
                                    <a href={`tel:${order.customerPhone}`} className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white bg-white/5 px-3 py-1.5 rounded-full border border-white/5 transition-colors">
                                      <Phone className="w-3 h-3" /> Call
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Stage-Aware Action Buttons */}
                          <div className="md:w-72 flex flex-col gap-3 justify-center">
                            {stage === 'TO_PICKUP' && (
                              <>
                                <Button
                                  onClick={() => markArrivedAtRestaurant(order.id!)}
                                  className="h-14 text-base font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 shadow-xl shadow-orange-900/40 border-0 gap-2"
                                >
                                  <MapPin className="w-5 h-5" />
                                  Arrived at Restaurant
                                </Button>
                                <p className="text-[11px] text-center text-gray-500">Press when you reach the restaurant</p>
                              </>
                            )}
                            {stage === 'ARRIVED_PICKUP' && (
                              <>
                                <div className="text-center py-2">
                                  <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-2 animate-pulse">
                                    <ShoppingBag className="w-5 h-5 text-amber-400" />
                                  </div>
                                  <p className="text-amber-400 text-xs font-bold">Waiting for food handover...</p>
                                </div>
                                <Button
                                  onClick={() => markPickedUp(order.id!)}
                                  className="h-14 text-base font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 shadow-xl shadow-orange-900/40 border-0 gap-2"
                                >
                                  <Package className="w-5 h-5" />
                                  Order Picked Up
                                </Button>
                                <p className="text-[11px] text-center text-gray-500">Press after collecting the food</p>
                              </>
                            )}
                            {(stage === 'PICKED_UP' || stage === 'TO_CUSTOMER') && (
                              <>
                                <Button
                                  onClick={() => markArrivedAtCustomer(order.id!)}
                                  className="h-14 text-base font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-900/40 border-0 gap-2"
                                >
                                  <Navigation className="w-5 h-5" />
                                  Arrived at Customer
                                </Button>
                                <p className="text-[11px] text-center text-gray-500">Press when you reach the delivery location</p>
                              </>
                            )}
                            {stage === 'ARRIVED_CUSTOMER' && (
                              <>
                                <div className="text-center py-2">
                                  <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-2 animate-pulse">
                                    <CheckCircle className="w-5 h-5 text-green-400" />
                                  </div>
                                  <p className="text-green-400 text-xs font-bold">At customer's location</p>
                                </div>
                                <Button
                                  onClick={() => markDelivered(order.id!, order.deliveryOtp)}
                                  className="h-14 text-base font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-xl shadow-green-900/40 border-0 gap-2"
                                >
                                  <CheckCircle className="w-5 h-5" />
                                  Complete Delivery
                                </Button>
                                <p className="text-[11px] text-center text-gray-500">Verify OTP with customer to complete</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
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
                      <p className="text-gray-400 text-sm">{selectedOrder.restaurantAddress || 'Restaurant Location'}</p>
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
