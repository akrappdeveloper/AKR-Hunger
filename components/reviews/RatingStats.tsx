'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getRestaurantRatingStats } from '@/lib/reviews';

interface RatingStatsProps {
    restaurantId: string;
}

export function RatingStats({ restaurantId }: RatingStatsProps) {
    const [stats, setStats] = useState<{
        averageRating: number;
        totalReviews: number;
        distribution: { [key: number]: number };
    }>({
        averageRating: 0,
        totalReviews: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            const data = await getRestaurantRatingStats(restaurantId);
            setStats(data);
            setLoading(false);
        };

        fetchStats();
    }, [restaurantId]);

    if (loading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="animate-pulse space-y-4">
                        <div className="h-20 bg-muted rounded" />
                        <div className="space-y-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-4 bg-muted rounded" />
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const renderStars = (rating: number) => {
        return (
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={`w-6 h-6 ${star <= Math.floor(rating)
                                ? 'fill-yellow-400 text-yellow-400'
                                : star === Math.ceil(rating) && rating % 1 !== 0
                                    ? 'fill-yellow-400/50 text-yellow-400'
                                    : 'fill-muted text-muted-foreground/30'
                            }`}
                    />
                ))}
            </div>
        );
    };

    return (
        <Card className="overflow-hidden">
            <CardHeader>
                <CardTitle>Customer Reviews</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Overall Rating */}
                <div className="flex items-center gap-6">
                    <div className="text-center">
                        <div className="text-5xl font-bold mb-2">{stats.averageRating.toFixed(1)}</div>
                        {renderStars(stats.averageRating)}
                        <p className="text-sm text-muted-foreground mt-2">
                            {stats.totalReviews} {stats.totalReviews === 1 ? 'review' : 'reviews'}
                        </p>
                    </div>

                    {/* Rating Distribution */}
                    <div className="flex-1 space-y-2">
                        {[5, 4, 3, 2, 1].map((rating) => {
                            const count = stats.distribution[rating] || 0;
                            const percentage =
                                stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;

                            return (
                                <div key={rating} className="flex items-center gap-3">
                                    <div className="flex items-center gap-1 w-12">
                                        <span className="text-sm font-medium">{rating}</span>
                                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                    </div>
                                    <Progress value={percentage} className="h-2 flex-1" />
                                    <span className="text-sm text-muted-foreground w-12 text-right">
                                        {count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
