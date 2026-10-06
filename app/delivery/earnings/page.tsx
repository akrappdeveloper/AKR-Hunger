'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Loader } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { Order } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { IndianRupee, TrendingUp, Calendar, CreditCard, Wallet, AlertCircle, Clock, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function EarningsPage() {
    const router = useRouter();
    const { user, deliveryPartner, loading: authLoading } = useDeliveryAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [payouts, setPayouts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState<any[]>([]);

    const [withdrawOpen, setWithdrawOpen] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/delivery/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!user) return;
        setLoading(true);

        const ordersQuery = query(
            collection(db, 'orders'),
            where('deliveryPersonId', '==', user.uid),
            orderBy('createdAt', 'asc')
        );

        const payoutsQuery = query(
            collection(db, 'payout_requests'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );

        const getOrderEarning = (o: Order) => {
            if (o.status === 'returned_to_restaurant' || o.deliveryStatus === 'returned_to_restaurant') {
                return (o as any).cancellationCompensation || 20;
            }
            if (typeof (o as any).deliveryEarnings === 'number') {
                return (o as any).deliveryEarnings;
            }
            const charge = Number(o.deliveryCharge || (o as any).deliveryFee || 40);
            return Math.round(charge * 0.80);
        };

        const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
            const fetchedOrders = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Order))
                .filter(o => o.status === 'delivered' || o.status === 'returned_to_restaurant' || o.deliveryStatus === 'returned_to_restaurant');
            setOrders(fetchedOrders);

            // Real 7-day daily earnings aggregation
            const last7Days = Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                d.setHours(0, 0, 0, 0);
                return d;
            });

            const activeData = last7Days.map(dateObj => {
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                const dayTotal = fetchedOrders.reduce((sum, ord) => {
                    const rawDate = (ord as any).deliveredAt || (ord as any).returnedAt || ord.createdAt;
                    if (!rawDate) return sum;
                    const ordDate = rawDate.toDate ? rawDate.toDate() : new Date(rawDate);
                    if (
                        ordDate.getDate() === dateObj.getDate() &&
                        ordDate.getMonth() === dateObj.getMonth() &&
                        ordDate.getFullYear() === dateObj.getFullYear()
                    ) {
                        return sum + getOrderEarning(ord);
                    }
                    return sum;
                }, 0);

                return {
                    name: dayName,
                    total: dayTotal
                };
            });
            setChartData(activeData);
        });

        const unsubPayouts = onSnapshot(payoutsQuery, (snapshot) => {
            const fetchedPayouts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPayouts(fetchedPayouts);
        });

        setLoading(false);

        return () => {
            unsubOrders();
            unsubPayouts();
        };
    }, [user]);

    const getOrderEarning = (o: Order) => {
        if (o.status === 'returned_to_restaurant' || o.deliveryStatus === 'returned_to_restaurant') {
            return (o as any).cancellationCompensation || 20;
        }
        if (typeof (o as any).deliveryEarnings === 'number') {
            return (o as any).deliveryEarnings;
        }
        const charge = Number(o.deliveryCharge || (o as any).deliveryFee || 40);
        return Math.round(charge * 0.80);
    };

    const totalEarnings = orders.reduce((acc, curr) => acc + getOrderEarning(curr), 0);
    const totalWithdrawn = payouts.reduce((acc, curr) => curr.status === 'accepted' ? acc + (parseFloat(curr.amount) || 0) : acc, 0);
    const totalPending = payouts.reduce((acc, curr) => curr.status === 'pending' ? acc + (parseFloat(curr.amount) || 0) : acc, 0);
    const availableBalance = totalEarnings - (totalWithdrawn + totalPending);

    const handleWithdraw = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (!deliveryPartner?.bankDetails) {
            toast.error("Please add bank details in Settings first.");
            setWithdrawOpen(false);
            router.push('/delivery/settings');
            return;
        }

        const amount = parseFloat(withdrawAmount);
        if (isNaN(amount) || amount <= 0) return toast.error("Please enter a valid amount.");
        if (amount > availableBalance) return toast.error(`Insufficient balance. Max: ₹${availableBalance.toFixed(2)}`);

        setSubmitting(true);
        try {
            await addDoc(collection(db, 'payout_requests'), {
                userId: user.uid,
                userName: deliveryPartner.name,
                amount: amount,
                status: 'pending',
                bankDetails: deliveryPartner.bankDetails,
                createdAt: serverTimestamp(),
                email: user.email
            });
            toast.success("Withdrawal request submitted!");
            setWithdrawOpen(false);
            setWithdrawAmount('');
        } catch (error) {
            console.error(error);
            toast.error("Failed to submit request.");
        } finally {
            setSubmitting(false);
        }
    };

    if (authLoading || (user && loading)) {
        return <div className="flex items-center justify-center h-screen bg-transparent text-white"><Loader /></div>;
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const cardVariants = {
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <motion.div variants={cardVariants}>
                    <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-xl mb-1">
                        My <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">Earnings</span>
                    </h1>
                    <p className="text-gray-400 font-medium">Track your income and request payouts.</p>
                </motion.div>

                <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold h-12 px-6 shadow-lg shadow-green-900/40 rounded-xl">
                            <Wallet className="w-5 h-5 mr-2" /> Withdraw Funds
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-black/95 border-gray-800 text-white backdrop-blur-xl">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold">Withdraw Funds</DialogTitle>
                            <DialogDescription className="text-gray-400">Request a payout to your linked bank account.</DialogDescription>
                        </DialogHeader>

                        <div className="py-4 space-y-6">
                            <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl border border-gray-700/50 flex justify-between items-center">
                                <div>
                                    <p className="text-sm text-gray-400 font-medium uppercase tracking-wider mb-1">Available Balance</p>
                                    <p className="text-3xl font-black text-green-400">₹{availableBalance.toFixed(2)}</p>
                                </div>
                                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                                    <Wallet className="w-5 h-5 text-green-500" />
                                </div>
                            </div>

                            {!deliveryPartner?.bankDetails ? (
                                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex gap-3 text-red-300">
                                    <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                                    <div>
                                        <p className="font-bold text-red-400">No Bank Account Linked</p>
                                        <p className="text-sm opacity-80">Please add your bank details in Settings.</p>
                                        <Button variant="link" onClick={() => router.push('/delivery/settings')} className="p-0 h-auto text-red-300 underline mt-2">Go to Settings</Button>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleWithdraw} className="space-y-6">
                                    <div className="space-y-3">
                                        <Label htmlFor="amount" className="text-gray-300">Amount to Withdraw</Label>
                                        <div className="relative group">
                                            <IndianRupee className="absolute left-4 top-4 h-5 w-5 text-gray-500 group-focus-within:text-green-500 transition-colors" />
                                            <Input
                                                id="amount"
                                                type="number"
                                                value={withdrawAmount}
                                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                                className="bg-gray-900 border-gray-700 text-white pl-12 h-14 text-lg rounded-xl focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all font-mono"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                            Linked: {deliveryPartner.bankDetails.bankName} •••• {deliveryPartner.bankDetails.accountNumber.slice(-4)}
                                        </p>
                                    </div>
                                    <Button type="submit" disabled={submitting || availableBalance <= 0} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12 rounded-xl text-lg">
                                        {submitting ? 'Processing...' : 'Confirm Withdrawal'}
                                    </Button>
                                </form>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {[
                    { label: 'Total Earnings', value: totalEarnings, icon: IndianRupee, color: 'blue', sub: 'Gross Income' },
                    { label: 'Withdrawn', value: totalWithdrawn, icon: CreditCard, color: 'purple', sub: 'Paid Out' },
                    { label: 'Pending', value: totalPending, icon: Clock, color: 'yellow', sub: 'In Process' },
                    { label: 'Available', value: availableBalance, icon: Wallet, color: 'green', sub: 'Ready to Withdraw' },
                ].map((stat, idx) => (
                    <motion.div
                        key={idx}
                        variants={cardVariants}
                        whileHover={{ y: -5 }}
                        className={`relative overflow-hidden p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-xl group hover:border-${stat.color}-500/30 transition-all duration-300`}
                    >
                        <div className={`absolute -right-10 -top-10 w-32 h-32 bg-${stat.color}-500/10 rounded-full blur-3xl group-hover:bg-${stat.color}-500/20 transition-all duration-500`} />

                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-2xl bg-${stat.color}-500/10 text-${stat.color}-400 border border-${stat.color}-500/20 shadow-lg shadow-${stat.color}-900/10`}>
                                    <stat.icon className="w-6 h-6" />
                                </div>
                                <ArrowUpRight className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />
                            </div>
                            <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">{stat.label}</p>
                            <h2 className="text-3xl font-black text-white mt-1 group-hover:scale-105 transition-transform origin-left">₹{stat.value.toFixed(2)}</h2>
                            <p className="text-xs text-gray-500 mt-2 font-medium bg-white/5 inline-block px-2 py-0.5 rounded text-opacity-80">{stat.sub}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div variants={cardVariants} className="lg:col-span-2 bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-xl">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-xl text-white">Earnings Overview</h3>
                        <div className="flex gap-2 bg-white/5 p-1 rounded-lg">
                            <button className="px-3 py-1 bg-white/10 text-white rounded-md text-xs font-bold shadow-sm">Weekly</button>
                            <button className="px-3 py-1 text-gray-500 hover:text-white rounded-md text-xs font-medium transition-colors">Monthly</button>
                        </div>
                    </div>
                    <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis stroke="#6b7280" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#000000dd', borderColor: '#333', borderRadius: '12px', color: '#fff', backdropFilter: 'blur(10px)' }}
                                    itemStyle={{ color: '#60a5fa' }}
                                    cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="total"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorEarnings)"
                                    activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                <motion.div variants={cardVariants} className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-xl flex flex-col h-full">
                    <h3 className="font-bold text-xl text-white mb-6">Recent Activity</h3>
                    <div className="flex-1 overflow-auto custom-scrollbar pr-2 space-y-4">
                        {payouts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                                <Clock className="w-8 h-8 mb-2 opacity-50" />
                                <p className="text-sm">No recent transactions</p>
                            </div>
                        ) : (
                            payouts.map((req) => (
                                <motion.div
                                    whileHover={{ x: 5 }}
                                    key={req.id}
                                    className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-inner ${req.status === 'accepted' ? 'bg-green-500/20 text-green-400' :
                                                req.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                                            }`}>
                                            <IndianRupee className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-gray-200 group-hover:text-white transition-colors">Payout Request</p>
                                            <p className="text-[10px] text-gray-500 font-mono">{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString() : 'Just now'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-white tracking-wide">₹{parseFloat(req.amount).toFixed(0)}</p>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${req.status === 'accepted' ? 'text-green-500' :
                                                req.status === 'rejected' ? 'text-red-500' : 'text-yellow-500'
                                            }`}>{req.status}</span>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}
