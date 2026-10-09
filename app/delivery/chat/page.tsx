'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
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
  ChefHat,
  User,
  ChevronRight,
  Inbox,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';

export default function DeliveryChatHubPage() {
  const router = useRouter();
  const { user, deliveryPartner, loading: authLoading } = useDeliveryAuth();
  const [chats, setChats] = useState<UserChatSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'customer' | 'restaurant'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !realtimeDb) {
      if (!authLoading && !user) setLoading(false);
      return;
    }

    setLoading(true);
    const userChatsRef = ref(realtimeDb, `userChats/${user.uid}`);

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
  }, [user?.uid, authLoading]);

  const filteredChats = chats.filter((c) => {
    const matchesSearch =
      (c.participantName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (c.orderNumber?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (c.lastMessage?.toLowerCase() || '').includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterType === 'customer') return c.chatType === 'customer_delivery';
    if (filterType === 'restaurant') return c.chatType === 'restaurant_delivery';
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Bike className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">Rider Communications Hub</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Quick messages with customers & restaurants for assigned delivery runs
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/delivery/tracking">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 rounded-xl">
              Back to Live Radar
            </Button>
          </Link>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 flex items-center gap-3 text-amber-500 dark:text-amber-400 text-xs">
        <ShieldAlert className="w-5 h-5 shrink-0" />
        <p className="font-medium">
          <strong>Safety First:</strong> Never text while driving your vehicle. Only communicate when stopped safely at the curb.
        </p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order or contact..."
            className="pl-9 text-xs rounded-xl h-11 bg-card border-border"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-card p-1 rounded-xl border border-border w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Messages' },
            { id: 'customer', label: 'Customers' },
            { id: 'restaurant', label: 'Restaurants' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`text-xs font-bold px-3 py-2 rounded-lg transition ${
                filterType === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
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
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-card rounded-2xl animate-pulse border border-border" />
          ))}
        </div>
      ) : filteredChats.length === 0 ? (
        <div className="text-center py-16 bg-card/50 rounded-3xl border border-border p-8 space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
            <Inbox className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-foreground">No active delivery chats</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            When you accept a delivery order, conversation threads with the customer and pickup restaurant will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredChats.map((chat) => (
            <div
              key={chat.chatId}
              onClick={() => router.push(`/delivery/chat/${chat.chatId}`)}
              className="group bg-card hover:bg-muted/40 border border-border hover:border-blue-500/50 rounded-2xl p-4.5 transition duration-200 cursor-pointer shadow-xs flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-13 h-13 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-blue-500 text-lg">
                    {chat.chatType === 'restaurant_delivery' ? (
                      <ChefHat className="w-7 h-7 text-orange-500" />
                    ) : (
                      <User className="w-7 h-7 text-blue-500" />
                    )}
                  </div>
                  {chat.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-blue-600 text-white font-black text-[11px] w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-background animate-pulse">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-sm sm:text-base text-foreground truncate group-hover:text-blue-500 transition">
                      {chat.participantName || 'Delivery Contact'}
                    </h4>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground font-mono">
                      {chat.orderNumber || `#${chat.orderId.slice(-6)}`}
                    </Badge>
                    {chat.chatType === 'restaurant_delivery' ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-500/30 text-orange-500 bg-orange-500/10">
                        Kitchen Pickup
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-500 bg-blue-500/10">
                        Customer Drop
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {chat.lastMessage || 'New message'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTime(chat.lastMessageAt)}
                </span>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
