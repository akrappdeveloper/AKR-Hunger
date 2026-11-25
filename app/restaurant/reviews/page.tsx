'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Review } from '@/lib/types';
import {
  Star,
  MessageSquare,
  CheckCircle,
  Calendar,
  ShoppingBag,
  Quote,
  ArrowUpDown,
  Search,
  RefreshCw,
  Download,
  Sparkles,
  ThumbsUp,
  Bike,
  Edit2,
  Camera,
  ExternalLink,
  Smile,
  Meh,
  AlertTriangle,
  MessageCircleReply,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface EnrichedReview extends Review {
  customerName: string;
  customerAvatar?: string;
  deliveryRating?: number;
  tags?: string[];
  userName?: string;
  reply?: string;
}

const QUICK_REPLY_TEMPLATES = [
  {
    label: 'Warm Thank You',
    text: 'Thank you so much for your wonderful review! We are delighted you enjoyed your meal and look forward to serving you again soon.',
  },
  {
    label: 'Chef Appreciation',
    text: 'Your feedback made our kitchen team’s day! Thank you for ordering from us and sharing your kind words.',
  },
  {
    label: 'Service Recovery',
    text: 'Thank you for sharing your honest feedback. We apologize that your experience fell short of our standards and have shared this with our kitchen team to improve right away.',
  },
];

function toSafeDate(val: any): Date {
  if (!val) return new Date(0);
  if (typeof val?.toDate === 'function') return val.toDate();
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000);
  const parsed = new Date(val);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function getReplyText(review: EnrichedReview): string | null {
  if (typeof review.response === 'string' && review.response.trim()) {
    return review.response.trim();
  }
  if (
    review.response &&
    typeof review.response === 'object' &&
    'comment' in review.response &&
    typeof (review.response as any).comment === 'string'
  ) {
    return (review.response as any).comment.trim();
  }
  if (typeof review.reply === 'string' && review.reply.trim()) {
    return review.reply.trim();
  }
  return null;
}

export default function ReviewsPage() {
  const router = useRouter();
  const { user, restaurant, loading: authLoading } = useRestaurantAuth();

  const [reviews, setReviews] = useState<EnrichedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & sorting
  const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all');
  const [replyFilter, setReplyFilter] = useState<'all' | 'pending' | 'replied'>('all');
  const [photosOnly, setPhotosOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest' | 'helpful'>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  // Reply Dialog
  const [responseDialog, setResponseDialog] = useState<{
    open: boolean;
    review: EnrichedReview | null;
  }>({
    open: false,
    review: null,
  });
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Photo Lightbox Dialog
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const loadReviews = useCallback(
    async (isManualRefresh = false) => {
      if (!user) return;
      try {
        if (isManualRefresh) setRefreshing(true);
        else setLoading(true);

        const targetIds = Array.from(
          new Set([user.uid, (user as any)?.restaurantId, restaurant?.id].filter(Boolean))
        ) as string[];

        const rawMap = new Map<string, any>();
        await Promise.all(
          targetIds.map(async (tid) => {
            try {
              const q = query(collection(db, 'reviews'), where('restaurantId', '==', tid));
              const snapshot = await getDocs(q);
              snapshot.docs.forEach((docSnap) => {
                rawMap.set(docSnap.id, { ...docSnap.data(), id: docSnap.id });
              });
            } catch (err) {
              console.warn('[Reviews] Notice querying restaurantId:', tid, err);
            }
          })
        );

        const rawReviews = Array.from(rawMap.values());

        // Batch-fetch real customer profiles (name + avatar) & order dish details
        const uniqueCustomerIds = Array.from(
          new Set(rawReviews.map((r) => r.customerId).filter(Boolean))
        ) as string[];

        const uniqueOrderIdsNeedingDishes = Array.from(
          new Set(
            rawReviews
              .filter((r) => r.orderId && !r.menuItemName)
              .map((r) => r.orderId)
              .filter(Boolean)
          )
        ) as string[];

        const customerProfiles = new Map<string, any>();
        await Promise.all(
          uniqueCustomerIds.map(async (cid) => {
            try {
              const cSnap = await getDoc(doc(db, 'customers', cid));
              if (cSnap.exists()) {
                customerProfiles.set(cid, cSnap.data());
              }
            } catch {
              // ignore missing/restricted customer profile
            }
          })
        );

        const orderDishesMap = new Map<string, string>();
        await Promise.all(
          uniqueOrderIdsNeedingDishes.map(async (oid) => {
            try {
              const oSnap = await getDoc(doc(db, 'orders', oid));
              if (oSnap.exists()) {
                const items = oSnap.data()?.items;
                if (Array.isArray(items) && items.length > 0) {
                  const dishSummary = items
                    .map((it: any) =>
                      it?.name ? `${it.name}${Number(it.quantity || 1) > 1 ? ` ×${it.quantity}` : ''}` : ''
                    )
                    .filter(Boolean)
                    .join(', ');
                  if (dishSummary) orderDishesMap.set(oid, dishSummary);
                }
              }
            } catch {
              // ignore
            }
          })
        );

        const enriched: EnrichedReview[] = rawReviews.map((r) => {
          const profile = r.customerId ? customerProfiles.get(r.customerId) : null;
          const resolvedName =
            profile?.name ||
            profile?.displayName ||
            r.customerName ||
            r.userName ||
            'Hunger Customer';
          const resolvedAvatar =
            profile?.avatar ||
            profile?.photoURL ||
            profile?.image ||
            profile?.profileImage ||
            r.customerAvatar ||
            r.userAvatar ||
            '';
          const resolvedDishName =
            r.menuItemName || (r.orderId ? orderDishesMap.get(r.orderId) || '' : '');

          return {
            ...r,
            customerName: String(resolvedName),
            customerAvatar: resolvedAvatar ? String(resolvedAvatar) : '',
            menuItemName: resolvedDishName || undefined,
            isVerified: r.isVerified ?? Boolean(r.orderId),
            rating: Number(r.rating || 0),
          } as EnrichedReview;
        });

        setReviews(enriched);
      } catch (error) {
        console.error('[Reviews] Error loading:', error);
        toast.error('Failed to load customer reviews');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, restaurant?.id]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/restaurant/login');
      return;
    }
    loadReviews();
  }, [user, authLoading, router, loadReviews]);

  const openReplyDialog = (review: EnrichedReview) => {
    const existing = getReplyText(review) || '';
    setResponseText(existing);
    setResponseDialog({ open: true, review });
  };

  const handleRespondToReview = async () => {
    if (!responseDialog.review || !responseText.trim()) return;

    try {
      setSubmitting(true);
      const trimmed = responseText.trim();
      const now = new Date();
      await updateDoc(doc(db, 'reviews', responseDialog.review.id!), {
        response: trimmed,
        repliedAt: now,
        updatedAt: now,
      });

      setReviews((prev) =>
        prev.map((r) =>
          r.id === responseDialog.review!.id
            ? { ...r, response: trimmed, updatedAt: now }
            : r
        )
      );

      toast.success('Public reply published!');
      setResponseDialog({ open: false, review: null });
      setResponseText('');
    } catch (error) {
      console.error('[Reviews] Error posting response:', error);
      toast.error('Failed to publish response. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating: number, sizeClass = 'w-4 h-4') => {
    const rounded = Math.round(Number(rating || 0));
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= rounded
                ? 'fill-amber-400 text-amber-400 drop-shadow-xs'
                : 'text-muted-foreground/30 fill-muted/40'
            }`}
          />
        ))}
      </div>
    );
  };

  const stats = useMemo(() => {
    const total = reviews.length;
    const avg =
      total > 0
        ? (reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0) / total).toFixed(1)
        : '0.0';

    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let positiveCount = 0;
    let neutralCount = 0;
    let negativeCount = 0;
    let repliedCount = 0;
    let deliveryRatingSum = 0;
    let deliveryRatingCount = 0;
    let photosCount = 0;

    for (const r of reviews) {
      const rounded = Math.round(Number(r.rating || 0)) as 1 | 2 | 3 | 4 | 5;
      if (dist[rounded] !== undefined) dist[rounded]++;
      if (Number(r.rating || 0) >= 4) positiveCount++;
      else if (Number(r.rating || 0) >= 3) neutralCount++;
      else negativeCount++;

      if (getReplyText(r)) repliedCount++;
      if (Number(r.deliveryRating || 0) > 0) {
        deliveryRatingSum += Number(r.deliveryRating);
        deliveryRatingCount++;
      }
      if (Array.isArray(r.images) && r.images.length > 0) photosCount++;
    }

    const pendingCount = total - repliedCount;
    const responseRate = total > 0 ? Math.round((repliedCount / total) * 100) : 0;
    const positiveRate = total > 0 ? Math.round((positiveCount / total) * 100) : 0;
    const avgDeliveryRating =
      deliveryRatingCount > 0 ? (deliveryRatingSum / deliveryRatingCount).toFixed(1) : null;

    return {
      total,
      avg,
      dist,
      positiveCount,
      neutralCount,
      negativeCount,
      repliedCount,
      pendingCount,
      responseRate,
      positiveRate,
      avgDeliveryRating,
      photosCount,
    };
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    const normalizedQuery = (searchQuery || '').trim().toLowerCase();

    return reviews
      .filter((r) => {
        const ratingVal = Number(r.rating || 0);
        const matchesRating = ratingFilter === 'all' || Math.round(ratingVal) === ratingFilter;
        const hasReply = Boolean(getReplyText(r));
        const matchesReply =
          replyFilter === 'all' ||
          (replyFilter === 'replied' && hasReply) ||
          (replyFilter === 'pending' && !hasReply);
        const matchesPhotos = !photosOnly || (Array.isArray(r.images) && r.images.length > 0);

        if (!normalizedQuery) return matchesRating && matchesReply && matchesPhotos;

        const customerName = String(r.customerName || '').toLowerCase();
        const comment = String(r.comment || '').toLowerCase();
        const menuItemName = String(r.menuItemName || '').toLowerCase();
        const orderId = String(r.orderId || '').toLowerCase();
        const tags = Array.isArray(r.tags) ? r.tags.join(' ').toLowerCase() : '';

        const matchesSearch =
          customerName.includes(normalizedQuery) ||
          comment.includes(normalizedQuery) ||
          menuItemName.includes(normalizedQuery) ||
          orderId.includes(normalizedQuery) ||
          tags.includes(normalizedQuery);

        return matchesRating && matchesReply && matchesPhotos && matchesSearch;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'newest':
            return toSafeDate(b.createdAt).getTime() - toSafeDate(a.createdAt).getTime();
          case 'oldest':
            return toSafeDate(a.createdAt).getTime() - toSafeDate(b.createdAt).getTime();
          case 'highest':
            return Number(b.rating || 0) - Number(a.rating || 0);
          case 'lowest':
            return Number(a.rating || 0) - Number(b.rating || 0);
          case 'helpful':
            return Number(b.helpful || 0) - Number(a.helpful || 0);
          default:
            return 0;
        }
      });
  }, [reviews, ratingFilter, replyFilter, photosOnly, searchQuery, sortBy]);

  const handleExportCSV = () => {
    if (filteredReviews.length === 0) {
      toast.info('No reviews to export');
      return;
    }
    const escapeCsv = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;
    const headers = [
      'Customer Name',
      'Rating',
      'Delivery Rating',
      'Order ID',
      'Ordered Dishes',
      'Comment',
      'Restaurant Reply',
      'Date',
    ];
    const rows = filteredReviews.map((r) => [
      escapeCsv(r.customerName),
      String(r.rating || 0),
      r.deliveryRating ? String(r.deliveryRating) : '',
      escapeCsv(r.orderId || ''),
      escapeCsv(r.menuItemName || ''),
      escapeCsv(r.comment || ''),
      escapeCsv(getReplyText(r) || ''),
      escapeCsv(r.createdAt ? toSafeDate(r.createdAt).toLocaleDateString() : ''),
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `restaurant-reviews-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredReviews.length} reviews to CSV`);
  };

  if (authLoading || loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-t-primary border-r-amber-500 border-b-purple-500 border-l-blue-500 rounded-full animate-spin" />
          <p className="text-muted-foreground font-medium animate-pulse">
            Loading customer reviews &amp; profiles...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 space-y-7 transition-colors duration-300 font-sans">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/10 via-card to-primary/5 border border-border/80 p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold text-xs px-2.5 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3 mr-1" /> Live Diner Feedback
              </Badge>
              {stats.pendingCount > 0 && (
                <button
                  type="button"
                  onClick={() => setReplyFilter((prev) => (prev === 'pending' ? 'all' : 'pending'))}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-primary/15 text-primary border border-primary/30 px-2.5 py-0.5 rounded-full hover:bg-primary/25 transition cursor-pointer"
                >
                  <MessageCircleReply className="w-3 h-3" />
                  {stats.pendingCount} Awaiting Reply
                </button>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-black bg-gradient-to-r from-amber-500 via-orange-500 to-primary bg-clip-text text-transparent tracking-tight">
              Customer Reviews &amp; Ratings
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Real-time ratings, diner profiles, dish feedback, and public kitchen replies
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customer, dish, order..."
                className="pl-10 h-10 bg-card/90 border-border text-foreground placeholder:text-muted-foreground focus:ring-primary/50 focus:border-primary rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadReviews(true)}
                disabled={refreshing}
                className="h-10 px-3.5 rounded-xl border-border bg-card font-bold gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="h-10 px-3.5 rounded-xl border-border bg-card font-bold gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics & Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Average Rating Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-4"
        >
          <Card className="p-6 rounded-3xl bg-card border-border shadow-sm h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Overall Rating
              </span>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold">
                {stats.total} Reviews
              </Badge>
            </div>

            <div className="my-5 flex items-center gap-5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-5xl sm:text-6xl font-black text-foreground tracking-tight">
                  {stats.avg}
                </span>
                <span className="text-sm font-bold text-muted-foreground">/ 5</span>
              </div>
              <div className="space-y-1.5">
                {renderStars(Math.round(parseFloat(stats.avg)), 'w-5 h-5')}
                <p className="text-xs text-muted-foreground font-medium">
                  <strong className="text-emerald-600 dark:text-emerald-400">{stats.positiveRate}%</strong> positive (4★ &amp; 5★)
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-border/60 flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">
                {stats.avgDeliveryRating ? (
                  <span className="inline-flex items-center gap-1.5 text-foreground font-semibold">
                    <Bike className="w-3.5 h-3.5 text-blue-500" />
                    Delivery Avg: <strong>{stats.avgDeliveryRating} ★</strong>
                  </span>
                ) : (
                  'Verified Diner Ratings'
                )}
              </span>
              <span className="font-bold text-primary">{stats.responseRate}% Replied</span>
            </div>
          </Card>
        </motion.div>

        {/* Interactive Rating Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="lg:col-span-5"
        >
          <Card className="p-6 rounded-3xl bg-card border-border shadow-sm h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-primary" />
                Rating Breakdown
              </h3>
              {ratingFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setRatingFilter('all')}
                  className="text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  Clear Filter
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = stats.dist[rating as keyof typeof stats.dist];
                const percentage = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                const isSelected = ratingFilter === rating;
                return (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setRatingFilter((prev) => (prev === rating ? 'all' : rating))}
                    className={`w-full flex items-center gap-3 p-1 rounded-xl transition cursor-pointer ${
                      isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-1 w-10 justify-end shrink-0">
                      <span className="text-xs font-bold text-foreground">{rating}</span>
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    </div>
                    <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className={`h-full rounded-full ${
                          rating >= 4
                            ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                            : rating === 3
                            ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                            : 'bg-gradient-to-r from-rose-400 to-red-600'
                        }`}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-16 text-right font-mono shrink-0">
                      {count} ({percentage}%)
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Sentiment & Response Health */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-3"
        >
          <Card className="p-6 rounded-3xl bg-card border-border shadow-sm h-full flex flex-col justify-between space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Sentiment &amp; Replies
            </h3>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <Smile className="w-4 h-4" /> Positive (4-5★)
                </span>
                <span className="font-black text-sm text-foreground font-mono">{stats.positiveCount}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Meh className="w-4 h-4" /> Neutral (3★)
                </span>
                <span className="font-black text-sm text-foreground font-mono">{stats.neutralCount}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <span className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-4 h-4" /> Low (1-2★)
                </span>
                <span className="font-black text-sm text-foreground font-mono">{stats.negativeCount}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-border/60 space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Kitchen Response Rate</span>
                <span className="text-foreground font-bold">{stats.responseRate}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${stats.responseRate}%` }}
                />
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Filter & Sort Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-card/95 p-3 rounded-2xl border border-border backdrop-blur-md sticky top-3 z-20 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={ratingFilter === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setRatingFilter('all')}
            className={`rounded-full text-xs font-bold ${
              ratingFilter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            All ({stats.total})
          </Button>
          {[5, 4, 3, 2, 1].map((rating) => (
            <Button
              key={rating}
              variant={ratingFilter === rating ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setRatingFilter((prev) => (prev === rating ? 'all' : rating))}
              className={`rounded-full text-xs font-bold flex items-center gap-1 ${
                ratingFilter === rating
                  ? 'bg-amber-500 text-amber-950 hover:bg-amber-500/90'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {rating} <Star className="w-3 h-3 fill-current" />
            </Button>
          ))}

          <div className="h-5 w-px bg-border mx-1 hidden sm:block" />

          {(['all', 'pending', 'replied'] as const).map((status) => (
            <Button
              key={status}
              variant={replyFilter === status ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setReplyFilter(status)}
              className={`rounded-full text-xs font-bold ${
                replyFilter === status
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-muted-foreground'
              }`}
            >
              {status === 'all'
                ? 'All Replies'
                : status === 'pending'
                ? `Needs Reply (${stats.pendingCount})`
                : `Replied (${stats.repliedCount})`}
            </Button>
          ))}

          {stats.photosCount > 0 && (
            <Button
              variant={photosOnly ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setPhotosOnly((p) => !p)}
              className={`rounded-full text-xs font-bold gap-1 ${
                photosOnly ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30' : 'text-muted-foreground'
              }`}
            >
              <Camera className="w-3.5 h-3.5" /> Photos ({stats.photosCount})
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between lg:justify-end gap-2">
          <span className="text-xs text-muted-foreground font-semibold">
            Showing {filteredReviews.length} of {reviews.length}
          </span>
          <select
            className="bg-background border border-border text-xs sm:text-sm font-semibold text-foreground rounded-xl px-3 py-2 focus:ring-1 focus:ring-primary cursor-pointer"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest">Highest Rated</option>
            <option value="lowest">Lowest Rated</option>
            <option value="helpful">Most Helpful</option>
          </select>
        </div>
      </div>

      {/* Reviews List */}
      <div className="grid grid-cols-1 gap-5">
        <AnimatePresence mode="popLayout">
          {filteredReviews.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-card border border-border border-dashed rounded-3xl p-14 text-center"
            >
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-muted-foreground opacity-60" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">No matching reviews found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Try clearing filters or search terms to view all diner feedback.
              </p>
              {(ratingFilter !== 'all' || replyFilter !== 'all' || photosOnly || searchQuery) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRatingFilter('all');
                    setReplyFilter('all');
                    setPhotosOnly(false);
                    setSearchQuery('');
                  }}
                  className="rounded-xl font-bold"
                >
                  Reset Filters
                </Button>
              )}
            </motion.div>
          ) : (
            filteredReviews.map((review, index) => {
              const reviewerName = review.customerName || 'Hunger Customer';
              const existingReply = getReplyText(review);
              const reviewDate = toSafeDate(review.createdAt);
              const dateStr =
                reviewDate.getTime() > 0
                  ? reviewDate.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Recent';

              return (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ delay: Math.min(index * 0.03, 0.25) }}
                  layout
                >
                  <Card className="overflow-hidden rounded-3xl bg-card border-border hover:border-primary/40 hover:shadow-md transition-all duration-300 group shadow-xs">
                    <div className="flex flex-col md:flex-row gap-5 p-5 sm:p-6">
                      {/* Real Customer Profile Column */}
                      <div className="flex md:flex-col items-center md:items-start gap-3.5 md:w-52 shrink-0">
                        <Avatar className="w-14 h-14 sm:w-16 sm:h-16 border-2 border-primary/25 shadow-sm ring-2 ring-background group-hover:scale-105 transition-transform duration-300">
                          <AvatarImage
                            src={review.customerAvatar || undefined}
                            alt={reviewerName}
                            className="object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <AvatarFallback className="bg-gradient-to-br from-primary/25 to-amber-500/20 text-primary font-black text-lg">
                            {reviewerName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1 md:w-full">
                          <h4
                            className="font-bold text-foreground text-base truncate"
                            title={reviewerName}
                          >
                            {reviewerName}
                          </h4>

                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {review.isVerified && (
                              <Badge
                                variant="secondary"
                                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold px-2 py-0.5"
                              >
                                <CheckCircle className="w-3 h-3 mr-1" /> Verified Diner
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-col gap-1 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 shrink-0" />
                              {dateStr}
                            </span>
                            {review.orderId && (
                              <Link
                                href={`/restaurant/orders/${review.orderId}`}
                                className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-primary hover:underline w-fit"
                              >
                                Order #{review.orderId.slice(-8).toUpperCase()}
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="hidden md:block w-px bg-border/80 self-stretch" />

                      {/* Review Content Column */}
                      <div className="flex-1 space-y-3.5 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <div className="bg-muted/60 px-3 py-1.5 rounded-xl border border-border flex items-center gap-2">
                              {renderStars(review.rating)}
                              <span className="font-black text-xs text-foreground">
                                {Number(review.rating || 0).toFixed(1)}
                              </span>
                            </div>

                            <Badge
                              variant="outline"
                              className={`text-xs font-bold ${
                                review.rating >= 4
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                  : review.rating >= 3
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                              }`}
                            >
                              {review.rating >= 4
                                ? 'Excellent'
                                : review.rating >= 3
                                ? 'Good'
                                : 'Needs Attention'}
                            </Badge>

                            {Number(review.deliveryRating || 0) > 0 && (
                              <Badge
                                variant="outline"
                                className="text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1"
                              >
                                <Bike className="w-3 h-3" /> Delivery {review.deliveryRating}★
                              </Badge>
                            )}
                          </div>

                          {Number(review.helpful || 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
                              <ThumbsUp className="w-3.5 h-3.5 text-primary" /> {review.helpful} Helpful
                            </span>
                          )}
                        </div>

                        {review.menuItemName && (
                          <div className="flex items-center gap-1.5 text-xs text-primary font-semibold bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-xl w-fit max-w-full">
                            <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Ordered: {review.menuItemName}</span>
                          </div>
                        )}

                        {Array.isArray(review.tags) && review.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {review.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-muted text-foreground/80 border border-border/70"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="relative bg-muted/30 rounded-2xl p-4 border border-border/50">
                          <Quote className="absolute top-3 left-3 w-5 h-5 text-primary/25 rotate-180" />
                          <p className="text-foreground text-sm sm:text-base leading-relaxed pl-6 italic">
                            &ldquo;{review.comment || 'Customer submitted a star rating.'}&rdquo;
                          </p>
                        </div>

                        {/* Review Photo Evidence */}
                        {review.images && review.images.length > 0 && (
                          <div className="flex flex-wrap gap-2.5 pt-1">
                            {review.images.map((img, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setLightboxImage(img)}
                                className="relative w-20 h-20 rounded-xl overflow-hidden border border-border group/img cursor-pointer shadow-xs"
                              >
                                <img
                                  src={img}
                                  alt={`Review photo ${idx + 1}`}
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-110"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                  <Search className="w-4 h-4 text-white" />
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Restaurant Reply Section */}
                        <div className="pt-3 border-t border-border/70">
                          {existingReply ? (
                            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 relative">
                              <div className="absolute top-0 left-0 w-1 h-full bg-primary rounded-l-2xl" />
                              <div className="flex items-center justify-between gap-2 mb-1.5 pl-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                                    <MessageSquare className="w-3 h-3" />
                                  </div>
                                  <span className="text-xs font-bold text-primary uppercase tracking-wide">
                                    Your Kitchen Reply
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {review.updatedAt && (
                                    <span className="text-[11px] text-muted-foreground">
                                      {toSafeDate(review.updatedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openReplyDialog(review)}
                                    className="h-7 px-2 text-xs text-primary hover:bg-primary/10 rounded-lg gap-1 cursor-pointer"
                                  >
                                    <Edit2 className="w-3 h-3" /> Edit
                                  </Button>
                                </div>
                              </div>
                              <p className="text-sm text-foreground pl-2">{existingReply}</p>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openReplyDialog(review)}
                              className="rounded-xl border-primary/30 text-primary hover:bg-primary/10 font-bold gap-2 cursor-pointer"
                            >
                              <MessageCircleReply className="w-4 h-4" />
                              Reply to {reviewerName.split(' ')[0]}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Reply Dialog with Quick Templates */}
      <Dialog
        open={responseDialog.open}
        onOpenChange={(open) => {
          if (!open) setResponseDialog({ open: false, review: null });
        }}
      >
        <DialogContent className="bg-card border-border text-card-foreground max-w-lg rounded-3xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
              <MessageSquare className="w-5 h-5 text-primary" />
              Respond to {responseDialog.review?.customerName || 'Customer'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Your response will be visible publicly to diners viewing this review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {responseDialog.review && (
              <div className="p-3.5 bg-muted/40 rounded-2xl border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-7 h-7 border border-border">
                      <AvatarImage
                        src={responseDialog.review.customerAvatar || undefined}
                        alt={responseDialog.review.customerName}
                        referrerPolicy="no-referrer"
                      />
                      <AvatarFallback className="text-[10px] font-bold bg-primary/15 text-primary">
                        {responseDialog.review.customerName.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-bold text-foreground">
                      {responseDialog.review.customerName}
                    </span>
                  </div>
                  {renderStars(responseDialog.review.rating, 'w-3.5 h-3.5')}
                </div>
                <p className="text-xs text-muted-foreground italic">
                  &ldquo;{responseDialog.review.comment || 'No comment text'}&rdquo;
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Quick Reply Templates
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_REPLY_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => setResponseText(tpl.text)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition cursor-pointer"
                  >
                    + {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              placeholder="Write your response here..."
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              rows={4}
              className="bg-background border-border focus:border-primary text-foreground placeholder:text-muted-foreground rounded-2xl resize-none"
            />
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setResponseDialog({ open: false, review: null })}
              className="text-muted-foreground hover:text-foreground rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRespondToReview}
              disabled={submitting || !responseText.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl shadow-md"
            >
              {submitting ? 'Publishing...' : 'Publish Reply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Lightbox Modal */}
      <Dialog
        open={Boolean(lightboxImage)}
        onOpenChange={(open) => {
          if (!open) setLightboxImage(null);
        }}
      >
        <DialogContent className="bg-black/95 border-zinc-800 max-w-2xl p-2 rounded-3xl overflow-hidden">
          <DialogTitle className="sr-only">Review Photo Preview</DialogTitle>
          {lightboxImage && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 z-10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={lightboxImage}
                alt="Customer review photo"
                className="w-full max-h-[80vh] object-contain rounded-2xl"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
