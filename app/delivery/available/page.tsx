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
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
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
                ...doc.data(),
                id: doc.id
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
        if (!user) {
            toast.error("You must be logged in to accept orders");
            return;
        }

        if (!orderId) {
            toast.error("Invalid order ID");
            return;
        }

        try {
            // Fetch restaurant address if missing
            // Similar logic to dashboard page to ensure consistency
            // check if we have the order in state
            let currentRestaurantAddress = '';

            const targetOrder = orders.find(o => o.id === orderId);

            if (targetOrder) {
                currentRestaurantAddress = targetOrder.restaurantAddress || '';
                if (!currentRestaurantAddress && targetOrder.restaurantId) {
                    try {
                        const restaurantDoc = await getDoc(doc(db, 'restaurants', targetOrder.restaurantId));
                        if (restaurantDoc.exists()) {
                            const data = restaurantDoc.data();
                            currentRestaurantAddress = data.address || '';
                        }
                    } catch (err) {
                        console.error("Error fetching restaurant address", err);
                    }
                }
            }


            await updateDoc(doc(db, 'orders', orderId), {
                deliveryPersonId: user.uid,
                deliveryPersonName: deliveryPartner?.name || 'Assigned Partner',
                deliveryPersonPhone: deliveryPartner?.phone || '',
                deliveryVehicle: deliveryPartner?.vehicle || 'Vehicle',
                restaurantAddress: currentRestaurantAddress || 'Unknown Location',
                status: 'ready', // Keep status ready until pickup
                deliveryStatus: 'going_to_restaurant',
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
            <div className="relative overflow-hidden bg-gradient-to-br from-orange-600 via-red-600 to-pink-600 p-4 sm:p-6 rounded-3xl shadow-2xl shadow-red-900/30">
                <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/20 via-transparent to-pink-500/20 animate-pulse" />
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-lg">🛒 Marketplace</h1>
                        <p className="text-white/90 mt-1 font-medium">
                            Pick up available orders near you and start earning.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-white/20 border-white/30 text-white hover:bg-white/30 backdrop-blur-sm"
                            onClick={() => window.location.reload()}
                        >
                            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                        </Button>
                        <div className="bg-white/20 px-4 py-2 rounded-full border border-white/30 text-white text-sm font-bold backdrop-blur-sm shadow-lg">
                            {orders.length} Orders Available
                        </div>
                    </div>
                </div>
            </div>

            {/* Orders Grid */}
            {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center bg-gray-900/30 border border-gray-800 border-dashed rounded-2xl">
                    <div className="w-24 h-24 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center mb-6 shadow-2xl">
                        <Bike className="w-12 h-12 text-gray-600" />
                    </div>
                    <h2 className="text-2xl font-black text-gray-300 mb-2">No orders available right now</h2>
                    <p className="text-gray-500 max-w-md">Check back soon! New orders will appear here instantly when restaurants prepare them.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {orders.map((order, index) => (
                        <Card key={order.id} className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800/50 border-gray-700/50 text-white overflow-hidden hover:border-gray-600 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-900/20 group flex flex-col h-full backdrop-blur-sm animate-[fadeIn_0.5s_ease-out]" style={{ animationDelay: `${index * 0.1}s` }}>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-3xl group-hover:opacity-100 opacity-0 transition-opacity duration-500" />
                            <div className="p-5 flex-1 space-y-4 relative z-10">
                                <div className="flex justify-between items-start">
                                    <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/10 backdrop-blur-sm rounded-xl p-3 border border-blue-600/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                                        <MapPin className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <Badge className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 hover:from-green-500/30 hover:to-emerald-500/30 border-green-500/40 backdrop-blur-sm font-bold shadow-lg">
                                        ₹{((order.deliveryCharge || 0) * 0.40).toFixed(2)} Earnings
                                    </Badge>
                                </div>

                                <div>
                                    <h3 className="text-xl font-black truncate text-white group-hover:text-blue-300 transition-colors">{order.restaurantName}</h3>
                                    <p className="text-sm text-gray-500 font-medium">Restaurant Location</p>
                                </div>

                                <div className="space-y-3 pt-3 border-t border-gray-700/50">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Deliver To</p>
                                            <p className="text-sm text-gray-300 line-clamp-2 leading-relaxed">{order.deliveryAddress as string}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-400">
                                        <span className="flex items-center gap-1.5 bg-gray-800/70 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-700/50">
                                            <Clock className="w-3.5 h-3.5 text-blue-400" /> ~30 min
                                        </span>
                                        <span className="flex items-center gap-1.5 bg-gray-800/70 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-700/50">
                                            <DollarSign className="w-3.5 h-3.5 text-green-400" /> COD
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-gradient-to-br from-black/60 to-black/40 backdrop-blur-sm border-t border-gray-700/50 relative z-10">
                                <Button
                                    onClick={() => acceptOrder(order.id!)}
                                    className="w-full bg-gradient-to-r from-blue-600 via-blue-700 to-blue-600 hover:from-blue-700 hover:via-blue-800 hover:to-blue-700 text-white font-bold shadow-xl shadow-blue-900/40 group-hover:shadow-blue-900/60 transition-all duration-300 hover:scale-[1.02] h-11"
                                >
                                    Accept Delivery <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
