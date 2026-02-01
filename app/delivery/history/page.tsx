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

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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

    // Order Details Dialog State
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    if (authLoading || loading) {
        return <div className="flex justify-center items-center h-screen bg-black text-white"><Loader /></div>;
    }

    const formatAddress = (addr: any): string => {
        if (!addr) return 'N/A';
        if (typeof addr === 'string') return addr;
        if (typeof addr === 'object') {
            const parts = [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean);
            return parts.join(', ');
        }
        return 'N/A';
    };

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-cyan-600 to-blue-600 p-4 sm:p-6 rounded-3xl shadow-2xl shadow-cyan-900/30 mb-6">
                    <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/20 via-transparent to-blue-500/20 animate-pulse" />
                    <div className="relative z-10">
                        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-lg">📋 Delivery History</h1>
                        <p className="text-white/90 mt-1 font-medium">View your past completed deliveries.</p>
                    </div>
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
                    filteredOrders.map((order, index) => (
                        <Card key={order.id || index} className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800/50 border-gray-700/50 text-white hover:border-gray-600 transition-all duration-500 hover:bg-gray-900/90 group backdrop-blur-sm shadow-xl hover:shadow-2xl hover:shadow-teal-900/10 animate-[fadeIn_0.5s_ease-out]" style={{ animationDelay: `${index * 0.05}s` }}>
                            <CardContent className="p-5 relative">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-teal-500/5 to-cyan-500/5 rounded-full blur-2xl group-hover:opacity-100 opacity-0 transition-opacity duration-500" />
                                <div className="flex flex-col md:flex-row gap-5 items-start md:items-center relative z-10">
                                    {/* Date Box */}
                                    <div className="flex flex-col items-center justify-center bg-gradient-to-br from-gray-800/90 to-gray-800/50 backdrop-blur-sm rounded-xl p-4 w-full md:w-24 text-center border border-gray-700/70 shadow-lg">
                                        <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                                            {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-US', { month: 'short' }) : 'N/A'}
                                        </span>
                                        <span className="text-3xl font-black text-white my-1">
                                            {order.createdAt?.toDate ? order.createdAt.toDate().getDate() : '-'}
                                        </span>
                                        <span className="text-[10px] text-gray-500 font-semibold">
                                            {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 space-y-2.5 w-full">
                                        <div className="flex justify-between items-start gap-3">
                                            <h3 className="font-black text-lg text-white group-hover:text-teal-300 transition-colors">{order.restaurantName}</h3>
                                            <Badge variant="secondary" className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 text-green-300 border-green-900/60 backdrop-blur-sm shadow-sm">
                                                <CheckCircle className="w-3 h-3 mr-1" /> Delivered
                                            </Badge>
                                        </div>

                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <MapPin className="w-4 h-4 text-teal-500" />
                                            <span className="truncate">{formatAddress(order.deliveryAddress)}</span>
                                        </div>

                                        <div className="flex items-center gap-4 text-xs text-gray-500 pt-1">
                                            <span className="font-mono">Order #{order.id?.slice(0, 8)}</span>
                                            <span className="flex items-center gap-1">
                                                <div className="w-1 h-1 rounded-full bg-gray-600"></div>
                                                {order.items?.length || 1} Items
                                            </span>
                                        </div>
                                    </div>

                                    {/* Amount & Action */}
                                    <div className="text-right w-full md:w-auto flex flex-row md:flex-col justify-between items-center md:items-end border-t md:border-t-0 border-gray-700/50 pt-4 md:pt-0 mt-3 md:mt-0 gap-3">
                                        <div>
                                            <p className="font-black text-2xl bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">₹{((order.deliveryCharge || 0) * 0.70).toFixed(2)}</p>
                                            <p className="text-xs text-green-500 font-bold tracking-wide">Earning</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => { setSelectedOrder(order); setDetailsOpen(true); }}
                                            className="text-teal-400 hover:text-white hover:bg-teal-900/20 -mr-2 md:-mr-3 transition-all duration-300 group/btn"
                                        >
                                            Details <ChevronRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Order Details Dialog */}
            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Order Details</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Complete breakdown of Order #{selectedOrder?.id?.slice(0, 8)}
                        </DialogDescription>
                    </DialogHeader>
                    {selectedOrder && (
                        <div className="space-y-6 pt-4">
                            {/* Status & Times */}
                            <div className="flex flex-wrap gap-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-gray-500" />
                                    <div>
                                        <p className="text-[10px] text-gray-500 uppercase">Placed At</p>
                                        <p className="text-sm font-medium">{selectedOrder.createdAt?.toDate ? selectedOrder.createdAt.toDate().toLocaleString() : 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                    <div>
                                        <p className="text-[10px] text-gray-500 uppercase">Delivered At</p>
                                        <p className="text-sm font-medium">{selectedOrder.deliveredAt?.toDate ? selectedOrder.deliveredAt.toDate().toLocaleString() : 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Addresses */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-400 uppercase mb-2">Restaurant</h4>
                                    <div className="space-y-1">
                                        <p className="font-bold text-white text-lg">{selectedOrder.restaurantName}</p>
                                        <p className="text-sm text-gray-400">{formatAddress(selectedOrder.restaurantAddress)}</p>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-gray-400 uppercase mb-2">Customer</h4>
                                    <div className="space-y-1">
                                        <p className="font-bold text-white text-lg">{selectedOrder.customerName || 'Guest'}</p>
                                        <p className="text-sm text-gray-400">{formatAddress(selectedOrder.deliveryAddress)}</p>
                                        <p className="text-sm text-blue-400">{selectedOrder.customerPhone || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="border-t border-gray-800 pt-4 flex justify-end">
                                <div className="w-full md:w-1/2 space-y-2">
                                    <div className="flex justify-between text-sm text-gray-400">
                                        <span>Order Total</span>
                                        <span>₹{(selectedOrder.total || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-400">
                                        <span>Delivery Charge (Total)</span>
                                        <span>₹{(selectedOrder.deliveryCharge || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-gray-800">
                                        <span>Your Earnings (70%)</span>
                                        <span className="text-green-400">₹{((selectedOrder.deliveryCharge || 0) * 0.70).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
