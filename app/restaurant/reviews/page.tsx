'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Review } from '@/lib/types';
import { Star, MessageSquare, CheckCircle, User, Calendar, ShoppingBag, Image as ImageIcon } from 'lucide-react';

export default function ReviewsPage() {
    const router = useRouter();
    const { user, restaurant, loading: authLoading } = useRestaurantAuth();

    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all');
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

            // Sort by date, newest first
            reviewsList.sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

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
            alert('Response posted successfully!');
        } catch (error) {
            console.error('[Reviews] Error posting response:', error);
            alert('Failed to post response');
        } finally {
            setSubmitting(false);
        }
    };

    const renderStars = (rating: number) => {
        return (
            <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={`w-5 h-5 ${star <= rating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
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
            dist[review.rating as keyof typeof dist]++;
        });
        return dist;
    };

    const filteredReviews = ratingFilter === 'all'
        ? reviews
        : reviews.filter(r => r.rating === ratingFilter);

    const ratingDist = getRatingDistribution();
    const avgRating = calculateAverageRating();

    if (authLoading || loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-32 bg-muted rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-300 bg-clip-text text-transparent flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-500/30">
                            <Star className="w-7 h-7 text-white" />
                        </div>
                        Reviews & Ratings
                    </h1>
                    <p className="text-gray-200 mt-2 text-lg font-medium">Customer feedback and ratings</p>
                </div>
            </div>

            {/* Rating Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 bg-gray-900/50 border-gray-800 backdrop-blur-sm shadow-xl">
                    <div className="text-center">
                        <div className="text-6xl font-bold text-white mb-2">{avgRating}</div>
                        <div className="flex justify-center mb-2">
                            {renderStars(Math.round(parseFloat(avgRating)))}
                        </div>
                        <p className="text-sm text-gray-300 font-medium">Based on {reviews.length} reviews</p>
                    </div>
                </Card>

                <Card className="p-6 md:col-span-2 bg-gray-900/50 border-gray-800 backdrop-blur-sm shadow-xl">
                    <h3 className="font-bold text-white mb-4 text-lg">Rating Distribution</h3>
                    <div className="space-y-2">
                        {[5, 4, 3, 2, 1].map((rating) => (
                            <div key={rating} className="flex items-center gap-3">
                                <span className="text-sm font-medium w-8">{rating}⭐</span>
                                <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-yellow-400"
                                        style={{
                                            width: reviews.length > 0
                                                ? `${(ratingDist[rating as keyof typeof ratingDist] / reviews.length) * 100}%`
                                                : '0%'
                                        }}
                                    />
                                </div>
                                <span className="text-sm text-gray-300 font-medium w-12">
                                    {ratingDist[rating as keyof typeof ratingDist]}
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Filter */}
            <div className="flex flex-wrap gap-2">
                <Button
                    variant={ratingFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRatingFilter('all')}
                >
                    All Reviews ({reviews.length})
                </Button>
                {[5, 4, 3, 2, 1].map((rating) => (
                    <Button
                        key={rating}
                        variant={ratingFilter === rating ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setRatingFilter(rating)}
                    >
                        {rating} ⭐ ({ratingDist[rating as keyof typeof ratingDist]})
                    </Button>
                ))}
            </div>

            {/* Reviews List */}
            <div className="space-y-4">
                {filteredReviews.length === 0 ? (
                    <Card className="p-12 text-center">
                        <Star className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">No reviews yet</h3>
                        <p className="text-muted-foreground">
                            {ratingFilter !== 'all'
                                ? `No ${ratingFilter}-star reviews yet.`
                                : 'Reviews from customers will appear here.'}
                        </p>
                    </Card>
                ) : (
                    filteredReviews.map((review) => (
                        <Card key={review.id} className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                                    <User className="w-6 h-6 text-white" />
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-foreground">{review.customerName}</h3>
                                                {review.isVerified && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        Verified Purchase
                                                    </Badge>
                                                )}
                                            </div>
                                            {renderStars(review.rating)}
                                        </div>
                                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                                            <Calendar className="w-4 h-4" />
                                            {new Date(review.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>

                                    {review.menuItemName && (
                                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                                            <ShoppingBag className="w-4 h-4" />
                                            <span>{review.menuItemName}</span>
                                        </div>
                                    )}

                                    <p className="text-foreground mb-3">{review.comment}</p>

                                    {review.images && review.images.length > 0 && (
                                        <div className="flex gap-2 mb-3">
                                            {review.images.map((img, idx) => (
                                                <img
                                                    key={idx}
                                                    src={img}
                                                    alt="Review"
                                                    className="w-24 h-24 object-cover rounded-lg cursor-pointer hover:opacity-80"
                                                    onClick={() => window.open(img, '_blank')}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {review.response ? (
                                        <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-500 rounded">
                                            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                                                Restaurant Response:
                                            </p>
                                            <p className="text-sm text-blue-800 dark:text-blue-200">{review.response}</p>
                                        </div>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setResponseDialog({ open: true, review })}
                                            className="gap-2"
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                            Respond to Review
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* Response Dialog */}
            <Dialog open={responseDialog.open} onOpenChange={(open) => setResponseDialog({ open, review: null })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Respond to Review</DialogTitle>
                        <DialogDescription>
                            Your response will be visible to all customers
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {responseDialog.review && (
                            <div className="p-4 bg-secondary rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="font-medium">{responseDialog.review.customerName}</span>
                                    {renderStars(responseDialog.review.rating)}
                                </div>
                                <p className="text-sm text-muted-foreground">{responseDialog.review.comment}</p>
                            </div>
                        )}

                        <div>
                            <Textarea
                                placeholder="Write your response..."
                                value={responseText}
                                onChange={(e) => setResponseText(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setResponseDialog({ open: false, review: null })}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRespondToReview}
                            disabled={submitting || !responseText.trim()}
                            className="bg-gradient-to-r from-yellow-500 to-orange-500"
                        >
                            {submitting ? 'Posting...' : 'Post Response'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
