'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, Restaurant, DeliveryStage, getRouteDestination, getStageLabel, getStageColor } from '@/lib/types';
import { useTrackDriver } from '@/hooks/useTrackDriver';
import LiveTrackingMap, { MapMarker } from '@/components/tracking/LiveTrackingMap';
import DriverInfoPanel from '@/components/tracking/DriverInfoPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/spinner';
import {
  ArrowLeft, Phone, MapPin, Clock, Bike, ShoppingBag,
  CheckCircle, ChefHat, Package, Truck, Navigation, ShieldCheck,
  Store, UtensilsCrossed, AlertCircle, RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import SafeImage from '@/components/ui/safe-image';

export default function CustomerLiveTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; eta: string } | null>(null);

  // Redirect to standard professional tracking route /customer/orders/tracking/[id]
  useEffect(() => {
    if (orderId) {
      router.replace(`/customer/orders/tracking/${orderId}`);
    }
  }, [orderId, router]);

  // Subscribe to order updates with robust fallback and error handling
  useEffect(() => {
    if (!orderId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'orders', orderId),
      async (docSnap) => {
        if (docSnap.exists()) {
          const orderData = { ...docSnap.data(), id: docSnap.id } as Order;
          setOrder(orderData);

          // Fetch restaurant data
          if (orderData.restaurantId) {
            try {
              const restDoc = await getDoc(doc(db, 'restaurants', orderData.restaurantId));
              if (restDoc.exists()) {
                setRestaurant({ ...restDoc.data(), id: restDoc.id } as Restaurant);
              }
            } catch (err) {
              console.error('Failed to fetch restaurant:', err);
            }
          }
        }
        setLoading(false);
      },
      async (err) => {
        // Silently handle snapshot listener errors and try one-time getDoc fallback
        try {
          const restDoc = await getDoc(doc(db, 'orders', orderId));
          if (restDoc.exists()) {
            const orderData = { ...restDoc.data(), id: restDoc.id } as Order;
            setOrder(orderData);
            if (orderData.restaurantId) {
              try {
                const rDoc = await getDoc(doc(db, 'restaurants', orderData.restaurantId));
                if (rDoc.exists()) setRestaurant({ ...rDoc.data(), id: rDoc.id } as Restaurant);
              } catch {}
            }
          }
        } catch {
          // Gracefully handled
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orderId]);

  // Track driver location
  const { location: driverLocation, loading: trackingLoading } = useTrackDriver(order?.deliveryPersonId);

  // Coordinates with robust defaults
  const DEFAULT_LAT = 12.9716;
  const DEFAULT_LNG = 77.5946;

  const restaurantLat = order?.restaurantLocation?.lat ?? restaurant?.latitude ?? DEFAULT_LAT;
  const restaurantLng = order?.restaurantLocation?.lng ?? restaurant?.longitude ?? DEFAULT_LNG;

  const deliveryAddr = order?.deliveryAddress;
  const customerLat = (deliveryAddr && typeof deliveryAddr !== 'string' && deliveryAddr.latitude)
    ? deliveryAddr.latitude
    : restaurantLat + 0.015;
  const customerLng = (deliveryAddr && typeof deliveryAddr !== 'string' && deliveryAddr.longitude)
    ? deliveryAddr.longitude
    : restaurantLng + 0.012;

  const formatAddress = (addr: any): string => {
    if (typeof addr === 'string') return addr;
    if (addr && typeof addr === 'object') {
      return `${addr.street || ''}, ${addr.city || ''} ${addr.pincode || ''}`.trim();
    }
    return 'Saved Delivery Address';
  };

  // Build map markers
  const mapMarkers = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = [];

    // 1. Driver marker (when live and online)
    if (driverLocation && driverLocation.isOnline && driverLocation.latitude) {
      markers.push({
        id: 'driver',
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        type: 'driver',
        heading: driverLocation.heading,
        label: order?.deliveryPersonName || 'Delivery Partner',
        popup: `<strong>${order?.deliveryPersonName || 'Delivery Partner'}</strong><br/>Live Speed: ${driverLocation.speed || 0} km/h`,
      });
    }

    // 2. Restaurant marker
    markers.push({
      id: 'restaurant',
      latitude: restaurantLat,
      longitude: restaurantLng,
      type: 'restaurant',
      label: order?.restaurantName || restaurant?.name || 'Restaurant',
      popup: `<strong>${order?.restaurantName || restaurant?.name || 'Restaurant'}</strong><br/>${order?.restaurantAddress || restaurant?.address || 'Pickup Point'}`,
    });

    // 3. Customer marker
    markers.push({
      id: 'customer',
      latitude: customerLat,
      longitude: customerLng,
      type: 'customer',
      label: 'Your Location',
      popup: `<strong>Your Delivery Location</strong><br/>${formatAddress(order?.deliveryAddress)}`,
    });

    return markers;
  }, [driverLocation, order, restaurant, restaurantLat, restaurantLng, customerLat, customerLng]);

  const driverPos = driverLocation && driverLocation.isOnline && driverLocation.latitude
    ? { latitude: driverLocation.latitude, longitude: driverLocation.longitude }
    : null;

  const restaurantPos = { latitude: restaurantLat, longitude: restaurantLng };
  const customerPos = { latitude: customerLat, longitude: customerLng };

  // Delivery stage for routing decisions
  const deliveryStage = order?.delivery?.stage as DeliveryStage | undefined;
  const routeDest = getRouteDestination(deliveryStage);

  // Status steps
  const statusSteps = [
    { key: 'confirmed', icon: CheckCircle, label: 'Confirmed' },
    { key: 'preparing', icon: ChefHat, label: 'Kitchen Prep' },
    { key: 'ready', icon: Package, label: 'Ready' },
    { key: 'out_for_delivery', icon: Bike, label: 'On The Way' },
    { key: 'delivered', icon: CheckCircle, label: 'Delivered' },
  ];

  const currentStepIndex = statusSteps.findIndex(s => s.key === order?.status);

  // Stage-specific customer-facing message
  const getCustomerMessage = (): { title: string; subtitle: string; badge: string } => {
    if (!deliveryStage) {
      if (order?.status === 'preparing') {
        return {
          title: 'Your Food is Being Prepared',
          subtitle: 'The master chef is cooking your fresh items with love.',
          badge: 'Chef Preparing',
        };
      }
      if (order?.status === 'confirmed' || order?.status === 'pending') {
        return {
          title: 'Order Confirmed & Sent to Kitchen',
          subtitle: 'The kitchen has accepted your order and is starting prep.',
          badge: 'Order Confirmed',
        };
      }
      if (order?.status === 'ready') {
        return {
          title: 'Food is Packed & Hot',
          subtitle: 'Assigning nearest delivery partner for swift pickup.',
          badge: 'Ready for Pickup',
        };
      }
      if (order?.status === 'out_for_delivery') {
        return {
          title: 'Your Food is Out for Delivery! 🛵',
          subtitle: `${order.deliveryPersonName || 'Delivery Partner'} is riding towards you.`,
          badge: 'Out for Delivery',
        };
      }
      if (order?.status === 'delivered') {
        return {
          title: 'Order Delivered! 🎉',
          subtitle: 'Your food was successfully delivered. Bon Appétit!',
          badge: 'Delivered',
        };
      }
      return {
        title: 'Order in Progress',
        subtitle: 'Live GPS updates and culinary progress appear here.',
        badge: 'In Progress',
      };
    }

    switch (deliveryStage) {
      case 'TO_PICKUP':
        return {
          title: 'Driver Heading to Restaurant',
          subtitle: `${order?.deliveryPersonName || 'Driver'} is on the way to pick up your food.`,
          badge: 'Pickup in Progress',
        };
      case 'ARRIVED_PICKUP':
        return {
          title: 'Driver Arrived at Restaurant',
          subtitle: `${order?.deliveryPersonName || 'Driver'} is at the counter receiving your package.`,
          badge: 'At Restaurant',
        };
      case 'PICKED_UP':
      case 'TO_CUSTOMER':
        return {
          title: 'Food is on the Way to You! 🛵',
          subtitle: `${order?.deliveryPersonName || 'Driver'} has picked up your food and is heading to you.`,
          badge: 'On the Way',
        };
      case 'ARRIVED_CUSTOMER':
        return {
          title: 'Driver Has Arrived! 🏠',
          subtitle: `${order?.deliveryPersonName || 'Driver'} is outside your delivery address. Please share your OTP!`,
          badge: 'Arrived Outside',
        };
      case 'DELIVERED':
        return {
          title: 'Order Delivered! ✅',
          subtitle: 'Your meal has been delivered. Enjoy your culinary experience!',
          badge: 'Delivered',
        };
      default:
        return {
          title: 'Tracking Your Order',
          subtitle: 'Real-time updates will continue to appear here.',
          badge: 'Tracking',
        };
    }
  };

  const customerMsg = getCustomerMessage();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-3">
        <Loader className="w-8 h-8 text-primary" />
        <p className="text-sm font-bold text-muted-foreground animate-pulse">Loading live tracking system...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-screen bg-background p-4">
        <div className="text-center bg-card p-8 rounded-3xl border border-border/80 shadow-xl max-w-sm">
          <MapPin className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2 text-foreground">Order Not Found</h2>
          <p className="text-xs text-muted-foreground mb-6">We could not locate this order in your live history.</p>
          <Button onClick={() => router.push('/customer/orders')} className="w-full font-bold rounded-xl">
            View All Orders
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 font-sans selection:bg-primary/20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border/60 px-4 py-3 shadow-xs">
        <div className="w-full max-w-[1440px] mx-auto px-1 sm:px-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/customer/orders/${orderId}`)}
              className="rounded-full h-9 w-9 p-0 hover:bg-muted"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Button>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                Live Tracking
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                Order #{orderId.slice(-8).toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-black text-xs uppercase px-2.5 py-1 gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {customerMsg.badge}
            </Badge>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-5 pt-4 space-y-4">
        {/* Status Progress Bar */}
        <div className="bg-card border border-border/70 rounded-3xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            {statusSteps.map((step, i) => {
              const isComplete = i <= currentStepIndex;
              const isCurrent = i === currentStepIndex;
              const Icon = step.icon;
              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center gap-1.5 min-w-[50px]">
                    <div
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center transition-all ${
                        isComplete
                          ? isCurrent
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110 ring-4 ring-primary/20'
                            : 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span
                      className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-center ${
                        isComplete ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < statusSteps.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-1 rounded-full transition-colors ${
                        i < currentStepIndex ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Live Map Area - ALWAYS Active & Rendered */}
        <div className="relative rounded-3xl overflow-hidden border border-border/80 shadow-lg bg-card">
          <div className="h-[46vh] sm:h-[54vh] w-full">
            <LiveTrackingMap
              markers={mapMarkers}
              showRoute={true}
              driverPosition={driverPos}
              restaurantPosition={restaurantPos}
              customerPosition={customerPos}
              routeDestination={routeDest || 'auto'}
              followDriver={true}
              height="100%"
              onRouteInfo={(info) => setRouteInfo(info ? { distance: info.distance, eta: info.eta } : null)}
            />
          </div>

          {/* Floating Status & ETA Banner */}
          <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            <div className="pointer-events-auto bg-background/90 backdrop-blur-xl border border-border/80 rounded-2xl px-3.5 py-2 shadow-xl flex items-center gap-2.5 max-w-[80%]">
              <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                {order.status === 'out_for_delivery' ? (
                  <Bike className="w-4 h-4 animate-bounce" />
                ) : (
                  <ChefHat className="w-4 h-4 animate-pulse" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-foreground truncate">{customerMsg.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">{customerMsg.subtitle}</p>
              </div>
            </div>

            {routeInfo && (
              <motion.div
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="pointer-events-auto bg-card/95 dark:bg-black/85 backdrop-blur-xl border border-primary/30 rounded-2xl px-3.5 py-1.5 flex items-center gap-3 shadow-xl"
              >
                <div className="text-center">
                  <p className="text-foreground dark:text-white font-black text-sm">{routeInfo.distance}</p>
                  <p className="text-muted-foreground text-[9px] uppercase font-bold">Distance</p>
                </div>
                <div className="w-px h-6 bg-border" />
                <div className="text-center">
                  <p className="text-emerald-500 font-black text-sm">{routeInfo.eta}</p>
                  <p className="text-muted-foreground text-[9px] uppercase font-bold">Est. ETA</p>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Security Delivery OTP Card */}
        {order.deliveryOtp && order.status !== 'delivered' && order.status !== 'cancelled' && (
          <div className="bg-gradient-to-r from-primary/10 via-amber-500/10 to-primary/10 border-2 border-primary/30 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-md">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-black tracking-widest text-primary block">
                  Delivery Verification Code
                </span>
                <p className="text-xs font-semibold text-foreground mt-0.5">
                  Share this OTP with your delivery rider when they reach your doorstep.
                </p>
              </div>
            </div>
            <div className="bg-card border-2 border-primary px-5 py-2 rounded-2xl shadow-inner text-center select-all">
              <span className="text-2xl sm:text-3xl font-mono font-black text-primary tracking-[0.3em]">
                {order.deliveryOtp}
              </span>
            </div>
          </div>
        )}

        {/* Driver Info Panel (When assigned) */}
        {order.deliveryPersonId && driverLocation && (
          <DriverInfoPanel
            driverName={order.deliveryPersonName || 'Driver'}
            driverPhone={order.deliveryPersonPhone}
            driverVehicle={order.deliveryVehicle}
            speed={driverLocation.speed}
            heading={driverLocation.heading}
            accuracy={driverLocation.accuracy}
            isOnline={driverLocation.isOnline}
            distance={routeInfo?.distance}
            eta={routeInfo?.eta}
            phase={order.deliveryStatus}
            compact={false}
            className="border border-border/70 bg-card rounded-3xl shadow-sm"
          />
        )}

        {/* Quick Contact Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {order.deliveryPersonPhone ? (
            <a href={`tel:${order.deliveryPersonPhone}`} className="block">
              <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 rounded-2xl shadow-md">
                <Phone className="w-4 h-4" /> Call Delivery Rider ({order.deliveryPersonName || 'Rider'})
              </Button>
            </a>
          ) : (
            <div className="h-12 bg-muted/50 border border-border/60 rounded-2xl px-4 flex items-center gap-2 text-xs text-muted-foreground font-semibold">
              <Bike className="w-4 h-4 text-primary shrink-0" />
              <span>Rider contact will appear once assigned</span>
            </div>
          )}

          {(restaurant?.phone || (order as any).restaurantPhone) ? (
            <a href={`tel:${restaurant?.phone || (order as any).restaurantPhone}`} className="block">
              <Button variant="outline" className="w-full h-12 border-border/80 font-bold gap-2 rounded-2xl hover:bg-muted text-foreground">
                <Store className="w-4 h-4 text-primary" /> Call Restaurant ({order.restaurantName})
              </Button>
            </a>
          ) : (
            <div className="h-12 bg-muted/50 border border-border/60 rounded-2xl px-4 flex items-center gap-2 text-xs text-muted-foreground font-semibold">
              <Store className="w-4 h-4 text-primary shrink-0" />
              <span>Restaurant: {order.restaurantName || 'Kitchen'}</span>
            </div>
          )}
        </div>

        {/* Route Details Breakdown */}
        <div className="bg-card border border-border/70 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <h2 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
              <Navigation className="w-4 h-4 text-primary" /> Delivery Route Information
            </h2>
            {deliveryStage && (
              <Badge className={`${getStageColor(deliveryStage).bg} ${getStageColor(deliveryStage).text} border text-[10px] font-bold`}>
                {getStageLabel(deliveryStage)}
              </Badge>
            )}
          </div>

          <div className="relative pl-6 space-y-5 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
            {/* Restaurant Pickup Point */}
            <div className="relative">
              <div className="absolute -left-[17px] top-1 w-4 h-4 rounded-full border-2 border-orange-500 bg-orange-500/20 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-orange-500 mb-0.5">
                  Pickup Location
                </p>
                <p className="font-bold text-sm text-foreground">{order.restaurantName}</p>
                <p className="text-muted-foreground text-xs">{order.restaurantAddress || restaurant?.address || 'Restaurant Kitchen'}</p>
              </div>
            </div>

            {/* Customer Drop Point */}
            <div className="relative">
              <div className="absolute -left-[17px] top-1 w-4 h-4 rounded-full border-2 border-emerald-500 bg-emerald-500/20 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-500 mb-0.5">
                  Delivery Destination
                </p>
                <p className="font-bold text-sm text-foreground">Your Address</p>
                <p className="text-muted-foreground text-xs">{formatAddress(order.deliveryAddress)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ordered Dishes Summary */}
        <div className="bg-card border border-border/70 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-primary" /> Order Summary ({order.items?.length || 0})
            </h2>
            <span className="text-xs font-bold text-primary font-mono">
              Total: ₹{order.total}
            </span>
          </div>

          <div className="space-y-2.5">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs sm:text-sm py-1">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-md bg-muted flex items-center justify-center font-bold text-[11px] text-foreground border border-border/60">
                    {item.quantity}x
                  </span>
                  <span className="font-semibold text-foreground">{item.name}</span>
                </div>
                <span className="font-bold text-foreground">₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-border/60 flex justify-between items-center text-xs text-muted-foreground">
            <span>Payment: <strong className="text-foreground capitalize">{order.paymentMethod}</strong> ({order.paymentStatus || 'pending'})</span>
            <Button
              variant="link"
              size="sm"
              onClick={() => router.push(`/customer/orders/${orderId}`)}
              className="text-primary font-bold p-0 h-auto text-xs"
            >
              Full Order Details ➔
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
