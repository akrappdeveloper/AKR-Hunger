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
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header & Status Toggle */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-gray-900 to-black p-6 rounded-2xl border border-gray-800 shadow-2xl">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-gray-400 mt-1 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-500" />
            {deliveryPartner?.name || 'Partner'} • {deliveryPartner?.vehicle || 'Vehicle'}
          </p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className={`flex items-center gap-3 px-4 py-2 rounded-full border ${isOnline ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="font-bold text-sm tracking-wide">{isOnline ? 'YOU ARE ONLINE' : 'YOU ARE OFFLINE'}</span>
          </div>
          <Button
            onClick={toggleOnlineStatus}
            size="icon"
            className={`rounded-full w-12 h-12 shadow-lg transition-all duration-300 ${isOnline ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
          >
            <Power className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Order Acceptance Dialog */}
      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
              <Package className="w-6 h-6 text-blue-500" />
              New Order Request
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              A new order is waiting for you to accept
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div className="flex justify-between items-center p-4 bg-gray-800/50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Order ID</p>
                  <p className="font-bold text-white">#{selectedOrder.id?.slice(0, 8)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase">Amount</p>
                  <p className="text-2xl font-bold text-green-400">₹{selectedOrder.total}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-300">
                  <ShoppingBag className="w-4 h-4 text-orange-500" />
                  <span className="font-semibold">{selectedOrder.restaurantName}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Package className="w-4 h-4 text-blue-500" />
                  <span>{selectedOrder.items?.length || 0} items</span>
                </div>
                <div className="flex items-start gap-2 text-gray-300">
                  <MapPin className="w-4 h-4 text-green-500 shrink-0 mt-1" />
                  <span className="text-sm">{formatAddress(selectedOrder.deliveryAddress)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:gap-2">
            <Button
              variant="outline"
              onClick={denyOrder}
              className="w-full sm:w-auto border-gray-700 text-gray-300 hover:bg-gray-800 py-6 sm:py-2"
            >
              <X className="w-4 h-4 mr-2" />
              Deny
            </Button>
            <Button
              onClick={() => selectedOrder && acceptOrder(selectedOrder)}
              className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-6 sm:py-2 shadow-lg shadow-green-900/20"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Accept Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-900/50 border-gray-800 backdrop-blur text-white hover:bg-gray-900/80 transition-colors relative overflow-hidden group">
          <div className="absolute inset-0 bg-blue-600/5 group-hover:bg-blue-600/10 transition-colors" />
          <CardContent className="p-4 md:p-6 flex flex-col items-center justify-center text-center relative z-10">
            <div className="p-3 bg-blue-600/20 rounded-full mb-3 text-blue-400 group-hover:scale-110 transition-transform">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white mb-1">{activeOrders.length}</p>
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-widest">Active Orders</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800 backdrop-blur text-white hover:bg-gray-900/80 transition-colors relative overflow-hidden group">
          <div className="absolute inset-0 bg-green-600/5 group-hover:bg-green-600/10 transition-colors" />
          <CardContent className="p-4 md:p-6 flex flex-col items-center justify-center text-center relative z-10">
            <div className="p-3 bg-green-600/20 rounded-full mb-3 text-green-400 group-hover:scale-110 transition-transform">
              <CheckCircle className="w-6 h-6" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white mb-1">{deliveredToday}</p>
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-widest">Delivered Today</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800 backdrop-blur text-white hover:bg-gray-900/80 transition-colors relative overflow-hidden group">
          <div className="absolute inset-0 bg-yellow-600/5 group-hover:bg-yellow-600/10 transition-colors" />
          <CardContent className="p-4 md:p-6 flex flex-col items-center justify-center text-center relative z-10">
            <div className="p-3 bg-yellow-600/20 rounded-full mb-3 text-yellow-400 group-hover:scale-110 transition-transform">
              <DollarSign className="w-6 h-6" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white mb-1">₹{totalEarnings.toFixed(2)}</p>
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-widest">Earnings (Total)</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800 backdrop-blur text-white hover:bg-gray-900/80 transition-colors relative overflow-hidden group">
          <div className="absolute inset-0 bg-purple-600/5 group-hover:bg-purple-600/10 transition-colors" />
          <CardContent className="p-4 md:p-6 flex flex-col items-center justify-center text-center relative z-10">
            <div className="w-16 h-16 rounded-full border-4 border-blue-500 mb-2 flex items-center justify-center bg-gray-900 relative group-hover:border-blue-400 transition-colors">
              <span className="text-xl font-bold text-white">{deliveryPartner?.rating || '5.0'}</span>
            </div>
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-widest">Rating</p>
          </CardContent>
        </Card>
      </div>

      {/* Current Tasks */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
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
            activeOrders.map((order) => (
              <Card key={order.id} className="bg-gray-900 border-gray-800 text-white overflow-hidden hover:border-gray-700 transition-all shadow-xl">
                <div className="h-1 bg-gradient-to-r from-blue-500 to-purple-600 w-full" />
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Order Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge className={`mb-2 ${order.deliveryStatus === 'going_to_restaurant' ? 'bg-orange-500 text-white' :
                          order.deliveryStatus === 'going_to_customer' ? 'bg-blue-600 text-white animate-pulse' :
                            'bg-gray-700 text-gray-300'
                          }`}>
                          {order.deliveryStatus?.replace('_', ' ').toUpperCase() || order.status?.toUpperCase()}
                        </Badge>
                        <h3 className="text-xl font-bold">{order.restaurantName}</h3>
                        <p className="text-sm text-gray-400">Order #{order.id?.slice(0, 8)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-white">₹{order.total?.toFixed(2)}</p>
                        <p className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">COD Payment</p>
                      </div>
                    </div>

                    {/* Restaurant Pickup Phase */}
                    {order.deliveryStatus === 'going_to_restaurant' && (
                      <div className="p-4 bg-orange-900/20 border border-orange-500/30 rounded-lg space-y-3">
                        <h4 className="font-bold text-orange-400 flex items-center gap-2">
                          <Bike className="w-5 h-5" />
                          Pickup from Restaurant
                        </h4>
                        <button
                          onClick={() => openMaps(order.restaurantAddress || order.restaurantName || '')}
                          className="flex items-start gap-2 text-white hover:text-orange-400 transition-colors w-full text-left"
                        >
                          <MapPin className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                          <span className="underline">{order.restaurantAddress || order.restaurantName || 'Restaurant Location'}</span>
                        </button>
                        <Button
                          onClick={() => markPickedUp(order.id!)}
                          className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold"
                        >
                          <Package className="w-4 h-4 mr-2" />
                          Mark as Picked Up
                        </Button>
                      </div>
                    )}

                    {/* Customer Delivery Phase */}
                    {order.deliveryStatus === 'going_to_customer' && (
                      <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg space-y-3">
                        <h4 className="font-bold text-blue-400 flex items-center gap-2">
                          <Navigation className="w-5 h-5" />
                          Deliver to Customer
                        </h4>
                        <button
                          onClick={() => openMaps(formatAddress(order.deliveryAddress))}
                          className="flex items-start gap-2 text-white hover:text-blue-400 transition-colors w-full text-left"
                        >
                          <MapPin className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                          <span className="underline">{formatAddress(order.deliveryAddress)}</span>
                        </button>
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="flex items-center gap-2 text-white hover:text-blue-400 transition-colors"
                        >
                          <Phone className="w-4 h-4 text-blue-500" />
                          <span className="underline">{order.customerPhone}</span>
                        </a>
                        <Button
                          onClick={() => markDelivered(order.id!, order.deliveryOtp)}
                          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12 text-lg shadow-lg shadow-green-900/20"
                        >
                          <CheckCircle className="w-5 h-5 mr-2" />
                          Mark as Delivered
                        </Button>
                      </div>
                    )}

                    {/* Order Items */}
                    <div className="pt-2 border-t border-gray-800">
                      <p className="text-sm text-gray-400 mb-2">Order Items:</p>
                      <div className="space-y-1">
                        {order.items?.slice(0, 3).map((item, idx) => (
                          <p key={idx} className="text-sm text-gray-300">
                            • {item.quantity}x {item.name}
                          </p>
                        ))}
                        {(order.items?.length || 0) > 3 && (
                          <p className="text-sm text-gray-500">+ {(order.items?.length || 0) - 3} more items</p>
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
