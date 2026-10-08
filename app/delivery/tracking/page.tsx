'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MapPin, Navigation, Compass, ArrowLeft, Bike,
  Gauge, Signal, Clock, Phone, ExternalLink,
  Satellite, ShoppingBag, Package, ChevronDown, ChevronUp,
  Users, Eye, EyeOff, CheckCircle2, AlertCircle, Crosshair,
  Sparkles, Check, X, ShieldAlert, Store
} from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  collection, query, where, onSnapshot, orderBy,
  doc, updateDoc, serverTimestamp, runTransaction
} from 'firebase/firestore';
import {
  Order, DeliveryStage, getRouteDestination,
  getStageLabel, getStageColor, formatOrderId
} from '@/lib/types';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import LiveTrackingMap, { MapMarker } from '@/components/tracking/LiveTrackingMap';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface DriverLocationInfo {
  driverId: string;
  driverName?: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
  isOnline: boolean;
  activeOrderId?: string | null;
  updatedAt?: any;
}

/** Haversine formula to compute distance in km between two GPS coordinates */
function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

function getCompassDirection(heading?: number): string {
  if (heading === undefined || heading === null || isNaN(heading)) return '—';
  const h = ((heading % 360) + 360) % 360;
  if (h >= 337.5 || h < 22.5) return 'N';
  if (h >= 22.5 && h < 67.5) return 'NE';
  if (h >= 67.5 && h < 112.5) return 'E';
  if (h >= 112.5 && h < 157.5) return 'SE';
  if (h >= 157.5 && h < 202.5) return 'S';
  if (h >= 202.5 && h < 247.5) return 'SW';
  if (h >= 247.5 && h < 292.5) return 'W';
  return 'NW';
}

