'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
  arrayUnion,
  serverTimestamp,
  increment,
  addDoc,
} from 'firebase/firestore';
import { ref as rtdbRef, push as rtdbPush, onValue as rtdbOnValue } from 'firebase/database';
import { db, realtimeDb } from '@/lib/firebase';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  Truck,
  MessageSquare,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Phone,
  Mail,
  Send,
  RefreshCw,
  Wallet,
  ShieldCheck,
  User,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  DollarSign,
  Package,
  Bike,
  Sparkles,
  MapPin,
  Check,
  X,
  MoreVertical,
  LifeBuoy
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface DeliveryTicket {
  id: string;
  userId: string;
  userType?: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  orderId?: string;
  replies?: any[];
  createdAt: any;
  updatedAt?: any;
}

const CANNED_DELIVERY_RESPONSES = [
  {
    label: '🛵 Fuel Allowance Credited',
    text: 'Hello Partner! We have reviewed your route distance discrepancy. An additional fuel incentive of ₹50 has been credited to your delivery wallet.',
  },
  {
    label: '🍽️ Restaurant Delay Compensated',
    text: 'We understand you had to wait at the merchant kitchen. Your waiting time penalty has been waived and extra waiting incentive added.',
  },
  {
    label: '📍 Customer Address Corrected',
    text: 'The customer drop location pin has been updated in our navigation gateway. Please check your active order screen for the updated route.',
  },
  {
    label: '✅ Delivery Issue Resolved',
    text: 'Your reported inquiry has been investigated and marked resolved by our fleet management desk. Thank you for your service!',
  },
];

