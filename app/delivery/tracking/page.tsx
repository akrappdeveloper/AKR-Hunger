'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader } from '@/components/ui/spinner';
import {
  MapPin, Navigation, Compass, ArrowLeft, Bike,
  Gauge, Signal, Clock, Phone, ExternalLink,
  Satellite, ShoppingBag, Package, ChevronDown, ChevronUp
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Order, DeliveryStage, getRouteDestination, getStageLabel, getStageColor, formatOrderId } from '@/lib/types';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import LiveTrackingMap, { MapMarker } from '@/components/tracking/LiveTrackingMap';
import DriverInfoPanel from '@/components/tracking/DriverInfoPanel';
import { motion } from 'framer-motion';

export default function DeliveryTrackingPage() {
  const router = useRouter();
  const { user, deliveryPartner, loading: authLoading } = useDeliveryAuth();
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; eta: string } | null>(null);
  const [showDetails, setShowDetails] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const isOnline = deliveryPartner?.isAvailable || deliveryPartner?.status === 'online';
  const hasActiveDelivery = activeOrders.length > 0;

  // GPS Tracking
  const {
    position,
    isTracking,
    permissionStatus,
    error: gpsError,
    accuracy,
    speedKmh,
    requestPermission,
  } = useDriverLocation({
    driverId: user?.uid || null,
    isOnline: !!isOnline,
    hasActiveDelivery,
    activeOrderId: activeOrders[0]?.id,
  });

  // Listen for active orders
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'orders'),
      where('deliveryPersonId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as Order))
        .filter(o => !['delivered', 'cancelled'].includes(o.status || ''));
      setActiveOrders(orders);
      if (orders.length > 0 && !selectedOrderId) {
        setSelectedOrderId(orders[0].id || null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/delivery/login');
    }
  }, [user, authLoading, router]);

  const selectedOrder = activeOrders.find(o => o.id === selectedOrderId) || activeOrders[0];

  // Build map markers
  const mapMarkers = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = [];

    // Driver position
    if (position) {
      markers.push({
        id: 'driver',
        latitude: position.latitude,
        longitude: position.longitude,
        type: 'driver',
        heading: position.heading,
        label: 'You',
        popup: `<strong>Your Location</strong><br/>Speed: ${speedKmh} km/h<br/>Accuracy: ${accuracy}m`,
      });
    }

    // Restaurant and customer for selected order
    if (selectedOrder) {
      // Restaurant location (use stored coordinates or fallback)
      if (selectedOrder.restaurantLocation) {
        markers.push({
          id: 'restaurant',
          latitude: selectedOrder.restaurantLocation.lat,
          longitude: selectedOrder.restaurantLocation.lng,
          type: 'restaurant',
          label: selectedOrder.restaurantName,
          popup: `<strong>${selectedOrder.restaurantName}</strong><br/>${selectedOrder.restaurantAddress || 'Restaurant'}`,
        });
      }

      // Customer location
      const deliveryAddr = selectedOrder.deliveryAddress;
      if (deliveryAddr && typeof deliveryAddr !== 'string' && deliveryAddr.latitude && deliveryAddr.longitude) {
        markers.push({
          id: 'customer',
          latitude: deliveryAddr.latitude,
          longitude: deliveryAddr.longitude,
          type: 'customer',
          label: selectedOrder.customerName,
          popup: `<strong>${selectedOrder.customerName}</strong><br/>${deliveryAddr.street || 'Customer'}`,
        });
      }
    }

    return markers;
  }, [position, selectedOrder, speedKmh, accuracy]);

  const driverPos = position ? { latitude: position.latitude, longitude: position.longitude } : null;
  const restaurantPos = selectedOrder?.restaurantLocation
    ? { latitude: selectedOrder.restaurantLocation.lat, longitude: selectedOrder.restaurantLocation.lng }
    : null;
  const customerPos = (() => {
    const addr = selectedOrder?.deliveryAddress;
    if (addr && typeof addr !== 'string' && addr.latitude && addr.longitude) {
      return { latitude: addr.latitude, longitude: addr.longitude };
    }
    return null;
  })();

  const formatAddress = (addr: any): string => {
    if (typeof addr === 'string') return addr;
    if (addr && typeof addr === 'object') {
      return `${addr.street || ''}, ${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}`.trim();
    }
    return 'Address not available';
  };

  const openMaps = (lat?: number, lng?: number, address?: string) => {
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    } else if (address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    }
  };

  const getSignalLabel = () => {
    if (!accuracy) return { label: 'No GPS', color: 'text-gray-500' };
    if (accuracy <= 5) return { label: 'Excellent', color: 'text-green-400' };
    if (accuracy <= 15) return { label: 'Good', color: 'text-green-400' };
    if (accuracy <= 30) return { label: 'Fair', color: 'text-yellow-400' };
    return { label: 'Weak', color: 'text-red-400' };
  };

  if (authLoading || (user && loading)) {
    return (
      <div className="flex items-center justify-center h-screen bg-transparent text-white">
        <Loader />
      </div>
    );
  }

  const signal = getSignalLabel();

  return (
    <div className="h-screen flex flex-col relative bg-black">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.push('/delivery')}
          className="bg-black/60 backdrop-blur-xl border border-white/10 text-white rounded-full h-10 w-10 p-0 hover:bg-black/80"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-2">
          {/* GPS Status */}
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-full px-3 py-2 flex items-center gap-2">
            {isTracking ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-bold text-green-400">GPS Active</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs font-bold text-red-400">GPS Off</span>
              </>
            )}
          </div>

          {/* Signal Strength */}
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-full px-3 py-2 flex items-center gap-2">
            <Signal className={`w-3.5 h-3.5 ${signal.color}`} />
            <span className={`text-xs font-bold ${signal.color}`}>{signal.label}</span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {permissionStatus === 'denied' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-10">
            <Satellite className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">GPS Permission Required</h2>
            <p className="text-gray-400 text-sm text-center max-w-sm mb-6">
              Enable location access to see your position on the map and share live location with customers.
            </p>
            <Button onClick={requestPermission} className="bg-blue-600 hover:bg-blue-700">
              Enable GPS
            </Button>
          </div>
        ) : (
          <LiveTrackingMap
            markers={mapMarkers}
            showRoute={!!selectedOrder}
            driverPosition={driverPos}
            restaurantPosition={restaurantPos}
            customerPosition={customerPos}
            routeDestination={selectedOrder?.delivery?.stage ? (getRouteDestination(selectedOrder.delivery.stage) || 'auto') : 'auto'}
            followDriver={true}
            height="100%"
            onRouteInfo={(info) => setRouteInfo(info ? { distance: info.distance, eta: info.eta } : null)}
          />
        )}

        {/* GPS Error Banner */}
        {gpsError && (
          <div className="absolute top-16 left-4 right-4 z-20 bg-red-500/20 backdrop-blur-md border border-red-500/30 rounded-xl p-3 text-center">
            <p className="text-red-300 text-xs font-medium">{gpsError}</p>
          </div>
        )}
      </div>

      {/* Bottom Panel */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 z-20"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 100 }}
      >
        {/* Toggle Button */}
        <div className="flex justify-center pb-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-4 py-1.5 flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
          >
            {showDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            <span className="text-xs font-medium">{showDetails ? 'Hide' : 'Show'} Details</span>
          </button>
        </div>

        {showDetails && (
          <div className="bg-black/80 backdrop-blur-2xl border-t border-white/10 p-4 space-y-4 max-h-[45vh] overflow-y-auto pb-24 md:pb-4">
            {/* Quick Stats Row */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-white/5 rounded-xl p-2.5 text-center border border-white/5">
                <Gauge className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
                <p className="text-white font-bold text-sm">{speedKmh}</p>
                <p className="text-gray-500 text-[9px] uppercase">km/h</p>
              </div>
              <div className="bg-white/5 rounded-xl p-2.5 text-center border border-white/5">
                <Navigation className="w-4 h-4 text-purple-400 mx-auto mb-1" style={{ transform: `rotate(${position?.heading || 0}deg)` }} />
                <p className="text-white font-bold text-sm">{position?.heading ? `${Math.round(position.heading)}°` : '—'}</p>
                <p className="text-gray-500 text-[9px] uppercase">Heading</p>
              </div>
              <div className="bg-white/5 rounded-xl p-2.5 text-center border border-white/5">
                <MapPin className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                <p className="text-white font-bold text-sm">{routeInfo?.distance || '—'}</p>
                <p className="text-gray-500 text-[9px] uppercase">Distance</p>
              </div>
              <div className="bg-white/5 rounded-xl p-2.5 text-center border border-white/5">
                <Clock className="w-4 h-4 text-green-400 mx-auto mb-1" />
                <p className="text-white font-bold text-sm">{routeInfo?.eta || '—'}</p>
                <p className="text-gray-500 text-[9px] uppercase">ETA</p>
              </div>
            </div>

            {/* Active Order Info */}
            {selectedOrder ? (
              <div className="bg-white/5 rounded-2xl border border-white/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const stage = (selectedOrder.delivery?.stage || (selectedOrder.deliveryStatus === 'going_to_restaurant' ? 'TO_PICKUP' : 'TO_CUSTOMER')) as DeliveryStage;
                      const sc = getStageColor(stage);
                      return (
                        <Badge className={`border-none text-[10px] font-bold ${sc.bg} ${sc.text}`}>
                          {getStageLabel(stage)}
                        </Badge>
                      );
                    })()}
                    <span className="text-gray-400 text-xs font-mono font-bold">#{formatOrderId(selectedOrder.id)}</span>
                  </div>
                  <span className="text-white font-bold">₹{selectedOrder.total?.toFixed(0)}</span>
                </div>

                {/* Current destination */}
                <div className="space-y-2">
                  {selectedOrder.deliveryStatus === 'going_to_restaurant' ? (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 border border-orange-500/20">
                        <ShoppingBag className="w-4 h-4 text-orange-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-bold text-sm">{selectedOrder.restaurantName}</p>
                        <p className="text-gray-400 text-xs">{selectedOrder.restaurantAddress || 'Restaurant'}</p>
                      </div>
                      <Button
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 text-white rounded-full h-8 px-3 text-xs"
                        onClick={() => {
                          if (restaurantPos) openMaps(restaurantPos.latitude, restaurantPos.longitude);
                          else openMaps(undefined, undefined, selectedOrder.restaurantAddress || selectedOrder.restaurantName || '');
                        }}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" /> Navigate
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                        <MapPin className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-bold text-sm">{selectedOrder.customerName}</p>
                        <p className="text-gray-400 text-xs">{formatAddress(selectedOrder.deliveryAddress)}</p>
                      </div>
                      <div className="flex gap-2">
                        {selectedOrder.customerPhone && (
                          <a href={`tel:${selectedOrder.customerPhone}`}>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-full h-8 w-8 p-0">
                              <Phone className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                        )}
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full h-8 px-3 text-xs"
                          onClick={() => {
                            if (customerPos) openMaps(customerPos.latitude, customerPos.longitude);
                            else openMaps(undefined, undefined, formatAddress(selectedOrder.deliveryAddress));
                          }}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" /> Nav
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Bike className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No active deliveries</p>
                <p className="text-gray-600 text-xs mt-1">
                  {isOnline ? 'Waiting for orders...' : 'Go online to receive orders'}
                </p>
              </div>
            )}

            {/* Coordinates Debug (small) */}
            {position && (
              <div className="flex items-center justify-between text-[10px] text-gray-600 font-mono px-1">
                <span>{position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}</span>
                <span>±{accuracy}m</span>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
