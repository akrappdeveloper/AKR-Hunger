'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Review } from '@/lib/types';
import {
    Star, MessageSquare, CheckCircle, User, Calendar, ShoppingBag,
    Quote, ArrowUpDown, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from '@/components/ui/input';

export default function ReviewsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useRestaurantAuth();

    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
    const [searchQuery, setSearchQuery] = useState('');

    const [responseDialog, setResponseDialog] = useState<{ open: boolean, review: Review | null }>({
        open: false,
        review: null
    });
    const [responseText, setResponseText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/restaurant/login');
            return;
        }
        loadReviews();
    }, [user, authLoading, router]);

    const loadReviews = async () => {
        try {
            setLoading(true);
            const reviewsRef = collection(db, 'reviews');
            const q = query(reviewsRef, where('restaurantId', '==', user!.uid));
            const snapshot = await getDocs(q);

            const reviewsList = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id,
            })) as Review[];

            setReviews(reviewsList);
        } catch (error) {
            console.error('[Reviews] Error loading:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRespondToReview = async () => {
        if (!responseDialog.review || !responseText.trim()) return;

        try {
            setSubmitting(true);
            await updateDoc(doc(db, 'reviews', responseDialog.review.id!), {
                response: responseText,
                updatedAt: new Date(),
            });

            setReviews(reviews.map(r =>
                r.id === responseDialog.review!.id
                    ? { ...r, response: responseText, updatedAt: new Date() }
                    : r
            ));

            setResponseDialog({ open: false, review: null });
            setResponseText('');
        } catch (error) {
            console.error('[Reviews] Error posting response:', error);
            alert('Failed to post response');
        } finally {
            setSubmitting(false);
        }
    };

    const renderStars = (rating: number) => {
        return (
            <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={`w-4 h-4 ${star <= rating
                            ? 'fill-yellow-400 text-yellow-400 drop-shadow-sm'
                            : 'text-gray-600 fill-gray-800/50'
                            }`}
                    />
                ))}
            </div>
        );
    };

    const calculateAverageRating = () => {
        if (reviews.length === 0) return 0;
        const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
        return (sum / reviews.length).toFixed(1);
    };

    const getRatingDistribution = () => {
        const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        reviews.forEach(review => {
            const r = Math.round(review.rating) as 1 | 2 | 3 | 4 | 5;
            if (dist[r] !== undefined) {
                dist[r]++;
            }
        });
        return dist;
    };

    // Filter and Sort Logic
    const filteredReviews = reviews.filter(r => {
        const matchesRating = ratingFilter === 'all' || Math.round(r.rating) === ratingFilter;
        const matchesSearch = r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.comment.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (r.menuItemName && r.menuItemName.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesRating && matchesSearch;
    }).sort((a, b) => {
        switch (sortBy) {
            case 'newest': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            case 'highest': return b.rating - a.rating;
            case 'lowest': return a.rating - b.rating;
            default: return 0;
        }
    });

    const ratingDist = getRatingDistribution();
    const avgRating = calculateAverageRating();

    if (authLoading || loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-screen bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-t-primary border-r-amber-500 border-b-purple-500 border-l-blue-500 rounded-full animate-spin"></div>
                    <p className="text-muted-foreground animate-pulse">Loading reviews...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 space-y-8 transition-colors duration-300 font-sans">
            {/* Elegant Header with Gradient Text */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h1 className="text-3xl md:text-5xl font-extrabold bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 bg-clip-text text-transparent flex items-center gap-3 drop-shadow-sm">
                            Customer Reviews
                        </h1>
                        <p className="text-muted-foreground mt-2 text-base md:text-lg font-light tracking-wide">
                            Insights from your valued customers
                        </p>
                    </motion.div>
                </div>
                {/* Search Bar */}
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search reviews..."
                        className="pl-9 bg-card border-border text-foreground placeholder:text-muted-foreground focus:ring-primary/50 focus:border-primary transition-all rounded-full"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Metrics Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Average Rating Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="relative overflow-hidden"
                >
                    <Card className="relative p-6 bg-card border-border shadow-sm h-full flex flex-col justify-center items-center">
                        <div className="text-center space-y-2">
                            <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">Average Rating</span>
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-6xl sm:text-7xl font-bold text-foreground tracking-tighter drop-shadow-sm">{avgRating}</span>
                                <div className="flex flex-col items-start gap-1">
                                    <Star className="w-8 h-8 fill-amber-400 text-amber-400 animate-pulse" />
                                    <span className="text-xs text-muted-foreground">/ 5.0</span>
                                </div>
                            </div>
                            <div className="flex justify-center my-2">
                                {renderStars(Math.round(parseFloat(avgRating as string)))}
                            </div>
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 px-4 py-1 rounded-full">
                                {reviews.length} Total Reviews
                            </Badge>
                        </div>
                    </Card>
                </motion.div>

                {/* Rating Distribution */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="col-span-1 lg:col-span-2 relative overflow-hidden"
                >
                    <Card className="relative p-6 md:p-8 bg-card border-border shadow-sm h-full">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                <ArrowUpDown className="w-5 h-5 text-primary" />
                                Rating Breakdown
                            </h3>
                        </div>
                        <div className="space-y-4">
                            {[5, 4, 3, 2, 1].map((rating) => {
                                const count = ratingDist[rating as keyof typeof ratingDist];
                                const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                                return (
                                    <div key={rating} className="flex items-center gap-4 group">
                                        <div className="flex items-center gap-1 w-12 justify-end">
                                            <span className="text-sm font-bold text-foreground">{rating}</span>
                                            <Star className="w-4 h-4 fill-muted-foreground/30 text-muted-foreground/40 group-hover:fill-amber-500 group-hover:text-amber-500 transition-colors" />
                                        </div>
                                        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden shadow-inner">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${percentage}%` }}
                                                transition={{ duration: 1, ease: "easeOut" }}
                                                className={`h-full rounded-full ${rating >= 4 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                                                        rating === 3 ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                                                            'bg-gradient-to-r from-red-400 to-red-600'
                                                    }`}
                                            />
                                        </div>
                                        <span className="text-sm text-muted-foreground w-12 text-right font-mono">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </motion.div>
            </div>

            {/* Filter & Sort Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card/90 p-2 rounded-xl border border-border backdrop-blur-sm sticky top-4 z-10 shadow-sm">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto scrollbar-hide">
                    <Button
                        variant={ratingFilter === 'all' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setRatingFilter('all')}
                        className={`rounded-full transition-all ${ratingFilter === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                    >
                        All
                    </Button>
                    {[5, 4, 3, 2, 1].map((rating) => (
                        <Button
                            key={rating}
                            variant={ratingFilter === rating ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setRatingFilter(rating)}
                            className={`rounded-full transition-all flex items-center gap-1 ${ratingFilter === rating ? 'bg-amber-500 text-amber-950 font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                        >
                            {rating} <Star className="w-3 h-3 fill-current" />
                        </Button>
                    ))}
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider hidden md:block">Sort By:</span>
                    <select
                        className="bg-card border border-border text-sm text-foreground rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-primary cursor-pointer hover:bg-muted transition-colors"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="highest">Highest Rated</option>
                        <option value="lowest">Lowest Rated</option>
                    </select>
                </div>
            </div>

            {/* Reviews List */}
            <div className="grid grid-cols-1 gap-6">
                <AnimatePresence mode='popLayout'>
                    {filteredReviews.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-card border border-border border-dashed rounded-2xl p-16 text-center"
                        >
                            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                                <MessageSquare className="w-10 h-10 text-muted-foreground opacity-50" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground mb-2">No reviews found</h3>
                            <p className="text-muted-foreground">Try adjusting your filters or wait for new feedback.</p>
                        </motion.div>
                    ) : (
                        filteredReviews.map((review, index) => (
                            <motion.div
                                key={review.id}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: index * 0.05 }}
                                layout
                            >
                                <Card className="overflow-hidden bg-card border-border hover:border-primary/40 hover:shadow-md transition-all duration-300 group shadow-sm">
                                    <div className="flex flex-col md:flex-row gap-6 p-6">
                                        {/* Reviewer Info */}
                                        <div className="flex md:flex-col items-center md:items-start gap-4 md:w-48 shrink-0">
                                            <Avatar className="w-14 h-14 border-2 border-border shadow-sm group-hover:scale-105 transition-transform duration-300">
                                                <AvatarImage src={review.customerAvatar} alt={review.customerName} />
                                                <AvatarFallback className="bg-primary/20 text-primary font-bold text-lg">
                                                    {review.customerName.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="text-center md:text-left">
                                                <h4 className="font-bold text-foreground text-base md:truncate max-w-[150px]" title={review.customerName}>
                                                    {review.customerName}
                                                </h4>
                                                <div className="flex flex-col gap-1 mt-1">
                                                    {review.isVerified && (
                                                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] w-fit mx-auto md:mx-0">
                                                            <CheckCircle className="w-3 h-3 mr-1" /> Verified
                                                        </Badge>
                                                    )}
                                                    <span className="text-xs text-muted-foreground flex items-center justify-center md:justify-start gap-1 mt-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {new Date(review.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Divider (Desktop) */}
                                        <div className="hidden md:block w-px bg-border self-stretch" />

                                        {/* Review Content */}
                                        <div className="flex-1 space-y-4">
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-muted/60 px-2.5 py-1 rounded-lg border border-border">
                                                            {renderStars(review.rating)}
                                                        </div>
                                                        <span className={`text-sm font-bold ${review.rating >= 4 ? 'text-emerald-600 dark:text-emerald-400' :
                                                                review.rating >= 3 ? 'text-amber-500' : 'text-destructive'
                                                            }`}>
                                                            {review.rating >= 4 ? 'Excellent' : review.rating >= 3 ? 'Good' : 'Poor'}
                                                        </span>
                                                    </div>
                                                    {review.menuItemName && (
                                                        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-primary font-medium bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-md w-fit mt-2">
                                                            <ShoppingBag className="w-3.5 h-3.5" />
                                                            Ordered: {review.menuItemName}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="relative">
                                                <Quote className="absolute -top-2 -left-2 w-6 h-6 text-muted-foreground/30 rotate-180" />
                                                <p className="text-foreground leading-relaxed pl-6 italic">
                                                    "{review.comment}"
                                                </p>
                                            </div>

                                            {/* Images Review */}
                                            {review.images && review.images.length > 0 && (
                                                <div className="flex flex-wrap gap-3 pt-2">
                                                    {review.images.map((img, idx) => (
                                                        <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group/img cursor-pointer shadow-sm" onClick={() => window.open(img, '_blank')}>
                                                            <img
                                                                src={img}
                                                                alt={`Review evidence ${idx}`}
                                                                className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110"
                                                            />
                                                            <div className="absolute inset-0 bg-background/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Search className="w-5 h-5 text-foreground" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Response Section */}
                                            <div className="pt-4 border-t border-border">
                                                {typeof review.response === 'string' ? (
                                                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 relative">
                                                        <div className="absolute top-0 left-0 w-1 h-full bg-primary rounded-l-xl" />
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                                                                <MessageSquare className="w-3 h-3" />
                                                            </div>
                                                            <span className="text-sm font-bold text-primary">Response from Restaurant</span>
                                                            <span className="text-xs text-muted-foreground ml-auto">{review.updatedAt ? new Date(review.updatedAt).toLocaleDateString() : ''}</span>
                                                        </div>
                                                        <p className="text-sm text-foreground pl-7">{review.response}</p>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setResponseDialog({ open: true, review })}
                                                        className="text-muted-foreground hover:text-foreground hover:bg-muted w-full sm:w-auto justify-start pl-0 gap-2 transition-colors"
                                                    >
                                                        <MessageSquare className="w-4 h-4" />
                                                        Write a public response...
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* Response Dialog */}
            <Dialog open={responseDialog.open} onOpenChange={(open) => setResponseDialog({ open, review: null })}>
                <DialogContent className="bg-card border-border text-card-foreground max-w-lg shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                            <MessageSquare className="w-5 h-5 text-primary" />
                            Respond to {responseDialog.review?.customerName}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Your response will be public and visible to all customers. Keep it professional and helpful.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {responseDialog.review && (
                            <div className="p-3 bg-muted/40 rounded-lg border border-border text-sm text-muted-foreground italic">
                                "{responseDialog.review.comment}"
                            </div>
                        )}
                        <Textarea
                            placeholder="Write your response here... (e.g., Thank you for your feedback! We are glad you enjoyed...)"
                            value={responseText}
                            onChange={(e) => setResponseText(e.target.value)}
                            rows={5}
                            className="bg-card border-border focus:border-primary text-foreground placeholder:text-muted-foreground resize-none"
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setResponseDialog({ open: false, review: null })}
                            className="text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRespondToReview}
                            disabled={submitting || !responseText.trim()}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-md"
                        >
                            {submitting ? 'Publishing...' : 'Publish Response'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
