'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  writeBatch,
  deleteDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Notification as NotificationType } from '@/lib/types';
import {
  Bell,
  CheckCircle,
  ShoppingCart,
  Star,
  DollarSign,
  AlertCircle,
  Menu,
  MessageSquare,
  TrendingUp,
  Check,
  Trash2,
  Calendar,
  Clock,
  Plus,
  Sparkles,
  Filter,
  ExternalLink,
  ArrowRight,
  RefreshCw,
  Send,
  Zap,
  Tag,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  createRestaurantNotification,
  SAMPLE_NOTIFICATIONS,
  RestaurantNotificationType
} from '@/lib/restaurantNotifications';
import WebPushManagerCard from '@/components/notifications/WebPushManagerCard';
import { playNotificationSound } from '@/lib/web-push';

const NOTIFICATION_TABS: { key: string; label: string; icon: any; color: string }[] = [
  { key: 'all', label: 'All Types', icon: Bell, color: 'text-primary' },
  { key: 'order', label: 'Order', icon: ShoppingCart, color: 'text-blue-500' },
  { key: 'menu', label: 'Menu', icon: Menu, color: 'text-orange-500' },
  { key: 'review', label: 'Review', icon: Star, color: 'text-amber-500' },
  { key: 'payment', label: 'Payment', icon: DollarSign, color: 'text-emerald-500' },
  { key: 'campaign', label: 'Campaign', icon: TrendingUp, color: 'text-purple-500' },
];

