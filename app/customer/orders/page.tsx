'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp, addDoc, getDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, formatOrderId } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Package, RefreshCw, ChevronRight, Clock, ShoppingBag, MapPin,
  ChefHat, Star, X, Navigation, Bike, Sparkles, Filter,
  CheckCircle, AlertTriangle, Search, SortAsc, Zap, Timer,
  ShieldCheck, Copy
} from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import InvoiceButton from './InvoiceButton';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/utils';
import { notifyOrderStatusUpdate } from '@/lib/customer-notifications';

// ─── Mini Live Tracking Strip ─────────────────────────────────────────────────
function MiniTrackingStrip({ order }: { order: Order }) {
  const stage = order?.delivery?.stage;
  const isOut = order.status === 'out_for_delivery';

  const steps = [
    { key: 'confirmed', label: 'Confirmed', emoji: '✅' },
    { key: 'preparing', label: 'Preparing', emoji: '👨‍🍳' },
    { key: 'ready', label: 'Ready', emoji: '🍱' },
    { key: 'out_for_delivery', label: 'Delivery', emoji: '🛵' },
    { key: 'delivered', label: 'Done', emoji: '🎉' },
  ];

  const currentIdx = steps.findIndex(s => s.key === order.status);

  return (
    <div className="px-4 sm:px-6 py-3 bg-gradient-to-r from-orange-50/80 to-amber-50/80 dark:from-orange-950/20 dark:to-amber-950/20 border-t border-orange-100 dark:border-orange-900/30">
      {/* Stage hint */}
      {isOut && stage && (
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">
            {stage === 'TO_PICKUP' ? '🏍️ Driver heading to restaurant' :
             stage === 'ARRIVED_PICKUP' ? '🍱 Driver collecting your food' :
             stage === 'TO_CUSTOMER' ? '🚀 Driver on the way to you' :
             stage === 'ARRIVED_CUSTOMER' ? '📍 Driver at your door!' :
             '🛵 Out for delivery'}
          </p>
        </div>
      )}
      {/* Horizontal step dots */}
      <div className="flex items-center gap-1">
        {steps.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={step.key} className="flex items-center gap-1 flex-1 last:flex-none">
              <div className={`relative flex items-center justify-center w-7 h-7 rounded-full text-[11px] transition-all duration-500 ${
                done ? 'bg-emerald-500 text-white' :
                active ? 'bg-orange-500 text-white ring-2 ring-orange-300 dark:ring-orange-700 scale-110' :
                'bg-muted text-muted-foreground'
              }`}>
                {done ? '✓' : step.emoji}
                {active && <span className="absolute inset-0 rounded-full bg-orange-400/30 animate-ping" />}
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 rounded-full transition-all duration-700 ${done ? 'bg-emerald-400' : 'bg-border'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ETA Badge ────────────────────────────────────────────────────────────────
function ETABadge({ orderCreatedAt, estimatedMins = 35 }: { orderCreatedAt: any; estimatedMins?: number }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const calc = () => {
      const created = orderCreatedAt instanceof Date ? orderCreatedAt : new Date(orderCreatedAt);
      const eta = new Date(created.getTime() + estimatedMins * 60 * 1000);
      setRemaining(Math.max(0, Math.floor((eta.getTime() - Date.now()) / 1000)));
    };
    calc();
    const t = setInterval(calc, 5000);
    return () => clearInterval(t);
  }, [orderCreatedAt, estimatedMins]);

  if (remaining === null) return null;
  const mins = Math.floor(remaining / 60);
  if (mins <= 0) return <span className="text-emerald-600 font-bold text-xs">Arriving now!</span>;
  return (
    <span className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 font-bold">
      <Timer className="w-3 h-3" /> ~{mins}m
    </span>
  );
}

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; label: string; emoji: string }> = {
  pending:          { color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800', label: 'Order Placed', emoji: '📦' },
  confirmed:        { color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800', label: 'Confirmed', emoji: '✅' },
  preparing:        { color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800', label: 'Preparing', emoji: '👨‍🍳' },
  ready:            { color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800', label: 'Ready', emoji: '🍱' },
  out_for_delivery: { color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800', label: 'Out for Delivery', emoji: '🛵' },
  delivered:        { color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800', label: 'Delivered', emoji: '🎉' },
  cancelled:        { color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800', label: 'Cancelled', emoji: '❌' },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OrdersPage() {
  const { user, customer } = useAuth();
  const router = useRouter();
  const { addItem } = useCart();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cancelData, setCancelData] = useState<Order | null>(null);
  const [ratingOrder, setRatingOrder] = useState<Order | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // ─── Realtime orders listener ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'orders'), where('customerId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => {
        const data = d.data();
        let otp = data.deliveryOtp;
        if (!otp && !['delivered', 'cancelled'].includes(data.status || '')) {
          otp = (Math.abs(d.id.split('').reduce((acc: number, char: string) => (acc * 31 + char.charCodeAt(0)) | 0, 0)) % 9000 + 1000).toString();
          updateDoc(doc(db, 'orders', d.id), { deliveryOtp: otp }).catch(() => {});
        }
        return {
          ...data,
          id: d.id,
          deliveryOtp: otp,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
        };
      }) as Order[];
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(list);
      setLoading(false);
    }, err => { console.error(err); setLoading(false); });
    return () => unsub();
  }, [user]);

  // ─── Filtered orders ────────────────────────────────────────────────────────
  const filtered = orders.filter(o => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchSearch = !searchQuery ||
      o.restaurantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.id?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status || ''));

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const handleReorder = (order: Order) => {
    if (!order.items) return;
    order.items.forEach(item => addItem({
      menuItemId: item.menuItemId, restaurantId: order.restaurantId || '',
      name: item.name, price: item.price,
      ...(item.basePrice !== undefined ? { basePrice: item.basePrice } : {}),
      image: item.image, quantity: item.quantity,
      restaurantName: order.restaurantName || '',
      ...(item.spiceLevel ? { spiceLevel: item.spiceLevel } : {}),
      ...(item.selectedSize ? { selectedSize: item.selectedSize } : {}),
      ...(item.selectedAddOns?.length ? { selectedAddOns: item.selectedAddOns } : {}),
      ...(item.specialInstructions ? { specialInstructions: item.specialInstructions } : {}),
      id: `reorder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, addedAt: new Date()
    }));
    router.push('/customer/cart');
    toast.success('Items added to cart!');
  };

  const handleCancel = async (order: Order) => {
    if (!order.id) return;
    try {
      await updateDoc(doc(db, 'orders', order.id), { status: 'cancelled', cancelledAt: serverTimestamp() });
      if (order.customerId) {
        notifyOrderStatusUpdate({ orderId: order.id, customerId: order.customerId, status: 'cancelled', restaurantName: order.restaurantName })
          .catch(console.error);
      }
      toast.success('Order cancelled');
      setCancelData(null);
    } catch { toast.error('Failed to cancel order'); }
  };

  const submitRating = async () => {
    if (!user || !ratingOrder) return;
    setSubmittingRating(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        customerId: user.uid, orderId: ratingOrder.id, restaurantId: ratingOrder.restaurantId,
        restaurantName: ratingOrder.restaurantName, rating: ratingValue, comment: ratingComment,
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'users', user.uid), { rewardPoints: increment(20) });
      await updateDoc(doc(db, 'orders', ratingOrder.id!), { isRated: true });
      toast.success('🎉 Review submitted! +20 reward points!');
      setRatingOrder(null);
    } catch { toast.error('Failed to submit review'); }
    finally { setSubmittingRating(false); }
  };

  const formatDate = (d: any) => {
    if (!d) return '';
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">Loading your orders...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-foreground pb-28 font-sans">
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

        {/* ─── Header ───────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Your Orders</h1>
              <p className="text-xs text-muted-foreground">{orders.length} total · {activeOrders.length} active</p>
            </div>
          </div>
          {activeOrders.length > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-950/20 px-3 py-1.5 rounded-2xl border border-orange-200 dark:border-orange-800">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-xs font-bold text-orange-700 dark:text-orange-400">{activeOrders.length} Live</span>
            </div>
          )}
        </motion.div>

        {/* ─── Active Order Highlight ────────────────────────────────────────── */}
        <AnimatePresence>
          {activeOrders.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="cursor-pointer"
              onClick={() => router.push(`/customer/orders/tracking/${activeOrders[0].id}`)}
            >
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-500 to-amber-500 p-5 text-white shadow-xl shadow-orange-500/25">
                {/* Animated bg stripes */}
                <div className="absolute inset-0 opacity-10">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="absolute h-full w-8 bg-white/30"
                      style={{ left: `${i * 20}%`, transform: 'skewX(-20deg)' }} />
                  ))}
                </div>
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-xs font-semibold uppercase tracking-widest mb-1">🔴 Live Order</p>
                    <p className="font-black text-xl">{activeOrders[0].restaurantName}</p>
                    <p className="text-orange-100 text-sm mt-0.5">
                      {STATUS_CONFIG[activeOrders[0].status || 'pending']?.emoji} {' '}
                      {STATUS_CONFIG[activeOrders[0].status || 'pending']?.label}
                    </p>
                    <ETABadge orderCreatedAt={activeOrders[0].createdAt} estimatedMins={(activeOrders[0] as any).estimatedDeliveryMinutes} />

                    {/* Delivery OTP on Live Order Banner */}
                    <div className="mt-3 inline-flex items-center gap-2 bg-black/25 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/20 shadow-xs">
                      <ShieldCheck className="w-4 h-4 text-amber-300" />
                      <span className="text-xs font-bold text-orange-100">Delivery OTP:</span>
                      <span className="font-mono font-black text-sm tracking-widest text-white select-all">
                        {activeOrders[0].deliveryOtp || '----'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl animate-bounce">
                      {STATUS_CONFIG[activeOrders[0].status || 'pending']?.emoji || '🛵'}
                    </div>
                    <span className="text-xs text-orange-100 font-semibold">Track Live →</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Search + Filter Bar ───────────────────────────────────────────── */}
        {orders.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="space-y-3">
            {/* Search */}
            <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-4 py-2.5">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by restaurant or order ID..."
                className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {/* Status filters */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {['all', 'out_for_delivery', 'preparing', 'delivered', 'cancelled'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    filterStatus === s
                      ? 'bg-primary text-primary-foreground border-primary shadow-md'
                      : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {s === 'all' ? `All (${orders.length})` :
                   s === 'out_for_delivery' ? '🛵 Active' :
                   s === 'preparing' ? '👨‍🍳 Cooking' :
                   s === 'delivered' ? '✅ Done' : '❌ Cancelled'}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── Empty State ───────────────────────────────────────────────────── */}
        {filtered.length === 0 && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-20 bg-card/80 rounded-3xl border border-border">
            <div className="w-20 h-20 bg-muted/60 rounded-full flex items-center justify-center mx-auto mb-5">
              <Package className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-black mb-2">
              {searchQuery ? 'No matches found' : filterStatus !== 'all' ? 'No orders in this category' : 'No orders yet'}
            </h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
              {searchQuery ? `No orders matching "${searchQuery}"` : 'Explore top dishes and place your first order!'}
            </p>
            <Link href="/customer">
              <Button className="rounded-2xl px-8 h-12 font-bold shadow-lg">Browse Food</Button>
            </Link>
          </motion.div>
        )}

        {/* ─── Orders List ───────────────────────────────────────────────────── */}
        <AnimatePresence mode="popLayout">
          {filtered.map((order, idx) => {
            const cfg = STATUS_CONFIG[order.status || 'pending'] || STATUS_CONFIG.pending;
            const isActive = !['delivered', 'cancelled'].includes(order.status || '');
            const isExpanded = expandedOrderId === order.id;

            return (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: idx * 0.04, type: 'spring', stiffness: 200 }}
                className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="h-1 bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400 animate-pulse" />
                )}

                {/* Order header (clickable) */}
                <div
                  className="p-4 sm:p-5 cursor-pointer"
                  onClick={() => router.push(`/customer/orders/${order.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-primary/8 flex items-center justify-center flex-shrink-0 text-xl group-hover:scale-105 transition-transform">
                        {cfg.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-base truncate group-hover:text-primary transition-colors">
                          {order.restaurantName || 'Restaurant'}
                        </p>
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                          <span className="text-xs text-muted-foreground font-mono font-bold">
                            #{formatOrderId(order.id)}
                          </span>
                          <span className="text-muted-foreground text-xs">·</span>
                          <span className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</span>
                        </div>
                        {isActive && (
                          <div className="mt-1">
                            <ETABadge orderCreatedAt={order.createdAt} estimatedMins={(order as any).estimatedDeliveryMinutes} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <Badge className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border ${cfg.color}`}>
                        {cfg.label.toUpperCase()}
                      </Badge>
                      <span className="font-black text-sm text-primary">₹{order.total?.toFixed(0)}</span>
                    </div>
                  </div>
                </div>

                {/* Mini tracking strip for active orders */}
                {isActive && <MiniTrackingStrip order={order} />}

                {/* Delivery Verification OTP Ribbon for Active Orders */}
                {isActive && (
                  <div className="mx-4 sm:mx-5 my-2.5 px-3.5 py-2 rounded-2xl bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/25 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                      <span className="text-xs font-bold text-foreground">Delivery Verification OTP:</span>
                      <span className="text-sm font-black font-mono tracking-widest text-orange-600 dark:text-orange-400 bg-orange-500/15 px-2.5 py-0.5 rounded-lg border border-orange-500/30 select-all">
                        {order.deliveryOtp || '----'}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (order.deliveryOtp) {
                          await copyToClipboard(order.deliveryOtp);
                          toast.success('Delivery OTP copied: ' + order.deliveryOtp);
                        }
                      }}
                      className="h-7 text-xs font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 px-2 gap-1 rounded-lg"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </Button>
                  </div>
                )}

                {/* Order items preview (expandable) */}
                <div className="px-4 sm:px-5 pb-0">
                  <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96' : 'max-h-0'}`}>
                    <div className="py-3 border-t border-border/60 space-y-2">
                      {order.items?.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            <span className="text-foreground font-semibold">{item.quantity}×</span> {item.name}
                          </span>
                          <span className="font-semibold">₹{(item.price * item.quantity).toFixed(0)}</span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-border/40 flex justify-between text-sm font-black">
                        <span>Total</span>
                        <span className="text-primary">₹{order.total?.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions footer */}
                <div className="px-4 sm:px-5 py-3 flex flex-wrap gap-2 items-center justify-between border-t border-border/50 bg-muted/20"
                  onClick={e => e.stopPropagation()}>
                  {/* Toggle expand */}
                  <button
                    onClick={() => setExpandedOrderId(isExpanded ? null : (order.id || null))}
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                  >
                    {order.items?.length} item{order.items?.length !== 1 ? 's' : ''}
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>

                  <div className="flex items-center gap-2 ml-auto">
                    {/* Reorder */}
                    <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs font-bold gap-1"
                      onClick={() => handleReorder(order)}>
                      <RefreshCw className="w-3 h-3" /> Reorder
                    </Button>

                    {/* Rate — delivered & not rated */}
                    {order.status === 'delivered' && !(order as any).isRated && (
                      <Button size="sm" onClick={() => setRatingOrder(order)}
                        className="h-8 rounded-xl text-xs font-bold gap-1 bg-amber-500 hover:bg-amber-400 text-white border-0">
                        <Star className="w-3 h-3" /> Rate
                      </Button>
                    )}

                    {/* Cancel — only pending */}
                    {order.status === 'pending' && (
                      <Button variant="outline" size="sm" onClick={() => setCancelData(order)}
                        className="h-8 rounded-xl text-xs font-bold text-destructive border-destructive/30 hover:bg-destructive/10">
                        <X className="w-3 h-3" /> Cancel
                      </Button>
                    )}

                    {/* Track / Details */}
                    {isActive ? (
                      <Button size="sm" onClick={() => router.push(`/customer/orders/tracking/${order.id}`)}
                        className="h-8 rounded-xl text-xs font-black gap-1 bg-orange-500 hover:bg-orange-400 text-white border-0 shadow-sm shadow-orange-500/30">
                        <Navigation className="w-3 h-3" /> Track Live
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => router.push(`/customer/orders/${order.id}`)}
                        className="h-8 rounded-xl text-xs font-bold gap-1">
                        Details <ChevronRight className="w-3 h-3" />
                      </Button>
                    )}

                    <InvoiceButton order={order} customer={customer} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ─── Cancel Dialog ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {cancelData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-card rounded-3xl p-6 w-full max-w-sm border border-border shadow-2xl">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <h3 className="font-black text-center text-lg mb-2">Cancel Order?</h3>
              <p className="text-sm text-muted-foreground text-center mb-5">
                Cancel <strong>{cancelData.restaurantName}</strong> order? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setCancelData(null)} className="flex-1 rounded-2xl">Keep Order</Button>
                <Button onClick={() => handleCancel(cancelData)} className="flex-1 rounded-2xl bg-destructive text-destructive-foreground">Cancel Order</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Rating Dialog ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {ratingOrder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80 }}
              className="bg-card rounded-3xl p-6 w-full max-w-md border border-border shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-lg">Rate Your Experience</h3>
                <button onClick={() => setRatingOrder(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">from <strong>{ratingOrder.restaurantName}</strong></p>
              <div className="flex justify-center gap-2 mb-5">
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => setRatingValue(s)} className="text-3xl transition-transform hover:scale-110 active:scale-95">
                    {s <= ratingValue ? '⭐' : '☆'}
                  </button>
                ))}
              </div>
              <textarea
                value={ratingComment}
                onChange={e => setRatingComment(e.target.value)}
                placeholder="Share your experience..."
                rows={3}
                className="w-full rounded-2xl border border-border bg-muted/40 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              />
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 mb-4 border border-amber-200 dark:border-amber-800">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">+20 reward points for reviewing!</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setRatingOrder(null)} className="flex-1 rounded-2xl">Cancel</Button>
                <Button onClick={submitRating} disabled={submittingRating} className="flex-1 rounded-2xl bg-amber-500 hover:bg-amber-400 text-white border-0 font-bold">
                  {submittingRating ? 'Submitting...' : 'Submit Review'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
