'use client';

import React, { useState, useEffect } from 'react';
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
  Bike
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
  or,
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
  const lastAlertedOrderId = React.useRef<string | null>(null);

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

      // Filter out orders that are already assigned (to anyone)
      orders = orders.filter(o => !o.deliveryPersonId);

      // Filter out locally denied orders
      orders = orders.filter(o => !deniedOrderIds.includes(o.id || ''));

      // Client-side filtering for targeted broadcasts
      if (user) {
        orders = orders.filter(order => {
          // If no target list, it's public (or legacy) -> show it
          if (!order.targetDeliveryIds || order.targetDeliveryIds.length === 0) return true;
          // If target list exists, must include current user
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
      // Only show dialog if it's a NEW order we haven't alerted for yet
      if (topOrder.id !== lastAlertedOrderId.current) {
        setSelectedOrder(topOrder);
        setShowAcceptDialog(true);
        lastAlertedOrderId.current = topOrder.id || null;
      }
    } else {
      // If no available orders, close dialog just in case (e.g. taken by someone else)
      if (showAcceptDialog && !selectedOrder) { // Don't close if viewing specific one? actually safer to close if list empty
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

  // Accept order
  // Accept order
  const acceptOrder = async (order: Order) => {
    if (!user) {
      toast.error("You must be logged in to accept orders");
      return;
    }

    console.log('Accepting Order Data:', order); // Debug Log
    if (!order.id) {
      console.error("Order ID is missing", order);
      toast.error("Invalid order data. Cannot accept.");
      return;
    }

    try {
      let currentRestaurantAddress = order.restaurantAddress;

      // If address is missing, fetch it from restaurant profile
      if (!currentRestaurantAddress && order.restaurantId) {
        try {
          const restaurantDoc = await getDoc(doc(db, 'restaurants', order.restaurantId));
          if (restaurantDoc.exists()) {
            const data = restaurantDoc.data();
            // Assuming address is stored as 'address' field (string or object)
            // If it's an object, we might need to format it, but user said 'restaurantAddress'
            // The screenshot implies a string string address or formatted one.
            // Let's grab 'address' from restaurant doc.
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
        restaurantAddress: currentRestaurantAddress || order.restaurantName || 'Unknown Location', // Save it!
        status: 'ready',
        deliveryStatus: 'going_to_restaurant',
        updatedAt: serverTimestamp()
      });

      toast.success('Order accepted! Navigate to restaurant.');
      setShowAcceptDialog(false);
      setSelectedOrder(null);
    } catch (error) {
      console.error("Error accepting order:", error);
      toast.error("Failed to accept order. Please try again.");
    }
  };

  // Deny order
  const denyOrder = () => {
    if (selectedOrder?.id) {
      setDeniedOrderIds(prev => [...prev, selectedOrder.id!]);
    }
    setShowAcceptDialog(false);
    setSelectedOrder(null);
  };

  // Mark as picked up
  const markPickedUp = async (orderId: string) => {
    if (!orderId) {
      toast.error("Invalid order ID");
      return;
    }
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'out_for_delivery',
        deliveryStatus: 'going_to_customer',
        updatedAt: serverTimestamp()
      });
      toast.success('Picked up! Now deliver to customer.');
    } catch (error) {
      console.error("Error updating pickup:", error);
      toast.error("Failed to update");
    }
  };

  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);

  // Mark as delivered (Initiate Verification)
  const markDelivered = (orderId: string, orderOtp?: string) => {
    if (!orderId) {
      toast.error("Invalid order ID");
      return;
    }

    // If order has an OTP, require verification
    if (orderOtp) {
      setVerifyingOrderId(orderId);
      setOtpInput('');
      setShowOtpDialog(true);
      return;
    }

    // Legacy fallback for orders without OTP
    completeDelivery(orderId);
  };

  const completeDelivery = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'delivered',
        deliveryStatus: 'delivered',
        paymentStatus: 'paid', // Auto-mark as paid
        deliveredAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success('Order delivered & Payment marked as Paid!');
      setShowOtpDialog(false);
      setVerifyingOrderId(null);
    } catch (error) {
      console.error("Error marking delivered:", error);
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

  // Open maps with address
  const openMaps = (address: string) => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(mapsUrl, '_blank');
  };

  // Filter active orders (not delivered/cancelled)
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

  // Format address helper
  const formatAddress = (addr: any): string => {
    if (typeof addr === 'string') return addr;
    if (addr && typeof addr === 'object') {
      return `${addr.street || ''}, ${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}`.trim();
    }
    return 'Address not available';
  };

  if (authLoading || (user && loading)) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 md:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Header & Status Toggle */}
      <div className="relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-4 sm:p-6 rounded-3xl shadow-2xl shadow-purple-900/30">
        {/* Animated Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 via-transparent to-pink-500/20 animate-pulse" />

        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-lg">🚀 Dashboard</h1>
          <p className="text-white/90 mt-1 flex items-center gap-2 font-medium">
            <Smartphone className="w-4 h-4 text-yellow-300" />
            {deliveryPartner?.name || 'Partner'} • {deliveryPartner?.vehicle || 'Vehicle'}
          </p>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto relative z-10">
          <div className={`flex items-center gap-3 px-4 py-2.5 rounded-full backdrop-blur-sm shadow-lg ${isOnline ? 'bg-green-400/20 border-2 border-green-300/50 text-green-100' : 'bg-red-400/20 border-2 border-red-300/50 text-red-100'}`}>
            <div className={`w-3 h-3 rounded-full shadow-lg ${isOnline ? 'bg-green-300 animate-pulse shadow-green-400' : 'bg-red-300 shadow-red-400'}`} />
            <span className="font-black text-sm tracking-wider drop-shadow">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
          <Button
            onClick={toggleOnlineStatus}
            size="icon"
            className={`rounded-full w-12 h-12 shadow-xl transition-all duration-300 backdrop-blur-sm border-2 ${isOnline ? 'bg-red-500/90 hover:bg-red-600 text-white border-red-300/50 hover:scale-110' : 'bg-green-500/90 hover:bg-green-600 text-white border-green-300/50 hover:scale-110'}`}
          >
            <Power className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Order Acceptance Dialog */}
      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border-gray-700/50 text-white backdrop-blur-xl shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none rounded-lg" />
          <DialogHeader className="relative">
            <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <Package className="w-6 h-6 text-blue-400" />
              </div>
              New Order Request
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              A new order is waiting for you to accept
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4 py-4 relative">
              <div className="flex justify-between items-center p-5 bg-gradient-to-br from-gray-800/80 to-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-lg">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Order ID</p>
                  <p className="font-black text-white text-lg">#{selectedOrder.id?.slice(0, 8)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Amount</p>
                  <p className="text-3xl font-black bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">₹{selectedOrder.total}</p>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/30">
                <div className="flex items-center gap-3 text-gray-200 hover:text-white transition-colors">
                  <div className="p-2 bg-orange-600/20 rounded-lg">
                    <ShoppingBag className="w-4 h-4 text-orange-400" />
                  </div>
                  <span className="font-semibold">{selectedOrder.restaurantName}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-200 hover:text-white transition-colors">
                  <div className="p-2 bg-blue-600/20 rounded-lg">
                    <Package className="w-4 h-4 text-blue-400" />
                  </div>
                  <span>{selectedOrder.items?.length || 0} items</span>
                </div>
                <div className="flex items-start gap-3 text-gray-200 hover:text-white transition-colors">
                  <div className="p-2 bg-green-600/20 rounded-lg shrink-0">
                    <MapPin className="w-4 h-4 text-green-400" />
                  </div>
                  <span className="text-sm leading-relaxed">{formatAddress(selectedOrder.deliveryAddress)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:gap-2 relative">
            <Button
              variant="outline"
              onClick={denyOrder}
              className="w-full sm:w-auto border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-red-950/30 hover:text-red-400 hover:border-red-700/50 py-6 sm:py-2 transition-all duration-300"
            >
              <X className="w-4 h-4 mr-2" />
              Deny
            </Button>
            <Button
              onClick={() => selectedOrder && acceptOrder(selectedOrder)}
              className="w-full sm:w-auto bg-gradient-to-r from-green-600 via-emerald-600 to-green-600 hover:from-green-700 hover:via-emerald-700 hover:to-green-700 text-white font-bold py-6 sm:py-2 shadow-xl shadow-green-900/30 hover:shadow-green-900/50 transition-all duration-300 hover:scale-105"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Accept Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 border-blue-400/30 backdrop-blur text-white hover:shadow-2xl hover:shadow-blue-500/40 transition-all duration-500 relative overflow-hidden group hover:scale-[1.03] animate-[fadeIn_0.5s_ease-out]">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-300/20 via-transparent to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all duration-500" />
          <CardContent className="p-4 md:p-6 flex flex-col items-center justify-center text-center relative z-10">
            <div className="p-3 bg-white/20 rounded-2xl mb-3 text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg backdrop-blur-sm">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <p className="text-3xl md:text-4xl font-black text-white mb-1 drop-shadow-lg group-hover:scale-110 transition-transform duration-300">{activeOrders.length}</p>
            <p className="text-[10px] md:text-xs text-blue-100 uppercase tracking-widest font-bold">Active Orders</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-600 via-emerald-700 to-emerald-900 border-green-400/30 backdrop-blur text-white hover:shadow-2xl hover:shadow-green-500/40 transition-all duration-500 relative overflow-hidden group hover:scale-[1.03] animate-[fadeIn_0.5s_ease-out_0.1s]">
          <div className="absolute inset-0 bg-gradient-to-tr from-green-300/20 via-transparent to-green-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all duration-500" />
          <CardContent className="p-4 md:p-6 flex flex-col items-center justify-center text-center relative z-10">
            <div className="p-3 bg-white/20 rounded-2xl mb-3 text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg backdrop-blur-sm">
              <CheckCircle className="w-6 h-6" />
            </div>
            <p className="text-3xl md:text-4xl font-black text-white mb-1 drop-shadow-lg group-hover:scale-110 transition-transform duration-300">{deliveredToday}</p>
            <p className="text-[10px] md:text-xs text-green-100 uppercase tracking-widest font-bold">Delivered Today</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-600 via-orange-700 to-orange-900 border-yellow-400/30 backdrop-blur text-white hover:shadow-2xl hover:shadow-yellow-500/40 transition-all duration-500 relative overflow-hidden group hover:scale-[1.03] animate-[fadeIn_0.5s_ease-out_0.2s]">
          <div className="absolute inset-0 bg-gradient-to-tr from-yellow-300/20 via-transparent to-yellow-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all duration-500" />
          <CardContent className="p-4 md:p-6 flex flex-col items-center justify-center text-center relative z-10">
            <div className="p-3 bg-white/20 rounded-2xl mb-3 text-white group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg backdrop-blur-sm">
              <DollarSign className="w-6 h-6" />
            </div>
            <p className="text-3xl md:text-4xl font-black text-white mb-1 drop-shadow-lg group-hover:scale-110 transition-transform duration-300">₹{totalEarnings.toFixed(2)}</p>
            <p className="text-[10px] md:text-xs text-yellow-100 uppercase tracking-widest font-bold">Earnings</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-600 via-pink-700 to-pink-900 border-purple-400/30 backdrop-blur text-white hover:shadow-2xl hover:shadow-purple-500/40 transition-all duration-500 relative overflow-hidden group hover:scale-[1.03] animate-[fadeIn_0.5s_ease-out_0.3s]">
          <div className="absolute inset-0 bg-gradient-to-tr from-purple-300/20 via-transparent to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all duration-500" />
          <CardContent className="p-4 md:p-6 flex flex-col items-center justify-center text-center relative z-10">
            <div className="w-16 h-16 rounded-full border-4 border-white/40 mb-2 flex items-center justify-center bg-white/10 relative group-hover:border-white/60 group-hover:scale-110 transition-all duration-300 shadow-lg backdrop-blur-sm">
              <span className="text-xl font-black text-white drop-shadow-lg">{deliveryPartner?.rating || '5.0'}</span>
            </div>
            <p className="text-[10px] md:text-xs text-purple-100 uppercase tracking-widest font-bold">Rating</p>
          </CardContent>
        </Card>
      </div>

      {/* Current Tasks */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
          Current Tasks
          {activeOrders.length > 0 && <Badge className="bg-blue-600">{activeOrders.length}</Badge>}
        </h2>

        <div className="space-y-4">
          {activeOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-gray-900/30 border border-gray-800 border-dashed rounded-xl">
              <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
                <MapPin className="w-8 h-8 text-gray-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-300">No active orders</h3>
              <p className="text-gray-500 mb-6 text-sm max-w-xs text-center">
                {isOnline ? "Waiting for restaurant to confirm orders..." : "Go online to receive orders"}
              </p>
              {!isOnline && (
                <Button
                  onClick={toggleOnlineStatus}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Power className="w-4 h-4 mr-2" />
                  Go Online
                </Button>
              )}
            </div>
          ) : (
            activeOrders.map((order, index) => (
              <Card key={order.id} className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800/50 border-gray-700/50 text-white overflow-hidden hover:border-gray-600 transition-all duration-500 shadow-2xl hover:shadow-blue-900/20 backdrop-blur-sm animate-[fadeIn_0.5s_ease-out]" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="h-1.5 bg-gradient-to-r from-blue-500 via-purple-600 to-pink-500 w-full animate-pulse" />
                <CardContent className="p-6 relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-3xl" />
                  <div className="space-y-4 relative">
                    {/* Order Header */}
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <Badge className={`mb-1 font-bold tracking-wide shadow-lg ${order.deliveryStatus === 'going_to_restaurant' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white' :
                          order.deliveryStatus === 'going_to_customer' ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white animate-pulse' :
                            'bg-gray-700 text-gray-300'
                          }`}>
                          {order.deliveryStatus?.replace('_', ' ').toUpperCase() || order.status?.toUpperCase()}
                        </Badge>
                        <h3 className="text-xl font-black text-white">{order.restaurantName}</h3>
                        <p className="text-sm text-gray-500 font-mono">Order #{order.id?.slice(0, 8)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">₹{order.total?.toFixed(2)}</p>
                        <p className="text-xs text-gray-400 bg-gray-800/50 backdrop-blur-sm px-3 py-1.5 rounded-full mt-1 border border-gray-700/50">COD Payment</p>
                      </div>
                    </div>

                    {/* Restaurant Pickup Phase */}
                    {order.deliveryStatus === 'going_to_restaurant' && (
                      <div className="p-5 bg-gradient-to-br from-orange-900/30 to-orange-900/10 backdrop-blur-sm border border-orange-500/40 rounded-xl space-y-3 shadow-lg">
                        <h4 className="font-bold text-orange-300 flex items-center gap-2">
                          <div className="p-1.5 bg-orange-600/30 rounded-lg">
                            <Bike className="w-5 h-5" />
                          </div>
                          Pickup from Restaurant
                        </h4>
                        <button
                          onClick={() => openMaps(order.restaurantAddress || order.restaurantName || '')}
                          className="flex items-start gap-3 text-white hover:text-orange-300 transition-all duration-300 w-full text-left p-2 rounded-lg hover:bg-orange-950/30"
                        >
                          <MapPin className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                          <span className="underline underline-offset-2">{order.restaurantAddress || order.restaurantName || 'Restaurant Location'}</span>
                        </button>
                        <Button
                          onClick={() => markPickedUp(order.id!)}
                          className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold shadow-lg shadow-orange-900/30 hover:shadow-orange-900/50 transition-all duration-300 hover:scale-[1.02]"
                        >
                          <Package className="w-4 h-4 mr-2" />
                          Mark as Picked Up
                        </Button>
                      </div>
                    )}

                    {/* Customer Delivery Phase */}
                    {order.deliveryStatus === 'going_to_customer' && (
                      <div className="p-5 bg-gradient-to-br from-blue-900/30 to-blue-900/10 backdrop-blur-sm border border-blue-500/40 rounded-xl space-y-3 shadow-lg">
                        <h4 className="font-bold text-blue-300 flex items-center gap-2">
                          <div className="p-1.5 bg-blue-600/30 rounded-lg">
                            <Navigation className="w-5 h-5" />
                          </div>
                          Deliver to Customer
                        </h4>
                        <button
                          onClick={() => openMaps(formatAddress(order.deliveryAddress))}
                          className="flex items-start gap-3 text-white hover:text-blue-300 transition-all duration-300 w-full text-left p-2 rounded-lg hover:bg-blue-950/30"
                        >
                          <MapPin className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                          <span className="underline underline-offset-2">{formatAddress(order.deliveryAddress)}</span>
                        </button>
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="flex items-center gap-3 text-white hover:text-blue-300 transition-all duration-300 p-2 rounded-lg hover:bg-blue-950/30"
                        >
                          <Phone className="w-4 h-4 text-blue-400" />
                          <span className="underline underline-offset-2">{order.customerPhone}</span>
                        </a>
                        <Button
                          onClick={() => markDelivered(order.id!, order.deliveryOtp)}
                          className="w-full bg-gradient-to-r from-green-600 via-emerald-600 to-green-600 hover:from-green-700 hover:via-emerald-700 hover:to-green-700 text-white font-bold h-14 text-lg shadow-xl shadow-green-900/30 hover:shadow-green-900/50 transition-all duration-300 hover:scale-[1.02]"
                        >
                          <CheckCircle className="w-5 h-5 mr-2" />
                          Mark as Delivered
                        </Button>
                      </div>
                    )}

                    {/* Order Items */}
                    <div className="pt-3 border-t border-gray-700/50">
                      <p className="text-sm text-gray-400 mb-2 font-semibold">Order Items:</p>
                      <div className="space-y-1.5">
                        {order.items?.slice(0, 3).map((item, idx) => (
                          <p key={idx} className="text-sm text-gray-300 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            {item.quantity}x {item.name}
                          </p>
                        ))}
                        {(order.items?.length || 0) > 3 && (
                          <p className="text-sm text-gray-500 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-600"></span>
                            + {(order.items?.length || 0) - 3} more items
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
      <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-blue-500" />
              Enter Delivery OTP
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Ask customer for the 4-digit verification code.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 flex justify-center">
            <input
              type="text"
              maxLength={4}
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0000"
              className="bg-black border border-gray-700 rounded-2xl text-center text-4xl font-mono tracking-[0.5em] w-full p-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOtpDialog(false)} className="border-gray-700 text-gray-300">
              Cancel
            </Button>
            <Button
              onClick={verifyAndCompleteDelivery}
              disabled={otpInput.length !== 4}
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-8"
            >
              Verify & Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
