'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/spinner';
import { MapPin, Clock, ArrowRight, DollarSign, Bike, RefreshCw } from 'lucide-react';
import { Order } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

export default function AvailableOrdersPage() {
    const router = useRouter();
    const { user, deliveryPartner, loading: authLoading } = useDeliveryAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/delivery/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!user) return;

        setLoading(true);

        // Query for orders that are 'ready' or 'preparing' but have NO delivery person assigned
        // Note: Firestore doesn't support inequality filters on multiple fields easily or checking for 'null' explicitly in complex queries sometimes requires care.
        // We'll query for status 'ready'/'preparing' and then client-side filter for unassigned if needed, or index properly.
        // Ideally: where('status', 'in', ['preparing', 'ready']), where('deliveryPersonId', '==', null)

        // For this implementation, let's assume unassigned orders have deliveryPersonId as null or empty string.
        const q = query(
            collection(db, 'orders'),
            where('status', 'in', ['confirmed', 'preparing', 'ready']),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Order[];

            // Filter locally for unassigned orders to be safe and flexible
            let availableOrders = fetchedOrders.filter(o => !o.deliveryPersonId);

            // Client-side filtering for targeted broadcasts
            if (user) {
                availableOrders = availableOrders.filter(order => {
                    // If no target list, it's public (or legacy) -> show it
                    if (!order.targetDeliveryIds || order.targetDeliveryIds.length === 0) return true;
                    // If target list exists, must include current user
                    return order.targetDeliveryIds.includes(user.uid);
                });
            }

            setOrders(availableOrders);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching available orders:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const acceptOrder = async (orderId: string) => {
        if (!user) return;

        // confirm
        // if (!confirm("Are you sure you want to accept this delivery?")) return; // Optional

        try {
            await updateDoc(doc(db, 'orders', orderId), {
                deliveryPersonId: user.uid,
                // Optionally update status to 'out_for_delivery' immediately or keep it 'ready' until they pickup?
                // Usually they accept first, then pick up. Let's keep status as is or change to 'driver_assigned' if we had that status.
                // For simplistic flow, we just assign.
                updatedAt: serverTimestamp()
            });
            toast.success("Order accepted! Go to Dashboard to start.");
            router.push('/delivery');
        } catch (error) {
            console.error("Error accepting order:", error);
            toast.error("Failed to accept order. It might have been taken.");
        }
    };

    if (authLoading || (user && loading)) {
        return (
            <div className="flex items-center justify-center h-screen bg-black text-white">
                <Loader />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gradient-to-r from-blue-900/20 to-black p-6 rounded-2xl border border-blue-900/30">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Marketplace</h1>
                    <p className="text-gray-400 mt-1">
                        Pick up available orders near you and start earning.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        className="bg-blue-600/10 border-blue-600/20 text-blue-400 hover:bg-blue-600/20"
                        onClick={() => window.location.reload()}
                    >
                        <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                    </Button>
                    <div className="bg-blue-600/10 px-4 py-2 rounded-full border border-blue-600/20 text-blue-400 text-sm font-medium">
                        {orders.length} Orders Available
                    </div>
                </div>
            </div>

            {/* Orders Grid */}
            {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mb-6">
                        <Bike className="w-10 h-10 text-gray-700" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-700 mb-2">No orders available right now</h2>
                    <p className="text-gray-500 max-w-md">Check back soon! New orders will appear here instantly when restaurants prepare them.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {orders.map(order => (
                        <Card key={order.id} className="bg-gray-900 border-gray-800 text-white overflow-hidden hover:border-gray-700 transition-all hover:shadow-2xl group flex flex-col h-full">
                            <div className="p-5 flex-1 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="bg-gray-800 rounded-lg p-2">
                                        <MapPin className="w-6 h-6 text-blue-500" />
                                    </div>
                                    <Badge className="bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/20">
                                        ₹{((order.deliveryCharge || 0) * 0.30).toFixed(2)} Earnings
                                    </Badge>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold truncate">{order.restaurantName}</h3>
                                    <p className="text-sm text-gray-400">Restaurant Location</p>
                                </div>

                                <div className="space-y-3 pt-2 border-t border-gray-800/50">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold">Deliver To</p>
                                            <p className="text-sm text-gray-300 line-clamp-2">{order.deliveryAddress as string}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-gray-400">
                                        <span className="flex items-center gap-1 bg-gray-800/50 px-2 py-1 rounded"><Clock className="w-3 h-3" /> ~30 min</span>
                                        <span className="flex items-center gap-1 bg-gray-800/50 px-2 py-1 rounded"><DollarSign className="w-3 h-3" /> COD</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-black/40 border-t border-gray-800">
                                <Button
                                    onClick={() => acceptOrder(order.id!)}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold group-hover:shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all"
                                >
                                    Accept Delivery <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
