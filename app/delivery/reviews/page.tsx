'use client';

import React, { useState, useEffect } from 'react';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/spinner';
import { Star, MessageSquare, ThumbsUp, Calendar } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';

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
                // Query reviews where targetId is the delivery person's UID and type is 'delivery'
                // Assuming a standard 'reviews' collection structure based on other panels
                // If collection doesn't exist yet, this will just return empty, which is fine.
                const q = query(
                    collection(db, 'reviews'),
                    where('targetId', '==', user.uid),
                    where('type', '==', 'delivery'),
                    orderBy('createdAt', 'desc')
                );

                const snapshot = await getDocs(q);
                const reviewData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setReviews(reviewData);

                // Calculate stats
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
                // Fallback or mock if needed for demo
            } finally {
                setLoading(false);
            }
        };

        fetchReviews();
    }, [user]);

    if (authLoading || (user && loading)) {
        return <div className="flex justify-center items-center h-screen bg-black text-white"><Loader /></div>;
    }

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">My Reviews</h1>
                <p className="text-gray-400 mt-1">See what customers are saying about your service.</p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gray-900 border-gray-800 text-white shadow-xl">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-4 bg-yellow-500/10 rounded-full text-yellow-500">
                            <Star className="w-8 h-8 fill-yellow-500" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold">{stats.average.toFixed(1)}</p>
                            <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Average Rating</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gray-900 border-gray-800 text-white shadow-xl">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-4 bg-blue-500/10 rounded-full text-blue-500">
                            <MessageSquare className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold">{stats.total}</p>
                            <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Total Reviews</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gray-900 border-gray-800 text-white shadow-xl">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-4 bg-green-500/10 rounded-full text-green-500">
                            <ThumbsUp className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold">{stats.fiveStar}</p>
                            <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold">5-Star Deliveries</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Reviews List */}
            <div className="space-y-4">
                {reviews.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-gray-900/30 border border-gray-800 border-dashed rounded-xl">
                        <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
                            <Star className="w-8 h-8 text-gray-600" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-300">No reviews yet</h3>
                        <p className="text-gray-500 text-sm">Complete more deliveries to get feedback!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {reviews.map((review) => (
                            <Card key={review.id} className="bg-gray-900/50 border-gray-800 backdrop-blur text-white hover:bg-gray-900 transition-colors">
                                <CardContent className="p-6 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center border border-gray-600 text-xs font-bold text-gray-300">
                                                {review.customerName?.charAt(0) || 'C'}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm">{review.customerName || 'Customer'}</p>
                                                <div className="flex text-yellow-500">
                                                    {[...Array(5)].map((_, i) => (
                                                        <Star key={i} className={`w-3 h-3 ${i < (review.rating || 0) ? 'fill-yellow-500' : 'text-gray-700 fill-gray-700'}`} />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        {review.createdAt && (
                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {review.createdAt.toDate ? format(review.createdAt.toDate(), 'MMM d, yyyy') : ''}
                                            </span>
                                        )}
                                    </div>

                                    {review.comment && (
                                        <p className="text-gray-300 text-sm leading-relaxed italic">
                                            "{review.comment}"
                                        </p>
                                    )}

                                    {review.orderId && (
                                        <div className="pt-2 border-t border-gray-800/50">
                                            <Badge variant="outline" className="text-[10px] text-gray-500 border-gray-800">
                                                Order #{review.orderId.slice(0, 8)}
                                            </Badge>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
