'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, limit, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Search, RefreshCw, IndianRupee, Clock, CheckCircle2, XCircle,
  Eye, AlertTriangle, Wallet, CreditCard, ArrowUpRight, Filter,
  ChevronDown, TrendingUp, FileText, RotateCcw, ShieldCheck,
  Ban, Activity, Calendar
} from 'lucide-react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { motion, AnimatePresence } from 'framer-motion';

type RefundStatus = 'ALL' | 'INITIATED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'MANUAL_REVIEW';

const STATUS_CONFIG: Record<string, {
  label: string; color: string; bgColor: string; icon: React.ElementType
}> = {
  INITIATED:     { label: 'Initiated',     color: 'text-blue-400',   bgColor: 'bg-blue-500/15 border-blue-500/30',   icon: Clock },
  PROCESSING:    { label: 'Processing',    color: 'text-amber-400',  bgColor: 'bg-amber-500/15 border-amber-500/30', icon: RotateCcw },
  COMPLETED:     { label: 'Completed',     color: 'text-emerald-400',bgColor: 'bg-emerald-500/15 border-emerald-500/30', icon: CheckCircle2 },
  FAILED:        { label: 'Failed',        color: 'text-red-400',    bgColor: 'bg-red-500/15 border-red-500/30',     icon: XCircle },
  MANUAL_REVIEW: { label: 'Manual Review', color: 'text-purple-400', bgColor: 'bg-purple-500/15 border-purple-500/30', icon: AlertTriangle },
};

const TAB_FILTERS: RefundStatus[] = ['ALL', 'INITIATED', 'PROCESSING', 'COMPLETED', 'FAILED', 'MANUAL_REVIEW'];