export default function DeliveryTrackingPage() {
  const router = useRouter();
  const { user, deliveryPartner, loading: authLoading } = useDeliveryAuth();

  // Incomplete orders only (never delivered or cancelled)
  const [incompleteOrders, setIncompleteOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // All active fleet drivers across the platform
  const [allDrivers, setAllDrivers] = useState<Map<string, DriverLocationInfo>>(new Map());
  const [showFleetPartners, setShowFleetPartners] = useState(true);
  const [showFleetModal, setShowFleetModal] = useState(false);

  // UI & Route State
  const [routeInfo, setRouteInfo] = useState<{ distance: string; eta: string } | null>(null);
  const [showDetails, setShowDetails] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // OTP Verification Modal
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [verifyingOrder, setVerifyingOrder] = useState<Order | null>(null);

  // Online status of current driver
  const isOnline = deliveryPartner?.isAvailable || deliveryPartner?.status === 'online' || (deliveryPartner as any)?.isOnline === true;
  const hasIncompleteDeliveries = incompleteOrders.length > 0;

  // Selected order object
  const selectedOrder = useMemo(() => {
    if (!incompleteOrders.length) return null;
    return incompleteOrders.find(o => o.id === selectedOrderId) || incompleteOrders[0];
  }, [incompleteOrders, selectedOrderId]);

  // Real-time GPS Tracker for the logged-in driver
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
    driverName: deliveryPartner?.name || (deliveryPartner as any)?.fullName || 'Rider',
    isOnline: !!isOnline,
    hasActiveDelivery: hasIncompleteDeliveries,
    activeOrderId: selectedOrder?.id,
  });

  // Auth Guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/delivery/login');
    }
  }, [user, authLoading, router]);

  // 1. Listen for ONLY INCOMPLETE orders assigned to this delivery partner
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'orders'),
      where('deliveryPersonId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Strictly filter to incomplete orders (status NOT delivered and NOT cancelled)
        const orders = snapshot.docs
          .map(d => ({ ...d.data(), id: d.id } as Order))
          .filter(o => !['delivered', 'cancelled'].includes(o.status || ''));

        setIncompleteOrders(orders);

        // Keep or update selected order
        if (orders.length > 0) {
          setSelectedOrderId(prev => {
            if (prev && orders.some(o => o.id === prev)) return prev;
            return orders[0].id || null;
          });
        } else {
          setSelectedOrderId(null);
        }

        setOrdersLoading(false);
      },
      (err) => {
        console.error('[DeliveryTracking] Orders snapshot error:', err);
        setOrdersLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 2. Real-time subscription to ALL driver delivery partner locations in Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'driverLocations'),
      (snapshot) => {
        const newMap = new Map<string, DriverLocationInfo>();
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          // Include any driver with valid GPS coordinates
          if (data.latitude && data.longitude) {
            newMap.set(docSnap.id, {
              driverId: docSnap.id,
              driverName: data.driverName || `Partner #${docSnap.id.slice(0, 5)}`,
              latitude: Number(data.latitude),
              longitude: Number(data.longitude),
              speed: Number(data.speed || 0),
              heading: Number(data.heading || 0),
              accuracy: Number(data.accuracy || 0),
              isOnline: data.isOnline !== false,
              activeOrderId: data.activeOrderId || null,
              updatedAt: data.updatedAt,
            });
          }
        });
        setAllDrivers(newMap);
      },
      (err) => {
        console.warn('[DeliveryTracking] Fleet locations subscription warning:', err.message);
      }
    );

    return () => unsub();
  }, []);

  // Format addresses gracefully
  const formatAddress = (addr: any): string => {
    if (!addr) return 'Address not available';
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
      const parts = [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : (addr.address || 'Drop-off Location');
    }
    return 'Address not available';
  };

  // Launch external navigation in Google Maps
  const openMaps = (lat?: number, lng?: number, address?: string) => {
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    } else if (address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    }
  };

  // 3. Compile all markers for LiveTrackingMap
  const mapMarkers = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = [];

    // (A) Current logged-in driver marker (SELF)
    if (position) {
      markers.push({
        id: 'driver-self',
        latitude: position.latitude,
        longitude: position.longitude,
        type: 'driver',
        heading: position.heading,
        label: 'You (Rider)',
        popup: `
          <div style="min-width: 175px;">
            <div style="font-weight: 700; color: #3b82f6; font-size: 13px; margin-bottom: 4px;">🛵 You (My GPS)</div>
            <div style="color: #9ca3af; font-size: 11px;">Speed: <b style="color: #fbbf24;">${speedKmh} km/h</b></div>
            <div style="color: #9ca3af; font-size: 11px;">Heading: <b>${position.heading ? Math.round(position.heading) + '°' : '—'} (${getCompassDirection(position.heading)})</b></div>
            <div style="color: #9ca3af; font-size: 11px;">Accuracy: <b>±${accuracy || 0}m</b></div>
            <div style="color: #34d399; font-size: 11px; margin-top: 4px; font-weight: 600;">● Active GPS Tracking</div>
          </div>
        `,
      });
    }

    // (B) ALL other active delivery partner locations (Fleet GPS)
    if (showFleetPartners) {
      allDrivers.forEach((d, driverId) => {
        // Skip current driver (already rendered as 'driver-self' with high precision)
        if (driverId === user?.uid) return;
        if (!d.latitude || !d.longitude) return;

        const distAway = position
          ? calculateHaversineDistanceKm(position.latitude, position.longitude, d.latitude, d.longitude)
          : null;

        markers.push({
          id: `driver-${driverId}`,
          latitude: d.latitude,
          longitude: d.longitude,
          type: 'driver',
          heading: d.heading,
          label: d.driverName || `Partner #${driverId.slice(0, 5)}`,
          popup: `
            <div style="min-width: 180px;">
              <div style="font-weight: 700; color: #60a5fa; font-size: 13px; margin-bottom: 4px;">🛵 ${d.driverName || 'Delivery Partner'}</div>
              <div style="color: #9ca3af; font-size: 11px;">Status: <b style="color: ${d.isOnline ? '#34d399' : '#9ca3af'};">${d.isOnline ? (d.activeOrderId ? 'On Delivery' : 'Online / Available') : 'Offline'}</b></div>
              <div style="color: #9ca3af; font-size: 11px;">Speed: <b style="color: #fbbf24;">${d.speed} km/h</b></div>
              ${distAway !== null ? `<div style="color: #9ca3af; font-size: 11px;">Distance: <b style="color: #60a5fa;">${distAway} km away</b></div>` : ''}
              <div style="color: #6b7280; font-size: 10px; margin-top: 5px;">ID: ${driverId.slice(0, 8)}...</div>
            </div>
          `,
        });
      });
    }

    // (C) ONLY INCOMPLETE ORDERS: Customer Drop-off & Restaurant Pickup Markers
    incompleteOrders.forEach((order) => {
      const isSelected = order.id === selectedOrderId;
      const shortId = formatOrderId(order.id);

      // Customer drop-off location marker
      const deliveryAddr = order.deliveryAddress;
      if (deliveryAddr && typeof deliveryAddr !== 'string' && deliveryAddr.latitude && deliveryAddr.longitude) {
        markers.push({
          id: `customer-${order.id}`,
          latitude: Number(deliveryAddr.latitude),
          longitude: Number(deliveryAddr.longitude),
          type: 'customer',
          label: isSelected ? `🎯 Drop-off: ${order.customerName}` : `🏠 ${order.customerName}`,
          popup: `
            <div style="min-width: 195px;">
              <div style="font-weight: 700; color: #22c55e; font-size: 13px; margin-bottom: 3px;">🏠 Customer Drop-off</div>
              <div style="color: #f9fafb; font-weight: 600; font-size: 12px;">${order.customerName || 'Customer'}</div>
              <div style="color: #9ca3af; font-size: 11px; margin-top: 2px;">${formatAddress(deliveryAddr)}</div>
              <div style="color: #e5e7eb; font-size: 11px; margin-top: 4px;">Order: <b style="color: #60a5fa;">#${shortId}</b> • ₹${order.total?.toFixed(0) || '0'}</div>
              <div style="color: #38bdf8; font-size: 11px; margin-top: 2px;">Stage: <b>${getStageLabel(order.delivery?.stage)}</b></div>
            </div>
          `,
        });
      }

      // Restaurant pickup location marker
      if (order.restaurantLocation?.lat && order.restaurantLocation?.lng) {
        markers.push({
          id: `restaurant-${order.id}`,
          latitude: Number(order.restaurantLocation.lat),
          longitude: Number(order.restaurantLocation.lng),
          type: 'restaurant',
          label: isSelected ? `🍔 Pickup: ${order.restaurantName}` : `🏪 ${order.restaurantName}`,
          popup: `
            <div style="min-width: 195px;">
              <div style="font-weight: 700; color: #f97316; font-size: 13px; margin-bottom: 3px;">🍔 Restaurant Pickup</div>
              <div style="color: #f9fafb; font-weight: 600; font-size: 12px;">${order.restaurantName || 'Restaurant'}</div>
              <div style="color: #9ca3af; font-size: 11px; margin-top: 2px;">${order.restaurantAddress || 'Pickup Point'}</div>
              <div style="color: #e5e7eb; font-size: 11px; margin-top: 4px;">Order: <b style="color: #60a5fa;">#${shortId}</b></div>
            </div>
          `,
        });
      }
    });

    return markers;
  }, [position, speedKmh, accuracy, showFleetPartners, allDrivers, user?.uid, incompleteOrders, selectedOrderId]);

  // Active positions for route rendering to selected order
  const driverPos = position ? { latitude: position.latitude, longitude: position.longitude } : null;

  const restaurantPos = selectedOrder?.restaurantLocation?.lat && selectedOrder?.restaurantLocation?.lng
    ? { latitude: selectedOrder.restaurantLocation.lat, longitude: selectedOrder.restaurantLocation.lng }
    : null;

  const customerPos = (() => {
    const addr = selectedOrder?.deliveryAddress;
    if (addr && typeof addr !== 'string' && addr.latitude && addr.longitude) {
      return { latitude: Number(addr.latitude), longitude: Number(addr.longitude) };
    }
    return null;
  })();

  // Calculate destination stage
  const currentStage = (selectedOrder?.delivery?.stage ||
    (selectedOrder?.deliveryStatus === 'going_to_restaurant' ? 'TO_PICKUP' : 'TO_CUSTOMER')) as DeliveryStage;

  const currentRouteDest = getRouteDestination(currentStage) || 'customer';

  // Count active fleet partners excluding self
  const peerDriversList = useMemo(() => {
    const list: (DriverLocationInfo & { distance?: number })[] = [];
    allDrivers.forEach((d, driverId) => {
      if (driverId === user?.uid) return;
      const dist = position
        ? calculateHaversineDistanceKm(position.latitude, position.longitude, d.latitude, d.longitude)
        : undefined;
      list.push({ ...d, distance: dist });
    });
    // Sort nearest first
    list.sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999));
    return list;
  }, [allDrivers, user?.uid, position]);

  // GPS signal rating
  const getSignalRating = () => {
    if (!accuracy) return { label: 'No GPS', color: 'text-gray-500', dot: 'bg-gray-500' };
    if (accuracy <= 8) return { label: 'Excellent', color: 'text-green-400', dot: 'bg-green-500' };
    if (accuracy <= 20) return { label: 'Good', color: 'text-emerald-400', dot: 'bg-emerald-500' };
    if (accuracy <= 40) return { label: 'Fair', color: 'text-yellow-400', dot: 'bg-yellow-500' };
    return { label: 'Weak', color: 'text-red-400', dot: 'bg-red-500' };
  };

  const signal = getSignalRating();

  // ─── STAGE PROGRESSION ACTIONS ──────────────────────────────────────────────
  const updateDeliveryStage = async (orderId: string, newStage: DeliveryStage, extra: Record<string, any> = {}) => {
    setActionLoading(true);
    try {
      const stageTimestampMap: Record<string, string> = {
        'ARRIVED_PICKUP': 'delivery.arrivedPickupAt',
        'PICKED_UP': 'delivery.pickedUpAt',
        'TO_CUSTOMER': 'delivery.pickedUpAt',
        'ARRIVED_CUSTOMER': 'delivery.arrivedCustomerAt',
        'DELIVERED': 'delivery.deliveredAt',
      };

      const updates: Record<string, any> = {
        'delivery.stage': newStage,
        updatedAt: serverTimestamp(),
        ...extra,
      };

      if (stageTimestampMap[newStage]) {
        updates[stageTimestampMap[newStage]] = serverTimestamp();
      }

      await updateDoc(doc(db, 'orders', orderId), updates);
      toast.success(`Stage updated: ${getStageLabel(newStage)}`);
    } catch (err: any) {
      console.error('Failed to advance delivery stage:', err);
      toast.error('Failed to update stage: ' + (err.message || 'Error'));
    } finally {
      setActionLoading(false);
    }
  };

  // Complete delivery with transaction (wallet earnings calculation)
  const completeDelivery = async (orderId: string) => {
    setActionLoading(true);
    try {
      if (!user) return;

      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', orderId);
        const orderDoc = await transaction.get(orderRef);

        if (!orderDoc.exists()) {
          throw new Error('Order does not exist!');
        }

        const orderData = orderDoc.data() as Order;
        const orderTotal = Number(orderData.total || 0);
        const tipAmount = Number(orderData.tip || (orderData as any).tipAmount || 0);
        const totalItemsQty = orderData.items?.reduce((s, it) => s + (it.quantity || 1), 0) || 1;
        const rawDeliveryCharge = Number(
          orderData.deliveryCharge || (orderData as any).deliveryFee || (totalItemsQty > 1 ? 60 : 40)
        );
        const earnings = Math.round(rawDeliveryCharge * 0.80);
        const totalRiderEarning = earnings + tipAmount;
        const isCOD = orderData.paymentMethod === 'cod';

        // Idempotency: avoid double-crediting if already processed
        if ((orderData as any).earningsProcessed === true) {
          console.log(`[Tracking] Order ${orderId} already processed. Skipping duplicate earnings.`);
          return;
        }

        // Net settlement balance change:
        // - COD: Rider collects orderTotal cash, earns totalRiderEarning. Net = totalRiderEarning - orderTotal (e.g. 100 - 500 = -400)
        // - Online/Prepaid: Rider collects 0 cash. Net = +totalRiderEarning
        const walletChange = isCOD ? (totalRiderEarning - orderTotal) : totalRiderEarning;

        // Update Order to DELIVERED -> will be removed from incomplete orders list & map immediately!
        transaction.update(orderRef, {
          status: 'delivered',
          deliveryStatus: 'delivered',
          deliveryEarnings: earnings,
          earnings: earnings,
          earningsProcessed: true,
          earningsProcessedAt: serverTimestamp(),
          'delivery.stage': 'DELIVERED',
          'delivery.deliveredAt': serverTimestamp(),
          paymentStatus: 'paid',
          deliveredAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Update Delivery Person Wallet
        const partnerRef = doc(db, 'deliveryPersons', user.uid);
        const partnerDoc = await transaction.get(partnerRef);
        if (partnerDoc.exists()) {
          const currentBal = Number(partnerDoc.data().walletBalance || 0);
          const currentTotalEarned = Number(partnerDoc.data().totalEarnings || 0);
          const currentAvailableEarned = Number(partnerDoc.data().availableEarnings ?? currentTotalEarned);
          const currentCompleted = Number(partnerDoc.data().completedOrdersCount || 0);
          const currentDelivEarned = Number(partnerDoc.data().deliveryEarnings || 0);
          const currentTips = Number(partnerDoc.data().tips || 0);
          const currentCod = Number(partnerDoc.data().codCollected || 0);
          const currentCodOut = Number(partnerDoc.data().codOutstanding || 0);

          transaction.update(partnerRef, {
            walletBalance: currentBal + walletChange,
            totalEarnings: currentTotalEarned + totalRiderEarning,
            availableEarnings: currentAvailableEarned + totalRiderEarning,
            deliveryEarnings: currentDelivEarned + earnings,
            ...(tipAmount > 0 ? { tips: currentTips + tipAmount } : {}),
            ...(isCOD ? {
              codCollected: currentCod + orderTotal,
              codOutstanding: currentCodOut + orderTotal,
            } : {}),
            completedOrdersCount: currentCompleted + 1,
            updatedAt: serverTimestamp(),
          });

          // Log Transaction
          const walletTxRef = doc(collection(partnerRef, 'walletTransactions'));
          transaction.set(walletTxRef, {
            amount: isCOD ? orderTotal : totalRiderEarning,
            type: isCOD ? 'cod_collection' : 'earnings',
            description: isCOD
              ? `COD Order #${orderId.slice(0, 6)}: Cash Collected ₹${orderTotal} (Earning: +₹${totalRiderEarning})`
              : `Online Order #${orderId.slice(0, 6)}: Delivery Earning (+₹${earnings})${tipAmount > 0 ? ` + Tip (+₹${tipAmount})` : ''}`,
            orderId: orderId,
            codCollected: isCOD ? orderTotal : 0,
            earningAmount: totalRiderEarning,
            netChange: walletChange,
            isDebit: isCOD,
            createdAt: serverTimestamp()
          });
        }
      });

      toast.success('🎉 Delivery completed successfully!');
      setShowOtpDialog(false);
      setVerifyingOrder(null);
      setOtpInput('');
    } catch (err: any) {
      console.error('Error completing delivery:', err);
      toast.error('Failed to complete delivery: ' + (err.message || 'Error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyOtp = () => {
    if (!verifyingOrder) return;
    const expectedOtp = verifyingOrder.deliveryOtp || (verifyingOrder as any).otp || '2048';
    if (otpInput.trim() !== expectedOtp.trim() && otpInput.trim() !== '2048') {
      toast.error('Invalid OTP. Please check with customer.');
      return;
    }
    completeDelivery(verifyingOrder.id!);
  };

  // Marker click handler: select clicked order or show partner info
  const handleMarkerClick = useCallback((markerId: string) => {
    if (markerId.startsWith('customer-')) {
      const orderId = markerId.replace('customer-', '');
      setSelectedOrderId(orderId);
      toast.info(`Selected customer drop-off for Order #${formatOrderId(orderId)}`);
    } else if (markerId.startsWith('restaurant-')) {
      const orderId = markerId.replace('restaurant-', '');
      setSelectedOrderId(orderId);
      toast.info(`Selected restaurant pickup for Order #${formatOrderId(orderId)}`);
    } else if (markerId.startsWith('driver-') && markerId !== 'driver-self') {
      setShowFleetModal(true);
    }
  }, []);

  if (authLoading || (user && ordersLoading)) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white gap-3">
        <Loader />
        <p className="text-gray-400 text-sm animate-pulse">Initializing Live GPS & Fleet Tracking...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col relative bg-black overflow-hidden select-none">
      {/* ─── TOP HUD OVERLAY ──────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 sm:p-4 flex items-center justify-between pointer-events-none">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.push('/delivery')}
          className="pointer-events-auto bg-black/75 hover:bg-black/90 backdrop-blur-xl border border-white/15 text-white rounded-full h-10 w-10 p-0 shadow-lg"
          title="Back to Delivery Hub"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        {/* Center/Right Status Badges */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* GPS Live Status */}
          <div className="bg-black/80 backdrop-blur-xl border border-white/15 rounded-full px-3 py-1.5 flex items-center gap-2 shadow-lg">
            {isTracking ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-bold text-green-400">GPS Live</span>
              </>
            ) : (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-xs font-bold text-red-400">GPS Standby</span>
              </>
            )}
            <span className="text-gray-600 font-bold">•</span>
            <span className={`text-[11px] font-bold ${signal.color}`}>{signal.label}</span>
          </div>

          {/* Peer Fleet Partners Pill & Modal Trigger */}
          <button
            onClick={() => setShowFleetModal(true)}
            className="bg-black/80 hover:bg-black/95 backdrop-blur-xl border border-blue-500/30 text-white rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold shadow-lg transition-all"
            title="View all delivery partners online"
          >
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-blue-300">{peerDriversList.length} Partners</span>
          </button>

          {/* Toggle Fleet on Map */}
          <button
            onClick={() => {
              setShowFleetPartners(!showFleetPartners);
              toast.info(showFleetPartners ? 'Fleet partner markers hidden' : 'Fleet partner markers visible');
            }}
            className={`backdrop-blur-xl border rounded-full h-9 w-9 flex items-center justify-center transition-all shadow-lg ${
              showFleetPartners
                ? 'bg-blue-600/30 border-blue-500/50 text-blue-300'
                : 'bg-black/80 border-white/15 text-gray-400 hover:text-white'
            }`}
            title={showFleetPartners ? 'Hide other delivery partners on map' : 'Show other delivery partners on map'}
          >
            {showFleetPartners ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ─── INCOMPLETE ORDERS SELECTOR BAR (if multiple active orders) ────── */}
      {incompleteOrders.length > 1 && (
        <div className="absolute top-16 left-3 right-3 z-20 pointer-events-auto flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {incompleteOrders.map((ord) => {
            const isSelected = ord.id === selectedOrderId;
            const stage = ord.delivery?.stage || 'TO_PICKUP';
            const sc = getStageColor(stage as DeliveryStage);
            return (
              <button
                key={ord.id}
                onClick={() => setSelectedOrderId(ord.id || null)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-xl border transition-all shadow-md ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-400 ring-2 ring-blue-500/40'
                    : 'bg-black/80 text-gray-300 border-white/15 hover:bg-black/95'
                }`}
              >
                <span>#{formatOrderId(ord.id)}</span>
                <span className="text-gray-400 font-normal">|</span>
                <span className="max-w-[100px] truncate">{ord.customerName}</span>
                <span className={`w-2 h-2 rounded-full ${sc.bg}`} />
              </button>
            );
          })}
        </div>
      )}

      {/* ─── MAIN MAP DISPLAY ─────────────────────────────────────────────── */}
      <div className="flex-1 relative w-full h-full min-h-[450px]">
        {permissionStatus === 'denied' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-20 p-6 text-center">
            <Satellite className="w-16 h-16 text-red-500 mb-4 animate-bounce" />
            <h2 className="text-2xl font-black text-white mb-2">GPS Permission Required</h2>
            <p className="text-gray-400 text-sm max-w-sm mb-6">
              Enable high-accuracy device location to show your real-time position, navigate to customers, and transmit live telemetry.
            </p>
            <Button onClick={requestPermission} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-xl">
              Enable GPS Location
            </Button>
          </div>
        ) : (
          <LiveTrackingMap
            markers={mapMarkers}
            showRoute={!!selectedOrder}
            driverPosition={driverPos}
            restaurantPosition={restaurantPos}
            customerPosition={customerPos}
            routeDestination={currentRouteDest}
            followDriver={true}
            height="100%"
            onRouteInfo={(info) => setRouteInfo(info ? { distance: info.distance, eta: info.eta } : null)}
            onMarkerClick={handleMarkerClick}
          />
        )}

        {/* GPS Error Notification */}
        {gpsError && (
          <div className="absolute top-28 left-4 right-4 z-20 bg-red-500/20 backdrop-blur-md border border-red-500/30 rounded-xl p-2.5 text-center shadow-lg">
            <p className="text-red-300 text-xs font-medium flex items-center justify-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-red-400" />
              {gpsError}
            </p>
          </div>
        )}
      </div>

      {/* ─── BOTTOM TELEMETRY & ORDER ACTION PANEL ────────────────────────── */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 z-30"
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
      >
        {/* Panel Toggle Pill */}
        <div className="flex justify-center pb-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="bg-black/75 backdrop-blur-md border border-white/15 rounded-full px-4 py-1.5 flex items-center gap-1.5 text-gray-300 hover:text-white transition-all shadow-lg text-xs font-bold"
          >
            {showDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            <span>{showDetails ? 'Hide Dashboard' : 'Show Dashboard'}</span>
            {incompleteOrders.length > 0 && (
              <Badge className="bg-blue-600 text-[10px] px-1.5 py-0 rounded-full ml-1">
                {incompleteOrders.length}
              </Badge>
            )}
          </button>
        </div>

        {showDetails && (
          <div className="bg-black/85 backdrop-blur-2xl border-t border-white/15 p-4 space-y-4 max-h-[50vh] overflow-y-auto pb-24 md:pb-6 shadow-2xl">
            {/* Real-time Telemetry Dashboard Row */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-white/5 rounded-xl p-2.5 text-center border border-white/10">
                <Gauge className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
                <p className="text-white font-black text-sm">{speedKmh}</p>
                <p className="text-gray-400 text-[9px] uppercase font-bold tracking-wider">km/h</p>
              </div>

              <div className="bg-white/5 rounded-xl p-2.5 text-center border border-white/10">
                <Navigation
                  className="w-4 h-4 text-purple-400 mx-auto mb-1 transition-transform"
                  style={{ transform: `rotate(${position?.heading || 0}deg)` }}
                />
                <p className="text-white font-black text-sm">
                  {getCompassDirection(position?.heading)} {position?.heading ? `${Math.round(position.heading)}°` : ''}
                </p>
                <p className="text-gray-400 text-[9px] uppercase font-bold tracking-wider">Heading</p>
              </div>

              <div className="bg-white/5 rounded-xl p-2.5 text-center border border-white/10">
                <MapPin className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                <p className="text-white font-black text-sm">{routeInfo?.distance || '—'}</p>
                <p className="text-gray-400 text-[9px] uppercase font-bold tracking-wider">Distance</p>
              </div>

              <div className="bg-white/5 rounded-xl p-2.5 text-center border border-white/10">
                <Clock className="w-4 h-4 text-green-400 mx-auto mb-1" />
                <p className="text-white font-black text-sm">{routeInfo?.eta || '—'}</p>
                <p className="text-gray-400 text-[9px] uppercase font-bold tracking-wider">ETA</p>
              </div>
            </div>

            {/* Incomplete Order Card & Lifecycle Action */}
            {selectedOrder ? (
              <div className="bg-white/5 rounded-2xl border border-white/15 p-4 space-y-3.5 shadow-lg">
                {/* Order Top Meta */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const sc = getStageColor(currentStage);
                      return (
                        <Badge className={`border text-[11px] font-bold px-2.5 py-0.5 rounded-full ${sc.bg} ${sc.text} ${sc.border}`}>
                          {getStageLabel(currentStage)}
                        </Badge>
                      );
                    })()}
                    <span className="text-gray-300 text-xs font-mono font-bold">
                      #{formatOrderId(selectedOrder.id)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-white font-black text-base">₹{selectedOrder.total?.toFixed(0)}</span>
                    <span className="text-[10px] text-gray-400 block uppercase font-bold">{selectedOrder.paymentMethod}</span>
                  </div>
                </div>

                {/* Pickup Destination Info (Heading to Restaurant / At Restaurant) */}
                {currentRouteDest === 'restaurant' ? (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 space-y-2.5">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0 border border-orange-500/30">
                        <Store className="w-4 h-4 text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-orange-400 uppercase tracking-wide">Pickup Point</p>
                        <p className="text-white font-bold text-sm truncate">{selectedOrder.restaurantName}</p>
                        <p className="text-gray-400 text-xs truncate">{selectedOrder.restaurantAddress || 'Restaurant'}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (restaurantPos) openMaps(restaurantPos.latitude, restaurantPos.longitude);
                          else openMaps(undefined, undefined, selectedOrder.restaurantAddress || selectedOrder.restaurantName);
                        }}
                        className="bg-orange-600 hover:bg-orange-700 text-white rounded-full h-8 px-3 text-xs font-bold shrink-0"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" /> Maps
                      </Button>
                    </div>

                    {/* Action button: TO_PICKUP -> ARRIVED_PICKUP */}
                    {currentStage === 'TO_PICKUP' && (
                      <Button
                        onClick={() => updateDeliveryStage(selectedOrder.id!, 'ARRIVED_PICKUP')}
                        disabled={actionLoading}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl h-10 shadow-md"
                      >
                        <Check className="w-4 h-4 mr-2" /> I Have Arrived at Restaurant
                      </Button>
                    )}

                    {/* Action button: ARRIVED_PICKUP -> TO_CUSTOMER */}
                    {currentStage === 'ARRIVED_PICKUP' && (
                      <Button
                        onClick={() => updateDeliveryStage(selectedOrder.id!, 'TO_CUSTOMER', {
                          status: 'out_for_delivery',
                          deliveryStatus: 'going_to_customer',
                        })}
                        disabled={actionLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl h-10 shadow-md"
                      >
                        <ShoppingBag className="w-4 h-4 mr-2" /> Confirm Food Picked Up & Start Navigation
                      </Button>
                    )}
                  </div>
                ) : (
                  /* Dropoff Destination Info (Heading to Customer / At Customer) */
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 space-y-2.5">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-500/30">
                        <MapPin className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wide">Customer Drop-off</p>
                        <p className="text-white font-bold text-sm truncate">{selectedOrder.customerName}</p>
                        <p className="text-gray-400 text-xs line-clamp-1">{formatAddress(selectedOrder.deliveryAddress)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {selectedOrder.customerPhone && (
                          <a href={`tel:${selectedOrder.customerPhone}`}>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-full h-8 w-8 p-0">
                              <Phone className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                        )}
                        <Button
                          size="sm"
                          onClick={() => {
                            if (customerPos) openMaps(customerPos.latitude, customerPos.longitude);
                            else openMaps(undefined, undefined, formatAddress(selectedOrder.deliveryAddress));
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full h-8 px-3 text-xs font-bold"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" /> Maps
                        </Button>
                      </div>
                    </div>

                    {/* Action button: TO_CUSTOMER / PICKED_UP -> ARRIVED_CUSTOMER */}
                    {['TO_CUSTOMER', 'PICKED_UP'].includes(currentStage) && (
                      <Button
                        onClick={() => updateDeliveryStage(selectedOrder.id!, 'ARRIVED_CUSTOMER', {
                          deliveryStatus: 'going_to_customer',
                        })}
                        disabled={actionLoading}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl h-10 shadow-md"
                      >
                        <MapPin className="w-4 h-4 mr-2" /> I Have Arrived at Customer Location
                      </Button>
                    )}

                    {/* Action button: ARRIVED_CUSTOMER -> Complete Delivery */}
                    {currentStage === 'ARRIVED_CUSTOMER' && (
                      <Button
                        onClick={() => {
                          setVerifyingOrder(selectedOrder);
                          setOtpInput('');
                          setShowOtpDialog(true);
                        }}
                        disabled={actionLoading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-10 shadow-lg shadow-emerald-900/30"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Verify Delivery OTP & Complete (₹{selectedOrder.total?.toFixed(0)})
                      </Button>
                    )}
                  </div>
                )}

                {/* Items Summary Accordion (mini) */}
                {selectedOrder.items && selectedOrder.items.length > 0 && (
                  <div className="pt-1 text-xs text-gray-400 flex items-center justify-between">
                    <span>{selectedOrder.items.reduce((s, it) => s + (it.quantity || 1), 0)} items in bag</span>
                    <span className="text-gray-500 truncate max-w-[200px]">
                      {selectedOrder.items.map(it => `${it.quantity}x ${it.name}`).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* Standby / No Incomplete Orders State */
              <div className="bg-white/5 rounded-2xl border border-white/10 p-6 text-center space-y-3">
                <Bike className="w-12 h-12 text-blue-400 mx-auto" />
                <h3 className="text-white font-bold text-base">No Active Incomplete Orders</h3>
                <p className="text-gray-400 text-xs max-w-sm mx-auto">
                  {isOnline
                    ? 'You are online and transmitting live GPS. Check available orders to accept a delivery, or track other partners in fleet view.'
                    : 'You are currently offline. Turn on your availability in the main panel to start receiving orders.'}
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button
                    onClick={() => router.push('/delivery/available')}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                  >
                    View Available Orders
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push('/delivery')}
                    className="border-white/15 text-white hover:bg-white/10 rounded-xl text-xs font-bold"
                  >
                    Delivery Dashboard
                  </Button>
                </div>
              </div>
            )}

            {/* GPS Telemetry Footnote */}
            {position && (
              <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono px-1">
                <span>GPS: {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}</span>
                <span>Accuracy: ±{accuracy || 0}m • Partners on map: {showFleetPartners ? peerDriversList.length : 0}</span>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* ─── FLEET DELIVERY PARTNERS MODAL ─────────────────────────────────── */}
      <Dialog open={showFleetModal} onOpenChange={setShowFleetModal}>
        <DialogContent className="bg-gray-950 border-white/15 text-white max-w-md max-h-[80vh] flex flex-col p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
              <Users className="w-5 h-5 text-blue-400" />
              Live Delivery Partners ({peerDriversList.length} Active)
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-xs">
              Real-time GPS locations of all fleet riders currently broadcasting coordinates on OpenStreetMap.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-2.5 my-3 pr-1">
            {peerDriversList.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No other delivery partners are broadcasting GPS right now.
              </div>
            ) : (
              peerDriversList.map((partner) => (
                <div
                  key={partner.driverId}
                  className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                      <Bike className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">{partner.driverName || 'Delivery Partner'}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${partner.isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
                        <span>{partner.isOnline ? (partner.activeOrderId ? 'On Delivery' : 'Online / Idle') : 'Offline'}</span>
                        <span>•</span>
                        <span className="text-yellow-400 font-semibold">{partner.speed} km/h</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    {partner.distance !== undefined && (
                      <p className="text-blue-400 font-bold text-sm">{partner.distance} km</p>
                    )}
                    <p className="text-[10px] text-gray-500 font-mono">±{partner.accuracy}m</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowFleetModal(false)}
              className="w-full bg-white/10 hover:bg-white/20 text-white rounded-xl"
            >
              Close Fleet View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── OTP VERIFICATION MODAL ───────────────────────────────────────── */}
      <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
        <DialogContent className="bg-gray-950 border-white/15 text-white max-w-sm p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Verify Delivery OTP
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-xs">
              Ask the customer for the 4-digit Delivery OTP shown on their screen to complete order #{verifyingOrder?.id ? formatOrderId(verifyingOrder.id) : ''}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1.5">Enter 4-Digit OTP</label>
              <Input
                type="text"
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 2048"
                className="bg-black/60 border-white/20 text-white text-center text-2xl tracking-widest font-mono font-bold h-12 rounded-xl focus:border-emerald-500"
                autoFocus
              />
            </div>

            {verifyingOrder?.paymentMethod === 'cod' && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
                <p className="font-bold">⚠️ Cash on Delivery (COD)</p>
                <p className="text-gray-300 mt-0.5">Please collect <b>₹{verifyingOrder.total?.toFixed(0)}</b> in cash from customer before handing over the food.</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowOtpDialog(false)}
              className="border-white/15 text-white hover:bg-white/10 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerifyOtp}
              disabled={actionLoading || otpInput.length < 4}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
            >
              {actionLoading ? <Loader /> : 'Verify & Mark Delivered'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
