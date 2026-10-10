'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, orderBy, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Navigation, MapPin, Truck, Clock, Package, CheckCircle,
  Search, Activity, ArrowRight, Phone, User, Store,
  AlertCircle, Bike, ChefHat, ShoppingBag, Signal,
  Gauge, Eye, Filter, Satellite, Radio
} from 'lucide-react';
import { useTrackAllDrivers, DriverLocationData } from '@/hooks/useTrackDriver';
import LiveTrackingMap, { MapMarker } from '@/components/tracking/LiveTrackingMap';
import DriverInfoPanel from '@/components/tracking/DriverInfoPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { DeliveryStage, DeliveryFlow, getStageLabel, getStageColor, getRouteDestination } from '@/lib/types';

interface ActiveDelivery {
  id: string;
  customerName: string;
  restaurantName: string;
  deliveryPersonId: string;
  deliveryPersonName: string;
  deliveryPersonPhone: string;
  deliveryStatus: string;
  status: string;
  total: number;
  createdAt: any;
  restaurantAddress: string;
  deliveryAddress: string;
  delivery?: DeliveryFlow;
  pickupLocation?: { latitude: number; longitude: number };
  dropLocation?: { latitude: number; longitude: number };
}

interface DeliveryPartnerInfo {
  id: string;
  name: string;
  phone: string;
  status: 'online' | 'offline' | 'on_delivery';
  vehicle: string;
  vehicleNumber: string;
  rating: number;
}

