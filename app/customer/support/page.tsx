'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { db, realtimeDb } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  getDocs,
  limit,
} from 'firebase/firestore';
import { ref as rtdbRef, push as rtdbPush, set as rtdbSet, onValue as rtdbOnValue } from 'firebase/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  LifeBuoy,
  MessageCircle,
  Phone,
  Mail,
  HelpCircle,
  Sparkles,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  ArrowLeft,
  ChevronRight,
  Search,
  MessageSquare,
  Bot,
  Package,
  ShieldAlert,
  Loader2,
  ExternalLink,
  RotateCcw,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import AIChatbot from '@/components/ai/AIChatbot';

interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: 'order' | 'refund' | 'payment' | 'delivery' | 'food_quality' | 'account' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  orderId?: string;
  description: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  createdAt: any;
  updatedAt?: any;
  replies?: Array<{
    id: string;
    sender: 'customer' | 'support' | 'ai';
    senderName: string;
    text: string;
    timestamp: any;
  }>;
}

interface RecentOrderOption {
  id: string;
  restaurantName: string;
  total: number;
  status: string;
  createdAt: any;
}

const FAQ_ITEMS = [
  {
    category: 'Orders',
    q: 'Where is my order and how do I track it?',
    a: "You can track your meal in real-time from the 'Orders' tab in your bottom bar or customer navigation menu. You will see live kitchen preparation stages, rider pickup, and interactive live GPS on the map.",
  },
  {
    category: 'Orders',
    q: 'Can I cancel an order after placing it?',
    a: "Orders can be cancelled free of charge within 60 seconds of placing, or before the restaurant accepts the order. Once the kitchen starts cooking, cancellations may be subject to a cancellation fee.",
  },
  {
    category: 'Payments',
    q: 'When will I receive my refund?',
    a: 'Refunds directly credited to your Hunger Wallet are instantaneous! Refunds returned to original payment sources (UPI, Credit/Debit Cards, NetBanking) are processed via Razorpay within 3-5 business days.',
  },
  {
    category: 'Food Quality',
    q: 'What should I do if an item is missing or spoiled?',
    a: 'We deeply apologize! Tap "+ Create Ticket" above, select your affected order, and our team will issue an instant credit refund or arrange a priority redelivery immediately.',
  },
  {
    category: 'Rewards',
    q: 'How do Hunger Reward Points work?',
    a: 'Every time you order or post a food review, you earn points. Points can be redeemed for free delivery vouchers, flat ₹50-₹100 discount coupons, or VIP Elite passes in the Rewards section.',
  },
  {
    category: 'Delivery',
    q: 'What happens if my delivery partner is delayed by traffic/weather?',
    a: 'Our AI routing actively calculates bad weather and city traffic delays. If delivery exceeds estimated preparation time by more than 20 minutes, you will receive a late-delivery compensation voucher in your wallet.',
  },
];

