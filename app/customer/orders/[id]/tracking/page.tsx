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
  CheckCircle, ChefHat, Package, Truck, Navigation
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function CustomerLiveTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; eta: string } | null>(null);

  // Subscribe to order updates
  useEffect(() => {
    if (!orderId) return;

    const unsubscribe = onSnapshot(doc(db, 'orders', orderId), async (docSnap) => {
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
    });

    return () => unsubscribe();
  }, [orderId]);

  // Track driver location
  const { location: driverLocation, loading: trackingLoading } = useTrackDriver(order?.deliveryPersonId);

  // Build map markers
  const mapMarkers = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = [];

    // Driver marker (live)
    if (driverLocation && driverLocation.isOnline && driverLocation.latitude) {
      markers.push({
        id: 'driver',
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        type: 'driver',
        heading: driverLocation.heading,
        label: order?.deliveryPersonName || 'Driver',
        popup: `<strong>${order?.deliveryPersonName || 'Driver'}</strong><br/>Speed: ${driverLocation.speed} km/h`,
      });
    }

    // Restaurant marker
    if (order?.restaurantLocation) {
      markers.push({
        id: 'restaurant',
        latitude: order.restaurantLocation.lat,
        longitude: order.restaurantLocation.lng,
        type: 'restaurant',
        label: order.restaurantName,
        popup: `<strong>${order.restaurantName}</strong><br/>${order.restaurantAddress || 'Restaurant'}`,
      });
    } else if (restaurant?.latitude && restaurant?.longitude) {
      markers.push({
        id: 'restaurant',
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
        type: 'restaurant',
        label: restaurant.name,
        popup: `<strong>${restaurant.name}</strong>`,
      });
    }

    // Customer marker
    const deliveryAddr = order?.deliveryAddress;
    if (deliveryAddr && typeof deliveryAddr !== 'string' && deliveryAddr.latitude && deliveryAddr.longitude) {
      markers.push({
        id: 'customer',
        latitude: deliveryAddr.latitude,
        longitude: deliveryAddr.longitude,
        type: 'customer',
        label: 'Your Location',
        popup: `<strong>Delivery Location</strong><br/>${deliveryAddr.street || 'Your address'}`,
      });
    }

    return markers;
  }, [driverLocation, order, restaurant]);

  const driverPos = driverLocation && driverLocation.isOnline
    ? { latitude: driverLocation.latitude, longitude: driverLocation.longitude }
    : null;

  const restaurantPos = order?.restaurantLocation
    ? { latitude: order.restaurantLocation.lat, longitude: order.restaurantLocation.lng }
    : restaurant?.latitude && restaurant?.longitude
      ? { latitude: restaurant.latitude, longitude: restaurant.longitude }
      : null;

  const customerPos = (() => {
    const addr = order?.deliveryAddress;
    if (addr && typeof addr !== 'string' && addr.latitude && addr.longitude) {
      return { latitude: addr.latitude, longitude: addr.longitude };
    }
    return null;
  })();

  const formatAddress = (addr: any): string => {
    if (typeof addr === 'string') return addr;
    if (addr && typeof addr === 'object') {
      return `${addr.street || ''}, ${addr.city || ''} ${addr.pincode || ''}`.trim();
    }
    return 'Address not available';
  };

  // Delivery stage for routing decisions
  const deliveryStage = order?.delivery?.stage as DeliveryStage | undefined;
  const routeDest = getRouteDestination(deliveryStage);

  // Enhanced status steps with delivery stages
  const statusSteps = [
    { key: 'confirmed', icon: CheckCircle, label: 'Confirmed', color: 'blue' },
    { key: 'preparing', icon: ChefHat, label: 'Preparing', color: 'purple' },
    { key: 'ready', icon: Package, label: 'Ready', color: 'cyan' },
    { key: 'out_for_delivery', icon: Bike, label: 'On the way', color: 'emerald' },
    { key: 'delivered', icon: CheckCircle, label: 'Delivered', color: 'green' },
  ];

  const currentStepIndex = statusSteps.findIndex(s => s.key === order?.status);

  // Stage-specific customer-facing message
  const getCustomerMessage = (): { title: string; subtitle: string } => {
    if (!deliveryStage) {
      if (order?.status === 'preparing') return { title: 'Your food is being prepared', subtitle: 'The restaurant is preparing your order.' };
      if (order?.status === 'confirmed') return { title: 'Order confirmed', subtitle: 'Your order has been confirmed and will be prepared shortly.' };
      if (order?.status === 'delivered') return { title: 'Order delivered!', subtitle: 'Your order has been delivered. Enjoy your meal!' };
      return { title: 'Waiting for driver', subtitle: 'A delivery partner will be assigned soon.' };
    }
    switch (deliveryStage) {
      case 'TO_PICKUP': return { title: 'Driver heading to restaurant', subtitle: `${order?.deliveryPersonName || 'Driver'} is on the way to pick up your food.` };
      case 'ARRIVED_PICKUP': return { title: 'Driver arrived at restaurant', subtitle: `${order?.deliveryPersonName || 'Driver'} is at the restaurant waiting for your food.` };
      case 'PICKED_UP':
      case 'TO_CUSTOMER': return { title: 'Your food is on the way! 🎉', subtitle: `${order?.deliveryPersonName || 'Driver'} has picked up your food and is heading to you.` };
      case 'ARRIVED_CUSTOMER': return { title: 'Driver has arrived! 🏠', subtitle: `${order?.deliveryPersonName || 'Driver'} is at your location. Please collect your order.` };
      case 'DELIVERED': return { title: 'Order delivered! ✅', subtitle: 'Your order has been delivered. Enjoy your meal!' };
      default: return { title: 'Tracking your order', subtitle: 'Live updates will appear here.' };
    }
  };
  const customerMsg = getCustomerMessage();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Order not found</h2>
          <Button onClick={() => router.push('/customer/orders')}>Back to Orders</Button>
        </div>
      </div>
    );
  }

  const isTrackable = ['ready', 'out_for_delivery'].includes(order.status || '') && order.deliveryPersonId;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/customer/orders/${orderId}`)}
              className="rounded-full h-9 w-9 p-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Live Tracking</h1>
              <p className="text-xs text-muted-foreground font-mono">#{orderId.slice(0, 8)}</p>
            </div>
          </div>
          {driverLocation?.isOnline && (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </Badge>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Status Progress Bar */}
        <div className="px-4 py-4 border-b border-border/30">
          <div className="flex items-center justify-between">
            {statusSteps.map((step, i) => {
              const isComplete = i <= currentStepIndex;
              const isCurrent = i === currentStepIndex;
              const Icon = step.icon;
              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isComplete
                        ? isCurrent ? 'bg-primary text-primary-foreground shadow-lg scale-110' : 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${
                      isComplete ? 'text-primary' : 'text-muted-foreground'
                    }`}>{step.label}</span>
                  </div>
                  {i < statusSteps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 rounded-full ${
                      i < currentStepIndex ? 'bg-primary' : 'bg-muted'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Map Area */}
        <div className="relative">
          {isTrackable && mapMarkers.length > 0 ? (
            <div className="h-[45vh] md:h-[55vh]">
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

              {/* ETA Overlay */}
              {routeInfo && (
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="absolute top-14 left-1/2 -translate-x-1/2 z-10 bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-4"
                >
                  <div className="text-center">
                    <p className="text-white font-bold text-lg">{routeInfo.distance}</p>
                    <p className="text-gray-400 text-[10px] uppercase font-bold">Away</p>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div className="text-center">
                    <p className="text-green-400 font-bold text-lg">{routeInfo.eta}</p>
                    <p className="text-gray-400 text-[10px] uppercase font-bold">ETA</p>
                  </div>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="h-[30vh] flex flex-col items-center justify-center bg-muted/30 border-b">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                {order.status === 'preparing' ? (
                  <ChefHat className="w-8 h-8 text-muted-foreground animate-pulse" />
                ) : order.status === 'confirmed' ? (
                  <CheckCircle className="w-8 h-8 text-muted-foreground" />
                ) : order.status === 'delivered' ? (
                  <CheckCircle className="w-8 h-8 text-green-500" />
                ) : deliveryStage === 'ARRIVED_CUSTOMER' ? (
                  <Navigation className="w-8 h-8 text-green-500 animate-bounce" />
                ) : (
                  <MapPin className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <h3 className="text-lg font-bold mb-1">{customerMsg.title}</h3>
              <p className="text-muted-foreground text-sm text-center max-w-sm">{customerMsg.subtitle}</p>
            </div>
          )}
        </div>

        {/* Driver Info & Order Details */}
        <div className="px-4 py-4 space-y-4">
          {/* Driver Info */}
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
              className="border border-border/50 bg-card"
            />
          )}

          {/* Route Visualization — Stage-Aware */}
          <div className="bg-card border border-border/50 rounded-2xl p-4">
            {/* Stage indicator */}
            {deliveryStage && (
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/30">
                {(() => {
                  const sc = getStageColor(deliveryStage);
                  return (
                    <Badge className={`${sc.bg} ${sc.text} border ${sc.border} text-[10px] font-bold`}>
                      {getStageLabel(deliveryStage)}
                    </Badge>
                  );
                })()}
                {routeInfo && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {routeInfo.distance} • ETA {routeInfo.eta}
                  </span>
                )}
              </div>
            )}

            <div className="relative pl-6 space-y-4 before:absolute before:left-[11px] before:top-3 before:bottom-3 before:w-0.5 before:bg-border">
              {/* Restaurant */}
              <div className="relative">
                <div className={`absolute -left-[15px] top-1 w-3.5 h-3.5 rounded-full border-2 ${
                  deliveryStage === 'TO_PICKUP'
                    ? 'border-orange-500 bg-orange-500 animate-pulse'
                    : deliveryStage === 'ARRIVED_PICKUP'
                      ? 'border-amber-500 bg-amber-500 animate-pulse'
                      : 'border-orange-500 bg-orange-500/30'
                }`} />
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-orange-500 mb-0.5">
                    {deliveryStage === 'ARRIVED_PICKUP' ? '📍 Driver at Restaurant' : deliveryStage === 'TO_PICKUP' ? '🛵 Driver heading here' : '✓ Picked Up'}
                  </p>
                  <p className="font-bold text-sm">{order.restaurantName}</p>
                  <p className="text-muted-foreground text-xs">{order.delivery?.pickup?.address || order.restaurantAddress || 'Restaurant'}</p>
                </div>
              </div>

              {/* Driver Position */}
              {driverLocation?.isOnline && (
                <div className="relative">
                  <div className="absolute -left-[15px] top-1 w-3.5 h-3.5 rounded-full border-2 border-blue-500 bg-blue-500 animate-pulse" />
                  <div className="flex items-center gap-2">
                    <Bike className="w-4 h-4 text-blue-500" />
                    <span className="text-blue-500 font-bold text-sm">
                      {order.deliveryPersonName || 'Driver'} • {driverLocation.speed} km/h
                    </span>
                    {deliveryStage && (
                      <span className="text-muted-foreground text-[10px] ml-1">
                        → {routeDest === 'restaurant' ? 'Restaurant' : 'You'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Customer */}
              <div className="relative">
                <div className={`absolute -left-[15px] top-1 w-3.5 h-3.5 rounded-full border-2 ${
                  deliveryStage === 'TO_CUSTOMER' || deliveryStage === 'PICKED_UP'
                    ? 'border-green-500 bg-green-500 animate-pulse'
                    : deliveryStage === 'ARRIVED_CUSTOMER'
                      ? 'border-green-500 bg-green-500 animate-bounce'
                      : 'border-green-500 bg-green-500/30'
                }`} />
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-green-500 mb-0.5">
                    {deliveryStage === 'ARRIVED_CUSTOMER' ? '🏠 Driver Arrived!' : deliveryStage === 'TO_CUSTOMER' || deliveryStage === 'PICKED_UP' ? '🛵 Coming to you' : 'Delivery'}
                  </p>
                  <p className="font-bold text-sm">Your Location</p>
                  <p className="text-muted-foreground text-xs">{order.delivery?.drop?.address || formatAddress(order.deliveryAddress)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Call Driver Button */}
          {order.deliveryPersonPhone && (
            <a href={`tel:${order.deliveryPersonPhone}`} className="block">
              <Button className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold gap-2 rounded-xl">
                <Phone className="w-4 h-4" />
                Call {order.deliveryPersonName || 'Driver'}
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
