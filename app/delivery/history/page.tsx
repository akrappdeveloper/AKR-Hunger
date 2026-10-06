'use client';

import React, { useEffect, useState } from 'react';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, CheckCircle, Calendar, Filter, ChevronRight, DollarSign, Package, ShoppingBag } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Order } from '@/lib/types';
import { Loader } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { motion, AnimatePresence } from 'framer-motion';

type TimeFilter = 'all' | 'today' | 'week' | 'month';

export default function DeliveryHistoryPage() {
    const { user, loading: authLoading } = useDeliveryAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<TimeFilter>('all');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    useEffect(() => {
        if (!user) return;
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'orders'),
                    where('deliveryPersonId', '==', user.uid),
                    orderBy('createdAt', 'desc')
                );
                const snapshot = await getDocs(q);
                const historyData = snapshot.docs
                    .map(doc => ({ ...doc.data(), id: doc.id } as Order))
                    .filter(o => o.status === 'delivered' || o.status === 'returned_to_restaurant' || o.deliveryStatus === 'returned_to_restaurant');
                setOrders(historyData);
            } catch (error) {
                console.error("Error fetching history:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [user]);

    const getOrderEarning = (order: Order) => {
        if (order.status === 'returned_to_restaurant' || order.deliveryStatus === 'returned_to_restaurant') {
            return (order as any).cancellationCompensation || 20;
        }
        if (typeof (order as any).deliveryEarnings === 'number') {
            return (order as any).deliveryEarnings;
        }
        const charge = Number(order.deliveryCharge || (order as any).deliveryFee || 40);
        return Math.round(charge * 0.80);
    };

    const filteredOrders = orders.filter(order => {
        if (filter === 'all') return true;
        if (!order.createdAt) return false;
        const orderDate = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
        const now = new Date();
        if (filter === 'today') return orderDate.getDate() === now.getDate() && orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
        if (filter === 'week') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);
            return orderDate >= oneWeekAgo;
        }
        if (filter === 'month') return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
        return true;
    });

    if (authLoading || loading) return <div className="flex justify-center items-center h-screen bg-transparent"><Loader /></div>;

    const formatAddress = (addr: any) => {
        if (!addr) return 'N/A';
        if (typeof addr === 'string') return addr;
        if (typeof addr === 'object') return [addr.street, addr.city, addr.pincode].filter(Boolean).join(', ');
        return 'N/A';
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto pb-24 md:pb-8"
        >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <motion.div variants={itemVariants}>
                    <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-xl mb-1">
                        Delivery <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-500">History</span>
                    </h1>
                    <p className="text-gray-400 font-medium">Archive of your completed deliveries.</p>
                </motion.div>

                <motion.div variants={itemVariants} className="flex bg-black/40 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-lg">
                    {(['all', 'today', 'week', 'month'] as const).map((f) => (
                        <Button
                            key={f}
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilter(f)}
                            className={`rounded-lg capitalize text-xs font-medium px-4 transition-all duration-300 ${filter === f ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                        >
                            {f}
                        </Button>
                    ))}
                </motion.div>
            </div>

            <div className="space-y-4">
                <AnimatePresence mode='popLayout'>
                    {filteredOrders.length === 0 ? (
                        <motion.div
                            key="empty-state"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center py-32 bg-white/[0.02] border border-white/5 border-dashed rounded-3xl"
                        >
                            <div className="w-20 h-20 bg-gradient-to-br from-gray-800 to-black rounded-full flex items-center justify-center mb-6 shadow-2xl">
                                <Clock className="w-8 h-8 text-gray-500" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-1">No deliveries found</h3>
                            <p className="text-gray-500 text-sm">Adjust your filters to see more history.</p>
                        </motion.div>
                    ) : (
                        filteredOrders.map((order) => (
                            <motion.div
                                key={order.id}
                                variants={itemVariants}
                                layout
                                whileHover={{ scale: 1.01 }}
                                onClick={() => { setSelectedOrder(order); setDetailsOpen(true); }}
                                className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/5 bg-black/40 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:border-blue-500/30 transition-all duration-300"
                            >
                                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-600/10 to-cyan-600/10 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center relative z-10">
                                    {/* Date Column */}
                                    <div className="flex flex-col items-center justify-center bg-white/5 rounded-2xl p-4 w-full md:w-24 border border-white/5 group-hover:bg-blue-600/10 group-hover:border-blue-500/20 transition-all duration-300">
                                        <span className="text-xs text-gray-500 font-bold uppercase tracking-wider group-hover:text-blue-300">
                                            {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-US', { month: 'short' }) : 'N/A'}
                                        </span>
                                        <span className="text-3xl font-black text-white my-1 group-hover:text-blue-100 transition-colors">
                                            {order.createdAt?.toDate ? order.createdAt.toDate().getDate() : '-'}
                                        </span>
                                        <span className="text-[10px] text-gray-500 font-mono">
                                            {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                    </div>

                                    {/* Info Column */}
                                    <div className="flex-1 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <h3 className="text-xl font-black text-white group-hover:text-blue-300 transition-colors">{order.restaurantName}</h3>
                                            {order.status === 'returned_to_restaurant' || order.deliveryStatus === 'returned_to_restaurant' ? (
                                                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 font-bold px-2 py-0.5">
                                                    RETURNED
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-400 font-bold px-2 py-0.5">
                                                    DELIVERED
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                                            <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
                                            <span className="truncate">{formatAddress(order.deliveryAddress)}</span>
                                        </div>

                                        <div className="flex gap-4 text-xs font-medium text-gray-500">
                                            <span className="bg-white/5 px-2 py-1 rounded-md border border-white/5 font-mono">#{order.id?.slice(0, 8)}</span>
                                            <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                                                <Package className="w-3 h-3" /> {order.items?.length || 1} Items
                                            </span>
                                        </div>
                                    </div>

                                    {/* Price Column */}
                                    <div className="text-right flex flex-row md:flex-col justify-between items-center md:items-end w-full md:w-auto border-t md:border-t-0 border-white/5 pt-4 md:pt-0 mt-2 md:mt-0">
                                        <div>
                                            <p className="font-black text-2xl text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                                                ₹{getOrderEarning(order).toFixed(0)}
                                            </p>
                                            <p className="text-[10px] text-green-500 uppercase font-bold tracking-wider">
                                                {order.status === 'returned_to_restaurant' ? 'Compensation' : '80% Earning'}
                                            </p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="md:hidden text-gray-400">
                                            <ChevronRight className="w-5 h-5" />
                                        </Button>
                                    </div>
                                    <ChevronRight className="hidden md:block w-6 h-6 text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="bg-black/90 border-white/10 text-white max-w-2xl backdrop-blur-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            <ShoppingBag className="w-5 h-5 text-blue-500" />
                            Order Details
                        </DialogTitle>
                        <DialogDescription className="text-gray-400 font-mono">
                            #{selectedOrder?.id?.slice(0, 8)}
                        </DialogDescription>
                    </DialogHeader>
                    {selectedOrder && (
                        <div className="space-y-6 pt-4">
                            <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Total Amount</p>
                                    <p className="text-2xl font-black text-white">₹{selectedOrder.total?.toFixed(0)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Your Earning</p>
                                    <p className="text-2xl font-black text-green-400">₹{getOrderEarning(selectedOrder).toFixed(0)}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center gap-1 pt-1.5">
                                        <div className="w-3 h-3 rounded-full bg-orange-500 outline outline-4 outline-orange-500/20" />
                                        <div className="w-0.5 h-full bg-white/10" />
                                        <div className="w-3 h-3 rounded-full bg-blue-500 outline outline-4 outline-blue-500/20" />
                                    </div>
                                    <div className="space-y-6 flex-1 py-1">
                                        <div>
                                            <p className="font-bold text-white text-lg">{selectedOrder.restaurantName}</p>
                                            <p className="text-sm text-gray-400">{formatAddress(selectedOrder.restaurantAddress)}</p>
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-lg">{selectedOrder.customerName || 'Customer'}</p>
                                            <p className="text-sm text-gray-400">{formatAddress(selectedOrder.deliveryAddress)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-6 border-t border-white/10 text-xs text-gray-500 font-mono">
                                <span>Placed: {selectedOrder.createdAt?.toDate?.().toLocaleString()}</span>
                                <span>Delivered: {selectedOrder.deliveredAt?.toDate?.().toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
