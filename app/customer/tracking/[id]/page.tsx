'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, MapPin, Phone, Clock, CheckCircle2,
  ChefHat, Truck, Package, Star, MessageCircle, Loader2,
  Navigation, RefreshCw
} from 'lucide-react';

interface Order {
  id: string;
  status: string;
  restaurantName: string;
  restaurantAddress?: string;
  deliveryAddress: any;
  items: any[];
  total: number;
  deliveryPartner?: {
    name: string;
    phone: string;
    rating?: number;
    vehicleNumber?: string;
  };
  estimatedDeliveryTime?: number;
  createdAt: any;
  updatedAt?: any;
}

const ORDER_STEPS = [
  { key: 'placed', label: 'Order Placed', icon: Package, desc: 'Your order has been received' },
  { key: 'confirmed', label: 'Restaurant Confirmed', icon: CheckCircle2, desc: 'Restaurant accepted your order' },
  { key: 'preparing', label: 'Being Prepared', icon: ChefHat, desc: 'Chef is preparing your food' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck, desc: 'Your rider is on the way' },
  { key: 'delivered', label: 'Delivered', icon: Star, desc: 'Enjoy your meal!' },
];

const statusToStep: Record<string, number> = {
  placed: 0,
  confirmed: 1,
  accepted: 1,
  preparing: 2,
  ready: 3,
  out_for_delivery: 3,
  picked_up: 3,
  delivered: 4,
};

