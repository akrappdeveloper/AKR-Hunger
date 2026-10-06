'use client';

import React, { useState, useEffect } from 'react';
import {
  Tag,
  Plus,
  Search,
  Edit2,
  Trash2,
  Copy,
  Check,
  Percent,
  Sparkles,
  Zap,
  Flame,
  Gift,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Truck,
  DollarSign
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
import type { DealItem } from '@/lib/types';

// Curated starter deals for quick seeding
const STARTER_DEALS: Omit<DealItem, 'id'>[] = [
  {
    code: 'WELCOME50',
    title: '50% OFF on First Order',
    description: 'New user exclusive feast! Enjoy flat 50% off up to ₹120 on your first order.',
    emoji: '🎉',
    discountType: 'percentage',
    discountValue: 50,
    minOrder: 199,
    maxDiscount: 120,
    category: 'percentage',
    isActive: true,
    validUntil: '2026-12-31',
  },
  {
    code: 'FREEDEL',
    title: '100% Free Delivery',
    description: 'Zero delivery charges on all meals today. No minimum order value!',
    emoji: '🛵',
    discountType: 'free_delivery',
    discountValue: 0,
    minOrder: 0,
    maxDiscount: 50,
    category: 'delivery',
    isActive: true,
    validUntil: '2026-12-31',
  },
  {
    code: 'FLAT100',
    title: 'Flat ₹100 Off on ₹499+',
    description: 'Instant flat ₹100 discount on hearty family orders across top spots.',
    emoji: '💸',
    discountType: 'flat',
    discountValue: 100,
    minOrder: 499,
    maxDiscount: 100,
    category: 'flat',
    isActive: true,
    validUntil: '2026-12-31',
  },
  {
    code: 'BIRYANI25',
    title: '25% Off Biryani Bonanza',
    description: 'Authentic dum biryani, kebabs, and gravies with 25% off up to ₹150.',
    emoji: '🍲',
    discountType: 'percentage',
    discountValue: 25,
    minOrder: 299,
    maxDiscount: 150,
    category: 'biryani',
    isActive: true,
    validUntil: '2026-12-31',
  },
  {
    code: 'MIDNIGHT20',
    title: 'Late Night Craving 20% Off',
    description: 'Late night cravings sorted! 20% off on orders placed 10 PM to 3 AM.',
    emoji: '🌙',
    discountType: 'percentage',
    discountValue: 20,
    minOrder: 249,
    maxDiscount: 100,
    category: 'latenight',
    isActive: true,
    validUntil: '2026-12-31',
  },
];

export default function AdminDealsPage() {
  const { toast } = useToast();
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DealItem | null>(null);
  const [formData, setFormData] = useState<{
    code: string;
    title: string;
    description: string;
    emoji: string;
    discountType: 'percentage' | 'flat' | 'free_delivery';
    discountValue: number;
    minOrder: number;
    maxDiscount: number;
    category: string;
    validUntil: string;
    isActive: boolean;
  }>({
    code: '',
    title: '',
    description: '',
    emoji: '🎫',
    discountType: 'percentage',
    discountValue: 20,
    minOrder: 199,
    maxDiscount: 100,
    category: 'all',
    validUntil: '2026-12-31',
    isActive: true,
  });

  // Listen to Firebase Realtime Database (/deals)
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      const dealsRef = rtdbRef(realtimeDb, 'deals');
      unsubscribe = onValue(
        dealsRef,
        (snapshot) => {
          setIsLiveConnected(true);
          setLoading(false);
          if (snapshot.exists()) {
            const data = snapshot.val();
            const dealsArray: DealItem[] = Object.keys(data).map((key) => ({
              id: key,
              ...data[key],
            }));
            setDeals(dealsArray);
          } else {
            setDeals([]);
          }
        },
        (error) => {
          console.error('Error fetching deals from RTDB:', error);
          setIsLiveConnected(false);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error('Failed to attach RTDB listener:', err);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Handle Copy
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast({
      title: 'Code Copied!',
      description: `Promo code ${code} copied to clipboard.`,
    });
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingDeal(null);
    setFormData({
      code: '',
      title: '',
      description: '',
      emoji: '🎫',
      discountType: 'percentage',
      discountValue: 20,
      minOrder: 199,
      maxDiscount: 100,
      category: 'all',
      validUntil: '2026-12-31',
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (deal: DealItem) => {
    setEditingDeal(deal);
    setFormData({
      code: deal.code,
      title: deal.title,
      description: deal.description || '',
      emoji: deal.emoji || '🎫',
      discountType: (deal.discountType === 'fixed' ? 'flat' : deal.discountType) || 'percentage',
      discountValue: deal.discountValue || 0,
      minOrder: deal.minOrder || 0,
      maxDiscount: deal.maxDiscount || 0,
      category: deal.category || 'all',
      validUntil: deal.validUntil || '2026-12-31',
      isActive: deal.isActive,
    });
    setIsDialogOpen(true);
  };

  // Save / Update Deal in RTDB & Firestore
  const handleSaveDeal = async () => {
    if (!formData.code.trim() || !formData.title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Promo code and title are required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const codeUpper = formData.code.trim().toUpperCase();
      const dealId = editingDeal ? editingDeal.id : `deal_${Date.now()}`;

      const payload: DealItem = {
        id: dealId,
        code: codeUpper,
        title: formData.title.trim(),
        description: formData.description.trim(),
        emoji: formData.emoji.trim() || '🎫',
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        minOrder: Number(formData.minOrder),
        maxDiscount: Number(formData.maxDiscount),
        category: formData.category,
        validUntil: formData.validUntil,
        isActive: formData.isActive,
        createdAt: editingDeal?.createdAt || new Date().toISOString(),
      };

      // 1. Save to Firebase Realtime Database (/deals/dealId)
      const rtdbTarget = rtdbRef(realtimeDb, `deals/${dealId}`);
      await rtdbSet(rtdbTarget, payload);

      // 2. Also save to Firestore (/promotions/dealId) so web checkout & reports match
      await setDoc(doc(db, 'promotions', dealId), {
        code: codeUpper,
        title: payload.title,
        description: payload.description,
        emoji: payload.emoji,
        type: payload.discountType,
        value: payload.discountValue,
        minOrderAmount: payload.minOrder,
        maxDiscount: payload.maxDiscount,
        category: payload.category,
        isActive: payload.isActive,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      toast({
        title: editingDeal ? 'Deal Updated! ✨' : 'Deal Created! 🎉',
        description: `Deal "${payload.title}" is now synced live with the Android App and Web.`,
      });

      setIsDialogOpen(false);
    } catch (err: any) {
      console.error('Failed to save deal:', err);
      toast({
        title: 'Error Saving Deal',
        description: err.message || 'Could not save deal to Firebase.',
        variant: 'destructive',
      });
    }
  };

  // Toggle Active Status
  const handleToggleActive = async (deal: DealItem) => {
    try {
      const updatedStatus = !deal.isActive;
      // 1. Update in RTDB
      await rtdbUpdate(rtdbRef(realtimeDb, `deals/${deal.id}`), {
        isActive: updatedStatus,
      });

      // 2. Update in Firestore
      await updateDoc(doc(db, 'promotions', deal.id), {
        isActive: updatedStatus,
      }).catch(() => {});

      toast({
        title: updatedStatus ? 'Deal Activated' : 'Deal Deactivated',
        description: `${deal.code} is now ${updatedStatus ? 'active' : 'inactive'}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Update Failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Delete Deal
  const handleDeleteDeal = async (deal: DealItem) => {
    if (!confirm(`Are you sure you want to delete deal "${deal.code}"?`)) return;

    try {
      // 1. Delete from RTDB
      await rtdbRemove(rtdbRef(realtimeDb, `deals/${deal.id}`));

      // 2. Delete from Firestore
      await deleteDoc(doc(db, 'promotions', deal.id)).catch(() => {});

      toast({
        title: 'Deal Deleted',
        description: `Deal ${deal.code} has been permanently deleted.`,
      });
    } catch (err: any) {
      toast({
        title: 'Deletion Failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Seed default deals if empty
  const handleSeedStarterDeals = async () => {
    try {
      setLoading(true);
      for (const starter of STARTER_DEALS) {
        const dealId = `deal_${starter.code.toLowerCase()}`;
        const payload = {
          ...starter,
          id: dealId,
          createdAt: new Date().toISOString(),
        };
        await rtdbSet(rtdbRef(realtimeDb, `deals/${dealId}`), payload);
        await setDoc(doc(db, 'promotions', dealId), {
          ...payload,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      toast({
        title: 'Starter Deals Seeded! 🚀',
        description: `${STARTER_DEALS.length} popular curated deals are now live in Firebase.`,
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

  // Filtered Deals
  const filteredDeals = deals.filter((deal) => {
    const matchCategory =
      selectedCategory === 'all' || deal.category === selectedCategory || deal.discountType === selectedCategory;
    const matchSearch =
      searchQuery === '' ||
      deal.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const totalDeals = deals.length;
  const activeDeals = deals.filter((d) => d.isActive).length;
  const freeDelDeals = deals.filter((d) => d.discountType === 'free_delivery').length;
  const flatDeals = deals.filter((d) => d.discountType === 'flat').length;

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Tag className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">Deals & Offers Management</h1>
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
                Create and manage coupons live synced with Android App DealsActivity & Web
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {deals.length === 0 && !loading && (
            <Button
              variant="outline"
              onClick={handleSeedStarterDeals}
              className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Seed Top Deals
            </Button>
          )}

          <Button
            onClick={handleOpenCreate}
            className="bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white shadow-lg shadow-orange-500/25"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Deal
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total Deals</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{totalDeals}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Active Deals</p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-0.5">{activeDeals}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Free Delivery</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{freeDelDeals}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Flat ₹ Off</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{flatDeals}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search deals by code, title, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-black/40 border-white/10 text-white placeholder:text-gray-500 rounded-xl"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: '🔥 All Deals' },
            { id: 'percentage', label: '🏷️ % Off' },
            { id: 'flat', label: '💸 Flat Off' },
            { id: 'delivery', label: '🛵 Free Del' },
            { id: 'biryani', label: '🍲 Biryani' },
            { id: 'latenight', label: '🌙 Late Night' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Deals Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-gray-400">
          <RefreshCw className="w-8 h-8 animate-spin text-orange-500 mb-3" />
          <p>Syncing deals from Firebase Realtime Database...</p>
        </div>
      ) : filteredDeals.length === 0 ? (
        <Card className="bg-white/5 border-white/10 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 mx-auto flex items-center justify-center text-3xl mb-4">
            🎟️
          </div>
          <h3 className="text-lg font-bold text-white mb-1">No Deals Found</h3>
          <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
            {deals.length === 0
              ? 'No deals currently active in Firebase. Click "Seed Top Deals" to quickly populate curated offers.'
              : 'No deals match your current search or category filter. Try clearing filters.'}
          </p>
          {deals.length === 0 ? (
            <Button
              onClick={handleSeedStarterDeals}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Seed 5 Top Deals Now
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="border-white/10 text-white hover:bg-white/10"
            >
              Reset Filters
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDeals.map((deal) => {
            const isPercent = deal.discountType === 'percentage';
            const isFreeDel = deal.discountType === 'free_delivery';
            const badgeText = isFreeDel
              ? 'FREE DELIVERY'
              : isPercent
              ? `${deal.discountValue}% OFF`
              : `FLAT ₹${deal.discountValue} OFF`;

            return (
              <Card
                key={deal.id}
                className="bg-white/5 border-white/10 hover:border-orange-500/30 transition-all duration-300 rounded-2xl overflow-hidden backdrop-blur-xl group flex flex-col justify-between"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-2xl flex-shrink-0">
                        {deal.emoji || '🎫'}
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-white group-hover:text-orange-400 transition-colors line-clamp-1">
                          {deal.title}
                        </CardTitle>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                          {deal.description}
                        </p>
                      </div>
                    </div>

                    <Badge
                      className={
                        deal.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }
                    >
                      {deal.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <Badge className="bg-orange-500/10 text-orange-400 border border-orange-500/20 font-bold">
                      {badgeText}
                    </Badge>
                    {deal.minOrder ? (
                      <Badge variant="outline" className="border-white/10 text-gray-300 text-[11px]">
                        Min ₹{deal.minOrder}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-white/10 text-gray-300 text-[11px]">
                        No Min Order
                      </Badge>
                    )}
                    {deal.maxDiscount ? (
                      <Badge variant="outline" className="border-white/10 text-gray-300 text-[11px]">
                        Max ₹{deal.maxDiscount}
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0">
                  <div className="border-t border-white/5 my-3" />

                  {/* Code Box & Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 font-mono font-bold text-xs tracking-wider">
                      <span>{deal.code}</span>
                      <button
                        onClick={() => handleCopy(deal.code)}
                        className="hover:text-white transition-colors"
                        title="Copy Code"
                      >
                        {copiedCode === deal.code ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleActive(deal)}
                        className={`h-8 px-2.5 text-xs ${
                          deal.isActive
                            ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10'
                            : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                        }`}
                        title={deal.isActive ? 'Deactivate Deal' : 'Activate Deal'}
                      >
                        {deal.isActive ? 'Pause' : 'Activate'}
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEdit(deal)}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-white/10"
                        title="Edit Deal"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteDeal(deal)}
                        className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        title="Delete Deal"
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

      {/* Add / Edit Deal Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-gray-950 border-white/10 text-white max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Tag className="w-5 h-5 text-orange-500" />
              {editingDeal ? 'Edit Promo Deal' : 'Create New Deal'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3">
            {/* Promo Code */}
            <div>
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                Coupon Code *
              </label>
              <Input
                placeholder="e.g. HUNGER50"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value.toUpperCase() })
                }
                className="bg-black/40 border-white/10 text-white font-mono uppercase"
              />
            </div>

            {/* Emoji */}
            <div>
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                Emoji Icon
              </label>
              <Input
                placeholder="e.g. 🎉, 🍕, 🛵"
                value={formData.emoji}
                onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                className="bg-black/40 border-white/10 text-white"
              />
            </div>

            {/* Title */}
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                Offer Title *
              </label>
              <Input
                placeholder="e.g. 50% OFF on First Order"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="bg-black/40 border-white/10 text-white"
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                Description
              </label>
              <Input
                placeholder="e.g. New user exclusive! Save flat 50% up to ₹120."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-black/40 border-white/10 text-white"
              />
            </div>

            {/* Discount Type */}
            <div>
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                Discount Type
              </label>
              <select
                value={formData.discountType}
                onChange={(e: any) =>
                  setFormData({ ...formData, discountType: e.target.value })
                }
                className="w-full h-10 px-3 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500"
              >
                <option value="percentage">Percentage Discount (%)</option>
                <option value="flat">Flat Amount (₹)</option>
                <option value="free_delivery">Free Delivery</option>
              </select>
            </div>

            {/* Discount Value */}
            <div>
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                Discount Value {formData.discountType === 'percentage' ? '(%)' : '(₹)'}
              </label>
              <Input
                type="number"
                min="0"
                value={formData.discountValue}
                onChange={(e) =>
                  setFormData({ ...formData, discountValue: Number(e.target.value) })
                }
                className="bg-black/40 border-white/10 text-white"
                disabled={formData.discountType === 'free_delivery'}
              />
            </div>

            {/* Minimum Order */}
            <div>
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                Min Order Amount (₹)
              </label>
              <Input
                type="number"
                min="0"
                value={formData.minOrder}
                onChange={(e) =>
                  setFormData({ ...formData, minOrder: Number(e.target.value) })
                }
                className="bg-black/40 border-white/10 text-white"
              />
            </div>

            {/* Max Discount */}
            <div>
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                Max Discount Cap (₹)
              </label>
              <Input
                type="number"
                min="0"
                value={formData.maxDiscount}
                onChange={(e) =>
                  setFormData({ ...formData, maxDiscount: Number(e.target.value) })
                }
                className="bg-black/40 border-white/10 text-white"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500"
              >
                <option value="all">General / All</option>
                <option value="percentage">Percentage Deal</option>
                <option value="flat">Flat Discount</option>
                <option value="delivery">Free Delivery</option>
                <option value="biryani">Biryani Fest</option>
                <option value="latenight">Late Night</option>
              </select>
            </div>

            {/* Expiry Date */}
            <div>
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                Valid Until
              </label>
              <Input
                type="date"
                value={formData.validUntil}
                onChange={(e) =>
                  setFormData({ ...formData, validUntil: e.target.value })
                }
                className="bg-black/40 border-white/10 text-white"
              />
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
              onClick={handleSaveDeal}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {editingDeal ? 'Save Changes' : 'Create & Sync Deal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