export default function AdminRefundDashboard() {
  const { admin } = useAdminAuth();
  const [refunds, setRefunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<RefundStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRefund, setSelectedRefund] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0, pending: 0, completed: 0, failed: 0, manualReview: 0, totalAmount: 0
  });

  // Real-time refund listener
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'refunds'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data: any[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
        updatedAt: d.data().updatedAt?.toDate?.() || new Date(),
        completedAt: d.data().completedAt?.toDate?.() || null,
      }));
      setRefunds(data);


      // Calculate stats
      const statsData = data.reduce((acc, r) => {
        acc.total++;
        acc.totalAmount += r.amount || 0;
        if (['INITIATED', 'PROCESSING'].includes(r.status)) acc.pending++;
        if (r.status === 'COMPLETED') acc.completed++;
        if (r.status === 'FAILED') acc.failed++;
        if (r.status === 'MANUAL_REVIEW') acc.manualReview++;
        return acc;
      }, { total: 0, pending: 0, completed: 0, failed: 0, manualReview: 0, totalAmount: 0 });

      setStats(statsData);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Fetch audit logs for selected refund
  const fetchAuditLogs = useCallback(async (refundId: string) => {
    try {
      const q = query(
        collection(db, 'auditLogs'),
        where('refundId', '==', refundId),
        orderBy('timestamp', 'desc')
      );
      const snap = await getDocs(q);
      setAuditLogs(snap.docs.map(d => ({
        id: d.id, ...d.data(),
        timestamp: d.data().timestamp?.toDate?.() || new Date()
      })));
    } catch { setAuditLogs([]); }
  }, []);

  const openDetail = (refund: any) => {
    setSelectedRefund(refund);
    setDetailOpen(true);
    setActionNotes('');
    fetchAuditLogs(refund.id);
  };

  const handleAdminAction = async (action: 'RETRY_RAZORPAY' | 'APPROVE_WALLET' | 'REJECT') => {
    if (!selectedRefund || !admin) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refundId: selectedRefund.id,
          adminId: admin.uid || admin.email,
          action,
          notes: actionNotes,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      toast.success(`Refund action "${action}" completed successfully`);
      setDetailOpen(false);
      fetchAuditLogs(selectedRefund.id);
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = refunds.filter(r => {
    const matchesTab = activeTab === 'ALL' || r.status === activeTab;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      r.orderId?.toLowerCase().includes(q) ||
      r.userId?.toLowerCase().includes(q) ||
      r.razorpayRefundId?.toLowerCase().includes(q) ||
      r.razorpayPaymentId?.toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  const formatDate = (d: any) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const statCards = [
    { label: 'Total Refunds', value: stats.total, icon: FileText, color: 'from-blue-600 to-blue-700' },
    { label: 'Pending', value: stats.pending, icon: Clock, color: 'from-amber-600 to-orange-600' },
    { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'from-emerald-600 to-green-600' },
    { label: 'Manual Review', value: stats.manualReview, icon: AlertTriangle, color: 'from-purple-600 to-violet-600' },
    { label: 'Total Refunded', value: `₹${stats.totalAmount.toFixed(0)}`, icon: IndianRupee, color: 'from-rose-600 to-red-600' },
    { label: 'Failed', value: stats.failed, icon: XCircle, color: 'from-red-700 to-red-800' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Refund Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Monitor, review, and manage all order refunds</p>
        </div>
        <Button
          variant="outline"
          className="border-border/50 text-muted-foreground hover:bg-card/5 gap-2"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.color} p-4 text-foreground shadow-lg`}
            >
              <div className="absolute top-0 right-0 opacity-20">
                <Icon className="w-16 h-16 -mt-3 -mr-3" />
              </div>
              <p className="text-foreground/70 text-xs font-medium uppercase tracking-wide">{card.label}</p>
              <p className="text-2xl font-black mt-1">{card.value}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by Order ID, Customer ID, Razorpay ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-card/5 border-border/50 text-foreground placeholder:text-muted-foreground rounded-xl"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as RefundStatus)}>
        <TabsList className="bg-card/5 border border-border/50 p-1 rounded-xl flex-wrap h-auto gap-1">
          {TAB_FILTERS.map(tab => {
            const count = tab === 'ALL' ? refunds.length :
              refunds.filter(r => r.status === tab).length;
            return (
              <TabsTrigger
                key={tab}
                value={tab}
                className="data-[state=active]:bg-card/10 data-[state=active]:text-foreground text-muted-foreground rounded-lg text-xs px-3 py-1.5 gap-1"
              >
                {tab.replace('_', ' ')}
                {count > 0 && (
                  <span className="bg-card/20 text-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <IndianRupee className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-semibold">No refunds found</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border/50">
              <table className="w-full">
                <thead>
                  <tr className="bg-card/5 border-b border-border/50">
                    {['Refund ID', 'Order ID', 'Amount', 'Method', 'Status', 'Created', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map((refund) => {
                    const cfg = STATUS_CONFIG[refund.status] || STATUS_CONFIG.INITIATED;
                    const Icon = cfg.icon;
                    return (
                      <motion.tr
                        key={refund.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-card/3 transition-colors group"
                      >
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-muted-foreground">
                            {refund.id?.substring(0, 12)}...
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-blue-400">
                            #{refund.orderId?.substring(0, 10).toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-foreground">₹{refund.amount?.toFixed(2)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground">
                            {refund.refundMethod === 'WALLET' ? '🪙 Wallet' :
                             refund.refundMethod === 'RAZORPAY' ? '🏦 Razorpay' : refund.paymentMethod}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border ${cfg.bgColor} ${cfg.color}`}>
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(refund.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            id={`view-refund-${refund.id}`}
                            size="sm"
                            variant="ghost"
                            onClick={() => openDetail(refund)}
                            className="text-muted-foreground hover:text-foreground hover:bg-card/10 rounded-lg h-8 px-3 gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </Button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Refund Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl bg-card border border-border/50 text-foreground rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Refund Details</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Manage and review this refund record
            </DialogDescription>
          </DialogHeader>

          {selectedRefund && (() => {
            const cfg = STATUS_CONFIG[selectedRefund.status] || STATUS_CONFIG.INITIATED;
            const Icon = cfg.icon;
            return (
              <div className="space-y-4 mt-2">
                {/* Status Badge */}
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border ${cfg.bgColor} ${cfg.color} font-bold`}>
                  <Icon className="w-4 h-4" />
                  {cfg.label}
                </div>

                {/* Grid Info */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Refund ID', value: selectedRefund.id },
                    { label: 'Order ID', value: `#${selectedRefund.orderId?.substring(0, 12).toUpperCase()}` },
                    { label: 'Customer ID', value: selectedRefund.userId },
                    { label: 'Amount', value: `₹${selectedRefund.amount?.toFixed(2)}` },
                    { label: 'Payment Method', value: selectedRefund.paymentMethod?.toUpperCase() || '—' },
                    { label: 'Refund Method', value: selectedRefund.refundMethod || '—' },
                    { label: 'Razorpay Payment', value: selectedRefund.razorpayPaymentId || '—' },
                    { label: 'Razorpay Refund', value: selectedRefund.razorpayRefundId || '—' },
                    { label: 'Reason', value: selectedRefund.reason?.replace(/_/g, ' ') || '—' },
                    { label: 'Created', value: formatDate(selectedRefund.createdAt) },
                    { label: 'Updated', value: formatDate(selectedRefund.updatedAt) },
                    { label: 'Completed', value: formatDate(selectedRefund.completedAt) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-card/5 rounded-xl p-3">
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <p className="text-sm font-semibold text-foreground break-all">{value}</p>
                    </div>
                  ))}
                </div>

                {selectedRefund.failureReason && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                    <p className="text-xs text-red-400 font-bold mb-1">Failure Reason</p>
                    <p className="text-sm text-red-300">{selectedRefund.failureReason}</p>
                  </div>
                )}

                {/* Admin Actions */}
                {['MANUAL_REVIEW', 'FAILED'].includes(selectedRefund.status) && (
                  <div className="border border-border/50 rounded-2xl p-4 space-y-3">
                    <p className="text-sm font-bold text-foreground flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-400" /> Admin Actions
                    </p>
                    <textarea
                      value={actionNotes}
                      onChange={e => setActionNotes(e.target.value)}
                      placeholder="Add notes for this action (optional)..."
                      rows={2}
                      className="w-full rounded-xl border border-border/50 bg-card/5 text-foreground placeholder:text-muted-foreground p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex flex-wrap gap-2">
                      {selectedRefund.razorpayPaymentId && (
                        <Button
                          id="retry-razorpay-btn"
                          onClick={() => handleAdminAction('RETRY_RAZORPAY')}
                          disabled={actionLoading}
                          className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-foreground border-0 gap-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Retry Razorpay Refund
                        </Button>
                      )}
                      <Button
                        id="approve-wallet-btn"
                        onClick={() => handleAdminAction('APPROVE_WALLET')}
                        disabled={actionLoading}
                        className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-foreground border-0 gap-2"
                      >
                        <Wallet className="w-4 h-4" />
                        Credit to Wallet
                      </Button>
                      <Button
                        id="reject-refund-btn"
                        onClick={() => handleAdminAction('REJECT')}
                        disabled={actionLoading}
                        variant="outline"
                        className="flex-1 rounded-xl border-red-500/30 text-red-400 hover:bg-red-500/10 gap-2"
                      >
                        <Ban className="w-4 h-4" />
                        Reject Refund
                      </Button>
                    </div>
                  </div>
                )}

                {/* Audit Logs */}
                {auditLogs.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-400" /> Audit Trail
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="flex items-start gap-3 bg-card/5 rounded-xl p-3">
                          <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground">{log.action}</p>
                            <p className="text-xs text-muted-foreground">
                              by {log.performedBy} · {formatDate(log.timestamp)}
                            </p>
                            {log.notes && <p className="text-xs text-muted-foreground mt-0.5">{log.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDetailOpen(false)}
              className="border-border/50 text-muted-foreground hover:bg-card/5 rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