export default function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [eta, setEta] = useState(35);

  // Redirect to standard professional tracking route /customer/orders/tracking/[id]
  useEffect(() => {
    if (id) {
      router.replace(`/customer/orders/tracking/${id}`);
    }
  }, [id, router]);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(
      doc(db, 'orders', id as string),
      (snap) => {
        if (snap.exists()) {
          setOrder({ id: snap.id, ...snap.data() } as Order);
        } else {
          setOrder(null);
        }
        setLoading(false);
      },
      async (err) => {
        // Silently handle error and try getDoc fallback
        try {
          const snap = await getDoc(doc(db, 'orders', id as string));
          if (snap.exists()) {
            setOrder({ id: snap.id, ...snap.data() } as Order);
          } else {
            setOrder(null);
          }
        } catch {
          // Graceful fallback
        }
        setLoading(false);
      }
    );
    return () => unsub();
  }, [id, user]);

  // Countdown ETA
  useEffect(() => {
    if (!order || order.status === 'delivered') return;
    const interval = setInterval(() => {
      setEta(prev => Math.max(1, prev - 1));
    }, 60000);
    return () => clearInterval(interval);
  }, [order]);

  const currentStep = statusToStep[order?.status || 'placed'] ?? 0;
  const progress = (currentStep / (ORDER_STEPS.length - 1)) * 100;
  const isDelivered = order?.status === 'delivered';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <div className="text-6xl mb-4">📦</div>
        <h2 className="text-xl font-bold mb-2">Order not found</h2>
        <p className="text-muted-foreground mb-6">This order may not exist or you don't have access</p>
        <Button onClick={() => router.push('/customer/orders')} className="bg-orange-500 text-white rounded-xl">
          View My Orders
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Map Placeholder / Header */}
      <div className="relative h-56 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 overflow-hidden">
        {/* Animated map dots */}
        <div className="absolute inset-0 opacity-20">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: Math.random(),
              }}
            />
          ))}
        </div>
        {/* Map road lines */}
        <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 400 200">
          <line x1="0" y1="100" x2="400" y2="100" stroke="white" strokeWidth="2" strokeDasharray="8 4" />
          <line x1="200" y1="0" x2="200" y2="200" stroke="white" strokeWidth="2" strokeDasharray="8 4" />
          <line x1="0" y1="50" x2="400" y2="150" stroke="white" strokeWidth="1.5" strokeDasharray="6 3" />
        </svg>

        {/* Animated delivery pin */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            animate={{ scale: [1, 1.2, 1], y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-4xl"
          >
            🛵
          </motion.div>
          <motion.div
            animate={{ scale: [0.8, 1.4, 0.8], opacity: [0.6, 0, 0.6] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-2 bg-orange-400 rounded-full blur-sm"
          />
        </div>

        {/* Restaurant & Destination pins */}
        <div className="absolute top-8 left-12">
          <div className="text-2xl">🍽️</div>
          <p className="text-white text-xs mt-1 font-medium">Restaurant</p>
        </div>
        <div className="absolute bottom-8 right-12">
          <div className="text-2xl">🏠</div>
          <p className="text-white text-xs mt-1 font-medium">Your Location</p>
        </div>

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="w-full max-w-[1440px] mx-auto px-4 py-6 space-y-5 -mt-4">
        {/* ETA Card */}
        {!isDelivered ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="rounded-3xl border-0 shadow-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white">
              <CardContent className="p-6 text-center">
                <p className="text-white/80 text-sm mb-1">Estimated Delivery Time</p>
                <div className="text-5xl font-black mb-1">{eta} min</div>
                <p className="text-white/70 text-xs">Based on current traffic & preparation time</p>
                <div className="flex items-center justify-center gap-2 mt-3">
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-2 h-2 bg-white rounded-full"
                  />
                  <span className="text-sm font-medium">Live Tracking Active</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="rounded-3xl border-0 shadow-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
              <CardContent className="p-6 text-center">
                <div className="text-5xl mb-2">🎉</div>
                <h2 className="text-2xl font-black mb-1">Order Delivered!</h2>
                <p className="text-white/80">Enjoy your meal. Rate your experience below!</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Status Stepper */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="rounded-3xl border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base">Order Status</h3>
                <Badge className="bg-orange-100 text-orange-600 border-0 text-xs">
                  #{order.id.slice(-6).toUpperCase()}
                </Badge>
              </div>
              <div className="space-y-0">
                {ORDER_STEPS.map((step, i) => {
                  const Icon = step.icon;
                  const isCompleted = i <= currentStep;
                  const isCurrent = i === currentStep;
                  return (
                    <div key={step.key} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: i * 0.1 + 0.2 }}
                          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                            isCompleted
                              ? isCurrent && !isDelivered
                                ? 'bg-orange-500 shadow-lg shadow-orange-500/40'
                                : 'bg-emerald-500'
                              : 'bg-muted'
                          }`}
                        >
                          {isCurrent && !isDelivered ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
                              <RefreshCw className="w-4 h-4 text-white" />
                            </motion.div>
                          ) : (
                            <Icon className={`w-4 h-4 ${isCompleted ? 'text-white' : 'text-muted-foreground'}`} />
                          )}
                        </motion.div>
                        {i < ORDER_STEPS.length - 1 && (
                          <div className={`w-0.5 h-8 mt-1 mb-1 rounded-full transition-colors ${
                            i < currentStep ? 'bg-emerald-500' : 'bg-muted'
                          }`} />
                        )}
                      </div>
                      <div className="pb-6 pt-2 flex-1">
                        <p className={`font-semibold text-sm ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {step.label}
                        </p>
                        <p className={`text-xs mt-0.5 ${isCompleted ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Delivery Partner */}
        {order.deliveryPartner && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="rounded-3xl border-0 shadow-lg">
              <CardContent className="p-5">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-orange-500" />
                  Your Delivery Partner
                </h3>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-2xl shadow-lg">
                    🛵
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-lg">{order.deliveryPartner.name}</p>
                    {order.deliveryPartner.vehicleNumber && (
                      <p className="text-sm text-muted-foreground">{order.deliveryPartner.vehicleNumber}</p>
                    )}
                    {order.deliveryPartner.rating && (
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span className="text-sm font-medium">{order.deliveryPartner.rating}</span>
                      </div>
                    )}
                  </div>
                  {order.deliveryPartner.phone && (
                    <a
                      href={`tel:${order.deliveryPartner.phone}`}
                      className="w-11 h-11 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg hover:bg-emerald-600 transition-colors"
                    >
                      <Phone className="w-5 h-5 text-white" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Order Summary */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="rounded-3xl border-0 shadow-lg">
            <CardContent className="p-5">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-500" />
                {order.restaurantName}
              </h3>
              <div className="space-y-2 mb-4">
                {(order.items || []).slice(0, 4).map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.quantity}x {item.name}</span>
                    <span className="font-medium">₹{(item.price * item.quantity).toFixed(0)}</span>
                  </div>
                ))}
                {(order.items || []).length > 4 && (
                  <p className="text-xs text-muted-foreground">+{order.items.length - 4} more items</p>
                )}
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-border">
                <span className="font-bold">Total Paid</span>
                <span className="font-black text-lg text-orange-600">₹{order.total?.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Delivery Address */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="rounded-3xl border-0 shadow-lg">
            <CardContent className="p-5">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-500" />
                Delivering To
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {typeof order.deliveryAddress === 'string'
                  ? order.deliveryAddress
                  : `${order.deliveryAddress?.addressLine1 || ''}, ${order.deliveryAddress?.city || ''}`
                }
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Actions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="rounded-2xl gap-2 h-12"
              onClick={() => router.push('/customer/support')}
            >
              <MessageCircle className="w-4 h-4" />
              Get Help
            </Button>
            {isDelivered && (
              <Button
                className="rounded-2xl gap-2 h-12 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0"
                onClick={() => router.push(`/customer/orders/${order.id}`)}
              >
                <Star className="w-4 h-4" />
                Rate Order
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
