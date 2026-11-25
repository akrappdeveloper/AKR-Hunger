'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, BookOpen, Moon, Users, Wallet,
  Star, Clock, ChevronRight, Tag, Zap, Shield,
  CheckCircle2, ShoppingCart, Store, ArrowLeft,
  Sparkles, Check, School, Upload, FileText, ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import FullscreenToggle from '@/components/customer/FullscreenToggle';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { db } from '@/lib/firebase';
import {
  collection, doc, updateDoc, setDoc, onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { MenuItem, Restaurant, CartItem } from '@/lib/types';
import Link from 'next/link';
import { toast } from 'sonner';

const WEEKLY_OFFERS = [
  { day: 'Mon', offer: '20% off on all veg meals', emoji: '🌱', code: 'STUDENTMON20' },
  { day: 'Tue', offer: 'Buy 2 get 1 free drinks', emoji: '🥤', code: 'STUDENTB2G1' },
  { day: 'Wed', offer: 'Free delivery on ₹99+ orders', emoji: '🛵', code: 'STUDENTDELFREE' },
  { day: 'Thu', offer: 'Flat ₹30 off on biryani', emoji: '🍲', code: 'STUDENTBIRY30' },
  { day: 'Fri', offer: 'Late night 25% off (10PM–2AM)', emoji: '🌙', code: 'STUDENTNIGHT25' },
  { day: 'Sat', offer: 'Group order bonus 100 loyalty pts', emoji: '👥', code: 'STUDENTGROUP100' },
  { day: 'Sun', offer: 'Brunch special ₹99 combos', emoji: '☕', code: 'STUDENTBRUNCH99' },
];

export default function StudentModePage({ isStudentVerified }: { isStudentVerified?: boolean } = {}) {
  const { user, customer } = useAuth();
  const { addItem } = useCart();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedBudgetTier, setSelectedBudgetTier] = useState<number>(149);
  const [activeDay, setActiveDay] = useState(new Date().getDay());
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [collegeName, setCollegeName] = useState('');
  const [studentIdInput, setStudentIdInput] = useState('');
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [addedItemIds, setAddedItemIds] = useState<Set<string>>(new Set());

  // Real student verification state from Firestore customer doc
  const studentData = (customer as any)?.studentVerification;
  const isVerified = Boolean(studentData?.isVerified);

  // Sync real restaurants & menu items from Firestore
  useEffect(() => {
    const unsubR = onSnapshot(collection(db, 'restaurants'), snap => {
      setRestaurants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Restaurant)));
    });
    const unsubM = onSnapshot(collection(db, 'menuItems'), snap => {
      setMenuItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as MenuItem)).filter(m => m.available !== false));
    });
    return () => {
      unsubR();
      unsubM();
    };
  }, []);

  // Filter budget dishes from Firestore
  const budgetDishes = useMemo(() => {
    return menuItems
      .filter(item => item.price <= selectedBudgetTier)
      .sort((a, b) => (b.averageRating || 4.5) - (a.averageRating || 4.5))
      .slice(0, 16);
  }, [menuItems, selectedBudgetTier]);

  // Handle student ID verification save to Firestore
  const handleVerifyStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please log in first to verify your student status');
      return;
    }
    if (!collegeName.trim() || !studentIdInput.trim()) {
      toast.error('Please enter your college name and student roll number');
      return;
    }

    setSubmittingVerification(true);
    try {
      const custRef = doc(db, 'customers', user.uid);
      const studentPayload = {
        isVerified: true,
        college: collegeName.trim(),
        studentId: studentIdInput.trim(),
        verifiedAt: Timestamp.now(),
        discountPercent: 15,
      };

      await updateDoc(custRef, {
        studentVerification: studentPayload,
        updatedAt: Timestamp.now(),
      });

      // Also create a student discount coupon in Firestore 'promotions' collection
      const promoRef = doc(db, 'promotions', 'STUDENT15');
      const validUntil = new Date();
      validUntil.setFullYear(validUntil.getFullYear() + 1);

      await setDoc(promoRef, {
        code: 'STUDENT15',
        title: 'Student Mode Special 15% OFF',
        description: 'Verified student discount up to ₹100 on orders ₹149+',
        discountType: 'percentage',
        discountValue: 15,
        minOrderAmount: 149,
        maxDiscount: 100,
        isActive: true,
        validFrom: Timestamp.now(),
        validUntil: Timestamp.fromDate(validUntil),
        createdAt: Timestamp.now(),
      }, { merge: true });

      toast.success('🎓 Student Verification Successful! 15% discount unlocked on all orders.');
      setIsVerifyModalOpen(false);
    } catch (err: any) {
      console.error('Error verifying student:', err);
      toast.error('Verification failed: ' + err.message);
    } finally {
      setSubmittingVerification(false);
    }
  };

  // Add budget dish to cart
  const handleAddToCart = (dish: MenuItem) => {
    const parentRest = restaurants.find(r => r.id === dish.restaurantId);
    const cartItem: CartItem = {
      id: `${dish.id}-${Date.now()}`,
      menuItemId: dish.id,
      restaurantId: dish.restaurantId || 'campus-kitchen',
      name: dish.name,
      price: dish.price,
      quantity: 1,
      image: dish.image || (dish.images && dish.images[0]) || '',
      restaurantName: parentRest?.name || (dish as any).restaurantName || 'Campus Eatery',
      addedAt: new Date(),
    };
    addItem(cartItem);
    setAddedItemIds(prev => new Set(prev).add(dish.id));
    toast.success(`Added "${dish.name}" to cart! 🎓`);
    setTimeout(() => {
      setAddedItemIds(prev => {
        const next = new Set(prev);
        next.delete(dish.id);
        return next;
      });
    }, 2500);
  };

  const todayOffer = WEEKLY_OFFERS[activeDay === 0 ? 6 : activeDay - 1];

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Full-width Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/70 px-4 sm:px-6 lg:px-8 py-3.5 shadow-xs">
        <div className="w-full max-w-[1700px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/customer">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2 tracking-tight">
                <GraduationCap className="w-6 h-6 text-blue-500" />
                Hunger Campus &amp; Student Mode
              </h1>
              <p className="text-xs text-muted-foreground">
                Affordable hostel meals, verified student discounts &amp; budget feeds
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isVerified && (
              <Button
                size="sm"
                onClick={() => setIsVerifyModalOpen(true)}
                className="rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-md shadow-blue-500/20"
              >
                <Shield className="w-3.5 h-3.5" /> Verify Student ID
              </Button>
            )}
            <FullscreenToggle className="border border-border/80 rounded-xl" showText={false} />
          </div>
        </div>
      </div>

      {/* Main Full-Width Container */}
      <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-8">
        
        {/* Full-Width Campus Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-800 text-white p-6 sm:p-10 shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="absolute top-4 right-8 text-9xl opacity-10 select-none pointer-events-none hidden md:block">🎓</div>

          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-white/20 text-white border-none px-3 py-1 text-xs uppercase tracking-wider backdrop-blur-md">
                Campus Perks
              </Badge>
              {isVerified ? (
                <Badge className="bg-emerald-500/30 text-emerald-200 border-emerald-400/40 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-300" /> Verified: {studentData?.college}
                </Badge>
              ) : (
                <Badge className="bg-amber-500/30 text-amber-200 border-amber-400/40 text-xs font-semibold">
                  15% Extra Off on ID Verification
                </Badge>
              )}
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
              Eat King-Sized on a Student Pocket
            </h2>

            <p className="text-blue-100 text-sm sm:text-base leading-relaxed max-w-2xl">
              From midnight study crunch combos to pocket-friendly daily meals starting at ₹99, we ensure campus hunger never gets between you and your grades.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {!isVerified ? (
                <Button
                  onClick={() => setIsVerifyModalOpen(true)}
                  className="bg-white text-blue-900 hover:bg-blue-50 rounded-2xl font-black shadow-lg"
                >
                  <Shield className="w-4 h-4 mr-2 text-blue-600" /> Unlock Student 15% OFF
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    localStorage.setItem('suggestedPromo', 'STUDENT15');
                    toast.success('Code STUDENT15 applied! Head to cart to redeem.');
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black shadow-lg"
                >
                  Apply STUDENT15 Promo
                </Button>
              )}
              <Link href="/customer/split-bill">
                <Button
                  variant="outline"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/30 rounded-2xl font-bold backdrop-blur-md"
                >
                  <Users className="w-4 h-4 mr-2" /> Split Hostel Room Bill
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Daily Special Offer Strip */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-8 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl filter drop-shadow">{todayOffer.emoji}</span>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider opacity-90 block">
                  Today's Campus Deal ({todayOffer.day})
                </span>
                <span className="text-base sm:text-lg font-black">{todayOffer.offer}</span>
              </div>
            </div>
            <code className="bg-black/30 text-white px-3 py-1 rounded-xl text-xs font-mono font-bold">
              {todayOffer.code}
            </code>
          </div>

          <div className="md:col-span-4 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {WEEKLY_OFFERS.map((item, i) => (
              <button
                key={item.day}
                onClick={() => setActiveDay(i === 6 ? 0 : i + 1)}
                className={`flex-1 min-w-[42px] py-2 rounded-xl text-xs font-bold border transition-all text-center ${
                  (i === 6 ? 0 : i + 1) === activeDay
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-card border-border/70 text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.day}
              </button>
            ))}
          </div>
        </div>

        {/* Budget Meal Tabs Filter (₹99, ₹149, ₹199) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-500" />
                Live Campus Budget Meals
              </h3>
              <p className="text-xs text-muted-foreground">
                Showing {budgetDishes.length} real dishes from local eateries under ₹{selectedBudgetTier}
              </p>
            </div>

            <div className="flex items-center bg-muted/60 p-1 rounded-2xl border border-border/70">
              <button
                onClick={() => setSelectedBudgetTier(99)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  selectedBudgetTier === 99
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                🥗 Under ₹99 (Lite Bites)
              </button>
              <button
                onClick={() => setSelectedBudgetTier(149)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  selectedBudgetTier === 149
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                🍛 Under ₹149 (Campus Thali)
              </button>
              <button
                onClick={() => setSelectedBudgetTier(199)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  selectedBudgetTier === 199
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                💪 Under ₹199 (Power Feast)
              </button>
            </div>
          </div>

          {/* Dishes Grid - Full Screen Responsive 1 to 5 cols */}
          {budgetDishes.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-3xl border border-dashed border-border p-6 space-y-2">
              <BookOpen className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="font-bold text-foreground">No dishes found in this price bracket</p>
              <p className="text-xs text-muted-foreground">Try switching to the ₹149 or ₹199 budget tier</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
              {budgetDishes.map(dish => {
                const parentRest = restaurants.find(r => r.id === dish.restaurantId);
                const isAdded = addedItemIds.has(dish.id);

                return (
                  <Card
                    key={dish.id}
                    className="overflow-hidden border border-border/70 hover:border-primary/50 transition-all hover:shadow-xl flex flex-col justify-between group bg-card rounded-2xl"
                  >
                    <div className="relative h-40 w-full bg-muted overflow-hidden">
                      <img
                        src={dish.image || (dish.images && dish.images[0]) || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'}
                        alt={dish.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e: any) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
                        }}
                      />
                      <Badge className="absolute top-2.5 left-2.5 bg-black/75 text-white backdrop-blur-md text-[10px] font-mono">
                        {dish.category || 'Meal'}
                      </Badge>
                      <Badge className="absolute bottom-2.5 right-2.5 bg-emerald-600 text-white text-xs font-black font-mono shadow-md">
                        ₹{dish.price}
                      </Badge>
                    </div>

                    <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="font-bold text-sm text-foreground line-clamp-1">{dish.name}</h4>
                        {parentRest && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                            <Store className="w-3 h-3 text-primary flex-shrink-0" />
                            <span className="truncate">{parentRest.name}</span>
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {dish.description || 'Nutritious chef meal prepared hot for students'}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleAddToCart(dish)}
                        className={`w-full rounded-xl text-xs font-bold transition-all shadow-sm ${
                          isAdded
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1" /> Added to Cart
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Add • ₹{dish.price}
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Student Feature Highlights Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-border/70">
          <Card className="p-5 rounded-2xl bg-card border border-border/70 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground">15% Extra Off</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Verified campus discount on all orders above ₹149.</p>
            </div>
          </Card>

          <Card className="p-5 rounded-2xl bg-card border border-border/70 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center flex-shrink-0">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground">Late Night Munchies</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Open till 2:00 AM for all exams and all-night coding.</p>
            </div>
          </Card>

          <Card className="p-5 rounded-2xl bg-card border border-border/70 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 text-violet-500 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground">Split Bills via UPI</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Split party and hostel meals easily with friends.</p>
            </div>
          </Card>

          <Card className="p-5 rounded-2xl bg-card border border-border/70 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground">Hostel Door Delivery</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Direct handoff at your hostel gate or campus block.</p>
            </div>
          </Card>
        </div>

      </div>

      {/* Student ID Verification Modal */}
      <Dialog open={isVerifyModalOpen} onOpenChange={setIsVerifyModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 sm:p-8 bg-card border-2 border-border shadow-2xl">
          <DialogHeader className="text-left space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-500 flex items-center justify-center mb-1">
              <School className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-black text-foreground">
              Verify Student Status
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Enter your college details to unlock permanent 15% student discounts, hostel perks, and exclusive promo codes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleVerifyStudent} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">College / University Name</label>
              <Input
                value={collegeName}
                onChange={e => setCollegeName(e.target.value)}
                placeholder="e.g. IIT Delhi, BITS Pilani, Delhi University"
                className="rounded-xl text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">Student ID / Roll Number</label>
              <Input
                value={studentIdInput}
                onChange={e => setStudentIdInput(e.target.value)}
                placeholder="e.g. 2024CSB1042"
                className="rounded-xl text-sm"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={submittingVerification}
              className="w-full rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 h-11"
            >
              {submittingVerification ? 'Verifying with Campus Directory...' : 'Confirm Student Verification'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
