'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/spinner';
import { MapPin, Clock, ArrowRight, DollarSign, Bike, RefreshCw, ShoppingBag, Navigation, ShieldCheck } from 'lucide-react';
import { Order } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function AvailableOrdersPage() {
    const router = useRouter();
    const { user, deliveryPartner, loading: authLoading } = useDeliveryAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    const isKycApproved =
        deliveryPartner?.kycStatus === 'approved' ||
        deliveryPartner?.verificationStatus === 'approved' ||
        (deliveryPartner as any)?.isVerified === true;

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/delivery/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!user) return;
        setLoading(true);

        const q = query(
            collection(db, 'orders'),
            where('status', 'in', ['confirmed', 'preparing', 'ready'])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id
            })) as Order[];

            // Sort in memory (newest first)
            fetchedOrders.sort((a, b) => {
                const timeA = a.createdAt?.seconds
                    ? a.createdAt.seconds * 1000
                    : (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime());
                const timeB = b.createdAt?.seconds
                    ? b.createdAt.seconds * 1000
                    : (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime());
                return timeB - timeA;
            });

            let availableOrders = fetchedOrders.filter(o => !o.deliveryPersonId);

            if (user) {
                availableOrders = availableOrders.filter(order => {
                    if (!order.targetDeliveryIds || order.targetDeliveryIds.length === 0) return true;
                    return order.targetDeliveryIds.includes(user.uid);
                });
            }

            // Strict Service Pincode Filtering
            const servicePincodes = (deliveryPartner as any)?.servicePincodes || [];
            const isPincodeFilterActive = (deliveryPartner as any)?.pincodeFilterActive === true && servicePincodes.length > 0;
            if (isPincodeFilterActive) {
                availableOrders = availableOrders.filter(order => {
                    const pins = new Set<string>();
                    if ((order as any).restaurantPincode) {
                        const p = String((order as any).restaurantPincode).trim();
                        if (/^\d{6}$/.test(p)) pins.add(p);
                    }
                    if (order.restaurantAddress && typeof order.restaurantAddress === 'string') {
                        const matches = order.restaurantAddress.match(/\b[1-9]\d{5}\b/g);
                        if (matches) matches.forEach(m => pins.add(m));
                    }
                    if (typeof order.deliveryAddress === 'object' && order.deliveryAddress) {
                        const addr = order.deliveryAddress as any;
                        if (addr.pincode && /^\d{6}$/.test(String(addr.pincode).trim())) pins.add(String(addr.pincode).trim());
                        if (addr.postalCode && /^\d{6}$/.test(String(addr.postalCode).trim())) pins.add(String(addr.postalCode).trim());
                        const combined = `${addr.street || ''} ${addr.city || ''} ${addr.fullAddress || ''} ${addr.address || ''}`;
                        const matches = combined.match(/\b[1-9]\d{5}\b/g);
                        if (matches) matches.forEach(m => pins.add(m));
                    } else if (typeof order.deliveryAddress === 'string') {
                        const matches = order.deliveryAddress.match(/\b[1-9]\d{5}\b/g);
                        if (matches) matches.forEach(m => pins.add(m));
                    }
                    if ((order as any).pincode && /^\d{6}$/.test(String((order as any).pincode).trim())) {
                        pins.add(String((order as any).pincode).trim());
                    }

                    if (pins.size > 0) {
                        return Array.from(pins).some(p => servicePincodes.includes(p));
                    }
                    return false;
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

        if (!isKycApproved) {
            toast.error("KYC Verification Required! Complete KYC in your profile before accepting orders.");
            router.push('/delivery/profile');
            return;
        }

        try {
            let currentRestaurantAddress = '';
            let restaurantPhone = '';
            let restaurantLat = 0;
            let restaurantLng = 0;
            const targetOrder = orders.find(o => o.id === orderId);

            if (targetOrder) {
                currentRestaurantAddress = targetOrder.restaurantAddress || '';
                if (targetOrder.restaurantId) {
                    try {
                        const restaurantDoc = await getDoc(doc(db, 'restaurants', targetOrder.restaurantId));
                        if (restaurantDoc.exists()) {
                            const data = restaurantDoc.data();
                            const fullAddr = data.street || data.address
                                ? `${data.street || data.address}${data.city ? ', ' + data.city : ''}${data.pincode ? ' - ' + data.pincode : ''}`
                                : data.address;
                            currentRestaurantAddress = fullAddr || data.name || 'Restaurant Location';
                            restaurantPhone = data.phone || '';
                            restaurantLat = data.latitude || data.coordinates?.latitude || 0;
                            restaurantLng = data.longitude || data.coordinates?.longitude || 0;
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
                restaurantPhone: restaurantPhone,
                restaurantLocation: { lat: restaurantLat, lng: restaurantLng },
                status: 'ready',
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
            <div className="flex items-center justify-center h-screen bg-transparent text-white">
                <Loader />
            </div>
        );
    }

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
            {/* KYC Barrier Banner */}
            {!isKycApproved && (
                <motion.div
                    variants={itemVariants}
                    className="p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-orange-500/15 border-2 border-amber-500/30 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shrink-0">
                            <ShieldCheck className="w-6 h-6 text-amber-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-white text-base">KYC Approval Required</h3>
                                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-mono">
                                    Action Required
                                </Badge>
                            </div>
                            <p className="text-gray-300 text-xs mt-0.5 max-w-xl">
                                You cannot accept marketplace orders until your KYC documents are verified. Submit your driving license and vehicle RC now.
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => router.push('/delivery/profile')}
                        className="w-full sm:w-auto h-11 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs gap-2 shadow-lg shadow-amber-500/30 shrink-0"
                    >
                        Complete KYC <ArrowRight className="w-4 h-4" />
                    </Button>
                </motion.div>
            )}

            {/* Header */}
            <motion.div variants={itemVariants} className="relative overflow-hidden p-8 rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/10 via-red-500/10 to-purple-500/10 animate-pulse" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/20 rounded-full blur-[100px]" />

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-orange-300 border-orange-500/30 bg-orange-500/10 uppercase tracking-widest text-[10px] px-2 py-0.5">Live Feed</Badge>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-lg">
                            Market<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">place</span>
                        </h1>
                        <p className="text-gray-400 mt-2 font-medium max-w-md">
                            Discover available orders near you. Pick up requests and boost your earnings today.
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="bg-white/5 hover:bg-white/10 text-white backdrop-blur-sm border border-white/10 rounded-xl"
                            onClick={() => window.location.reload()}
                        >
                            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                        </Button>
                        <div className="bg-gradient-to-r from-orange-500 to-red-600 px-6 py-3 rounded-2xl text-white font-bold shadow-lg shadow-orange-900/30 flex items-center gap-2">
                            <ShoppingBag className="w-5 h-5 fill-white/20" />
                            {orders.length} <span className="text-orange-100 font-normal text-sm">Available</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Orders Grid */}
            <AnimatePresence>
                {orders.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center py-32 text-center bg-white/[0.02] border border-white/5 border-dashed rounded-3xl"
                    >
                        <div className="w-24 h-24 bg-gradient-to-br from-gray-800 to-black rounded-full flex items-center justify-center mb-6 shadow-2xl relative">
                            <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping opacity-20" />
                            <Bike className="w-10 h-10 text-gray-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">No orders nearby</h2>
                        <p className="text-gray-500 max-w-md">Stay online! New delivery requests will appear here instantly when they become available.</p>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {orders.map((order, index) => (
                            <motion.div
                                key={order.id}
                                variants={itemVariants}
                                whileHover={{ y: -8, scale: 1.02 }}
                                className="group flex flex-col h-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-xl hover:shadow-orange-900/20 hover:border-orange-500/30 transition-all duration-300 relative"
                            >
                                {/* Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
                                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/20 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                <div className="p-6 flex-1 space-y-6 relative z-10">
                                    <div className="flex justify-between items-start">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500">
                                            <MapPin className="w-6 h-6 text-orange-400 drop-shadow-md" />
                                        </div>
                                        <Badge className="bg-green-500/20 text-green-300 border-green-500/30 backdrop-blur-md px-3 py-1 text-sm font-bold shadow-lg">
                                            +₹{(((order.deliveryCharge || (order as any).deliveryFee || 40) * 0.80)).toFixed(0)} Earnings (80%)
                                        </Badge>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-black text-white leading-tight group-hover:text-orange-300 transition-colors line-clamp-1">{order.restaurantName}</h3>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                                                <Clock className="w-3 h-3 text-blue-400" /> ~25 min
                                            </span>
                                            <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                                                <DollarSign className="w-3 h-3 text-green-400" /> COD
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-white/10">
                                        <div className="relative pl-4 space-y-3 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b from-orange-500/50 to-blue-500/50">
                                            <div>
                                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Pickup</p>
                                                <p className="text-sm text-gray-300 truncate">{order.restaurantAddress || 'Restaurant'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Dropoff</p>
                                                <p className="text-sm text-gray-300 truncate">{String(order.deliveryAddress)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 relative z-10 bg-white/[0.02] border-t border-white/5">
                                    <Button
                                        onClick={() => acceptOrder(order.id!)}
                                        className="w-full bg-white text-black hover:bg-gray-200 font-bold h-12 shadow-lg shadow-white/5 group-hover:shadow-white/20 transition-all scale-100 active:scale-95"
                                    >
                                        Accept Request <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
