'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { syncExistingOrderNotifications } from '@/lib/customer-notifications';
import { Notification } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Bell,
  Package,
  CreditCard,
  Wallet,
  Tag,
  Info,
  Check,
  CheckCheck,
  Trash2,
  Clock,
  ChevronRight,
  ExternalLink,
  Search,
  Filter,
  AlertCircle,
  AlertTriangle,
  ShoppingBag,
  ChefHat,
  Bike,
  CheckCircle2,
  XCircle,
  Banknote,
  RotateCcw,
  Sparkles,
  ArrowRight,
  LogIn,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import WebPushManagerCard from '@/components/notifications/WebPushManagerCard';

type CategoryFilter = 'all' | 'order' | 'payment' | 'promo' | 'system';
type ReadFilter = 'all' | 'unread';

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
  } = useNotifications();

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync past orders when user loads notifications page
  useEffect(() => {
    if (user?.uid) {
      setIsSyncing(true);
      syncExistingOrderNotifications(user.uid)
        .catch((e) => console.error('Error syncing order notifications:', e))
        .finally(() => setIsSyncing(false));
    }
  }, [user?.uid]);

  // Format relative time
  const formatTimeAgo = (dateInput: Date | any) => {
    if (!dateInput) return 'Recently';
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return 'Recently';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 45) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  // Filter notifications based on category, read status, and search query
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      // Category filter
      if (categoryFilter === 'order') {
        if (notif.type !== 'order' && !notif.type.startsWith('order-')) return false;
      } else if (categoryFilter === 'payment') {
        if (
          notif.type !== 'payment' &&
          notif.type !== 'wallet' &&
          !notif.type.startsWith('payment-') &&
          !notif.type.startsWith('wallet-')
        )
          return false;
      } else if (categoryFilter === 'promo') {
        if (notif.type !== 'promo') return false;
      } else if (categoryFilter === 'system') {
        if (notif.type !== 'system' && notif.type !== 'alert') return false;
      }

      // Read filter
      const isRead = Boolean(notif.read || notif.isRead);
      if (readFilter === 'unread' && isRead) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = notif.title.toLowerCase().includes(query);
        const msgMatch = notif.message.toLowerCase().includes(query);
        const orderMatch = notif.orderId?.toLowerCase().includes(query);
        const restMatch = notif.metadata?.restaurantName?.toLowerCase().includes(query);
        if (!titleMatch && !msgMatch && !orderMatch && !restMatch) return false;
      }

      return true;
    });
  }, [notifications, categoryFilter, readFilter, searchQuery]);

  // Counts per category for badge indicators
  const counts = useMemo(() => {
    const orderCount = notifications.filter(
      (n) => n.type === 'order' || n.type.startsWith('order-')
    ).length;
    const paymentCount = notifications.filter(
      (n) =>
        n.type === 'payment' ||
        n.type === 'wallet' ||
        n.type.startsWith('payment-') ||
        n.type.startsWith('wallet-')
    ).length;
    const promoCount = notifications.filter((n) => n.type === 'promo').length;
    const systemCount = notifications.filter(
      (n) => n.type === 'system' || n.type === 'alert'
    ).length;

    return {
      all: notifications.length,
      order: orderCount,
      payment: paymentCount,
      promo: promoCount,
      system: systemCount,
    };
  }, [notifications]);

  // Get icon and color scheme for each notification type
  const getNotificationVisuals = (notif: Notification) => {
    const type = notif.type;
    const subType = notif.subType || '';

    // Order subtypes
    if (subType === 'order-delivered' || type === 'order-delivered') {
      return {
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
        bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
        badge: 'Delivered',
        badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      };
    }
    if (subType === 'order-out-for-delivery' || type === 'order-out-for-delivery') {
      return {
        icon: <Bike className="w-5 h-5 text-purple-500" />,
        bg: 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400',
        badge: 'Out for Delivery',
        badgeColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
      };
    }
    if (subType === 'order-preparing' || type === 'order-preparing') {
      return {
        icon: <ChefHat className="w-5 h-5 text-amber-500" />,
        bg: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
        badge: 'Cooking',
        badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      };
    }
    if (subType === 'order-ready' || type === 'order-ready') {
      return {
        icon: <ShoppingBag className="w-5 h-5 text-teal-500" />,
        bg: 'bg-teal-500/10 border-teal-500/20 text-teal-600 dark:text-teal-400',
        badge: 'Ready',
        badgeColor: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30',
      };
    }
    if (subType === 'order-cancelled' || type === 'order-cancelled') {
      return {
        icon: <XCircle className="w-5 h-5 text-rose-500" />,
        bg: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400',
        badge: 'Cancelled',
        badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      };
    }
    if (subType === 'order-confirmed' || type === 'order-confirmed') {
      return {
        icon: <Check className="w-5 h-5 text-blue-500" />,
        bg: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
        badge: 'Confirmed',
        badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
      };
    }
    if (subType === 'order-placed' || type === 'order-placed' || type === 'order') {
      return {
        icon: <Package className="w-5 h-5 text-sky-500" />,
        bg: 'bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400',
        badge: 'Order Placed',
        badgeColor: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
      };
    }

    // Payment subtypes
    if (
      subType === 'payment-success' ||
      subType === 'wallet-debit' ||
      (type === 'payment' && !subType.includes('failed'))
    ) {
      return {
        icon: <CreditCard className="w-5 h-5 text-emerald-500" />,
        bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
        badge: 'Payment Received',
        badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      };
    }
    if (subType === 'wallet-credit' || type === 'wallet') {
      return {
        icon: <Wallet className="w-5 h-5 text-teal-500" />,
        bg: 'bg-teal-500/10 border-teal-500/20 text-teal-600 dark:text-teal-400',
        badge: 'Wallet Top-up',
        badgeColor: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30',
      };
    }
    if (subType === 'cod-pending') {
      return {
        icon: <Banknote className="w-5 h-5 text-amber-500" />,
        bg: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
        badge: 'Cash on Delivery',
        badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      };
    }
    if (subType === 'payment-failed' || type === 'payment-failed') {
      return {
        icon: <AlertTriangle className="w-5 h-5 text-rose-500" />,
        bg: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400',
        badge: 'Payment Failed',
        badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      };
    }

    // Promos
    if (type === 'promo') {
      return {
        icon: <Tag className="w-5 h-5 text-orange-500" />,
        bg: 'bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400',
        badge: 'Special Offer',
        badgeColor: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
      };
    }

    // Default System
    return {
      icon: <Info className="w-5 h-5 text-primary" />,
      bg: 'bg-primary/10 border-primary/20 text-primary',
      badge: 'System',
      badgeColor: 'bg-primary/15 text-primary border-primary/30',
    };
  };

  const handleCardClick = (notif: Notification) => {
    if (!notif.read && !notif.isRead) {
      markAsRead(notif.id);
    }
    if (notif.actionUrl) {
      router.push(notif.actionUrl);
    } else if (notif.orderId) {
      router.push(`/customer/orders/${notif.orderId}`);
    }
  };

  const handleConfirmClearAll = async () => {
    await clearAllNotifications();
    setIsClearDialogOpen(false);
    toast.success('All notifications cleared');
  };

  // Not logged in view
  if (!authLoading && !user) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6 bg-card/80 backdrop-blur-xl p-8 rounded-3xl border border-border/80 shadow-2xl">
          <div className="w-20 h-20 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto text-primary">
            <Bell className="w-10 h-10 animate-bounce-subtle" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground mb-2 tracking-tight">
              Sign In to View Notifications
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Login to track your live order updates, real-time payment receipts, delivery partner tracking, and exclusive discounts.
            </p>
          </div>
          <Link href="/customer/login" className="block">
            <Button className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl shadow-lg shadow-primary/20 gap-2">
              <LogIn className="w-4 h-4" /> Login to Hunger
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground pb-24 md:pb-16 font-sans selection:bg-primary/30">
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[140px]" />
      </div>

      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase tracking-widest font-bold text-primary flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Real-time Activity
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black flex items-center gap-3 text-foreground tracking-tight">
              Notifications
              {unreadCount > 0 && (
                <Badge className="bg-red-500 hover:bg-red-600 text-white border-none text-xs px-2.5 py-0.5 rounded-full font-black shadow-md shadow-red-500/20">
                  {unreadCount} New
                </Badge>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Live updates for your placed orders, payments, delivery partner assignments, and promotions.
            </p>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  markAllAsRead();
                  toast.success('Marked all as read');
                }}
                className="border-border hover:bg-accent text-foreground rounded-xl text-xs font-semibold h-9 px-3"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1.5 text-primary" /> Mark all read
              </Button>
            )}

            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsClearDialogOpen(true)}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl text-xs font-semibold h-9 px-3"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Clear all
              </Button>
            )}
          </div>
        </div>

        {/* Web Push Management & Testing Card */}
        <WebPushManagerCard role="customer" className="mb-6" />

        {/* Filter and Search Bar */}
        <div className="bg-card/70 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-border/70 shadow-sm mb-6 space-y-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'all'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              All
              <span className="text-[10px] opacity-80">({counts.all})</span>
            </button>

            <button
              onClick={() => setCategoryFilter('order')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'order'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Orders
              <span className="text-[10px] opacity-80">({counts.order})</span>
            </button>

            <button
              onClick={() => setCategoryFilter('payment')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'payment'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Payments
              <span className="text-[10px] opacity-80">({counts.payment})</span>
            </button>

            <button
              onClick={() => setCategoryFilter('promo')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'promo'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              Offers
              <span className="text-[10px] opacity-80">({counts.promo})</span>
            </button>

            <button
              onClick={() => setCategoryFilter('system')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'system'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              System
              <span className="text-[10px] opacity-80">({counts.system})</span>
            </button>
          </div>

          {/* Search & Read Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1 border-t border-border/50">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search orders, amounts, restaurant names..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 rounded-xl text-xs bg-muted/40 border-border/70 placeholder:text-muted-foreground focus:bg-background"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Read/Unread Filter */}
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/60 self-start sm:self-auto">
              <button
                onClick={() => setReadFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  readFilter === 'all'
                    ? 'bg-background text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setReadFilter('unread')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                  readFilter === 'unread'
                    ? 'bg-background text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Unread Only
                {unreadCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3 sm:space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredNotifications.length > 0 ? (
              filteredNotifications.map((n) => {
                const isRead = Boolean(n.read || n.isRead);
                const visual = getNotificationVisuals(n);
                const orderShortId = n.orderId ? n.orderId.slice(-6).toUpperCase() : null;
                const metadata = n.metadata || {};

                return (
                  <motion.div
                    key={n.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => handleCardClick(n)}
                    className={`group p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all duration-300 relative overflow-hidden backdrop-blur-md cursor-pointer ${
                      !isRead
                        ? 'bg-card border-primary/40 shadow-md shadow-primary/5 hover:border-primary/60'
                        : 'bg-card/75 border-border/60 hover:bg-card hover:border-border hover:shadow-xs'
                    }`}
                  >
                    {/* Unread Accent Bar on Left Edge */}
                    {!isRead && (
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
                    )}

                    <div className="flex gap-3.5 sm:gap-4 relative z-10 items-start">
                      {/* Icon */}
                      <div
                        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 border shadow-xs transition-transform group-hover:scale-105 ${visual.bg}`}
                      >
                        {visual.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Top Line: Badge + Title + Time + Pulse */}
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3
                              className={`text-sm sm:text-base leading-snug transition-colors ${
                                !isRead
                                  ? 'font-black text-foreground'
                                  : 'font-semibold text-foreground/80'
                              }`}
                            >
                              {n.title}
                            </h3>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold py-0 px-2 rounded-full ${visual.badgeColor}`}
                            >
                              {visual.badge}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded-full border border-border/40">
                              <Clock className="w-3 h-3 text-primary" /> {formatTimeAgo(n.createdAt)}
                            </span>
                            {!isRead && (
                              <div
                                className="w-2.5 h-2.5 bg-primary rounded-full shadow-xs animate-pulse"
                                title="Unread"
                              />
                            )}
                          </div>
                        </div>

                        {/* Message Description */}
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-3">
                          {n.message}
                        </p>

                        {/* Metadata Tag Chips (Order ID, Restaurant, Amount, OTP) */}
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          {orderShortId && (
                            <span className="bg-muted/80 text-foreground font-mono font-bold px-2 py-0.5 rounded-lg border border-border/60 flex items-center gap-1">
                              <Package className="w-3 h-3 text-primary" /> #{orderShortId}
                            </span>
                          )}

                          {metadata.restaurantName && (
                            <span className="bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-lg border border-border/40 font-medium">
                              {metadata.restaurantName}
                            </span>
                          )}

                          {metadata.total && (
                            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-lg border border-emerald-500/20">
                              ₹{Number(metadata.total).toFixed(2)}
                            </span>
                          )}

                          {metadata.amount && !metadata.total && (
                            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-lg border border-emerald-500/20">
                              ₹{Number(metadata.amount).toFixed(2)}
                            </span>
                          )}

                          {metadata.deliveryOtp && (
                            <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono font-bold px-2 py-0.5 rounded-lg border border-purple-500/20">
                              OTP: {metadata.deliveryOtp}
                            </span>
                          )}

                          {/* Action Button */}
                          <div className="ml-auto flex items-center gap-2">
                            {/* Mark as read toggle */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(n.id);
                              }}
                              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                              title={isRead ? 'Already read' : 'Mark as read'}
                            >
                              <Check className={`w-3.5 h-3.5 ${isRead ? 'text-muted-foreground/40' : 'text-primary'}`} />
                            </button>

                            {/* Delete single notification */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(n.id);
                                toast.info('Notification removed');
                              }}
                              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                              title="Delete notification"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            {/* CTA Link button */}
                            {(n.actionUrl || n.orderId) && (
                              <span className="text-primary font-bold hover:underline flex items-center gap-1 group-hover:translate-x-0.5 transition-transform text-xs">
                                {n.type === 'wallet'
                                  ? 'View Wallet'
                                  : n.type === 'promo'
                                  ? 'Use Promo'
                                  : 'Track Order'}
                                <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16 sm:py-20 bg-card/60 border border-dashed border-border rounded-3xl p-6"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-muted/70 rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                  <Bell className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1">
                  {searchQuery || categoryFilter !== 'all' || readFilter !== 'all'
                    ? 'No matching notifications'
                    : 'No notifications yet'}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                  {searchQuery || categoryFilter !== 'all' || readFilter !== 'all'
                    ? 'Try adjusting your search terms or filters to find what you are looking for.'
                    : "You are all caught up! Real-time notifications will arrive here whenever you place an order, make a payment, or receive live food updates."}
                </p>

                {searchQuery || categoryFilter !== 'all' || readFilter !== 'all' ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCategoryFilter('all');
                      setReadFilter('all');
                      setSearchQuery('');
                    }}
                    className="rounded-xl text-xs font-semibold gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
                  </Button>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Link href="/customer">
                      <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-xs h-10 px-5 shadow-md shadow-primary/20 gap-2">
                        <ShoppingBag className="w-4 h-4" /> Explore Restaurants
                      </Button>
                    </Link>
                    <Link href="/customer/orders">
                      <Button variant="outline" className="border-border rounded-xl font-semibold text-xs h-10 px-5 gap-2">
                        <Package className="w-4 h-4" /> View My Orders
                      </Button>
                    </Link>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Clear All Confirmation Dialog */}
      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <DialogContent className="bg-card border-border text-card-foreground max-w-sm rounded-3xl p-6">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-2">
              <Trash2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-center text-xl font-bold">
              Clear All Notifications?
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              Are you sure you want to remove all notifications? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row gap-2 sm:justify-center mt-2">
            <Button
              variant="outline"
              onClick={() => setIsClearDialogOpen(false)}
              className="flex-1 rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmClearAll}
              className="flex-1 rounded-xl text-xs font-bold"
            >
              Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
