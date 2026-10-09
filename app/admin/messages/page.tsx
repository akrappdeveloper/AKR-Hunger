'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { ref, onValue, off, update, push, set } from 'firebase/database';
import { realtimeDb } from '@/lib/firebase';
import {
  ChatConversation,
  ChatMessage,
  ChatType,
  sendChatMessage,
  ADMIN_QUICK_REPLIES,
} from '@/lib/chat-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Search,
  Clock,
  Shield,
  ShieldAlert,
  AlertTriangle,
  Send,
  User,
  Store,
  Bike,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  Sparkles,
  Phone,
  FileText,
  Copy,
  ChevronRight,
  Filter,
  Flame,
  Volume2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminMessagingSystemPage() {
  const { admin } = useAdminAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Inspector & Admin Input
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [adminInput, setAdminInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Listen to all chats from RTDB
  useEffect(() => {
    if (!realtimeDb) return;
    setLoading(true);

    const chatsRef = ref(realtimeDb, 'chats');
    const unsubscribe = onValue(chatsRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const list: ChatConversation[] = Object.values(val);
        // Sort descending by last message
        list.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
        setConversations(list);

        // Auto select first if none selected
        if (!selectedChatId && list.length > 0) {
          setSelectedChatId(list[0].chatId);
        }
      } else {
        setConversations([]);
      }
      setLoading(false);
    });

    return () => {
      off(chatsRef);
    };
  }, []);

  // 2. Real-time messages listener for selected conversation
  useEffect(() => {
    if (!realtimeDb || !selectedChatId) return;

    const msgsRef = ref(realtimeDb, `chats/${selectedChatId}/messages`);
    const unsubscribe = onValue(msgsRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const list: ChatMessage[] = Object.values(val);
        list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        setActiveMessages(list);
      } else {
        setActiveMessages([]);
      }
    });

    return () => {
      off(msgsRef);
    };
  }, [selectedChatId]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  const selectedConversation = conversations.find((c) => c.chatId === selectedChatId);

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (c.orderNumber?.toLowerCase() || '').includes(q) ||
      (c.orderId?.toLowerCase() || '').includes(q) ||
      (c.customerName?.toLowerCase() || '').includes(q) ||
      (c.restaurantName?.toLowerCase() || '').includes(q) ||
      (c.deliveryName?.toLowerCase() || '').includes(q) ||
      (c.lastMessage?.toLowerCase() || '').includes(q);

    if (!matchesSearch) return false;

    if (filterType === 'reported') return c.status === 'reported';
    if (filterType === 'active') return c.status === 'active';
    if (filterType === 'customer_restaurant') return c.chatType === 'customer_restaurant';
    if (filterType === 'customer_delivery') return c.chatType === 'customer_delivery';
    if (filterType === 'restaurant_delivery') return c.chatType === 'restaurant_delivery';
    if (filterType === 'support') return c.chatType === 'support';
    return true;
  });

  // Send Super-Admin Intervention Message
  const handleSendAdminMessage = async (customText?: string) => {
    const text = (customText || adminInput).trim();
    if (!text || !selectedConversation || sending) return;

    setSending(true);
    setAdminInput('');

    try {
      await sendChatMessage({
        chatId: selectedConversation.chatId,
        orderId: selectedConversation.orderId,
        senderId: admin?.uid || 'super_admin',
        senderRole: 'admin',
        senderName: `${admin?.name || 'Hunger Support'} (Admin Official)`,
        text,
        type: 'TEXT',
      });
      toast.success('Admin official message broadcast to participants');
    } catch (err: any) {
      console.error('[AdminChat] Send error:', err);
      toast.error('Failed to post admin message');
    } finally {
      setSending(false);
    }
  };

  // Update status (Resolve / Close / Archive)
  const handleUpdateStatus = async (status: 'active' | 'closed' | 'archived') => {
    if (!selectedChatId || !realtimeDb) return;
    try {
      await update(ref(realtimeDb, `chats/${selectedChatId}`), {
        status,
        updatedAt: Date.now(),
      });
      toast.success(`Chat marked as ${status.toUpperCase()}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  // Copy transcript
  const handleCopyTranscript = () => {
    if (!activeMessages.length) return;
    const transcript = activeMessages
      .map(
        (m) =>
          `[${new Date(m.createdAt).toLocaleTimeString()}] ${m.senderName} (${m.senderRole}): ${m.text}`
      )
      .join('\n');
    navigator.clipboard.writeText(transcript);
    toast.success('Conversation transcript copied to clipboard');
  };

  const reportedCount = conversations.filter((c) => c.status === 'reported').length;
  const activeCount = conversations.filter((c) => c.status === 'active').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto min-h-screen">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-purple-500/25">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-foreground tracking-tight">
                  Admin Realtime Power Messaging
                </h1>
                <Badge className="bg-purple-600 text-white font-bold text-xs uppercase px-2 py-0.5">
                  Super-Admin Oversight
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Full platform live chat monitor, customer-restaurant-rider dispute mediation & admin intervention
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="flex items-center gap-3">
          <div className="bg-card border border-border px-4 py-2 rounded-2xl flex items-center gap-3 shadow-xs">
            <span className="text-xs text-muted-foreground font-bold uppercase">Active Chats</span>
            <span className="text-lg font-black text-foreground">{activeCount}</span>
          </div>
          <div className="bg-card border border-destructive/30 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-xs">
            <span className="text-xs text-destructive font-bold uppercase flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Reported
            </span>
            <span className="text-lg font-black text-destructive">{reportedCount}</span>
          </div>
        </div>
      </div>

      {/* Main Split Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-220px)] min-h-[680px]">
        {/* Left Column: Conversations Explorer (5 cols) */}
        <div className="lg:col-span-5 bg-card border border-border rounded-3xl p-4 flex flex-col shadow-sm">
          {/* Search bar */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order, customer, restaurant, rider..."
              className="pl-9 bg-background border-border text-xs rounded-xl h-10"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-2 border-b border-border shrink-0">
            {[
              { id: 'all', label: 'All' },
              { id: 'reported', label: `Reported (${reportedCount})`, danger: true },
              { id: 'customer_restaurant', label: 'Cust ↔ Rest' },
              { id: 'customer_delivery', label: 'Cust ↔ Rider' },
              { id: 'restaurant_delivery', label: 'Rest ↔ Rider' },
              { id: 'support', label: 'Support' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap transition ${
                  filterType === f.id
                    ? f.danger
                      ? 'bg-destructive text-white'
                      : 'bg-purple-600 text-white'
                    : f.danger && reportedCount > 0
                    ? 'bg-destructive/10 text-destructive border border-destructive/20'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-xs space-y-2">
                <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/40" />
                <p>No conversations match the current filter.</p>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = c.chatId === selectedChatId;
                const isReported = c.status === 'reported';

                return (
                  <div
                    key={c.chatId}
                    onClick={() => setSelectedChatId(c.chatId)}
                    className={`p-3 rounded-2xl transition cursor-pointer border text-xs ${
                      isSelected
                        ? 'bg-purple-950/20 border-purple-500/60 shadow-xs'
                        : isReported
                        ? 'bg-destructive/5 border-destructive/30 hover:bg-destructive/10'
                        : 'bg-background hover:bg-muted/40 border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-foreground truncate">
                          {c.customerName || 'Customer'}
                        </span>
                        <span className="text-muted-foreground">↔</span>
                        <span className="font-bold text-foreground truncate">
                          {c.chatType === 'customer_restaurant'
                            ? (c.restaurantName || 'Restaurant')
                            : (c.deliveryName || 'Rider')}
                        </span>
                      </div>

                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 font-mono ${
                          isReported
                            ? 'bg-destructive/20 text-destructive border-destructive/40 animate-pulse'
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        {isReported ? 'REPORTED' : c.orderNumber || `#${c.orderId?.slice(-6)}`}
                      </Badge>
                    </div>

                    <p className="text-[11px] text-muted-foreground truncate mb-1.5">
                      {c.lastMessage || 'Conversation active'}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="capitalize text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                        {c.chatType?.replace('_', ' ')}
                      </span>
                      <span>{new Date(c.lastMessageAt || c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Super-Admin Inspector & Intercom (7 cols) */}
        <div className="lg:col-span-7 bg-card border border-border rounded-3xl flex flex-col shadow-sm overflow-hidden">
          {selectedConversation ? (
            <>
              {/* Header Inspector */}
              <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between gap-3 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-foreground">
                      Order {selectedConversation.orderNumber || `#${selectedConversation.orderId}`}
                    </h3>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold border-purple-500/30 text-purple-600 bg-purple-500/10">
                      {selectedConversation.chatType?.replace('_', ' ')}
                    </Badge>
                    {selectedConversation.status === 'reported' && (
                      <Badge className="bg-destructive text-white text-[10px] font-bold">
                        ⚠️ Reported Issue
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                    <span>Customer: <strong className="text-foreground">{selectedConversation.customerName || 'N/A'}</strong></span>
                    <span>•</span>
                    <span>Restaurant: <strong className="text-foreground">{selectedConversation.restaurantName || 'N/A'}</strong></span>
                    {selectedConversation.deliveryName && (
                      <>
                        <span>•</span>
                        <span>Rider: <strong className="text-foreground">{selectedConversation.deliveryName}</strong></span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status action buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyTranscript}
                    title="Copy Transcript"
                    className="h-8 px-2 text-xs rounded-xl"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" /> Transcript
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateStatus('closed')}
                    className="h-8 px-2 text-xs rounded-xl border-border hover:bg-muted"
                  >
                    Close
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleUpdateStatus('active')}
                    className="h-8 px-2.5 text-xs rounded-xl bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Resolve & Re-open
                  </Button>
                </div>
              </div>

              {/* Real-time Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background">
                {activeMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                    No messages in this conversation yet.
                  </div>
                ) : (
                  activeMessages.map((msg, i) => {
                    const isAdmin = msg.senderRole === 'admin';
                    const isSystem = msg.type === 'SYSTEM' || msg.type === 'ORDER_UPDATE';

                    if (isSystem) {
                      return (
                        <div key={i} className="flex justify-center my-1.5">
                          <div className="bg-muted/60 border border-border rounded-xl px-3 py-1.5 text-center max-w-md">
                            <p className="text-xs text-muted-foreground font-medium">{msg.text}</p>
                            <span className="text-[9px] text-muted-foreground/80 block mt-0.5">
                              {new Date(msg.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={i}
                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'} space-y-1`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span className="font-bold text-foreground">{msg.senderName}</span>
                          <span className="uppercase text-[9px] px-1 py-0.5 rounded bg-muted font-bold">
                            {msg.senderRole}
                          </span>
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-xs break-words ${
                            isAdmin
                              ? 'bg-purple-600 text-white rounded-br-none'
                              : msg.senderRole === 'customer'
                              ? 'bg-amber-500/10 border border-amber-500/30 text-foreground rounded-bl-none'
                              : msg.senderRole === 'restaurant'
                              ? 'bg-orange-500/10 border border-orange-500/30 text-foreground rounded-bl-none'
                              : 'bg-blue-500/10 border border-blue-500/30 text-foreground rounded-bl-none'
                          }`}
                        >
                          {msg.mediaPath && (
                            <img
                              src={msg.mediaPath}
                              alt="Attachment"
                              className="max-h-48 rounded-lg mb-1.5 object-cover"
                            />
                          )}
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Admin Quick Intervention Pill Bar */}
              <div className="px-3 py-1.5 bg-muted/40 border-t border-border flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                <span className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400 whitespace-nowrap">
                  Admin Action:
                </span>
                {ADMIN_QUICK_REPLIES.map((qr, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendAdminMessage(qr)}
                    disabled={sending}
                    className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-card hover:bg-purple-500/10 hover:border-purple-500/40 border border-border text-foreground transition shrink-0"
                  >
                    {qr}
                  </button>
                ))}
              </div>

              {/* Admin Input Bar */}
              <div className="p-3 border-t border-border bg-card flex items-center gap-2 shrink-0">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-600/10 text-purple-600 shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <Input
                  value={adminInput}
                  onChange={(e) => setAdminInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendAdminMessage();
                    }
                  }}
                  placeholder="Type official admin intervention message to all participants..."
                  className="flex-1 bg-background border-border text-xs rounded-xl h-10"
                />
                <Button
                  onClick={() => handleSendAdminMessage()}
                  disabled={!adminInput.trim() || sending}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-10 px-4 text-xs font-bold gap-1 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  Intervene
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center space-y-3">
              <Shield className="w-12 h-12 text-purple-600/40" />
              <h4 className="text-base font-bold text-foreground">Select a conversation to inspect</h4>
              <p className="text-xs text-muted-foreground max-w-sm">
                Choose any active, completed, or reported conversation from the list to monitor messages in real time or intervene with official administrative authority.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
