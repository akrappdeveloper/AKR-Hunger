'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  limit,
  where,
  doc,
  addDoc,
  updateDoc,
  increment,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Star,
  Loader2,
  ChefHat,
  Truck,
  Package,
  ThumbsUp,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import { toast } from 'sonner';

interface Review {
  id: string;
  orderId: string;
  restaurantId: string;
  restaurantName: string;
  rating: number;
  deliveryRating?: number;
  comment: string;
  tags?: string[];
  createdAt: any;
  reply?: string;
  repliedAt?: any;
}

interface ReviewableOrder {
  id: string;
  restaurantName: string;
  restaurantId: string;
  items: any[];
  total: number;
  createdAt: any;
  hasReview: boolean;
}

const REVIEW_TAGS = [
  '😋 Delicious Food',
  '🔥 Piping Hot',
  '📦 Superb Packaging',
  '⚡ Lightning Fast Delivery',
  '💰 Great Value',
  '🍽️ Generous Portions',
  '👍 Will Order Again',
];

function StarRating({
  value,
  onChange,
  size = 'md',
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [hover, setHover] = useState(0);
  const sizeClass = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }[size];

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange?.(i)}
          onMouseEnter={() => onChange && setHover(i)}
          onMouseLeave={() => onChange && setHover(0)}
          className="transition-transform hover:scale-115 p-0.5 focus:outline-none"
          disabled={!onChange}
        >
          <Star
            className={`${sizeClass} transition-colors ${
              (hover || value) >= i
                ? 'text-amber-400 fill-amber-400 drop-shadow-sm'
                : 'text-muted-foreground/30'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [orders, setOrders] = useState<ReviewableOrder[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  // Review Dialog / Form State
  const [selectedOrder, setSelectedOrder] = useState<ReviewableOrder | null>(null);
  const [foodRating, setFoodRating] = useState(5);
  const [deliveryRating, setDeliveryRating] = useState(5);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // 1. Fetch delivered orders for the customer
    const ordersQ = query(
      collection(db, 'orders'),
      where('customerId', '==', user.uid),
      where('status', '==', 'delivered'),
      orderBy('createdAt', 'desc'),
      limit(25)
    );

    // 2. Fetch past reviews submitted by the customer
    const reviewsQ = query(
      collection(db, 'reviews'),
      where('customerId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    const unsubOrders = onSnapshot(
      ordersQ,
      async (ordersSnap) => {
        const reviewsSnap = await getDocs(
          query(collection(db, 'reviews'), where('customerId', '==', user.uid))
        );
        const reviewedOrderIds = new Set(reviewsSnap.docs.map((d) => d.data().orderId));

        setOrders(
          ordersSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            hasReview: reviewedOrderIds.has(d.id),
          })) as ReviewableOrder[]
        );
        setLoading(false);
      },
      (err) => {
        console.warn('Orders fetch error:', err);
        setLoading(false);
      }
    );

    const unsubReviews = onSnapshot(reviewsQ, (snap) => {
      setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review)));
    });

    return () => {
      unsubOrders();
      unsubReviews();
    };
  }, [user]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedOrder) return;

    if (foodRating === 0) {
      toast.error('Please tap stars to rate the food quality');
      return;
    }

    if (comment.trim().length < 5) {
      toast.error('Please write a brief comment (at least 5 characters)');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Add review to Firestore 'reviews'
      await addDoc(collection(db, 'reviews'), {
        customerId: user.uid,
        customerName: user.displayName || 'Hunger Customer',
        orderId: selectedOrder.id,
        restaurantId: selectedOrder.restaurantId || '',
        restaurantName: selectedOrder.restaurantName || 'Restaurant',
        rating: foodRating,
        deliveryRating,
        comment: comment.trim(),
        tags: selectedTags,
        createdAt: serverTimestamp(),
      });

      // 2. Award 20 reward points to customers/{user.uid}
      try {
        await updateDoc(doc(db, 'customers', user.uid), {
          rewardPoints: increment(20),
          updatedAt: serverTimestamp(),
        });

        // Add points activity
        await addDoc(collection(db, 'customers', user.uid, 'pointActivities'), {
          type: 'earned',
          points: 20,
          description: `Reviewed order from ${selectedOrder.restaurantName}`,
          createdAt: serverTimestamp(),
        });
      } catch (_) {}

      toast.success('🎉 Review submitted! 20 Reward points added to your account.');

      // Mark order as reviewed locally
      setOrders((prev) =>
        prev.map((o) => (o.id === selectedOrder.id ? { ...o, hasReview: true } : o))
      );

      // Reset form
      setSelectedOrder(null);
      setComment('');
      setSelectedTags([]);
      setTab('history');
    } catch (err) {
      console.error('Failed to submit review:', err);
      toast.error('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingOrders = orders.filter((o) => !o.hasReview);

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 selection:bg-primary/20">
      {/* Top Header Banner matching Customer Panel */}
      <div className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-primary/5 to-transparent border-b border-border/50 py-8 sm:py-12">
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link
              href="/customer/profile"
              className="inline-flex items-center gap-1.5 hover:text-foreground font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Profile
            </Link>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shadow-inner">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  Order Ratings & Reviews
                </h1>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-bold">
                  {reviews.length} Completed
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                Share your candid culinary experience with our community and earn 20 points per review.
              </p>
            </div>

            {/* Tab Pills */}
            <div className="flex items-center p-1.5 bg-muted/80 rounded-2xl border border-border/60 self-start md:self-auto">
              <button
                onClick={() => setTab('pending')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                  tab === 'pending'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Pending Reviews</span>
                {pendingOrders.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-black">
                    {pendingOrders.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setTab('history')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  tab === 'history'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                My Reviews ({reviews.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-40 rounded-3xl bg-muted/40 animate-pulse border border-border/50"
              />
            ))}
          </div>
        ) : tab === 'pending' ? (
          /* Pending Reviews Section */
          pendingOrders.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingOrders.map((order) => (
                <Card
                  key={order.id}
                  className="rounded-3xl border border-border/70 bg-card hover:border-primary/50 hover:shadow-lg transition-all p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                          Delivered Order
                        </span>
                        <h3 className="font-black text-lg text-foreground leading-snug">
                          {order.restaurantName}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Order #{order.id.slice(-6).toUpperCase()} • ₹{order.total}
                        </p>
                      </div>
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs">
                        Delivered
                      </Badge>
                    </div>

                    <div className="space-y-1 mb-4 text-xs text-muted-foreground line-clamp-2">
                      {order.items?.map((it: any) => `${it.quantity}x ${it.name}`).join(', ')}
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      setSelectedOrder(order);
                      setFoodRating(5);
                      setDeliveryRating(5);
                    }}
                    className="w-full rounded-2xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 gap-2"
                  >
                    <Star className="w-4 h-4 fill-current" /> Rate & Review (+20 Pts)
                  </Button>
                </Card>
              ))}
            </div>
          ) : (
            <div className="max-w-md mx-auto text-center py-16 px-4">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-muted/60 border border-border/60 flex items-center justify-center text-muted-foreground mb-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">All caught up!</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-6">
                You have reviewed all your recent completed orders. Thank you for making our foodie community awesome!
              </p>
              <Link href="/customer/orders">
                <Button variant="outline" className="rounded-2xl font-bold">
                  <ShoppingBag className="w-4 h-4 mr-2" /> View Order History
                </Button>
              </Link>
            </div>
          )
        ) : (
          /* Reviews History Section */
          reviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reviews.map((rev) => (
                <Card
                  key={rev.id}
                  className="rounded-3xl border border-border/70 bg-card p-6 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black text-base text-foreground">
                          {rev.restaurantName}
                        </h3>
                        <span className="text-[11px] text-muted-foreground">
                          {rev.createdAt?.toDate
                            ? rev.createdAt.toDate().toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'Recently reviewed'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full text-xs font-black">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>{rev.rating}.0</span>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed italic">
                      &ldquo;{rev.comment}&rdquo;
                    </p>

                    {/* Tags */}
                    {rev.tags && rev.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {rev.tags.map((tg, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground"
                          >
                            {tg}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Restaurant Reply if available */}
                    {rev.reply && (
                      <div className="p-3 rounded-2xl bg-primary/5 border border-primary/20 text-xs mt-3">
                        <p className="font-bold text-primary flex items-center gap-1 mb-1">
                          <MessageSquare className="w-3.5 h-3.5" /> Response from {rev.restaurantName}:
                        </p>
                        <p className="text-muted-foreground">{rev.reply}</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="max-w-md mx-auto text-center py-16 px-4">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-muted/60 border border-border/60 flex items-center justify-center text-muted-foreground mb-4">
                <Star className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">No reviews published yet</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-6">
                When you order from restaurants, review your meals here to earn reward points.
              </p>
              <Button onClick={() => setTab('pending')} className="rounded-2xl font-bold">
                Check Pending Orders
              </Button>
            </div>
          )
        )}
      </div>

      {/* Review Submission Modal Dialog */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-card text-card-foreground border border-border shadow-2xl rounded-3xl p-6 sm:p-8 max-w-lg w-full relative"
          >
            <div className="mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Earn 20 Reward Points
              </span>
              <h2 className="text-2xl font-black text-foreground">Rate your meal</h2>
              <p className="text-xs text-muted-foreground">
                How was your food experience from{' '}
                <strong className="text-foreground">{selectedOrder.restaurantName}</strong>?
              </p>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-5">
              {/* Star Rating for Food */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 flex flex-col items-center text-center space-y-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Food Quality & Taste
                </span>
                <StarRating value={foodRating} onChange={setFoodRating} size="lg" />
                <span className="text-xs font-semibold text-primary">
                  {foodRating === 5
                    ? 'Exceptional & Delicious! 😋'
                    : foodRating === 4
                    ? 'Really Good 👍'
                    : foodRating === 3
                    ? 'Average / Satisfactory 🙂'
                    : 'Needs Improvement 🙁'}
                </span>
              </div>

              {/* Delivery Rating */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Truck className="w-4 h-4 text-primary" /> Delivery Experience
                </div>
                <StarRating value={deliveryRating} onChange={setDeliveryRating} size="sm" />
              </div>

              {/* Quick Tag Chips */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Highlight features (Tap to select)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {REVIEW_TAGS.map((t) => {
                    const isSelected = selectedTags.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTag(t)}
                        className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                            : 'bg-muted/50 border-border/60 text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Review Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Write your detailed feedback *
                </label>
                <Textarea
                  required
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us what you loved about the food, portion sizes, packaging, or taste..."
                  className="rounded-2xl bg-muted/40 border-border/70 text-sm resize-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedOrder(null)}
                  className="rounded-2xl flex-1 font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl flex-1 font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Submitting...
                    </>
                  ) : (
                    'Submit (+20 Pts)'
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
