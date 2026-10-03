'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, limit, where, doc, addDoc, updateDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, Star, Loader2, ChefHat, Truck, Package,
  ThumbsUp, MessageSquare, Filter, CheckCircle2, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import SafeImage from '@/components/ui/safe-image';

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
  restaurantImage?: string;
  items: any[];
  total: number;
  createdAt: any;
  hasReview: boolean;
}

const REVIEW_TAGS = [
  '😋 Delicious', '🔥 Hot & Fresh', '📦 Well Packaged', '⚡ Fast Delivery',
  '💰 Great Value', '🍽️ Large Portions', '✨ Exceeded Expectations', '👍 Will Order Again'
];

function StarRating({ value, onChange, size = 'md' }: { value: number; onChange?: (v: number) => void; size?: 'sm' | 'md' | 'lg' }) {
  const [hover, setHover] = useState(0);
  const sizeClass = { sm: 'w-5 h-5', md: 'w-7 h-7', lg: 'w-9 h-9' }[size];
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange?.(i)}
          onMouseEnter={() => onChange && setHover(i)}
          onMouseLeave={() => onChange && setHover(0)}
          className="transition-transform hover:scale-110"
          disabled={!onChange}
        >
          <Star
            className={`${sizeClass} transition-colors ${
              (hover || value) >= i ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'
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
  const [tab, setTab] = useState<'write' | 'history'>('write');
  const [orders, setOrders] = useState<ReviewableOrder[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<ReviewableOrder | null>(null);
  const [rating, setRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Fetch delivered orders
    const ordersQ = query(
      collection(db, 'orders'),
      where('customerId', '==', user.uid),
      where('status', '==', 'delivered'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const reviewsQ = query(
      collection(db, 'reviews'),
      where('customerId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    const unsubOrders = onSnapshot(ordersQ, async ordersSnap => {
      const reviewsSnap = await getDocs(query(
        collection(db, 'reviews'),
        where('customerId', '==', user.uid)
      ));
      const reviewedOrderIds = new Set(reviewsSnap.docs.map(d => d.data().orderId));
      setOrders(ordersSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        hasReview: reviewedOrderIds.has(d.id),
      } as ReviewableOrder)));
      setLoading(false);
    }, () => setLoading(false));

    const unsubReviews = onSnapshot(reviewsQ, snap => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() } as Review)));
    }, () => {});

    return () => { unsubOrders(); unsubReviews(); };
  }, [user]);

  const submitReview = async () => {
    if (!user || !selectedOrder) return;
    if (rating === 0) { toast.error('Please select a rating'); return; }
    if (comment.trim().length < 10) { toast.error('Please write at least 10 characters'); return; }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        customerId: user.uid,
        orderId: selectedOrder.id,
        restaurantId: selectedOrder.restaurantId,
        restaurantName: selectedOrder.restaurantName,
        rating,
        deliveryRating,
        comment: comment.trim(),
        tags: selectedTags,
        createdAt: serverTimestamp(),
      });
      // Update restaurant average rating
      toast.success('🎉 Review submitted! You earned 20 reward points.');
      setSelectedOrder(null);
      setRating(0);
      setDeliveryRating(0);
      setComment('');
      setSelectedTags([]);
      setTab('history');
    } catch {
      toast.error('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingOrders = orders.filter(o => !o.hasReview);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 pt-8 pb-20">
        <div className="absolute inset-0 opacity-10 select-none pointer-events-none">
          <span className="absolute top-4 left-6 text-7xl">⭐</span>
          <span className="absolute bottom-4 right-12 text-5xl">✍️</span>
        </div>
        <div className="container max-w-2xl mx-auto px-4">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/80 hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="text-center">
            <div className="text-4xl mb-2">⭐</div>
            <h1 className="text-3xl font-black text-white mb-1">My Reviews</h1>
            <p className="text-white/80 text-sm">Share your experience & earn reward points</p>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 -mt-8 pb-20">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-muted p-1 rounded-2xl">
          {(['write', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === t ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
              }`}
            >
              {t === 'write' ? `✍️ Write Review (${pendingOrders.length})` : '📋 Review History'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : tab === 'write' ? (
          <>
            {selectedOrder ? (
              /* Review Form */
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="rounded-3xl border-0 shadow-xl">
                  <CardContent className="p-6 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-2xl">🍽️</div>
                      <div>
                        <p className="font-bold">{selectedOrder.restaurantName}</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedOrder.createdAt?.toDate?.()?.toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)} className="ml-auto rounded-xl text-xs">
                        Change
                      </Button>
                    </div>

                    <div>
                      <p className="font-semibold mb-3 flex items-center gap-2">
                        <ChefHat className="w-4 h-4 text-orange-500" /> Food Rating *
                      </p>
                      <StarRating value={rating} onChange={setRating} size="lg" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {['', 'Very Poor 😞', 'Poor 😕', 'Average 😐', 'Good 😊', 'Excellent 🤩'][rating]}
                      </p>
                    </div>

                    <div>
                      <p className="font-semibold mb-3 flex items-center gap-2">
                        <Truck className="w-4 h-4 text-blue-500" /> Delivery Rating
                      </p>
                      <StarRating value={deliveryRating} onChange={setDeliveryRating} size="md" />
                    </div>

                    <div>
                      <p className="font-semibold mb-3 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-purple-500" /> Your Review *
                      </p>
                      <Textarea
                        placeholder="Tell us about your experience — food quality, delivery speed, packaging..."
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        rows={4}
                        className="rounded-2xl resize-none"
                      />
                      <p className="text-xs text-muted-foreground text-right mt-1">{comment.length}/500</p>
                    </div>

                    <div>
                      <p className="font-semibold mb-3">Quick Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {REVIEW_TAGS.map(tag => (
                          <button
                            key={tag}
                            onClick={() => setSelectedTags(prev =>
                              prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                            )}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                              selectedTags.includes(tag)
                                ? 'bg-orange-500 text-white border-orange-500'
                                : 'border-border hover:border-orange-400 text-foreground'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-3 flex items-center gap-3">
                      <Star className="w-5 h-5 text-amber-500 flex-shrink-0" />
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        <strong>+20 reward points</strong> for writing a review!
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" onClick={() => setSelectedOrder(null)} className="rounded-2xl">
                        Cancel
                      </Button>
                      <Button
                        onClick={submitReview}
                        disabled={submitting || rating === 0}
                        className="rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white border-0 gap-2"
                      >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Submit Review
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : pendingOrders.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-xl font-bold mb-2">All caught up!</h3>
                <p className="text-muted-foreground">You've reviewed all your recent orders. Keep ordering to earn more!</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  You have <strong>{pendingOrders.length} order(s)</strong> waiting for your review:
                </p>
                {pendingOrders.map((order, i) => (
                  <motion.div key={order.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card className="rounded-2xl border border-border hover:border-orange-400/50 transition-colors cursor-pointer" onClick={() => setSelectedOrder(order)}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-xl flex-shrink-0">
                            🍽️
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold truncate">{order.restaurantName}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.items?.slice(0, 2).map((item: any) => item.name).join(', ')}
                              {order.items?.length > 2 ? ` +${order.items.length - 2} more` : ''}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {order.createdAt?.toDate?.()?.toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="font-bold text-sm">₹{order.total}</span>
                            <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Review Now</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Review History */
          <div className="space-y-4">
            {reviews.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-xl font-bold mb-2">No reviews yet</h3>
                <p className="text-muted-foreground mb-6">Write your first review to earn reward points!</p>
                <Button onClick={() => setTab('write')} className="bg-orange-500 text-white rounded-xl">
                  Write a Review
                </Button>
              </div>
            ) : (
              reviews.map((review, i) => (
                <motion.div key={review.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="rounded-2xl border-0 shadow-md">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-bold">{review.restaurantName}</p>
                          <p className="text-xs text-muted-foreground">
                            {review.createdAt?.toDate?.()?.toLocaleDateString()}
                          </p>
                        </div>
                        <StarRating value={review.rating} size="sm" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{review.comment}</p>
                      {review.tags && review.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {review.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs rounded-lg px-2">{tag}</Badge>
                          ))}
                        </div>
                      )}
                      {review.reply && (
                        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-3 border-l-4 border-blue-500">
                          <p className="text-xs font-semibold text-blue-600 mb-1">🍽️ Restaurant Reply</p>
                          <p className="text-sm text-muted-foreground">{review.reply}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
