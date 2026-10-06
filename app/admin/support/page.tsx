'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
  addDoc,
  increment,
  getDoc,
} from 'firebase/firestore';
import { ref as rtdbRef, push as rtdbPush } from 'firebase/database';
import { db, realtimeDb } from '@/lib/firebase';
import { SupportTicket, TicketReply } from '@/lib/types';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  Search,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertTriangle,
  MoreVertical,
  Trash2,
  Send,
  User,
  Store,
  Truck,
  XCircle,
  Inbox,
  Filter,
  Phone,
  Mail,
  ExternalLink,
  Wallet,
  ShoppingBag,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Tag,
  Flame,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

// Quick Canned Response Templates
const QUICK_TEMPLATES = [
  {
    label: '⏳ Under Review',
    text: "Hello! Our support desk has received your request and is currently coordinating with our fulfillment team. Please give us 2-3 minutes.",
  },
  {
    label: '💰 Wallet Refunded',
    text: "We have approved your refund request! The amount has been credited directly to your Hunger Wallet balance for immediate use.",
  },
  {
    label: '🚴 Delivery Expedited',
    text: "We have contacted your delivery partner to prioritize your parcel route. You can track their live GPS location in your Orders tab.",
  },
  {
    label: '🙏 Apology & Credit',
    text: "We deeply apologize for the inconvenience caused. A complimentary discount voucher and wallet credit have been applied to your account.",
  },
  {
    label: '✅ Ticket Resolved',
    text: "This inquiry has been successfully resolved by our culinary support desk. Please feel free to reach out if you need anything else!",
  },
];

