'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import WebPushManagerCard from '@/components/notifications/WebPushManagerCard';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowRight,
  Bell,
  Calendar,
  Check,
  CheckCircle,
  Clock,
  DollarSign,
  Menu,
  MessageSquare,
  Search,
  ShoppingCart,
  Star,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';

type NormalizedCategory = 'order' | 'menu' | 'review' | 'payment' | 'campaign' | 'chat' | 'other';

interface NormalizedNotification {
  id: string;
  title: string;
  message: string;
  rawType: string;
  category: NormalizedCategory;
  isRead: boolean;
  createdAtMs: number;
  createdAtDate: Date;
  orderId?: string;
  chatId?: string;
  actionLink?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

const NOTIFICATION_TABS: { key: 'all' | NormalizedCategory; label: string; icon: any; color: string }[] = [
  { key: 'all', label: 'All', icon: Bell, color: 'text-primary' },
  { key: 'order', label: 'Orders', icon: ShoppingCart, color: 'text-blue-500' },
  { key: 'chat', label: 'Messages', icon: MessageSquare, color: 'text-cyan-500' },
  { key: 'menu', label: 'Menu', icon: Menu, color: 'text-orange-500' },
  { key: 'review', label: 'Reviews', icon: Star, color: 'text-amber-500' },
  { key: 'payment', label: 'Payments', icon: DollarSign, color: 'text-emerald-500' },
  { key: 'campaign', label: 'Campaigns', icon: TrendingUp, color: 'text-purple-500' },
];

function parseFirestoreTimestamp(val: any): Date {
  if (!val) return new Date(0);
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date(0) : val;
  if (typeof val?.toDate === 'function') {
    const d = val.toDate();
    return isNaN(d.getTime()) ? new Date(0) : d;
  }
  if (typeof val?.seconds === 'number') {
    return new Date(val.seconds * 1000);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function normalizeNotificationCategory(rawType?: string, subType?: string): NormalizedCategory {
  const combined = `${rawType || ''} ${subType || ''}`.toLowerCase();
  if (combined.includes('chat') || combined.includes('message')) return 'chat';
  if (combined.includes('order') || combined.includes('delivery')) return 'order';
  if (combined.includes('menu') || combined.includes('inventory')) return 'menu';
  if (combined.includes('review') || combined.includes('rating')) return 'review';
  if (combined.includes('payment') || combined.includes('wallet') || combined.includes('payout') || combined.includes('settlement')) return 'payment';
  if (combined.includes('campaign') || combined.includes('promo') || combined.includes('offer')) return 'campaign';
  return 'other';
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();

  const [notifications, setNotifications] = useState<NormalizedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | NormalizedCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  // Real-time Firestore Listeners across user.uid and restaurant.id
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/restaurant/login');
      return;
    }

    setLoading(true);
    const notifRef = collection(db, 'notifications');
    const targetRestId = restaurant?.id || user.restaurantId || user.uid;

    const bucketBySource: Record<string, Map<string, NormalizedNotification>> = {
      byUser: new Map(),
      byRestUser: new Map(),
      byRestField: new Map(),
    };

    const mergeAndSet = () => {
      const merged = new Map<string, NormalizedNotification>();
      Object.values(bucketBySource).forEach((m) => {
        m.forEach((val, key) => merged.set(key, val));
      });
      const list = Array.from(merged.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
      setNotifications(list);
      setLoading(false);
    };

    const processSnap = (sourceKey: string, snapshot: any) => {
      const nextMap = new Map<string, NormalizedNotification>();
      snapshot.docs.forEach((d: any) => {
        const data = d.data();
        if (data.deleted === true) return;

        // Exclude notifications meant explicitly for another role (e.g. customer/delivery) if queried by shared field
        if (data.userType && data.userType !== 'restaurant' && data.userId !== user.uid) {
          return;
        }

        const dateObj = parseFirestoreTimestamp(data.timestamp || data.createdAt);
        const createdAtMs = dateObj.getTime();
        const category = normalizeNotificationCategory(data.type, data.subType);

        nextMap.set(d.id, {
          id: d.id,
          title: data.title || 'Notification',
          message: data.message || data.body || '',
          rawType: data.type || 'alert',
          category,
          isRead: Boolean(data.isRead ?? data.read ?? false),
          createdAtMs,
          createdAtDate: dateObj,
          orderId: data.orderId || data.metadata?.orderId,
          chatId: data.chatId || data.metadata?.chatId,
          actionLink: data.actionLink,
          actionUrl: data.actionUrl,
          metadata: data.metadata,
        });
      });
      bucketBySource[sourceKey] = nextMap;
      mergeAndSet();
    };

    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        query(notifRef, where('userId', '==', user.uid)),
        (snap) => processSnap('byUser', snap),
        (err) => {
          console.error('[Notifications] Listener error (userId):', err);
          setLoading(false);
        }
      )
    );

    if (targetRestId && targetRestId !== user.uid) {
      unsubs.push(
        onSnapshot(
          query(notifRef, where('userId', '==', targetRestId)),
          (snap) => processSnap('byRestUser', snap),
          () => {}
        )
      );
    }

    if (targetRestId) {
      unsubs.push(
        onSnapshot(
          query(notifRef, where('restaurantId', '==', targetRestId)),
          (snap) => processSnap('byRestField', snap),
          () => {}
        )
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user, restaurant?.id, authLoading, router]);

  const markAsRead = async (notificationId: string, nextRead = true) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: nextRead } : n))
      );
      await updateDoc(doc(db, 'notifications', notificationId), {
        isRead: nextRead,
        read: nextRead,
      });
    } catch (error) {
      console.warn('[Notifications] Error updating read status:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadList = notifications.filter((n) => !n.isRead);
      if (unreadList.length === 0) return;

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      const batch = writeBatch(db);
      unreadList.forEach((n) => {
        batch.update(doc(db, 'notifications', n.id), { isRead: true, read: true });
      });
      await batch.commit();
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('[Notifications] Error marking all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      await deleteDoc(doc(db, 'notifications', notificationId));
      toast.success('Notification removed');
    } catch (error) {
      try {
        await updateDoc(doc(db, 'notifications', notificationId), { deleted: true });
        toast.success('Notification removed');
      } catch {
        console.error('[Notifications] Error deleting notification:', error);
        toast.error('Could not remove notification');
      }
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    setClearingAll(true);
    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        batch.delete(doc(db, 'notifications', n.id));
      });
      await batch.commit();
      setNotifications([]);
      toast.success('All notifications cleared');
      setClearAllOpen(false);
    } catch (e: any) {
      toast.error('Failed to clear notifications: ' + (e?.message || 'Permission error'));
    } finally {
      setClearingAll(false);
    }
  };

  const resolveDestination = (n: NormalizedNotification): string => {
    const chatId = n.chatId || n.metadata?.chatId;
    if (n.category === 'chat' && chatId) {
      return `/restaurant/chat/${chatId}`;
    }

    const rawLink = n.actionLink || n.actionUrl;
    if (rawLink) {
      if (rawLink.startsWith('/customer/chat/') && chatId) {
        return `/restaurant/chat/${chatId}`;
      }
      if (rawLink.startsWith('/customer/orders/') && n.orderId) {
        return `/restaurant/orders/${n.orderId}`;
      }
      return rawLink;
    }

    if (n.category === 'order') {
      return n.orderId ? `/restaurant/orders/${n.orderId}` : '/restaurant/orders';
    }
    if (n.category === 'chat') return '/restaurant/chat';
    if (n.category === 'menu') return '/restaurant/menu';
    if (n.category === 'review') return '/restaurant/reviews';
    if (n.category === 'payment') return '/restaurant/wallet';
    if (n.category === 'campaign') return '/restaurant/campaigns';
    return '/restaurant/orders';
  };

  const handleNotificationClick = (n: NormalizedNotification) => {
    if (!n.isRead) {
      markAsRead(n.id, true);
    }
    const target = resolveDestination(n);
    router.push(target);
  };

  const getNotificationIcon = (category: NormalizedCategory) => {
    switch (category) {
      case 'order':
        return <ShoppingCart className="w-5 h-5 text-blue-500" />;
      case 'chat':
        return <MessageSquare className="w-5 h-5 text-cyan-500" />;
      case 'menu':
        return <Menu className="w-5 h-5 text-orange-500" />;
      case 'review':
        return <Star className="w-5 h-5 text-amber-500" />;
      case 'payment':
        return <DollarSign className="w-5 h-5 text-emerald-500" />;
      case 'campaign':
        return <TrendingUp className="w-5 h-5 text-purple-500" />;
      default:
        return <Bell className="w-5 h-5 text-primary" />;
    }
  };

  const getGradientByCategory = (category: NormalizedCategory) => {
    switch (category) {
      case 'order':
        return 'border-blue-500/25 hover:border-blue-500/50';
      case 'chat':
        return 'border-cyan-500/25 hover:border-cyan-500/50';
      case 'menu':
        return 'border-orange-500/25 hover:border-orange-500/50';
      case 'review':
        return 'border-amber-500/25 hover:border-amber-500/50';
      case 'payment':
        return 'border-emerald-500/25 hover:border-emerald-500/50';
      case 'campaign':
        return 'border-purple-500/25 hover:border-purple-500/50';
      default:
        return 'border-border hover:border-primary/40';
    }
  };

  const filteredNotifications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notifications.filter((n) => {
      if (readFilter === 'unread' && n.isRead) return false;
      if (readFilter === 'read' && !n.isRead) return false;
      if (typeFilter !== 'all' && n.category !== typeFilter) return false;
      if (q) {
        const matches =
          n.title.toLowerCase().includes(q) ||
          n.message.toLowerCase().includes(q) ||
          (n.orderId?.toLowerCase() || '').includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [notifications, readFilter, typeFilter, searchQuery]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: notifications.length };
    notifications.forEach((n) => {
      map[n.category] = (map[n.category] || 0) + 1;
    });
    return map;
  }, [notifications]);

  const groupedNotifications = useMemo(() => {
    const todayStr = new Date().toDateString();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toDateString();

    const today: NormalizedNotification[] = [];
    const yesterday: NormalizedNotification[] = [];
    const earlier: NormalizedNotification[] = [];

    filteredNotifications.forEach((n) => {
      const dStr = n.createdAtDate.toDateString();
      if (dStr === todayStr) {
        today.push(n);
      } else if (dStr === yesterdayStr) {
        yesterday.push(n);
      } else {
        earlier.push(n);
      }
    });

    return { today, yesterday, earlier };
  }, [filteredNotifications]);

  if (authLoading || loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-11 h-11 border-4 border-t-primary border-r-primary/40 border-b-primary/20 border-l-primary/60 rounded-full animate-spin" />
        <p className="text-muted-foreground font-medium text-sm">Loading restaurant notifications...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 min-h-screen bg-background text-foreground transition-colors duration-300 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight">
              Merchant <span className="text-primary">Notifications</span>
            </h1>
            {unreadCount > 0 ? (
              <Badge className="bg-primary text-primary-foreground font-black px-2.5 py-0.5 rounded-full text-xs">
                {unreadCount} Unread
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs font-semibold text-muted-foreground border-border">
                All Caught Up
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Real-time alerts from your orders, customer messages, reviews, menu updates, and payouts
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {unreadCount > 0 && (
            <Button
              type="button"
              onClick={markAllAsRead}
              variant="outline"
              size="sm"
              className="h-9 px-3.5 rounded-xl border-border hover:bg-muted text-xs font-bold gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span>Mark All Read</span>
            </Button>
          )}

          {notifications.length > 0 && (
            <Button
              type="button"
              onClick={() => setClearAllOpen(true)}
              variant="outline"
              size="sm"
              className="h-9 px-3 rounded-xl border-border hover:text-destructive text-xs font-bold text-muted-foreground gap-1.5"
              title="Clear all notifications"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear All</span>
            </Button>
          )}
        </div>
      </div>

      {/* Web Push Settings Card */}
      <WebPushManagerCard role="restaurant" />

      {/* Search & Filter Controls */}
      <div className="p-3 sm:p-4 bg-card/80 backdrop-blur-xl border border-border rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notifications by title, order ID, or message..."
              className="pl-10 pr-9 h-10 text-xs sm:text-sm rounded-xl bg-background border-border"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center p-1 bg-muted/60 rounded-xl border border-border/60 self-start md:self-auto shrink-0">
            {(['all', 'unread', 'read'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setReadFilter(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                  readFilter === mode
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {NOTIFICATION_TABS.map((tab) => {
            const Icon = tab.icon;
            const count = counts[tab.key] || 0;
            const isActive = typeFilter === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTypeFilter(tab.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary-foreground' : tab.color}`} />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-8">
        {filteredNotifications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-12 sm:p-16 text-center border border-dashed border-border rounded-3xl bg-card/60 shadow-sm"
          >
            <div className="w-16 h-16 rounded-3xl bg-muted/60 flex items-center justify-center mx-auto mb-4 text-muted-foreground">
              <Bell className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-1">
              {notifications.length === 0
                ? 'No notifications yet'
                : 'No matching notifications'}
            </h3>
            <p className="text-muted-foreground text-xs sm:text-sm max-w-md mx-auto">
              {notifications.length === 0
                ? 'Real-time alerts for new orders, customer messages, reviews, and settlements will appear here automatically.'
                : 'Try clearing your search or switching category/read filters.'}
            </p>
            {(searchQuery || typeFilter !== 'all' || readFilter !== 'all') && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('all');
                  setReadFilter('all');
                }}
                className="mt-5 rounded-xl font-bold text-xs"
              >
                Reset Filters
              </Button>
            )}
          </motion.div>
        ) : (
          <>
            {groupedNotifications.today.length > 0 && (
              <NotificationGroup
                title="Today"
                notifications={groupedNotifications.today}
                getIcon={getNotificationIcon}
                getBorderClass={getGradientByCategory}
                onCardClick={handleNotificationClick}
                onToggleRead={(n) => markAsRead(n.id, !n.isRead)}
                onDelete={deleteNotification}
              />
            )}
            {groupedNotifications.yesterday.length > 0 && (
              <NotificationGroup
                title="Yesterday"
                notifications={groupedNotifications.yesterday}
                getIcon={getNotificationIcon}
                getBorderClass={getGradientByCategory}
                onCardClick={handleNotificationClick}
                onToggleRead={(n) => markAsRead(n.id, !n.isRead)}
                onDelete={deleteNotification}
              />
            )}
            {groupedNotifications.earlier.length > 0 && (
              <NotificationGroup
                title="Earlier"
                notifications={groupedNotifications.earlier}
                getIcon={getNotificationIcon}
                getBorderClass={getGradientByCategory}
                onCardClick={handleNotificationClick}
                onToggleRead={(n) => markAsRead(n.id, !n.isRead)}
                onDelete={deleteNotification}
              />
            )}
          </>
        )}
      </div>

      {/* Clear All Confirmation Dialog */}
      <Dialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <DialogContent className="max-w-sm bg-card border-border text-foreground rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-destructive">
              <Trash2 className="w-5 h-5" /> Clear All Notifications?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This will permanently remove all {notifications.length} notifications from your restaurant inbox.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setClearAllOpen(false)}
              className="rounded-xl text-xs font-bold"
            >
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAll}
              disabled={clearingAll}
              className="rounded-xl text-xs font-bold"
            >
              {clearingAll ? 'Clearing...' : 'Clear All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotificationGroup({
  title,
  notifications,
  getIcon,
  getBorderClass,
  onCardClick,
  onToggleRead,
  onDelete,
}: {
  title: string;
  notifications: NormalizedNotification[];
  getIcon: (category: NormalizedCategory) => React.ReactNode;
  getBorderClass: (category: NormalizedCategory) => string;
  onCardClick: (notif: NormalizedNotification) => void;
  onToggleRead: (notif: NormalizedNotification) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-2 flex items-center gap-2">
        <Calendar className="w-3.5 h-3.5" /> {title} ({notifications.length})
      </h2>

      <div className="grid grid-cols-1 gap-2.5">
        <AnimatePresence>
          {notifications.map((notification, index) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ delay: Math.min(index * 0.02, 0.2) }}
              layout
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => onCardClick(notification)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onCardClick(notification);
                  }
                }}
                className={`relative group p-4 sm:p-5 rounded-2xl border bg-card cursor-pointer transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-0.5 ${getBorderClass(
                  notification.category
                )} ${!notification.isRead ? 'ring-2 ring-primary/35 bg-primary/[0.03]' : 'opacity-90'}`}
              >
                {!notification.isRead && (
                  <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
                )}

                <div className="flex gap-3.5 sm:gap-4 items-start">
                  <div className="p-2.5 rounded-xl bg-muted/70 shadow-xs shrink-0 border border-border mt-0.5">
                    {getIcon(notification.category)}
                  </div>

                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/60">
                        {notification.category === 'other' ? notification.rawType : notification.category}
                      </span>
                      <h3
                        className={`font-bold text-sm sm:text-base truncate ${
                          !notification.isRead ? 'text-foreground' : 'text-foreground/80'
                        }`}
                      >
                        {notification.title}
                      </h3>
                    </div>

                    <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed mb-2.5 line-clamp-2">
                      {notification.message}
                    </p>

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1 text-[11px] bg-muted/60 px-2 py-0.5 rounded-md border border-border/50">
                          <Clock className="w-3 h-3" />
                          {notification.createdAtMs > 0
                            ? notification.createdAtDate.toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Just now'}
                        </span>

                        <span className="text-primary font-bold text-xs flex items-center gap-1 group-hover:underline">
                          <span>Open</span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                        </span>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggleRead(notification)}
                          title={notification.isRead ? 'Mark as unread' : 'Mark as read'}
                          className="h-7 px-2 text-[11px] rounded-lg text-muted-foreground hover:text-foreground"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          {notification.isRead ? 'Unread' : 'Read'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 w-7 rounded-lg"
                          onClick={() => onDelete(notification.id)}
                          title="Delete notification"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
