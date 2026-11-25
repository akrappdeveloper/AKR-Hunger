'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Order,
  DeliveryStage,
  getStageLabel,
  getStageColor,
  getRouteDestination,
  formatOrderId,
} from '@/lib/types';
import { getDeterministicChatId } from '@/lib/chat-service';
import LiveTrackingMap, { MapMarker } from '@/components/tracking/LiveTrackingMap';
import DriverInfoPanel from '@/components/tracking/DriverInfoPanel';
import { ItemCustomizationBadges } from '@/components/orders/ItemCustomizationBadges';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Bike,
  MapPin,
  Clock,
  ShoppingBag,
  Navigation,
  Phone,
  Package,
  ChefHat,
  CheckCircle2,
  ExternalLink,
  Search,
  MessageSquare,
  Crosshair,
  Utensils,
  KeyRound,
  Sparkles,
  User,
  Loader2,
  Timer,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface DriverLocationInfo {
  driverId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
  isOnline: boolean;
  updatedAt?: Date | null;
}

interface RouteMetrics {
  distance: string;
  eta: string;
  distanceMeters: number;
  durationSeconds: number;
}

function toSafeDate(val: any): Date {
  if (!val) return new Date(0);
  if (typeof val?.toDate === 'function') return val.toDate();
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000);
  const parsed = new Date(val);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function getOrderCustomerCoords(order?: Order | null): { latitude: number; longitude: number } | null {
  if (!order) return null;
  const addr = order.deliveryAddress as any;
  const lat = Number(addr?.latitude ?? (order as any).deliveryLatitude ?? (order as any).customerLat ?? 0);
  const lng = Number(addr?.longitude ?? (order as any).deliveryLongitude ?? (order as any).customerLon ?? 0);
  if (lat !== 0 && lng !== 0 && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    return { latitude: lat, longitude: lng };
  }
  return null;
}

function getOrderAddressText(order?: Order | null): string {
  if (!order) return 'Address not available';
  if (typeof order.deliveryAddress === 'string') return order.deliveryAddress;
  const addr = order.deliveryAddress as any;
  if (!addr) return 'Address not specified';
  return (
    addr.fullAddress ||
    addr.formattedAddress ||
    [addr.flatNo, addr.street, addr.landmark, addr.city, addr.state, addr.pincode]
      .filter(Boolean)
      .join(', ') ||
    'Address not specified'
  );
}

function resolveStage(order?: Order | null): DeliveryStage {
  if (!order) return 'TO_PICKUP';
  if (order.delivery?.stage) return order.delivery.stage;
  if (order.deliveryStatus === 'going_to_restaurant') return 'TO_PICKUP';
  if (order.deliveryStatus === 'picked_up') return 'PICKED_UP';
  if (order.deliveryStatus === 'going_to_customer' || order.status === 'out_for_delivery') {
    return 'TO_CUSTOMER';
  }
  return 'TO_PICKUP';
}