export default function NotificationsPage() {
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();

  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Test / Create Notification Dialog State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newNotifType, setNewNotifType] = useState<RestaurantNotificationType>('order');
  const [newNotifTitle, setNewNotifTitle] = useState('');
  const [newNotifMessage, setNewNotifMessage] = useState('');
  const [newNotifAction, setNewNotifAction] = useState('');
  const [creatingNotif, setCreatingNotif] = useState(false);

  // Clear All Confirmation Dialog
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  // Real-time Firestore Listener
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/restaurant/login');
      return;
    }

    setLoading(true);
    const targetUserId = user.uid;
    const targetRestId = restaurant?.id || user.uid;

    const notifRef = collection(db, 'notifications');

    // Query 1: by userId
    const q1 = query(notifRef, where('userId', '==', targetUserId));

    // Listen to notifications in real-time
    const unsubscribe1 = onSnapshot(
      q1,
      (snapshot) => {
        const notifMap = new Map<string, NotificationType>();

        snapshot.docs.forEach((d) => {
          const data = d.data();
          notifMap.set(d.id, {
            ...data,
            id: d.id,
            createdAt: data.createdAt || data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
          } as NotificationType);
        });

        // If targetRestId is different, we also check query 2 if needed
        const list = Array.from(notifMap.values()).sort((a, b) => {
          const timeA = new Date(a.createdAt).getTime() || 0;
          const timeB = new Date(b.createdAt).getTime() || 0;
          return timeB - timeA;
        });

        setNotifications(list);
        setLoading(false);
      },
      (error) => {
        console.error('[Notifications] Snapshot listener error:', error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe1();
    };
  }, [user, restaurant, authLoading, router]);

  // Mark single notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        isRead: true,
        read: true,
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
    } catch (error) {
      console.error('[Notifications] Error marking as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const unreadList = notifications.filter((n) => !n.isRead);
      if (unreadList.length === 0) return;

      const batch = writeBatch(db);
      unreadList.forEach((n) => {
        if (n.id) {
          batch.update(doc(db, 'notifications', n.id), { isRead: true, read: true });
        }
      });
      await batch.commit();

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read!');
    } catch (error) {
      console.error('[Notifications] Error marking all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  // Delete single notification
  const deleteNotification = async (notificationId: string) => {
    try {
      // Optimistic state removal
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      await deleteDoc(doc(db, 'notifications', notificationId));
      toast.success('Notification removed');
    } catch (error) {
      console.error('[Notifications] Error deleting notification:', error);
    }
  };

  // Clear all notifications
  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    setClearingAll(true);
    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        if (n.id) {
          batch.delete(doc(db, 'notifications', n.id));
        }
      });
      await batch.commit();
      setNotifications([]);
      toast.success('All notifications cleared!');
      setClearAllOpen(false);
    } catch (e: any) {
      toast.error('Failed to clear notifications: ' + e?.message);
    } finally {
      setClearingAll(false);
    }
  };

  // Create Test / Simulate Notification
  const handleCreateTestNotification = async () => {
    if (!user) return;
    setCreatingNotif(true);

    try {
      const effectiveTitle =
        newNotifTitle.trim() ||
        SAMPLE_NOTIFICATIONS[newNotifType]?.[0]?.title ||
        `New ${newNotifType.toUpperCase()} Notification`;

      const effectiveMessage =
        newNotifMessage.trim() ||
        SAMPLE_NOTIFICATIONS[newNotifType]?.[0]?.message ||
        `This is a test notification for category ${newNotifType}.`;

      const effectiveAction =
        newNotifAction.trim() ||
        SAMPLE_NOTIFICATIONS[newNotifType]?.[0]?.defaultAction ||
        `/restaurant/${newNotifType === 'order' ? 'orders' : newNotifType}`;

      await createRestaurantNotification({
        restaurantId: user.uid,
        type: newNotifType,
        title: effectiveTitle,
        message: effectiveMessage,
        actionLink: effectiveAction,
        orderId: newNotifType === 'order' ? 'SALRAXCT5509' : undefined,
      });

      // Also dispatch live Web Push to browser (Chrome, Safari, Edge, etc.)
      fetch('/api/notifications/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          role: 'restaurant',
          title: effectiveTitle,
          body: effectiveMessage,
          actionUrl: effectiveAction,
          data: {
            type: newNotifType,
            orderId: newNotifType === 'order' ? 'SALRAXCT5509' : undefined,
          },
        }),
      }).catch((pushErr) => console.warn('[Restaurant] Web push dispatch notice:', pushErr));

      playNotificationSound();

      toast.success(`🎉 Live "${newNotifType.toUpperCase()}" alert created & Web Push dispatched!`);
      setCreateModalOpen(false);
      setNewNotifTitle('');
      setNewNotifMessage('');
      setNewNotifAction('');
    } catch (e: any) {
      toast.error('Failed to create notification: ' + e?.message);
    } finally {
      setCreatingNotif(false);
    }
  };

  // Apply Sample Template
  const handleApplySample = (template: { title: string; message: string; defaultAction: string }) => {
    setNewNotifTitle(template.title);
    setNewNotifMessage(template.message);
    setNewNotifAction(template.defaultAction);
  };

  // Notification Icon Helper
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <ShoppingCart className="w-5 h-5 text-blue-500" />;
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

  // Card Gradient Helper
  const getGradientByType = (type: string) => {
    switch (type) {
      case 'order':
        return 'from-blue-500/10 via-blue-500/5 to-transparent border-blue-500/30 hover:border-blue-500/50';
      case 'menu':
        return 'from-orange-500/10 via-orange-500/5 to-transparent border-orange-500/30 hover:border-orange-500/50';
      case 'review':
        return 'from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30 hover:border-amber-500/50';
      case 'payment':
        return 'from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/30 hover:border-emerald-500/50';
      case 'campaign':
        return 'from-purple-500/10 via-purple-500/5 to-transparent border-purple-500/30 hover:border-purple-500/50';
      default:
        return 'from-card via-card/80 to-transparent border-border hover:border-primary/40';
    }
  };

  // Filtered Notifications
  const filteredNotifications = notifications.filter((n) => {
    if (readFilter === 'unread' && n.isRead) return false;
    if (readFilter === 'read' && !n.isRead) return false;
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Counts for each tab badge
  const counts = {
    all: notifications.length,
    order: notifications.filter((n) => n.type === 'order').length,
    menu: notifications.filter((n) => n.type === 'menu').length,
    review: notifications.filter((n) => n.type === 'review').length,
    payment: notifications.filter((n) => n.type === 'payment').length,
    campaign: notifications.filter((n) => n.type === 'campaign').length,
  };

  // Group by Today, Yesterday, Earlier
  const groupedNotifications = {
    today: filteredNotifications.filter(
      (n) => new Date(n.createdAt).toDateString() === new Date().toDateString()
    ),
    yesterday: filteredNotifications.filter((n) => {
      const d = new Date(n.createdAt);
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return d.toDateString() === y.toDateString();
    }),
    earlier: filteredNotifications.filter((n) => {
      const d = new Date(n.createdAt);
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return d < y && d.toDateString() !== new Date().toDateString();
    }),
  };

  // Smart Navigation Handler
  const handleNotificationClick = (n: any) => {
    if (!n.isRead) markAsRead(n.id);

    if (n.actionLink) {
      router.push(n.actionLink);
      return;
    }

    // Smart fallback routing based on type
    if (n.type === 'order') {
      router.push(n.orderId ? `/restaurant/orders/${n.orderId}` : '/restaurant/orders');
    } else if (n.type === 'menu') {
      router.push('/restaurant/menu');
    } else if (n.type === 'review') {
      router.push('/restaurant/reviews');
    } else if (n.type === 'payment') {
      router.push('/restaurant/wallet');
    } else if (n.type === 'campaign') {
      router.push('/restaurant/campaigns');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-12 h-12 border-4 border-t-primary border-r-orange-500 border-b-purple-500 border-l-emerald-500 rounded-full animate-spin" />
        <p className="text-muted-foreground animate-pulse font-medium text-sm">
          Loading live notification stream...
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 min-h-screen bg-background text-foreground transition-colors duration-300 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 bg-clip-text text-transparent flex items-center gap-2.5">
              <span>Merchant Notifications</span>
            </h1>
            {unreadCount > 0 ? (
              <Badge className="bg-primary text-primary-foreground font-black px-2.5 py-0.5 rounded-full text-xs">
                {unreadCount} New
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs font-semibold text-muted-foreground border-border">
                Live & Synced
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Real-time activity across orders, menu updates, reviews, settlements, and campaigns
          </p>
        </div>

        {/* Action Buttons: Simulate Alert, Mark All Read, Clear All */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setCreateModalOpen(true)}
            size="sm"
            className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs gap-1.5 shadow-md shadow-orange-600/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Send Test Alert</span>
          </Button>

          {unreadCount > 0 && (
            <Button
              onClick={markAllAsRead}
              variant="outline"
              size="sm"
              className="h-9 px-3 rounded-xl border-border hover:bg-muted text-xs font-bold gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span>Mark All Read</span>
            </Button>
          )}

          {notifications.length > 0 && (
            <Button
              onClick={() => setClearAllOpen(true)}
              variant="outline"
              size="sm"
              className="h-9 px-2.5 rounded-xl border-border hover:text-destructive text-xs font-bold text-muted-foreground"
              title="Clear all notifications"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Web Push Management & Testing Card for Restaurant Merchants */}
      <WebPushManagerCard role="restaurant" className="mb-6" />

      {/* Primary Category Filter Bar: "All Types", "order", "menu", "review", "payment", "campaign" */}
      <div className="p-3 bg-card/80 backdrop-blur-xl border border-border/80 rounded-2xl shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Type Badges: All Types, order, menu, review, payment, campaign */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 md:pb-0">
          {NOTIFICATION_TABS.map((tab) => {
            const Icon = tab.icon;
            const count = counts[tab.key as keyof typeof counts] || 0;
            const isActive = typeFilter === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTypeFilter(tab.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm scale-100 ring-2 ring-primary/20'
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

        {/* Read / Unread Status Filter Pills */}
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

      {/* Notifications List Groups */}
      <div className="space-y-8">
        {filteredNotifications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-12 sm:p-16 text-center border border-dashed border-border rounded-3xl bg-card/60 shadow-sm"
          >
            <div className="w-16 h-16 rounded-3xl bg-muted/50 flex items-center justify-center mx-auto mb-4 text-muted-foreground">
              <Bell className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-1">
              {typeFilter === 'all'
                ? 'No notifications yet'
                : `No "${typeFilter}" notifications found`}
            </h3>
            <p className="text-muted-foreground text-xs sm:text-sm max-w-sm mx-auto mb-6">
              When new orders arrive, reviews are submitted, dishes updated, or payouts settled, they will appear here in real-time.
            </p>
            <Button
              onClick={() => {
                if (typeFilter !== 'all') {
                  setNewNotifType(typeFilter as RestaurantNotificationType);
                }
                setCreateModalOpen(true);
              }}
              size="sm"
              className="rounded-xl font-bold text-xs gap-1.5 bg-primary text-primary-foreground"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulate a {typeFilter === 'all' ? 'Order' : typeFilter} Alert</span>
            </Button>
          </motion.div>
        ) : (
          <>
            {groupedNotifications.today.length > 0 && (
              <NotificationGroup
                title="Today"
                notifications={groupedNotifications.today}
                getIcon={getNotificationIcon}
                getGradient={getGradientByType}
                onCardClick={handleNotificationClick}
                onDelete={deleteNotification}
              />
            )}
            {groupedNotifications.yesterday.length > 0 && (
              <NotificationGroup
                title="Yesterday"
                notifications={groupedNotifications.yesterday}
                getIcon={getNotificationIcon}
                getGradient={getGradientByType}
                onCardClick={handleNotificationClick}
                onDelete={deleteNotification}
              />
            )}
            {groupedNotifications.earlier.length > 0 && (
              <NotificationGroup
                title="Earlier"
                notifications={groupedNotifications.earlier}
                getIcon={getNotificationIcon}
                getGradient={getGradientByType}
                onCardClick={handleNotificationClick}
                onDelete={deleteNotification}
              />
            )}
          </>
        )}
      </div>

      {/* Create / Simulate Notification Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-lg bg-card border-border text-foreground rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Simulate Live Restaurant Alert
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Trigger any of the 5 notification types to verify alerts, badges, and deep navigation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Category Type Selector Buttons */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">
                Select Notification Type *
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {(['order', 'menu', 'review', 'payment', 'campaign'] as RestaurantNotificationType[]).map(
                  (t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setNewNotifType(t);
                        const sample = SAMPLE_NOTIFICATIONS[t]?.[0];
                        if (sample) handleApplySample(sample);
                      }}
                      className={`p-2 rounded-xl text-xs font-bold capitalize transition-all border flex flex-col items-center gap-1 cursor-pointer ${
                        newNotifType === t
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {getNotificationIcon(t)}
                      <span>{t}</span>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Quick Sample Templates */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Quick 1-Click Templates:
              </label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {SAMPLE_NOTIFICATIONS[newNotifType]?.map((sample, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleApplySample(sample)}
                    className="p-2.5 rounded-xl border border-border/70 bg-muted/20 hover:bg-muted/50 cursor-pointer text-xs transition-colors"
                  >
                    <p className="font-bold text-foreground">{sample.title}</p>
                    <p className="text-muted-foreground text-[11px] line-clamp-1 mt-0.5">
                      {sample.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Title Input */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Alert Title</label>
              <Input
                value={newNotifTitle}
                onChange={(e) => setNewNotifTitle(e.target.value)}
                placeholder="e.g. New Order Received! 🛍️"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            {/* Message Input */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Message Content</label>
              <textarea
                value={newNotifMessage}
                onChange={(e) => setNewNotifMessage(e.target.value)}
                placeholder="Alert details that restaurant staff will read..."
                className="w-full text-xs p-3 rounded-xl border border-border bg-muted/40 resize-none h-16 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateTestNotification}
              disabled={creatingNotif}
              className="rounded-xl text-xs font-bold bg-primary text-primary-foreground gap-1.5 shadow-md"
            >
              {creatingNotif ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Alert Now</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Confirmation Dialog */}
      <Dialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <DialogContent className="max-w-sm bg-card border-border text-foreground rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-destructive">
              <Trash2 className="w-5 h-5" /> Clear All Notifications?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This will remove all {notifications.length} notifications permanently from your restaurant inbox.
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

// Notification Group Subcomponent
function NotificationGroup({
  title,
  notifications,
  getIcon,
  getGradient,
  onCardClick,
  onDelete,
}: {
  title: string;
  notifications: any[];
  getIcon: (type: string) => React.ReactNode;
  getGradient: (type: string) => string;
  onCardClick: (notif: any) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-2 flex items-center gap-2">
        <Calendar className="w-3.5 h-3.5" /> {title} ({notifications.length})
      </h2>

      <div className="grid grid-cols-1 gap-2.5">
        <AnimatePresence>
          {notifications.map((notification: any, index: number) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -80 }}
              transition={{ delay: index * 0.03 }}
              layout
            >
              <div
                className={`relative group p-4 sm:p-5 rounded-2xl border bg-card/75 backdrop-blur-md cursor-pointer transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-0.5 ${getGradient(
                  notification.type
                )} ${!notification.isRead ? 'ring-2 ring-primary/40 bg-card' : 'opacity-90'}`}
                onClick={() => onCardClick(notification)}
              >
                {/* Unread Glow Dot */}
                {!notification.isRead && (
                  <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_8px_currentColor] animate-pulse" />
                )}

                <div className="flex gap-3.5 sm:gap-4 items-start">
                  {/* Category Icon Badge */}
                  <div className="p-2.5 rounded-xl bg-muted/80 shadow-xs shrink-0 border border-border/70 mt-0.5">
                    {getIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/60">
                        {notification.type || 'Alert'}
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

                    <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                      <span className="flex items-center gap-1 text-[11px] bg-muted/60 px-2 py-0.5 rounded-md border border-border/50">
                        <Clock className="w-3 h-3" />
                        {new Date(notification.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      <span className="text-primary hover:underline font-bold text-xs flex items-center gap-1">
                        <span>View Details</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </div>

                  {/* Delete Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 hover:bg-red-500/10 h-8 w-8 rounded-lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(notification.id);
                    }}
                    title="Delete notification"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
