'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
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
  ArrowRight,
  Headphones,
  ChefHat,
  Bike,
  Sparkles,
  ChevronRight,
  Inbox,
  Filter,
} from 'lucide-react';
import Link from 'next/link';

export default function CustomerChatListPage() {
  const router = useRouter();
  const { user, customer, loading: authLoading } = useAuth();
  const [chats, setChats] = useState<UserChatSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'completed'>('all');
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
        const data = snapshot.val();
        const list: UserChatSummary[] = Object.values(data);
        // Sort descending by last message
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

    if (filterTab === 'active') return c.active !== false;
    if (filterTab === 'completed') return c.active === false;
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
    <div className="min-h-screen bg-slate-950 text-white pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">Order Messages</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Live real-time communication with restaurants and delivery partners for your orders
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/customer/support">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs gap-1.5 h-9 rounded-xl"
              >
                <Headphones className="w-3.5 h-3.5 text-amber-400" />
                Hunger Support
              </Button>
            </Link>
            <Link href="/customer/orders">
              <Button
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-white text-xs gap-1.5 h-9 rounded-xl"
              >
                My Orders
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Search & Tabs */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by restaurant or order..."
              className="pl-9 bg-slate-900 border-slate-800 text-xs rounded-xl text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
            {(['all', 'active', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg capitalize transition ${
                  filterTab === tab
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'all' ? 'All Chats' : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Chat List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-900/60 rounded-2xl animate-pulse border border-slate-800" />
            ))}
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/30 rounded-2xl border border-slate-800/80 p-8 space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Inbox className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">No conversations found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              When you place an order, you can chat with the restaurant and rider directly from your order page.
            </p>
            <div className="pt-2">
              <Link href="/customer/orders">
                <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white text-xs rounded-xl">
                  View Recent Orders
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredChats.map((chat) => (
              <div
                key={chat.chatId}
                onClick={() => router.push(`/customer/chat/${chat.chatId}`)}
                className="group relative bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-md flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 text-base">
                      {chat.participantRole === 'restaurant' ? (
                        <ChefHat className="w-6 h-6 text-orange-400" />
                      ) : chat.participantRole === 'delivery' ? (
                        <Bike className="w-6 h-6 text-blue-400" />
                      ) : (
                        <MessageSquare className="w-6 h-6 text-amber-400" />
                      )}
                    </div>
                    {chat.unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-slate-900 animate-pulse">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm text-slate-100 truncate group-hover:text-amber-400 transition">
                        {chat.participantName || 'Order Chat'}
                      </h4>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-700 text-slate-400">
                        {chat.orderNumber || `#${chat.orderId.slice(-6)}`}
                      </Badge>
                      {chat.participantRole === 'restaurant' && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-orange-500/30 text-orange-400 bg-orange-500/10">
                          Restaurant
                        </Badge>
                      )}
                      {chat.participantRole === 'delivery' && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-blue-500/30 text-blue-400 bg-blue-500/10">
                          Rider
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-1">
                      {chat.lastMessage || 'New conversation'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(chat.lastMessageAt)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
