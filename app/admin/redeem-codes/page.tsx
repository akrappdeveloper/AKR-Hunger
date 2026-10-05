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
  Percent
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
  serverTimestamp,
} from 'firebase/firestore';
import type { RedeemCodeItem } from '@/lib/types';

// Starter codes for 1-click seeding
const STARTER_REDEEM_CODES: Omit<RedeemCodeItem, 'id'>[] = [
  {
    code: 'WELCOME2026',
    type: 'points',
    value: 250,
    description: 'Welcome loyalty reward bonus for new mobile app foodies.',
    maxRedemptions: 1000,
    redemptionCount: 0,
    isActive: true,
    expiresAt: '2026-12-31',
  },
  {
    code: 'FESTIVE100',
    type: 'points',
    value: 100,
    description: 'Festive season free points voucher. Instant 100 points.',
    maxRedemptions: 500,
    redemptionCount: 0,
    isActive: true,
    expiresAt: '2026-12-31',
  },
  {
    code: 'VIPGIFT500',
    type: 'points',
    value: 500,
    description: 'Exclusive VIP Gold tier reward gift code.',
    maxRedemptions: 200,
    redemptionCount: 0,
    isActive: true,
    expiresAt: '2026-12-31',
  },
  {
    code: 'HUNGERCASH50',
    type: 'wallet',
    value: 50,
    description: 'Special ₹50 wallet credit gift voucher.',
    maxRedemptions: 300,
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
  const [selectedType, setSelectedType] = useState('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<RedeemCodeItem | null>(null);
  const [formData, setFormData] = useState<{
    code: string;
    type: 'points' | 'wallet' | 'discount';
    value: number;
    description: string;
    maxRedemptions: number;
    expiresAt: string;
    isActive: boolean;
  }>({
    code: '',
    type: 'points',
    value: 100,
    description: '',
    maxRedemptions: 500,
    expiresAt: '2026-12-31',
    isActive: true,
  });

  // Listen to Firebase Realtime Database (/redeem_codes)
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      const codeRef = rtdbRef(realtimeDb, 'redeem_codes');
      unsubscribe = onValue(
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
          console.error('Error fetching redeem codes:', error);
          setIsLiveConnected(false);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error('Failed to attach redeem_codes listener:', err);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast({
      title: 'Code Copied!',
      description: `Redeem code ${code} copied to clipboard.`,
    });
  };

  const handleGenerateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const prefix = formData.type === 'wallet' ? 'CASH' : 'GIFT';
    setFormData((prev) => ({ ...prev, code: `${prefix}${randomPart}` }));
  };

  const handleOpenCreate = () => {
    setEditingCode(null);
    setFormData({
      code: '',
      type: 'points',
      value: 150,
      description: '',
      maxRedemptions: 500,
      expiresAt: '2026-12-31',
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (item: RedeemCodeItem) => {
    setEditingCode(item);
    setFormData({
      code: item.code,
      type: item.type,
      value: item.value,
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
        value: Number(formData.value),
        description: formData.description.trim(),
        maxRedemptions: Number(formData.maxRedemptions),
        redemptionCount: editingCode?.redemptionCount || 0,
        expiresAt: formData.expiresAt,
        isActive: formData.isActive,
        createdAt: editingCode?.createdAt || new Date().toISOString(),
      };

      // 1. Save to Realtime Database (/redeem_codes/codeId)
      await rtdbSet(rtdbRef(realtimeDb, `redeem_codes/${codeId}`), payload);

      // 2. Also save to Firestore (/redeemCodes/codeId)
      await setDoc(doc(db, 'redeemCodes', codeId), {
        ...payload,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      toast({
        title: editingCode ? 'Code Updated! ✨' : 'Redeem Code Created! 🎁',
        description: `Code "${codeUpper}" is now active in Firebase and redeemable in Android App.`,
      });

      setIsDialogOpen(false);
    } catch (err: any) {
      console.error('Failed to save redeem code:', err);
      toast({
        title: 'Save Failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (item: RedeemCodeItem) => {
    try {
      const updatedStatus = !item.isActive;
      // 1. RTDB
      await rtdbUpdate(rtdbRef(realtimeDb, `redeem_codes/${item.id}`), {
        isActive: updatedStatus,
      });

      // 2. Firestore
      await updateDoc(doc(db, 'redeemCodes', item.id), {
        isActive: updatedStatus,
      }).catch(() => {});

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
      await rtdbRemove(rtdbRef(realtimeDb, `redeem_codes/${item.id}`));
      // 2. Firestore
      await deleteDoc(doc(db, 'redeemCodes', item.id)).catch(() => {});

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
        await rtdbSet(rtdbRef(realtimeDb, `redeem_codes/${codeId}`), payload);
        await setDoc(doc(db, 'redeemCodes', codeId), payload, { merge: true });
      }
      toast({
        title: 'Starter Codes Seeded! 🎉',
        description: `${STARTER_REDEEM_CODES.length} redeem codes added to Firebase.`,
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

  // Filtered
  const filteredCodes = codes.filter((item) => {
    const matchType = selectedType === 'all' || item.type === selectedType;
    const matchSearch =
      searchQuery === '' ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchType && matchSearch;
  });

  const totalCodes = codes.length;
  const activeCodes = codes.filter((c) => c.isActive).length;
  const totalRedemptions = codes.reduce((acc, c) => acc + (c.redemptionCount || 0), 0);
  const totalPointsValue = codes
    .filter((c) => c.type === 'points')
    .reduce((acc, c) => acc + c.value, 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">Redeem Codes & Vouchers</h1>
                <Badge
                  variant="outline"
                  className={
                    isLiveConnected
                      ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                      : 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10'
                  }
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
                  {isLiveConnected ? 'Live Realtime DB' : 'Connecting...'}
                </Badge>
              </div>
              <p className="text-sm text-gray-400">
                Generate redeemable vouchers synced with Android App RewardsActivity & Web
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {codes.length === 0 && !loading && (
            <Button
              variant="outline"
              onClick={handleSeedStarterCodes}
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Seed 4 Gift Codes
            </Button>
          )}

          <Button
            onClick={handleOpenCreate}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/25"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Redeem Code
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total Codes</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{totalCodes}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Active Codes</p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-0.5">{activeCodes}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Times Redeemed</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{totalRedemptions}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Points Pool</p>
              <h3 className="text-2xl font-bold text-cyan-400 mt-0.5">{totalPointsValue} pts</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search code (e.g. WELCOME2026, FESTIVE)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-black/40 border-white/10 text-white placeholder:text-gray-500 rounded-xl"
          />
        </div>

        <div className="flex items-center gap-2">
          {[
            { id: 'all', label: 'All Vouchers' },
            { id: 'points', label: '🪙 Reward Points' },
            { id: 'wallet', label: '💳 Wallet Cash' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedType(item.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedType === item.id
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Codes Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-gray-400">
          <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mb-3" />
          <p>Syncing redeem codes from Firebase Realtime Database...</p>
        </div>
      ) : filteredCodes.length === 0 ? (
        <Card className="bg-white/5 border-white/10 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 mx-auto flex items-center justify-center text-3xl mb-4">
            🎁
          </div>
          <h3 className="text-lg font-bold text-white mb-1">No Redeem Codes</h3>
          <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
            {codes.length === 0
              ? 'No redeem codes created yet. Click "Seed 4 Gift Codes" to add starter loyalty and cash codes.'
              : 'No redeem codes match your current search.'}
          </p>
          {codes.length === 0 ? (
            <Button
              onClick={handleSeedStarterCodes}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Seed 4 Gift Codes
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setSelectedType('all');
              }}
              className="border-white/10 text-white hover:bg-white/10"
            >
              Clear Filter
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCodes.map((item) => {
            const isPoints = item.type === 'points';
            const valueBadge = isPoints ? `+${item.value} PTS` : `₹${item.value} WALLET`;

            return (
              <Card
                key={item.id}
                className="bg-white/5 border-white/10 hover:border-amber-500/30 transition-all duration-300 rounded-2xl overflow-hidden backdrop-blur-xl group flex flex-col justify-between"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl flex-shrink-0">
                        {isPoints ? '🪙' : '💳'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold text-white group-hover:text-amber-400 transition-colors font-mono tracking-wider">
                            {item.code}
                          </CardTitle>
                          <button
                            onClick={() => handleCopy(item.code)}
                            className="text-gray-400 hover:text-white"
                            title="Copy code"
                          >
                            {copiedCode === item.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                          {item.description || 'Promotional gift voucher code'}
                        </p>
                      </div>
                    </div>

                    <Badge
                      className={
                        item.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }
                    >
                      {item.isActive ? 'Active' : 'Paused'}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                      {valueBadge}
                    </Badge>
                    <Badge variant="outline" className="border-white/10 text-gray-300 text-[11px]">
                      {item.redemptionCount || 0} / {item.maxRedemptions || '∞'} Uses
                    </Badge>
                    {item.expiresAt ? (
                      <Badge variant="outline" className="border-white/10 text-gray-300 text-[11px]">
                        Exp: {item.expiresAt}
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0">
                  <div className="border-t border-white/5 my-3" />

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-400">
                      Redeemable in Android & Web
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleActive(item)}
                        className={`h-8 px-2.5 text-xs ${
                          item.isActive
                            ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10'
                            : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                        }`}
                      >
                        {item.isActive ? 'Pause' : 'Activate'}
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEdit(item)}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-white/10"
                        title="Edit Code"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteCode(item)}
                        className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
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

      {/* Add / Edit Code Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-gray-950 border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-500" />
              {editingCode ? 'Edit Redeem Code' : 'Generate New Redeem Code'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Code Field with Random Generator */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Redeem Code *
                </label>
                <button
                  type="button"
                  onClick={handleGenerateRandomCode}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium"
                >
                  <Sparkles className="w-3 h-3" />
                  Generate Random
                </button>
              </div>
              <Input
                placeholder="e.g. WELCOME2026"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value.toUpperCase() })
                }
                className="bg-black/40 border-white/10 text-white font-mono uppercase text-base tracking-wider"
              />
            </div>

            {/* Type & Value */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                  Benefit Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e: any) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="points">Reward Points (Loyalty)</option>
                  <option value="wallet">Wallet Cash (₹)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                  Value {formData.type === 'points' ? '(Points)' : '(₹)'}
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formData.value}
                  onChange={(e) =>
                    setFormData({ ...formData, value: Number(e.target.value) })
                  }
                  className="bg-black/40 border-white/10 text-white"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                Description / Purpose
              </label>
              <Input
                placeholder="e.g. Festive season surprise gift for all active customers"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-black/40 border-white/10 text-white"
              />
            </div>

            {/* Max Redemptions & Expiry */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                  Max Redemptions
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formData.maxRedemptions}
                  onChange={(e) =>
                    setFormData({ ...formData, maxRedemptions: Number(e.target.value) })
                  }
                  className="bg-black/40 border-white/10 text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                  Expiry Date
                </label>
                <Input
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) =>
                    setFormData({ ...formData, expiresAt: e.target.value })
                  }
                  className="bg-black/40 border-white/10 text-white"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="border-white/10 text-gray-300 hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCode}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {editingCode ? 'Save Changes' : 'Create & Sync Code'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
