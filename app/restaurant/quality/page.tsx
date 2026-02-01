'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order, Review, MenuItem } from '@/lib/types';
import { TrendingUp, AlertCircle, CheckCircle, Star, Target, Award, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

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
        if (score >= 80) return 'text-emerald-400';
        if (score >= 60) return 'text-yellow-400';
        if (score >= 40) return 'text-orange-400';
        return 'text-red-400';
    };

    const getQualityGradient = (score: number) => {
        if (score >= 80) return 'from-emerald-500 to-green-600';
        if (score >= 60) return 'from-yellow-500 to-amber-600';
        if (score >= 40) return 'from-orange-500 to-red-500';
        return 'from-red-500 to-pink-600';
    };

    const getQualityBadge = (score: number) => {
        if (score >= 80) return { label: 'Excellent', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
        if (score >= 60) return { label: 'Good', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
        if (score >= 40) return { label: 'Fair', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' };
        return { label: 'Needs Improvement', color: 'bg-red-500/10 text-red-400 border-red-500/20' };
    };

    const avgQualityScore = qualityMetrics.length > 0
        ? Math.round(qualityMetrics.reduce((sum, m) => sum + m.qualityScore, 0) / qualityMetrics.length)
        : 0;

    if (authLoading || loading) {
        return (
            <div className="p-8 flex items-center justify-center h-[calc(100vh-100px)]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-t-green-500 border-r-emerald-500 border-b-teal-500 border-l-cyan-500 rounded-full animate-spin"></div>
                    <p className="text-gray-400 animate-pulse">Analyzing quality metrics...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-8 min-h-screen bg-[#0B0F17]/50">
            {/* Header */}
            <div>
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 bg-clip-text text-transparent flex items-center gap-3 drop-shadow-xl">
                        Quality Analytics
                    </h1>
                    <p className="text-gray-400 mt-2 text-lg font-light tracking-wide flex items-center gap-2">
                        <Zap className="w-4 h-4 text-emerald-400" />
                        AI-driven performance scoring & insights
                    </p>
                </motion.div>
            </div>

            {/* Overall Score Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative overflow-hidden group"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/40 via-blue-900/20 to-purple-900/40 blur-xl transition-all duration-500 group-hover:blur-2xl" />
                <Card className="relative p-8 bg-gray-900/40 border-gray-800 backdrop-blur-md shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <Award className="w-6 h-6 text-yellow-400" />
                            Overall Restaurant Score
                        </h2>
                        <p className="text-gray-400 max-w-md">
                            Aggregated score based on order success rate, customer satisfaction, and consistency across all menu items.
                        </p>
                        <div className="flex gap-4 mt-6">
                            <div className="flex items-center gap-2 bg-gray-800/50 px-3 py-1.5 rounded-lg border border-gray-700">
                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                <span className="text-xs text-gray-300">Success Rate</span>
                            </div>
                            <div className="flex items-center gap-2 bg-gray-800/50 px-3 py-1.5 rounded-lg border border-gray-700">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                                <span className="text-xs text-gray-300">Satisfaction</span>
                            </div>
                            <div className="flex items-center gap-2 bg-gray-800/50 px-3 py-1.5 rounded-lg border border-gray-700">
                                <div className="w-2 h-2 bg-purple-500 rounded-full" />
                                <span className="text-xs text-gray-300">Consistency</span>
                            </div>
                        </div>
                    </div>

                    <div className="relative text-center shrink-0">
                        <svg className="w-48 h-48 transform -rotate-90">
                            <circle cx="96" cy="96" r="88" className="stroke-gray-800" strokeWidth="12" fill="none" />
                            <motion.circle
                                cx="96" cy="96" r="88"
                                className={`stroke-current ${getQualityColor(avgQualityScore)}`}
                                strokeWidth="12"
                                fill="none"
                                strokeDasharray="553"
                                initial={{ strokeDashoffset: 553 }}
                                animate={{ strokeDashoffset: 553 - (553 * avgQualityScore) / 100 }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-5xl font-bold ${getQualityColor(avgQualityScore)} drop-shadow-lg`}>
                                {avgQualityScore}
                            </span>
                            <Badge variant="outline" className={`${getQualityBadge(avgQualityScore).color} mt-2`}>
                                {getQualityBadge(avgQualityScore).label}
                            </Badge>
                        </div>
                    </div>
                </Card>
            </motion.div>

            {/* Menu Items Quality Grid */}
            <div>
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 border-l-4 border-emerald-500 pl-3">
                    Menu Performance Metrics
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {qualityMetrics.length === 0 ? (
                        <div className="col-span-full p-16 text-center border border-gray-800 rounded-3xl bg-gray-900/30">
                            <Target className="w-20 h-20 mx-auto text-gray-700 mb-6" />
                            <h3 className="text-2xl font-bold text-white mb-2">No Data Available</h3>
                            <p className="text-gray-500">Performance metrics will appear once you have orders.</p>
                        </div>
                    ) : (
                        qualityMetrics.map((metric, index) => {
                            const qualityBadge = getQualityBadge(metric.qualityScore);
                            const gradient = getQualityGradient(metric.qualityScore);

                            return (
                                <motion.div
                                    key={metric.menuItemId}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                >
                                    <Card className="h-full bg-gray-900/40 border-gray-800 backdrop-blur-sm overflow-hidden hover:bg-gray-900/60 transition-colors group relative">
                                        <div className={`absolute top-0 w-full h-1 bg-gradient-to-r ${gradient}`} />

                                        <div className="p-6">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="font-bold text-white text-lg line-clamp-1" title={metric.menuItemName}>{metric.menuItemName}</h3>
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <Badge variant="outline" className={qualityBadge.color}>{qualityBadge.label}</Badge>
                                                        <span className="text-xs text-gray-500 font-mono">
                                                            {metric.totalOrders} orders
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className={`text-4xl font-bold ${getQualityColor(metric.qualityScore)}`}>
                                                    {metric.qualityScore}
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                {/* Success Rate */}
                                                <div>
                                                    <div className="flex justify-between text-xs mb-1 text-gray-400">
                                                        <span>Success Rate</span>
                                                        <span className="text-white">{metric.orderSuccessRate}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${metric.orderSuccessRate}%` }}
                                                            className="h-full bg-blue-500 rounded-full"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Satisfaction */}
                                                <div>
                                                    <div className="flex justify-between text-xs mb-1 text-gray-400">
                                                        <span>Satisfaction</span>
                                                        <span className="text-white flex items-center gap-1">
                                                            <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                                                            {metric.averageRating.toFixed(1)}
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${metric.customerSatisfaction}%` }}
                                                            className="h-full bg-emerald-500 rounded-full"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Consistency */}
                                                <div>
                                                    <div className="flex justify-between text-xs mb-1 text-gray-400">
                                                        <span>Consistency</span>
                                                        <span className="text-white">{metric.consistencyScore}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${metric.consistencyScore}%` }}
                                                            className="h-full bg-purple-500 rounded-full"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Smart Recommendations */}
                                            {metric.qualityScore < 70 && (
                                                <div className="mt-6 pt-4 border-t border-gray-800">
                                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                        <Zap className="w-3 h-3 text-yellow-500" /> Improvement Tips
                                                    </h4>
                                                    <ul className="space-y-1.5">
                                                        {metric.orderSuccessRate < 60 && (
                                                            <li className="text-xs text-red-300 flex items-start gap-1.5">
                                                                <ArrowDownRight className="w-3 h-3 shrink-0 mt-0.5" /> High cancellations. Check inventory.
                                                            </li>
                                                        )}
                                                        {metric.customerSatisfaction < 60 && (
                                                            <li className="text-xs text-orange-300 flex items-start gap-1.5">
                                                                <ArrowUpRight className="w-3 h-3 shrink-0 mt-0.5" /> Ratings dropping. Review recipe/portion.
                                                            </li>
                                                        )}
                                                        {metric.consistencyScore < 60 && (
                                                            <li className="text-xs text-purple-300 flex items-start gap-1.5">
                                                                <Target className="w-3 h-3 shrink-0 mt-0.5" /> Inconsistent ratings. Standardize prep.
                                                            </li>
                                                        )}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                </motion.div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
