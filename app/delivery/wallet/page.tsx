'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Card } from '@/components/ui/card';
import { Loader } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, increment, serverTimestamp, addDoc } from 'firebase/firestore';
import { IndianRupee, Wallet, CreditCard, AlertTriangle, CheckCircle, Clock, ArrowRight, History } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { loadRazorpayScript } from '@/lib/razorpay';


// Temporary Mock for Payment Creation if server action doesn't exist
// Ideally this should call your API endpoint
const createMockPayment = async (amount: number) => {
    return new Promise<{ id: string }>((resolve) => setTimeout(() => resolve({ id: `order_${Date.now()}` }), 1000));
};

export default function WalletPage() {
    const router = useRouter();
    const { user, deliveryPartner, loading: authLoading } = useDeliveryAuth();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/delivery/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!user) return;
        setLoading(true);

        // Listen for Wallet Transactions
        const q = query(
            collection(db, 'deliveryPersons', user.uid, 'walletTransactions'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTransactions(txs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const walletBalance = deliveryPartner?.walletBalance || 0;
    const isLocked = walletBalance > 2000;

    const handlePayment = async () => {
        if (!user || walletBalance <= 0) return;
        setPaying(true);

        try {
            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) {
                throw new Error("Razorpay SDK failed to load");
            }

            // Create Order on Server (Simulated/API)
            // Replace with actual API call

            // Assuming 100% of debt is being paid
            const amountToPay = walletBalance;

            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_YourKeyHere', // Fallback for dev
                amount: amountToPay * 100,
                currency: "INR",
                name: "Hunger",
                description: "Clear Cash in Hand Dues",
                image: "/hunger.png",
                handler: async function (response: any) {
                    try {
                        // Verify Payment on Backend
                        // For now, doing direct update (secure only with rules or server action)
                        const driverRef = doc(db, 'deliveryPersons', user.uid);
                        await updateDoc(driverRef, {
                            walletBalance: increment(-amountToPay)
                        });

                        await addDoc(collection(driverRef, 'walletTransactions'), {
                            amount: amountToPay,
                            type: 'payment',
                            description: 'Cleared Dues via Razorpay',
                            paymentId: response.razorpay_payment_id,
                            isDebit: false, // Reduces debt
                            createdAt: serverTimestamp()
                        });

                        toast.success("Payment Successful! Dues cleared.");
                    } catch (err) {
                        toast.error("Payment verification failed");
                        console.error(err);
                    }
                },
                prefill: {
                    name: deliveryPartner?.name,
                    email: deliveryPartner?.email,
                    contact: deliveryPartner?.phone,
                },
                theme: {
                    color: "#22c55e",
                },
                modal: {
                    ondismiss: () => setPaying(false)
                }
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.open();

        } catch (error) {
            console.error("Payment Error:", error);
            toast.error("Failed to initiate payment");
        } finally {
            setPaying(false);
        }
    };

    if (authLoading || (user && loading)) {
        return <div className="flex items-center justify-center h-screen bg-transparent text-white"><Loader /></div>;
    }

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto pb-24 md:pb-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-2">
                        Delivery <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Wallet</span>
                    </h1>
                    <p className="text-gray-400">Manage your earnings and cash collections.</p>
                </div>
                {isLocked && (
                    <Badge className="bg-red-500/20 text-red-400 border border-red-500/50 px-4 py-2 text-sm font-bold animate-pulse">
                        <AlertTriangle className="w-4 h-4 mr-2" /> ACCOUNT LOCKED
                    </Badge>
                )}
            </div>

            {/* Main Balance Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`relative overflow-hidden rounded-3xl p-8 border ${walletBalance > 0 ? 'bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20' : 'bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20'
                        }`}
                >
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-6">
                            <div className={`p-3 rounded-2xl ${walletBalance > 0 ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'}`}>
                                <Wallet className="w-8 h-8" />
                            </div>
                            <span className="text-xs uppercase tracking-widest font-bold text-gray-500 bg-white/5 py-1 px-3 rounded-lg">
                                {walletBalance > 0 ? 'Cash to Pay' : 'Earnings to Withdraw'}
                            </span>
                        </div>

                        <div className="mb-2 text-gray-400 text-sm font-medium uppercase tracking-wider">Current Balance</div>
                        <h2 className={`text-5xl font-black tracking-tight ${walletBalance > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                            {walletBalance > 0 ? '-' : ''}₹{Math.abs(walletBalance).toFixed(2)}
                        </h2>

                        <p className="mt-4 text-sm text-gray-400 leading-relaxed">
                            {walletBalance > 0
                                ? "You have collected cash from customers. Please pay this amount to the platform to avoid account suspension."
                                : "This amount represents your earnings from online orders. You can request a withdrawal in the Earnings tab."}
                        </p>

                        {walletBalance > 0 && (
                            <div className="mt-8">
                                <Button
                                    onClick={handlePayment}
                                    disabled={paying}
                                    className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold h-14 rounded-xl shadow-lg shadow-orange-900/40 text-lg transition-all"
                                >
                                    {paying ? 'Processing...' : `Pay ₹${walletBalance.toFixed(0)} Now`}
                                </Button>
                                {isLocked && (
                                    <p className="text-center text-red-400 text-xs mt-3 font-bold">
                                        Payment required to unlock your account.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Info Card */}
                <div className="space-y-4">
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                <CreditCard className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white mb-1">Limit: ₹2,000</h3>
                                <p className="text-sm text-gray-400">
                                    You can hold up to ₹2,000 in cash collections. Exceeding this limit will temporarily lock your account until you clear the dues.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-green-500/10 rounded-lg text-green-400">
                                <IndianRupee className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white mb-1">70% Earnings</h3>
                                <p className="text-sm text-gray-400">
                                    You keep 70% of the delivery charge for every order. This is automatically adjusted in your wallet balance.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transactions History */}
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-gray-400" />
                    Transaction History
                </h3>

                <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-sm">
                    {transactions.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No transactions yet</div>
                    ) : (
                        <div className="divide-y divide-white/10">
                            {transactions.map((tx) => (
                                <div key={tx.id} className="p-4 hover:bg-white/5 transition-colors flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.isDebit ? 'bg-orange-500/10 text-orange-400' : 'bg-green-500/10 text-green-400'
                                            }`}>
                                            {tx.isDebit ? <ArrowRight className="w-4 h-4 -rotate-45" /> : <ArrowRight className="w-4 h-4 rotate-135" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm">{tx.description}</p>
                                            <p className="text-xs text-gray-500 font-mono">
                                                {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleString() : 'Just now'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold ${tx.isDebit ? 'text-orange-400' : 'text-green-400'}`}>
                                            {tx.isDebit ? '+' : '-'}₹{tx.amount?.toFixed(2)}
                                        </p>
                                        <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">{tx.type}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
