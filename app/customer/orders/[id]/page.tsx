'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, Restaurant, DeliveryPerson } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  Clock,
  MapPin,
  Phone,
  ArrowLeft,
  Check,
  Bike,
  ShoppingBag,
  UtensilsCrossed,
  ChefHat,
  Star,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const orderStatusSteps = [
  { key: 'pending', label: 'Order Confirmed', icon: ShoppingBag, description: 'We have received your order.' },
  { key: 'preparing', label: 'Being Prepared', icon: UtensilsCrossed, description: 'Chef is preparing your food.' },
  { key: 'ready', label: 'Ready for Pickup', icon: Check, description: 'Order is ready for carrier.' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Bike, description: 'Order is on the way.' },
  { key: 'delivered', label: 'Delivered', icon: Check, description: 'Enjoy your meal!' },
];

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [deliveryPerson, setDeliveryPerson] = useState<DeliveryPerson | null>(null);
  const [loading, setLoading] = useState(true);

  // Real-time order tracking
  useEffect(() => {
    if (!orderId) return;

    const unsubscribe = onSnapshot(doc(db, 'orders', orderId), async (docSnapshot) => {
      if (docSnapshot.exists()) {
        const orderData = {
          ...docSnapshot.data(),
          id: docSnapshot.id,
          createdAt: docSnapshot.data().createdAt?.toDate ? docSnapshot.data().createdAt.toDate() : new Date(docSnapshot.data().createdAt)
        } as Order;
        setOrder(orderData);

        // Fetch restaurant details
        if (orderData.restaurantId) {
          const restaurantDoc = await doc(db, 'restaurants', orderData.restaurantId);
          onSnapshot(restaurantDoc, (doc) => {
            if (doc.exists()) {
              setRestaurant({
                ...doc.data(),
                id: doc.id,
              } as Restaurant);
            }
          });
        }

        // Fetch delivery person if assigned
        if (orderData.deliveryPersonId) {
          const deliveryDoc = await doc(
            db,
            'deliveryPersons',
            orderData.deliveryPersonId
          );
          onSnapshot(deliveryDoc, (doc) => {
            if (doc.exists()) {
              setDeliveryPerson({
                ...doc.data(),
                id: doc.id,
              } as DeliveryPerson);
            }
          });
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [orderId]);

  const getStatusIndex = (status: string) => {
    return orderStatusSteps.findIndex((step) => step.key === status);
  };

  const currentStatusIndex = order ? getStatusIndex(order.status || 'pending') : -1;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'confirmed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'preparing': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'ready': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'out_for_delivery': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'delivered': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-800 text-gray-400 border-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center bg-gray-900/50 p-8 rounded-3xl border border-white/10 max-w-md w-full backdrop-blur-md">
          <h2 className="text-2xl font-bold mb-2">Order Not Found</h2>
          <p className="text-gray-400 mb-6">We couldn't find the order you're looking for.</p>
          <Button onClick={() => router.push('/customer/orders')} className="w-full bg-white text-black hover:bg-gray-200 rounded-xl font-bold h-12">
            View All Orders
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24 font-sans selection:bg-orange-500/30">

      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-orange-900/10 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 relative z-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="rounded-full bg-gray-900/50 hover:bg-white/10 text-white border border-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                Order #{order.id.slice(0, 8).toUpperCase()}
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Placed on {order.createdAt instanceof Date ? order.createdAt.toLocaleDateString() : 'Unknown Date'} at {order.createdAt instanceof Date ? order.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </p>
            </div>
          </div>
          <Badge className={`${getStatusColor(order.status || 'pending')} border px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-xl`}>
            {/* Fixed status key for display */}
            {(order.status === 'pending' ? 'Order Placed' : order.status || '').replace('_', ' ')}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main Status & Items Column */}
          <div className="lg:col-span-2 space-y-6">

            {/* Timeline Card */}
            <div className="bg-gray-900/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500 opacity-20" />
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" /> Order Status
              </h2>

              <div className="space-y-8 relative">
                {/* Vertical Line */}
                <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gray-800" />

                {orderStatusSteps.map((step, idx) => {
                  const isCompleted = idx <= currentStatusIndex;
                  const isCurrent = idx === currentStatusIndex;
                  const StepIcon = step.icon;

                  return (
                    <div key={step.key} className="flex gap-4 relative z-10 group">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-4 transition-all duration-500 ${isCompleted
                        ? 'bg-orange-500 border-orange-900/50 text-black shadow-[0_0_15px_rgba(249,115,22,0.4)]'
                        : 'bg-gray-900 border-gray-800 text-gray-600'
                        }`}>
                        {isCompleted ? <Check className="w-5 h-5" /> : <StepIcon className="w-4 h-4" />}
                      </div>

                      <div className={`flex-1 pt-2 transition-all duration-500 ${isCurrent ? 'opacity-100 translate-x-1' : 'opacity-70'}`}>
                        <h3 className={`font-bold text-lg ${isCompleted ? 'text-white' : 'text-gray-500'}`}>
                          {step.label}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">{step.description}</p>

                        {isCurrent && (
                          <div className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full animate-pulse border border-orange-500/20">
                            <span className="w-2 h-2 rounded-full bg-orange-500" />
                            In Progress
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Delivery Person Card */}
            {deliveryPerson ? (
              <div className="bg-gray-900/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 flex flex-col sm:flex-row items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-gray-800 relative overflow-hidden border-2 border-green-500 shadow-lg shadow-green-900/20">
                  {deliveryPerson.avatar ? (
                    <img src={deliveryPerson.avatar} alt={deliveryPerson.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-700 text-gray-400 text-xl font-bold">
                      {deliveryPerson.name[0]}
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900" />
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-bold text-lg text-white mb-1">
                    {deliveryPerson.name}
                    <span className="ml-2 text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-md font-normal border border-gray-700">Delivery Partner</span>
                  </h3>
                  <p className="text-gray-400 text-sm mb-2">{deliveryPerson.vehicle} • {deliveryPerson.vehicleNumber}</p>
                  <div className="flex items-center justify-center sm:justify-start gap-1 text-yellow-500 text-xs font-bold">
                    <Star className="w-3 h-3 fill-yellow-500" /> {deliveryPerson.rating.toFixed(1)} Rating
                  </div>
                </div>

                <a href={`tel:${deliveryPerson.phone}`}>
                  <Button className="rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold px-6 shadow-lg shadow-green-900/20">
                    <Phone className="w-4 h-4 mr-2" /> Call Driver
                  </Button>
                </a>
              </div>
            ) : (
              order.status !== 'delivered' && order.status !== 'cancelled' && (
                <div className="bg-gray-900/30 border border-white/5 border-dashed rounded-3xl p-6 text-center text-gray-500">
                  <Bike className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">A delivery partner will be assigned soon.</p>
                </div>
              )
            )}

            {/* Delivery OTP Display */}
            {order.deliveryOtp && order.status !== 'delivered' && order.status !== 'cancelled' && (
              <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 backdrop-blur-md border border-blue-500/30 rounded-3xl p-6 text-center">
                <h3 className="text-blue-200 uppercase text-xs font-bold tracking-widest mb-2">Delivery Verification Code</h3>
                <div className="text-4xl font-black text-white tracking-[0.5em] font-mono">
                  {order.deliveryOtp}
                </div>
                <p className="text-blue-300/60 text-xs mt-2">Share this code with delivery partner upon arrival</p>
              </div>
            )}

            {/* Order Items */}
            <div className="bg-gray-900/40 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-white/5 bg-white/5">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-gray-400" /> Order Details
                </h2>
              </div>
              <div className="p-6 space-y-4">
                {order.items?.map((item, idx) => (
                  <div key={idx} className="flex gap-4 items-center">
                    <div className="w-16 h-16 rounded-xl bg-gray-800 relative overflow-hidden border border-white/5 flex-shrink-0">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-200">{item.name}</h4>
                      <p className="text-sm text-gray-500 mt-1">Qty: {item.quantity} x ₹{item.price}</p>
                    </div>
                    <div className="font-bold text-white text-lg">
                      ₹{item.price * item.quantity}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">

            {/* Delivery Address */}
            <div className="bg-gray-900/40 backdrop-blur-md border border-white/5 rounded-3xl p-6">
              <h3 className="text-gray-500 font-bold uppercase text-xs tracking-wider mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Delivery Location
              </h3>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 text-blue-500 border border-blue-500/20">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-white text-lg capitalize mb-1">
                    {typeof order.deliveryAddress !== 'string' ? order.deliveryAddress.type : 'Saved Address'}
                  </p>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {typeof order.deliveryAddress !== 'string' ? `${order.deliveryAddress.street}, ${order.deliveryAddress.city}, ${order.deliveryAddress.state} ${order.deliveryAddress.pincode}` : order.deliveryAddress}
                  </p>
                </div>
              </div>
            </div>

            {/* Restaurant Info */}
            {restaurant && (
              <div className="bg-gray-900/40 backdrop-blur-md border border-white/5 rounded-3xl p-6">
                <h3 className="text-gray-500 font-bold uppercase text-xs tracking-wider mb-4 flex items-center gap-2">
                  <ChefHat className="w-4 h-4" /> From Restaurant
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gray-800 overflow-hidden border border-white/5">
                      <img src={restaurant.image} alt={restaurant.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">{restaurant.name}</h4>
                      <p className="text-xs text-gray-500 truncate max-w-[150px]">{restaurant.address}</p>
                    </div>
                  </div>
                  <a href={`tel:${restaurant.phone}`}>
                    <Button variant="outline" className="w-full border-gray-700 hover:bg-white/5 text-gray-300 hover:text-white rounded-xl">
                      <Phone className="w-4 h-4 mr-2" /> Call Restaurant
                    </Button>
                  </a>
                </div>
              </div>
            )}

            {/* Bill Summary */}
            <div className="bg-gray-900/40 backdrop-blur-md border border-white/5 rounded-3xl p-6">
              <h3 className="text-gray-500 font-bold uppercase text-xs tracking-wider mb-4">Payment Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Item Total</span>
                  <span className="text-white">₹{order.subtotal}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Delivery Fee</span>
                  <span className="text-white">₹{order.deliveryCharge}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Taxes</span>
                  <span className="text-white">₹{order.taxes}</span>
                </div>

                <div className="h-px bg-white/10 my-2" />

                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg text-white">Total Pay</span>
                  <span className="font-black text-2xl text-orange-500">₹{order.total}</span>
                </div>

                <div className={`mt-4 p-3 rounded-xl border text-center font-bold text-xs uppercase tracking-wide ${order.paymentStatus === 'completed'
                  ? 'bg-green-500/10 border-green-500/20 text-green-500'
                  : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                  }`}>
                  Payment {order.paymentStatus}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