export default function AdminDeliverySupportPage() {
  const { admin } = useAdminAuth();
  const [tickets, setTickets] = useState<DeliveryTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<DeliveryTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in-progress' | 'resolved' | 'closed'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Wallet Compensation Modal
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('Wait-time & distance resolution bonus');
  const [processingCredit, setProcessingCredit] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Listen for Delivery Support Tickets in Firestore
  useEffect(() => {
    const q = query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allData = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as DeliveryTicket[];

        // Filter for delivery partner tickets
        const deliveryOnly = allData.filter(
          (t) => (t.userType || '').toLowerCase() === 'delivery' || t.category === 'delivery' || t.category === 'kyc'
        );

        setTickets(deliveryOnly);
        setLoading(false);

        if (selectedTicket) {
          const updated = deliveryOnly.find((t) => t.id === selectedTicket.id);
          if (updated) setSelectedTicket(updated);
        } else if (deliveryOnly.length > 0) {
          setSelectedTicket(deliveryOnly[0]);
        }
      },
      (error) => {
        console.error('Error fetching delivery tickets:', error);
        toast.error('Failed to load tickets in real-time');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedTicket?.id]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicket?.replies]);

  // Update Status
  const updateStatus = async (ticketId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'supportTickets', ticketId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      toast.success(`Ticket marked as ${newStatus.toUpperCase()}`);
    } catch (err: any) {
      toast.error('Failed to update status: ' + err.message);
    }
  };

  // Update Priority
  const updatePriority = async (ticketId: string, newPriority: string) => {
    try {
      await updateDoc(doc(db, 'supportTickets', ticketId), {
        priority: newPriority,
        updatedAt: serverTimestamp(),
      });
      toast.success(`Priority updated to ${newPriority.toUpperCase()}`);
    } catch (err: any) {
      toast.error('Failed to update priority');
    }
  };

  // Send Reply
  const handleReply = async () => {
    if (!selectedTicket?.id || !replyText.trim()) return;
    setSendingReply(true);
    const textContent = replyText.trim();

    try {
      const newReply = {
        id: `reply-${Date.now()}`,
        ticketId: selectedTicket.id,
        userId: admin?.uid || 'admin',
        userName: admin?.name || 'Fleet Support Desk',
        userType: 'admin',
        sender: 'support',
        senderName: admin?.name || 'Fleet Support Desk',
        text: textContent,
        message: textContent,
        createdAt: new Date(),
        timestamp: new Date().toISOString(),
      };

      // 1. Update in Firestore
      await updateDoc(doc(db, 'supportTickets', selectedTicket.id), {
        replies: arrayUnion(newReply),
        status: selectedTicket.status === 'open' ? 'in-progress' : selectedTicket.status,
        updatedAt: serverTimestamp(),
      });

      // 2. Dual-Sync to Realtime Database
      try {
        if (realtimeDb) {
          const messagesRef = rtdbRef(realtimeDb, `supportChats/${selectedTicket.id}/messages`);
          await rtdbPush(messagesRef, newReply);
        }
      } catch (_) {}

      setReplyText('');
      toast.success('Reply sent to rider in real-time');
    } catch (err: any) {
      toast.error('Failed to send reply: ' + err.message);
    } finally {
      setSendingReply(false);
    }
  };

  // Process Rider Wallet Compensation
  const handleCreditRiderWallet = async () => {
    if (!selectedTicket?.userId || !selectedTicket?.id) {
      toast.error('Rider User ID not found');
      return;
    }
    const amt = parseFloat(creditAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setProcessingCredit(true);
    try {
      const riderRef = doc(db, 'deliveryPersons', selectedTicket.userId);

      // Increment Rider Wallet Balance
      await updateDoc(riderRef, {
        walletBalance: increment(amt),
        updatedAt: serverTimestamp(),
      });

      // Log transaction in subcollection
      const transRef = collection(db, 'deliveryPersons', selectedTicket.userId, 'walletTransactions');
      await addDoc(transRef, {
        amount: amt,
        type: 'credit',
        category: 'incentive',
        description: `Support Resolution: ${creditReason}`,
        ticketId: selectedTicket.id,
        orderId: selectedTicket.orderId || null,
        processedBy: admin?.name || 'Fleet Support Admin',
        createdAt: serverTimestamp(),
      });

      // Post auto-reply in ticket
      const autoReply = {
        id: `reply-${Date.now()}`,
        ticketId: selectedTicket.id,
        userId: admin?.uid || 'admin',
        userName: 'Fleet Compensation Desk',
        userType: 'admin',
        sender: 'support',
        senderName: 'Fleet Compensation Desk',
        text: `💰 An adjustment incentive of ₹${amt.toFixed(2)} has been credited to your delivery wallet. Reason: ${creditReason}.`,
        message: `💰 An adjustment incentive of ₹${amt.toFixed(2)} has been credited to your delivery wallet. Reason: ${creditReason}.`,
        createdAt: new Date(),
        timestamp: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'supportTickets', selectedTicket.id), {
        replies: arrayUnion(autoReply),
        status: 'resolved',
        updatedAt: serverTimestamp(),
      });

      toast.success(`🎉 Credited ₹${amt} to rider wallet!`);
      setCreditModalOpen(false);
      setCreditAmount('');
    } catch (err: any) {
      toast.error('Wallet credit failed: ' + err.message);
    } finally {
      setProcessingCredit(false);
    }
  };

  // Filter Logic
  const filteredTickets = tickets.filter((t) => {
    const rawStatus = (t.status || 'open').toLowerCase().replace('_', '-');
    const matchesStatus =
      statusFilter === 'all' ||
      rawStatus === statusFilter ||
      (statusFilter === 'closed' && (rawStatus === 'closed' || rawStatus === 'rejected'));

    const priority = (t.priority || 'medium').toLowerCase();
    const matchesPriority = priorityFilter === 'all' || priority === priorityFilter;

    const category = (t.category || 'other').toLowerCase();
    const matchesCategory = categoryFilter === 'all' || category === categoryFilter;

    const qLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm.trim() ||
      t.subject?.toLowerCase().includes(qLower) ||
      t.description?.toLowerCase().includes(qLower) ||
      t.userName?.toLowerCase().includes(qLower) ||
      t.userPhone?.toLowerCase().includes(qLower) ||
      t.orderId?.toLowerCase().includes(qLower);

    return matchesStatus && matchesPriority && matchesCategory && matchesSearch;
  });

  const totalCount = tickets.length;
  const openCount = tickets.filter((t) => (t.status || 'open').replace('_', '-') === 'open').length;
  const urgentCount = tickets.filter(
    (t) => (t.priority || '').toLowerCase() === 'high' && t.status !== 'resolved' && t.status !== 'closed'
  ).length;
  const resolvedCount = tickets.filter((t) => (t.status || '').replace('_', '-') === 'resolved').length;

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-100px)] p-2 md:p-6 bg-background/70 backdrop-blur-md rounded-3xl border border-border/50">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/admin/support">
            <Button
              variant="outline"
              size="sm"
              className="border-border/50 text-muted-foreground hover:text-foreground hover:bg-card/10 rounded-xl gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> All Desks
            </Button>
          </Link>

          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-foreground shadow-lg shadow-violet-600/20 font-bold">
            <Truck className="w-5 h-5" />
          </div>

          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              Delivery Fleet Support
              <Badge variant="outline" className="text-[10px] font-mono text-violet-400 border-violet-500/30 bg-violet-500/10">
                RIDER DESK
              </Badge>
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm">
              Live resolution workspace for delivery partners, payout issues & route disputes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/kyc">
            <Button
              variant="outline"
              size="sm"
              className="border-violet-500/30 text-violet-300 hover:bg-violet-500/10 rounded-xl text-xs gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> KYC Verifications
            </Button>
          </Link>
          <a href="https://wa.me/916393752013" target="_blank" rel="noreferrer">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-foreground font-bold text-xs gap-1.5 rounded-xl shadow-lg shadow-emerald-600/20"
            >
              <Phone className="w-3.5 h-3.5" /> Fleet Emergency Line
            </Button>
          </a>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <Card className="bg-background/40 border-border/50 rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Rider Inquiries</p>
              <h3 className="text-2xl font-black text-foreground mt-1">{totalCount}</h3>
              <p className="text-[10px] text-violet-400 mt-1">Fleet tickets</p>
            </div>
            <div className="p-2.5 bg-violet-500/10 rounded-xl">
              <Truck className="w-5 h-5 text-violet-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background/40 border-border/50 rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Awaiting Reply</p>
              <h3 className="text-2xl font-black text-amber-400 mt-1">{openCount}</h3>
              <p className="text-[10px] text-muted-foreground mt-1">Pending riders</p>
            </div>
            <div className="p-2.5 bg-amber-500/10 rounded-xl">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background/40 border-border/50 rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">High Priority</p>
              <h3 className="text-2xl font-black text-rose-400 mt-1 flex items-center gap-1.5">
                {urgentCount}
                {urgentCount > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
              </h3>
              <p className="text-[10px] text-rose-400/80 mt-1">Immediate action</p>
            </div>
            <div className="p-2.5 bg-rose-500/10 rounded-xl">
              <Flame className="w-5 h-5 text-rose-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background/40 border-border/50 rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Resolved</p>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">{resolvedCount}</h3>
              <p className="text-[10px] text-emerald-400/80 mt-1">Closed successfully</p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 min-h-0 bg-background/40 border border-border/50 rounded-3xl overflow-hidden flex flex-col lg:flex-row shadow-2xl">
        {/* Left Column: Tickets Browser */}
        <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col border-r border-border/50 bg-background/40 h-full">
          <div className="p-3 border-b border-border/50 space-y-3 bg-card/30">
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by rider name, phone, subject..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 bg-background/50 border-border/50 text-foreground placeholder:text-muted-foreground rounded-xl text-xs focus:border-violet-500/50"
              />
            </div>

            {/* Status Filter Chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {(['all', 'open', 'in-progress', 'resolved', 'closed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border shrink-0 ${
                    statusFilter === status
                      ? 'bg-violet-600 text-foreground border-violet-500 shadow-md shadow-violet-600/30'
                      : 'bg-card/5 text-muted-foreground border-border/50 hover:bg-card/10'
                  }`}
                >
                  {status === 'in-progress' ? 'In Progress' : status}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket Cards List */}
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-2">
              {loading ? (
                <div className="text-center py-12 text-muted-foreground text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-violet-400 mb-2" />
                  Loading fleet tickets in real-time...
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs space-y-2">
                  <Truck className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p>No rider tickets match your filters.</p>
                </div>
              ) : (
                filteredTickets.map((ticket) => {
                  const isSelected = selectedTicket?.id === ticket.id;
                  const isPending = (ticket.status || 'open') === 'open';
                  const isUrgent = (ticket.priority || '').toLowerCase() === 'high';

                  return (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                        isSelected
                          ? 'bg-gradient-to-r from-violet-600/20 to-indigo-600/10 border-violet-500/50 shadow-lg shadow-violet-600/10'
                          : 'bg-card/[0.03] border-border/50 hover:bg-card/[0.06] hover:border-border/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-violet-500/20 text-violet-300 flex items-center justify-center font-bold text-xs">
                            {ticket.userName?.charAt(0)?.toUpperCase() || 'R'}
                          </div>
                          <div>
                            <p className="text-foreground font-bold text-xs truncate max-w-[170px]">{ticket.userName}</p>
                            <p className="text-[10px] text-muted-foreground">{ticket.userPhone || 'No phone'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {isUrgent && (
                            <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[9px] px-1.5 py-0 font-bold">
                              HIGH
                            </Badge>
                          )}
                          <Badge
                            className={`text-[9px] px-1.5 py-0 font-bold uppercase ${
                              ticket.status === 'resolved'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : isPending
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            }`}
                          >
                            {ticket.status || 'open'}
                          </Badge>
                        </div>
                      </div>

                      <h4 className="text-foreground text-xs font-semibold line-clamp-1 mb-1">{ticket.subject}</h4>
                      <p className="text-muted-foreground text-[11px] line-clamp-2 leading-relaxed">{ticket.description}</p>

                      <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="capitalize text-violet-400/80 font-medium">#{ticket.category}</span>
                        <span>
                          {ticket.createdAt?.toDate
                            ? ticket.createdAt.toDate().toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : 'Recent'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Column: Ticket Conversation Workspace */}
        <div className="flex-1 flex flex-col h-full bg-background/60 overflow-hidden">
          {selectedTicket ? (
            <>
              {/* Ticket Details Header */}
              <div className="p-4 border-b border-border/50 bg-card/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-foreground font-bold text-sm shadow-lg shadow-violet-600/30">
                    🛵
                  </div>
                  <div>
                    <h3 className="text-foreground font-bold text-sm sm:text-base flex items-center gap-2">
                      {selectedTicket.subject}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span>Rider: <strong className="text-foreground">{selectedTicket.userName}</strong></span>
                      {selectedTicket.userPhone && (
                        <>
                          <span>•</span>
                          <a href={`tel:${selectedTicket.userPhone}`} className="text-blue-400 hover:underline flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {selectedTicket.userPhone}
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedTicket.userPhone && (
                    <a
                      href={`https://wa.me/${selectedTicket.userPhone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button size="sm" variant="outline" className="h-8 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs rounded-xl gap-1">
                        <Phone className="w-3 h-3" /> WhatsApp
                      </Button>
                    </a>
                  )}

                  <Button
                    size="sm"
                    onClick={() => setCreditModalOpen(true)}
                    className="h-8 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-foreground font-bold text-xs rounded-xl shadow-lg shadow-amber-600/20 gap-1"
                  >
                    <Wallet className="w-3 h-3" /> Credit Wallet
                  </Button>

                  {/* Status Dropdown */}
                  <select
                    value={selectedTicket.status || 'open'}
                    onChange={(e) => updateStatus(selectedTicket.id, e.target.value)}
                    className="h-8 bg-background/60 border border-border/50 rounded-xl px-2 text-xs text-foreground font-bold cursor-pointer focus:outline-none"
                  >
                    <option value="open">Open</option>
                    <option value="in-progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              {/* Chat Thread */}
              <ScrollArea className="flex-1 p-4 sm:p-6 space-y-4">
                {/* Rider's Initial Ticket Details */}
                <div className="bg-card/5 border border-border/50 rounded-2xl p-4 mb-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span className="font-bold text-violet-400 uppercase tracking-wider text-[10px]">Initial Issue Report</span>
                    <span>
                      {selectedTicket.createdAt?.toDate
                        ? selectedTicket.createdAt.toDate().toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>
                  <p className="text-foreground text-sm whitespace-pre-wrap leading-relaxed">{selectedTicket.description}</p>
                </div>

                {/* Conversation Replies */}
                <div className="space-y-3">
                  {selectedTicket.replies?.map((r, i) => {
                    const isAdmin = r.userType === 'admin' || r.sender === 'support';
                    return (
                      <div
                        key={i}
                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`p-3.5 rounded-2xl border text-sm max-w-[85%] ${
                            isAdmin
                              ? 'bg-violet-600/20 border-violet-500/30 text-violet-100 rounded-tr-sm shadow-lg shadow-violet-600/10'
                              : 'bg-card/10 border-border/50 text-foreground rounded-tl-sm'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4 mb-1">
                            <span className={`text-xs font-bold ${isAdmin ? 'text-violet-300' : 'text-muted-foreground'}`}>
                              {isAdmin ? (r.userName || '🎧 Fleet Support Agent') : `🛵 ${selectedTicket.userName}`}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {r.createdAt?.toDate
                                ? r.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : ''}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed">{r.text || r.message}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Canned Templates Bar */}
              <div className="px-4 py-2 bg-background/40 border-t border-border/50 overflow-x-auto flex gap-1.5 shrink-0">
                {CANNED_DELIVERY_RESPONSES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => setReplyText(tmpl.text)}
                    className="text-[11px] px-3 py-1 bg-card/5 hover:bg-card/10 border border-border/50 rounded-full text-muted-foreground whitespace-nowrap transition-all"
                  >
                    {tmpl.label}
                  </button>
                ))}
              </div>

              {/* Reply Input Bar */}
              <div className="p-4 bg-card/40 border-t border-border/50 flex items-center gap-2 shrink-0">
                <Input
                  placeholder="Type an instant reply to the delivery partner..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleReply();
                    }
                  }}
                  className="bg-background/50 border-border/50 text-foreground placeholder:text-muted-foreground rounded-xl h-11 text-sm focus:border-violet-500/50"
                />
                <Button
                  onClick={handleReply}
                  disabled={sendingReply || !replyText.trim()}
                  className="h-11 px-5 rounded-xl bg-violet-600 hover:bg-violet-500 text-foreground font-bold text-xs gap-1.5 shadow-lg shadow-violet-600/30 shrink-0"
                >
                  {sendingReply ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Reply
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Truck className="w-12 h-12 text-muted-foreground mb-3" />
              <h3 className="text-lg font-bold text-foreground mb-1">No Ticket Selected</h3>
              <p className="text-xs max-w-sm">
                Select a delivery partner support ticket from the left panel to review inquiry details, reply, or credit wallet balance.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Credit Wallet Compensation Modal */}
      <Dialog open={creditModalOpen} onOpenChange={setCreditModalOpen}>
        <DialogContent className="bg-background border-border/50 text-foreground max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Wallet className="w-5 h-5 text-amber-400" />
              Credit Rider Wallet Balance
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Directly credit compensation or fuel bonus to {selectedTicket?.userName}'s delivery account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground font-medium">Credit Amount (₹) *</label>
              <Input
                type="number"
                placeholder="e.g. 50"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="mt-1 bg-background/50 border-border/50 text-foreground text-lg font-bold"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-medium">Reason for Credit *</label>
              <Input
                placeholder="Reason..."
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                className="mt-1 bg-background/50 border-border/50 text-foreground text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCreditModalOpen(false)}
              className="border-border/50 text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreditRiderWallet}
              disabled={processingCredit || !creditAmount}
              className="bg-amber-600 hover:bg-amber-500 text-foreground font-bold text-xs shadow-lg shadow-amber-600/30"
            >
              {processingCredit ? <RefreshCw className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
              Confirm Credit (₹{creditAmount || '0'})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
