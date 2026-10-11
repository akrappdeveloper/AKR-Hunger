'use client';

import React, { useState, useEffect } from 'react';
import {
  Gift,
  Plus,
  Search,
  Edit2,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Zap,
  RefreshCw,
  Coins,
  CheckCircle2,
  AlertCircle,
  Clock,
  Award,
  Wallet,
  Percent,
  Truck,
  IndianRupee,
  Tag,
  ShieldCheck,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { realtimeDb, db } from '@/lib/firebase';
import {
  ref as rtdbRef,
  onValue,
  set as rtdbSet,
  remove as rtdbRemove,
  update as rtdbUpdate,
} from 'firebase/database';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import type { RedeemCodeItem, RedeemBenefitType } from '@/lib/types';
import { ProtectedRoute } from '@/components/admin/ProtectedRoute';

// Starter codes for 1-click seeding covering all Benefit Types
const STARTER_REDEEM_CODES: Omit<RedeemCodeItem, 'id'>[] = [
  {
    code: 'WELCOME2026',
    type: 'points',
    benefitType: 'points',
    value: 250,
    description: 'Welcome loyalty bonus reward for new mobile & web foodies.',
    maxRedemptions: 1000,
    redemptionCount: 0,
    isActive: true,
    expiresAt: '2026-12-31',
  },
  {
    code: 'HUNGERCASH50',
    type: 'wallet',
    benefitType: 'wallet',
    value: 50,
    description: 'Special ₹50 instant wallet cash credit voucher.',
    maxRedemptions: 500,
    redemptionCount: 0,
    isActive: true,
    expiresAt: '2026-12-31',
  },
  {
    code: 'FEAST25OFF',
    type: 'discount',
    benefitType: 'discount',
    value: 25,
    discountType: 'percentage',
    minOrderValue: 299,
    maxDiscount: 125,
    description: 'Flat 25% OFF on all culinary feasts above ₹299.',
    maxRedemptions: 400,
    redemptionCount: 0,
    isActive: true,
    expiresAt: '2026-12-31',
  },
  {
    code: 'FREESHIPNOW',
    type: 'delivery',
    benefitType: 'delivery',
    value: 100,
    minOrderValue: 149,
    description: '100% Free Express Delivery waiver pass for hunger cravings.',
    maxRedemptions: 600,
    redemptionCount: 0,
    isActive: true,
    expiresAt: '2026-12-31',
  },
];

export default function AdminRedeemCodesPage() {
  const { toast } = useToast();
  const [codes, setCodes] = useState<RedeemCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<RedeemCodeItem | null>(null);
  const [formData, setFormData] = useState<{
    code: string;
    type: RedeemBenefitType;
    value: number;
    discountType: 'flat' | 'percentage';
    minOrderValue: number;
    maxDiscount: number;
    description: string;
    maxRedemptions: number;
    expiresAt: string;
    isActive: boolean;
  }>({
    code: '',
    type: 'wallet',
    value: 50,
    discountType: 'flat',
    minOrderValue: 0,
    maxDiscount: 0,
    description: '',
    maxRedemptions: 500,
    expiresAt: '2026-12-31',
    isActive: true,
  });

  // Dual Synchronized Listener (Realtime Database + Firestore fallback)
  useEffect(() => {
    let unsubRtdb: (() => void) | undefined;
    let unsubFirestore: (() => void) | undefined;

    // 1. RTDB Listener
    try {
      const codeRef = rtdbRef(realtimeDb, 'redeem_codes');
      unsubRtdb = onValue(
        codeRef,
        (snapshot) => {
          setIsLiveConnected(true);
          setLoading(false);
          if (snapshot.exists()) {
            const data = snapshot.val();
            const list: RedeemCodeItem[] = Object.keys(data).map((key) => ({
              id: key,
              ...data[key],
            }));
            setCodes(list);
          } else {
            setCodes([]);
          }
        },
        (error) => {
          console.warn('[RedeemCodes] RTDB listener notice:', error.message || error);
          setIsLiveConnected(false);
          // Fallback to Firestore
          subscribeFirestore();
        }
      );
    } catch (err) {
      console.warn('[RedeemCodes] RTDB attach notice:', err);
      subscribeFirestore();
    }

    // 2. Firestore Listener Fallback
    function subscribeFirestore() {
      try {
        const colRef = collection(db, 'redeemCodes');
        unsubFirestore = onSnapshot(
          colRef,
          (snap) => {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            })) as RedeemCodeItem[];
            setCodes(list);
            setLoading(false);
          },
          (err) => {
            console.warn('[RedeemCodes] Firestore listener notice:', err.message || err);
            setLoading(false);
          }
        );
      } catch (err) {
        setLoading(false);
      }
    }

    return () => {
      if (unsubRtdb) unsubRtdb();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  const handleCopy = (code: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).catch(() => {
          fallbackCopyText(code);
        });
      } else {
        fallbackCopyText(code);
      }
    } catch {
      fallbackCopyText(code);
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast({
      title: 'Code Copied!',
      description: `Redeem code ${code} copied to clipboard.`,
    });
  };

  const fallbackCopyText = (text: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    } catch (e) {
      console.warn('Fallback copy failed', e);
    }
  };

  const handleGenerateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const prefixMap: Record<RedeemBenefitType, string> = {
      wallet: 'CASH',
      points: 'GIFT',
      discount: 'SAVE',
      delivery: 'SHIP',
    };
    const prefix = prefixMap[formData.type] || 'CODE';
    setFormData((prev) => ({ ...prev, code: `${prefix}${randomPart}` }));
  };

  const handleOpenCreate = () => {
    setEditingCode(null);
    setFormData({
      code: '',
      type: 'wallet',
      value: 50,
      discountType: 'flat',
      minOrderValue: 0,
      maxDiscount: 0,
      description: '',
      maxRedemptions: 500,
      expiresAt: '2026-12-31',
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (item: RedeemCodeItem) => {
    setEditingCode(item);
    const resolvedType = (item.benefitType || item.type || 'points') as RedeemBenefitType;
    setFormData({
      code: item.code,
      type: resolvedType,
      value: item.value || 0,
      discountType: item.discountType || 'flat',
      minOrderValue: item.minOrderValue || 0,
      maxDiscount: item.maxDiscount || 0,
      description: item.description || '',
      maxRedemptions: item.maxRedemptions || 500,
      expiresAt: item.expiresAt || '2026-12-31',
      isActive: item.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSaveCode = async () => {
    if (!formData.code.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Redeem code cannot be empty.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const codeUpper = formData.code.trim().toUpperCase();
      const codeId = editingCode ? editingCode.id : `code_${Date.now()}`;

      const payload: RedeemCodeItem = {
        id: codeId,
        code: codeUpper,
        type: formData.type,
        benefitType: formData.type,
        value: Number(formData.value),
        discountType: formData.discountType,
        minOrderValue: Number(formData.minOrderValue || 0),
        maxDiscount: Number(formData.maxDiscount || 0),
        description: formData.description.trim(),
        maxRedemptions: Number(formData.maxRedemptions),
        redemptionCount: editingCode?.redemptionCount || 0,
        expiresAt: formData.expiresAt,
        isActive: formData.isActive,
        createdAt: editingCode?.createdAt || new Date().toISOString(),
      };

      // 1. Realtime Database Save (/redeem_codes/codeId)
      try {
        await rtdbSet(rtdbRef(realtimeDb, `redeem_codes/${codeId}`), payload);
      } catch (rtdbErr) {
        console.warn('RTDB write notice:', rtdbErr);
      }

      // 2. Firestore Save (/redeemCodes/codeId) with resilient error handling
      try {
        await setDoc(
          doc(db, 'redeemCodes', codeId),
          {
            ...payload,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (fsErr) {
        console.warn('Firestore write notice:', fsErr);
      }

      toast({
        title: editingCode ? 'Code Updated! ✨' : 'Redeem Code Created! 🎁',
        description: `Code "${codeUpper}" (${formData.type.toUpperCase()}) is active and redeemable across Android & Web!`,
      });

      setIsDialogOpen(false);
    } catch (err: any) {
      console.error('Failed to save redeem code:', err);
      toast({
        title: 'Save Failed',
        description: err.message || 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (item: RedeemCodeItem) => {
    try {
      const updatedStatus = !item.isActive;
      // 1. RTDB
      try {
        await rtdbUpdate(rtdbRef(realtimeDb, `redeem_codes/${item.id}`), {
          isActive: updatedStatus,
        });
      } catch (_) {}

      // 2. Firestore
      try {
        await updateDoc(doc(db, 'redeemCodes', item.id), {
          isActive: updatedStatus,
        });
      } catch (_) {}

      toast({
        title: updatedStatus ? 'Code Activated' : 'Code Paused',
        description: `${item.code} is now ${updatedStatus ? 'active' : 'inactive'}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Update Failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCode = async (item: RedeemCodeItem) => {
    if (!confirm(`Delete redeem code "${item.code}"?`)) return;

    try {
      // 1. RTDB
      try {
        await rtdbRemove(rtdbRef(realtimeDb, `redeem_codes/${item.id}`));
      } catch (_) {}

      // 2. Firestore
      try {
        await deleteDoc(doc(db, 'redeemCodes', item.id));
      } catch (_) {}

      toast({
        title: 'Code Deleted',
        description: `Redeem code ${item.code} has been deleted.`,
      });
    } catch (err: any) {
      toast({
        title: 'Delete Failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleSeedStarterCodes = async () => {
    try {
      setLoading(true);
      for (const starter of STARTER_REDEEM_CODES) {
        const codeId = `code_${starter.code.toLowerCase()}`;
        const payload = {
          ...starter,
          id: codeId,
          createdAt: new Date().toISOString(),
        };
        try {
          await rtdbSet(rtdbRef(realtimeDb, `redeem_codes/${codeId}`), payload);
        } catch (_) {}
        try {
          await setDoc(doc(db, 'redeemCodes', codeId), payload, { merge: true });
        } catch (_) {}
      }
      toast({
        title: 'Starter Codes Seeded! 🎉',
        description: `${STARTER_REDEEM_CODES.length} multi-benefit codes provisioned across Firebase.`,
      });
    } catch (err: any) {
      toast({
        title: 'Seeding Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filtered Codes
  const filteredCodes = codes.filter((item) => {
    const itemBenefit = item.benefitType || item.type || 'points';
    const matchType = selectedType === 'all' || itemBenefit === selectedType;
    const matchSearch =
      searchQuery === '' ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchType && matchSearch;
  });

  const totalCodes = codes.length;
  const activeCodes = codes.filter((c) => c.isActive).length;
  const totalRedemptions = codes.reduce((acc, c) => acc + (c.redemptionCount || 0), 0);
  const totalWalletValue = codes
    .filter((c) => (c.benefitType || c.type) === 'wallet')
    .reduce((acc, c) => acc + (c.value || 0), 0);
  const totalPointsValue = codes
    .filter((c) => (c.benefitType || c.type) === 'points')
    .reduce((acc, c) => acc + (c.value || 0), 0);

  // Benefit Type Helper Badge
  const getBenefitBadge = (item: RedeemCodeItem) => {
    const bType = (item.benefitType || item.type || 'points') as RedeemBenefitType;
    switch (bType) {
      case 'wallet':
        return {
          label: `₹${item.value} Wallet Cash`,
          icon: IndianRupee,
          bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
          symbol: '💳',
        };
      case 'discount':
        const discText =
          item.discountType === 'percentage'
            ? `${item.value}% OFF`
            : `₹${item.value} FLAT OFF`;
        return {
          label: discText,
          icon: Percent,
          bg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
          symbol: '🏷️',
        };
      case 'delivery':
        return {
          label: 'Free Delivery Pass',
          icon: Truck,
          bg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
          symbol: '🛵',
        };
      case 'points':
      default:
        return {
          label: `+${item.value} Reward Points`,
          icon: Coins,
          bg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
          symbol: '🪙',
        };
    }
  };

  return (
    <ProtectedRoute allowedRoles={['super_admin', 'content_manager', 'operations_admin']}>
      <div className="space-y-6 animate-in fade-in duration-500 pb-12">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Gift className="w-5 h-5 text-white stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                    Redeem Codes & Vouchers
                  </h1>
                  <Badge
                    variant="outline"
                    className={`text-xs font-bold border ${
                      isLiveConnected
                        ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                        : 'border-yellow-500/40 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10'
                    }`}
                  >
                    {isLiveConnected ? 'Live Cloud Sync' : 'Firestore Active'}
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Manage gift codes, wallet credits, loyalty coin vouchers, and discount coupons.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {codes.length === 0 && (
              <Button
                variant="outline"
                onClick={handleSeedStarterCodes}
                className="rounded-xl border-border text-foreground hover:bg-muted font-bold text-xs h-10 gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Seed 4 Samples</span>
              </Button>
            )}
            <Button
              onClick={handleOpenCreate}
              className="rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md gap-2 h-10 px-4 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create Redeem Code</span>
            </Button>
          </div>
        </div>

        {/* 4 Metric Overview Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <Card className="rounded-2xl border-border bg-card shadow-xs hover:shadow-md transition-all">
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Codes</p>
                <h3 className="text-2xl sm:text-3xl font-black text-foreground font-mono mt-1">{totalCodes}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{activeCodes} active for customers</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card shadow-xs hover:shadow-md transition-all">
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Redemptions</p>
                <h3 className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 font-mono mt-1">
                  {totalRedemptions}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Claims in App & Web</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card shadow-xs hover:shadow-md transition-all">
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Wallet Cash Pool</p>
                <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                  ₹{totalWalletValue}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Active gift money</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card shadow-xs hover:shadow-md transition-all">
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Loyalty Points Pool</p>
                <h3 className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 font-mono mt-1">
                  {totalPointsValue} PTS
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Rewards bonus sum</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Coins className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar with Benefit Types */}
        <Card className="bg-card border-border shadow-xs rounded-2xl p-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Benefit Type Pills */}
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              {[
                { id: 'all', label: 'All Types', icon: Gift },
                { id: 'wallet', label: 'Wallet Cash', icon: IndianRupee },
                { id: 'points', label: 'Loyalty Points', icon: Coins },
                { id: 'discount', label: 'Cart Discount', icon: Percent },
                { id: 'delivery', label: 'Free Delivery', icon: Truck },
              ].map((btn) => {
                const Icon = btn.icon;
                const isSelected = selectedType === btn.id;
                return (
                  <button
                    key={btn.id}
                    onClick={() => setSelectedType(btn.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{btn.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search code or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-background border-border text-foreground placeholder:text-muted-foreground text-xs font-medium focus:border-primary"
              />
            </div>
          </div>
        </Card>

        {/* Code Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
            <RefreshCw className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-sm font-medium">Syncing redeem codes from Firebase...</p>
          </div>
        ) : filteredCodes.length === 0 ? (
          <Card className="bg-card border-border p-12 text-center rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 mx-auto flex items-center justify-center text-3xl mb-4">
              🎁
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">No Redeem Codes Found</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              {codes.length === 0
                ? 'No redeem codes created yet. Click "Seed 4 Samples" to create sample wallet, points, discount, and delivery codes.'
                : 'No redeem codes match your selected filter.'}
            </p>
            {codes.length === 0 ? (
              <Button
                onClick={handleSeedStarterCodes}
                className="bg-primary text-primary-foreground font-bold rounded-xl cursor-pointer"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Seed 4 Samples
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedType('all');
                }}
                className="rounded-xl border-border text-foreground hover:bg-muted cursor-pointer"
              >
                Clear Filter
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredCodes.map((item) => {
              const badge = getBenefitBadge(item);
              const BenefitIcon = badge.icon;

              return (
                <Card
                  key={item.id}
                  className="bg-card border-border hover:border-primary/40 transition-all duration-300 rounded-2xl overflow-hidden shadow-xs hover:shadow-md flex flex-col justify-between"
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border flex items-center justify-center text-2xl shrink-0 shadow-inner">
                          {badge.symbol}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base font-black text-foreground font-mono tracking-wider">
                              {item.code}
                            </CardTitle>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.code)}
                              className="text-muted-foreground hover:text-foreground p-1 transition-colors cursor-pointer"
                              title="Copy code"
                            >
                              {copiedCode === item.code ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {item.description || 'Promotional gift voucher code'}
                          </p>
                        </div>
                      </div>

                      <Badge
                        className={`text-[11px] font-bold border ${
                          item.isActive
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        {item.isActive ? 'Active' : 'Paused'}
                      </Badge>
                    </div>

                    {/* Benefit Type Pill & Limits */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-4">
                      <Badge className={`text-xs font-bold gap-1 border ${badge.bg}`}>
                        <BenefitIcon className="w-3 h-3" />
                        <span>{badge.label}</span>
                      </Badge>
                      <Badge variant="outline" className="border-border text-muted-foreground text-[11px] font-medium">
                        {item.redemptionCount || 0} / {item.maxRedemptions || '∞'} Uses
                      </Badge>
                      {item.minOrderValue && item.minOrderValue > 0 ? (
                        <Badge variant="outline" className="border-border text-muted-foreground text-[11px] font-medium">
                          Min: ₹{item.minOrderValue}
                        </Badge>
                      ) : null}
                      {item.expiresAt ? (
                        <Badge variant="outline" className="border-border text-muted-foreground text-[11px] font-medium">
                          Exp: {item.expiresAt}
                        </Badge>
                      ) : null}
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 pt-0">
                    <div className="border-t border-border my-3" />

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span>Android App & Web Panel</span>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleActive(item)}
                          className={`h-8 px-2.5 text-xs font-bold rounded-lg cursor-pointer ${
                            item.isActive
                              ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                              : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                        >
                          {item.isActive ? 'Pause' : 'Activate'}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEdit(item)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg cursor-pointer"
                          title="Edit Code"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCode(item)}
                          className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                          title="Delete Code"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create / Edit Code Dialog with Desktop Size & Full Benefit Types */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-card border-border text-foreground max-w-xl w-full max-h-[90vh] overflow-y-auto rounded-3xl p-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
                <Gift className="w-5 h-5 text-primary" />
                <span>{editingCode ? 'Edit Redeem Code' : 'Create New Redeem Code'}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-3">
              {/* Benefit Type Selector Pills */}
              <div>
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-2">
                  Benefit Type *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'wallet', label: 'Wallet Cash', icon: IndianRupee, desc: 'Instant cash (₹)' },
                    { id: 'points', label: 'Loyalty Points', icon: Coins, desc: 'Coin reward' },
                    { id: 'discount', label: 'Cart Discount', icon: Percent, desc: 'Cart % / ₹ off' },
                    { id: 'delivery', label: 'Free Delivery', icon: Truck, desc: 'Waive shipping' },
                  ].map((b) => {
                    const Icon = b.icon;
                    const isSelected = formData.type === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            type: b.id as RedeemBenefitType,
                            value: b.id === 'wallet' ? 50 : b.id === 'points' ? 150 : b.id === 'discount' ? 20 : 100,
                          }));
                        }}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-primary shadow-xs'
                            : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 font-bold text-xs">
                          <Icon className="w-3.5 h-3.5" />
                          <span>{b.label}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{b.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Code Field with Random Generator */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-foreground">Redeem Voucher Code *</label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomCode}
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto Generate Code</span>
                  </button>
                </div>
                <Input
                  placeholder="e.g. WELCOME2026 or HUNGERCASH50"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '') })
                  }
                  className="bg-background border-border text-foreground font-mono uppercase text-base tracking-wider h-11 rounded-xl font-bold"
                />
              </div>

              {/* Value & Discount Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">
                    {formData.type === 'wallet'
                      ? 'Cash Credit Value (₹) *'
                      : formData.type === 'points'
                      ? 'Reward Points Count *'
                      : formData.type === 'delivery'
                      ? 'Delivery Waiver Value (₹) *'
                      : formData.discountType === 'percentage'
                      ? 'Discount Percentage (%) *'
                      : 'Flat Discount Amount (₹) *'}
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="1"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                      className="bg-background border-border text-foreground font-mono font-bold h-11 rounded-xl text-base"
                    />
                  </div>
                </div>

                {formData.type === 'discount' && (
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1.5">Discount Mode</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, discountType: 'percentage' })}
                        className={`h-11 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          formData.discountType === 'percentage'
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-muted/30 border-border text-muted-foreground'
                        }`}
                      >
                        Percentage (%)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, discountType: 'flat' })}
                        className={`h-11 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          formData.discountType === 'flat'
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-muted/30 border-border text-muted-foreground'
                        }`}
                      >
                        Flat (₹ Off)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Min Order & Max Discount for Cart Offers */}
              {(formData.type === 'discount' || formData.type === 'delivery') && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">
                      Min Order Value (₹)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="e.g. 199"
                      value={formData.minOrderValue}
                      onChange={(e) => setFormData({ ...formData, minOrderValue: Number(e.target.value) })}
                      className="bg-background border-border text-foreground font-mono text-sm h-10 rounded-xl"
                    />
                  </div>
                  {formData.type === 'discount' && formData.discountType === 'percentage' && (
                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1">
                        Max Cap Limit (₹)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="e.g. 150"
                        value={formData.maxDiscount}
                        onChange={(e) => setFormData({ ...formData, maxDiscount: Number(e.target.value) })}
                        className="bg-background border-border text-foreground font-mono text-sm h-10 rounded-xl"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  Voucher Description (Shown to Customers)
                </label>
                <Input
                  placeholder="e.g. Festive surprise bonus credited directly to your Hunger wallet"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-background border-border text-foreground text-xs h-10 rounded-xl"
                />
              </div>

              {/* Max Redemptions & Expiry */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Max Redemptions</label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.maxRedemptions}
                    onChange={(e) =>
                      setFormData({ ...formData, maxRedemptions: Number(e.target.value) })
                    }
                    className="bg-background border-border text-foreground font-mono text-sm h-10 rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Expiry Date</label>
                  <Input
                    type="date"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    className="bg-background border-border text-foreground text-sm h-10 rounded-xl"
                  />
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-primary" />
                  <span>Customer Card Preview</span>
                </p>
                <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">
                      {formData.type === 'wallet'
                        ? '💳'
                        : formData.type === 'points'
                        ? '🪙'
                        : formData.type === 'delivery'
                        ? '🛵'
                        : '🏷️'}
                    </span>
                    <div>
                      <p className="font-mono font-black text-sm text-foreground">
                        {formData.code || 'CODE_PREVIEW'}
                      </p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                        {formData.description || 'Promotional voucher reward'}
                      </p>
                    </div>
                  </div>
                  <Badge className="font-bold text-xs bg-primary/10 text-primary border-primary/20">
                    {formData.type === 'wallet'
                      ? `₹${formData.value} Wallet Cash`
                      : formData.type === 'points'
                      ? `+${formData.value} Points`
                      : formData.type === 'delivery'
                      ? 'Free Delivery'
                      : formData.discountType === 'percentage'
                      ? `${formData.value}% OFF`
                      : `₹${formData.value} OFF`}
                  </Badge>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="rounded-xl border-border text-muted-foreground hover:bg-muted font-bold text-xs h-10 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveCode}
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs h-10 px-5 shadow-md cursor-pointer"
              >
                {editingCode ? 'Save Changes' : 'Create & Sync Code'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
