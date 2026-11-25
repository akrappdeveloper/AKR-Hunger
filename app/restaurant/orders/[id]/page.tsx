'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { db } from '@/lib/firebase';
import {
  doc,
  onSnapshot,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { Order, formatOrderId } from '@/lib/types';
import { getDeterministicChatId } from '@/lib/chat-service';
import InvoiceButton from '@/app/customer/orders/InvoiceButton';
import {
  ItemCustomizationBadges,
  BillCustomizationBreakdownRows,
} from '@/components/orders/ItemCustomizationBadges';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  ChefHat,
  ShoppingBag,
  Truck,
  MapPin,
  Phone,
  User,
  AlertCircle,
  Printer,
  FileText,
  DollarSign,
  Radio,
  Ban,
  Bike,
  ShieldCheck,
  Utensils,
  MessageSquare,
  Mail,
  KeyRound,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';

type RestaurantOrder = Order & {
  instructions?: string;
  tax?: number;
  packagingFee?: number;
  userName?: string;
  address?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  [key: string]: any;
};

const STATUS_STEPS: {
  key: OrderStatus;
  label: string;
  icon: any;
  managedBy: 'system' | 'restaurant' | 'delivery';
  managedByLabel: string;
}[] = [
  { key: 'pending', label: 'Order Placed', icon: Clock, managedBy: 'system', managedByLabel: 'Auto Placed' },
  { key: 'confirmed', label: 'Accepted', icon: CheckCircle2, managedBy: 'restaurant', managedByLabel: 'Restaurant' },
  { key: 'preparing', label: 'In Kitchen', icon: ChefHat, managedBy: 'restaurant', managedByLabel: 'Restaurant' },
  { key: 'ready', label: 'Ready for Pickup', icon: ShoppingBag, managedBy: 'delivery', managedByLabel: 'Delivery Partner' },
  { key: 'out_for_delivery', label: 'Dispatched', icon: Truck, managedBy: 'delivery', managedByLabel: 'Delivery Partner' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2, managedBy: 'delivery', managedByLabel: 'Delivery Partner' },
];

const CANCEL_REASONS = [
  'Ingredients / items out of stock',
  'Kitchen at peak capacity, cannot fulfill',
  'Delivery address outside serviceable zone',
  'Customer requested cancellation',
  'Pricing or technical discrepancy',
  'Other',
];

export default function RestaurantOrderDetailPage() {
  const params = useParams();
  const rawId = (params?.id as string) || '';
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();

  const [order, setOrder] = useState<RestaurantOrder | null>(null);
  const [actualDocId, setActualDocId] = useState<string>(rawId);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [assignedRider, setAssignedRider] = useState<any>(null);

  // Broadcast Dialog
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Cancel Dialog
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelCustom, setCancelCustom] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Listen to assigned rider in real time
  useEffect(() => {
    const riderId = order?.deliveryPersonId || order?.driverId;
    if (!riderId) {
      setAssignedRider(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'deliveryPersons', riderId), (snap) => {
      if (snap.exists()) {
        setAssignedRider({ ...snap.data(), id: snap.id });
      }
    });
    return () => unsub();
  }, [order?.deliveryPersonId, order?.driverId]);

  // Subscribe to Order Document in Real-Time (supports docId, orderId, orderNumber, #orderNumber, and restaurant fallback)
  useEffect(() => {
    if (!rawId || authLoading) return;

    let isMounted = true;
    let unsubscribeDoc: (() => void) | null = null;
    const decodedRaw = decodeURIComponent(rawId).trim();
    const normalizedUpper = decodedRaw.replace(/^#/, '').toUpperCase();

    const attachDocListener = (docId: string) => {
      if (!isMounted) return;
      setActualDocId(docId);
      if (unsubscribeDoc) unsubscribeDoc();
      unsubscribeDoc = onSnapshot(doc(db, 'orders', docId), (subSnap) => {
        if (!isMounted) return;
        if (subSnap.exists()) {
          setOrder({ ...subSnap.data(), id: subSnap.id } as RestaurantOrder);
        }
        setLoading(false);
      });
    };

    const resolveAndListen = async () => {
      try {
        setLoading(true);

        // 1. Direct doc reference by rawId or uppercase normalized ID
        const directSnap = await onSnapshotPromiseOnce(doc(db, 'orders', decodedRaw));
        if (directSnap) {
          attachDocListener(directSnap.id);
          return;
        }

        if (normalizedUpper && normalizedUpper !== decodedRaw) {
          const upperSnap = await onSnapshotPromiseOnce(doc(db, 'orders', normalizedUpper));
          if (upperSnap) {
            attachDocListener(upperSnap.id);
            return;
          }
        }

        // 2. Query by orderId, orderNumber, #orderNumber, or id field (requires auth)
        if (user) {
          const fieldCandidates: Array<[string, string]> = [
            ['orderId', decodedRaw],
            ['orderId', normalizedUpper],
            ['orderNumber', decodedRaw],
            ['orderNumber', normalizedUpper],
            ['orderNumber', `#${normalizedUpper}`],
            ['id', decodedRaw],
            ['id', normalizedUpper],
          ];

          for (const [field, val] of fieldCandidates) {
            if (!val) continue;
            try {
              const snap = await getDocs(query(collection(db, 'orders'), where(field, '==', val)));
              if (!snap.empty) {
                attachDocListener(snap.docs[0].id);
                return;
              }
            } catch {
              // continue checking other fields
            }
          }

          // 3. Fallback: scan restaurant's own orders for suffix or formatted ID match
          const restIds = Array.from(
            new Set([restaurant?.id, user.restaurantId, user.uid].filter(Boolean))
          ) as string[];

          for (const rId of restIds) {
            try {
              const restSnap = await getDocs(
                query(collection(db, 'orders'), where('restaurantId', '==', rId))
              );
              const matched = restSnap.docs.find((d) => {
                const data = d.data();
                const candidates = [
                  d.id,
                  data.orderId,
                  data.orderNumber,
                  data.id,
                  formatOrderId(d.id),
                  formatOrderId(data.orderId),
                  formatOrderId(data.orderNumber),
                ]
                  .filter(Boolean)
                  .map((v: any) => String(v).replace(/^#/, '').toUpperCase());

                return candidates.some(
                  (c) => c === normalizedUpper || c.endsWith(normalizedUpper)
                );
              });

              if (matched) {
                attachDocListener(matched.id);
                return;
              }
            } catch {
              // continue
            }
          }
        }

        if (isMounted) {
          setOrder(null);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching order:', err);
        if (isMounted) setLoading(false);
      }
    };

    const onSnapshotPromiseOnce = (docRef: any): Promise<{ id: string } | null> =>
      new Promise((resolve) => {
        let settled = false;
        const unsub = onSnapshot(
          docRef,
          (snap: any) => {
            if (!settled) {
              settled = true;
              unsub();
              resolve(snap.exists() ? { id: snap.id } : null);
            }
          },
          () => {
            if (!settled) {
              settled = true;
              unsub();
              resolve(null);
            }
          }
        );
      });

    resolveAndListen();

    return () => {
      isMounted = false;
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, [rawId, authLoading, user?.uid, user?.restaurantId, restaurant?.id]);

  // Update Status Handler
  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    if (!order || !actualDocId) return;
    setUpdatingStatus(true);
    try {
      await updateDoc(doc(db, 'orders', actualDocId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      // Trigger push & in-app notification to customer
      fetch('/api/notifications/order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: actualDocId, status: newStatus }),
      }).catch((e) => console.warn('Notification trigger notice:', e));

      toast.success(`Order marked as "${newStatus.replace(/_/g, ' ').toUpperCase()}"`);
    } catch (e: any) {
      toast.error('Failed to update order status: ' + e?.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Open Cancellation Dialog
  const handleCancelSubmit = async () => {
    if (!order || !actualDocId || !user) return;
    const finalReason = cancelReason === 'Other' ? (cancelCustom.trim() || 'Other') : cancelReason;
    if (!finalReason) {
      toast.error('Please select a cancellation reason');
      return;
    }

    setIsCancelling(true);
    try {
      await updateDoc(doc(db, 'orders', actualDocId), {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancellationReason: finalReason,
        cancelledBy: 'RESTAURANT',
        updatedAt: serverTimestamp(),
      });

      // Record cancellation audit
      await addDoc(collection(db, 'orderCancellations'), {
        orderId: actualDocId,
        userId: order.customerId || '',
        restaurantId: restaurant?.id || user.restaurantId || user.uid,
        cancelledBy: 'RESTAURANT',
        reason: finalReason,
        cancelledAt: serverTimestamp(),
      });

      fetch('/api/notifications/order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: actualDocId, status: 'cancelled' }),
      }).catch(() => {});

      toast.success('Order has been cancelled');
      setCancelOpen(false);
    } catch (e: any) {
      toast.error('Failed to cancel order: ' + e?.message);
    } finally {
      setIsCancelling(false);
    }
  };

  // Open Broadcast to Delivery Partners
  const openBroadcastModal = async () => {
    setBroadcastOpen(true);
    setLoadingDrivers(true);
    try {
      const snap = await getDocs(collection(db, 'deliveryPersons'));
      let list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((d: any) => d.status !== 'offline');
      if (list.length === 0) {
        const snapFallback = await getDocs(query(collection(db, 'deliveryPartners'), where('isActive', '==', true)));
        list = snapFallback.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      setAvailableDrivers(list);
      setSelectedDriverIds(list.map((d) => d.id));
    } catch (e) {
      console.warn('Driver fetch notice:', e);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const handleBroadcastConfirm = async () => {
    if (!order || !actualDocId) return;
    setIsBroadcasting(true);
    try {
      // 1. Update order status to ready and mark broadcastVerified in Firestore
      await updateDoc(doc(db, 'orders', actualDocId), {
        status: 'ready',
        targetDeliveryIds: selectedDriverIds,
        broadcastVerified: true,
        broadcastAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setOrder((prev) => prev ? {
        ...prev,
        status: 'ready',
        targetDeliveryIds: selectedDriverIds,
        broadcastVerified: true,
      } : null);

      // 2. Create in-app broadcast notifications for target drivers
      for (const dId of selectedDriverIds) {
        addDoc(collection(db, 'notifications'), {
          userId: dId,
          userType: 'delivery',
          type: 'delivery_request',
          title: 'New Delivery Order Available! 🛵',
          message: `Order #${formatOrderId(order.orderId || actualDocId)} is ready for pickup at ${
            order.restaurantName || restaurant?.name || 'Restaurant'
          }! Tap to accept.`,
          orderId: actualDocId,
          isRead: false,
          createdAt: serverTimestamp(),
          actionUrl: `/delivery/available`,
        }).catch(() => {});
      }

      // 3. Trigger FCM Push Notifications
      fetch('/api/notifications/delivery-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: actualDocId,
          partnerIds: selectedDriverIds,
        }),
      }).catch((err) => console.error('Failed to trigger delivery notification:', err));

      toast.success(`Broadcast sent to ${selectedDriverIds.length} delivery partners! 🛵`);
      setBroadcastOpen(false);
    } catch (e: any) {
      toast.error('Broadcast failed: ' + e?.message);
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Print Handlers
  const handlePrintKOT = () => {
    window.print();
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
        <Spinner className="w-10 h-10 text-primary mb-3" />
        <p className="text-sm font-semibold text-muted-foreground animate-pulse">
          Loading order details #{rawId}...
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black mb-2">Order Not Found</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          We could not locate order <strong>#{rawId}</strong>. It may have been archived or removed.
        </p>
        <Button asChild className="rounded-xl font-bold">
          <Link href="/restaurant/orders">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Orders Dashboard
          </Link>
        </Button>
      </div>
    );
  }

  const currentStatus = (order.status as OrderStatus) || 'pending';
  const displayId = formatOrderId(order.orderId || order.id || actualDocId);
  const items = order.items || [];
  const isCancelled = currentStatus === 'cancelled';
  const isDelivered = currentStatus === 'delivered';

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 selection:bg-primary/25">
      {/* Printable KOT / Slip Header (only on print) */}
      <div className="hidden print:block p-4 border-b font-mono text-black">
        <h2 className="text-xl font-bold">{order.restaurantName || 'Restaurant Kitchen Ticket'}</h2>
        <p className="text-sm">KOT - ORDER #{displayId}</p>
        <p className="text-xs">Date: {new Date().toLocaleString()}</p>
        <p className="text-xs">Customer: {order.customerName} ({order.customerPhone})</p>
      </div>

      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-card/85 backdrop-blur-xl border-b border-border/70 px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl border-border h-9 px-3 gap-1.5 font-bold"
            >
              <Link href="/restaurant/orders">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">All Orders</span>
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-foreground">
                  Order #{displayId}
                </h1>
                <Badge
                  className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                    isCancelled
                      ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                      : isDelivered
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : currentStatus === 'preparing'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      : 'bg-primary/15 text-primary border border-primary/30'
                  }`}
                >
                  {currentStatus.replace(/_/g, ' ')}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Placed at {order.createdAt ? new Date(order.createdAt?.toDate ? order.createdAt.toDate() : order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                {' · '}
                {items.length} Item{items.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Quick Action Print, Chat & Tracking Buttons */}
          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto print:hidden">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 px-3 rounded-xl border-border text-xs font-bold gap-1.5"
            >
              <Link href={`/restaurant/chat/${getDeterministicChatId(actualDocId, 'customer_restaurant')}`}>
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span>Customer Chat</span>
              </Link>
            </Button>
            {(order.deliveryPersonId || order.driverId) && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-9 px-3 rounded-xl border-border text-xs font-bold gap-1.5"
              >
                <Link href={`/restaurant/chat/${getDeterministicChatId(actualDocId, 'restaurant_delivery')}`}>
                  <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                  <span>Rider Chat</span>
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintKOT}
              className="h-9 px-3 rounded-xl border-border text-xs font-bold gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Print KOT</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintInvoice}
              className="h-9 px-3 rounded-xl border-border text-xs font-bold gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Invoice</span>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 px-3 rounded-xl border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold gap-1.5"
            >
              <Link href="/restaurant/orders/tracking">
                <Bike className="w-3.5 h-3.5" />
                <span>Live Map</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">

        {/* Live Stepper Status Tracker Card */}
        <Card className="p-5 sm:p-6 rounded-3xl bg-card border-border shadow-sm print:hidden">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-border/50">
            <div>
              <h2 className="text-sm font-bold text-foreground">Order Lifecycle Stepper</h2>
              <p className="text-xs text-muted-foreground">Real-time status synced with customer and rider apps</p>
            </div>
            {!isCancelled && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setCancelOpen(true)}
                className="h-8 rounded-xl text-xs font-bold gap-1"
              >
                <Ban className="w-3.5 h-3.5" /> Cancel Order
              </Button>
            )}
          </div>

          {isCancelled ? (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-start gap-3 text-red-600 dark:text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Order Cancelled</h4>
                <p className="text-xs mt-0.5 opacity-90">
                  Reason: {order.cancellationReason || 'Cancelled by restaurant partner'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Stepper Dots */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2">
                {STATUS_STEPS.map((step, idx) => {
                  const stepIndex = STATUS_STEPS.findIndex((s) => s.key === currentStatus);
                  const isCompleted = stepIndex >= idx;
                  const isCurrent = step.key === currentStatus;
                  const Icon = step.icon;

                  return (
                    <div
                      key={step.key}
                      className={`p-3 rounded-2xl border transition-all text-center flex flex-col items-center justify-center gap-1.5 ${
                        isCurrent
                          ? 'bg-primary/15 border-primary/50 text-primary font-bold shadow-sm'
                          : isCompleted
                          ? 'bg-muted/40 border-border text-foreground font-semibold'
                          : 'bg-muted/10 border-border/40 text-muted-foreground opacity-60'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                          isCurrent
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : isCompleted
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] leading-tight font-bold">{step.label}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                          step.managedBy === 'delivery'
                            ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                            : step.managedBy === 'restaurant'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {step.managedBy === 'delivery' ? '🛵 Rider' : step.managedBy === 'restaurant' ? '🏪 Kitchen' : 'Auto'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Status Action & Delivery Partner Managed Area */}
              <div className="mt-5 pt-4 border-t border-border/50">
                {currentStatus === 'pending' && (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium">Restaurant Action Required:</span>
                      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px]">
                        Pending Acceptance
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setCancelOpen(true)}
                        variant="outline"
                        className="h-10 px-4 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-bold gap-1.5"
                      >
                        <Ban className="w-4 h-4" /> Reject Order
                      </Button>
                      <Button
                        onClick={() => handleUpdateStatus('confirmed')}
                        disabled={updatingStatus}
                        className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-md shadow-emerald-600/20"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Accept Order
                      </Button>
                    </div>
                  </div>
                )}

                {currentStatus === 'confirmed' && (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium">Restaurant Next Step:</span>
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px]">
                        Order Confirmed
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleUpdateStatus('preparing')}
                        disabled={updatingStatus}
                        className="h-10 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs gap-1.5 shadow-md shadow-amber-600/20"
                      >
                        <ChefHat className="w-4 h-4" /> Start Preparing Food
                      </Button>
                    </div>
                  </div>
                )}

                {currentStatus === 'preparing' && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                        <ChefHat className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">Food Cooking in Kitchen</span>
                          <Badge className="bg-blue-500/15 text-blue-500 border border-blue-500/30 text-[10px]">
                            🛵 Managed by Delivery Partner
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Kitchen is preparing food. <strong>Ready for Pickup</strong>, <strong>Dispatched</strong>, and <strong>Delivered</strong> are managed directly by the assigned Delivery Partner.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openBroadcastModal}
                        className="h-9 px-3.5 rounded-xl border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 text-xs font-bold gap-1.5"
                      >
                        <Radio className="w-3.5 h-3.5 animate-pulse" /> Broadcast / Alert Riders
                      </Button>
                    </div>
                  </div>
                )}

                {currentStatus === 'ready' && (
                  <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">Food Ready for Pickup at Counter</span>
                          <Badge className="bg-blue-500/20 text-blue-500 border border-blue-500/30 text-[10px]">
                            🛵 Delivery Partner Action
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Order is packed & ready at the pickup counter. Waiting for delivery partner to collect the package and mark <strong>Dispatched</strong> on their app.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(assignedRider?.phone || order.deliveryPersonPhone || order.driverPhone) ? (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-9 px-3.5 rounded-xl border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs font-bold gap-1.5"
                        >
                          <a href={`tel:${assignedRider?.phone || order.deliveryPersonPhone || order.driverPhone}`}>
                            <Phone className="w-3.5 h-3.5" /> Call Rider
                          </a>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={openBroadcastModal}
                          className="h-9 px-3.5 rounded-xl border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 text-xs font-bold gap-1.5"
                        >
                          <Radio className="w-3.5 h-3.5 animate-pulse" /> Broadcast / Re-assign Rider
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {currentStatus === 'out_for_delivery' && (
                  <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">Dispatched & Out for Delivery</span>
                          <Badge className="bg-indigo-500/20 text-indigo-500 border border-indigo-500/30 text-[10px]">
                            🛵 Delivery Partner Action
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Package has been handed over. Delivery rider is navigating to customer address. Rider will confirm <strong>Delivered</strong> upon drop-off.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-9 px-3.5 rounded-xl border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 text-xs font-bold gap-1.5"
                      >
                        <Link href="/restaurant/orders/tracking">
                          <Bike className="w-3.5 h-3.5" /> Track Rider Live
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}

                {currentStatus === 'delivered' && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">Delivered Successfully</span>
                          <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px]">
                            Completed by Delivery Partner
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Order fulfilled and handed over safely to customer. Payout recorded.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>

        {/* 2-Column Responsive Layout: Items & Breakdown vs Customer & Driver */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column (8 cols): Order Items & Bill Breakdown */}
          <div className="lg:col-span-7 space-y-6">

            {/* Items Card */}
            <Card className="p-5 sm:p-6 rounded-3xl bg-card border-border shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-primary" />
                  <h3 className="font-bold text-base text-foreground">
                    Ordered Dishes ({items.length})
                  </h3>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  Kitchen Prep List
                </Badge>
              </div>

              {/* Items List */}
              <div className="divide-y divide-border/50">
                {items.map((item: any, idx: number) => {
                  const itemPrice = Number(item.price || item.unitPrice || 0);
                  const qty = Number(item.quantity || 1);
                  const itemTotal = itemPrice * qty;
                  const note = item.specialInstructions || item.instructions;

                  return (
                    <div key={idx} className="py-3.5 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name || 'Dish'}
                            className="w-12 h-12 rounded-xl object-cover border border-border shrink-0"
                          />
                        )}
                        {/* Veg / Non-Veg Indicator */}
                        <div
                          className={`w-4 h-4 mt-0.5 rounded-sm border flex items-center justify-center shrink-0 ${
                            item.isVeg !== false && item.vegetarian !== false
                              ? 'border-emerald-600'
                              : 'border-red-600'
                          }`}
                        >
                          <div
                            className={`w-2 h-2 rounded-full ${
                              item.isVeg !== false && item.vegetarian !== false ? 'bg-emerald-600' : 'bg-red-600'
                            }`}
                          />
                        </div>

                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-foreground">
                            {item.name || item.title || 'Food Item'}
                          </h4>
                          {item.customizations && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {typeof item.customizations === 'string'
                                ? item.customizations
                                : Object.values(item.customizations).join(', ')}
                            </p>
                          )}
                          <ItemCustomizationBadges item={item} compact />
                          <span className="text-xs text-muted-foreground font-mono block mt-0.5">
                            ₹{itemPrice} × {qty}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold text-sm text-foreground font-mono">
                          ₹{itemTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Special Cooking Note if Any */}
              {(order.specialInstructions || order.instructions) && (
                <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs">
                  <span className="font-bold text-amber-600 dark:text-amber-400 block mb-0.5">
                    Chef Cooking Instructions:
                  </span>
                  <p className="text-foreground">{order.specialInstructions || order.instructions}</p>
                </div>
              )}
            </Card>

            {/* Bill & Payment Breakdown */}
            <Card className="p-5 sm:p-6 rounded-3xl bg-card border-border shadow-sm">
              <h3 className="font-bold text-base text-foreground mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-500" /> Payment & Bill Breakdown
              </h3>

              <div className="space-y-2.5 text-sm">
                <BillCustomizationBreakdownRows items={items} monoValues />

                <div className="flex justify-between text-muted-foreground">
                  <span>Items Subtotal</span>
                  <span className="font-mono text-foreground">
                    ₹{(order.subtotal ?? order.total ?? 0).toFixed(2)}
                  </span>
                </div>

                {Boolean(order.taxes || order.tax) && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>
                      GST & Restaurant Taxes
                      {order.cgst || order.sgst
                        ? ` (CGST ₹${Number(order.cgst || 0).toFixed(2)} + SGST ₹${Number(order.sgst || 0).toFixed(2)})`
                        : ''}
                    </span>
                    <span className="font-mono text-foreground">
                      ₹{Number(order.taxes || order.tax).toFixed(2)}
                    </span>
                  </div>
                )}

                {Boolean(order.deliveryCharge || order.deliveryFee) && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery Charge</span>
                    <span className="font-mono text-foreground">
                      ₹{Number(order.deliveryCharge || order.deliveryFee).toFixed(2)}
                    </span>
                  </div>
                )}

                {Boolean(order.packagingCharges || order.packagingFee) && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Packaging & Container Fee</span>
                    <span className="font-mono text-foreground">
                      ₹{Number(order.packagingCharges || order.packagingFee).toFixed(2)}
                    </span>
                  </div>
                )}

                {Boolean(order.platformFee) && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Platform Fee</span>
                    <span className="font-mono text-foreground">
                      ₹{Number(order.platformFee).toFixed(2)}
                    </span>
                  </div>
                )}

                {Boolean(order.tipAmount || order.tip) && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Rider Tip</span>
                    <span className="font-mono text-foreground">
                      ₹{Number(order.tipAmount || order.tip).toFixed(2)}
                    </span>
                  </div>
                )}

                {Boolean(order.discountAmount || order.discount) && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Discounts / Promo Code</span>
                    <span className="font-mono">
                      -₹{Number(order.discountAmount || order.discount).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="pt-3 border-t border-border flex justify-between text-base font-black text-foreground">
                  <span>Grand Total</span>
                  <span className="font-mono text-lg text-primary">
                    ₹{(order.total || 0).toFixed(2)}
                  </span>
                </div>

                {(order.amountPaid !== undefined || order.balanceDue !== undefined) && (
                  <div className="pt-2 flex justify-between text-xs text-muted-foreground">
                    <span>Paid: <strong className="font-mono text-foreground">₹{Number(order.amountPaid || 0).toFixed(2)}</strong></span>
                    <span>Balance Due: <strong className="font-mono text-foreground">₹{Number(order.balanceDue || 0).toFixed(2)}</strong></span>
                  </div>
                )}
              </div>

              {/* Payment Status Pill */}
              <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-semibold text-muted-foreground capitalize">
                    Method: {order.paymentMethod || 'Online'}
                  </span>
                </div>
                <Badge
                  className={`text-xs font-bold ${
                    order.paymentStatus === 'completed' || order.paymentStatus === 'paid'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  }`}
                >
                  {order.paymentStatus === 'completed' || order.paymentStatus === 'paid'
                    ? 'Payment Settled'
                    : 'Pay on Delivery / Pending'}
                </Badge>
              </div>
            </Card>
          </div>

          {/* Right Column (5 cols): Customer & Rider Information */}
          <div className="lg:col-span-5 space-y-6">

            {/* Customer Details Card */}
            <Card className="p-5 sm:p-6 rounded-3xl bg-card border-border shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" /> Customer Information
                </h3>
                <Badge variant="outline" className="text-xs font-semibold">
                  Buyer Details
                </Badge>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Customer Name
                  </label>
                  <p className="font-bold text-sm text-foreground mt-0.5">
                    {order.customerName || order.userName || 'Diner Customer'}
                  </p>
                  {order.customerEmail && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3" /> {order.customerEmail}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Phone Number
                  </label>
                  <div className="flex items-center justify-between mt-1 p-2.5 rounded-xl bg-muted/30 border border-border/50">
                    <span className="text-sm font-mono font-semibold text-foreground">
                      {order.customerPhone || (order as any).userPhone || (order as any).phone || 'Not provided'}
                    </span>
                    {(order.customerPhone || (order as any).userPhone || (order as any).phone) && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 rounded-xl border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs font-bold gap-1.5 shadow-sm"
                      >
                        <a href={`tel:${order.customerPhone || (order as any).userPhone || (order as any).phone}`}>
                          <Phone className="w-3.5 h-3.5" /> Call Customer
                        </a>
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Delivery Address
                  </label>
                  <div className="flex items-start gap-2 mt-1 p-2.5 rounded-xl bg-muted/20 border border-border/40">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground leading-relaxed">
                      {typeof order.deliveryAddress === 'string'
                        ? order.deliveryAddress
                        : (order.deliveryAddress as any)?.fullAddress ||
                          (order.deliveryAddress as any)?.formattedAddress ||
                          [
                            (order.deliveryAddress as any)?.flatNo,
                            (order.deliveryAddress as any)?.street,
                            (order.deliveryAddress as any)?.landmark,
                            (order.deliveryAddress as any)?.city,
                            (order.deliveryAddress as any)?.state,
                            (order.deliveryAddress as any)?.pincode,
                          ]
                            .filter(Boolean)
                            .join(', ') ||
                          (typeof order.address === 'string' ? order.address : 'Address not specified')}
                    </p>
                  </div>
                </div>

                {(order.deliveryOtp || order.returnOtp) && !isDelivered && !isCancelled && (
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5" />
                      {order.returnOtp ? 'Return Handover OTP' : 'Customer Delivery OTP'}
                    </span>
                    <span className="font-mono font-black text-sm tracking-widest text-primary">
                      {order.returnOtp || order.deliveryOtp}
                    </span>
                  </div>
                )}

                {/* Tax Invoice Download & Print Button (Exact same invoice as Customer Panel) */}
                <div className="pt-3 border-t border-border/60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Tax Invoice & Receipt
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                      Official GST Copy
                    </Badge>
                  </div>
                  <InvoiceButton
                    order={order}
                    customer={{
                      id: order.customerId || '',
                      name: order.customerName || order.userName || 'Customer',
                      phone: order.customerPhone || (order as any).userPhone || '',
                      email: (order as any).customerEmail || (order as any).userEmail || '',
                    } as any}
                  />
                </div>
              </div>
            </Card>

            {/* Delivery Partner Card */}
            <Card className="p-5 sm:p-6 rounded-3xl bg-card border-border shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Bike className="w-4 h-4 text-indigo-500" /> Delivery Partner
                </h3>
                {order.deliveryPersonId || order.driverId ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                    Assigned & Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30 bg-amber-500/10">
                    Awaiting Assignment
                  </Badge>
                )}
              </div>

              {order.deliveryPersonId || order.driverId ? (
                <div className="space-y-3.5">
                  <div className="p-3 rounded-2xl bg-muted/40 border border-border/50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0">
                      {(assignedRider?.name || order.deliveryPersonName || order.driverName || 'R')[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-foreground truncate">
                        {assignedRider?.name || order.deliveryPersonName || order.driverName || 'Delivery Partner'}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Bike className="w-3.5 h-3.5 text-indigo-500" />
                        {assignedRider?.vehicleType || assignedRider?.vehicleNumber || 'Motorcycle / Bike'}
                      </p>
                    </div>
                  </div>

                  {(assignedRider?.phone || order.deliveryPersonPhone || order.driverPhone) && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/40">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Rider Mobile</span>
                        <span className="text-xs font-mono font-semibold">
                          {assignedRider?.phone || order.deliveryPersonPhone || order.driverPhone}
                        </span>
                      </div>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 rounded-xl border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs font-bold gap-1"
                      >
                        <a href={`tel:${assignedRider?.phone || order.deliveryPersonPhone || order.driverPhone}`}>
                          <Phone className="w-3.5 h-3.5" /> Call Rider
                        </a>
                      </Button>
                    </div>
                  )}

                  <div className="pt-1 flex flex-col gap-2">
                    <Button
                      asChild
                      className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1.5 shadow-md shadow-indigo-600/20"
                    >
                      <Link href="/restaurant/orders/tracking">
                        <Bike className="w-4 h-4" /> Track Live Rider GPS
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openBroadcastModal}
                      className="w-full h-9 rounded-xl border-border text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5"
                    >
                      <Radio className="w-3.5 h-3.5 animate-pulse text-purple-500" /> Re-assign or Broadcast
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 text-center py-2">
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
                    <p className="font-semibold">No Delivery Partner Assigned Yet</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Ready for Pickup, Dispatched, and Delivery steps will be updated once a rider accepts the order.
                    </p>
                  </div>
                  <Button
                    onClick={openBroadcastModal}
                    className="w-full h-10 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs gap-1.5 shadow-md shadow-indigo-600/20"
                  >
                    <Radio className="w-4 h-4" /> Broadcast Request to Riders
                  </Button>
                </div>
              )}
            </Card>

          </div>
        </div>
      </main>

      {/* Broadcast Dialog */}
      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent className="max-w-md bg-card border-border text-foreground rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-indigo-500 animate-pulse" /> Broadcast to Delivery Fleet
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Send instant pickup request for Order #{displayId} to active riders nearby
            </DialogDescription>
          </DialogHeader>

          {loadingDrivers ? (
            <div className="p-8 flex justify-center">
              <Spinner className="w-6 h-6 text-primary" />
            </div>
          ) : (
            <div className="space-y-3 py-2 max-h-60 overflow-y-auto">
              {availableDrivers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No active drivers registered. Broadcast will send platform alert.
                </p>
              ) : (
                availableDrivers.map((driver) => (
                  <label
                    key={driver.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 cursor-pointer"
                  >
                    <div>
                      <p className="font-bold text-xs text-foreground">{driver.name || 'Driver'}</p>
                      <p className="text-[11px] text-muted-foreground">{driver.vehicle || 'Bike'}</p>
                    </div>
                    <Checkbox
                      checked={selectedDriverIds.includes(driver.id)}
                      onCheckedChange={(checked) => {
                        setSelectedDriverIds((prev) =>
                          checked ? [...prev, driver.id] : prev.filter((id) => id !== driver.id)
                        );
                      }}
                    />
                  </label>
                ))
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={handleBroadcastConfirm}
              disabled={isBroadcasting}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs"
            >
              {isBroadcasting ? <Spinner className="w-4 h-4 mr-2" /> : <Radio className="w-4 h-4 mr-2" />}
              Send Broadcast Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md bg-card border-border text-foreground rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <Ban className="w-5 h-5" /> Cancel Order #{displayId}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Please choose a verified reason for cancelling this order
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {CANCEL_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setCancelReason(r)}
                className={`w-full text-left p-3 rounded-xl text-xs font-semibold border transition-all ${
                  cancelReason === r
                    ? 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400 font-bold'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {cancelReason === r ? '✔ ' : ''}{r}
              </button>
            ))}

            {cancelReason === 'Other' && (
              <textarea
                value={cancelCustom}
                onChange={(e) => setCancelCustom(e.target.value)}
                placeholder="State specific cancellation reason..."
                className="w-full text-xs p-3 rounded-xl border border-border bg-muted/40 resize-none h-20 mt-2"
              />
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCancelOpen(false)}
              className="rounded-xl text-xs"
            >
              Keep Order
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubmit}
              disabled={isCancelling || !cancelReason}
              className="rounded-xl text-xs font-bold"
            >
              {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