export default function CustomerSupportPage() {
  const { user, customer, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<'tickets' | 'ai-chat' | 'faq' | 'contact'>('tickets');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  // New Ticket Dialog State
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState<SupportTicket['category']>('order');
  const [ticketPriority, setTicketPriority] = useState<SupportTicket['priority']>('medium');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [recentOrders, setRecentOrders] = useState<RecentOrderOption[]>([]);

  // Active Ticket Live Chat View
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedTicketIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedTicketIdRef.current = selectedTicket?.id || null;
  }, [selectedTicket?.id]);

  // FAQ Search
  const [faqSearch, setFaqSearch] = useState('');

  // 1. Real-time ticket listener for logged-in customer (Supports both userId and customerId without requiring composite indexes)
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setTickets([]);
      setLoadingTickets(false);
      return;
    }

    setLoadingTickets(true);

    const parseTimestamp = (val: any): number => {
      if (!val) return 0;
      if (typeof val.toMillis === 'function') return val.toMillis();
      if (val instanceof Date) return val.getTime();
      if (typeof val.seconds === 'number') return val.seconds * 1000;
      const parsed = new Date(val).getTime();
      return isNaN(parsed) ? 0 : parsed;
    };

    const userDocsMap = new Map<string, SupportTicket>();
    const customerDocsMap = new Map<string, SupportTicket>();

    const updateAndMerge = () => {
      const mergedMap = new Map<string, SupportTicket>();
      userDocsMap.forEach((ticket, id) => mergedMap.set(id, ticket));
      customerDocsMap.forEach((ticket, id) => mergedMap.set(id, ticket));

      const list = Array.from(mergedMap.values());
      // Sort in memory by createdAt descending
      list.sort((a, b) => parseTimestamp(b.createdAt) - parseTimestamp(a.createdAt));

      setTickets(list);
      setLoadingTickets(false);

      // Keep active open ticket modal updated in real-time
      if (selectedTicketIdRef.current) {
        const fresh = mergedMap.get(selectedTicketIdRef.current);
        if (fresh) setSelectedTicket(fresh);
      }
    };

    // Query 1: by userId (Single-field index is built-in by default in Firestore)
    const qUser = query(
      collection(db, 'supportTickets'),
      where('userId', '==', user.uid)
    );

    // Query 2: by customerId (Ensures Android and Web tickets both show)
    const qCustomer = query(
      collection(db, 'supportTickets'),
      where('customerId', '==', user.uid)
    );

    const unsubUser = onSnapshot(
      qUser,
      (snapshot) => {
        userDocsMap.clear();
        snapshot.docs.forEach((docSnap) => {
          userDocsMap.set(docSnap.id, {
            id: docSnap.id,
            ...docSnap.data(),
          } as SupportTicket);
        });
        updateAndMerge();
      },
      (error) => {
        console.warn('Support ticket (userId) notice:', error);
        setLoadingTickets(false);
      }
    );

    const unsubCustomer = onSnapshot(
      qCustomer,
      (snapshot) => {
        customerDocsMap.clear();
        snapshot.docs.forEach((docSnap) => {
          customerDocsMap.set(docSnap.id, {
            id: docSnap.id,
            ...docSnap.data(),
          } as SupportTicket);
        });
        updateAndMerge();
      },
      (error) => {
        console.warn('Support ticket (customerId) notice:', error);
        setLoadingTickets(false);
      }
    );

    return () => {
      unsubUser();
      unsubCustomer();
    };
  }, [user?.uid, authLoading]);

  // 2. Fetch customer's recent orders for the order selector dropdown (Sorted in memory to avoid missing index errors)
  useEffect(() => {
    if (!user || !newTicketOpen) return;

    const fetchOrders = async () => {
      try {
        const ordersQ = query(
          collection(db, 'orders'),
          where('customerId', '==', user.uid)
        );
        const snap = await getDocs(ordersQ);
        const mapped = snap.docs.map((d) => ({
          id: d.id,
          restaurantName: d.data().restaurantName || 'Restaurant',
          total: d.data().total || 0,
          status: d.data().status || 'completed',
          createdAt: d.data().createdAt,
        }));
        mapped.sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });
        setRecentOrders(mapped.slice(0, 8));
      } catch (err) {
        console.warn('Could not fetch recent orders for ticket:', err);
      }
    };

    fetchOrders();
  }, [user?.uid, newTicketOpen]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicket?.replies]);

  // Submit New Support Ticket
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please log in to submit a support ticket');
      return;
    }

    if (!ticketSubject.trim() || !ticketDescription.trim()) {
      toast.error('Please provide a subject and detailed description');
      return;
    }

    setSubmittingTicket(true);
    try {
      const newTicketData = {
        userId: user.uid,
        customerId: user.uid,
        userType: 'customer',
        userName: customer?.name || user.displayName || 'Customer',
        userEmail: customer?.email || user.email || '',
        userPhone: customer?.phone || '',
        subject: ticketSubject.trim(),
        category: ticketCategory,
        priority: ticketPriority,
        orderId: selectedOrderId || null,
        description: ticketDescription.trim(),
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        replies: [
          {
            id: `reply-${Date.now()}`,
            sender: 'customer',
            senderName: customer?.name || user.displayName || 'Customer',
            text: ticketDescription.trim(),
            timestamp: new Date().toISOString(),
          },
        ],
      };

      // 1. Add to Firestore collection 'supportTickets'
      const docRef = await addDoc(collection(db, 'supportTickets'), newTicketData);

      // 2. Dual-write to Firebase Realtime Database for instant push
      try {
        if (realtimeDb) {
          const chatRef = rtdbRef(realtimeDb, `supportChats/${docRef.id}`);
          await rtdbSet(chatRef, {
            ticketId: docRef.id,
            status: 'open',
            subject: ticketSubject.trim(),
            createdAt: Date.now(),
          });
        }
      } catch (_) { }

      toast.success('🎉 Support ticket created! Our team will respond shortly.');

      // Reset
      setTicketSubject('');
      setTicketDescription('');
      setSelectedOrderId('');
      setNewTicketOpen(false);
      setActiveTab('tickets');
    } catch (err) {
      console.error('Failed to create ticket:', err);
      toast.error('Failed to create ticket. Please try again.');
    } finally {
      setSubmittingTicket(false);
    }
  };

  // Send Message inside Ticket
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTicket || !replyMessage.trim()) return;

    setSendingReply(true);
    try {
      const replyObj = {
        id: `reply-${Date.now()}`,
        sender: 'customer' as const,
        senderName: customer?.name || user.displayName || 'Customer',
        text: replyMessage.trim(),
        timestamp: new Date().toISOString(),
      };

      // Update in Firestore
      await updateDoc(doc(db, 'supportTickets', selectedTicket.id), {
        replies: arrayUnion(replyObj),
        updatedAt: serverTimestamp(),
        // If ticket was resolved, sending message reopens it
        status: selectedTicket.status === 'resolved' ? 'open' : selectedTicket.status,
      });

      // Optional RTDB sync
      try {
        if (realtimeDb) {
          const messagesRef = rtdbRef(realtimeDb, `supportChats/${selectedTicket.id}/messages`);
          await rtdbPush(messagesRef, replyObj);
        }
      } catch (_) { }

      setReplyMessage('');
      toast.success('Message sent!');
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setSendingReply(false);
    }
  };

  // Mark Ticket as Resolved
  const handleMarkResolved = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'supportTickets', ticketId), {
        status: 'resolved',
        updatedAt: serverTimestamp(),
      });
      toast.success('Ticket marked as resolved');
    } catch (err) {
      toast.error('Failed to update ticket status');
    }
  };

  const getStatusBadge = (status?: string) => {
    const s = (status || 'open').toLowerCase().replace('_', '-');
    switch (s) {
      case 'open':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs font-bold gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Open
          </Badge>
        );
      case 'in-progress':
        return (
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-xs font-bold gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> In Progress
          </Badge>
        );
      case 'resolved':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-bold gap-1">
            <Check className="w-3 h-3" /> Resolved
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs font-semibold capitalize">
            {s}
          </Badge>
        );
    }
  };

  const getPriorityBadge = (priority?: string) => {
    const p = (priority || 'medium').toLowerCase();
    switch (p) {
      case 'urgent':
        return (
          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-[10px] font-bold">
            Urgent
          </Badge>
        );
      case 'high':
        return (
          <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 text-[10px] font-bold">
            High
          </Badge>
        );
      case 'low':
        return (
          <Badge className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20 text-[10px] font-bold">
            Low
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatTicketDate = (val: any): string => {
    if (!val) return 'Recently';
    let date: Date;
    if (typeof val.toDate === 'function') {
      date = val.toDate();
    } else if (val instanceof Date) {
      date = val;
    } else if (typeof val.seconds === 'number') {
      date = new Date(val.seconds * 1000);
    } else {
      date = new Date(val);
    }
    if (isNaN(date.getTime())) return 'Recently';
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredFaqs = FAQ_ITEMS.filter(
    (f) =>
      !faqSearch ||
      f.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
      f.a.toLowerCase().includes(faqSearch.toLowerCase()) ||
      f.category.toLowerCase().includes(faqSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 selection:bg-primary/20">
      {/* Top Header Banner matching Customer Panel */}
      <div className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-primary/5 to-transparent border-b border-border/50 py-8 sm:py-12">
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link
              href="/customer"
              className="inline-flex items-center gap-1.5 hover:text-foreground font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Link>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center shadow-inner">
                  <LifeBuoy className="w-5 h-5" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  Customer Support & Helpdesk
                </h1>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-bold">
                  24/7 Live
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                Real-time ticket tracking, instant AI order resolutions, and dedicated support for your hunger cravings.
              </p>
            </div>

            {/* Action to create new ticket */}
            <Button
              onClick={() => setNewTicketOpen(true)}
              size="lg"
              className="rounded-2xl gap-2 font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 hover:scale-[1.02] transition-all self-start md:self-auto"
            >
              <Plus className="w-4 h-4" /> Create Support Ticket
            </Button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-2 mt-8">
            {[
              { id: 'tickets', label: `My Tickets (${tickets.length})`, icon: Clock },
              { id: 'ai-chat', label: 'AI Order Assistant', icon: Bot },
              { id: 'faq', label: 'Help & FAQs', icon: HelpCircle },
              { id: 'contact', label: 'Direct Helpline', icon: Phone },
            ].map((tabItem) => {
              const Icon = tabItem.icon;
              const isActive = activeTab === tabItem.id;
              return (
                <button
                  key={tabItem.id}
                  onClick={() => setActiveTab(tabItem.id as any)}
                  className={`text-xs sm:text-sm px-4 py-2 rounded-2xl font-bold transition-all flex items-center gap-2 ${isActive
                    ? 'bg-card text-foreground shadow-sm border border-border/80'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tabItem.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab 1: My Support Tickets */}
        {activeTab === 'tickets' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-foreground">Support Tickets & Resolution Status</h2>
                <p className="text-xs text-muted-foreground">
                  Track live agent updates and chat directly on ongoing issues.
                </p>
              </div>
            </div>

            {!user && !authLoading ? (
              /* Not Logged In State */
              <div className="max-w-md mx-auto text-center py-16 px-4">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-4">
                  <AlertCircle className="w-10 h-10" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">Please Sign In to View Tickets</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-6">
                  Log in with your customer account to track your support tickets and chat directly with our resolution team.
                </p>
                <Link href="/auth/login?redirect=/customer/support">
                  <Button className="rounded-2xl font-bold bg-primary text-primary-foreground shadow-md">
                    Log In to Hunger
                  </Button>
                </Link>
              </div>
            ) : loadingTickets ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-44 rounded-3xl bg-muted/40 animate-pulse border border-border/50" />
                ))}
              </div>
            ) : tickets.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {tickets.map((t) => (
                  <Card
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className="rounded-3xl border border-border/70 bg-card hover:border-primary/50 hover:shadow-xl transition-all duration-300 p-5 flex flex-col justify-between cursor-pointer group"
                  >
                    <div>
                      {/* Status and Category */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            {(t.category || 'general').toUpperCase()}
                          </span>
                          {getPriorityBadge(t.priority)}
                        </div>
                        {getStatusBadge(t.status)}
                      </div>

                      <h3 className="font-black text-base text-foreground leading-snug group-hover:text-primary transition-colors mb-1 line-clamp-1">
                        {t.subject || 'Support Ticket'}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        {t.description || 'No description provided.'}
                      </p>

                      {t.orderId && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-[11px] font-semibold text-muted-foreground mb-2">
                          <Package className="w-3 h-3 text-primary" /> Order #{String(t.orderId).slice(-6).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground/70" />
                        {formatTicketDate(t.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-primary" />
                        {t.replies?.length || 1}
                      </span>
                      <span className="text-primary font-bold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                        Open Chat &rarr;
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              /* Empty Tickets State */
              <div className="max-w-md mx-auto text-center py-16 px-4">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-muted/60 border border-border/60 flex items-center justify-center text-muted-foreground mb-4">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">No active support tickets</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-6">
                  Everything looks peaceful! If you have any issue with an order, missing dish, or payment, create a ticket.
                </p>
                <Button
                  onClick={() => setNewTicketOpen(true)}
                  className="rounded-2xl font-bold bg-primary text-primary-foreground"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Create Ticket
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Instant AI Assistant */}
        {activeTab === 'ai-chat' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <Card className="rounded-3xl border border-border/80 bg-card p-6 shadow-xl overflow-hidden">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border/60">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-foreground">Hunger AI Support Assistant</h3>
                  <p className="text-xs text-muted-foreground">
                    Instant 24/7 automated resolution for refunds, order progress, and menu suggestions
                  </p>
                </div>
              </div>

              {/* Integrated AI Chatbot component */}
              <div className="min-h-[480px]">
                <AIChatbot initialRole="customer" onOpenTicket={() => setNewTicketOpen(true)} />
              </div>
            </Card>
          </div>
        )}

        {/* Tab 3: FAQs */}
        {activeTab === 'faq' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search common questions, refunds, delivery..."
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                className="pl-11 h-12 rounded-2xl bg-card border-border text-sm shadow-sm"
              />
            </div>

            <div className="space-y-3">
              {filteredFaqs.map((faq, i) => (
                <Card key={i} className="rounded-2xl border border-border/70 bg-card p-5">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1 block">
                    {faq.category}
                  </span>
                  <h4 className="font-bold text-base text-foreground mb-2">{faq.q}</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Contact Channels */}
        {activeTab === 'contact' && (
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="rounded-3xl border border-border/70 bg-card p-6 flex flex-col justify-between text-center items-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3 text-2xl">
                💬
              </div>
              <h3 className="font-black text-lg text-foreground mb-1">WhatsApp Hotline</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Chat with our real-time customer happiness team directly on WhatsApp.
              </p>
              <a
                href="https://wa.me/916393752013?text=Hello%20Hunger%20Support%2C%20I%20need%20help%20with%20my%20order"
                target="_blank"
                rel="noreferrer"
                className="w-full"
              >
                <Button className="w-full rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                  <ExternalLink className="w-4 h-4" /> Open WhatsApp (+91 6393752013)
                </Button>
              </a>
            </Card>

            <Card className="rounded-3xl border border-border/70 bg-card p-6 flex flex-col justify-between text-center items-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3 text-2xl">
                📞
              </div>
              <h3 className="font-black text-lg text-foreground mb-1">Toll-Free Helpline</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Immediate phone call support with our culinary resolution desk.
              </p>
              <a href="tel:+916393752013" className="w-full">
                <Button variant="outline" className="w-full rounded-2xl font-bold border-primary text-primary gap-2">
                  <Phone className="w-4 h-4" /> Call +91 6393752013
                </Button>
              </a>
            </Card>

            <Card className="rounded-3xl border border-border/70 bg-card p-6 flex flex-col justify-between text-center items-center">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-3 text-2xl">
                ✉️
              </div>
              <h3 className="font-black text-lg text-foreground mb-1">Email Desk</h3>
              <p className="text-xs text-muted-foreground mb-4">
                For corporate inquiries, billing audits, or detailed feedback.
              </p>
              <a href="mailto:hunger@gmail.com" className="w-full">
                <Button variant="secondary" className="w-full rounded-2xl font-bold gap-2">
                  <Mail className="w-4 h-4" /> hunger@gmail.com
                </Button>
              </a>
            </Card>
          </div>
        )}
      </div>

      {/* Dialog: Create New Support Ticket */}
      <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
        <DialogContent className="sm:max-w-lg bg-card text-card-foreground border-border/80 shadow-2xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground">Create Support Ticket</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Submit your concern to our dedicated 24/7 customer care team.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTicket} className="space-y-4 mt-2">
            {/* Category Selector */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                Category
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'order', label: 'Order Issue' },
                  { id: 'refund', label: 'Refund/Payment' },
                  { id: 'delivery', label: 'Delivery Delay' },
                  { id: 'food_quality', label: 'Food Quality' },
                  { id: 'account', label: 'Account/VIP' },
                  { id: 'other', label: 'Other' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setTicketCategory(c.id as any)}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${ticketCategory === c.id
                      ? 'bg-primary/10 border-primary text-primary shadow-sm'
                      : 'bg-muted/50 border-border/60 text-muted-foreground hover:bg-muted'
                      }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Link to Recent Order (optional) */}
            {recentOrders.length > 0 && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                  Link to Recent Order (Optional)
                </label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-muted/50 border border-border/70 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">No specific order</option>
                  {recentOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      Order #{o.id.slice(-6).toUpperCase()} — {o.restaurantName} (₹{o.total})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Subject */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Subject *</label>
              <Input
                required
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="e.g. Missing beverage from order / Payment deducted twice"
                className="rounded-xl bg-muted/50 border-border/70 text-sm"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Detailed Description *</label>
              <Textarea
                required
                rows={4}
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                placeholder="Please describe what happened so our team can resolve it immediately..."
                className="rounded-xl bg-muted/50 border-border/70 text-sm resize-none"
              />
            </div>

            <DialogFooter className="pt-3 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewTicketOpen(false)}
                className="rounded-xl flex-1 font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingTicket}
                className="rounded-xl flex-1 font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20"
              >
                {submittingTicket ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Submitting...
                  </>
                ) : (
                  'Submit Ticket'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Active Ticket Live Conversation */}
      {selectedTicket && (
        <Dialog open={Boolean(selectedTicket)} onOpenChange={() => setSelectedTicket(null)}>
          <DialogContent className="sm:max-w-2xl bg-card text-card-foreground border-border/80 shadow-2xl rounded-3xl p-0 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <DialogHeader className="p-5 border-b border-border/70 bg-muted/30 flex flex-row items-center justify-between gap-4 space-y-0 text-left">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold text-primary uppercase">
                    Ticket #{selectedTicket.id.slice(-6).toUpperCase()}
                  </span>
                  {getStatusBadge(selectedTicket.status)}
                </div>
                <DialogTitle className="font-black text-lg text-foreground truncate">
                  {selectedTicket.subject}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Category: {selectedTicket.category?.toUpperCase() || 'GENERAL'} • Real-time Live Support
                </DialogDescription>
              </div>

              {selectedTicket.status !== 'resolved' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMarkResolved(selectedTicket.id)}
                  className="rounded-xl text-xs font-bold border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 flex-shrink-0"
                >
                  <Check className="w-3.5 h-3.5 mr-1" /> Mark Resolved
                </Button>
              )}
            </DialogHeader>

            {/* Chat Thread */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 max-h-[420px] bg-background/50">
              {selectedTicket.replies && selectedTicket.replies.length > 0 ? (
                selectedTicket.replies.map((reply, idx) => {
                  const isCustomer = reply.sender === 'customer';
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {reply.senderName || (isCustomer ? 'You' : 'Hunger Support')}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          {reply.timestamp ? new Date(reply.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div
                        className={`p-3.5 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed ${isCustomer
                          ? 'bg-primary text-primary-foreground rounded-tr-none shadow-md shadow-primary/10'
                          : 'bg-card border border-border/80 text-foreground rounded-tl-none shadow-sm'
                          }`}
                      >
                        {reply.text}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No conversation messages yet.
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Footer */}
            <form onSubmit={handleSendReply} className="p-4 border-t border-border/70 bg-card flex items-center gap-2">
              <Input
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Type your message to support agent..."
                className="rounded-2xl bg-muted/50 border-border text-xs sm:text-sm h-11"
              />
              <Button
                type="submit"
                disabled={sendingReply || !replyMessage.trim()}
                className="rounded-2xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-5 shadow-sm"
              >
                {sendingReply ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
