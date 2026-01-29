'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, Review, MenuItem } from '@/lib/types';
import { TrendingUp, AlertCircle, CheckCircle, Star, Target, Award } from 'lucide-react';

interface ItemQuality {
    menuItemId: string;
    menuItemName: string;
    totalOrders: number;
    successfulOrders: number;
    cancelledOrders: number;
    averageRating: number;
    totalReviews: number;
    qualityScore: number;
    orderSuccessRate: number;
    customerSatisfaction: number;
    consistencyScore: number;
}

export default function QualityAnalyticsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useRestaurantAuth();

    const [qualityMetrics, setQualityMetrics] = useState<ItemQuality[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/restaurant/login');
            return;
        }
        calculateQualityMetrics();
    }, [user, authLoading, router]);

    const calculateQualityMetrics = async () => {
        try {
            setLoading(true);

            // Fetch menu items
            const menuRef = collection(db, 'menuItems');
            const menuQuery = query(menuRef, where('restaurantId', '==', user!.uid));
            const menuSnapshot = await getDocs(menuQuery);
            const menuItems = menuSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as MenuItem[];

            // Fetch orders
            const ordersRef = collection(db, 'orders');
            const ordersQuery = query(ordersRef, where('restaurantId', '==', user!.uid));
            const ordersSnapshot = await getDocs(ordersQuery);
            const orders = ordersSnapshot.docs.map(doc => doc.data()) as Order[];

            // Fetch reviews
            const reviewsRef = collection(db, 'reviews');
            const reviewsQuery = query(reviewsRef, where('restaurantId', '==', user!.uid));
            const reviewsSnapshot = await getDocs(reviewsQuery);
            const reviews = reviewsSnapshot.docs.map(doc => doc.data()) as Review[];

            // Calculate metrics for each menu item
            const metrics: ItemQuality[] = menuItems.map(item => {
                // Count orders for this item
                let totalOrders = 0;
                let successfulOrders = 0;
                let cancelledOrders = 0;

                orders.forEach(order => {
                    const hasItem = order.items?.some(orderItem =>
                        orderItem.menuItemId === item.id || orderItem.name === item.name
                    );
                    if (hasItem) {
                        totalOrders++;
                        if (order.status === 'delivered') successfulOrders++;
                        if (order.status === 'cancelled') cancelledOrders++;
                    }
                });

                // Get reviews for this item
                const itemReviews = reviews.filter(r => r.menuItemId === item.id);
                const averageRating = itemReviews.length > 0
                    ? itemReviews.reduce((sum, r) => sum + r.rating, 0) / itemReviews.length
                    : 0;

                // Calculate metrics
                const orderSuccessRate = totalOrders > 0 ? (successfulOrders / totalOrders) * 100 : 0;
                const customerSatisfaction = averageRating > 0 ? (averageRating / 5) * 100 : 0;

                // Consistency score based on rating variance
                const ratingVariance = itemReviews.length > 1
                    ? Math.sqrt(
                        itemReviews.reduce((sum, r) => sum + Math.pow(r.rating - averageRating, 2), 0) / itemReviews.length
                    )
                    : 0;
                const consistencyScore = itemReviews.length > 0
                    ? Math.max(0, 100 - (ratingVariance * 20))
                    : 50; // Default for no reviews

                // Final quality score (weighted average)
                const qualityScore = (
                    (orderSuccessRate * 0.4) +
                    (customerSatisfaction * 0.4) +
                    (consistencyScore * 0.2)
                );

                return {
                    menuItemId: item.id!,
                    menuItemName: item.name,
                    totalOrders,
                    successfulOrders,
                    cancelledOrders,
                    averageRating,
                    totalReviews: itemReviews.length,
                    qualityScore: Math.round(qualityScore),
                    orderSuccessRate: Math.round(orderSuccessRate),
                    customerSatisfaction: Math.round(customerSatisfaction),
                    consistencyScore: Math.round(consistencyScore),
                };
            });

            // Sort by quality score
            metrics.sort((a, b) => b.qualityScore - a.qualityScore);
            setQualityMetrics(metrics);
        } catch (error) {
            console.error('[Quality] Error calculating metrics:', error);
        } finally {
            setLoading(false);
        }
    };

    const getQualityColor = (score: number) => {
        if (score >= 80) return 'text-green-500';
        if (score >= 60) return 'text-yellow-500';
        if (score >= 40) return 'text-orange-500';
        return 'text-red-500';
    };

    const getQualityBadge = (score: number) => {
        if (score >= 80) return { label: 'Excellent', color: 'bg-green-500' };
        if (score >= 60) return { label: 'Good', color: 'bg-yellow-500' };
        if (score >= 40) return { label: 'Fair', color: 'bg-orange-500' };
        return { label: 'Needs Improvement', color: 'bg-red-500' };
    };

    const avgQualityScore = qualityMetrics.length > 0
        ? Math.round(qualityMetrics.reduce((sum, m) => sum + m.qualityScore, 0) / qualityMetrics.length)
        : 0;

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
            <div>
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-400 via-emerald-400 to-green-300 bg-clip-text text-transparent flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30">
                        <Target className="w-7 h-7 text-white" />
                    </div>
                    Quality Analytics
                </h1>
                <p className="text-gray-200 mt-2 text-lg font-medium">Automatic quality scoring based on performance</p>
            </div>

            {/* Overall Score */}
            <Card className="p-6 bg-gradient-to-r from-green-900/30 to-blue-900/30 border-green-500/30 backdrop-blur-sm shadow-xl">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-2">Overall Restaurant Quality</h2>
                        <p className="text-sm text-gray-300 font-medium">Average across all menu items</p>
                    </div>
                    <div className="text-center">
                        <div className={`text-6xl font-bold ${getQualityColor(avgQualityScore)}`}>
                            {avgQualityScore}
                        </div>
                        <Badge className={`${getQualityBadge(avgQualityScore).color} mt-2 font-bold`}>
                            {getQualityBadge(avgQualityScore).label}
                        </Badge>
                    </div>
                </div>
            </Card>

            {/* Formula Explanation */}
            <Card className="p-6">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    Quality Score Calculation
                </h3>
                <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        <span className="text-muted-foreground">
                            <strong>40%</strong> Order Success Rate (Delivered vs Cancelled)
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className="text-muted-foreground">
                            <strong>40%</strong> Customer Satisfaction (Average Rating)
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full" />
                        <span className="text-muted-foreground">
                            <strong>20%</strong> Consistency Score (Rating Variance)
                        </span>
                    </div>
                </div>
            </Card>

            {/* Menu Items Quality */}
            <div>
                <h2 className="text-xl font-bold text-foreground mb-4">Menu Item Quality Scores</h2>
                <div className="space-y-3">
                    {qualityMetrics.length === 0 ? (
                        <Card className="p-12 text-center">
                            <Target className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                            <h3 className="text-lg font-semibold text-foreground mb-2">No quality data yet</h3>
                            <p className="text-muted-foreground">
                                Quality scores will appear once you have orders and reviews
                            </p>
                        </Card>
                    ) : (
                        qualityMetrics.map((metric) => {
                            const qualityBadge = getQualityBadge(metric.qualityScore);

                            return (
                                <Card key={metric.menuItemId} className="p-6 bg-gray-800/50 border-gray-700 backdrop-blur-sm shadow-lg">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 className="font-semibold text-foreground text-lg">{metric.menuItemName}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge className={qualityBadge.color}>{qualityBadge.label}</Badge>
                                                <span className="text-sm text-muted-foreground">
                                                    {metric.totalReviews} reviews • {metric.totalOrders} orders
                                                </span>
                                            </div>
                                        </div>
                                        <div className={`text-4xl font-bold ${getQualityColor(metric.qualityScore)}`}>
                                            {metric.qualityScore}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Success Rate */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium text-muted-foreground">Order Success Rate</span>
                                                <span className="font-bold">{metric.orderSuccessRate}%</span>
                                            </div>
                                            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500"
                                                    style={{ width: `${metric.orderSuccessRate}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {metric.successfulOrders} delivered / {metric.cancelledOrders} cancelled
                                            </p>
                                        </div>

                                        {/* Customer Satisfaction */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium text-muted-foreground">Customer Satisfaction</span>
                                                <span className="font-bold">{metric.customerSatisfaction}%</span>
                                            </div>
                                            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-green-500"
                                                    style={{ width: `${metric.customerSatisfaction}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                                {metric.averageRating.toFixed(1)} avg rating
                                            </p>
                                        </div>

                                        {/* Consistency */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium text-muted-foreground">Consistency</span>
                                                <span className="font-bold">{metric.consistencyScore}%</span>
                                            </div>
                                            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-purple-500"
                                                    style={{ width: `${metric.consistencyScore}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {metric.consistencyScore >= 80 ? 'Very consistent' :
                                                    metric.consistencyScore >= 60 ? 'Fairly consistent' : 'Needs consistency'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Recommendations */}
                                    {metric.qualityScore < 60 && (
                                        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 border-l-4 border-yellow-500 rounded">
                                            <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                                                💡 Recommendations:
                                            </p>
                                            <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
                                                {metric.orderSuccessRate < 70 && (
                                                    <li>• Reduce cancellations by improving availability and communication</li>
                                                )}
                                                {metric.averageRating < 3.5 && (
                                                    <li>• Improve recipe quality based on customer feedback</li>
                                                )}
                                                {metric.consistencyScore < 60 && (
                                                    <li>• Standardize preparation to maintain consistent quality</li>
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </Card>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