function AdminSupportContent() {
  const { admin } = useAdminAuth();
  const searchParams = useSearchParams();
  const paramTicketId = searchParams.get('id');

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Filters
  const [activeDepartment, setActiveDepartment] = useState<'all' | 'customer' | 'restaurant' | 'delivery'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in-progress' | 'resolved' | 'closed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Wallet Refund Modal State
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('Order dispute resolution refund');
  const [processingRefund, setProcessingRefund] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Real-time tickets listener
  useEffect(() => {
    const q = query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as SupportTicket[];

        setTickets(data);
        setLoading(false);

        // Keep selected ticket in sync in real-time
        if (paramTicketId) {
          const matched = data.find((t) => t.id === paramTicketId);
          if (matched) {
            setSelectedTicket(matched);
            return;
          }
        }

        if (selectedTicket) {
          const updated = data.find((t) => t.id === selectedTicket.id);
          if (updated) setSelectedTicket(updated);
        } else if (data.length > 0 && !selectedTicket) {
          setSelectedTicket(data[0]);
        }
      },
      (error) => {
        console.error('Error fetching support tickets:', error);
        toast.error('Failed to load tickets in real-time');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [paramTicketId, selectedTicket?.id]);

  // Scroll to bottom of chat when new replies arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicket?.replies]);

  // Update Status
  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'supportTickets', ticketId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        ...(newStatus === 'resolved' ? { resolvedAt: serverTimestamp() } : {}),
        ...(newStatus === 'closed' ? { closedAt: serverTimestamp() } : {}),
      });

      toast.success(`Ticket marked as ${newStatus.toUpperCase()}`);
    } catch (error: any) {
      console.error(`Error updating ticket to ${newStatus}:`, error);
      toast.error('Failed to update status: ' + error.message);
    }
  };

  // Update Priority
  const updateTicketPriority = async (ticketId: string, newPriority: string) => {
    try {
      await updateDoc(doc(db, 'supportTickets', ticketId), {
        priority: newPriority,
        updatedAt: serverTimestamp(),
      });
      toast.success(`Priority updated to ${newPriority.toUpperCase()}`);
    } catch (error: any) {
      console.error('Error updating priority:', error);
      toast.error('Failed to update priority');
    }
  };

  // Send Reply
  const handleReply = async () => {
    if (!selectedTicket?.id || !replyText.trim()) return;

    setSendingReply(true);
    const textContent = replyText.trim();

    try {
      const newReply: TicketReply = {
        id: `reply-${Date.now()}`,
        ticketId: selectedTicket.id,
        userId: admin?.uid || 'admin',
        userName: admin?.name || 'Hunger Support Agent',
        userType: 'admin',
        sender: 'support', // Required for customer portal UI
        senderName: admin?.name || 'Hunger Support Agent',
        text: textContent, // Required for customer portal
        message: textContent, // Backward compatibility
        createdAt: new Date(),
        timestamp: new Date().toISOString(),
      };

      // 1. Update in Firestore
      await updateDoc(doc(db, 'supportTickets', selectedTicket.id), {
        replies: arrayUnion(newReply),
        status: selectedTicket.status === 'open' ? 'in-progress' : selectedTicket.status,
        updatedAt: serverTimestamp(),
        adminResponse: textContent,
      });

      // 2. Dual-Sync to Realtime Database
      try {
        if (realtimeDb) {
          const messagesRef = rtdbRef(realtimeDb, `supportChats/${selectedTicket.id}/messages`);
          await rtdbPush(messagesRef, newReply);
        }
      } catch (_) { }

      setReplyText('');
      toast.success('Reply sent to customer');
    } catch (error: any) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply: ' + error.message);
    } finally {
      setSendingReply(false);
    }
  };

  // Delete Ticket
  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm('Are you sure you want to permanently delete this support ticket?')) return;
    try {
      await deleteDoc(doc(db, 'supportTickets', ticketId));
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(null);
      }
      toast.success('Ticket deleted successfully');
    } catch (error: any) {
      console.error('Error deleting ticket:', error);
      toast.error('Failed to delete ticket');
    }
  };

  // Execute Wallet Refund
  const handleProcessWalletRefund = async () => {
    const targetUserId = selectedTicket?.userId || selectedTicket?.customerId;
    if (!targetUserId || !selectedTicket?.id) {
      toast.error('User ID or Ticket ID not found on this ticket');
      return;
    }
    const num = parseFloat(refundAmount);
    if (isNaN(num) || num <= 0) {
      toast.error('Please enter a valid refund amount');
      return;
    }

    setProcessingRefund(true);
    try {
      const customerRef = doc(db, 'customers', targetUserId);
      // 1. Increment Customer Wallet Balance
      await updateDoc(customerRef, {
        walletBalance: increment(num),
        updatedAt: serverTimestamp(),
      });

      // 2. Add Wallet Transaction Subcollection Record
      const transRef = collection(db, 'customers', targetUserId, 'walletTransactions');
      await addDoc(transRef, {
        amount: num,
        type: 'credit',
        category: 'refund',
        description: `Support Resolution: ${refundReason}`,
        ticketId: selectedTicket.id,
        orderId: selectedTicket.orderId || null,
        processedBy: admin?.name || 'Support Desk',
        createdAt: serverTimestamp(),
      });

      // 3. Post auto-reply in ticket
      const autoReplyText = `💰 An instant refund of ₹${num.toFixed(2)} has been credited to your Hunger Wallet balance. Reason: ${refundReason}.`;
      const refundReply: TicketReply = {
        id: `reply-${Date.now()}`,
        ticketId: selectedTicket.id,
        userId: admin?.uid || 'admin',
        userName: 'Hunger Billing Resolution',
        userType: 'admin',
        sender: 'support',
        senderName: 'Hunger Billing Resolution',
        text: autoReplyText,
        message: autoReplyText,
        createdAt: new Date(),
        timestamp: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'supportTickets', selectedTicket.id), {
        replies: arrayUnion(refundReply),
        status: 'resolved',
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success(`🎉 Successfully credited ₹${num} to customer wallet!`);
      setRefundModalOpen(false);
      setRefundAmount('');
    } catch (err: any) {
      console.error('Failed to credit wallet:', err);
      toast.error('Wallet credit failed: ' + err.message);
    } finally {
      setProcessingRefund(false);
    }
  };

  // Filter Logic
  const filteredTickets = tickets.filter((t) => {
    // 1. Department
    const userType = (t.userType || 'customer').toLowerCase();
    const matchesDept =
      activeDepartment === 'all' ||
      (activeDepartment === 'customer' && (userType === 'customer' || userType === 'user' || !t.userType)) ||
      userType === activeDepartment;

    // 2. Status
    const rawStatus = (t.status || 'open').toLowerCase().replace('_', '-');
    const matchesStatus =
      statusFilter === 'all' ||
      rawStatus === statusFilter ||
      (statusFilter === 'closed' && (rawStatus === 'closed' || rawStatus === 'rejected'));

    // 3. Priority
    const priority = (t.priority || 'medium').toLowerCase();
    const matchesPriority = priorityFilter === 'all' || priority === priorityFilter;

    // 4. Category
    const category = (t.category || 'other').toLowerCase();
    const matchesCategory = categoryFilter === 'all' || category === categoryFilter;

    // 5. Search query
    const qLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm.trim() ||
      t.subject?.toLowerCase().includes(qLower) ||
      t.description?.toLowerCase().includes(qLower) ||
      t.userName?.toLowerCase().includes(qLower) ||
      t.userEmail?.toLowerCase().includes(qLower) ||
      t.userPhone?.toLowerCase().includes(qLower) ||
      t.orderId?.toLowerCase().includes(qLower) ||
      t.id?.toLowerCase().includes(qLower);

    return matchesDept && matchesStatus && matchesPriority && matchesCategory && matchesSearch;
  });

  // Helper date formatter
  const formatDate = (date: any) => {
    if (!date) return '';
    try {
      if (date.seconds) return new Date(date.seconds * 1000).toLocaleString();
      if (date instanceof Date) return date.toLocaleString();
      return new Date(date).toLocaleString();
    } catch {
      return String(date);
    }
  };

  // Counts for Stats
  const totalCount = tickets.length;
  const openCount = tickets.filter((t) => (t.status || 'open').replace('_', '-') === 'open').length;
  const inProgressCount = tickets.filter((t) => (t.status || '').replace('_', '-') === 'in-progress').length;
  const urgentCount = tickets.filter(
    (t) => (t.priority || '').toLowerCase() === 'urgent' && t.status !== 'resolved' && t.status !== 'closed'
  ).length;
  const resolvedCount = tickets.filter((t) => (t.status || '').replace('_', '-') === 'resolved').length;

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-100px)] p-2 md:p-6 bg-gray-950/60 backdrop-blur-md rounded-2xl border border-white/5">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/10">
              🎧
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                Customer Support Desk
                <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                  REAL-TIME SYNC
                </Badge>
              </h1>
              <p className="text-gray-400 text-xs md:text-sm font-medium">
                Live 2-way resolution workspace for Web &amp; Android Customer Tickets.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/support/delivery">
            <Button
              size="sm"
              variant="outline"
              className="border-violet-500/30 text-violet-300 hover:bg-violet-500/10 text-xs gap-1.5 rounded-xl font-bold"
            >
              <Truck className="w-3.5 h-3.5" /> Delivery Support Desk
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toast.success('Refreshing support stream...');
            }}
            className="border-white/10 text-gray-300 hover:text-white hover:bg-white/5 text-xs gap-1.5 rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync
          </Button>
          <a href="https://wa.me/916393752013" target="_blank" rel="noreferrer">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 rounded-xl shadow-lg shadow-emerald-600/20"
            >
              <Phone className="w-3.5 h-3.5" /> Hotline (+91 6393752013)
            </Button>
          </a>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <Card className="bg-black/40 border-white/5 hover:border-blue-500/30 transition-all rounded-2xl group">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Inquiries</p>
              <h3 className="text-2xl font-black text-white mt-1">{totalCount}</h3>
              <p className="text-[10px] text-blue-400 mt-1">{inProgressCount} in progress</p>
            </div>
            <div className="p-2.5 bg-blue-500/10 rounded-xl group-hover:scale-110 transition-transform">
              <Inbox className="w-5 h-5 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/5 hover:border-yellow-500/30 transition-all rounded-2xl group">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Open / Pending</p>
              <h3 className="text-2xl font-black text-yellow-400 mt-1">{openCount}</h3>
              <p className="text-[10px] text-gray-400 mt-1">Awaiting first reply</p>
            </div>
            <div className="p-2.5 bg-yellow-500/10 rounded-xl group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/5 hover:border-red-500/30 transition-all rounded-2xl group">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Urgent Attention</p>
              <h3 className="text-2xl font-black text-red-400 mt-1 flex items-center gap-1.5">
                {urgentCount}
                {urgentCount > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />}
              </h3>
              <p className="text-[10px] text-red-400/80 mt-1">High priority</p>
            </div>
            <div className="p-2.5 bg-red-500/10 rounded-xl group-hover:scale-110 transition-transform">
              <Flame className="w-5 h-5 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/5 hover:border-emerald-500/30 transition-all rounded-2xl group">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Resolved</p>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">{resolvedCount}</h3>
              <p className="text-[10px] text-emerald-400/80 mt-1">Closed successfully</p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl group-hover:scale-110 transition-transform">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Support Workspace */}
      <div className="flex-1 min-h-0 bg-black/40 border border-white/5 rounded-2xl overflow-hidden flex flex-col lg:flex-row shadow-2xl">
        {/* Left Column: Ticket Browser & Filters */}
        <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col border-r border-white/5 bg-gray-950/40 h-full">
          {/* Department Tabs */}
          <div className="p-3 border-b border-white/5 space-y-3 bg-gray-900/30">
            <Tabs
              value={activeDepartment}
              onValueChange={(val: any) => setActiveDepartment(val)}
              className="w-full"
            >
              <TabsList className="bg-black/50 border border-white/5 p-1 w-full grid grid-cols-4 rounded-xl">
                <TabsTrigger value="all" className="text-[11px] font-bold">
                  All
                </TabsTrigger>
                <TabsTrigger value="customer" className="text-[11px] font-bold">
                  Users
                </TabsTrigger>
                <TabsTrigger value="restaurant" className="text-[11px] font-bold">
                  Kitchen
                </TabsTrigger>
                <TabsTrigger value="delivery" className="text-[11px] font-bold">
                  Riders
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by user, email, subject, #order..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 bg-black/50 border-white/10 text-white placeholder:text-gray-500 rounded-xl text-xs focus:border-blue-500/50"
              />
            </div>

            {/* Quick Status Chips */}
            <ScrollArea className="w-full whitespace-nowrap pb-1">
              <div className="flex gap-1.5">
                {(['all', 'open', 'in-progress', 'resolved', 'closed'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border shrink-0 ${statusFilter === status
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30'
                        : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
                      }`}
                  >
                    {status === 'in-progress' ? 'In Progress' : status}
                  </button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          {/* Ticket List */}
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-2">
              {loading ? (
                <div className="text-center py-12 text-gray-500 text-xs">
                  Loading tickets in real-time...
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-xs space-y-2">
                  <Inbox className="w-8 h-8 mx-auto text-gray-600" />
                  <p>No tickets match your filters.</p>
                </div>
              ) : (
                filteredTickets.map((ticket) => {
                  const isSelected = selectedTicket?.id === ticket.id;
                  const repliesCount = ticket.replies?.length || 0;
                  const statusNormalized = (ticket.status || 'open').toLowerCase().replace('_', '-');
                  const isUrgent = (ticket.priority || '').toLowerCase() === 'urgent';

                  return (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`p-3.5 rounded-2xl cursor-pointer transition-all border text-left ${isSelected
                          ? 'bg-blue-600/15 border-blue-500/50 shadow-lg shadow-blue-500/10'
                          : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-7 w-7 border border-white/10">
                            <AvatarFallback className="bg-gray-800 text-gray-300 text-[10px] font-bold">
                              {ticket.userName?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">
                              {ticket.userName || 'Customer'}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate">
                              {ticket.userEmail || ticket.userPhone || 'No contact email'}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md ${statusNormalized === 'resolved'
                              ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                              : statusNormalized === 'in-progress'
                                ? 'border-blue-500/30 text-blue-400 bg-blue-500/10'
                                : 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                            }`}
                        >
                          {statusNormalized}
                        </Badge>
                      </div>

                      {/* Subject */}
                      <p className="text-xs font-semibold text-gray-200 mt-2 line-clamp-1">
                        {ticket.subject}
                      </p>

                      {/* Snippet */}
                      <p className="text-[11px] text-gray-400 line-clamp-2 mt-0.5 leading-relaxed">
                        {ticket.description || ticket.message}
                      </p>

                      {/* Footer tags */}
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5 text-[10px] text-gray-500">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isUrgent && (
                            <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold flex items-center gap-1 text-[9px]">
                              <Flame className="w-2.5 h-2.5" /> URGENT
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded bg-white/5 text-gray-400 uppercase text-[9px]">
                            {ticket.category || 'General'}
                          </span>
                          {ticket.orderId && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 font-mono text-[9px]">
                              #{ticket.orderId.slice(-6)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> {repliesCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Column: Ticket Conversation Workspace */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-950/20 h-full">
          {selectedTicket ? (
            <>
              {/* Ticket Top Action Bar */}
              <div className="p-4 border-b border-white/5 bg-gray-900/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 border border-white/10 ring-2 ring-blue-500/20">
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-sm">
                      {selectedTicket.userName?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white truncate">
                        {selectedTicket.userName || 'Anonymous User'}
                      </h3>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono border-white/10 text-gray-400 uppercase"
                      >
                        {selectedTicket.userType || 'customer'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                      <span>{selectedTicket.userEmail || 'No email provided'}</span>
                      {selectedTicket.userPhone && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-gray-300">{selectedTicket.userPhone}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Direct Action Buttons */}
                <div className="flex items-center gap-2">
                  {/* WhatsApp Direct */}
                  {selectedTicket.userPhone && (
                    <a
                      href={`https://wa.me/${selectedTicket.userPhone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(
                        selectedTicket.userName || 'Customer'
                      )}%2C%20regarding%20your%20Hunger%20support%20ticket%20%23${selectedTicket.id?.slice(-6)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 rounded-xl text-xs gap-1.5"
                      >
                        <Phone className="w-3.5 h-3.5" /> WhatsApp
                      </Button>
                    </a>
                  )}

                  {/* Phone Dial */}
                  {selectedTicket.userPhone && (
                    <a href={`tel:${selectedTicket.userPhone}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 rounded-xl text-xs gap-1.5"
                      >
                        <Phone className="w-3.5 h-3.5" /> Call
                      </Button>
                    </a>
                  )}

                  {/* Wallet Refund Button */}
                  <Button
                    size="sm"
                    onClick={() => setRefundModalOpen(true)}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs gap-1.5 shadow-md shadow-amber-600/20"
                  >
                    <Wallet className="w-3.5 h-3.5" /> Refund Wallet
                  </Button>

                  {/* Status Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/10 text-white rounded-xl text-xs gap-1.5"
                      >
                        Status: <span className="font-bold uppercase text-blue-400">{selectedTicket.status || 'open'}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 text-gray-200">
                      <DropdownMenuItem onClick={() => updateTicketStatus(selectedTicket.id!, 'open')}>
                        <Clock className="w-4 h-4 mr-2 text-yellow-400" /> Set as Open
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateTicketStatus(selectedTicket.id!, 'in-progress')}>
                        <RefreshCw className="w-4 h-4 mr-2 text-blue-400" /> Set as In Progress
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateTicketStatus(selectedTicket.id!, 'resolved')}>
                        <CheckCircle className="w-4 h-4 mr-2 text-emerald-400" /> Mark as Resolved
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateTicketStatus(selectedTicket.id!, 'closed')}>
                        <XCircle className="w-4 h-4 mr-2 text-gray-400" /> Close Ticket
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* More Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white rounded-xl">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 text-gray-300 w-48">
                      <DropdownMenuItem
                        onClick={() => {
                          navigator.clipboard.writeText(selectedTicket.id || '');
                          toast.success('Ticket ID copied to clipboard');
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4" /> Copy Ticket ID
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-gray-800" />
                      <DropdownMenuItem
                        onClick={() => updateTicketPriority(selectedTicket.id!, 'urgent')}
                        className="text-red-400"
                      >
                        <Flame className="mr-2 h-4 w-4" /> Mark as Urgent
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateTicketPriority(selectedTicket.id!, 'high')}
                        className="text-yellow-400"
                      >
                        <AlertTriangle className="mr-2 h-4 w-4" /> Set High Priority
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-gray-800" />
                      <DropdownMenuItem
                        onClick={() => handleDeleteTicket(selectedTicket.id!)}
                        className="text-red-500 focus:text-red-400 focus:bg-red-950/20"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Ticket
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Ticket Details Summary Bar */}
              <div className="px-6 py-3 bg-white/[0.015] border-b border-white/5 flex flex-wrap items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-300">{selectedTicket.subject}</span>
                  <Badge variant="outline" className="text-[10px] uppercase border-white/10 text-gray-400">
                    Category: {selectedTicket.category || 'General'}
                  </Badge>
                  {selectedTicket.orderId && (
                    <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400 bg-purple-500/10">
                      Order #{selectedTicket.orderId}
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-gray-500">
                  Created {formatDate(selectedTicket.createdAt)}
                </div>
              </div>

              {/* Chat Messages Feed */}
              <ScrollArea className="flex-1 p-6 bg-gradient-to-b from-gray-950/0 to-black/30">
                <div className="max-w-3xl mx-auto space-y-6">
                  {/* Initial Ticket Inquiry (User Bubble) */}
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 mt-1 border border-white/10 shrink-0">
                      <AvatarFallback className="bg-gray-800 text-gray-300 text-xs font-bold">
                        {selectedTicket.userName?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1.5 max-w-[85%]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-200">
                          {selectedTicket.userName || 'Customer'}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {formatDate(selectedTicket.createdAt)}
                        </span>
                        <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400 py-0 px-1">
                          Inquiry
                        </Badge>
                      </div>
                      <div className="p-4 rounded-2xl rounded-tl-none bg-gray-900 border border-white/10 text-gray-200 text-sm leading-relaxed shadow-sm">
                        {selectedTicket.description || selectedTicket.message}
                      </div>
                    </div>
                  </div>

                  {/* Replies Chain */}
                  {selectedTicket.replies?.map((reply: any, idx: number) => {
                    const isAdminSender = reply.sender === 'support' || reply.userType === 'admin';
                    const messageContent = reply.text || reply.message || '';

                    return (
                      <div
                        key={reply.id || idx}
                        className={`flex gap-3 ${isAdminSender ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        <Avatar
                          className={`h-8 w-8 mt-1 shrink-0 ${isAdminSender
                              ? 'border-blue-500/40 ring-2 ring-blue-500/20'
                              : 'border-white/10'
                            }`}
                        >
                          <AvatarFallback
                            className={isAdminSender ? 'bg-blue-600 text-white font-bold text-xs' : 'bg-gray-800 text-gray-300 text-xs'}
                          >
                            {isAdminSender ? 'A' : reply.senderName?.charAt(0) || reply.userName?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>

                        <div
                          className={`space-y-1 max-w-[85%] flex flex-col ${isAdminSender ? 'items-end' : 'items-start'
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-300">
                              {isAdminSender ? reply.senderName || 'Hunger Support Agent' : reply.senderName || reply.userName || 'Customer'}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {formatDate(reply.timestamp || reply.createdAt)}
                            </span>
                          </div>

                          <div
                            className={`p-4 rounded-2xl text-sm leading-relaxed shadow-md ${isAdminSender
                                ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-600/10'
                                : 'bg-gray-900 border border-white/10 text-gray-200 rounded-tl-none'
                              }`}
                          >
                            {messageContent}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Quick Canned Response Pills */}
              <div className="px-4 py-2 border-t border-white/5 bg-gray-900/60 overflow-x-auto">
                <div className="flex items-center gap-2 max-w-3xl mx-auto">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" /> Templates:
                  </span>
                  {QUICK_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      onClick={() => setReplyText(tmpl.text)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-blue-600/20 hover:text-blue-400 text-gray-400 text-[11px] font-medium shrink-0 border border-white/5 transition-all"
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reply Input Box */}
              <div className="p-4 bg-gray-900/80 border-t border-white/5 shrink-0">
                <div className="max-w-3xl mx-auto space-y-2">
                  <div className="relative">
                    <Textarea
                      placeholder="Type a response to the customer... (Ctrl+Enter to send)"
                      className="bg-black/60 border-white/10 text-white resize-none min-h-[90px] rounded-2xl p-3 pr-14 text-sm focus:border-blue-500/50"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          handleReply();
                        }
                      }}
                    />
                    <div className="absolute right-3 bottom-3">
                      <Button
                        size="icon"
                        disabled={!replyText.trim() || sendingReply}
                        onClick={handleReply}
                        className={`h-9 w-9 rounded-xl transition-all ${!replyText.trim()
                            ? 'bg-gray-800 text-gray-500'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25'
                          }`}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 px-1">
                    <span>
                      Customer receives real-time notification on Web and Android app.
                    </span>
                    <span>Press Ctrl+Enter to send</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
              <MessageSquare className="w-12 h-12 text-gray-700 mb-3" />
              <h3 className="font-bold text-gray-300 text-base">Select a ticket from the left</h3>
              <p className="text-xs text-gray-500 max-w-sm mt-1">
                Choose an inquiry to view the conversation history, reply in real-time, or issue a wallet refund.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Instant Wallet Refund Dialog */}
      <Dialog open={refundModalOpen} onOpenChange={setRefundModalOpen}>
        <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800 text-white rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Wallet className="w-5 h-5 text-amber-400" />
              Issue Hunger Wallet Refund
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              Instantly credits the customer's wallet balance and logs the audit trail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-gray-300">Customer</label>
              <p className="text-sm font-semibold text-white mt-1">
                {selectedTicket?.userName} ({selectedTicket?.userEmail || selectedTicket?.userPhone})
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-300">Refund Amount (₹)</label>
              <Input
                type="number"
                placeholder="e.g. 150"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="bg-black/50 border-white/10 text-white mt-1 rounded-xl text-lg font-mono font-bold text-emerald-400"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-300">Reason / Resolution Note</label>
              <Input
                placeholder="e.g. Late delivery compensation, Missing items"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="bg-black/50 border-white/10 text-white mt-1 rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRefundModalOpen(false)}
              className="border-white/10 text-gray-400 hover:text-white rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleProcessWalletRefund}
              disabled={processingRefund || !refundAmount}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl gap-2 shadow-lg shadow-emerald-600/25"
            >
              {processingRefund ? 'Crediting...' : 'Confirm Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminSupportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-gray-400 text-sm">
          Loading support desk workspace...
        </div>
      }
    >
      <AdminSupportContent />
    </Suspense>
  );
}
