'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, Restaurant, DeliveryPerson, DeliveryStage, getStageLabel, getStageColor } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  MapPin,
  Phone,
  ArrowLeft,
  Check,
  Bike,
  ShoppingBag,
  UtensilsCrossed,
  ChefHat,
  Star,
  Copy,
  Calendar,
  CreditCard,
  Wallet,
  AlertTriangle,
  FileText,
  Sparkles,
  CheckCircle2,
  Mail,
  ShieldCheck,
  RefreshCw,
  Navigation
} from 'lucide-react';
import Link from 'next/link';
import SafeImage from '@/components/ui/safe-image';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import InvoiceButton from '../InvoiceButton';
import { toast } from 'sonner';

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const { user, customer } = useAuth();
  const { addItem } = useCart();

  const [order, setOrder] = useState<Order | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [deliveryPerson, setDeliveryPerson] = useState<DeliveryPerson | null>(null);
  const [loading, setLoading] = useState(true);

  // Real-time order tracking
  useEffect(() => {
    if (!orderId) return;

    const unsubscribe = onSnapshot(doc(db, 'orders', orderId), async (docSnapshot) => {
      if (docSnapshot.exists()) {
        const orderData = {
          ...docSnapshot.data(),
          id: docSnapshot.id,
          createdAt: docSnapshot.data().createdAt?.toDate
            ? docSnapshot.data().createdAt.toDate()
            : new Date(docSnapshot.data().createdAt || Date.now())
        } as Order;
        setOrder(orderData);

        // Fetch restaurant details
        if (orderData.restaurantId) {
          const restaurantDoc = doc(db, 'restaurants', orderData.restaurantId);
          onSnapshot(restaurantDoc, (doc) => {
            if (doc.exists()) {
              setRestaurant({
                ...doc.data(),
                id: doc.id,
              } as Restaurant);
            }
          });
        }

        // Fetch delivery person if assigned
        if (orderData.deliveryPersonId) {
          const deliveryDoc = doc(db, 'deliveryPersons', orderData.deliveryPersonId);
          onSnapshot(deliveryDoc, (doc) => {
            if (doc.exists()) {
              setDeliveryPerson({
                ...doc.data(),
                id: doc.id,
              } as DeliveryPerson);
            }
          });
        }
      }
      setLoading(false);
    }, (err) => {
      console.error('Error listening to order:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [orderId]);

  const orderStatusSteps = [
    {
      key: 'pending',
      label: 'Order Placed & Confirmed',
      icon: ShoppingBag,
      description: 'Your order has been recorded and broadcast to the kitchen.',
      getTime: (ord: Order) => formatExactTime(ord.createdAt)
    },
    {
      key: 'preparing',
      label: 'Kitchen Preparing Meal',
      icon: UtensilsCrossed,
      description: 'The chef is actively preparing your fresh culinary items.',
      getTime: (ord: Order) => getCalculatedTime(ord.createdAt, 5, (ord as any).confirmedAt)
    },
    {
      key: 'ready',
      label: 'Food Packed & Ready',
      icon: Check,
      description: 'Quality check complete. Awaiting delivery partner pickup.',
      getTime: (ord: Order) => getCalculatedTime(ord.createdAt, 18, (ord as any).readyAt)
    },
    {
      key: 'out_for_delivery',
      label: 'Out for Delivery',
      icon: Bike,
      description: order?.delivery?.stage
        ? (order.delivery.stage === 'TO_PICKUP' ? 'Driver is heading to the restaurant to collect your food.' :
           order.delivery.stage === 'ARRIVED_PICKUP' ? 'Driver has arrived at the restaurant, awaiting food handover.' :
           order.delivery.stage === 'ARRIVED_CUSTOMER' ? 'Driver has arrived at your location! Please collect your order.' :
           'Your delivery hero has picked up your food and is speeding towards your doorstep.')
        : 'Your delivery hero is speeding towards your doorstep.',
      getTime: (ord: Order) => getCalculatedTime(ord.createdAt, 25, (ord as any).outForDeliveryAt)
    },
    {
      key: 'delivered',
      label: 'Delivered at Doorstep',
      icon: CheckCircle2,
      description: 'Order handed over successfully. Enjoy your delicious food!',
      getTime: (ord: Order) => (ord.deliveredAt ? formatExactTime(ord.deliveredAt) : getCalculatedTime(ord.createdAt, 35, null))
    },
  ];

  const getStatusIndex = (status: string) => {
    if (status === 'confirmed') return 0;
    return orderStatusSteps.findIndex((step) => step.key === status);
  };

  const currentStatusIndex = order ? getStatusIndex(order.status || 'pending') : -1;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
      case 'confirmed': return 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30';
      case 'preparing': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'ready': return 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30';
      case 'out_for_delivery': return 'bg-primary/15 text-primary border-primary/30';
      case 'delivered': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'cancelled': return 'bg-destructive/15 text-destructive border-destructive/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const formatExactTime = (dateInput: any) => {
    if (!dateInput) return '';
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatFullDate = (dateInput: any) => {
    if (!dateInput) return '';
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getCalculatedTime = (baseDate: any, addMinutes: number, explicitDate: any) => {
    if (explicitDate) return formatExactTime(explicitDate);
    if (!baseDate) return '';
    const d = new Date(baseDate instanceof Date ? baseDate.getTime() : new Date(baseDate).getTime());
    d.setMinutes(d.getMinutes() + addMinutes);
    return formatExactTime(d);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const handleReorder = () => {
    if (!order?.items) return;
    order.items.forEach(item => {
      addItem({
        menuItemId: item.menuItemId,
        restaurantId: order.restaurantId || '',
        name: item.name,
        price: item.price,
        image: item.image,
        quantity: item.quantity,
        restaurantName: order.restaurantName || restaurant?.name || 'Restaurant',
        id: `reorder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        addedAt: new Date()
      });
    });
    router.push('/customer/cart');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen text-foreground flex items-center justify-center p-4">
        <div className="text-center bg-card p-8 sm:p-10 rounded-3xl border border-border max-w-md w-full shadow-xl">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 text-muted-foreground">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black mb-2 text-foreground">Order Not Found</h2>
          <p className="text-muted-foreground text-sm mb-6">We could not locate this order or it may have expired.</p>
          <Button onClick={() => router.push('/customer/orders')} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold h-12 shadow-md">
            Back to Orders List
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-28 md:pb-16 font-sans selection:bg-primary/20">

      {/* Ambient Lighting Gradients */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[140px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10">

        {/* 1. Header Navigation & Order Summary Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 pb-5 border-b border-border/70">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push('/customer/orders')}
              className="rounded-full bg-card hover:bg-accent text-foreground border-border shadow-xs"
              title="Back to all orders"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black flex items-center gap-2 text-foreground tracking-tight">
                  Order #{order.id ? order.id.slice(-8).toUpperCase() : 'ORDER'}
                </h1>
                <button
                  onClick={() => order.id && copyToClipboard(order.id, 'Order ID')}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy full Order ID"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 flex items-center gap-2 flex-wrap">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>Placed on {formatFullDate(order.createdAt)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
            <Badge className={`${getStatusColor(order.status || 'pending')} border px-3.5 py-1.5 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xl`}>
              {(order.status === 'pending' ? 'Order Placed' : order.status || '').replace('_', ' ')}
            </Badge>

            {/* Live Tracking Button */}
            {order.status !== 'delivered' && order.status !== 'cancelled' && (
              <Link href={`/customer/orders/${orderId}/tracking`}>
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 px-3.5 py-1.5 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xl cursor-pointer gap-1.5 transition-colors shadow-xs">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Track Live Map ➔
                </Badge>
              </Link>
            )}

            <InvoiceButton order={order} customer={customer} />
          </div>
        </div>

        {/* Cancellation Alert (If order is cancelled) */}
        {order.status === 'cancelled' && (
          <div className="mb-6 bg-destructive/10 border-2 border-destructive/30 rounded-3xl p-5 sm:p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-destructive/20 text-destructive flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-base sm:text-lg text-destructive">This Order was Cancelled</h3>
              <p className="text-xs sm:text-sm text-foreground/80 mt-1 leading-relaxed">
                Order #{order.id ? order.id.slice(-6).toUpperCase() : 'ORDER'} was cancelled on {formatFullDate((order as any).cancelledAt || order.updatedAt || order.createdAt)}.
                {order.paymentMethod === 'online' && ' Any deducted amount will be refunded to your original payment source within 3-5 business days.'}
              </p>
              <div className="mt-3">
                <Button
                  size="sm"
                  onClick={handleReorder}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reorder Dishes
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Key Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-card border border-border/70 rounded-2xl p-3.5 sm:p-4 shadow-xs">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
              Order Placed
            </span>
            <span className="text-sm sm:text-base font-bold text-foreground">
              {formatExactTime(order.createdAt)}
            </span>
          </div>

          <div className="bg-card border border-border/70 rounded-2xl p-3.5 sm:p-4 shadow-xs">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
              Estimated Delivery
            </span>
            <span className="text-sm sm:text-base font-bold text-primary">
              {order.status === 'delivered' ? 'Delivered' : `${getCalculatedTime(order.createdAt, 35, null)} (~35m)`}
            </span>
          </div>

          <div className="bg-card border border-border/70 rounded-2xl p-3.5 sm:p-4 shadow-xs">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
              Payment Method
            </span>
            <span className="text-sm sm:text-base font-bold text-foreground capitalize">
              {order.paymentMethod === 'cod'
                ? 'Cash On Delivery'
                : order.paymentMethod === 'wallet'
                ? 'AKR Hunger Wallet'
                : 'Online (Prepaid)'}
            </span>
          </div>

          <div className="bg-card border border-border/70 rounded-2xl p-3.5 sm:p-4 shadow-xs">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
              Grand Total
            </span>
            <span className="text-sm sm:text-base font-black text-foreground">
              ₹{order.total}
            </span>
          </div>
        </div>

        {/* 3. Main Two-Column Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

          {/* Left Column: Tracking Timeline & Order Items (7 cols) */}
          <div className="lg:col-span-7 space-y-6">

            {/* Live Tracking & Timing Timeline */}
            <div className="bg-card border border-border/70 rounded-3xl p-5 sm:p-7 relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-foreground">
                  <Clock className="w-5 h-5 text-primary" /> Live Order Tracking & Timing
                </h2>
                <Badge variant="outline" className="text-[11px] border-border text-muted-foreground">
                  Realtime Sync
                </Badge>
              </div>

              <div className="space-y-6 relative">
                {/* Vertical Line */}
                <div className="absolute left-[19px] top-3 bottom-3 w-0.5 bg-border" />

                {orderStatusSteps.map((step, idx) => {
                  const isCompleted = idx <= currentStatusIndex;
                  const isCurrent = idx === currentStatusIndex;
                  const StepIcon = step.icon;
                  const stepTime = step.getTime(order);

                  return (
                    <div key={step.key} className="flex gap-4 relative z-10 group">
                      {/* Timeline Icon */}
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all duration-300 flex-shrink-0 ${
                          isCompleted
                            ? 'bg-primary border-primary text-primary-foreground shadow-md shadow-primary/25'
                            : 'bg-card border-border text-muted-foreground'
                        }`}
                      >
                        {isCompleted ? <Check className="w-5 h-5 stroke-[2.5]" /> : <StepIcon className="w-4 h-4" />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 pt-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3
                            className={`font-bold text-sm sm:text-base ${
                              isCompleted ? 'text-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            {step.label}
                          </h3>
                          {stepTime && (
                            <span className="text-xs font-mono font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                              {stepTime}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {step.description}
                        </p>

                        {isCurrent && order.status !== 'cancelled' && order.status !== 'delivered' && (
                          <div className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full animate-pulse border border-primary/20">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            Current Active Stage
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Delivery Confirmation OTP Code */}
            {order.deliveryOtp && order.status !== 'delivered' && order.status !== 'cancelled' && (
              <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/30 rounded-3xl p-6 text-center shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <h3 className="text-primary uppercase text-xs font-black tracking-widest">
                    Delivery Verification OTP
                  </h3>
                </div>
                <div className="text-4xl sm:text-5xl font-black text-foreground tracking-[0.35em] font-mono my-2 select-all">
                  {order.deliveryOtp}
                </div>
                <p className="text-muted-foreground text-xs max-w-sm mx-auto">
                  Share this 4-digit security code with the delivery partner upon arrival to confirm delivery.
                </p>
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(order.deliveryOtp!, 'Delivery OTP')}
                    className="border-primary/40 text-primary hover:bg-primary/10 rounded-xl text-xs font-bold gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Code
                  </Button>
                </div>
              </div>
            )}

            {/* Delivery Hero Card (If Assigned) */}
            {deliveryPerson ? (
              <div className="bg-card border border-border/70 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-muted relative overflow-hidden border-2 border-emerald-500 shadow-md flex-shrink-0">
                  {deliveryPerson.avatar ? (
                    <SafeImage src={deliveryPerson.avatar} alt={deliveryPerson.name} className="object-cover" fallbackType="generic" fill />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted text-foreground text-xl font-bold">
                      {deliveryPerson.name[0]}
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-card" />
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap mb-0.5">
                    <h3 className="font-bold text-base sm:text-lg text-foreground">
                      {deliveryPerson.name}
                    </h3>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-md font-normal border border-border">Delivery Partner</span>
                    {order.delivery?.stage && (
                      <Badge className={`border text-[11px] font-bold ${getStageColor(order.delivery.stage).bg} ${getStageColor(order.delivery.stage).text} ${getStageColor(order.delivery.stage).border}`}>
                        {getStageLabel(order.delivery.stage)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs sm:text-sm mb-1.5">{deliveryPerson.vehicle} • {deliveryPerson.vehicleNumber}</p>
                  <div className="flex items-center justify-center sm:justify-start gap-1 text-amber-500 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-500" /> {(deliveryPerson.rating || 4.8).toFixed(1)} Rating
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto flex-col sm:flex-row">
                  {order.status !== 'delivered' && order.status !== 'cancelled' && (
                    <Link href={`/customer/orders/${orderId}/tracking`} className="w-full sm:w-auto">
                      <Button className="w-full sm:w-auto rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 shadow-md gap-1.5">
                        <Navigation className="w-4 h-4" /> Track Live
                      </Button>
                    </Link>
                  )}
                  {deliveryPerson.phone && (
                    <a href={`tel:${deliveryPerson.phone}`} className="w-full sm:w-auto">
                      <Button variant="outline" className="w-full sm:w-auto rounded-xl border-border hover:bg-muted font-bold px-4 shadow-sm">
                        <Phone className="w-4 h-4 mr-2 text-emerald-500" /> Call
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            ) : (
              order.status !== 'delivered' && order.status !== 'cancelled' && (
                <div className="bg-card border border-dashed border-border rounded-3xl p-6 text-center text-muted-foreground">
                  <Bike className="w-8 h-8 mx-auto mb-2 opacity-60 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Delivery Partner Assignment in Progress</p>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-md mx-auto">
                    The kitchen is preparing your meal. Live GPS route is active on our interactive map.
                  </p>
                  <div className="mt-4">
                    <Link href={`/customer/orders/${orderId}/tracking`}>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-5 text-xs gap-1.5 shadow-md shadow-emerald-600/20">
                        <Navigation className="w-3.5 h-3.5" /> Open Live Map Tracking ➔
                      </Button>
                    </Link>
                  </div>
                </div>
              )
            )}

            {/* Order Items Breakdown */}
            <div className="bg-card border border-border/70 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-4 sm:p-6 border-b border-border/70 bg-muted/30 flex justify-between items-center">
                <h2 className="font-bold text-base sm:text-lg flex items-center gap-2 text-foreground">
                  <ShoppingBag className="w-5 h-5 text-primary" /> Ordered Dishes ({order.items?.length || 0})
                </h2>
                <span className="text-xs font-bold text-muted-foreground">
                  {order.items?.reduce((s, i) => s + i.quantity, 0)} total quantity
                </span>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                {order.items?.map((item, idx) => (
                  <div key={`${item.menuItemId}-${idx}`} className="flex gap-3 sm:gap-4 items-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-muted relative overflow-hidden border border-border flex-shrink-0">
                      <SafeImage src={item.image} alt={item.name} className="object-cover" fallbackType="food" fill />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-sm sm:text-base text-foreground truncate">{item.name}</h4>
                        <span className="font-black text-foreground text-sm sm:text-base whitespace-nowrap">
                          ₹{item.price * item.quantity}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Qty: <span className="font-bold text-foreground">{item.quantity}</span> × ₹{item.price}
                      </p>
                      {item.specialInstructions && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded mt-1 line-clamp-1 border border-amber-500/20">
                          Note: {item.specialInstructions}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Seller Details, Destination & Payment Summary (5 cols) */}
          <div className="lg:col-span-5 space-y-6">

            {/* Seller / Restaurant Details Card */}
            <div className="bg-card border border-border/70 rounded-3xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/60">
                <h3 className="text-muted-foreground font-bold uppercase text-xs tracking-wider flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-primary" /> Seller & Kitchen Details
                </h3>
                <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  Verified Partner
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-muted overflow-hidden border border-border relative flex-shrink-0">
                    <SafeImage
                      src={restaurant?.image}
                      alt={restaurant?.name || order.restaurantName || 'Restaurant'}
                      className="object-cover"
                      fallbackType="restaurant"
                      fill
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-foreground text-base sm:text-lg truncate">
                        {restaurant?.name || order.restaurantName || 'Gourmet Restaurant'}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span className="font-bold text-foreground">{(restaurant?.rating || restaurant?.averageRating || 4.5).toFixed(1)}</span>
                      <span>•</span>
                      <span className="truncate">{restaurant?.cuisineType?.join(', ') || 'Multi-cuisine'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                      {restaurant?.address || order.restaurantAddress || 'Registered Kitchen Location'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  {restaurant?.phone && (
                    <a href={`tel:${restaurant.phone}`}>
                      <Button variant="outline" className="w-full border-border hover:bg-muted font-bold rounded-xl text-foreground text-xs sm:text-sm h-10">
                        <Phone className="w-4 h-4 mr-2 text-primary" /> Call Restaurant ({restaurant.phone})
                      </Button>
                    </a>
                  )}
                  {restaurant?.id && (
                    <Link href={`/customer/restaurant/${restaurant.id}`}>
                      <Button variant="ghost" className="w-full text-primary hover:bg-primary/10 font-bold rounded-xl text-xs h-9">
                        View Full Restaurant Menu
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Delivery Destination Card */}
            <div className="bg-card border border-border/70 rounded-3xl p-5 sm:p-6 shadow-sm">
              <h3 className="text-muted-foreground font-bold uppercase text-xs tracking-wider mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> Delivery Destination
              </h3>
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary border border-primary/20">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm sm:text-base capitalize mb-0.5 flex items-center gap-2">
                    {order.deliveryAddress && typeof order.deliveryAddress !== 'string' ? order.deliveryAddress.type : 'Saved Address'}
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md uppercase">
                      Drop Location
                    </span>
                  </p>
                  <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed mt-1">
                    {order.deliveryAddress && typeof order.deliveryAddress !== 'string'
                      ? `${order.deliveryAddress.street || ''}, ${order.deliveryAddress.city || ''}, ${order.deliveryAddress.state || ''} ${order.deliveryAddress.pincode || ''}`
                      : (order.deliveryAddress || 'Address on file')}
                  </p>
                  {order.customerPhone && (
                    <p className="text-xs text-foreground font-medium mt-2 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-primary" /> Recipient: {order.customerName || 'Customer'} ({order.customerPhone})
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Complete Payment & Transaction Summary */}
            <div className="bg-card border border-border/70 rounded-3xl p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/70">
                <h3 className="text-muted-foreground font-bold uppercase text-xs tracking-wider flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" /> Payment Summary
                </h3>
                <span className="text-xs font-bold text-primary capitalize">
                  {order.paymentMethod === 'cod'
                    ? 'Cash on Delivery'
                    : order.paymentMethod === 'wallet'
                    ? 'AKR Hunger Wallet'
                    : 'Online / UPI'}
                </span>
              </div>

              <div className="space-y-3 text-xs sm:text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Item Total</span>
                  <span className="text-foreground font-semibold">₹{order.subtotal || 0}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery Partner Fee</span>
                  <span className="text-foreground font-semibold">₹{order.deliveryCharge || 0}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Govt. Taxes & Restaurant Packaging</span>
                  <span className="text-foreground font-semibold">₹{order.taxes || 0}</span>
                </div>

                {order.discountAmount ? (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>Discount Applied</span>
                    <span>-₹{order.discountAmount}</span>
                  </div>
                ) : null}

                <div className="h-px bg-border my-2" />

                <div className="flex justify-between items-center text-base">
                  <span className="font-bold text-foreground">Total Amount</span>
                  <span className="font-black text-2xl text-primary">₹{order.total || 0}</span>
                </div>

                {/* Status & Online Reference */}
                <div
                  className={`mt-4 p-3 rounded-2xl border text-center font-bold text-xs uppercase tracking-wide ${
                    order.paymentStatus === 'completed'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  Payment Status: {order.paymentStatus || 'Pending'}
                </div>

                {order.razorpayPaymentId && (
                  <div className="mt-3 p-3 bg-muted/40 rounded-xl border border-border text-xs space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Transaction Reference</span>
                    <div className="flex justify-between items-center font-mono text-foreground font-semibold">
                      <span className="truncate max-w-[200px]">{order.razorpayPaymentId}</span>
                      <button
                        onClick={() => copyToClipboard(order.razorpayPaymentId!, 'Transaction ID')}
                        className="text-primary hover:underline text-[11px] font-bold uppercase"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-3">
                  <InvoiceButton order={order} customer={customer} />
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

