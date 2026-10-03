'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc } from 'firebase/firestore';
import { Order, DeliveryStage, getStageLabel, getStageColor, getRouteDestination, formatOrderId } from '@/lib/types';
import LiveTrackingMap, { MapMarker } from '@/components/tracking/LiveTrackingMap';
import DriverInfoPanel from '@/components/tracking/DriverInfoPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft, Bike, MapPin, Clock, ShoppingBag,
  Navigation, Phone, Package, ChefHat, AlertCircle,
  CheckCircle, Satellite, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DriverLocationInfo {
  driverId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
  isOnline: boolean;
}

export default function RestaurantLiveTrackingPage() {
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [driverLocations, setDriverLocations] = useState<Map<string, DriverLocationInfo>>(new Map());

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/restaurant/login');
    }
  }, [user, authLoading, router]);

  // Listen to active orders for this restaurant with assigned drivers
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'orders'),
      where('restaurantId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as Order))
        .filter(o =>
          !['delivered', 'cancelled'].includes(o.status || '') &&
          o.deliveryPersonId
        );
      setActiveOrders(orders);
      if (orders.length > 0 && !selectedDriverId) {
        setSelectedDriverId(orders[0].deliveryPersonId || null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Track all unique driver IDs from active orders
  const driverIds = useMemo(() => {
    const ids = new Set<string>();
    activeOrders.forEach(o => {
      if (o.deliveryPersonId) ids.add(o.deliveryPersonId);
    });
    return Array.from(ids);
  }, [activeOrders]);

  // Subscribe to each driver's location
  useEffect(() => {
    if (driverIds.length === 0) {
      setDriverLocations(new Map());
      return;
    }

    const unsubscribers: (() => void)[] = [];

    driverIds.forEach(driverId => {
      const unsub = onSnapshot(
        doc(db, 'driverLocations', driverId),
        (docSnap: any) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setDriverLocations(prev => {
              const newMap = new Map(prev);
              newMap.set(driverId, {
                driverId: data.driverId,
                latitude: data.latitude,
                longitude: data.longitude,
                speed: data.speed || 0,
                heading: data.heading || 0,
                accuracy: data.accuracy || 0,
                isOnline: data.isOnline || false,
              });
              return newMap;
            });
          }
        }
      );
      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [driverIds]);

  // Current selected order & driver
  const selectedOrder = activeOrders.find(o => o.deliveryPersonId === selectedDriverId) || activeOrders[0];
  const selectedDriverLoc = selectedDriverId
    ? driverLocations.get(selectedDriverId)
    : (selectedOrder?.deliveryPersonId ? driverLocations.get(selectedOrder.deliveryPersonId) : null);

  // Arrived orders (drivers waiting at restaurant for pickup)
  const arrivedOrders = activeOrders.filter(o => o.delivery?.stage === 'ARRIVED_PICKUP');

  // Build map markers
  const mapMarkers = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = [];

    // Restaurant marker (self)
    if (restaurant?.latitude && restaurant?.longitude) {
      markers.push({
        id: 'restaurant',
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
        type: 'restaurant',
        label: restaurant.name,
        popup: `<strong>${restaurant.name}</strong><br/>Your Kitchen Location`,
      });
    }

    // Customer marker for selected order
    if (selectedOrder) {
      const deliveryAddr = selectedOrder.deliveryAddress;
      if (deliveryAddr && typeof deliveryAddr !== 'string' && deliveryAddr.latitude && deliveryAddr.longitude) {
        markers.push({
          id: 'customer',
          latitude: deliveryAddr.latitude,
          longitude: deliveryAddr.longitude,
          type: 'customer',
          label: selectedOrder.customerName,
          popup: `<strong>${selectedOrder.customerName}</strong><br/>${deliveryAddr.street || 'Dropoff Location'}`,
        });
      }
    }

    // Driver markers
    driverLocations.forEach((loc, driverId) => {
      if (loc.isOnline && loc.latitude) {
        const order = activeOrders.find(o => o.deliveryPersonId === driverId);
        const stage = (order?.delivery?.stage || (order?.deliveryStatus === 'going_to_restaurant' ? 'TO_PICKUP' : 'TO_CUSTOMER')) as DeliveryStage;
        markers.push({
          id: `driver-${driverId}`,
          latitude: loc.latitude,
          longitude: loc.longitude,
          type: 'driver',
          heading: loc.heading,
          label: order?.deliveryPersonName || 'Driver',
          popup: `<strong>${order?.deliveryPersonName || 'Driver'}</strong><br/>Stage: ${getStageLabel(stage)}<br/>Speed: ${loc.speed} km/h<br/>Order: #${order?.id?.slice(0, 8) || '—'}`,
        });
      }
    });

    return markers;
  }, [restaurant, driverLocations, activeOrders, selectedOrder]);

  const driverPos = selectedDriverLoc?.isOnline && selectedDriverLoc.latitude
    ? { latitude: selectedDriverLoc.latitude, longitude: selectedDriverLoc.longitude }
    : null;

  const restPos = restaurant?.latitude && restaurant?.longitude
    ? { latitude: restaurant.latitude, longitude: restaurant.longitude }
    : null;

  const custPos = (() => {
    const addr = selectedOrder?.deliveryAddress;
    if (addr && typeof addr !== 'string' && addr.latitude && addr.longitude) {
      return { latitude: addr.latitude, longitude: addr.longitude };
    }
    return null;
  })();

  const currentStage = (selectedOrder?.delivery?.stage || (selectedOrder?.deliveryStatus === 'going_to_restaurant' ? 'TO_PICKUP' : 'TO_CUSTOMER')) as DeliveryStage;
  const currentRouteDest = getRouteDestination(currentStage) || 'restaurant';

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading live tracking data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/restaurant/orders')}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
              <ChefHat className="w-7 h-7 text-primary" /> Live Driver Tracking
            </h1>
            <p className="text-muted-foreground text-sm">
              Realtime GPS route & stage tracking for order pickups and deliveries
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-3.5 py-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-green-600 dark:text-green-400">
              {driverIds.length} Active {driverIds.length === 1 ? 'Driver' : 'Drivers'}
            </span>
          </div>
        </div>
      </div>

      {/* Driver Arrived Urgent Alert Banner */}
      <AnimatePresence>
        {arrivedOrders.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/20 border-2 border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-lg shadow-amber-500/10"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 animate-bounce">
                  <ShoppingBag className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-amber-500 flex items-center gap-2">
                    🛵 Driver Arrived at Kitchen!
                    <Badge className="bg-amber-500 text-black font-black text-[10px] uppercase">Action Required</Badge>
                  </h3>
                  <p className="text-xs sm:text-sm text-foreground/80 mt-0.5">
                    {arrivedOrders.map(o => `${o.deliveryPersonName || 'Driver'} (Order #${o.id?.slice(0, 6).toUpperCase()})`).join(', ')} is waiting at the counter. Hand over the prepared meal.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center">
                {arrivedOrders[0]?.deliveryPersonPhone && (
                  <a href={`tel:${arrivedOrders[0].deliveryPersonPhone}`}>
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl gap-1.5 shadow-sm">
                      <Phone className="w-3.5 h-3.5" /> Call Rider
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map Card */}
      <Card className="overflow-hidden border-border/60 shadow-lg relative">
        <div className="h-[52vh] relative">
          {mapMarkers.length > 0 ? (
            <>
              <LiveTrackingMap
                markers={mapMarkers}
                showRoute={!!selectedOrder && !!driverPos}
                driverPosition={driverPos}
                restaurantPosition={restPos}
                customerPosition={custPos}
                routeDestination={currentRouteDest}
                height="100%"
                onMarkerClick={(id) => {
                  if (id.startsWith('driver-')) {
                    setSelectedDriverId(id.replace('driver-', ''));
                  }
                }}
              />

              {/* Floating Driver Panel */}
              {selectedOrder && selectedDriverLoc && (
                <div className="absolute top-4 right-4 z-10 w-72 sm:w-80 pointer-events-auto">
                  <DriverInfoPanel
                    driverName={selectedOrder.deliveryPersonName || 'Driver'}
                    driverPhone={selectedOrder.deliveryPersonPhone}
                    driverVehicle={selectedOrder.deliveryVehicle}
                    speed={selectedDriverLoc.speed}
                    heading={selectedDriverLoc.heading}
                    accuracy={selectedDriverLoc.accuracy}
                    isOnline={selectedDriverLoc.isOnline}
                    phase={currentStage === 'TO_PICKUP' || currentStage === 'ARRIVED_PICKUP' ? 'going_to_restaurant' : 'going_to_customer'}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-muted/20 text-center p-6">
              <Bike className="w-14 h-14 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-bold mb-1">No Active Delivery Routes</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                Drivers assigned to your active orders will automatically appear on this live GPS map with live routing.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Active Deliveries List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" /> Active Order Deliveries ({activeOrders.length})
          </h2>
          <span className="text-xs text-muted-foreground">Select an order to view route</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeOrders.map((order) => {
            const driverLoc = driverLocations.get(order.deliveryPersonId || '');
            const stage = (order.delivery?.stage || (order.deliveryStatus === 'going_to_restaurant' ? 'TO_PICKUP' : 'TO_CUSTOMER')) as DeliveryStage;
            const stageColor = getStageColor(stage);
            const isSelected = selectedDriverId === order.deliveryPersonId;
            const isArrived = stage === 'ARRIVED_PICKUP';

            return (
              <Card
                key={order.id}
                className={`cursor-pointer transition-all duration-200 hover:border-primary/50 shadow-xs ${
                  isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border/60'
                } ${isArrived ? 'border-amber-500/50 bg-amber-500/5' : ''}`}
                onClick={() => setSelectedDriverId(order.deliveryPersonId || null)}
              >
                <CardContent className="p-4 space-y-3.5">
                  {/* Top Bar: Driver Avatar, Name & Stage Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-xs ${
                          isArrived ? 'bg-amber-500/20 border-amber-500/40 text-amber-500' : 'bg-primary/10 border-primary/20 text-primary'
                        }`}>
                          <Bike className="w-5 h-5" />
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                          driverLoc?.isOnline ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                      </div>
                      <div>
                        <p className="font-bold text-sm leading-tight text-foreground">{order.deliveryPersonName || 'Driver'}</p>
                        <p className="text-muted-foreground text-xs">{order.deliveryVehicle || 'Delivery Partner'}</p>
                      </div>
                    </div>

                    <Badge className={`border text-[10px] font-bold uppercase tracking-wider ${stageColor.bg} ${stageColor.text} ${stageColor.border}`}>
                      {getStageLabel(stage)}
                    </Badge>
                  </div>

                  {/* Arrived Notification Banner inside Card */}
                  {isArrived && (
                    <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-2.5 flex items-center gap-2 animate-pulse">
                      <ShoppingBag className="w-4 h-4 text-amber-500 shrink-0" />
                      <p className="text-xs font-bold text-amber-500 leading-tight">
                        Driver waiting at counter! Hand over order.
                      </p>
                    </div>
                  )}

                  {/* Telemetry Stats */}
                  {driverLoc?.isOnline ? (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-muted/60 rounded-xl p-2 text-center border border-border/40">
                        <p className="text-xs font-bold text-foreground">{driverLoc.speed} km/h</p>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Speed</p>
                      </div>
                      <div className="bg-muted/60 rounded-xl p-2 text-center border border-border/40">
                        <p className="text-xs font-bold text-foreground">±{driverLoc.accuracy}m</p>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Accuracy</p>
                      </div>
                      <div className="bg-muted/60 rounded-xl p-2 text-center border border-border/40">
                        <p className="text-xs font-bold text-foreground font-mono">#{formatOrderId(order.id)}</p>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Order</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-muted/30 rounded-xl p-2 text-center border border-border/30">
                      <p className="text-xs text-muted-foreground font-mono font-bold">Order #{formatOrderId(order.id)}</p>
                    </div>
                  )}

                  {/* Order & Customer Summary */}
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40">
                    <span className="text-muted-foreground truncate max-w-[160px] font-medium">
                      To: {order.customerName}
                    </span>
                    <span className="font-black text-foreground">₹{order.total?.toFixed(0)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    {order.deliveryPersonPhone && (
                      <a href={`tel:${order.deliveryPersonPhone}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs font-semibold rounded-xl">
                          <Phone className="w-3.5 h-3.5 text-emerald-500" /> Call Rider
                        </Button>
                      </a>
                    )}
                    <Button
                      variant={isSelected ? 'default' : 'secondary'}
                      size="sm"
                      className="gap-1 text-xs font-semibold rounded-xl"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDriverId(order.deliveryPersonId || null);
                      }}
                    >
                      <Navigation className="w-3 h-3" /> {isSelected ? 'Viewing' : 'View'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {activeOrders.length === 0 && (
        <Card className="p-12 text-center border-dashed border-border/70">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="text-lg font-bold mb-2">No Active Deliveries</h3>
          <p className="text-muted-foreground text-sm mb-4 max-w-sm mx-auto">
            When delivery partners accept orders from your restaurant, they will appear here with live GPS tracking and stage updates.
          </p>
          <Button variant="outline" onClick={() => router.push('/restaurant/orders')} className="rounded-xl">
            Back to Orders
          </Button>
        </Card>
      )}
    </div>
  );
}
