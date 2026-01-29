'use client';

import { useState, useEffect } from 'react';
import { ReviewCard } from './ReviewCard';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { getRestaurantReviews } from '@/lib/reviews';
import type { Review } from '@/lib/types';
import { Loader2 } from 'lucide-react';

interface ReviewListProps {
    restaurantId: string;
}

export function ReviewList({ restaurantId }: ReviewListProps) {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<'recent' | 'rating' | 'helpful'>('recent');
    const [ratingFilter, setRatingFilter] = useState<number | undefined>(undefined);
    const [limit, setLimit] = useState(10);

    const fetchReviews = async () => {
        setLoading(true);
        try {
            const fetchedReviews = await getRestaurantReviews(restaurantId, {
                sortBy,
                ratingFilter,
                limitCount: limit,
            });
            setReviews(fetchedReviews);
        } catch (error) {
            console.error('Error fetching reviews:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, [restaurantId, sortBy, ratingFilter, limit]);

    const handleLoadMore = () => {
        setLimit(prev => prev + 10);
    };

    if (loading && reviews.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="recent">Most Recent</SelectItem>
                        <SelectItem value="rating">Highest Rated</SelectItem>
                        <SelectItem value="helpful">Most Helpful</SelectItem>
                    </SelectContent>
                </Select>

                <Select
                    value={ratingFilter?.toString() || 'all'}
                    onValueChange={(value) => setRatingFilter(value === 'all' ? undefined : parseInt(value))}
                >
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by rating" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Ratings</SelectItem>
                        <SelectItem value="5">5 Stars</SelectItem>
                        <SelectItem value="4">4 Stars</SelectItem>
                        <SelectItem value="3">3 Stars</SelectItem>
                        <SelectItem value="2">2 Stars</SelectItem>
                        <SelectItem value="1">1 Star</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Reviews List */}
            {reviews.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-lg">
                    <p className="text-muted-foreground">No reviews yet. Be the first to review!</p>
                </div>
            ) : (
                <>
                    <div className="space-y-4">
                        {reviews.map((review) => (
                            <ReviewCard
                                key={review.id}
                                review={review}
                                onHelpfulUpdate={fetchReviews}
                            />
                        ))}
                    </div>

                    {/* Load More */}
                    {reviews.length >= limit && (
                        <div className="flex justify-center pt-4">
                            <Button
                                variant="outline"
                                onClick={handleLoadMore}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    'Load More Reviews'
                                )}
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
