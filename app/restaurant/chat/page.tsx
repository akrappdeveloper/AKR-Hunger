'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { ref, onValue, off } from 'firebase/database';
import { realtimeDb } from '@/lib/firebase';
import { UserChatSummary } from '@/lib/chat-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Search,
  Clock,
  Bike,
  User,
  ChevronRight,
  Inbox,
  ChefHat,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

export default function RestaurantChatHubPage() {
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();
  const [chats, setChats] = useState<UserChatSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'customer' | 'delivery' | 'active'>('all');
  const [loading, setLoading] = useState(true);

  const currentRestUid = restaurant?.id || user?.restaurantId || user?.uid;

  useEffect(() => {
    if (!currentRestUid || !realtimeDb) {
      if (!authLoading && !user) setLoading(false);
      return;
    }

    setLoading(true);
    const userChatsRef = ref(realtimeDb, `userChats/${currentRestUid}`);

    const unsubscribe = onValue(userChatsRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const list: UserChatSummary[] = Object.values(val);
        list.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
        setChats(list);
      } else {
        setChats([]);
      }
      setLoading(false);
    });

    return () => {
      off(userChatsRef);
    };
  }, [currentRestUid, authLoading, user]);

  const filteredChats = chats.filter((c) => {
    const matchesSearch =
      (c.participantName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (c.orderNumber?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (c.lastMessage?.toLowerCase() || '').includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'customer') return c.chatType === 'customer_restaurant';
    if (activeTab === 'delivery') return c.chatType === 'restaurant_delivery';
    if (activeTab === 'active') return c.active !== false;
    return true;
  });

  const formatTime = (ts?: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">Order Communications Center</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Real-time messaging with your hungry customers and assigned delivery riders
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/restaurant/orders">
            <Button size="sm" variant="outline" className="text-xs h-9 rounded-xl font-bold">
              View Active Kitchen Orders
            </Button>
          </Link>
        </div>
      </div>

      {/* Search & Tabs */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer, rider or order..."
            className="pl-9 text-xs rounded-xl h-10 bg-card border-border"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-card p-1 rounded-xl border border-border w-full sm:w-auto overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All Messages' },
            { id: 'customer', label: 'Customers' },
            { id: 'delivery', label: 'Delivery Riders' },
            { id: 'active', label: 'Active Orders' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-card rounded-2xl animate-pulse border border-border" />
          ))}
        </div>
      ) : filteredChats.length === 0 ? (
        <div className="text-center py-16 bg-card/50 rounded-3xl border border-border p-8 space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
            <Inbox className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-foreground">No conversations found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Messages from customers and delivery partners regarding preparation, delays, or pickup will appear here in real time.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredChats.map((chat) => (
            <div
              key={chat.chatId}
              onClick={() => router.push(`/restaurant/chat/${chat.chatId}`)}
              className="group bg-card hover:bg-muted/40 border border-border hover:border-border/80 rounded-2xl p-4 transition duration-200 cursor-pointer shadow-xs flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-base">
                    {chat.chatType === 'restaurant_delivery' ? (
                      <Bike className="w-6 h-6 text-blue-500" />
                    ) : (
                      <User className="w-6 h-6 text-orange-500" />
                    )}
                  </div>
                  {chat.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-background animate-pulse">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-sm text-foreground truncate group-hover:text-primary transition">
                      {chat.participantName || 'Order Contact'}
                    </h4>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground font-mono">
                      {chat.orderNumber || `#${chat.orderId.slice(-6)}`}
                    </Badge>
                    {chat.chatType === 'restaurant_delivery' ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-500 bg-blue-500/10">
                        Delivery Valet
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-500/30 text-orange-500 bg-orange-500/10">
                        Customer
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {chat.lastMessage || 'New message'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(chat.lastMessageAt)}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
