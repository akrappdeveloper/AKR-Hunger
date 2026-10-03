'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, Restaurant, DeliveryPerson, DeliveryStage, getRouteDestination, getStageLabel, formatOrderId } from '@/lib/types';
import { useTrackDriver } from '@/hooks/useTrackDriver';
import LiveTrackingMap, { MapMarker } from '@/components/tracking/LiveTrackingMap';
import DriverInfoPanel from '@/components/tracking/DriverInfoPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Phone, MapPin, Clock, Bike, ShoppingBag,
  CheckCircle, ChefHat, Package, Truck, Navigation, ShieldCheck,
  Store, UtensilsCrossed, AlertCircle, RefreshCw, Copy, Check,
  Share2, ExternalLink, Timer, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import SafeImage from '@/components/ui/safe-image';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/utils';

// ─── Real-time Vertical Animated Tracker Canvas ───────────────────────────────
function RealtimeVerticalTracker({ order, driverLocation }: {
  order: Order;
  driverLocation: { lat: number; lng: number } | null;
}) {
  const stage = order?.delivery?.stage;
  const isOutForDelivery = order?.status === 'out_for_delivery';

  const getDriverProgress = () => {
    switch (stage) {
      case 'TO_PICKUP': return 25;
      case 'ARRIVED_PICKUP': return 45;
      case 'TO_CUSTOMER': return 70;
      case 'ARRIVED_CUSTOMER': return 90;
      default:
        if (order?.status === 'delivered') return 100;
        if (isOutForDelivery) return 65;
        if (order?.status === 'ready') return 40;
        if (order?.status === 'preparing') return 20;
        return 5;
    }
  };

  const progress = getDriverProgress();
  const restaurantPincode = (order as any).restaurantPincode || '---';
  const customerPincode = (order as any).deliveryAddress?.pincode || '---';

  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-white/10 shadow-2xl p-5">
      {/* Ambient glow backgrounds */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-48 h-48 bg-orange-500/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative flex flex-col md:flex-row items-center gap-6">
        {/* LEFT: Track Diagram */}
        <div className="flex flex-col items-center justify-between h-72 py-3 relative w-32 shrink-0">
          {/* Track line background */}
          <div className="absolute top-8 bottom-8 left-1/2 -translate-x-1/2 w-1.5 bg-white/10 rounded-full" />
          
          {/* Live Progress Fill */}
          <div
            className="absolute top-8 left-1/2 -translate-x-1/2 w-1.5 bg-gradient-to-b from-orange-500 via-amber-400 to-emerald-400 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(249,115,22,0.6)]"
            style={{ height: `${Math.min(progress, 90)}%`, maxHeight: 'calc(100% - 64px)' }}
          />

          {/* Restaurant Stop */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-11 h-11 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/40 border-2 border-orange-300">
              <ChefHat className="w-5 h-5 text-white" />
            </div>
            <span className="text-[10px] text-orange-300 font-extrabold tracking-wider mt-1">KITCHEN</span>
            <span className="text-[9px] text-white/50">{restaurantPincode}</span>
          </div>

          {/* Live Driver Dot on Track */}
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 z-20"
            style={{ top: `calc(10% + ${progress * 0.72}%)` }}
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="relative">
              <div className="absolute inset-0 -m-3 rounded-full bg-orange-400/25 animate-ping" />
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-xl shadow-orange-500/50 border-2 border-white">
                <Bike className="w-5 h-5 text-white" />
              </div>
            </div>
          </motion.div>

          {/* Customer Stop */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40 border-2 border-emerald-300">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <span className="text-[10px] text-emerald-300 font-extrabold tracking-wider mt-1">YOU</span>
            <span className="text-[9px] text-white/50">{customerPincode}</span>
          </div>
        </div>

        {/* RIGHT: Live Status Panel */}
        <div className="flex-1 w-full space-y-4">
          <div className="flex items-center justify-between">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-3 py-1 font-bold text-xs uppercase tracking-wider gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Tracking Active
            </Badge>
            {driverLocation && (
              <span className="text-white/40 text-[10px] font-mono">
                GPS: {driverLocation.lat.toFixed(4)}, {driverLocation.lng.toFixed(4)}
              </span>
            )}
          </div>

          <div>
            <p className="text-white/50 text-[11px] uppercase tracking-widest font-semibold">Current Status</p>
            <p className="text-white font-black text-xl sm:text-2xl mt-0.5 leading-tight">
              {stage === 'TO_PICKUP' ? '🏍️ Driver Heading to Restaurant' :
               stage === 'ARRIVED_PICKUP' ? '🍱 Collecting Your Food' :
               stage === 'TO_CUSTOMER' ? '🚀 Rider is On the Way to You' :
               stage === 'ARRIVED_CUSTOMER' ? '📍 Driver Arrived at Doorstep!' :
               order?.status === 'out_for_delivery' ? '🛵 Food Out for Delivery' :
               order?.status === 'ready' ? '📦 Order Packed & Ready' :
               order?.status === 'preparing' ? '👨‍🍳 Kitchen is Cooking' :
               order?.status === 'delivered' ? '🎉 Delivered! Enjoy your meal!' :
               '✅ Order Placed & Confirmed'}
            </p>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-white/60 font-semibold">
              <span>Delivery Journey</span>
              <span className="text-orange-400 font-bold">{progress}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-orange-400 via-amber-400 to-emerald-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Driver Mini Card */}
          {order?.deliveryPersonName && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                  <Bike className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{order.deliveryPersonName}</p>
                  <p className="text-white/50 text-xs">Your Delivery Executive</p>
                </div>
              </div>
              {order.deliveryPersonPhone && (
                <a
                  href={`tel:${order.deliveryPersonPhone}`}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-500/30"
                >
                  <Phone className="w-3.5 h-3.5" /> Call Rider
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Live ETA Countdown ───────────────────────────────────────────────────────
function ETATimer({ createdAt, estimatedMins }: { createdAt: any; estimatedMins: number }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const compute = () => {
      if (!createdAt) return;
      const createdDate = createdAt instanceof Date ? createdAt : new Date(createdAt);
      const etaMs = createdDate.getTime() + estimatedMins * 60 * 1000;
      const diff = Math.max(0, Math.floor((etaMs - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    compute();
    const interval = setInterval(compute, 1000);
    return () => clearInterval(interval);
  }, [createdAt, estimatedMins]);

  if (secondsLeft === null) return null;
  if (secondsLeft === 0) {
    return <span className="text-emerald-400 font-black animate-pulse">Arriving Any Moment!</span>;
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <span className="font-mono font-black tabular-nums text-primary text-xl">
      {mins > 0 ? `${mins}m ` : ''}{secs.toString().padStart(2, '0')}s
    </span>
  );
}

// ─── Stepper Component ────────────────────────────────────────────────────────
const STATUS_STEPS = [
  { key: 'confirmed', label: 'Order Confirmed', icon: ShoppingBag, color: 'blue' },
  { key: 'preparing', label: 'Cooking in Kitchen', icon: UtensilsCrossed, color: 'amber' },
  { key: 'ready', label: 'Food Packed', icon: Package, color: 'purple' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Bike, color: 'orange' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'emerald' },
];

function getStepIndex(status: string) {
  if (status === 'pending') return 0;
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx === -1 ? 0 : idx;
}

// ─── Main Dedicated Order Tracking Page ───────────────────────────────────────
export default function CustomerOrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = (params.id as string) || '';

  const [order, setOrder] = useState<Order | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [deliveryPerson, setDeliveryPerson] = useState<DeliveryPerson | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // Real-time Order Subscription with getDoc Fallback
  useEffect(() => {
    if (!orderId) return;

    const unsub = onSnapshot(
      doc(db, 'orders', orderId),
      async (snap) => {
        if (snap.exists()) {
          const data = { ...snap.data(), id: snap.id } as Order;
          if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate();

          let otp = data.deliveryOtp;
          if (!otp && !['delivered', 'cancelled'].includes(data.status || '')) {
            otp = (Math.abs(orderId.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0)) % 9000 + 1000).toString();
            data.deliveryOtp = otp;
            updateDoc(doc(db, 'orders', orderId), { deliveryOtp: otp }).catch(() => {});
          }

          setOrder(data);

          if (data.restaurantId) {
            try {
              const rSnap = await getDoc(doc(db, 'restaurants', data.restaurantId));
              if (rSnap.exists()) setRestaurant({ ...rSnap.data(), id: rSnap.id } as Restaurant);
            } catch {}
          }
        } else {
          setOrder(null);
        }
        setLoading(false);
      },
      async () => {
        // Fallback: try one-time getDoc
        try {
          const snap = await getDoc(doc(db, 'orders', orderId));
          if (snap.exists()) {
            const data = { ...snap.data(), id: snap.id } as Order;
            if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate();
            setOrder(data);
            if (data.restaurantId) {
              const rSnap = await getDoc(doc(db, 'restaurants', data.restaurantId));
              if (rSnap.exists()) setRestaurant({ ...rSnap.data(), id: rSnap.id } as Restaurant);
            }
          } else {
            setOrder(null);
          }
        } catch {}
        setLoading(false);
      }
    );

    return () => unsub();
  }, [orderId]);

  // Real-time Delivery Partner and GPS Listeners
  useEffect(() => {
    if (!order?.deliveryPersonId) return;

    const dpUnsub = onSnapshot(
      doc(db, 'deliveryPersons', order.deliveryPersonId),
      (snap) => {
        if (snap.exists()) setDeliveryPerson({ ...snap.data(), id: snap.id } as DeliveryPerson);
      },
      () => {}
    );

    const locUnsub = onSnapshot(
      doc(db, 'driverLocations', order.deliveryPersonId),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const lat = d.latitude ?? d.lat;
          const lng = d.longitude ?? d.lng;
          if (lat != null && lng != null) {
            setDriverLocation({ lat, lng });
          }
        }
      },
      () => {}
    );

    return () => { dpUnsub(); locUnsub(); };
  }, [order?.deliveryPersonId]);

  const copyOrderId = () => {
    copyToClipboard(orderId);
    toast.success(`Order ID #${orderId} copied to clipboard!`);
  };

  const shareTrackingLink = () => {
    // Official production domain https://shunger.vercel.app/
    const trackingUrl = `https://shunger.vercel.app/customer/orders/tracking/${orderId}`;
    copyToClipboard(trackingUrl);
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      (navigator as any).share({
        title: `Hunger Live Order Tracking #${orderId}`,
        text: `Track your food delivery in real-time on Hunger:`,
        url: trackingUrl,
      }).catch(() => {});
    }
    toast.success('Live Tracking URL copied! ' + trackingUrl);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-lg" />
          <p className="text-muted-foreground font-semibold text-sm">Connecting to live satellite tracking...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-3xl p-8 max-w-md w-full text-center shadow-xl">
          <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-foreground mb-1">Order Not Found</h2>
          <p className="text-sm text-muted-foreground mb-6 font-mono">
            Could not find order #{orderId}. It may have expired or was removed.
          </p>
          <div className="space-y-3">
            <Button onClick={() => router.push('/customer/orders')} className="w-full rounded-2xl font-bold">
              View My Orders
            </Button>
            <Button variant="outline" onClick={() => router.push('/customer')} className="w-full rounded-2xl">
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const stepIndex = getStepIndex(order.status || 'confirmed');
  const isDelivered = order.status === 'delivered';
  const isCancelled = order.status === 'cancelled';
  const displayId = formatOrderId(order.id || orderId);

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 font-sans selection:bg-primary/20">
      {/* Top Header Bar */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/70 px-4 py-3 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push('/customer/orders')}
              className="rounded-2xl h-10 w-10 shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-foreground flex items-center gap-1.5">
                  Live Tracking
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                </h1>
                <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 bg-muted/60 text-foreground font-bold">
                  #{displayId}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate max-w-[200px] sm:max-w-xs">
                {order.restaurantName || 'Restaurant'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyOrderId}
              title="Copy Order ID"
              className="p-2 rounded-xl border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={shareTrackingLink}
              title="Share Tracking Link"
              className="p-2 rounded-xl border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <Button
              variant="default"
              size="sm"
              onClick={() => router.push(`/customer/orders/${order.id || orderId}`)}
              className="rounded-xl font-bold text-xs hidden sm:flex items-center gap-1"
            >
              Order Details <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Live Vertical Animation Canvas */}
        <RealtimeVerticalTracker order={order} driverLocation={driverLocation} />

        {/* Live ETA Card */}
        {!isDelivered && !isCancelled && (
          <div className="bg-card border border-primary/20 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-primary/5 via-card to-primary/5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-inner">
                <Timer className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estimated Delivery Time</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <ETATimer createdAt={order.createdAt} estimatedMins={(order as any).estimatedDeliveryMinutes || 35} />
                  <span className="text-xs text-muted-foreground">remaining</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/customer/orders/${order.id || orderId}`)}
                className="w-full sm:w-auto rounded-xl text-xs font-bold sm:hidden"
              >
                View Full Details
              </Button>
            </div>
          </div>
        )}

        {/* Delivery Verification OTP Security Card */}
        {!isDelivered && !isCancelled && (
          <div className="bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-orange-500/15 border-2 border-orange-500/30 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                  Delivery Verification Code
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Share this 4-digit security OTP with the delivery partner upon arrival to confirm delivery.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-3xl sm:text-4xl font-black font-mono tracking-[0.25em] text-foreground bg-card px-4 py-2 rounded-2xl border border-border shadow-inner select-all">
                {order.deliveryOtp || '----'}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (order.deliveryOtp) {
                    copyToClipboard(order.deliveryOtp);
                    toast.success('Delivery OTP copied: ' + order.deliveryOtp);
                  }
                }}
                className="h-10 px-3.5 rounded-xl text-xs font-bold gap-1.5 border-orange-500/40 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
              >
                <Copy className="w-4 h-4" /> Copy
              </Button>
            </div>
          </div>
        )}

        {/* Stepper Steps Card */}
        <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Delivery Steps
          </h2>

          <div className="relative">
            {/* Step Line */}
            <div className="grid grid-cols-5 gap-2 relative">
              {STATUS_STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isPassed = idx <= stepIndex;
                const isCurrent = idx === stepIndex;

                return (
                  <div key={step.key} className="flex flex-col items-center text-center space-y-1.5">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                        isPassed
                          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30 scale-105'
                          : 'bg-muted text-muted-foreground border border-border'
                      } ${isCurrent ? 'ring-4 ring-primary/20 animate-pulse' : ''}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <p className={`text-[11px] font-bold leading-tight line-clamp-2 ${
                      isPassed ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {step.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Two Column Grid: Rider Info & Restaurant Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Driver Card */}
          <div className="bg-card border border-border rounded-3xl p-5 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Bike className="w-4 h-4 text-primary" /> Delivery Partner
                </span>
                <Badge variant="outline" className="text-[10px] font-bold">
                  {order.deliveryPersonName ? 'Assigned' : 'Searching Partner'}
                </Badge>
              </div>

              {order.deliveryPersonName ? (
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center font-black text-lg shrink-0">
                    {order.deliveryPersonName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-base text-foreground truncate">{order.deliveryPersonName}</h3>
                    <p className="text-xs text-muted-foreground">
                      {deliveryPerson?.vehicleNumber ? `Vehicle: ${deliveryPerson.vehicleNumber}` : 'Verified AKR Rider'}
                    </p>
                    {deliveryPerson?.averageRating && (
                      <p className="text-xs font-bold text-amber-500 flex items-center gap-1 mt-0.5">
                        ★ {deliveryPerson.averageRating.toFixed(1)} / 5.0
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-2">
                  Matching with the closest delivery driver in your area...
                </p>
              )}
            </div>

            {order.deliveryPersonPhone && (
              <a
                href={`tel:${order.deliveryPersonPhone}`}
                className="w-full py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <Phone className="w-4 h-4" /> Call Driver ({order.deliveryPersonPhone})
              </a>
            )}
          </div>

          {/* Restaurant Card */}
          <div className="bg-card border border-border rounded-3xl p-5 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-primary" /> Kitchen Partner
                </span>
                <Badge variant="outline" className="text-[10px] font-bold">
                  Verified
                </Badge>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-black text-lg shrink-0">
                  <UtensilsCrossed className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-base text-foreground truncate">{order.restaurantName || restaurant?.name || 'Restaurant'}</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {order.restaurantAddress || restaurant?.address || 'Pickup Point'}
                  </p>
                </div>
              </div>
            </div>

            {restaurant?.phone && (
              <a
                href={`tel:${restaurant.phone}`}
                className="w-full py-2.5 rounded-2xl bg-muted hover:bg-muted/80 text-foreground font-bold text-xs flex items-center justify-center gap-2 transition-colors border border-border"
              >
                <Phone className="w-4 h-4 text-muted-foreground" /> Call Restaurant ({restaurant.phone})
              </a>
            )}
          </div>
        </div>

        {/* Order Items & Bill Summary */}
        <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h2 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-primary" /> Order Items ({order.items?.length || 0})
            </h2>
            <span className="text-xs font-black text-primary font-mono text-base">
              ₹{order.total}
            </span>
          </div>

          <div className="divide-y divide-border/60">
            {order.items?.map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center font-bold text-xs border border-border">
                    {item.quantity}x
                  </span>
                  <span className="font-semibold text-foreground">{item.name}</span>
                </div>
                <span className="font-bold text-foreground">₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-border space-y-1.5 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Payment Mode:</span>
              <span className="font-bold text-foreground capitalize">{order.paymentMethod}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery Address:</span>
              <span className="font-semibold text-foreground text-right max-w-xs truncate">
                {typeof order.deliveryAddress === 'string'
                  ? order.deliveryAddress
                  : `${order.deliveryAddress?.street || ''}, ${order.deliveryAddress?.city || ''} ${order.deliveryAddress?.pincode || ''}`}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
