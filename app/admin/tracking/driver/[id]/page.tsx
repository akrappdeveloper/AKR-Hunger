'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTrackDriver } from '@/hooks/useTrackDriver';
import LiveTrackingMap, { MapMarker } from '@/components/tracking/LiveTrackingMap';
import DriverInfoPanel from '@/components/tracking/DriverInfoPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft, Bike, MapPin, Clock, Phone, Gauge,
  Signal, Navigation, Satellite, User, ShoppingBag,
  Package, CheckCircle, Activity, Store
} from 'lucide-react';
import { motion } from 'framer-motion';
import { DeliveryStage, DeliveryFlow, getStageLabel, getStageColor, getRouteDestination } from '@/lib/types';

interface PartnerData {
  id: string;
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  vehicleNumber: string;
  rating: number;
  status: string;
  isAvailable: boolean;
}

interface OrderInfo {
  id: string;
  customerName: string;
  restaurantName: string;
  status: string;
  deliveryStatus: string;
  total: number;
  delivery?: DeliveryFlow;
  pickupLocation?: { latitude: number; longitude: number; address?: string };
  dropLocation?: { latitude: number; longitude: number; address?: string };
}

export default function AdminDriverDetailPage() {
  const params = useParams();
  const router = useRouter();
  const driverId = params.id as string;

  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [activeOrders, setActiveOrders] = useState<OrderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Track driver live location
  const { location: driverLocation, loading: trackLoading } = useTrackDriver(driverId);

  // Fetch partner info
  useEffect(() => {
    if (!driverId) return;

    const unsub = onSnapshot(doc(db, 'deliveryPersons', driverId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPartner({
          id: docSnap.id,
          name: data.name || 'Unknown',
          phone: data.phone || '',
          email: data.email || '',
          vehicle: data.vehicle || '',
          vehicleNumber: data.vehicleNumber || '',
          rating: data.rating || 0,
          status: data.status || 'offline',
          isAvailable: data.isAvailable || false,
        });
      }
      setLoading(false);
    });

    return () => unsub();
  }, [driverId]);

  // Fetch active orders for this driver
  useEffect(() => {
    if (!driverId) return;

    const q = query(
      collection(db, 'orders'),
      where('deliveryPersonId', '==', driverId),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const orders = snap.docs
        .map(d => {
          const data = d.data();
          let pickupLoc = undefined;
          if (data.delivery?.pickup?.latitude && data.delivery?.pickup?.longitude) {
            pickupLoc = { latitude: data.delivery.pickup.latitude, longitude: data.delivery.pickup.longitude, address: data.delivery.pickup.address };
          } else if (data.restaurantLocation?.lat && data.restaurantLocation?.lng) {
            pickupLoc = { latitude: data.restaurantLocation.lat, longitude: data.restaurantLocation.lng, address: data.restaurantAddress };
          }

          let dropLoc = undefined;
          if (data.delivery?.drop?.latitude && data.delivery?.drop?.longitude) {
            dropLoc = { latitude: data.delivery.drop.latitude, longitude: data.delivery.drop.longitude, address: data.delivery.drop.address };
          } else if (data.deliveryAddress && typeof data.deliveryAddress !== 'string' && data.deliveryAddress?.latitude && data.deliveryAddress?.longitude) {
            dropLoc = { latitude: data.deliveryAddress.latitude, longitude: data.deliveryAddress.longitude, address: data.deliveryAddress.street };
          }

          return {
            id: d.id,
            customerName: data.customerName || 'Unknown',
            restaurantName: data.restaurantName || 'Unknown',
            status: data.status || 'pending',
            deliveryStatus: data.deliveryStatus || data.status || 'pending',
            total: data.total || 0,
            delivery: data.delivery,
            pickupLocation: pickupLoc,
            dropLocation: dropLoc,
          };
        })
        .filter(o => !['delivered', 'cancelled'].includes(o.status)) as OrderInfo[];
      setActiveOrders(orders);
      if (orders.length > 0 && !selectedOrderId) {
        setSelectedOrderId(orders[0].id);
      }
    });

    return () => unsub();
  }, [driverId]);

  const currentOrder = activeOrders.find(o => o.id === selectedOrderId) || activeOrders[0];

  // Map markers
  const mapMarkers = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = [];

    // Driver Marker
    if (driverLocation && driverLocation.latitude) {
      markers.push({
        id: 'driver',
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        type: 'driver' as const,
        heading: driverLocation.heading,
        label: partner?.name || 'Driver',
        popup: `<strong>${partner?.name || 'Driver'}</strong><br/>Speed: ${driverLocation.speed} km/h<br/>Accuracy: ±${driverLocation.accuracy}m`,
      });
    }

    // Active Order Restaurant & Customer Markers
    if (currentOrder) {
      if (currentOrder.pickupLocation) {
        markers.push({
          id: 'restaurant',
          latitude: currentOrder.pickupLocation.latitude,
          longitude: currentOrder.pickupLocation.longitude,
          type: 'restaurant' as const,
          label: currentOrder.restaurantName,
          popup: `<strong>${currentOrder.restaurantName}</strong><br/>Pickup Location`,
        });
      }
      if (currentOrder.dropLocation) {
        markers.push({
          id: 'customer',
          latitude: currentOrder.dropLocation.latitude,
          longitude: currentOrder.dropLocation.longitude,
          type: 'customer' as const,
          label: currentOrder.customerName,
          popup: `<strong>${currentOrder.customerName}</strong><br/>Dropoff Location`,
        });
      }
    }

    return markers;
  }, [driverLocation, partner, currentOrder]);

  const currentStage = currentOrder?.delivery?.stage;
  const currentRouteDest = currentStage ? (getRouteDestination(currentStage) || 'auto') : 'auto';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="h-10 w-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-center">
        <div>
          <User className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Driver Not Found</h2>
          <Button onClick={() => router.push('/admin/tracking')}>Back to Fleet</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push('/admin/tracking')}
          className="rounded-full border-white/10 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white tracking-tight">{partner.name}</h1>
            {currentStage && (
              <Badge className={`border text-xs font-bold ${getStageColor(currentStage).bg} ${getStageColor(currentStage).text} ${getStageColor(currentStage).border}`}>
                {getStageLabel(currentStage)}
              </Badge>
            )}
          </div>
          <p className="text-gray-400 text-sm mt-0.5">{partner.vehicle} • {partner.vehicleNumber} • {partner.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {driverLocation?.isOnline ? (
            <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              GPS Active
            </Badge>
          ) : (
            <Badge className="bg-gray-500/10 text-gray-400 border border-gray-500/20">
              GPS Offline
            </Badge>
          )}
          <a href={`tel:${partner.phone}`}>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-full gap-1">
              <Phone className="w-3.5 h-3.5" /> Call
            </Button>
          </a>
        </div>
      </div>

      {/* Live Map with Route Visualization */}
      <Card className="bg-black/40 border-white/10 overflow-hidden relative shadow-2xl">
        <div className="h-[48vh] relative">
          {driverLocation && driverLocation.latitude ? (
            <>
              <LiveTrackingMap
                markers={mapMarkers}
                showRoute={!!currentOrder}
                driverPosition={{ latitude: driverLocation.latitude, longitude: driverLocation.longitude }}
                restaurantPosition={currentOrder?.pickupLocation || null}
                customerPosition={currentOrder?.dropLocation || null}
                routeDestination={currentRouteDest}
                followDriver={true}
                height="100%"
              />

              {/* Floating Driver Panel */}
              <div className="absolute top-4 right-4 z-10 w-72 pointer-events-auto">
                <DriverInfoPanel
                  driverName={partner.name}
                  driverPhone={partner.phone}
                  driverVehicle={`${partner.vehicle} • ${partner.vehicleNumber}`}
                  speed={driverLocation.speed}
                  heading={driverLocation.heading}
                  accuracy={driverLocation.accuracy}
                  isOnline={driverLocation.isOnline}
                  phase={currentStage === 'TO_PICKUP' || currentStage === 'ARRIVED_PICKUP' ? 'going_to_restaurant' : 'going_to_customer'}
                />
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-white/5">
              <Satellite className="w-12 h-12 text-gray-700 mb-4" />
              <h3 className="text-white font-bold mb-1">No GPS Data</h3>
              <p className="text-gray-500 text-sm">Driver's GPS is currently not broadcasting</p>
            </div>
          )}
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Speed', value: driverLocation ? `${driverLocation.speed} km/h` : '—', icon: Gauge, color: 'text-yellow-400' },
          { label: 'Heading', value: driverLocation ? `${Math.round(driverLocation.heading)}°` : '—', icon: Navigation, color: 'text-purple-400' },
          { label: 'Accuracy', value: driverLocation ? `±${driverLocation.accuracy}m` : '—', icon: Signal, color: 'text-green-400' },
          { label: 'Latitude', value: driverLocation ? driverLocation.latitude.toFixed(5) : '—', icon: MapPin, color: 'text-blue-400' },
          { label: 'Longitude', value: driverLocation ? driverLocation.longitude.toFixed(5) : '—', icon: MapPin, color: 'text-blue-400' },
          { label: 'Rating', value: `⭐ ${partner.rating.toFixed(1)}`, icon: CheckCircle, color: 'text-amber-400' },
        ].map((stat, i) => (
          <Card key={i} className="bg-white/5 border-white/10">
            <CardContent className="p-3">
              <stat.icon className={`w-3.5 h-3.5 ${stat.color} mb-1.5`} />
              <p className="text-white font-bold text-sm font-mono truncate">{stat.value}</p>
              <p className="text-gray-500 text-[9px] uppercase tracking-wider font-bold">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Orders with Stage Details */}
      <Card className="bg-black/40 border-white/10">
        <CardHeader className="border-b border-white/5 bg-white/5">
          <CardTitle className="text-base text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-blue-400" />
              Active Assigned Orders ({activeOrders.length})
            </div>
            {currentStage && (
              <span className="text-xs font-normal text-gray-400">
                Current Route: <strong className="text-white">{currentRouteDest === 'restaurant' ? 'Driver → Restaurant' : 'Driver → Customer'}</strong>
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {activeOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No active orders assigned to this driver</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeOrders.map(order => {
                const stage = (order.delivery?.stage || (order.deliveryStatus === 'going_to_restaurant' ? 'TO_PICKUP' : 'TO_CUSTOMER')) as DeliveryStage;
                const stageColor = getStageColor(stage);
                const isSelected = order.id === currentOrder?.id;

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`bg-white/5 rounded-xl p-4 border transition-all cursor-pointer ${
                      isSelected ? 'border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/30' : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-white font-bold text-sm font-mono">#{order.id.slice(0, 8)}</p>
                          <Badge className={`text-[10px] font-bold border ${stageColor.bg} ${stageColor.text} ${stageColor.border}`}>
                            {getStageLabel(stage)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span className="text-white font-medium">{order.restaurantName}</span>
                          <span>→</span>
                          <span className="text-white font-medium">{order.customerName}</span>
                        </div>
                      </div>
                      <div className="text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                        <p className="text-emerald-400 font-bold font-mono text-base">₹{order.total}</p>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                          {isSelected ? '● Active Route' : 'Click to View Route'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