export default function AdminTrackingPage() {
  const [activeDeliveries, setActiveDeliveries] = useState<ActiveDelivery[]>([]);
  const [partners, setPartners] = useState<DeliveryPartnerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [mapFilter, setMapFilter] = useState<'all' | 'online' | 'delivering'>('all');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);

  // Live driver locations from Firestore
  const { drivers: liveDrivers, loading: driversLoading } = useTrackAllDrivers();

  useEffect(() => {
    // Listen to active orders
    const activeOrdersQuery = query(
      collection(db, 'orders'),
      orderBy('createdAt', 'desc')
    );

    const unsubOrders = onSnapshot(activeOrdersQuery, (snap) => {
      const deliveries = snap.docs
        .map(doc => {
          const data = doc.data();
          let pickupLoc = undefined;
          if (data.delivery?.pickup?.latitude && data.delivery?.pickup?.longitude) {
            pickupLoc = { latitude: data.delivery.pickup.latitude, longitude: data.delivery.pickup.longitude };
          } else if (data.restaurantLocation?.lat && data.restaurantLocation?.lng) {
            pickupLoc = { latitude: data.restaurantLocation.lat, longitude: data.restaurantLocation.lng };
          }

          let dropLoc = undefined;
          if (data.delivery?.drop?.latitude && data.delivery?.drop?.longitude) {
            dropLoc = { latitude: data.delivery.drop.latitude, longitude: data.delivery.drop.longitude };
          } else if (data.deliveryAddress && typeof data.deliveryAddress !== 'string' && data.deliveryAddress?.latitude && data.deliveryAddress?.longitude) {
            dropLoc = { latitude: data.deliveryAddress.latitude, longitude: data.deliveryAddress.longitude };
          }

          return {
            id: doc.id,
            customerName: data.customerName || 'Unknown',
            restaurantName: data.restaurantName || 'Unknown',
            deliveryPersonId: data.deliveryPersonId || '',
            deliveryPersonName: data.deliveryPersonName || 'Unassigned',
            deliveryPersonPhone: data.deliveryPersonPhone || '',
            deliveryStatus: data.deliveryStatus || data.status || 'pending',
            status: data.status || 'pending',
            total: data.total || 0,
            createdAt: data.createdAt,
            restaurantAddress: data.restaurantAddress || '',
            deliveryAddress: typeof data.deliveryAddress === 'string' ? data.deliveryAddress : (data.deliveryAddress?.street ? `${data.deliveryAddress.street}, ${data.deliveryAddress.city || ''}` : ''),
            delivery: data.delivery,
            pickupLocation: pickupLoc,
            dropLocation: dropLoc,
          };
        })
        .filter(o => o.status !== 'delivered' && o.status !== 'cancelled') as ActiveDelivery[];
      setActiveDeliveries(deliveries);
      setLoading(false);
    });

    // Listen to delivery partners
    const unsubPartners = onSnapshot(collection(db, 'deliveryPersons'), (snap) => {
      const data = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name || 'Unknown',
          phone: d.phone || '',
          status: d.isAvailable ? 'online' : (d.status || 'offline'),
          vehicle: d.vehicle || '',
          vehicleNumber: d.vehicleNumber || '',
          rating: d.rating || 0,
        };
      }) as DeliveryPartnerInfo[];
      setPartners(data);
    });

    return () => {
      unsubOrders();
      unsubPartners();
    };
  }, []);

  // Build map markers from live driver locations
  const mapMarkers = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = [];

    liveDrivers.forEach((driver) => {
      if (!driver.latitude || !driver.longitude) return;

      // Apply filter
      if (mapFilter === 'delivering' && !driver.activeOrderId) return;

      const partner = partners.find(p => p.id === driver.driverId);
      const activeOrder = activeDeliveries.find(d => d.deliveryPersonId === driver.driverId);

      markers.push({
        id: driver.driverId,
        latitude: driver.latitude,
        longitude: driver.longitude,
        type: 'driver',
        heading: driver.heading,
        label: partner?.name || 'Driver',
        popup: `
          <div>
            <strong>${partner?.name || 'Unknown Driver'}</strong><br/>
            <span style="color:#aaa">Speed:</span> ${driver.speed} km/h<br/>
            <span style="color:#aaa">Accuracy:</span> ±${driver.accuracy}m<br/>
            ${activeOrder ? `<span style="color:#aaa">Order:</span> #${activeOrder.id.slice(0, 8)}<br/><span style="color:#aaa">Stage:</span> ${activeOrder.delivery?.stage ? getStageLabel(activeOrder.delivery.stage) : activeOrder.deliveryStatus.replace(/_/g, ' ')}` : '<span style="color:#6b7280">No active order</span>'}
          </div>
        `,
      });

      // If this driver is selected, also add restaurant & customer markers for their active order
      if (selectedDriverId === driver.driverId && activeOrder) {
        if (activeOrder.pickupLocation) {
          markers.push({
            id: `pickup-${activeOrder.id}`,
            latitude: activeOrder.pickupLocation.latitude,
            longitude: activeOrder.pickupLocation.longitude,
            type: 'restaurant',
            label: activeOrder.restaurantName,
            popup: `<strong>${activeOrder.restaurantName}</strong><br/>Pickup Restaurant`,
          });
        }
        if (activeOrder.dropLocation) {
          markers.push({
            id: `drop-${activeOrder.id}`,
            latitude: activeOrder.dropLocation.latitude,
            longitude: activeOrder.dropLocation.longitude,
            type: 'customer',
            label: activeOrder.customerName,
            popup: `<strong>${activeOrder.customerName}</strong><br/>Dropoff Customer`,
          });
        }
      }
    });

    return markers;
  }, [liveDrivers, partners, activeDeliveries, mapFilter, selectedDriverId]);

  // Selected driver details
  const selectedDriver = liveDrivers.find(d => d.driverId === selectedDriverId);
  const selectedPartner = partners.find(p => p.id === selectedDriverId);
  const selectedOrder = activeDeliveries.find(d => d.deliveryPersonId === selectedDriverId);

  // Filtered deliveries
  const filteredDeliveries = activeDeliveries.filter(d => {
    const matchesSearch = searchQuery === '' ||
      d.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.restaurantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.deliveryPersonName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter || d.deliveryStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const onlinePartners = partners.filter(p => p.status === 'online').length;
  const liveOnlineCount = liveDrivers.length;
  const deliveringCount = liveDrivers.filter(d => d.activeOrderId).length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'confirmed': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'preparing': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'ready': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'out_for_delivery': case 'going_to_customer': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'going_to_restaurant': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      default: return 'bg-gray-500/10 text-muted-foreground border-border/20';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Connecting to live tracking...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-gray-400 tracking-tight mb-2">
            Fleet Tracking
          </h1>
          <p className="text-muted-foreground">Monitor all delivery partners and active orders on the live map.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-card/5 rounded-full px-4 py-2 border border-border/50">
            <Satellite className="w-3.5 h-3.5 text-green-400" />
            <span className="text-sm font-medium text-green-400">{liveOnlineCount} GPS Active</span>
          </div>
          <div className="flex items-center gap-2 bg-card/5 rounded-full px-4 py-2 border border-border/50">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium text-green-400">Live Updates</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { title: 'Active Orders', value: activeDeliveries.length, icon: ShoppingBag, color: 'blue' },
          { title: 'GPS Active', value: liveOnlineCount, icon: Satellite, color: 'emerald' },
          { title: 'Delivering', value: deliveringCount, icon: Bike, color: 'purple' },
          { title: 'Partners Online', value: onlinePartners, icon: User, color: 'green' },
          { title: 'Idle', value: liveOnlineCount - deliveringCount, icon: Radio, color: 'yellow' },
          { title: 'Total Partners', value: partners.length, icon: Truck, color: 'gray' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="bg-card/5 border-border/50 backdrop-blur-md">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`w-4 h-4 text-${stat.color}-400`} />
                </div>
                <p className="text-2xl font-bold text-foreground font-mono">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-bold">{stat.title}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Fleet Map */}
      <Card className="bg-background/40 border-border/50 backdrop-blur-md shadow-xl overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-card/5 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Navigation className="w-5 h-5 text-blue-400" />
              Live Fleet Map
              <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20 text-xs gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {mapMarkers.length} on map
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Map Filter */}
              <div className="flex bg-background/30 rounded-lg border border-border/50 p-0.5">
                {[
                  { key: 'all' as const, label: 'All' },
                  { key: 'delivering' as const, label: 'Delivering' },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setMapFilter(f.key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      mapFilter === f.key
                        ? 'bg-blue-600 text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMap(!showMap)}
                className="border-border/50 text-muted-foreground hover:text-foreground text-xs"
              >
                <Eye className="w-3.5 h-3.5 mr-1" />
                {showMap ? 'Hide' : 'Show'} Map
              </Button>
            </div>
          </div>
        </CardHeader>

        <AnimatePresence>
          {showMap && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="h-[50vh] relative">
                {mapMarkers.length > 0 ? (
                  <LiveTrackingMap
                    markers={mapMarkers}
                    showRoute={!!selectedOrder && !!selectedDriver?.latitude}
                    driverPosition={selectedDriver && selectedDriver.latitude ? { latitude: selectedDriver.latitude, longitude: selectedDriver.longitude } : null}
                    restaurantPosition={selectedOrder?.pickupLocation || null}
                    customerPosition={selectedOrder?.dropLocation || null}
                    routeDestination={selectedOrder?.delivery?.stage ? (getRouteDestination(selectedOrder.delivery.stage) || 'auto') : 'auto'}
                    height="100%"
                    onMarkerClick={(id) => {
                      if (!id.startsWith('pickup-') && !id.startsWith('drop-')) {
                        setSelectedDriverId(id);
                      }
                    }}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <Satellite className="w-16 h-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-bold text-muted-foreground mb-1">No Drivers on Map</h3>
                    <p className="text-muted-foreground text-sm max-w-md">
                      No delivery partners have GPS tracking active. When drivers go online and share their location, they'll appear here.
                    </p>
                  </div>
                )}

                {/* Selected Driver Panel */}
                {selectedDriver && selectedPartner && (
                  <motion.div
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="absolute top-4 right-4 z-10 w-72"
                  >
                    <DriverInfoPanel
                      driverName={selectedPartner.name}
                      driverPhone={selectedPartner.phone}
                      driverVehicle={`${selectedPartner.vehicle} • ${selectedPartner.vehicleNumber}`}
                      speed={selectedDriver.speed}
                      heading={selectedDriver.heading}
                      accuracy={selectedDriver.accuracy}
                      isOnline={selectedDriver.isOnline}
                      phase={selectedOrder?.deliveryStatus}
                    />
                    <button
                      onClick={() => setSelectedDriverId(null)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-foreground text-xs hover:bg-red-600 transition-colors"
                    >
                      ×
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Active Deliveries Board */}
      <Card className="bg-background/40 border-border/50 backdrop-blur-md shadow-xl overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-card/5 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-blue-400" />
                Active Deliveries
              </CardTitle>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">
                {activeDeliveries.length} active
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background/20 border-border/50 text-foreground placeholder:text-muted-foreground w-56"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-background/20 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none focus:border-blue-500/50"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="preparing">Preparing</option>
                <option value="ready">Ready</option>
                <option value="out_for_delivery">Out for Delivery</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {filteredDeliveries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Navigation className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">No active deliveries</p>
              <p className="text-sm">All orders have been delivered or no orders match your filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredDeliveries.map((delivery) => {
                const driverLoc = liveDrivers.find(d => d.driverId === delivery.deliveryPersonId);
                return (
                  <div
                    key={delivery.id}
                    className="bg-card/5 rounded-xl border border-border/50 p-4 hover:border-border transition-all duration-200 group cursor-pointer"
                    onClick={() => {
                      if (delivery.deliveryPersonId) {
                        setSelectedDriverId(delivery.deliveryPersonId);
                        setShowMap(true);
                      }
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-foreground font-mono text-xs bg-card/10 px-2 py-1 rounded">
                        #{delivery.id.slice(0, 8)}
                      </span>
                      <div className="flex items-center gap-2">
                        {driverLoc && (
                          <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-400 border-green-500/20 gap-1">
                            <Satellite className="w-2.5 h-2.5" />
                            GPS
                          </Badge>
                        )}
                        {delivery.delivery?.stage ? (
                          <Badge className={`text-[10px] font-bold border ${getStageColor(delivery.delivery.stage).bg} ${getStageColor(delivery.delivery.stage).text} ${getStageColor(delivery.delivery.stage).border}`}>
                            {getStageLabel(delivery.delivery.stage)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className={`text-[10px] ${getStatusColor(delivery.deliveryStatus)}`}>
                            {getStatusLabel(delivery.deliveryStatus)}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Status Progress */}
                    <div className="flex items-center gap-1 mb-4">
                      {['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].map((step, i) => {
                        const steps = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'];
                        const currentIdx = steps.indexOf(delivery.status);
                        const isComplete = i <= currentIdx;
                        const isCurrent = i === currentIdx;
                        return (
                          <div key={step} className="flex-1">
                            <div className={`h-1.5 w-full rounded-full transition-all ${isComplete ? 'bg-blue-500' : 'bg-card/10'} ${isCurrent ? 'animate-pulse bg-blue-400' : ''}`} />
                          </div>
                        );
                      })}
                    </div>

                    {/* Route info */}
                    <div className="space-y-2 mb-3">
                      <div className="flex items-start gap-2">
                        <Store className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-foreground text-sm font-medium">{delivery.restaurantName}</p>
                          {delivery.restaurantAddress && (
                            <p className="text-muted-foreground text-[10px] truncate max-w-[200px]">{delivery.restaurantAddress}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-center">
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-foreground text-sm font-medium">{delivery.customerName}</p>
                          {delivery.deliveryAddress && (
                            <p className="text-muted-foreground text-[10px] truncate max-w-[200px]">{delivery.deliveryAddress}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Driver & Total */}
                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            delivery.deliveryPersonName !== 'Unassigned'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {delivery.deliveryPersonName !== 'Unassigned'
                              ? delivery.deliveryPersonName.charAt(0)
                              : '?'
                            }
                          </div>
                          {driverLoc && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border border-border" />
                          )}
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">{delivery.deliveryPersonName}</p>
                          {driverLoc && (
                            <p className="text-muted-foreground text-[9px]">{driverLoc.speed} km/h</p>
                          )}
                        </div>
                      </div>
                      <p className="text-emerald-400 font-bold font-mono text-sm">₹{delivery.total}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Delivery Partners with GPS Status */}
      <Card className="bg-background/40 border-border/50 backdrop-blur-md shadow-xl overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-card/5 pb-4">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-400" />
            Delivery Partners — GPS Status
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-white/5">
            {partners.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No delivery partners registered</div>
            ) : (
              partners
                .sort((a, b) => {
                  const order = { online: 0, on_delivery: 1, offline: 2 };
                  return (order[a.status] || 2) - (order[b.status] || 2);
                })
                .map((partner) => {
                  const driverLoc = liveDrivers.find(d => d.driverId === partner.id);
                  const activeOrder = activeDeliveries.find(d => d.deliveryPersonId === partner.id);

                  return (
                    <div
                      key={partner.id}
                      className={`flex items-center justify-between p-4 hover:bg-card/5 transition-colors cursor-pointer ${
                        selectedDriverId === partner.id ? 'bg-blue-500/10' : ''
                      }`}
                      onClick={() => {
                        if (driverLoc) {
                          setSelectedDriverId(partner.id);
                          setShowMap(true);
                        }
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-card/10 flex items-center justify-center text-foreground font-bold text-sm">
                            {partner.name.charAt(0)}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-border ${
                            driverLoc?.isOnline ? 'bg-green-500' : partner.status === 'online' ? 'bg-yellow-500' : 'bg-gray-600'
                          }`} />
                        </div>
                        <div>
                          <p className="text-foreground font-medium text-sm">{partner.name}</p>
                          <p className="text-muted-foreground text-xs">{partner.vehicle} • {partner.vehicleNumber}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* GPS Data */}
                        {driverLoc ? (
                          <div className="flex items-center gap-3 text-xs">
                            <div className="flex items-center gap-1 text-green-400">
                              <Satellite className="w-3 h-3" />
                              <span className="font-mono">±{driverLoc.accuracy}m</span>
                            </div>
                            <div className="flex items-center gap-1 text-blue-400">
                              <Gauge className="w-3 h-3" />
                              <span className="font-mono">{driverLoc.speed} km/h</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">No GPS data</span>
                        )}

                        {/* Active Order */}
                        {activeOrder && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold ${
                              activeOrder.delivery?.stage
                                ? `${getStageColor(activeOrder.delivery.stage).bg} ${getStageColor(activeOrder.delivery.stage).text} ${getStageColor(activeOrder.delivery.stage).border}`
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            }`}
                          >
                            {activeOrder.delivery?.stage ? getStageLabel(activeOrder.delivery.stage) : `Order #${activeOrder.id.slice(0, 6)}`}
                          </Badge>
                        )}

                        <span className="text-yellow-400 text-xs font-mono">⭐ {partner.rating.toFixed(1)}</span>

                        <Badge variant="outline" className={`text-xs capitalize ${
                          driverLoc?.isOnline
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : partner.status === 'online'
                              ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                              : 'bg-gray-500/10 text-muted-foreground border-border/20'
                        }`}>
                          {driverLoc?.isOnline ? 'GPS Active' : partner.status.replace('_', ' ')}
                        </Badge>

                        {partner.phone && (
                          <a href={`tel:${partner.phone}`} className="text-muted-foreground hover:text-blue-400 transition-colors" onClick={(e) => e.stopPropagation()}>
                            <Phone size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
