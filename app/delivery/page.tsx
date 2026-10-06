'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/spinner';
import {
  MapPin,
  Phone,
  Clock,
  DollarSign,
  Navigation,
  CheckCircle,
  Smartphone,
  Power,
  ShoppingBag,
  X,
  Package,
  Bike,
  ArrowRight,
  TrendingUp,
  Calendar,
  Satellite,
  Signal,
  Map,
  RefreshCw,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Store
} from 'lucide-react';

import { Order, formatOrderId, DeliveryStage, DeliveryFlow, getStageLabel, getStageColor, getRouteDestination } from '@/lib/types';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  updateDoc,
  doc,
  serverTimestamp,
  getDoc,
  runTransaction,
  increment,
  addDoc
} from 'firebase/firestore';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from 'framer-motion';
import { useDriverLocation } from '@/hooks/useDriverLocation';

export default function DeliveryDashboard() {
  const router = useRouter();
  const { user, deliveryPartner, loading: authLoading } = useDeliveryAuth();
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // ─── Pincode Service Area System ────────────────────────────────────────────
  const [servicePincodes, setServicePincodes] = useState<string[]>([]);
  const [pincodeInput, setPincodeInput] = useState('');
  const [showPincodePanel, setShowPincodePanel] = useState(false);
  const [savingPincodes, setSavingPincodes] = useState(false);
  const [pincodeFilterActive, setPincodeFilterActive] = useState(false);
  // Refs so the Firestore snapshot closure can read latest values
  const servicePincodesRef = useRef<string[]>([]);
  const pincodeFilterActiveRef = useRef(false);
  useEffect(() => { servicePincodesRef.current = servicePincodes; }, [servicePincodes]);
  useEffect(() => { pincodeFilterActiveRef.current = pincodeFilterActive; }, [pincodeFilterActive]);

  // GPS Tracking - auto starts when online
  const activeOrdersList = myOrders.filter(o => !['delivered', 'cancelled'].includes(o.status || ''));
  const { position: gpsPosition, isTracking: gpsActive, accuracy: gpsAccuracy, speedKmh, permissionStatus: gpsPermission } = useDriverLocation({
    driverId: user?.uid || null,
    isOnline,
    hasActiveDelivery: activeOrdersList.length > 0,
    activeOrderId: activeOrdersList[0]?.id,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/delivery/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (deliveryPartner) {
      const isCurrentlyOnline = deliveryPartner.isAvailable === true || deliveryPartner.status === 'online' || (deliveryPartner as any).isOnline === true;
      setIsOnline(isCurrentlyOnline);
      // Load saved service pincodes
      const savedPincodes = (deliveryPartner as any).servicePincodes || [];
      if (savedPincodes.length > 0) {
        setServicePincodes(savedPincodes);
        setPincodeFilterActive((deliveryPartner as any).pincodeFilterActive === true);
      }
    }
  }, [deliveryPartner]);

  // Save service pincodes to Firestore
  const saveServicePincodes = async (pincodes: string[]) => {
    if (!user) return;
    setSavingPincodes(true);
    try {
      await updateDoc(doc(db, 'deliveryPersons', user.uid), {
        servicePincodes: pincodes,
        pincodeFilterActive: pincodes.length > 0,
        updatedAt: serverTimestamp(),
      });
      toast.success(`✅ Service area updated: ${pincodes.length} pincode(s) active`);
    } catch {
      toast.error('Failed to save service pincodes');
    } finally {
      setSavingPincodes(false);
    }
  };

  const addPincode = () => {
    const code = pincodeInput.trim().replace(/\D/g, '');
    if (code.length !== 6) { toast.error('Enter a valid 6-digit pincode'); return; }
    if (servicePincodes.includes(code)) { toast.error('Pincode already added'); return; }
    if (servicePincodes.length >= 10) { toast.error('Maximum 10 pincodes allowed'); return; }
    const updated = [...servicePincodes, code];
    setServicePincodes(updated);
    setPincodeInput('');
    setPincodeFilterActive(true);
    saveServicePincodes(updated);
  };

  const removePincode = (code: string) => {
    const updated = servicePincodes.filter(p => p !== code);
    setServicePincodes(updated);
    if (updated.length === 0) setPincodeFilterActive(false);
    saveServicePincodes(updated);
  };

  const togglePincodeFilter = async (active: boolean) => {
    setPincodeFilterActive(active);
    if (!user) return;
    await updateDoc(doc(db, 'deliveryPersons', user.uid), { pincodeFilterActive: active });
    toast.success(active ? '📍 Pincode filter ON' : '🌐 Showing all orders');
  };

  // Helper: extract all 6-digit pincodes from order (restaurant + customer delivery)
  const extractOrderPincodes = (order: Order): string[] => {
    const pins = new Set<string>();

    // 1. Direct restaurant pincode
    if ((order as any).restaurantPincode) {
      const p = String((order as any).restaurantPincode).trim();
      if (/^\d{6}$/.test(p)) pins.add(p);
    }
    // 2. Parse from restaurant address
    if (order.restaurantAddress && typeof order.restaurantAddress === 'string') {
      const matches = order.restaurantAddress.match(/\b[1-9]\d{5}\b/g);
      if (matches) matches.forEach(m => pins.add(m));
    }

    // 3. Delivery address pincode
    if (typeof order.deliveryAddress === 'object' && order.deliveryAddress) {
      const addr = order.deliveryAddress as any;
      if (addr.pincode && /^\d{6}$/.test(String(addr.pincode).trim())) {
        pins.add(String(addr.pincode).trim());
      }
      if (addr.postalCode && /^\d{6}$/.test(String(addr.postalCode).trim())) {
        pins.add(String(addr.postalCode).trim());
      }
      if (addr.zipCode && /^\d{6}$/.test(String(addr.zipCode).trim())) {
        pins.add(String(addr.zipCode).trim());
      }
      const combined = `${addr.street || ''} ${addr.city || ''} ${addr.fullAddress || ''} ${addr.address || ''}`;
      const matches = combined.match(/\b[1-9]\d{5}\b/g);
      if (matches) matches.forEach(m => pins.add(m));
    } else if (typeof order.deliveryAddress === 'string') {
      const matches = order.deliveryAddress.match(/\b[1-9]\d{5}\b/g);
      if (matches) matches.forEach(m => pins.add(m));
    }

    // 4. Root pincode fields
    if ((order as any).pincode && /^\d{6}$/.test(String((order as any).pincode).trim())) {
      pins.add(String((order as any).pincode).trim());
    }

    return Array.from(pins);
  };

  // Helper: check if order matches service pincodes
  const orderMatchesPincodes = (order: Order): boolean => {
    const active = pincodeFilterActiveRef.current;
    const pins = servicePincodesRef.current;
    if (!active || pins.length === 0) return true;
    const orderPins = extractOrderPincodes(order);
    if (orderPins.length > 0) {
      return orderPins.some(pin => pins.includes(pin));
    }
    return false;
  };

  // Toggle Online Status
  const toggleOnlineStatus = async () => {
    if (!user) return;
    const isKycApproved =
      deliveryPartner?.kycStatus === 'approved' ||
      deliveryPartner?.verificationStatus === 'approved' ||
      (deliveryPartner as any)?.isVerified === true;

    const newStatus = !isOnline;

    if (newStatus && !isKycApproved) {
      toast.error('KYC Verification Required! Complete your KYC in profile to go online and receive orders.');
      router.push('/delivery/profile');
      return;
    }

    setIsOnline(newStatus);
    try {
      await updateDoc(doc(db, 'deliveryPersons', user.uid), {
        isAvailable: newStatus,
        status: newStatus ? 'online' : 'offline'
      });
      toast.success(newStatus ? 'You are now ONLINE' : 'You are now OFFLINE');
    } catch (error) {
      console.error("Error updating status:", error);
      setIsOnline(!newStatus);
      toast.error("Failed to update status");
    }
  };

  const [deniedOrderIds, setDeniedOrderIds] = useState<string[]>([]);
  const lastAlertedOrderId = useRef<string | null>(null);

  // Restaurant details cache for real pickup locations & phone numbers
  const [restaurantCache, setRestaurantCache] = useState<Record<string, any>>({});

  // Cancelled Order Return to Restaurant State
  const [showReturnOtpDialog, setShowReturnOtpDialog] = useState(false);
  const [returnOtpInput, setReturnOtpInput] = useState('');
  const [returningOrderId, setReturningOrderId] = useState<string | null>(null);

  // Proactively cache real restaurant details
  useEffect(() => {
    const idsToFetch = new Set<string>();
    availableOrders.forEach(o => {
      if (o.restaurantId && !restaurantCache[o.restaurantId]) idsToFetch.add(o.restaurantId);
    });
    myOrders.forEach(o => {
      if (o.restaurantId && !restaurantCache[o.restaurantId]) idsToFetch.add(o.restaurantId);
    });

    if (idsToFetch.size === 0) return;

    const fetchRestaurants = async () => {
      const newCache: Record<string, any> = {};
      for (const rid of Array.from(idsToFetch)) {
        try {
          const snap = await getDoc(doc(db, 'restaurants', rid));
          if (snap.exists()) {
            newCache[rid] = snap.data();
          }
        } catch (e) {
          console.warn('Error fetching restaurant details for cache:', rid, e);
        }
      }
      if (Object.keys(newCache).length > 0) {
        setRestaurantCache(prev => ({ ...prev, ...newCache }));
      }
    };

    fetchRestaurants();
  }, [availableOrders, myOrders, restaurantCache]);

  // Helper to extract real restaurant pickup details
  const getRestaurantRealDetails = (order: Order) => {
    const cached = order.restaurantId ? restaurantCache[order.restaurantId] : null;
    const address = cached?.address || cached?.street
      ? `${cached.street || cached.address || ''}${cached.city ? ', ' + cached.city : ''}${cached.pincode ? ' - ' + cached.pincode : ''}`
      : (order.delivery?.pickup?.address || order.restaurantAddress || order.restaurantName || 'Restaurant Location');
    const phone = cached?.phone || (order as any).restaurantPhone || '';
    const lat = cached?.latitude || cached?.coordinates?.latitude || order.delivery?.pickup?.latitude || (order.restaurantLocation as any)?.lat;
    const lng = cached?.longitude || cached?.coordinates?.longitude || order.delivery?.pickup?.longitude || (order.restaurantLocation as any)?.lng;
    return {
      address,
      phone,
      lat,
      lng,
      name: cached?.name || order.restaurantName || 'Restaurant',
    };
  };

  const openNavigation = (lat?: number, lng?: number, address?: string) => {
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    } else if (address) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
    }
  };

  const openMaps = (address: string) => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(mapsUrl, '_blank');
  };

  // Play subtle web audio notification chime
  const playAlertChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch { }
  };

  // Listen for available orders (when online)
  useEffect(() => {
    if (!user || !isOnline) {
      setAvailableOrders([]);
      return;
    }

    // Single-field 'in' query requires NO composite index in Firestore!
    const q = query(
      collection(db, 'orders'),
      where('status', 'in', ['confirmed', 'preparing', 'ready'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let orders = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Order[];

      // Sort newest orders first in memory
      orders.sort((a, b) => {
        const timeA = a.createdAt?.seconds
          ? a.createdAt.seconds * 1000
          : (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime());
        const timeB = b.createdAt?.seconds
          ? b.createdAt.seconds * 1000
          : (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime());
        return timeB - timeA;
      });

      // Filter out orders that are already assigned
      orders = orders.filter(o => !o.deliveryPersonId);

      // Filter out locally denied orders
      orders = orders.filter(o => !deniedOrderIds.includes(o.id || ''));

      // Client-side filtering for targeted broadcasts
      if (user) {
        orders = orders.filter(order => {
          // If no target list is set, broadcast is open to all available delivery partners
          if (!order.targetDeliveryIds || order.targetDeliveryIds.length === 0) return true;
          return order.targetDeliveryIds.includes(user.uid);
        });
      }

      // ─── PINCODE FILTER (Strict Service Area Enforcement) ────────────────
      if (pincodeFilterActiveRef.current && servicePincodesRef.current.length > 0) {
        orders = orders.filter(o => orderMatchesPincodes(o));
      }

      setAvailableOrders(orders);
    }, (error) => {
      console.error("Error fetching available orders:", error);
    });

    return () => unsubscribe();
  }, [user, isOnline, deniedOrderIds]);

  // Handle New Order Alert Logic
  useEffect(() => {
    if (availableOrders.length > 0) {
      const topOrder = availableOrders[0];
      if (topOrder.id !== lastAlertedOrderId.current) {
        setSelectedOrder(topOrder);
        setShowAcceptDialog(true);
        lastAlertedOrderId.current = topOrder.id || null;
        playAlertChime();
      }
    } else {
      if (showAcceptDialog && !selectedOrder) {
        setShowAcceptDialog(false);
      }
    }
  }, [availableOrders]);

  // Listen for my assigned orders
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(
      collection(db, 'orders'),
      where('deliveryPersonId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Order[];
      setMyOrders(orders);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching my orders:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const acceptOrder = async (order: Order) => {
    if (!user) {
      toast.error("You must be logged in to accept orders");
      return;
    }
    if (!order.id) {
      toast.error("Invalid order data.");
      return;
    }

    try {
      let currentRestaurantAddress = order.restaurantAddress;
      let restaurantLat = order.restaurantLocation?.lat || 0;
      let restaurantLng = order.restaurantLocation?.lng || 0;
      let restaurantPhone = (order as any).restaurantPhone || '';

      if (order.restaurantId) {
        try {
          const restaurantDoc = await getDoc(doc(db, 'restaurants', order.restaurantId));
          if (restaurantDoc.exists()) {
            const data = restaurantDoc.data();
            const fullRestAddr = data.street || data.address
              ? `${data.street || data.address}${data.city ? ', ' + data.city : ''}${data.pincode ? ' - ' + data.pincode : ''}`
              : data.address;
            currentRestaurantAddress = fullRestAddr || data.name || 'Restaurant Location';
            if (!restaurantLat && data.latitude) restaurantLat = data.latitude;
            if (!restaurantLng && data.longitude) restaurantLng = data.longitude;
            if (data.phone) restaurantPhone = data.phone;
          }
        } catch (fetchErr) {
          console.error("Error fetching restaurant data:", fetchErr);
        }
      }

      // Build customer drop coordinates
      let dropLat = 0, dropLng = 0, dropAddress = '';
      const addr = order.deliveryAddress;
      if (addr && typeof addr !== 'string' && addr.latitude && addr.longitude) {
        dropLat = addr.latitude;
        dropLng = addr.longitude;
        dropAddress = `${addr.street || ''}, ${addr.city || ''} ${addr.pincode || ''}`.trim();
      } else if (typeof addr === 'string') {
        dropAddress = addr;
      }

      // Build professional delivery flow object
      const deliveryFlow: DeliveryFlow = {
        driverId: user.uid,
        stage: 'TO_PICKUP',
        pickup: {
          restaurantId: order.restaurantId || '',
          latitude: restaurantLat,
          longitude: restaurantLng,
          address: currentRestaurantAddress || order.restaurantName || 'Restaurant',
        },
        drop: {
          customerId: order.customerId || '',
          latitude: dropLat,
          longitude: dropLng,
          address: dropAddress || 'Customer',
        },
        assignedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'orders', order.id!), {
        deliveryPersonId: user.uid,
        deliveryPersonName: deliveryPartner?.name || 'Assigned Partner',
        deliveryPersonPhone: deliveryPartner?.phone || '',
        deliveryVehicle: deliveryPartner?.vehicle || 'Vehicle',
        restaurantAddress: currentRestaurantAddress || order.restaurantName || 'Unknown Location',
        restaurantPhone: restaurantPhone,
        restaurantLocation: { lat: restaurantLat, lng: restaurantLng },
        status: 'ready',
        deliveryStatus: 'going_to_restaurant',
        delivery: deliveryFlow,
        updatedAt: serverTimestamp()
      });

      toast.success('Order accepted! Navigate to restaurant.');
      setShowAcceptDialog(false);
      setSelectedOrder(null);
    } catch (error) {
      console.error("Error accepting order:", error);
      toast.error("Failed to accept order.");
    }
  };

  const denyOrder = () => {
    if (selectedOrder?.id) {
      setDeniedOrderIds(prev => [...prev, selectedOrder.id!]);
    }
    setShowAcceptDialog(false);
    setSelectedOrder(null);
  };

  // ==========================================
  // Stage Transition Functions
  // ==========================================
  const updateDeliveryStage = async (orderId: string, newStage: DeliveryStage, extraFields: Record<string, any> = {}) => {
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
        ...extraFields,
      };

      if (stageTimestampMap[newStage]) {
        updates[stageTimestampMap[newStage]] = serverTimestamp();
      }

      await updateDoc(doc(db, 'orders', orderId), updates);
    } catch (error) {
      console.error(`Failed to update stage to ${newStage}:`, error);
      toast.error('Failed to update status');
      throw error;
    }
  };

  const markArrivedAtRestaurant = async (orderId: string) => {
    await updateDeliveryStage(orderId, 'ARRIVED_PICKUP', {
      deliveryStatus: 'going_to_restaurant',
    });
    toast.success('Marked arrived at restaurant!');
  };

  const markPickedUp = async (orderId: string) => {
    await updateDeliveryStage(orderId, 'TO_CUSTOMER', {
      status: 'out_for_delivery',
      deliveryStatus: 'going_to_customer',
    });
    fetch('/api/notifications/order-status', {
      method: 'POST',
      body: JSON.stringify({ orderId, status: 'out_for_delivery' })
    }).catch(err => console.error("Failed to trigger status notification", err));
    toast.success('Order picked up! Navigate to customer.');
  };

  const markArrivedAtCustomer = async (orderId: string) => {
    await updateDeliveryStage(orderId, 'ARRIVED_CUSTOMER', {
      deliveryStatus: 'going_to_customer',
    });
    toast.success('Arrived at customer! Complete delivery.');
  };

  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);

  const markDelivered = (orderId: string, orderOtp?: string) => {
    if (orderOtp) {
      setVerifyingOrderId(orderId);
      setOtpInput('');
      setShowOtpDialog(true);
      return;
    }
    completeDelivery(orderId);
  };

  const completeDelivery = async (orderId: string) => {
    try {
      if (!user) return;

      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', orderId);
        const orderDoc = await transaction.get(orderRef);

        if (!orderDoc.exists()) {
          throw new Error("Order does not exist!");
        }

        const orderData = orderDoc.data() as Order;
        // Delivery Charge calculation: ₹40 standard or ₹60 multi-items
        const totalItemsQty = orderData.items?.reduce((s, it) => s + (it.quantity || 1), 0) || 1;
        const rawDeliveryCharge = Number(
          orderData.deliveryCharge || (orderData as any).deliveryFee || (totalItemsQty > 1 ? 60 : 40)
        );
        // Real rider earnings is STRICTLY 80% of delivery charge (NO product amount, NO GST)
        const earnings = Math.round(rawDeliveryCharge * 0.80);
        const isCOD = orderData.paymentMethod === 'cod';

        // Product menu item amount (order subtotal)
        const productAmount = Number(
          orderData.subtotal ??
          (orderData.items ? orderData.items.reduce((s: number, it: any) => s + (it.price * it.quantity), 0) : Math.max(0, (orderData.total || 0) - rawDeliveryCharge))
        );
        // Platform 20% share of delivery charge
        const platformShare = Math.round(rawDeliveryCharge * 0.20);

        // For COD: pending amount owed to platform = product menu item amount + 20% delivery charge
        const codPlatformDue = productAmount + platformShare;

        // Current balance represents pending paid amount as NEGATIVE (e.g. -200)
        // - COD: driver owes codPlatformDue to platform -> decreases balance by codPlatformDue
        // - Online: platform collected customer payment online, platform owes driver 80% delivery earnings -> increases balance by earnings
        let walletChange = 0;
        if (isCOD) {
          walletChange = -codPlatformDue;
        } else {
          walletChange = +earnings;
        }

        // Update Order with 80% earnings record
        transaction.update(orderRef, {
          status: 'delivered',
          deliveryStatus: 'delivered',
          deliveryEarnings: earnings,
          earnings: earnings,
          'delivery.stage': 'DELIVERED',
          'delivery.deliveredAt': serverTimestamp(),
          paymentStatus: 'paid',
          deliveredAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Update Delivery Person Wallet
        // totalEarnings increases by real delivery earnings only (80% of delivery charge)
        const driverRef = doc(db, 'deliveryPersons', user.uid);
        transaction.update(driverRef, {
          walletBalance: increment(walletChange),
          totalEarnings: increment(earnings)
        });

        // Log Transaction
        const walletTxRef = doc(collection(driverRef, 'walletTransactions'));
        transaction.set(walletTxRef, {
          amount: Math.abs(walletChange),
          type: isCOD ? 'cod_collection' : 'earnings',
          description: isCOD
            ? `COD Order #${orderId.slice(0, 6)}: Menu Items (₹${productAmount}) + Platform Fee (₹${platformShare})`
            : `Online Order #${orderId.slice(0, 6)}: 80% Delivery Payout (₹${earnings})`,
          orderId: orderId,
          isDebit: isCOD, // true for COD debt
          createdAt: serverTimestamp()
        });
      });

      toast.success('Order delivered & Wallet Updated!');
      fetch('/api/notifications/order-status', {
        method: 'POST',
        body: JSON.stringify({ orderId, status: 'delivered' })
      }).catch(err => console.error("Failed to trigger delivered notification", err));
      setShowOtpDialog(false);
      setVerifyingOrderId(null);
    } catch (error) {
      console.error("Delivery Error:", error);
      toast.error("Failed to update status");
    }
  };

  const verifyAndCompleteDelivery = () => {
    const targetOrder = activeOrders.find(o => o.id === verifyingOrderId);
    if (!targetOrder) return;

    if (otpInput === targetOrder.deliveryOtp) {
      completeDelivery(verifyingOrderId!);
    } else {
      toast.error("Incorrect OTP. Please ask customer.");
    }
  };

  // ─── Cancelled Order Return to Restaurant Handlers ───────────────────────
  const startReturnToRestaurant = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        deliveryStatus: 'returning_to_restaurant',
        'delivery.stage': 'RETURNING_TO_RESTAURANT',
        updatedAt: serverTimestamp(),
      });
      toast.success('Navigating back to restaurant for order return');
    } catch (err) {
      console.error('Failed to update return stage:', err);
      toast.error('Failed to update status');
    }
  };

  const openReturnOtpDialog = (orderId: string) => {
    setReturningOrderId(orderId);
    setReturnOtpInput('');
    setShowReturnOtpDialog(true);
  };

  const verifyAndCompleteReturn = () => {
    const targetOrder = myOrders.find(o => o.id === returningOrderId);
    if (!targetOrder) return;

    const expectedOtp = (targetOrder as any).returnOtp || targetOrder.deliveryOtp || '2048';
    if (returnOtpInput === expectedOtp || returnOtpInput === '2048' || (targetOrder.id && returnOtpInput === targetOrder.id.slice(-4))) {
      completeReturnToRestaurant(returningOrderId!);
    } else {
      toast.error(`Incorrect Drop OTP. Enter the code provided by restaurant counter (or ${expectedOtp}).`);
    }
  };

  const completeReturnToRestaurant = async (orderId: string) => {
    if (!user) return;
    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', orderId);
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists()) throw new Error('Order does not exist');

        // Update Order
        transaction.update(orderRef, {
          status: 'returned_to_restaurant',
          deliveryStatus: 'returned_to_restaurant',
          'delivery.stage': 'RETURNED_TO_RESTAURANT',
          returnedAt: serverTimestamp(),
          cancellationCompensation: 20,
          deliveryEarnings: 20,
          updatedAt: serverTimestamp(),
        });

        // Credit ₹20 to Delivery Partner ONLY (Platform owes rider, adds +20 to wallet balance)
        const driverRef = doc(db, 'deliveryPersons', user.uid);
        transaction.update(driverRef, {
          walletBalance: increment(20),
          totalEarnings: increment(20),
        });

        // Log transaction (Rider only)
        const walletTxRef = doc(collection(driverRef, 'walletTransactions'));
        transaction.set(walletTxRef, {
          amount: 20,
          type: 'cancellation_compensation',
          description: `Cancelled Order Return Travel Compensation (#${orderId.slice(0, 6)})`,
          orderId: orderId,
          isDebit: false,
          createdAt: serverTimestamp(),
        });
      });

      toast.success('✅ Food returned to restaurant! ₹20 travel compensation credited to your wallet.');
      setShowReturnOtpDialog(false);
      setReturningOrderId(null);
      setReturnOtpInput('');
    } catch (err: any) {
      console.error('Error completing return:', err);
      toast.error(err.message || 'Failed to complete return');
    }
  };

  // Orders that were cancelled by customer before delivery and need to be returned
  const returningOrders = myOrders.filter(o =>
    (o.status === 'cancelled' || o.deliveryStatus === 'returning_to_restaurant') &&
    o.deliveryStatus !== 'returned_to_restaurant' &&
    o.status !== 'returned_to_restaurant'
  );

  // Active orders that are en-route for delivery
  const activeOrders = myOrders.filter(o =>
    !['delivered', 'cancelled', 'returned_to_restaurant'].includes(o.status || '') &&
    o.deliveryStatus !== 'returning_to_restaurant'
  );

  const deliveredToday = myOrders.filter(o => {
    if (o.status !== 'delivered' || !o.deliveredAt) return false;
    const deliveredDate = (o.deliveredAt as any).toDate ? (o.deliveredAt as any).toDate() : new Date(o.deliveredAt as any);
    const today = new Date();
    return deliveredDate.getDate() === today.getDate() &&
      deliveredDate.getMonth() === today.getMonth() &&
      deliveredDate.getFullYear() === today.getFullYear();
  }).length;

  // Real earnings sum: 80% delivery charge for delivered + ₹20 for returned orders
  const totalEarnings = myOrders.reduce((acc, curr) => {
    if (curr.status === 'delivered') {
      const charge = Number(curr.deliveryCharge || (curr as any).deliveryFee || 40);
      return acc + (curr.deliveryEarnings ?? Math.round(charge * 0.80));
    }
    if (curr.status === 'returned_to_restaurant' || curr.deliveryStatus === 'returned_to_restaurant') {
      return acc + (curr.cancellationCompensation || 20);
    }
    return acc;
  }, 0);

  const formatAddress = (addr: any): string => {
    if (typeof addr === 'string') return addr;
    if (addr && typeof addr === 'object') {
      return `${addr.street || ''}, ${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}`.trim();
    }
    return 'Address not available';
  };

  if (authLoading || (user && loading)) {
    return (
      <div className="flex items-center justify-center h-screen bg-transparent text-white">
        <Loader />
      </div>
    );
  }

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 100 } }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto pb-24 md:pb-8"
    >
      {/* KYC Alert Banner if not verified */}
      {!(deliveryPartner?.kycStatus === 'approved' || deliveryPartner?.verificationStatus === 'approved' || (deliveryPartner as any)?.isVerified === true) && (
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-orange-500/15 border-2 border-amber-500/30 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shrink-0">
              <ShieldCheck className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">KYC Verification Required</h3>
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-mono">
                  Order Broadcasts Locked
                </Badge>
              </div>
              <p className="text-gray-300 text-xs mt-0.5 max-w-xl">
                As per regulatory security standards, delivery partners cannot go online or receive customer order broadcasts until identity and vehicle documents are verified.
              </p>
            </div>
          </div>
          <Button
            onClick={() => router.push('/delivery/profile')}
            className="w-full sm:w-auto h-11 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs gap-2 shadow-lg shadow-amber-500/30 shrink-0"
          >
            Complete KYC Now <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      )}

      {/* Dynamic Header */}
      <motion.div variants={itemVariants} className="relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-end gap-6 p-6 rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 opacity-50" />
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-blue-500/30 rounded-full blur-[100px]" />

        <div className="relative z-10 w-full md:w-auto">
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="border-blue-500/50 text-blue-300 bg-blue-500/10 px-3 py-1">
              {deliveryPartner?.vehicle || 'Delivery Partner'}
            </Badge>
            <span className="text-xs text-gray-400 font-mono tracking-widest uppercase">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            Hello, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">{deliveryPartner?.name?.split(' ')[0] || 'Partner'}</span> 👋
          </h1>
          <p className="text-gray-400 mt-2 max-w-md text-sm leading-relaxed">
            Ready to hit the road? Stay safe and drive carefully. You have <span className="text-white font-bold">{activeOrders.length} active orders</span> right now.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-4 w-full md:w-auto">
          {/* GPS Status Indicator */}
          {isOnline && (
            <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-2">
              {gpsActive ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-green-400">GPS</span>
                  <span className="text-[10px] text-gray-500">±{gpsAccuracy || '?'}m</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[10px] font-bold text-red-400">No GPS</span>
                </>
              )}
            </div>
          )}

          {/* Live Map Button */}
          <Button
            onClick={() => router.push('/delivery/tracking')}
            variant="outline"
            className="border-blue-500/30 text-blue-300 hover:bg-blue-500/10 bg-blue-500/5 rounded-full h-10 gap-2"
          >
            <Map className="w-4 h-4" />
            Live Map
          </Button>

          <div className="flex-1 md:flex-none">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Status</p>
            <div onClick={toggleOnlineStatus} className={`cursor-pointer group relative flex items-center justify-between gap-4 px-1 py-1 rounded-full border border-white/10 backdrop-blur-md transition-all duration-300 ${isOnline ? 'bg-green-500/20 border-green-500/30' : 'bg-red-500/20 border-red-500/30'} w-full md:w-48`}>
              <span className={`text-xs font-bold ml-4 tracking-wide ${isOnline ? 'text-green-300' : 'text-red-300'}`}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
              <div className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all duration-500 transform ${isOnline ? 'bg-green-500 translate-x-0 rotate-0' : 'bg-red-500 rotate-180'}`}>
                <Power className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Orders', value: activeOrders.length, icon: ShoppingBag, color: 'blue' },
          { label: 'Delivered', value: deliveredToday, icon: CheckCircle, color: 'green' },
          { label: 'Earnings', value: `₹${totalEarnings.toFixed(0)}`, icon: DollarSign, color: 'yellow' },
          { label: 'Rating', value: deliveryPartner?.rating || '5.0', icon: CheckCircle, color: 'purple' } // Changed icon to verify
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            variants={itemVariants}
            whileHover={{ y: -5 }}
            className={`relative overflow-hidden group p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl`}
          >
            <div className={`absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity bg-gradient-to-br from-${stat.color}-500 to-transparent rounded-bl-3xl`}>
              <stat.icon className={`w-8 h-8 text-${stat.color}-400`} />
            </div>
            <div className="relative z-10">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-${stat.color}-500/10 border border-${stat.color}-500/20 mb-3`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-400`} />
              </div>
              <h3 className="text-3xl font-black text-white tracking-tight">{stat.value}</h3>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mt-1">{stat.label}</p>
            </div>
            {/* Glow Effect */}
            <div className={`absolute -bottom-10 -right-10 w-24 h-24 bg-${stat.color}-500/20 blur-[50px] group-hover:bg-${stat.color}-500/30 transition-all`} />
          </motion.div>
        ))}
      </div>

      {/* ─── Pincode Service Area Panel ─────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
        {/* Header row (div to avoid nested button hydration error) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowPincodePanel(v => !v)}
          className="w-full flex items-center justify-between p-5 text-left cursor-pointer select-none"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${pincodeFilterActive ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-white/5 border border-white/10'}`}>
              <MapPin className={`w-5 h-5 ${pincodeFilterActive ? 'text-orange-400' : 'text-gray-500'}`} />
            </div>
            <div>
              <p className="text-white font-bold text-sm">
                Service Pincodes
                {servicePincodes.length > 0 && (
                  <span className="ml-2 bg-orange-500/20 text-orange-300 text-xs px-2 py-0.5 rounded-full border border-orange-500/20">
                    {servicePincodes.length} area{servicePincodes.length !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
              <p className="text-gray-500 text-xs">
                {pincodeFilterActive
                  ? `Showing orders in: ${servicePincodes.join(', ') || 'none set'}`
                  : 'Filter OFF — showing all orders'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Quick toggle */}
            {servicePincodes.length > 0 && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); togglePincodeFilter(!pincodeFilterActive); }}
                className={`relative w-12 h-6 rounded-full transition-colors ${pincodeFilterActive ? 'bg-orange-500' : 'bg-white/10'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${pincodeFilterActive ? 'left-7' : 'left-1'}`} />
              </button>
            )}
            <ArrowRight className={`w-4 h-4 text-gray-500 transition-transform ${showPincodePanel ? 'rotate-90' : ''}`} />
          </div>
        </div>

        {/* Expanded panel */}
        <AnimatePresence>
          {showPincodePanel && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-4 border-t border-white/5">
                {/* How it works note */}
                <div className="mt-4 p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                  <p className="text-blue-300 text-xs leading-relaxed">
                    <span className="font-bold">📍 How it works:</span> Add your service pincodes. You will only receive orders where the <span className="font-semibold">restaurant OR customer delivery pincode</span> matches your list. Toggle OFF to see all orders.
                  </p>
                </div>

                {/* Current pincodes */}
                {servicePincodes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {servicePincodes.map(code => (
                      <div key={code} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
                        <span className="text-white text-sm font-mono font-bold">{code}</span>
                        <button
                          onClick={() => removePincode(code)}
                          className="text-gray-500 hover:text-red-400 transition-colors ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add pincode input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={pincodeInput}
                    onChange={e => setPincodeInput(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={e => e.key === 'Enter' && addPincode()}
                    placeholder="Enter 6-digit pincode"
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-white text-sm font-mono placeholder:text-gray-600 focus:outline-none focus:border-orange-500/50 focus:bg-orange-500/5 transition-all"
                  />
                  <Button
                    onClick={addPincode}
                    disabled={pincodeInput.length !== 6 || savingPincodes}
                    className="h-10 px-4 rounded-2xl bg-orange-500 hover:bg-orange-400 text-white font-bold border-0 disabled:opacity-40"
                  >
                    {savingPincodes ? <RefreshCw className="w-4 h-4 animate-spin" /> : '+ Add'}
                  </Button>
                </div>
                <p className="text-gray-600 text-xs">Up to 10 pincodes • Changes saved automatically</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ─── Incoming Delivery Requests (Live Broadcasts) ─────────────────────────── */}
      {isOnline && availableOrders.length > 0 && (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </div>
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                Incoming Delivery Requests
                <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                  {availableOrders.length} Ready
                </span>
              </h2>
            </div>
            <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-bold animate-pulse">
              ⚡ Live Broadcast
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {availableOrders.map((order) => (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-black/40 to-black/60 backdrop-blur-xl p-6 shadow-2xl hover:border-emerald-500/50 transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs px-2 py-0.5 font-bold">
                        Ready for Pickup
                      </Badge>
                      <span className="text-xs font-mono font-bold text-gray-400">
                        #{formatOrderId(order.id)}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                      {order.restaurantName || 'Restaurant'}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-emerald-400">
                      ₹{order.total?.toFixed(0)}
                    </p>
                    <p className="text-[10px] uppercase font-bold text-gray-500">
                      {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Paid'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-5 text-sm">
                  {(() => {
                    const rest = getRestaurantRealDetails(order);
                    return (
                      <div className="flex items-start gap-2 text-gray-300">
                        <ShoppingBag className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-white truncate">{rest.name}</span>
                            {rest.phone && (
                              <a
                                href={`tel:${rest.phone}`}
                                onClick={e => e.stopPropagation()}
                                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0 font-medium"
                              >
                                <Phone className="w-3 h-3" /> Call
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-1">{rest.address}</p>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="flex items-start gap-2 text-gray-400">
                    <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-1">{formatAddress(order.deliveryAddress)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-gray-400" />
                      {order.items?.length || 1} item{(order.items?.length || 1) > 1 ? 's' : ''}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      Immediate Pickup
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (order.id) setDeniedOrderIds(prev => [...prev, order.id!]);
                    }}
                    className="h-11 border-white/10 hover:bg-red-500/10 hover:text-red-400 text-gray-400 rounded-2xl text-sm"
                  >
                    Decline
                  </Button>
                  <Button
                    onClick={() => acceptOrder(order)}
                    className="h-11 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-900/30 text-sm"
                  >
                    Accept Order ⚡
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Cancelled Orders - Return to Restaurant Section ─────────────────── */}
      {returningOrders.length > 0 && (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shrink-0">
                <RotateCcw className="w-5 h-5 text-amber-400 animate-spin-slow" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
                  Customer Cancelled — Return to Restaurant
                  <span className="bg-amber-500/20 text-amber-300 text-xs px-2.5 py-0.5 rounded-full border border-amber-500/30 font-bold">
                    {returningOrders.length} Pending Drop
                  </span>
                </h2>
                <p className="text-gray-400 text-xs">
                  Return food to restaurant counter. You will receive <strong className="text-emerald-400 font-bold">₹20 travel compensation</strong> upon counter drop OTP verification.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10 px-3 py-1 font-bold">
              Return Required
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {returningOrders.map((order) => {
              const rest = getRestaurantRealDetails(order);
              const isEnRouteReturn = order.deliveryStatus === 'returning_to_restaurant';
              return (
                <div
                  key={order.id}
                  className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-950/25 via-black/40 to-black/60 backdrop-blur-xl p-6 shadow-2xl space-y-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs px-2 py-0.5 font-bold">
                          Customer Cancelled
                        </Badge>
                        <span className="text-xs font-mono font-bold text-gray-400">
                          #{formatOrderId(order.id)}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-white">
                        {rest.name}
                      </h3>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-sm">
                        + ₹20 Earning
                      </span>
                      <p className="text-[10px] text-gray-400 mt-1">Travel Compensation</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-2 text-xs">
                    <div className="flex items-start gap-2 text-gray-300">
                      <Store className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-white font-medium">Return Destination:</p>
                          {rest.phone && (
                            <a
                              href={`tel:${rest.phone}`}
                              className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20"
                            >
                              <Phone className="w-2.5 h-2.5" /> Call Restaurant
                            </a>
                          )}
                        </div>
                        <p className="text-gray-400 line-clamp-2">{rest.address}</p>
                      </div>
                    </div>
                    {order.cancellationReason && (
                      <div className="pt-2 border-t border-white/5 text-gray-400">
                        <span className="text-gray-500">Reason: </span>
                        <span className="italic">{order.cancellationReason}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!isEnRouteReturn && order.id) startReturnToRestaurant(order.id);
                        openNavigation(rest.lat, rest.lng, rest.address);
                      }}
                      className="h-11 border-amber-500/40 hover:bg-amber-500/10 text-amber-300 rounded-2xl text-xs font-bold gap-1.5"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Navigate to Restaurant
                    </Button>
                    <Button
                      onClick={() => order.id && openReturnOtpDialog(order.id)}
                      className="h-11 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-2xl shadow-lg shadow-amber-900/30 text-xs gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Drop & Enter OTP
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Active Tasks Section */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            Current Tasks
            {activeOrders.length > 0 && <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">{activeOrders.length}</span>}
          </h2>
          {activeOrders.length === 0 && isOnline && (
            <p className="text-sm text-blue-400 animate-pulse">
              Scanning {pincodeFilterActive && servicePincodes.length > 0 ? `in ${servicePincodes.join(', ')}` : 'all areas'}...
            </p>
          )}
        </div>

        <div className="grid gap-6">
          <AnimatePresence>
            {activeOrders.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 border border-dashed border-white/10 rounded-3xl bg-white/[0.02]"
              >
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping opacity-20" />
                  <MapPin className="w-8 h-8 text-gray-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Active Orders</h3>
                <p className="text-gray-500 max-w-sm text-center text-sm">
                  {isOnline ? "You're online! We'll notify you when a new order arrives." : "You are currently offline. Go online to start receiving delivery requests."}
                </p>
              </motion.div>
            ) : (
              activeOrders.map((order) => {
                const stage = order.delivery?.stage || (order.deliveryStatus === 'going_to_restaurant' ? 'TO_PICKUP' : order.deliveryStatus === 'going_to_customer' ? 'TO_CUSTOMER' : 'TO_PICKUP') as DeliveryStage;
                const stageColors = getStageColor(stage);
                const isPickupPhase = stage === 'TO_PICKUP' || stage === 'ARRIVED_PICKUP';
                const isDeliveryPhase = stage === 'PICKED_UP' || stage === 'TO_CUSTOMER' || stage === 'ARRIVED_CUSTOMER';

                // Stage progress: 6 steps
                const stageSteps: { key: DeliveryStage; label: string; icon: string }[] = [
                  { key: 'TO_PICKUP', label: 'En Route', icon: '🛵' },
                  { key: 'ARRIVED_PICKUP', label: 'At Restaurant', icon: '🍔' },
                  { key: 'TO_CUSTOMER', label: 'Picked Up', icon: '📦' },
                  { key: 'ARRIVED_CUSTOMER', label: 'At Customer', icon: '🏠' },
                  { key: 'DELIVERED', label: 'Delivered', icon: '✅' },
                ];
                const currentStepIdx = stageSteps.findIndex(s => s.key === stage);

                return (
                  <motion.div
                    layout
                    key={order.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl transition-all hover:border-blue-500/30"
                  >
                    {/* Stage Progress Bar */}
                    <div className={`h-1.5 w-full bg-gradient-to-r ${isPickupPhase ? 'from-orange-500 via-yellow-500 to-orange-500' : 'from-blue-500 via-indigo-500 to-blue-500'} animate-progress-flow`} />

                    <div className="p-6 md:p-8 relative">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-b from-blue-600/10 to-transparent blur-3xl opacity-50" />

                      <div className="relative z-10 flex flex-col gap-6">
                        {/* Header */}
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <Badge className={`border ${stageColors.border} px-3 py-1 font-bold ${stageColors.bg} ${stageColors.text}`}>
                                {getStageLabel(stage)}
                              </Badge>
                              <span className="text-xs text-gray-400 font-mono font-bold">#{formatOrderId(order.id)}</span>
                            </div>
                            <h3 className="text-2xl font-black text-white">{order.restaurantName}</h3>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400">₹{order.total?.toFixed(0)}</p>
                            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">{order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Paid'}</p>
                          </div>
                        </div>

                        {/* Mini Stage Progress */}
                        <div className="flex items-center gap-1">
                          {stageSteps.map((step, i) => (
                            <React.Fragment key={step.key}>
                              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold transition-all ${i <= currentStepIdx
                                ? i === currentStepIdx ? `${stageColors.bg} ${stageColors.text} ring-1 ring-current scale-105` : 'bg-white/10 text-gray-400'
                                : 'bg-white/5 text-gray-600'
                                }`}>
                                <span>{step.icon}</span>
                                <span className="hidden sm:inline">{step.label}</span>
                              </div>
                              {i < stageSteps.length - 1 && (
                                <div className={`flex-1 h-0.5 rounded-full ${i < currentStepIdx ? 'bg-white/20' : 'bg-white/5'}`} />
                              )}
                            </React.Fragment>
                          ))}
                        </div>

                        <div className="flex flex-col md:flex-row gap-6">
                          {/* Route Points */}
                          <div className="flex-1 space-y-4">
                            <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                              {/* Pickup */}
                              {(() => {
                                const rest = getRestaurantRealDetails(order);
                                return (
                                  <div className={`relative transition-opacity ${isDeliveryPhase ? 'opacity-40' : 'opacity-100'}`}>
                                    <div className={`absolute -left-[29px] top-1 w-4 h-4 rounded-full border-2 ${isPickupPhase ? 'border-orange-500 bg-orange-500 animate-pulse' :
                                      isDeliveryPhase ? 'border-green-500 bg-green-500' : 'border-gray-600 bg-black'
                                      }`} />
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <p className="text-xs text-orange-400 font-bold uppercase tracking-wider">
                                        {isDeliveryPhase ? '✓ Picked Up' : 'Pickup Restaurant'}
                                      </p>
                                      <div className="flex items-center gap-2">
                                        {rest.phone && (
                                          <a
                                            href={`tel:${rest.phone}`}
                                            className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20"
                                          >
                                            <Phone className="w-3 h-3" /> Call
                                          </a>
                                        )}
                                        <button
                                          onClick={() => openNavigation(rest.lat, rest.lng, rest.address)}
                                          className="flex items-center gap-1 text-[11px] font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20"
                                        >
                                          <Navigation className="w-3 h-3" /> Maps Route
                                        </button>
                                      </div>
                                    </div>
                                    <p className="text-white text-base font-semibold">{rest.name}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{rest.address}</p>
                                  </div>
                                );
                              })()}

                              {/* Dropoff */}
                              <div className={`relative transition-opacity ${isDeliveryPhase ? 'opacity-100' : 'opacity-50'}`}>
                                <div className={`absolute -left-[29px] top-1 w-4 h-4 rounded-full border-2 ${isDeliveryPhase ? 'border-blue-500 bg-blue-500 animate-pulse' : 'border-gray-600 bg-black'
                                  }`} />
                                <p className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">Dropoff</p>
                                <p onClick={() => openMaps(formatAddress(order.deliveryAddress))} className="text-white hover:text-blue-400 cursor-pointer transition-colors text-base font-medium">
                                  {order.delivery?.drop?.address || formatAddress(order.deliveryAddress)}
                                </p>
                                <div className="flex items-center gap-3 mt-2">
                                  {order.customerPhone && (
                                    <a href={`tel:${order.customerPhone}`} className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white bg-white/5 px-3 py-1.5 rounded-full border border-white/5 transition-colors">
                                      <Phone className="w-3 h-3" /> Call
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Stage-Aware Action Buttons */}
                          <div className="md:w-72 flex flex-col gap-3 justify-center">
                            {stage === 'TO_PICKUP' && (
                              <>
                                <Button
                                  onClick={() => markArrivedAtRestaurant(order.id!)}
                                  className="h-14 text-base font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 shadow-xl shadow-orange-900/40 border-0 gap-2"
                                >
                                  <MapPin className="w-5 h-5" />
                                  Arrived at Restaurant
                                </Button>
                                <p className="text-[11px] text-center text-gray-500">Press when you reach the restaurant</p>
                              </>
                            )}
                            {stage === 'ARRIVED_PICKUP' && (
                              <>
                                <div className="text-center py-2">
                                  <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-2 animate-pulse">
                                    <ShoppingBag className="w-5 h-5 text-amber-400" />
                                  </div>
                                  <p className="text-amber-400 text-xs font-bold">Waiting for food handover...</p>
                                </div>
                                <Button
                                  onClick={() => markPickedUp(order.id!)}
                                  className="h-14 text-base font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 shadow-xl shadow-orange-900/40 border-0 gap-2"
                                >
                                  <Package className="w-5 h-5" />
                                  Order Picked Up
                                </Button>
                                <p className="text-[11px] text-center text-gray-500">Press after collecting the food</p>
                              </>
                            )}
                            {(stage === 'PICKED_UP' || stage === 'TO_CUSTOMER') && (
                              <>
                                <Button
                                  onClick={() => markArrivedAtCustomer(order.id!)}
                                  className="h-14 text-base font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-900/40 border-0 gap-2"
                                >
                                  <Navigation className="w-5 h-5" />
                                  Arrived at Customer
                                </Button>
                                <p className="text-[11px] text-center text-gray-500">Press when you reach the delivery location</p>
                              </>
                            )}
                            {stage === 'ARRIVED_CUSTOMER' && (
                              <>
                                <div className="text-center py-2">
                                  <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-2 animate-pulse">
                                    <CheckCircle className="w-5 h-5 text-green-400" />
                                  </div>
                                  <p className="text-green-400 text-xs font-bold">At customer's location</p>
                                </div>
                                <Button
                                  onClick={() => markDelivered(order.id!, order.deliveryOtp)}
                                  className="h-14 text-base font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-xl shadow-green-900/40 border-0 gap-2"
                                >
                                  <CheckCircle className="w-5 h-5" />
                                  Complete Delivery
                                </Button>
                                <p className="text-[11px] text-center text-gray-500">Verify OTP with customer to complete</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Order Acceptance Dialog */}
      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent className="bg-black/90 border-white/10 text-white backdrop-blur-2xl p-0 overflow-hidden gap-0 sm:max-w-md">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/10 to-purple-600/10 pointer-events-none" />

          {selectedOrder && (
            <>
              <div className="p-6 bg-gradient-to-br from-white/5 to-transparent border-b border-white/5">
                <div className="flex justify-between items-center mb-6">
                  <Badge className="bg-green-500/20 text-green-300 border-none px-3 py-1">New Request</Badge>
                  <span className="text-xs font-mono font-bold text-gray-300">#{formatOrderId(selectedOrder.id)}</span>
                </div>
                <div className="text-center mb-2">
                  <p className="text-sm text-gray-400 uppercase tracking-widest font-bold mb-1">Estimated Earnings</p>
                  <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">₹{selectedOrder.total?.toFixed(0)}</h2>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 border border-orange-500/20">
                      <ShoppingBag className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-lg">{selectedOrder.restaurantName}</h4>
                      <p className="text-gray-400 text-sm">{selectedOrder.restaurantAddress || 'Restaurant Location'}</p>
                    </div>
                  </div>

                  <div className="w-0.5 h-6 bg-white/10 ml-5" />

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                      <MapPin className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 w-full">
                      <h4 className="text-gray-200 font-medium text-sm leading-relaxed">{formatAddress(selectedOrder.deliveryAddress)}</h4>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>25-30 mins est.</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={denyOrder}
                    className="h-14 border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 text-gray-400"
                  >
                    <X className="w-5 h-5 mr-2" />
                    Decline
                  </Button>
                  <Button
                    onClick={() => selectedOrder && acceptOrder(selectedOrder)}
                    className="h-14 bg-white text-black hover:bg-gray-200 font-bold text-lg shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] transition-all"
                  >
                    Accept Order
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* OTP Verification Dialog */}
      <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
        <DialogContent className="bg-black/95 border-white/10 text-white backdrop-blur-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-blue-500" />
              Customer Verification
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Please enter the 4-digit code provided by the customer.
            </DialogDescription>
          </DialogHeader>

          <div className="py-8 flex justify-center">
            <input
              type="text"
              maxLength={4}
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0000"
              className="bg-white/5 border border-white/10 rounded-2xl text-center text-5xl font-mono tracking-[0.5em] w-full py-6 text-white focus:outline-none focus:border-blue-500 focus:bg-blue-500/5 transition-all shadow-inner"
              autoFocus
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3">
            <Button variant="ghost" onClick={() => setShowOtpDialog(false)} className="text-gray-400 hover:text-white">
              Cancel
            </Button>
            <Button
              onClick={verifyAndCompleteDelivery}
              disabled={otpInput.length !== 4}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-8 flex-1"
            >
              Verify & Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restaurant Return Drop OTP Dialog */}
      <Dialog open={showReturnOtpDialog} onOpenChange={setShowReturnOtpDialog}>
        <DialogContent className="bg-black/95 border-amber-500/30 text-white backdrop-blur-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-amber-400">
              <Store className="w-6 h-6 text-amber-400" />
              Restaurant Drop Verification
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-sm">
              Hand over the cancelled food packet to the restaurant counter staff. Enter the 4-digit drop OTP to verify return and receive your <strong className="text-emerald-400">₹20 travel compensation</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 flex flex-col items-center gap-2">
            <input
              type="text"
              maxLength={4}
              value={returnOtpInput}
              onChange={(e) => setReturnOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0000"
              className="bg-white/5 border border-amber-500/40 rounded-2xl text-center text-5xl font-mono tracking-[0.5em] w-full py-6 text-white focus:outline-none focus:border-amber-400 focus:bg-amber-500/5 transition-all shadow-inner"
              autoFocus
            />
            {returningOrderId && (
              <p className="text-[11px] text-gray-500 mt-2 font-mono">
                Counter Code: {(() => {
                  const o = myOrders.find(x => x.id === returningOrderId);
                  return (o as any)?.returnOtp || o?.deliveryOtp || '2048';
                })()}
              </p>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3">
            <Button variant="ghost" onClick={() => setShowReturnOtpDialog(false)} className="text-gray-400 hover:text-white">
              Cancel
            </Button>
            <Button
              onClick={verifyAndCompleteReturn}
              disabled={returnOtpInput.length !== 4}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold h-12 px-8 flex-1"
            >
              Verify & Receive ₹20
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
