'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Card } from '@/components/ui/card';
import { Loader } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, increment, serverTimestamp, addDoc } from 'firebase/firestore';
import { IndianRupee, Wallet, CreditCard, AlertTriangle, CheckCircle2, Clock, ArrowRight, History, Sparkles, ShieldCheck, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { loadRazorpayScript } from '@/lib/razorpay';

export default function WalletPage() {
    const router = useRouter();
    const { user, deliveryPartner, loading: authLoading } = useDeliveryAuth();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState(false);
    const [customAmount, setCustomAmount] = useState<string>('');

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

    const walletBalance = Number(deliveryPartner?.walletBalance ?? 0);
    // Locked if pending debt exceeds ₹2,000 (represented as negative balance < -2000 or legacy > 2000)
    const isLocked = walletBalance < -2000 || walletBalance > 2000;
    const hasPendingDue = walletBalance < 0;
    const pendingDueAmount = Math.abs(walletBalance);

    // Initialize custom payment input with full due when partner has dues
    useEffect(() => {
        if (hasPendingDue && !customAmount) {
            setCustomAmount(pendingDueAmount.toFixed(0));
        }
    }, [hasPendingDue, pendingDueAmount]);

    const parsedPayAmount = parseFloat(customAmount) || 0;
    // Projected balance calculation: Current Balance + Paid Amount
    // e.g. -200 + 150 = -50, -200 + 200 = 0, -200 + 210 = +10
    const projectedBalance = walletBalance + parsedPayAmount;

    const handlePayment = async (amountToPayOverride?: number) => {
        if (!user) return;
        const amountToPay = typeof amountToPayOverride === 'number' ? amountToPayOverride : parsedPayAmount;

        if (isNaN(amountToPay) || amountToPay <= 0) {
            toast.error('Please enter a valid amount to pay (minimum ₹1)');
            return;
        }

        setPaying(true);

        try {
            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) {
                throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
            }

            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_YourKeyHere',
                amount: Math.round(amountToPay * 100),
                currency: 'INR',
                name: 'AKR Hunger Delivery',
                description: `Settle Platform Dues (Paid ₹${amountToPay.toFixed(2)})`,
                image: '/hunger.png',
                handler: async function (response: any) {
                    try {
                        const driverRef = doc(db, 'deliveryPersons', user.uid);
                        // Add positive amount to balance: -200 + 150 = -50, -200 + 210 = +10
                        await updateDoc(driverRef, {
                            walletBalance: increment(amountToPay)
                        });

                        await addDoc(collection(driverRef, 'walletTransactions'), {
                            amount: amountToPay,
                            type: 'payment',
                            description: `Paid ₹${amountToPay.toFixed(2)} to Platform via Razorpay`,
                            paymentId: response.razorpay_payment_id || `PAY-${Date.now()}`,
                            isDebit: false, // Credit towards balance
                            createdAt: serverTimestamp()
                        });

                        const finalBal = walletBalance + amountToPay;
                        const finalBalStr = finalBal < 0
                            ? `-₹${Math.abs(finalBal).toFixed(2)}`
                            : finalBal === 0
                            ? '₹0.00'
                            : `+₹${finalBal.toFixed(2)}`;

                        toast.success(`Payment of ₹${amountToPay} successful! New Current Balance: ${finalBalStr}`);
                    } catch (err) {
                        toast.error('Payment recorded but error updating wallet. Please contact support.');
                        console.error('Wallet balance update error:', err);
                    }
                },
                prefill: {
                    name: deliveryPartner?.name || 'Delivery Partner',
                    email: deliveryPartner?.email || '',
                    contact: deliveryPartner?.phone || '',
                },
                theme: {
                    color: '#f97316',
                },
                modal: {
                    ondismiss: () => setPaying(false)
                }
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.open();
        } catch (error: any) {
            console.error('Payment Error:', error);
            toast.error(error.message || 'Failed to initiate payment');
        } finally {
            setPaying(false);
        }
    };

    if (authLoading || (user && loading)) {
        return (
            <div className="flex items-center justify-center h-screen bg-transparent text-white">
                <Loader />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto pb-28 md:pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-1">
                        Delivery <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">Wallet</span>
                    </h1>
                    <p className="text-gray-400 text-sm">Manage your cash in hand dues, 80% delivery earnings, and payments.</p>
                </div>
                {isLocked && (
                    <Badge className="bg-red-500/20 text-red-400 border border-red-500/50 px-4 py-2 text-xs font-bold animate-pulse">
                        <AlertTriangle className="w-4 h-4 mr-2" /> CASH DUE LIMIT EXCEEDED (ACCOUNT LOCKED)
                    </Badge>
                )}
            </div>

            {/* Main Current Balance Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div
                    initial={{ scale: 0.96, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`relative overflow-hidden rounded-3xl p-7 sm:p-8 border backdrop-blur-xl ${
                        hasPendingDue
                            ? 'bg-gradient-to-br from-orange-500/15 via-red-500/10 to-transparent border-orange-500/30 shadow-xl shadow-orange-950/20'
                            : walletBalance === 0
                            ? 'bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent border-emerald-500/30 shadow-xl shadow-emerald-950/20'
                            : 'bg-gradient-to-br from-emerald-500/15 via-blue-500/10 to-transparent border-emerald-500/30 shadow-xl shadow-emerald-950/20'
                    }`}
                >
                    {/* Ambient Glow */}
                    <div className={`absolute top-0 right-0 w-44 h-44 rounded-full blur-3xl pointer-events-none ${
                        hasPendingDue ? 'bg-orange-500/10' : 'bg-emerald-500/10'
                    }`} />

                    <div className="relative z-10 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className={`p-3.5 rounded-2xl ${
                                hasPendingDue ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}>
                                <Wallet className="w-7 h-7" />
                            </div>
                            <span className={`text-[11px] uppercase tracking-widest font-black py-1 px-3 rounded-xl border ${
                                hasPendingDue
                                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                                    : walletBalance === 0
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }`}>
                                {hasPendingDue ? 'Pending Paid Amount' : walletBalance === 0 ? 'All Dues Cleared' : 'Credit Balance'}
                            </span>
                        </div>

                        <div>
                            <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                Current Balance
                                {hasPendingDue && <span className="text-[10px] text-orange-400 font-normal">(Debt to Platform)</span>}
                            </div>
                            <h2 className={`text-4xl sm:text-5xl font-black tracking-tight font-mono ${
                                hasPendingDue
                                    ? 'text-orange-400'
                                    : walletBalance === 0
                                    ? 'text-emerald-400'
                                    : 'text-emerald-400'
                            }`}>
                                {walletBalance < 0
                                    ? `-₹${Math.abs(walletBalance).toFixed(2)}`
                                    : walletBalance === 0
                                    ? '₹0.00'
                                    : `+₹${walletBalance.toFixed(2)}`}
                            </h2>

                            <p className="mt-3 text-xs sm:text-sm text-gray-400 leading-relaxed">
                                {hasPendingDue
                                    ? `You have pending cash collected from COD orders. Platform fee (20% delivery charge) + food amount is owed. Clear this amount to keep your account active.`
                                    : walletBalance === 0
                                    ? `All platform dues are fully settled! Your pending balance is ₹0.00.`
                                    : `You have advanced credit of ₹${walletBalance.toFixed(2)}. Platform owes you or previous payment exceeded dues.`}
                            </p>
                        </div>

                        {/* Interactive Payment Settler Form */}
                        <div className="pt-4 border-t border-white/10 space-y-3">
                            <label className="text-xs font-bold text-gray-300 block">
                                Enter Amount to Pay & Settle Dues:
                            </label>
                            
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base">₹</span>
                                <Input
                                    type="number"
                                    min="1"
                                    placeholder={hasPendingDue ? pendingDueAmount.toFixed(0) : 'Enter amount'}
                                    value={customAmount}
                                    onChange={(e) => setCustomAmount(e.target.value)}
                                    className="pl-8 bg-black/40 border-white/15 h-12 rounded-xl text-white font-mono font-bold text-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                />
                            </div>

                            {/* Quick Presets */}
                            <div className="flex flex-wrap gap-2 pt-1">
                                {hasPendingDue && (
                                    <button
                                        type="button"
                                        onClick={() => setCustomAmount(pendingDueAmount.toFixed(0))}
                                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 border border-orange-500/40 transition-colors"
                                    >
                                        Full Due (₹{pendingDueAmount.toFixed(0)})
                                    </button>
                                )}
                                {[150, 200, 210, 500].map((amt) => (
                                    <button
                                        key={amt}
                                        type="button"
                                        onClick={() => setCustomAmount(amt.toString())}
                                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                                            customAmount === amt.toString()
                                                ? 'bg-white/20 text-white border-white/40'
                                                : 'bg-white/5 text-gray-400 hover:bg-white/10 border-white/10'
                                        }`}
                                    >
                                        ₹{amt}
                                    </button>
                                ))}
                            </div>

                            {/* Automatic Settle Preview Banner */}
                            {parsedPayAmount > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`p-3 rounded-xl border text-xs font-medium space-y-1 ${
                                        projectedBalance < 0
                                            ? 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                                            : projectedBalance === 0
                                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                                            : 'bg-blue-500/10 border-blue-500/25 text-blue-300'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">Current Balance:</span>
                                        <span className="font-mono font-bold">
                                            {walletBalance < 0 ? `-₹${Math.abs(walletBalance).toFixed(2)}` : `₹${walletBalance.toFixed(2)}`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">Amount Paying:</span>
                                        <span className="font-mono font-bold text-white">+₹{parsedPayAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-1 border-t border-white/10 font-bold">
                                        <span>After Payment Balance:</span>
                                        <span className="font-mono text-sm">
                                            {projectedBalance < 0
                                                ? `-₹${Math.abs(projectedBalance).toFixed(2)}`
                                                : projectedBalance === 0
                                                ? '₹0.00 (All Clear)'
                                                : `+₹${projectedBalance.toFixed(2)} (Credit)`}
                                        </span>
                                    </div>
                                </motion.div>
                            )}

                            <Button
                                onClick={() => handlePayment()}
                                disabled={paying || parsedPayAmount <= 0}
                                className="w-full bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black h-13 rounded-xl shadow-lg shadow-orange-950/40 text-base transition-all mt-2 cursor-pointer"
                            >
                                {paying ? 'Connecting Razorpay...' : `Pay ₹${parsedPayAmount > 0 ? parsedPayAmount.toFixed(0) : '0'} Now`}
                            </Button>
                        </div>
                    </div>
                </motion.div>

                {/* Info & Policy Cards */}
                <div className="space-y-4">
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm space-y-2">
                        <div className="flex items-start gap-3.5">
                            <div className="p-2.5 bg-orange-500/10 rounded-xl text-orange-400 border border-orange-500/20 shrink-0">
                                <CreditCard className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-sm mb-1">COD Automatic Settler Policy</h3>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    When you deliver a COD order, customer gives you full cash. Only the <strong className="text-gray-200">food menu price + 20% platform delivery fee</strong> is automatically debited to your pending dues balance.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm space-y-2">
                        <div className="flex items-start gap-3.5">
                            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20 shrink-0">
                                <IndianRupee className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-sm mb-1">80% Delivery Fee Payout</h3>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Your true partner earning is <strong className="text-emerald-400">80% of the delivery charge</strong> (₹32 on ₹40 orders, ₹48 on ₹60 multi-quantity orders). You do not earn food amount or GST.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm space-y-2">
                        <div className="flex items-start gap-3.5">
                            <div className="p-2.5 bg-red-500/10 rounded-xl text-red-400 border border-red-500/20 shrink-0">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-sm mb-1">Cash Due Safety Limit: ₹2,000</h3>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    You can hold up to ₹2,000 in pending collections. If pending dues exceed ₹2,000 (balance drops below -₹2,000), orders are paused until dues are partially or fully cleared.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transactions History */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-gray-400" />
                    Wallet Transaction History
                </h3>

                <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-sm">
                    {transactions.length === 0 ? (
                        <div className="p-10 text-center text-gray-500 text-sm">No wallet transactions recorded yet</div>
                    ) : (
                        <div className="divide-y divide-white/10">
                            {transactions.map((tx) => (
                                <div key={tx.id} className="p-4 sm:p-5 hover:bg-white/5 transition-colors flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                            tx.isDebit
                                                ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                                                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                        }`}>
                                            {tx.isDebit ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-white text-xs sm:text-sm truncate">{tx.description}</p>
                                            <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                                                {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleString() : 'Just now'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className={`font-mono font-bold text-sm sm:text-base ${
                                            tx.isDebit ? 'text-orange-400' : 'text-emerald-400'
                                        }`}>
                                            {tx.isDebit ? '-' : '+'}₹{Number(tx.amount || 0).toFixed(2)}
                                        </p>
                                        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block mt-0.5">
                                            {tx.type}
                                        </span>
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
