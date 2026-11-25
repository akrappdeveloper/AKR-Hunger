'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { ref, onValue } from 'firebase/database';
import { doc, onSnapshot } from 'firebase/firestore';
import { realtimeDb, db } from '@/lib/firebase';
import {
  ChatConversation,
  ChatType,
  UserChatSummary,
  getDeterministicChatId,
  initializeOrderChat,
  parseDeterministicChatId,
} from '@/lib/chat-service';
import { Order } from '@/lib/types';
import ChatBox from '@/components/chat/ChatBox';
import ThemeToggle from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  MessageSquare,
  Search,
  Bike,
  User,
  ChefHat,
  Phone,
  MapPin,
  Receipt,
  ExternalLink,
  PanelRightOpen,
  PanelRightClose,
  Inbox,
  ShoppingBag,
  CreditCard,
  FileText,
  Users,
} from 'lucide-react';

function formatAddress(addr: Order['deliveryAddress'] | any): string {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  if (addr.fullAddress) return addr.fullAddress;
  return [addr.flatNo, addr.street, addr.landmark, addr.city, addr.state, addr.pincode]
    .filter(Boolean)
    .join(', ');
}

function getStatusBadgeClass(status?: string): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
    case 'confirmed':
    case 'preparing':
      return 'bg-primary/15 text-primary border-primary/30';
    case 'ready':
    case 'out_for_delivery':
      return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
    case 'delivered':
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    case 'cancelled':
      return 'bg-destructive/15 text-destructive border-destructive/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

