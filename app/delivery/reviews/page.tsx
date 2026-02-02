'use client';

import React, { useState, useEffect } from 'react';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/spinner';
import { Star, MessageSquare, ThumbsUp, Calendar, Quote, BarChart3 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export default function DeliveryReviewsPage() {
    const { user, deliveryPartner, loading: authLoading } = useDeliveryAuth();
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        average: 0,
        total: 0,
        fiveStar: 0
    });

    useEffect(() => {
        if (!user) return;
        const fetchReviews = async () => {
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'reviews'),
                    where('targetId', '==', user.uid),
                    where('type', '==', 'delivery'),
                    orderBy('createdAt', 'desc')
                );
                const snapshot = await getDocs(q);
                const reviewData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setReviews(reviewData);

                const total = reviewData.length;
                const sum = reviewData.reduce((acc, curr: any) => acc + (curr.rating || 0), 0);
                const fiveStar = reviewData.filter((r: any) => r.rating === 5).length;

                setStats({
                    average: total > 0 ? sum / total : 0,
                    total,
                    fiveStar
                });

            } catch (error) {
                console.error("Error fetching reviews:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchReviews();
    }, [user]);

    if (authLoading || (user && loading)) return <div className="flex justify-center items-center h-screen bg-transparent text-white"><Loader /></div>;

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 100 } }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto pb-24 md:pb-8"
        >
            <motion.div variants={itemVariants} className="flex flex-col gap-2">
                <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-xl flex items-center gap-3">
                    <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
                    My Reviews
                </h1>
                <p className="text-gray-400 font-medium ml-1">Feedback from your happy customers.</p>
            </motion.div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Average Rating', value: stats.average.toFixed(1), icon: Star, color: 'yellow', sub: 'Star Rating', fill: true },
                    { label: 'Total Reviews', value: stats.total, icon: MessageSquare, color: 'blue', sub: 'All Time' },
                    { label: '5-Star Deliveries', value: stats.fiveStar, icon: ThumbsUp, color: 'green', sub: 'Perfect Service' }
                ].map((stat, idx) => (
                    <motion.div
                        key={idx}
                        variants={itemVariants}
                        whileHover={{ y: -5 }}
                        className={`relative overflow-hidden p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-xl group hover:border-${stat.color}-500/30 transition-all duration-300`}
                    >
                        <div className={`absolute -right-10 -top-10 w-32 h-32 bg-${stat.color}-500/10 rounded-full blur-3xl group-hover:bg-${stat.color}-500/20 transition-all duration-500`} />

                        <div className="relative z-10 flex items-center gap-6">
                            <div className={`p-4 rounded-2xl bg-${stat.color}-500/10 text-${stat.color}-400 border border-${stat.color}-500/20 shadow-lg shadow-${stat.color}-900/10 group-hover:scale-110 transition-transform duration-300`}>
                                <stat.icon className={`w-8 h-8 ${stat.fill ? 'fill-current' : ''}`} />
                            </div>
                            <div>
                                <h2 className="text-4xl font-black text-white mt-1 group-hover:scale-105 transition-transform origin-left">{stat.value}</h2>
                                <p className="text-gray-400 text-sm font-bold uppercase tracking-wider">{stat.label}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Reviews List */}
            <div className="space-y-6">
                <motion.h3 variants={itemVariants} className="text-xl font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-blue-500" /> Recent Feedback
                </motion.h3>

                <AnimatePresence>
                    {reviews.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center py-24 bg-white/[0.02] border border-white/5 border-dashed rounded-3xl"
                        >
                            <div className="w-20 h-20 bg-gradient-to-br from-gray-800 to-black rounded-full flex items-center justify-center mb-6 shadow-2xl relative">
                                <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-xl animate-pulse" />
                                <BarChart3 className="w-8 h-8 text-gray-500 relative z-10" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">No reviews yet</h3>
                            <p className="text-gray-500">Complete more deliveries to earn your first rating!</p>
                        </motion.div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {reviews.map((review, index) => (
                                <motion.div
                                    key={review.id}
                                    variants={itemVariants}
                                    whileHover={{ scale: 1.02 }}
                                    className="relative group bg-black/40 border border-white/10 p-6 rounded-3xl backdrop-blur-xl hover:shadow-2xl hover:border-yellow-500/20 transition-all duration-300"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl group-hover:bg-yellow-500/10 transition-all duration-500" />

                                    <div className="relative z-10 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center border border-white/10 shadow-lg text-lg font-bold text-white group-hover:scale-110 transition-transform">
                                                    {review.customerName?.charAt(0).toUpperCase() || 'C'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white text-lg">{review.customerName || 'Customer'}</p>
                                                    <div className="flex text-yellow-500 gap-0.5">
                                                        {[...Array(5)].map((_, i) => (
                                                            <Star key={i} className={`w-4 h-4 transition-all ${i < (review.rating || 0) ? 'fill-yellow-500' : 'text-gray-700 fill-gray-700'}`} />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            {review.createdAt && (
                                                <Badge variant="secondary" className="bg-white/5 hover:bg-white/10 text-gray-400 font-mono text-xs">
                                                    {review.createdAt.toDate ? format(review.createdAt.toDate(), 'MMM d') : ''}
                                                </Badge>
                                            )}
                                        </div>

                                        {review.comment && (
                                            <div className="relative pl-6 pt-2">
                                                <Quote className="absolute left-0 top-0 w-4 h-4 text-gray-600 -scale-x-100" />
                                                <p className="text-gray-300 text-sm leading-relaxed italic">
                                                    "{review.comment}"
                                                </p>
                                            </div>
                                        )}

                                        {review.orderId && (
                                            <div className="pt-4 border-t border-white/5 flex items-center gap-2">
                                                <Badge variant="outline" className="text-[10px] text-gray-500 border-gray-700/50 bg-gray-800/30 backdrop-blur-sm px-2 py-0.5 font-mono">
                                                    #{review.orderId.slice(0, 8)}
                                                </Badge>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
