'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, query, onSnapshot, orderBy,
  doc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/spinner';
import {
  IndianRupee,
  Wallet,
  CreditCard,
  Banknote,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Building,
  User,
  FileText,
  Download,
  RefreshCw,
  Settings,
  Sliders,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Edit2,
  History,
  AlertTriangle,
  Eye,
  Check,
  X,
  Bike,
  Sparkles,
  ArrowDownToLine,
  Receipt
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DeliveryPerson,
  WithdrawalRequest,
  CodSettlementRequest,
  RiderEarningSettings
} from '@/lib/types';

export default function DeliveryPaymentsPage() {
  const [activeTab, setActiveTab] = useState<'riders' | 'withdrawals' | 'settlements' | 'settings'>('riders');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Data states
  const [riders, setRiders] = useState<DeliveryPerson[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<CodSettlementRequest[]>([]);
  const [settings, setSettings] = useState<RiderEarningSettings>({
    deliveryChargeRiderShare: 80,
    platformShare: 20,
    defaultCodLimit: 3000,
    allowPrepaidWhenCodBlocked: true,
    minWithdrawal: 100,
    maxDailyWithdrawal: 5000,
    withdrawalProcessingFee: 0,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Dialog states
  const [selectedRiderForLimit, setSelectedRiderForLimit] = useState<DeliveryPerson | null>(null);
  const [newCodLimit, setNewCodLimit] = useState<string>('3000');
  const [updatingLimit, setUpdatingLimit] = useState(false);

  const [selectedRiderForAdjust, setSelectedRiderForAdjust] = useState<DeliveryPerson | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustType, setAdjustType] = useState<string>('ADMIN_ADJUSTMENT');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjusting, setAdjusting] = useState(false);

  const [viewLedgerRider, setViewLedgerRider] = useState<DeliveryPerson | null>(null);
  const [ledgerTransactions, setLedgerTransactions] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // 1. Live subscribe to delivery persons
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'deliveryPersons'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DeliveryPerson));
      setRiders(data);
      setLoading(false);
    }, (err) => {
      console.error('[Admin] Error fetching riders:', err);
      toast.error('Failed to fetch delivery partners');
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 2. Live subscribe to withdrawals (both new withdrawals & legacy payout_requests)
  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'withdrawals'), (snapshot) => {
      const wList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      wList.sort((a: any, b: any) => (b.requestedAt?.seconds || 0) - (a.requestedAt?.seconds || 0));
      setWithdrawals(wList);
    });
    return () => unsub1();
  }, []);

  // 3. Live subscribe to COD settlements
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'codSettlements'), (snapshot) => {
      const sList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CodSettlementRequest));
      sList.sort((a: any, b: any) => (b.requestedAt?.seconds || 0) - (a.requestedAt?.seconds || 0));
      setSettlements(sList);
    });
    return () => unsub();
  }, []);

  // 4. Load Earning Settings from API
  useEffect(() => {
    fetch('/api/admin/rider-wallet/settings')
      .then(res => res.json())
      .then(data => {
        if (data.settings) setSettings(data.settings);
      })
      .catch(err => console.warn('[Admin] Failed to load settings:', err));
  }, []);

  // Load Ledger for a specific rider
  useEffect(() => {
    if (!viewLedgerRider) {
      setLedgerTransactions([]);
      return;
    }
    setLoadingLedger(true);
    const q = query(
      collection(db, 'deliveryPersons', viewLedgerRider.id, 'walletTransactions'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setLedgerTransactions(txs);
      setLoadingLedger(false);
    }, (err) => {
      console.warn('Ledger load note:', err);
      setLoadingLedger(false);
    });
    return () => unsub();
  }, [viewLedgerRider]);

  // Handle Save Earning Settings
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/rider-wallet/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      toast.success('Rider earning and COD parameters updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Error saving settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Handle Change COD Limit
  const handleChangeCodLimit = async () => {
    if (!selectedRiderForLimit) return;
    const numLimit = parseFloat(newCodLimit);
    if (isNaN(numLimit) || numLimit < 0) {
      toast.error('Please enter a valid COD limit');
      return;
    }

    setUpdatingLimit(true);
    try {
      const riderRef = doc(db, 'deliveryPersons', selectedRiderForLimit.id);
      const codCollected = Number(selectedRiderForLimit.codCollected || 0);
      const codDeposited = Number(selectedRiderForLimit.codDeposited || 0);
      const codOutstanding = Math.max(0, codCollected - codDeposited);
      const isBlocked = codOutstanding >= numLimit;

      await updateDoc(riderRef, {
        codLimit: numLimit,
        cashLimit: numLimit,
        codBlocked: isBlocked,
        updatedAt: serverTimestamp(),
      });

      toast.success(`Updated COD Limit to ₹${numLimit.toLocaleString('en-IN')} for ${selectedRiderForLimit.name}`);
      setSelectedRiderForLimit(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update COD limit');
    } finally {
      setUpdatingLimit(false);
    }
  };

  // Handle Admin Financial Adjustment (Section 36)
  const handlePerformAdjustment = async () => {
    if (!selectedRiderForAdjust) return;
    const numAmt = parseFloat(adjustAmount);
    if (isNaN(numAmt) || numAmt === 0) {
      toast.error('Please enter a valid non-zero adjustment amount');
      return;
    }
    if (!adjustReason.trim()) {
      toast.error('Audit reason is required for financial adjustments');
      return;
    }

    setAdjusting(true);
    try {
      const res = await fetch('/api/admin/rider-wallet/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riderId: selectedRiderForAdjust.id,
          amount: numAmt,
          type: adjustType,
          reason: adjustReason.trim(),
          adminId: 'ADMIN_SUPERUSER',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Adjustment failed');

      toast.success(`Adjusted ₹${numAmt} successfully for ${selectedRiderForAdjust.name}`);
      setSelectedRiderForAdjust(null);
      setAdjustAmount('');
      setAdjustReason('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to perform adjustment');
    } finally {
      setAdjusting(false);
    }
  };

  // Handle Settlement Verification / Rejection
  const handleVerifySettlement = async (settlementId: string, status: 'VERIFIED' | 'FAILED') => {
    try {
      const res = await fetch('/api/admin/rider-wallet/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settlementId,
          status,
          adminId: 'ADMIN_SUPERUSER',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Settlement update failed');

      toast.success(`Settlement marked as ${status}!`);
    } catch (err: any) {
      toast.error(err.message || 'Error updating settlement');
    }
  };

  // Handle Withdrawal Approval / Rejection
  const handleReviewWithdrawal = async (withdrawalId: string, status: 'COMPLETED' | 'FAILED') => {
    let failureReason = '';
    if (status === 'FAILED') {
      failureReason = prompt('Enter reason for rejecting withdrawal (funds will be refunded to rider):') || 'Rejected by administrator';
    }

    try {
      const res = await fetch('/api/admin/rider-wallet/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          withdrawalId,
          status,
          failureReason,
          adminId: 'ADMIN_SUPERUSER',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Withdrawal update failed');

      toast.success(`Withdrawal request marked as ${status}!`);
    } catch (err: any) {
      toast.error(err.message || 'Error updating withdrawal');
    }
  };

  // Calculate Platform Totals
  const totalPlatformCodOutstanding = riders.reduce((s, r) => {
    const col = Number(r.codCollected || 0);
    const dep = Number(r.codDeposited || 0);
    return s + Math.max(0, col - dep);
  }, 0);

  const totalPlatformAvailableEarnings = riders.reduce((s, r) => {
    return s + Number(r.availableEarnings || 0);
  }, 0);

  const pendingWithdrawalsCount = withdrawals.filter(w => w.status === 'PENDING').length;
  const pendingSettlementsCount = settlements.filter(s => s.status === 'PENDING' || s.status === 'UNDER_REVIEW').length;

  const filteredRiders = riders.filter(r =>
    r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportRidersLedger = () => {
    const csvContent = "data:text/csv;charset=utf-8,"
      + "Rider ID,Name,Phone,Available Earnings,COD Outstanding,COD Limit,COD Blocked,Withdrawn,Total Lifetime\n"
      + riders.map(r => {
        const out = Math.max(0, Number(r.codCollected || 0) - Number(r.codDeposited || 0));
        return `"${r.id}","${r.name || ''}","${r.phone || ''}",${Number(r.availableEarnings || 0)},${out},${Number(r.codLimit || 3000)},${r.codBlocked ? 'YES' : 'NO'},${Number(r.withdrawnAmount || 0)},${Number(r.totalEarnings || 0)}`;
      }).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `hunger_riders_financial_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader />
          <p className="text-gray-300 font-medium">Loading Rider Wallets & Financial Ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 text-white">
      {/* ─── PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black uppercase tracking-wider text-orange-400 bg-orange-500/10 px-2.5 py-0.5 rounded-full border border-orange-500/20">
              Admin Financial Control
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Delivery Partner <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">Wallet & Settlement Hub</span>
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Real-time double-entry ledger, COD cash limit controls, withdrawal approvals & configurable platform splits.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={exportRidersLedger}
            variant="outline"
            className="border-gray-700 bg-gray-900/60 text-white hover:bg-gray-800 text-xs font-bold rounded-xl"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Ledger
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="border-gray-700 bg-gray-900/60 text-white hover:bg-gray-800 text-xs font-bold rounded-xl"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ─── STAT METRICS CARDS ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-orange-500/15 via-red-500/5 to-transparent border border-orange-500/30 rounded-3xl p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase">Platform COD Held</span>
            <Banknote className="w-5 h-5 text-orange-400" />
          </div>
          <p className="text-3xl font-black font-mono text-orange-400">
            ₹{totalPlatformCodOutstanding.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Cash held by riders across network</p>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/15 via-teal-500/5 to-transparent border border-emerald-500/30 rounded-3xl p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase">Total Available Earnings</span>
            <IndianRupee className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-black font-mono text-emerald-400">
            ₹{totalPlatformAvailableEarnings.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Total rider withdrawable balances</p>
        </Card>

        <Card className="bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase">Pending Withdrawals</span>
            <ArrowDownToLine className="w-5 h-5 text-teal-400" />
          </div>
          <p className="text-3xl font-black font-mono text-white">
            {pendingWithdrawalsCount}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Requests waiting for disbursement</p>
        </Card>

        <Card className="bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase">Pending COD Deposits</span>
            <CheckCircle2 className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-3xl font-black font-mono text-white">
            {pendingSettlementsCount}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Settlements requiring admin verification</p>
        </Card>
      </div>

      {/* ─── TABS NAVIGATION ──────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
        <TabsList className="bg-white/5 border border-white/10 p-1 rounded-2xl flex flex-wrap h-auto gap-1">
          <TabsTrigger
            value="riders"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 py-2 px-4"
          >
            <Bike className="w-4 h-4" />
            Riders & Wallets ({riders.length})
          </TabsTrigger>

          <TabsTrigger
            value="withdrawals"
            className="data-[state=active]:bg-teal-600 data-[state=active]:text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 py-2 px-4"
          >
            <ArrowDownToLine className="w-4 h-4" />
            Withdrawals ({withdrawals.length})
            {pendingWithdrawalsCount > 0 && (
              <Badge className="bg-teal-400 text-black text-[10px] px-1.5 py-0 rounded-full font-black ml-1">
                {pendingWithdrawalsCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="settlements"
            className="data-[state=active]:bg-amber-600 data-[state=active]:text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 py-2 px-4"
          >
            <Receipt className="w-4 h-4" />
            COD Settlements ({settlements.length})
            {pendingSettlementsCount > 0 && (
              <Badge className="bg-amber-400 text-black text-[10px] px-1.5 py-0 rounded-full font-black ml-1">
                {pendingSettlementsCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="settings"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 py-2 px-4"
          >
            <Settings className="w-4 h-4" />
            Earning & Limit Settings
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: RIDERS & WALLETS OVERVIEW ────────────────────────────── */}
        <TabsContent value="riders" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search riders by name, phone, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-black/40 border-white/10 rounded-2xl text-xs text-white"
              />
            </div>
            <p className="text-xs text-gray-400 self-center">
              Showing {filteredRiders.length} delivery partners
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRiders.map((r) => {
              const codCollected = Number(r.codCollected || 0);
              const codDeposited = Number(r.codDeposited || 0);
              const codOutstanding = Math.max(0, codCollected - codDeposited);
              const codLimit = Number(r.codLimit || 3000);
              const availableEarnings = Number(r.availableEarnings ?? (r.totalEarnings || 0));
              const withdrawn = Number(r.withdrawnAmount || 0);
              const isBlocked = r.codBlocked === true || codOutstanding >= codLimit;

              return (
                <Card
                  key={r.id}
                  className={`bg-white/5 border rounded-3xl p-5 backdrop-blur-xl space-y-4 transition-all hover:border-orange-500/40 ${
                    isBlocked ? 'border-red-500/40 bg-red-950/10' : 'border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-white/20">
                        <AvatarFallback className="bg-orange-500/20 text-orange-300 font-bold text-xs">
                          {r.name?.slice(0, 2).toUpperCase() || 'DP'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-bold text-white text-sm truncate max-w-[150px]">{r.name || 'Delivery Partner'}</h3>
                        <p className="text-gray-400 text-[11px] font-mono">{r.phone || 'No phone'}</p>
                      </div>
                    </div>

                    <Badge className={`text-[10px] font-bold ${
                      isBlocked
                        ? 'bg-red-500/20 text-red-300 border-red-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}>
                      {isBlocked ? '🔴 COD BLOCKED' : '🟢 ACTIVE'}
                    </Badge>
                  </div>

                  {/* Financial Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                      <span className="text-gray-400 text-[10px] uppercase font-bold block">Available Earnings</span>
                      <span className="font-mono font-bold text-emerald-400 text-base">₹{availableEarnings.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                      <span className="text-gray-400 text-[10px] uppercase font-bold block">COD Outstanding</span>
                      <span className={`font-mono font-bold text-base ${codOutstanding > 0 ? 'text-orange-400' : 'text-gray-300'}`}>
                        ₹{codOutstanding.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* COD Limit Progress */}
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between text-gray-400">
                      <span>COD Limit: ₹{codLimit}</span>
                      <span>Used: {Math.round((codOutstanding / codLimit) * 100)}%</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isBlocked ? 'bg-red-500' : 'bg-orange-500'}`}
                        style={{ width: `${Math.min(100, (codOutstanding / codLimit) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Withdrawn & Total */}
                  <div className="flex justify-between text-[11px] text-gray-400 pt-1 border-t border-white/5">
                    <span>Withdrawn: ₹{withdrawn}</span>
                    <span>Lifetime: ₹{Number(r.totalEarnings || 0)}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-3 gap-1.5 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedRiderForLimit(r);
                        setNewCodLimit(codLimit.toString());
                      }}
                      className="border-white/10 hover:bg-white/10 text-gray-300 text-[10px] h-8 rounded-xl font-bold"
                    >
                      <Sliders className="w-3 h-3 mr-1" /> Limit
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedRiderForAdjust(r);
                        setAdjustAmount('');
                        setAdjustReason('');
                      }}
                      className="border-white/10 hover:bg-white/10 text-emerald-400 text-[10px] h-8 rounded-xl font-bold"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Adjust
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setViewLedgerRider(r)}
                      className="border-white/10 hover:bg-white/10 text-blue-400 text-[10px] h-8 rounded-xl font-bold"
                    >
                      <History className="w-3 h-3 mr-1" /> Ledger
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── TAB 2: WITHDRAWAL REQUESTS ──────────────────────────────────── */}
        <TabsContent value="withdrawals" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-white text-base">Withdrawal Requests</h3>
            <span className="text-xs text-gray-400">{withdrawals.length} total recorded requests</span>
          </div>

          {withdrawals.length === 0 ? (
            <Card className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center text-gray-500 text-sm">
              No withdrawal requests logged. When riders click "Withdraw Earnings", requests will appear here for one-click processing.
            </Card>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w) => {
                const isPending = w.status === 'PENDING' || w.status === 'pending';
                const isCompleted = w.status === 'COMPLETED' || w.status === 'accepted';
                const isFailed = w.status === 'FAILED' || w.status === 'rejected';

                return (
                  <Card key={w.id || w.withdrawalId} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
                          <ArrowDownToLine className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-base">{w.riderName || w.userName || 'Delivery Partner'}</span>
                            <Badge className={`text-[10px] font-bold ${
                              isCompleted
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : isFailed
                                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            }`}>
                              {w.status}
                            </Badge>
                          </div>
                          <p className="text-gray-300 text-xs mt-0.5">
                            Payout Dest: <span className="font-mono text-gray-200">{w.destinationReference || (w.bankDetails ? `${w.bankDetails.bankName} - ${w.bankDetails.accountNumber}` : 'Direct')}</span>
                          </p>
                          <p className="text-gray-500 text-[11px] font-mono mt-0.5">
                            ID: {w.withdrawalId || w.id} • {w.requestedAt?.toDate ? w.requestedAt.toDate().toLocaleString() : 'Recent'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end sm:self-auto">
                        <div className="text-right">
                          <span className="text-xs text-gray-400 block">Amount</span>
                          <span className="font-mono font-black text-emerald-400 text-xl">
                            ₹{Number(w.amount).toLocaleString('en-IN')}
                          </span>
                        </div>

                        {isPending && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleReviewWithdrawal(w.id || w.withdrawalId, 'COMPLETED')}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 rounded-xl"
                            >
                              <Check className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReviewWithdrawal(w.id || w.withdrawalId, 'FAILED')}
                              className="font-bold text-xs h-9 rounded-xl"
                            >
                              <X className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── TAB 3: COD SETTLEMENTS ──────────────────────────────────────── */}
        <TabsContent value="settlements" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-white text-base">COD Cash Settlements</h3>
            <span className="text-xs text-gray-400">{settlements.length} total settlement entries</span>
          </div>

          {settlements.length === 0 ? (
            <Card className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center text-gray-500 text-sm">
              No COD settlement deposits recorded yet.
            </Card>
          ) : (
            <div className="space-y-3">
              {settlements.map((s) => {
                const isPending = s.status === 'PENDING' || s.status === 'UNDER_REVIEW';
                const isVerified = s.status === 'VERIFIED';
                const isFailed = s.status === 'FAILED';

                return (
                  <Card key={s.id || s.settlementId} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                          <Receipt className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-base">{s.riderName || 'Rider'}</span>
                            <Badge className={`text-[10px] font-bold ${
                              isVerified
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : isFailed
                                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            }`}>
                              {s.status}
                            </Badge>
                          </div>
                          <p className="text-gray-300 text-xs mt-0.5">
                            Method: {s.paymentMethod} • Ref: <span className="font-mono text-gray-200">{s.transactionReference}</span>
                          </p>
                          <p className="text-gray-500 text-[11px] font-mono mt-0.5">
                            ID: {s.settlementId || s.id} • {s.requestedAt?.toDate ? s.requestedAt.toDate().toLocaleString() : 'Recent'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end sm:self-auto">
                        <div className="text-right">
                          <span className="text-xs text-gray-400 block">Deposit Amount</span>
                          <span className="font-mono font-black text-orange-400 text-xl">
                            ₹{Number(s.amount).toLocaleString('en-IN')}
                          </span>
                        </div>

                        {isPending && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleVerifySettlement(s.id || s.settlementId, 'VERIFIED')}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 rounded-xl"
                            >
                              <Check className="w-4 h-4 mr-1" /> Verify
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleVerifySettlement(s.id || s.settlementId, 'FAILED')}
                              className="font-bold text-xs h-9 rounded-xl"
                            >
                              <X className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── TAB 4: SYSTEM EARNING & COD SETTINGS ─────────────────────────── */}
        <TabsContent value="settings" className="space-y-4">
          <Card className="bg-gradient-to-r from-blue-950/20 via-black to-indigo-950/20 border border-blue-500/30 rounded-3xl p-6 sm:p-7 backdrop-blur-2xl">
            <div className="mb-6">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Sliders className="w-6 h-6 text-blue-400" />
                Rider Earning & COD Parameters
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Configure platform commission shares and security limits. Stored securely on the backend; calculations strictly execute server-side.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Rider Share % */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300">
                  Delivery Charge Rider Share (%):
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.deliveryChargeRiderShare}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSettings(prev => ({
                        ...prev,
                        deliveryChargeRiderShare: val,
                        platformShare: 100 - val,
                      }));
                    }}
                    className="bg-black/60 border-white/20 h-12 rounded-xl text-white font-mono font-bold text-lg"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                </div>
                <p className="text-[11px] text-gray-500">
                  Currently: Rider receives {settings.deliveryChargeRiderShare}% of the delivery charge only.
                </p>
              </div>

              {/* Platform Share % */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300">
                  Platform Share (%):
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    disabled
                    value={settings.platformShare}
                    className="bg-black/40 border-white/10 h-12 rounded-xl text-gray-400 font-mono font-bold text-lg"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">%</span>
                </div>
                <p className="text-[11px] text-gray-500">Automatically 100% minus rider share.</p>
              </div>

              {/* Default COD Limit */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300">
                  Default Rider COD Cash Limit (₹):
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                  <Input
                    type="number"
                    min="500"
                    step="500"
                    value={settings.defaultCodLimit}
                    onChange={(e) => setSettings(prev => ({ ...prev, defaultCodLimit: Number(e.target.value) }))}
                    className="pl-8 bg-black/60 border-white/20 h-12 rounded-xl text-white font-mono font-bold text-lg"
                  />
                </div>
                <p className="text-[11px] text-gray-500">Default limit applied to newly onboarded riders.</p>
              </div>

              {/* Minimum Withdrawal */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300">
                  Minimum Withdrawal Amount (₹):
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                  <Input
                    type="number"
                    min="50"
                    value={settings.minWithdrawal}
                    onChange={(e) => setSettings(prev => ({ ...prev, minWithdrawal: Number(e.target.value) }))}
                    className="pl-8 bg-black/60 border-white/20 h-12 rounded-xl text-white font-mono font-bold text-lg"
                  />
                </div>
                <p className="text-[11px] text-gray-500">Riders cannot withdraw below this balance.</p>
              </div>

              {/* Max Daily Withdrawal */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300">
                  Maximum Daily Withdrawal Limit (₹):
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                  <Input
                    type="number"
                    min="1000"
                    value={settings.maxDailyWithdrawal}
                    onChange={(e) => setSettings(prev => ({ ...prev, maxDailyWithdrawal: Number(e.target.value) }))}
                    className="pl-8 bg-black/60 border-white/20 h-12 rounded-xl text-white font-mono font-bold text-lg"
                  />
                </div>
                <p className="text-[11px] text-gray-500">Security ceiling per rider per day.</p>
              </div>

              {/* Allow Prepaid Orders When COD Blocked (Section 11) */}
              <div className="space-y-2 flex flex-col justify-center">
                <label className="text-xs font-bold text-gray-300">
                  Allow Prepaid Orders When COD Limit Is Full:
                </label>
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={() => setSettings(prev => ({ ...prev, allowPrepaidWhenCodBlocked: !prev.allowPrepaidWhenCodBlocked }))}
                    className={`font-bold text-xs h-10 rounded-xl px-4 ${
                      settings.allowPrepaidWhenCodBlocked
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-red-600 hover:bg-red-500 text-white'
                    }`}
                  >
                    {settings.allowPrepaidWhenCodBlocked ? '✅ YES (Allow Prepaid)' : '❌ NO (Block All Orders)'}
                  </Button>
                  <span className="text-[11px] text-gray-400">
                    {settings.allowPrepaidWhenCodBlocked
                      ? 'Riders can continue delivering prepaid orders while settling COD cash.'
                      : 'Rider account paused completely until COD is settled.'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/10 flex justify-end">
              <Button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 px-8 rounded-xl"
              >
                {savingSettings ? <Loader /> : 'Save System Settings'}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── MODAL: CHANGE RIDER COD LIMIT ─────────────────────────────────── */}
      <Dialog open={!!selectedRiderForLimit} onOpenChange={(open) => !open && setSelectedRiderForLimit(null)}>
        <DialogContent className="bg-gray-950 border border-white/20 text-white max-w-sm rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-orange-400" />
              Adjust COD Limit
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <p className="text-xs text-gray-300">
              Set custom COD cash limit for <strong>{selectedRiderForLimit?.name}</strong>.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400">New COD Limit (₹):</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                <Input
                  type="number"
                  min="0"
                  step="500"
                  value={newCodLimit}
                  onChange={(e) => setNewCodLimit(e.target.value)}
                  className="pl-8 bg-black/60 border-white/20 h-11 text-base font-mono font-bold text-white rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-1">
                {['2000', '3000', '5000', '10000'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setNewCodLimit(amt)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 font-bold"
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleChangeCodLimit}
              disabled={updatingLimit}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold h-11 rounded-xl"
            >
              {updatingLimit ? <Loader /> : 'Update Limit'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: FINANCIAL AUDIT ADJUSTMENT (Section 36) ─────────────────── */}
      <Dialog open={!!selectedRiderForAdjust} onOpenChange={(open) => !open && setSelectedRiderForAdjust(null)}>
        <DialogContent className="bg-gray-950 border border-emerald-500/30 text-white max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Financial Audit Adjustment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <p className="text-xs text-gray-300">
              Apply ledger credit/debit for <strong>{selectedRiderForAdjust?.name}</strong>. Creates permanent immutable audit trail.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400">Adjustment Type:</label>
              <select
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value)}
                className="w-full bg-black/60 border border-white/20 h-10 rounded-xl px-3 text-xs text-white"
              >
                <option value="ADMIN_ADJUSTMENT">Admin Manual Adjustment</option>
                <option value="INCENTIVE">Incentive Reward</option>
                <option value="BONUS">Special Festival / Peak Bonus</option>
                <option value="CANCELLATION_COMPENSATION">Cancellation Compensation</option>
                <option value="REFUND_ADJUSTMENT">Refund / Penalty Debit</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400">Amount (₹): Use negative for debit (e.g. -50)</label>
              <Input
                type="number"
                placeholder="e.g. 100 or -50"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="bg-black/60 border-white/20 h-11 text-base font-mono font-bold text-white rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400">Audit Reason / Justification (Required):</label>
              <Input
                type="text"
                placeholder="e.g. Order #123 rain bonus compensation approved"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="bg-black/60 border-white/20 h-10 text-xs text-white rounded-xl"
              />
            </div>

            <Button
              onClick={handlePerformAdjustment}
              disabled={adjusting || !adjustAmount || !adjustReason.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 rounded-xl"
            >
              {adjusting ? <Loader /> : 'Post Audit Adjustment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: VIEW RIDER LEDGER ───────────────────────────────────────── */}
      <Dialog open={!!viewLedgerRider} onOpenChange={(open) => !open && setViewLedgerRider(null)}>
        <DialogContent className="bg-gray-950 border border-white/20 text-white max-w-2xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                Ledger: {viewLedgerRider?.name}
              </span>
              <Badge className="bg-emerald-500/10 text-emerald-400 text-xs">
                Avail: ₹{Number(viewLedgerRider?.availableEarnings || 0)}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-96 pr-3 mt-3">
            {loadingLedger ? (
              <div className="flex justify-center items-center h-40">
                <Loader />
              </div>
            ) : ledgerTransactions.length === 0 ? (
              <p className="text-center text-gray-500 text-xs py-10">No transactions recorded for this rider.</p>
            ) : (
              <div className="space-y-2.5">
                {ledgerTransactions.map((tx) => (
                  <div key={tx.id || tx.transactionId} className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{tx.description || tx.type}</p>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                        {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleString() : 'Just now'} • {tx.type}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`font-mono font-bold text-sm ${
                        tx.direction === 'DEBIT' || tx.isDebit ? 'text-orange-400' : 'text-emerald-400'
                      }`}>
                        {tx.direction === 'DEBIT' || tx.isDebit ? '-' : '+'}₹{Number(tx.amount || 0).toFixed(2)}
                      </span>
                      {tx.balanceAfter !== undefined && (
                        <p className="text-[10px] text-gray-400 font-mono">Bal: ₹{tx.balanceAfter}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
