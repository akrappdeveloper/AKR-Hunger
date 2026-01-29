'use client';

import React, { useEffect, useState } from 'react';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, CheckCircle, Calendar, Filter, ChevronRight, DollarSign } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Order } from '@/lib/types';
import { Loader } from '@/components/ui/spinner';

type TimeFilter = 'all' | 'today' | 'week' | 'month';

export default function DeliveryHistoryPage() {
    const { user, loading: authLoading } = useDeliveryAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<TimeFilter>('all');

    useEffect(() => {
        if (!user) return;

        const fetchHistory = async () => {
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'orders'),
                    where('deliveryPersonId', '==', user.uid),
                    where('status', '==', 'delivered'),
                    orderBy('createdAt', 'desc')
                );
                const snapshot = await getDocs(q);
                const historyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
                setOrders(historyData);
            } catch (error) {
                console.error("Error fetching history:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [user]);

    // Filter Logic
    const filteredOrders = orders.filter(order => {
        if (filter === 'all') return true;

        if (!order.createdAt) return false;
        const orderDate = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
        const now = new Date();

        if (filter === 'today') {
            return orderDate.getDate() === now.getDate() &&
                orderDate.getMonth() === now.getMonth() &&
                orderDate.getFullYear() === now.getFullYear();
        }

        if (filter === 'week') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);
            return orderDate >= oneWeekAgo;
        }

        if (filter === 'month') {
            return orderDate.getMonth() === now.getMonth() &&
                orderDate.getFullYear() === now.getFullYear();
        }
        return true;
    });

    if (authLoading || loading) {
        return <div className="flex justify-center items-center h-screen bg-black text-white"><Loader /></div>;
    }

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Delivery History</h1>
                    <p className="text-gray-400 mt-1">View your past completed deliveries.</p>
                </div>

                <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-800">
                    {(['all', 'today', 'week', 'month'] as const).map((f) => (
                        <Button
                            key={f}
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilter(f)}
                            className={`rounded-md capitalize text-xs ${filter === f ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-transparent'}`}
                        >
                            {f}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                {filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-gray-900/30 border border-gray-800 border-dashed rounded-xl">
                        <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
                            <Clock className="w-8 h-8 text-gray-600" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-300">No deliveries found</h3>
                        <p className="text-gray-500 text-sm">Try changing the filter or complete more orders.</p>
                    </div>
                ) : (
                    filteredOrders.map(order => (
                        <Card key={order.id} className="bg-gray-900 border-gray-800 text-white hover:border-gray-700 transition-all hover:bg-gray-900/80 group">
                            <CardContent className="p-5">
                                <div className="flex flex-col md:flex-row gap-5 items-center">
                                    {/* Date Box */}
                                    <div className="flex flex-col items-center justify-center bg-gray-800 rounded-lg p-3 w-full md:w-20 text-center border border-gray-700">
                                        <span className="text-xs text-gray-400 uppercase font-bold">
                                            {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-US', { month: 'short' }) : 'N/A'}
                                        </span>
                                        <span className="text-2xl font-bold text-white">
                                            {order.createdAt?.toDate ? order.createdAt.toDate().getDate() : '-'}
                                        </span>
                                        <span className="text-[10px] text-gray-500">
                                            {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 space-y-2 w-full">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-lg">{order.restaurantName}</h3>
                                            <Badge variant="secondary" className="bg-green-900/30 text-green-400 border-green-900/50">
                                                <CheckCircle className="w-3 h-3 mr-1" /> Delivered
                                            </Badge>
                                        </div>

                                        <div className="flex items-center gap-3 text-sm text-gray-400">
                                            <MapPin className="w-4 h-4 text-gray-500" />
                                            <span className="truncate">{order.deliveryAddress as string}</span>
                                        </div>

                                        <div className="flex items-center gap-4 text-xs text-gray-500 pt-1">
                                            <span>Order #{order.id?.slice(0, 8)}</span>
                                            <span className="truncate">• {order.items?.length || 1} Items</span>
                                        </div>
                                    </div>

                                    {/* Amount & Action */}
                                    <div className="text-right w-full md:w-auto flex flex-row md:flex-col justify-between items-center md:items-end border-t md:border-t-0 border-gray-800 pt-4 md:pt-0 mt-2 md:mt-0">
                                        <div>
                                            <p className="font-bold text-xl text-white">${(order.total || 0).toFixed(2)}</p>
                                            <p className="text-xs text-green-500 font-medium">+ $2.50 Tip</p>
                                        </div>
                                        <Button variant="ghost" size="sm" className="text-blue-400 hover:text-white hover:bg-blue-600/20 -mr-3 hidden md:flex">
                                            Details <ChevronRight className="w-4 h-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