export default function RestaurantLiveTrackingPage() {
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();

  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [driverLocations, setDriverLocations] = useState<Map<string, DriverLocationInfo>>(new Map());
  const [driverProfiles, setDriverProfiles] = useState<Map<string, any>>(new Map());
  const [routeInfo, setRouteInfo] = useState<RouteMetrics | null>(null);
  const [followDriver, setFollowDriver] = useState(false);
  const [stageFilter, setStageFilter] = useState<'all' | 'kitchen' | 'assigned' | 'arrived' | 'out'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/restaurant/login');
    }
  }, [user, authLoading, router]);

  // Listen to ALL active orders across restaurant IDs without composite index failure risk
  useEffect(() => {
    if (authLoading || !user) return;

    const targetIds = Array.from(
      new Set([user.uid, (user as any)?.restaurantId, restaurant?.id].filter(Boolean))
    ) as string[];

    if (targetIds.length === 0) {
      setLoading(false);
      return;
    }

    const ordersByBucket = new Map<string, Order[]>();

    const recomputeOrders = () => {
      const merged = new Map<string, Order>();
      ordersByBucket.forEach((list) => {
        list.forEach((o) => {
          if (o.id) merged.set(o.id, o);
        });
      });

      const active = Array.from(merged.values())
        .filter((o) => !['delivered', 'cancelled', 'returned_to_restaurant'].includes(o.status || ''))
        .sort((a, b) => toSafeDate(b.createdAt).getTime() - toSafeDate(a.createdAt).getTime());

      setActiveOrders(active);
      setSelectedOrderId((prev) => {
        if (prev && active.some((o) => o.id === prev)) return prev;
        const prioritized =
          active.find((o) => o.delivery?.stage === 'ARRIVED_PICKUP') ||
          active.find((o) => Boolean(o.deliveryPersonId)) ||
          active[0];
        return prioritized?.id || null;
      });
      setLoading(false);
    };

    const unsubscribers = targetIds.map((tid) => {
      const q = query(collection(db, 'orders'), where('restaurantId', '==', tid));
      return onSnapshot(
        q,
        (snapshot) => {
          const list = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Order));
          ordersByBucket.set(tid, list);
          recomputeOrders();
        },
        (err) => {
          console.warn('[RestaurantTracking] Listener notice:', tid, err.message);
          ordersByBucket.set(tid, []);
          recomputeOrders();
        }
      );
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [user, restaurant?.id, authLoading]);

  // Track all unique driver IDs from active orders
  const driverIds = useMemo(() => {
    const ids = new Set<string>();
    activeOrders.forEach((o) => {
      if (o.deliveryPersonId) ids.add(o.deliveryPersonId);
    });
    return Array.from(ids);
  }, [activeOrders]);

  // Subscribe to driverLocations & deliveryPersons fallback
  useEffect(() => {
    if (driverIds.length === 0) {
      setDriverLocations(new Map());
      setDriverProfiles(new Map());
      return;
    }

    const unsubscribers: (() => void)[] = [];

    driverIds.forEach((driverId) => {
      const unsubLoc = onSnapshot(
        doc(db, 'driverLocations', driverId),
        (docSnap: any) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.latitude && data.longitude) {
              setDriverLocations((prev) => {
                const next = new Map(prev);
                next.set(driverId, {
                  driverId,
                  latitude: Number(data.latitude),
                  longitude: Number(data.longitude),
                  speed: Number(data.speed || 0),
                  heading: Number(data.heading || 0),
                  accuracy: Number(data.accuracy || 0),
                  isOnline: data.isOnline !== false,
                  updatedAt: data.updatedAt ? toSafeDate(data.updatedAt) : null,
                });
                return next;
              });
            }
          }
        },
        () => {}
      );
      unsubscribers.push(unsubLoc);

      const unsubProfile = onSnapshot(
        doc(db, 'deliveryPersons', driverId),
        (docSnap: any) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setDriverProfiles((prev) => {
              const next = new Map(prev);
              next.set(driverId, data);
              return next;
            });
            const loc = data?.currentLocation;
            if (loc?.latitude && loc?.longitude) {
              setDriverLocations((prev) => {
                if (prev.has(driverId)) return prev;
                const next = new Map(prev);
                next.set(driverId, {
                  driverId,
                  latitude: Number(loc.latitude),
                  longitude: Number(loc.longitude),
                  speed: 0,
                  heading: 0,
                  accuracy: 15,
                  isOnline: data.status !== 'offline',
                  updatedAt: null,
                });
                return next;
              });
            }
          }
        },
        () => {}
      );
      unsubscribers.push(unsubProfile);
    });

    return () => {
      unsubscribers.forEach((u) => u());
    };
  }, [driverIds]);

  const arrivedOrders = useMemo(
    () => activeOrders.filter((o) => resolveStage(o) === 'ARRIVED_PICKUP' && o.deliveryPersonId),
    [activeOrders]
  );

  const metrics = useMemo(() => {
    const kitchenCount = activeOrders.filter((o) =>
      ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status || '') && !o.deliveryPersonId
    ).length;
    const assignedCount = activeOrders.filter((o) => Boolean(o.deliveryPersonId)).length;
    const arrivedCount = arrivedOrders.length;
    const outCount = activeOrders.filter(
      (o) =>
        o.status === 'out_for_delivery' ||
        ['PICKED_UP', 'TO_CUSTOMER', 'ARRIVED_CUSTOMER'].includes(resolveStage(o))
    ).length;
    return {
      total: activeOrders.length,
      kitchenCount,
      assignedCount,
      arrivedCount,
      outCount,
    };
  }, [activeOrders, arrivedOrders.length]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeOrders.filter((o) => {
      const stage = resolveStage(o);
      const matchesTab =
        stageFilter === 'all' ||
        (stageFilter === 'kitchen' &&
          ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status || '')) ||
        (stageFilter === 'assigned' && Boolean(o.deliveryPersonId)) ||
        (stageFilter === 'arrived' && Boolean(o.deliveryPersonId) && stage === 'ARRIVED_PICKUP') ||
        (stageFilter === 'out' &&
          (o.status === 'out_for_delivery' ||
            ['PICKED_UP', 'TO_CUSTOMER', 'ARRIVED_CUSTOMER'].includes(stage)));

      if (!matchesTab) return false;
      if (!q) return true;

      const orderIdStr = `${o.id || ''} ${o.orderNumber || ''}`.toLowerCase();
      const custName = String(o.customerName || '').toLowerCase();
      const driverName = String(o.deliveryPersonName || '').toLowerCase();
      const dishes = (o.items || []).map((i) => i.name || '').join(' ').toLowerCase();
      return (
        orderIdStr.includes(q) ||
        custName.includes(q) ||
        driverName.includes(q) ||
        dishes.includes(q)
      );
    });
  }, [activeOrders, stageFilter, searchQuery]);

  const selectedOrder =
    activeOrders.find((o) => o.id === selectedOrderId) || filteredOrders[0] || activeOrders[0] || null;

  const selectedDriverId = selectedOrder?.deliveryPersonId || null;
  const selectedDriverLoc = selectedDriverId ? driverLocations.get(selectedDriverId) || null : null;
  const selectedDriverProfile = selectedDriverId ? driverProfiles.get(selectedDriverId) : null;

  useEffect(() => {
    setRouteInfo(null);
  }, [selectedOrder?.id]);

  const restPos = useMemo(() => {
    const lat = Number(restaurant?.latitude ?? selectedOrder?.restaurantLocation?.lat ?? 0);
    const lng = Number(restaurant?.longitude ?? selectedOrder?.restaurantLocation?.lng ?? 0);
    return lat !== 0 && lng !== 0 ? { latitude: lat, longitude: lng } : null;
  }, [restaurant?.latitude, restaurant?.longitude, selectedOrder?.restaurantLocation]);

  const custPos = useMemo(() => getOrderCustomerCoords(selectedOrder), [selectedOrder]);

  const driverPos = useMemo(() => {
    if (selectedDriverLoc?.latitude && selectedDriverLoc?.longitude) {
      return {
        latitude: selectedDriverLoc.latitude,
        longitude: selectedDriverLoc.longitude,
      };
    }
    return null;
  }, [selectedDriverLoc]);

  const currentStage = resolveStage(selectedOrder);
  const currentRouteDest = getRouteDestination(currentStage) || 'restaurant';

  const mapMarkers = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = [];

    if (restPos) {
      markers.push({
        id: 'restaurant',
        latitude: restPos.latitude,
        longitude: restPos.longitude,
        type: 'restaurant',
        label: restaurant?.name || 'Kitchen',
        popup: `<strong>${restaurant?.name || 'Your Kitchen'}</strong><br/>Pickup Counter`,
      });
    }

    if (selectedOrder && custPos) {
      markers.push({
        id: 'customer',
        latitude: custPos.latitude,
        longitude: custPos.longitude,
        type: 'customer',
        label: selectedOrder.customerName || 'Customer',
        popup: `<strong>${selectedOrder.customerName || 'Customer'}</strong><br/>${getOrderAddressText(selectedOrder)}`,
      });
    }

    driverLocations.forEach((loc, driverId) => {
      if (!loc.latitude || !loc.longitude) return;
      const orderForDriver = activeOrders.find((o) => o.deliveryPersonId === driverId);
      const profile = driverProfiles.get(driverId);
      const driverName = orderForDriver?.deliveryPersonName || profile?.name || 'Delivery Partner';
      const stage = resolveStage(orderForDriver);
      markers.push({
        id: `driver-${driverId}`,
        latitude: loc.latitude,
        longitude: loc.longitude,
        type: 'driver',
        heading: loc.heading,
        label: driverName,
        popup: `<strong>${driverName}</strong><br/>Stage: ${getStageLabel(stage)}<br/>Speed: ${Math.round(loc.speed)} km/h<br/>Order: #${formatOrderId(orderForDriver?.id)}`,
      });
    });

    return markers;
  }, [restPos, custPos, restaurant?.name, selectedOrder, driverLocations, activeOrders, driverProfiles]);

  const handleQuickStatusUpdate = async (order: Order, nextStatus: Order['status']) => {
    if (!order.id || !nextStatus) return;
    setUpdatingOrderId(order.id);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });

      fetch('/api/notifications/order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, status: nextStatus }),
      }).catch(() => {});

      toast.success(`Order #${formatOrderId(order.id)} updated to "${nextStatus.replace(/_/g, ' ')}"`);
    } catch (err: any) {
      toast.error('Failed to update status: ' + (err?.message || 'Unknown error'));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-[65vh]">
        <div className="text-center space-y-3">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm font-medium">
            Connecting to live kitchen &amp; rider GPS radar...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-3xl bg-gradient-to-br from-primary/10 via-card to-blue-500/5 border border-border/80 p-5 sm:p-6 shadow-sm">
        <div className="flex items-start sm:items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/restaurant/orders')}
            className="rounded-2xl shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold text-[11px] rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping mr-1.5" />
                Live GPS Sync
              </Badge>
              <span className="text-xs font-semibold text-muted-foreground">
                {driverIds.length} Active {driverIds.length === 1 ? 'Rider' : 'Riders'} Tracked
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5 text-foreground">
              <ChefHat className="w-7 h-7 text-primary" /> Live Order &amp; Driver Tracking
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              Real-time kitchen prep, rider GPS routes, ETAs, and instant order handoff controls
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order, rider, dish..."
              className="pl-9 h-10 rounded-xl bg-background/90 border-border text-sm"
            />
          </div>
          <Button
            variant={followDriver ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFollowDriver((f) => !f)}
            disabled={!driverPos}
            className="h-10 rounded-xl font-bold gap-1.5 cursor-pointer"
          >
            <Crosshair className="w-4 h-4" />
            {followDriver ? 'Following Rider' : 'Follow Rider'}
          </Button>
        </div>
      </div>

      {/* Live KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 rounded-2xl border-border/70 bg-card shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Active Orders
          </p>
          <p className="text-2xl sm:text-3xl font-black text-foreground mt-1">{metrics.total}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">In kitchen or delivery</p>
        </Card>

        <Card className="p-4 rounded-2xl border-border/70 bg-card shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Kitchen / Awaiting Rider
          </p>
          <p className="text-2xl sm:text-3xl font-black text-orange-500 mt-1">{metrics.kitchenCount}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Pending / Prep / Ready</p>
        </Card>

        <Card
          className={`p-4 rounded-2xl shadow-xs cursor-pointer transition ${
            metrics.arrivedCount > 0
              ? 'border-amber-500/50 bg-amber-500/10'
              : 'border-border/70 bg-card'
          }`}
          onClick={() => setStageFilter((prev) => (prev === 'arrived' ? 'all' : 'arrived'))}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Riders at Counter
          </p>
          <p className="text-2xl sm:text-3xl font-black text-amber-500 mt-1">{metrics.arrivedCount}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Ready for meal handoff</p>
        </Card>

        <Card
          className="p-4 rounded-2xl border-border/70 bg-card shadow-xs cursor-pointer hover:border-primary/40 transition"
          onClick={() => setStageFilter((prev) => (prev === 'out' ? 'all' : 'out'))}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-500">
            Out for Delivery
          </p>
          <p className="text-2xl sm:text-3xl font-black text-blue-500 mt-1">{metrics.outCount}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">En route to customer</p>
        </Card>
      </div>

      {/* Driver Arrived Urgent Alert Banner */}
      <AnimatePresence>
        {arrivedOrders.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/20 border-2 border-amber-500/40 rounded-3xl p-4 sm:p-5 shadow-lg shadow-amber-500/10"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 animate-bounce">
                  <ShoppingBag className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    🛵 Rider Arrived at Kitchen Counter!
                    <Badge className="bg-amber-500 text-black font-black text-[10px] uppercase">
                      Action Required
                    </Badge>
                  </h3>
                  <p className="text-xs sm:text-sm text-foreground/80 mt-0.5">
                    {arrivedOrders
                      .map((o) => `${o.deliveryPersonName || 'Rider'} (Order #${formatOrderId(o.id)})`)
                      .join(', ')}{' '}
                    is waiting at pickup counter. Hand over the packed meal.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedOrderId(arrivedOrders[0].id || null)}
                  className="rounded-xl font-bold border-amber-500/40 bg-background/80 cursor-pointer"
                >
                  Inspect Order
                </Button>
                {arrivedOrders[0]?.deliveryPersonPhone && (
                  <a href={`tel:${arrivedOrders[0].deliveryPersonPhone}`}>
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" /> Call Rider
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main 2-Column Operations Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Interactive Map + Selected Order Live Inspector */}
        <div className="xl:col-span-7 space-y-6">
          {/* Map Card */}
          <Card className="overflow-hidden border-border/70 shadow-lg rounded-3xl relative">
            <div className="h-[46vh] min-h-[380px] w-full relative">
              {mapMarkers.length > 0 ? (
                <>
                  <LiveTrackingMap
                    markers={mapMarkers}
                    showRoute={Boolean(selectedOrder && driverPos)}
                    driverPosition={driverPos}
                    restaurantPosition={restPos}
                    customerPosition={custPos}
                    routeDestination={currentRouteDest}
                    followDriver={followDriver}
                    onRouteInfo={setRouteInfo}
                    height="100%"
                    onMarkerClick={(id) => {
                      if (id.startsWith('driver-')) {
                        const dId = id.replace('driver-', '');
                        const match = activeOrders.find((o) => o.deliveryPersonId === dId);
                        if (match?.id) setSelectedOrderId(match.id);
                      }
                    }}
                  />

                  {/* Floating Driver Info Overlay */}
                  {selectedOrder && selectedDriverLoc && (
                    <div className="absolute top-3 right-3 z-10 w-68 sm:w-80 pointer-events-auto">
                      <DriverInfoPanel
                        driverName={
                          selectedOrder.deliveryPersonName ||
                          selectedDriverProfile?.name ||
                          'Delivery Partner'
                        }
                        driverPhone={
                          selectedOrder.deliveryPersonPhone || selectedDriverProfile?.phone
                        }
                        driverVehicle={
                          selectedOrder.deliveryVehicle || selectedDriverProfile?.vehicle
                        }
                        speed={selectedDriverLoc.speed}
                        heading={selectedDriverLoc.heading}
                        accuracy={selectedDriverLoc.accuracy}
                        isOnline={selectedDriverLoc.isOnline}
                        distance={routeInfo?.distance}
                        eta={routeInfo?.eta}
                        phase={
                          currentStage === 'TO_PICKUP' || currentStage === 'ARRIVED_PICKUP'
                            ? 'going_to_restaurant'
                            : 'going_to_customer'
                        }
                      />
                    </div>
                  )}

                  {/* Selected Order Map Bottom Pill */}
                  {selectedOrder && (
                    <div className="absolute bottom-3 left-3 z-10 bg-black/75 backdrop-blur-xl text-white px-3.5 py-2 rounded-2xl border border-white/15 flex items-center gap-3 text-xs shadow-xl">
                      <span className="font-mono font-bold text-primary">
                        #{formatOrderId(selectedOrder.id)}
                      </span>
                      <span className="text-white/70">•</span>
                      <span className="font-semibold truncate max-w-[160px]">
                        {selectedOrder.deliveryPersonId
                          ? getStageLabel(currentStage)
                          : 'Awaiting Rider Assignment'}
                      </span>
                      {routeInfo?.eta && (
                        <>
                          <span className="text-white/70">•</span>
                          <span className="text-emerald-400 font-bold">
                            ETA {routeInfo.eta} ({routeInfo.distance})
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center bg-muted/20 text-center p-6">
                  <Bike className="w-14 h-14 text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-bold mb-1">No Live GPS Coordinates Yet</h3>
                  <p className="text-muted-foreground text-sm max-w-sm">
                    Once your restaurant coordinates or an assigned rider&apos;s GPS ping is available, live routing will appear here.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Selected Order Live Control & Details Inspector */}
          {selectedOrder && (
            <Card className="rounded-3xl border-border/70 bg-card shadow-sm p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-border/60">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-black font-mono text-foreground">
                      Order #{formatOrderId(selectedOrder.id)}
                    </h3>
                    <Badge className="capitalize font-bold bg-primary/15 text-primary border border-primary/30">
                      {(selectedOrder.status || 'pending').replace(/_/g, ' ')}
                    </Badge>
                    {selectedOrder.deliveryPersonId && (
                      <Badge
                        className={`border text-[10px] font-bold uppercase ${getStageColor(currentStage).bg} ${getStageColor(currentStage).text} ${getStageColor(currentStage).border}`}
                      >
                        {getStageLabel(currentStage)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    Placed at{' '}
                    {toSafeDate(selectedOrder.createdAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    <span>•</span>
                    <span className="uppercase font-bold text-foreground">
                      {selectedOrder.paymentMethod || 'Online'}
                    </span>
                    <span>•</span>
                    <span className="font-black text-primary">
                      ₹{Number(selectedOrder.total || 0).toFixed(2)}
                    </span>
                  </p>
                </div>

                <Link href={`/restaurant/orders/${selectedOrder.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl font-bold text-xs gap-1.5 cursor-pointer"
                  >
                    Full Order &amp; Bill <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>

              {/* 4-Step Live Progress Bar */}
              <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                {[
                  { key: 'confirmed', label: 'Confirmed', active: ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(selectedOrder.status || '') },
                  { key: 'preparing', label: 'Preparing', active: ['preparing', 'ready', 'out_for_delivery'].includes(selectedOrder.status || '') },
                  { key: 'ready', label: 'Ready', active: ['ready', 'out_for_delivery'].includes(selectedOrder.status || '') },
                  { key: 'out_for_delivery', label: 'On the Way', active: selectedOrder.status === 'out_for_delivery' },
                ].map((step) => (
                  <div
                    key={step.key}
                    className={`p-2 rounded-xl border font-bold transition ${
                      step.active
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-muted/40 border-border/50 text-muted-foreground'
                    }`}
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 mx-auto mb-1 ${step.active ? 'text-emerald-500' : 'opacity-40'}`} />
                    {step.label}
                  </div>
                ))}
              </div>

              {/* Quick Kitchen Status Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {selectedOrder.status === 'pending' && (
                  <Button
                    size="sm"
                    disabled={updatingOrderId === selectedOrder.id}
                    onClick={() => handleQuickStatusUpdate(selectedOrder, 'confirmed')}
                    className="rounded-xl font-bold bg-primary text-primary-foreground gap-1.5 cursor-pointer"
                  >
                    {updatingOrderId === selectedOrder.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Confirm Order
                  </Button>
                )}
                {selectedOrder.status === 'confirmed' && (
                  <Button
                    size="sm"
                    disabled={updatingOrderId === selectedOrder.id}
                    onClick={() => handleQuickStatusUpdate(selectedOrder, 'preparing')}
                    className="rounded-xl font-bold bg-orange-500 hover:bg-orange-600 text-white gap-1.5 cursor-pointer"
                  >
                    {updatingOrderId === selectedOrder.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChefHat className="w-3.5 h-3.5" />}
                    Start Preparing
                  </Button>
                )}
                {selectedOrder.status === 'preparing' && (
                  <Button
                    size="sm"
                    disabled={updatingOrderId === selectedOrder.id}
                    onClick={() => handleQuickStatusUpdate(selectedOrder, 'ready')}
                    className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer"
                  >
                    {updatingOrderId === selectedOrder.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                    Mark Ready for Pickup
                  </Button>
                )}
                {selectedOrder.status === 'ready' && (
                  <Button
                    size="sm"
                    disabled={updatingOrderId === selectedOrder.id}
                    onClick={() => handleQuickStatusUpdate(selectedOrder, 'out_for_delivery')}
                    className="rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1.5 cursor-pointer"
                  >
                    {updatingOrderId === selectedOrder.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bike className="w-3.5 h-3.5" />}
                    Handed Over (Out for Delivery)
                  </Button>
                )}

                {selectedOrder.deliveryOtp && (
                  <div className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/25 text-xs font-bold text-primary">
                    <KeyRound className="w-3.5 h-3.5" />
                    Delivery OTP: <span className="font-mono font-black tracking-wider">{selectedOrder.deliveryOtp}</span>
                  </div>
                )}
              </div>

              {/* Customer & Rider Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-primary" /> Customer
                    </span>
                    <div className="flex items-center gap-1.5">
                      {selectedOrder.customerPhone && (
                        <a href={`tel:${selectedOrder.customerPhone}`}>
                          <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px] font-bold rounded-lg gap-1 cursor-pointer">
                            <Phone className="w-3 h-3 text-emerald-500" /> Call
                          </Button>
                        </a>
                      )}
                      {selectedOrder.id && (
                        <Link href={`/restaurant/chat/${getDeterministicChatId(selectedOrder.id, 'customer_restaurant')}`}>
                          <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px] font-bold rounded-lg gap-1 cursor-pointer">
                            <MessageSquare className="w-3 h-3 text-primary" /> Chat
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                  <p className="font-bold text-sm text-foreground">
                    {selectedOrder.customerName || 'Diner Customer'}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5 leading-relaxed">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{getOrderAddressText(selectedOrder)}</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Bike className="w-3.5 h-3.5 text-blue-500" /> Delivery Partner
                    </span>
                    {selectedOrder.deliveryPersonId && (
                      <div className="flex items-center gap-1.5">
                        {(selectedOrder.deliveryPersonPhone || selectedDriverProfile?.phone) && (
                          <a href={`tel:${selectedOrder.deliveryPersonPhone || selectedDriverProfile?.phone}`}>
                            <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px] font-bold rounded-lg gap-1 cursor-pointer">
                              <Phone className="w-3 h-3 text-emerald-500" /> Call
                            </Button>
                          </a>
                        )}
                        {selectedOrder.id && (
                          <Link href={`/restaurant/chat/${getDeterministicChatId(selectedOrder.id, 'restaurant_delivery')}`}>
                            <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px] font-bold rounded-lg gap-1 cursor-pointer">
                              <MessageSquare className="w-3 h-3 text-blue-500" /> Chat
                            </Button>
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                  {selectedOrder.deliveryPersonId ? (
                    <>
                      <p className="font-bold text-sm text-foreground">
                        {selectedOrder.deliveryPersonName || selectedDriverProfile?.name || 'Assigned Rider'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedOrder.deliveryVehicle || selectedDriverProfile?.vehicle || 'Two-Wheeler'}
                        {selectedDriverLoc && (
                          <span className="ml-2 font-mono text-foreground">
                            • {Math.round(selectedDriverLoc.speed)} km/h
                          </span>
                        )}
                        {routeInfo?.eta && (
                          <span className="ml-2 font-bold text-emerald-600 dark:text-emerald-400">
                            • ETA {routeInfo.eta}
                          </span>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold py-1">
                      Waiting for a delivery partner to accept this order...
                    </p>
                  )}
                </div>
              </div>

              {/* Ordered Dishes + Customizations */}
              <div className="space-y-2.5 pt-2 border-t border-border/60">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-primary" />
                  Ordered Dishes ({selectedOrder.items?.length || 0})
                </h4>
                <div className="divide-y divide-border/50 rounded-2xl border border-border/60 bg-muted/20 px-3.5">
                  {(selectedOrder.items || []).map((item: any, idx: number) => (
                    <div key={idx} className="py-2.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-foreground">
                          {item.quantity}× {item.name}
                        </p>
                        <ItemCustomizationBadges item={item} compact />
                      </div>
                      <span className="text-xs sm:text-sm font-mono font-bold text-foreground shrink-0">
                        ₹{(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                {selectedOrder.specialInstructions && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                    <strong className="text-amber-600 dark:text-amber-400">Kitchen Note: </strong>
                    <span className="text-foreground">{selectedOrder.specialInstructions}</span>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right 5 Cols: Filterable Active Orders Queue */}
        <div className="xl:col-span-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" /> Live Queue ({filteredOrders.length})
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'kitchen', label: 'Kitchen' },
                { id: 'assigned', label: 'Rider Assigned' },
                { id: 'arrived', label: 'At Counter' },
                { id: 'out', label: 'En Route' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStageFilter(tab.id as any)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                    stageFilter === tab.id
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 max-h-[82vh] overflow-y-auto pr-1">
            {filteredOrders.map((order) => {
              const driverLoc = order.deliveryPersonId
                ? driverLocations.get(order.deliveryPersonId)
                : null;
              const stage = resolveStage(order);
              const stageColor = getStageColor(stage);
              const isSelected = selectedOrder?.id === order.id;
              const isArrived = Boolean(order.deliveryPersonId) && stage === 'ARRIVED_PICKUP';

              return (
                <Card
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id || null)}
                  className={`cursor-pointer rounded-2xl transition-all duration-200 hover:border-primary/50 shadow-xs ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                      : 'border-border/70 bg-card'
                  } ${isArrived ? 'border-amber-500/60 bg-amber-500/5' : ''}`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                              isArrived
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-500'
                                : order.deliveryPersonId
                                ? 'bg-primary/10 border-primary/20 text-primary'
                                : 'bg-muted border-border text-muted-foreground'
                            }`}
                          >
                            {order.deliveryPersonId ? (
                              <Bike className="w-5 h-5" />
                            ) : (
                              <ChefHat className="w-5 h-5" />
                            )}
                          </div>
                          {order.deliveryPersonId && (
                            <div
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                                driverLoc?.isOnline ? 'bg-emerald-500' : 'bg-zinc-400'
                              }`}
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-foreground truncate">
                            #{formatOrderId(order.id)} • {order.customerName || 'Customer'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {order.deliveryPersonId
                              ? `${order.deliveryPersonName || 'Rider'} (${order.deliveryVehicle || 'Partner'})`
                              : 'Awaiting Rider Assignment'}
                          </p>
                        </div>
                      </div>

                      <Badge
                        className={`border text-[10px] font-bold uppercase shrink-0 ${
                          order.deliveryPersonId
                            ? `${stageColor.bg} ${stageColor.text} ${stageColor.border}`
                            : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25'
                        }`}
                      >
                        {order.deliveryPersonId
                          ? getStageLabel(stage)
                          : (order.status || 'pending').replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    {isArrived && (
                      <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl px-3 py-2 flex items-center gap-2 animate-pulse">
                        <ShoppingBag className="w-4 h-4 text-amber-500 shrink-0" />
                        <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                          Rider at counter! Ready for handover.
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
                      <span className="text-muted-foreground truncate max-w-[190px]">
                        {order.items?.length || 0} item{(order.items?.length || 0) === 1 ? '' : 's'}
                        {driverLoc?.isOnline ? ` • ${Math.round(driverLoc.speed)} km/h` : ''}
                      </span>
                      <span className="font-black text-foreground">
                        ₹{Number(order.total || 0).toFixed(0)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {order.deliveryPersonPhone && (
                        <a
                          href={`tel:${order.deliveryPersonPhone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-8 gap-1.5 text-xs font-semibold rounded-xl cursor-pointer"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-500" /> Call Rider
                          </Button>
                        </a>
                      )}
                      <Button
                        variant={isSelected ? 'default' : 'secondary'}
                        size="sm"
                        className="h-8 gap-1 text-xs font-semibold rounded-xl flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrderId(order.id || null);
                        }}
                      >
                        <Navigation className="w-3 h-3" /> {isSelected ? 'Inspecting' : 'Inspect'}
                      </Button>
                      <Link
                        href={`/restaurant/orders/${order.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2.5 text-xs rounded-xl cursor-pointer"
                          title="Open Order Details"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {filteredOrders.length === 0 && (
              <Card className="p-10 text-center border-dashed border-border/70 rounded-3xl">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                <h3 className="text-base font-bold mb-1">
                  {activeOrders.length === 0 ? 'No Active Orders Right Now' : 'No Matching Orders'}
                </h3>
                <p className="text-muted-foreground text-xs mb-4 max-w-xs mx-auto">
                  {activeOrders.length === 0
                    ? 'New incoming orders and assigned delivery partners will appear here automatically in real time.'
                    : 'Try clearing filters or search query to see all active orders.'}
                </p>
                {activeOrders.length === 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/restaurant/orders')}
                    className="rounded-xl font-bold cursor-pointer"
                  >
                    Go to All Orders
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStageFilter('all');
                      setSearchQuery('');
                    }}
                    className="rounded-xl font-bold cursor-pointer"
                  >
                    Reset Filters
                  </Button>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