export default function RestaurantChatDetailPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = (params?.chatId as string) || '';
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();

  const [chatData, setChatData] = useState<ChatConversation | null>(null);
  const [chatExists, setChatExists] = useState<boolean | null>(null);
  const [loadingChat, setLoadingChat] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);

  const [inboxChats, setInboxChats] = useState<UserChatSummary[]>([]);
  const [inboxSearch, setInboxSearch] = useState('');
  const [inboxFilter, setInboxFilter] = useState<'all' | 'customer' | 'delivery'>('all');

  const [mobileInboxOpen, setMobileInboxOpen] = useState(false);
  const [desktopOrderPanelOpen, setDesktopOrderPanelOpen] = useState(true);
  const [mobileOrderSheetOpen, setMobileOrderSheetOpen] = useState(false);

  const initializedChatRef = useRef<string | null>(null);

  const currentRestUid = restaurant?.id || user?.restaurantId || user?.uid || '';
  const parsedFromId = useMemo(() => parseDeterministicChatId(chatId), [chatId]);

  const resolvedOrderId = chatData?.orderId || parsedFromId.orderId || '';
  const resolvedChatType: ChatType | undefined =
    chatData?.chatType || parsedFromId.chatType;

  // 1. Live RTDB listener for current chat metadata
  useEffect(() => {
    if (!chatId || !realtimeDb) {
      setLoadingChat(false);
      return;
    }

    setLoadingChat(true);
    setChatExists(null);
    const chatRef = ref(realtimeDb, `chats/${chatId}`);

    const unsubscribe = onValue(
      chatRef,
      (snap) => {
        if (snap.exists()) {
          setChatData(snap.val() as ChatConversation);
          setChatExists(true);
        } else {
          setChatData(null);
          setChatExists(false);
        }
        setLoadingChat(false);
      },
      (err) => {
        console.error('[RestaurantChatDetail] Error loading chat:', err);
        setLoadingChat(false);
      }
    );

    return () => unsubscribe();
  }, [chatId]);

  // 2. Live RTDB listener for restaurant inbox list
  useEffect(() => {
    if (!currentRestUid || !realtimeDb) return;

    const userChatsRef = ref(realtimeDb, `userChats/${currentRestUid}`);
    const unsubscribe = onValue(userChatsRef, (snapshot) => {
      if (snapshot.exists()) {
        const list: UserChatSummary[] = Object.values(snapshot.val());
        list.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
        setInboxChats(list);
      } else {
        setInboxChats([]);
      }
    });

    return () => unsubscribe();
  }, [currentRestUid]);

  // 3. Live Firestore listener for full Order details
  useEffect(() => {
    if (!resolvedOrderId || !db) {
      setOrder(null);
      return;
    }

    const orderRef = doc(db, 'orders', resolvedOrderId);
    const unsubscribe = onSnapshot(
      orderRef,
      (snap) => {
        if (snap.exists()) {
          setOrder({ ...snap.data(), id: snap.id } as Order);
        } else {
          setOrder(null);
        }
      },
      (err) => {
        console.warn('[RestaurantChatDetail] Order listener warning:', err);
      }
    );

    return () => unsubscribe();
  }, [resolvedOrderId]);

  // 4. Auto-initialize RTDB chat if order exists in Firestore & chat node doesn't exist yet
  useEffect(() => {
    if (
      chatExists !== false ||
      !order ||
      !resolvedOrderId ||
      !resolvedChatType ||
      !currentRestUid ||
      initializedChatRef.current === chatId
    ) {
      return;
    }

    initializedChatRef.current = chatId;

    initializeOrderChat({
      orderId: resolvedOrderId,
      orderNumber: order.orderNumber || `#${resolvedOrderId.slice(-6).toUpperCase()}`,
      chatType: resolvedChatType,
      customer: order.customerId
        ? {
            id: order.customerId,
            name: order.customerName || 'Customer',
            phone: order.customerPhone,
          }
        : undefined,
      restaurant: {
        id: order.restaurantId || currentRestUid,
        name: restaurant?.name || order.restaurantName || 'Restaurant',
        image: restaurant?.image,
        phone: restaurant?.phone || order.restaurantPhone,
      },
      delivery: order.deliveryPersonId
        ? {
            id: order.deliveryPersonId,
            name: order.deliveryPersonName || 'Delivery Partner',
            phone: order.deliveryPersonPhone,
          }
        : undefined,
      creatorUid: currentRestUid,
      creatorRole: 'restaurant',
    }).catch((err) => {
      console.warn('[RestaurantChatDetail] Auto-init warning:', err);
    });
  }, [chatExists, order, resolvedOrderId, resolvedChatType, currentRestUid, chatId, restaurant]);

  const filteredInbox = useMemo(() => {
    const q = inboxSearch.trim().toLowerCase();
    return inboxChats.filter((c) => {
      const matchesQuery =
        !q ||
        (c.participantName?.toLowerCase() || '').includes(q) ||
        (c.orderNumber?.toLowerCase() || '').includes(q) ||
        (c.lastMessage?.toLowerCase() || '').includes(q);
      if (!matchesQuery) return false;
      if (inboxFilter === 'customer') return c.chatType === 'customer_restaurant';
      if (inboxFilter === 'delivery') return c.chatType === 'restaurant_delivery';
      return true;
    });
  }, [inboxChats, inboxSearch, inboxFilter]);

  const totalUnread = useMemo(
    () => inboxChats.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [inboxChats]
  );

  const formatShortTime = (ts?: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const mergedOrderData = useMemo(
    () => ({
      orderNumber: order?.orderNumber || chatData?.orderNumber || (resolvedOrderId ? `#${resolvedOrderId.slice(-6).toUpperCase()}` : undefined),
      status: order?.status || chatData?.status,
      total: order?.total,
      items: order?.items?.map((it) => ({ name: it.name, quantity: it.quantity })),
      restaurantName: restaurant?.name || order?.restaurantName || chatData?.restaurantName,
      customerName: order?.customerName || chatData?.customerName,
      customerPhone: order?.customerPhone,
      deliveryPersonName: order?.deliveryPersonName || chatData?.deliveryName,
      deliveryPersonPhone: order?.deliveryPersonPhone,
    }),
    [order, chatData, resolvedOrderId, restaurant?.name]
  );

  const deliveryAddressText = useMemo(
    () => formatAddress(order?.deliveryAddress),
    [order?.deliveryAddress]
  );

  const orderChannels = useMemo(() => {
    if (!resolvedOrderId) return [];
    const channels: Array<{ type: ChatType; label: string; icon: React.ReactNode }> = [
      {
        type: 'customer_restaurant',
        label: 'Customer ↔ Kitchen',
        icon: <User className="w-3.5 h-3.5" />,
      },
      {
        type: 'restaurant_delivery',
        label: 'Kitchen ↔ Rider',
        icon: <Bike className="w-3.5 h-3.5" />,
      },
    ];
    if (order?.deliveryPersonId || resolvedChatType === 'customer_delivery') {
      channels.push({
        type: 'customer_delivery',
        label: 'Customer ↔ Rider',
        icon: <Users className="w-3.5 h-3.5" />,
      });
    }
    return channels;
  }, [resolvedOrderId, order?.deliveryPersonId, resolvedChatType]);

  // Loading state
  if (authLoading || loadingChat) {
    return (
      <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">Loading full-screen chat workspace...</p>
      </div>
    );
  }

  // Auth required state
  if (!user || !currentRestUid) {
    return (
      <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col items-center justify-center p-6 text-center relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="max-w-sm w-full bg-card border border-border rounded-3xl p-8 shadow-xl space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Restaurant Login Required</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Please sign in to your restaurant partner portal to access order communications.
            </p>
          </div>
          <Link href="/restaurant/login" className="block">
            <Button size="sm" className="w-full rounded-xl font-bold h-10">
              Go to Restaurant Login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Reusable Inbox List Content
  const renderInboxContent = (onSelectChat?: () => void) => (
    <div className="flex flex-col h-full bg-card/50 text-foreground">
      <div className="p-4 border-b border-border space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground shadow-sm shrink-0">
              <ChefHat className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black tracking-tight truncate">Order Chats</h2>
              <p className="text-[11px] text-muted-foreground truncate">
                {restaurant?.name || 'Partner Inbox'}
              </p>
            </div>
          </div>
          {totalUnread > 0 && (
            <Badge className="rounded-full text-[10px] font-black px-2 py-0.5">
              {totalUnread} unread
            </Badge>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={inboxSearch}
            onChange={(e) => setInboxSearch(e.target.value)}
            placeholder="Search order or contact..."
            className="pl-8 h-9 text-xs rounded-xl bg-background border-border"
          />
        </div>

        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60">
          {[
            { id: 'all', label: 'All' },
            { id: 'customer', label: 'Customers' },
            { id: 'delivery', label: 'Riders' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setInboxFilter(tab.id as any)}
              className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition ${
                inboxFilter === tab.id
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
        {filteredInbox.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-2">
            <div className="w-10 h-10 mx-auto rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
              <Inbox className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-foreground">No chats found</p>
            <p className="text-[11px] text-muted-foreground">
              Customer and delivery messages will appear here in real time.
            </p>
          </div>
        ) : (
          filteredInbox.map((item) => {
            const isSelected = item.chatId === chatId;
            return (
              <button
                key={item.chatId}
                type="button"
                onClick={() => {
                  router.push(`/restaurant/chat/${item.chatId}`);
                  if (onSelectChat) onSelectChat();
                }}
                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                  isSelected
                    ? 'bg-primary/10 border-primary/40 shadow-xs'
                    : 'bg-card/60 hover:bg-muted/70 border-transparent hover:border-border'
                }`}
              >
                <div className="relative shrink-0 mt-0.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                      item.chatType === 'restaurant_delivery'
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-500'
                        : 'bg-primary/10 border-primary/20 text-primary'
                    }`}
                  >
                    {item.chatType === 'restaurant_delivery' ? (
                      <Bike className="w-5 h-5" />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>
                  {item.unreadCount > 0 && !isSelected && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-card">
                      {item.unreadCount}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-bold text-xs text-foreground truncate">
                      {item.participantName || 'Order Contact'}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatShortTime(item.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-mono text-primary font-semibold">
                      {item.orderNumber || `#${item.orderId.slice(-6)}`}
                    </span>
                    <span className="text-[10px] text-muted-foreground">•</span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {item.chatType === 'restaurant_delivery' ? 'Rider' : 'Customer'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-1">
                    {item.lastMessage || 'New conversation'}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-border bg-card/80 flex items-center justify-between gap-2 shrink-0">
        <Link href="/restaurant/chat" className="flex-1">
          <Button variant="outline" size="sm" className="w-full h-9 rounded-xl text-xs font-bold gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            All Chats
          </Button>
        </Link>
        <Link href="/restaurant/orders" className="flex-1">
          <Button variant="secondary" size="sm" className="w-full h-9 rounded-xl text-xs font-bold gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5" />
            Orders
          </Button>
        </Link>
      </div>
    </div>
  );

  // Reusable Order Context Panel Content
  const renderOrderContextContent = () => (
    <div className="flex flex-col h-full bg-card/40 text-foreground">
      <div className="px-4 py-3.5 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold">Order Context</h3>
        </div>
        {mergedOrderData.status && (
          <Badge
            variant="outline"
            className={`text-[10px] uppercase font-bold border ${getStatusBadgeClass(mergedOrderData.status)}`}
          >
            {mergedOrderData.status.replace(/_/g, ' ')}
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Order Summary Card */}
        <div className="rounded-2xl bg-card border border-border p-3.5 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Order Reference</span>
            <span className="text-xs font-mono font-bold text-primary">
              {mergedOrderData.orderNumber || (resolvedOrderId ? `#${resolvedOrderId.slice(-6).toUpperCase()}` : 'N/A')}
            </span>
          </div>
          {order?.total !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Order Total</span>
              <span className="text-sm font-black font-mono text-foreground">₹{order.total}</span>
            </div>
          )}
          {order?.paymentMethod && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CreditCard className="w-3 h-3" /> Payment
              </span>
              <span className="text-xs font-semibold uppercase text-foreground">
                {order.paymentMethod} {order.paymentStatus ? `• ${order.paymentStatus}` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Channel Switcher */}
        {orderChannels.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">
              Order Channels
            </p>
            <div className="space-y-1.5">
              {orderChannels.map((ch) => {
                const targetId = getDeterministicChatId(resolvedOrderId, ch.type);
                const active = targetId === chatId;
                return (
                  <button
                    key={ch.type}
                    type="button"
                    onClick={() => {
                      if (!active) router.push(`/restaurant/chat/${targetId}`);
                      setMobileOrderSheetOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-semibold transition ${
                      active
                        ? 'bg-primary/15 border-primary/40 text-primary'
                        : 'bg-card border-border text-foreground hover:bg-muted/60'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {ch.icon}
                      {ch.label}
                    </span>
                    {active && (
                      <span className="text-[10px] font-bold uppercase">Active</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Customer Info */}
        {(mergedOrderData.customerName || deliveryAddressText) && (
          <div className="rounded-2xl bg-card border border-border p-3.5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" /> Customer
              </span>
              {order?.customerPhone && (
                <a
                  href={`tel:${order.customerPhone}`}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                >
                  <Phone className="w-3 h-3" /> Call
                </a>
              )}
            </div>
            <p className="text-xs font-bold text-foreground">
              {mergedOrderData.customerName || 'Customer'}
            </p>
            {deliveryAddressText && (
              <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 leading-relaxed">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span>{deliveryAddressText}</span>
              </p>
            )}
          </div>
        )}

        {/* Delivery Partner Info */}
        {(order?.deliveryPersonId || mergedOrderData.deliveryPersonName) && (
          <div className="rounded-2xl bg-card border border-border p-3.5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5 text-blue-500" /> Delivery Rider
              </span>
              {order?.deliveryPersonPhone && (
                <a
                  href={`tel:${order.deliveryPersonPhone}`}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-500 hover:underline"
                >
                  <Phone className="w-3 h-3" /> Call
                </a>
              )}
            </div>
            <p className="text-xs font-bold text-foreground">
              {mergedOrderData.deliveryPersonName || 'Assigned Rider'}
            </p>
            {order?.deliveryStatus && (
              <p className="text-[11px] text-muted-foreground capitalize">
                Stage: {order.deliveryStatus.replace(/_/g, ' ')}
              </p>
            )}
          </div>
        )}

        {/* Order Items */}
        {order?.items && order.items.length > 0 && (
          <div className="rounded-2xl bg-card border border-border p-3.5 space-y-2.5 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-primary" /> Items ({order.items.length})
            </span>
            <div className="space-y-1.5">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between gap-2 text-xs">
                  <span className="text-foreground font-medium">
                    <span className="font-bold text-primary">{item.quantity}×</span> {item.name}
                  </span>
                  <span className="text-muted-foreground font-mono shrink-0">
                    ₹{item.price * item.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Special Instructions */}
        {order?.specialInstructions && (
          <div className="rounded-2xl bg-accent/50 border border-primary/20 p-3.5 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Instructions
            </span>
            <p className="text-xs text-foreground leading-relaxed">{order.specialInstructions}</p>
          </div>
        )}
      </div>

      {resolvedOrderId && (
        <div className="p-3 border-t border-border bg-card/80 shrink-0">
          <Link href={`/restaurant/orders/${resolvedOrderId}`}>
            <Button className="w-full h-10 rounded-xl text-xs font-bold gap-1.5 shadow-sm">
              Open Full Order Page
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full h-[100dvh] flex overflow-hidden bg-background text-foreground transition-colors duration-300">
      {/* Desktop Left Conversations Sidebar */}
      <aside className="hidden lg:flex w-80 xl:w-[340px] flex-col border-r border-border shrink-0 h-full">
        {renderInboxContent()}
      </aside>

      {/* Main Full-Screen Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Channel Switcher Banner when viewing an order chat */}
        {resolvedOrderId && resolvedChatType === 'customer_delivery' && (
          <div className="px-3 sm:px-5 py-1.5 bg-accent/60 border-b border-border flex items-center justify-between gap-2 text-[11px] shrink-0">
            <span className="text-accent-foreground font-medium truncate flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary shrink-0" />
              Viewing Customer ↔ Delivery Partner thread for order{' '}
              <strong className="font-mono">{mergedOrderData.orderNumber}</strong>
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(
                    `/restaurant/chat/${getDeterministicChatId(resolvedOrderId, 'customer_restaurant')}`
                  )
                }
                className="h-6 px-2 text-[10px] rounded-lg font-bold"
              >
                Customer Chat
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(
                    `/restaurant/chat/${getDeterministicChatId(resolvedOrderId, 'restaurant_delivery')}`
                  )
                }
                className="h-6 px-2 text-[10px] rounded-lg font-bold"
              >
                Rider Chat
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0">
          <ChatBox
            chatId={chatId}
            orderId={resolvedOrderId}
            currentUserId={currentRestUid}
            authUserId={user.uid}
            currentUserName={user.staffName || restaurant?.name || 'Restaurant Staff'}
            currentUserRole="restaurant"
            currentUserImage={restaurant?.image}
            chatType={resolvedChatType}
            participants={chatData?.participants}
            orderData={mergedOrderData}
            fullScreen={true}
            hideOrderSummaryToggle={true}
            headerLeftSlot={
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push('/restaurant/chat')}
                  title="Back to Order Communications Center"
                  className="lg:hidden h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileInboxOpen(true)}
                  title="Open conversations list"
                  className="lg:hidden relative h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                >
                  <MessageSquare className="w-4 h-4" />
                  {totalUnread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-black flex items-center justify-center">
                      {totalUnread > 9 ? '9+' : totalUnread}
                    </span>
                  )}
                </Button>
              </div>
            }
            headerRightSlot={
              <div className="flex items-center gap-1">
                <ThemeToggle className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl border-border/60" />

                {/* Mobile / Tablet Order Info Drawer Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileOrderSheetOpen(true)}
                  title="Order Details"
                  className="xl:hidden h-8 w-8 sm:h-9 sm:w-9 rounded-xl text-muted-foreground hover:text-foreground"
                >
                  <Receipt className="w-4 h-4" />
                </Button>

                {/* Desktop Order Context Toggle */}
                <Button
                  type="button"
                  variant={desktopOrderPanelOpen ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setDesktopOrderPanelOpen((prev) => !prev)}
                  title={desktopOrderPanelOpen ? 'Hide order panel' : 'Show order panel'}
                  className="hidden xl:inline-flex h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
                >
                  {desktopOrderPanelOpen ? (
                    <PanelRightClose className="w-4 h-4" />
                  ) : (
                    <PanelRightOpen className="w-4 h-4" />
                  )}
                </Button>
              </div>
            }
            className="h-full w-full"
          />
        </div>
      </div>

      {/* Desktop Right Order Context Panel */}
      {desktopOrderPanelOpen && (
        <aside className="hidden xl:flex w-80 2xl:w-96 flex-col border-l border-border shrink-0 h-full">
          {renderOrderContextContent()}
        </aside>
      )}

      {/* Mobile Conversations Sheet */}
      <Sheet open={mobileInboxOpen} onOpenChange={setMobileInboxOpen}>
        <SheetContent side="left" className="p-0 w-[88%] max-w-[340px] border-r-border bg-card">
          <SheetTitle className="sr-only">Order Conversations</SheetTitle>
          {renderInboxContent(() => setMobileInboxOpen(false))}
        </SheetContent>
      </Sheet>

      {/* Mobile/Tablet Order Context Sheet */}
      <Sheet open={mobileOrderSheetOpen} onOpenChange={setMobileOrderSheetOpen}>
        <SheetContent side="right" className="p-0 w-[88%] max-w-[360px] border-l-border bg-card">
          <SheetTitle className="sr-only">Order Context Details</SheetTitle>
          {renderOrderContextContent()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
