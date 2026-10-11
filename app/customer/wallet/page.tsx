'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Wallet, TrendingUp, TrendingDown, CreditCard, History,
    ArrowUpRight, ArrowDownLeft, DollarSign, Calendar, IndianRupee, Banknote, Loader2,
    Sparkles, Gift, Users
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, doc, updateDoc, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { initiateAddFunds, verifyAndAddFunds, requestWithdrawal } from '@/lib/wallet-actions';
import { WalletTransaction, IssuedCard } from '@/lib/types';
import Script from 'next/script';
import MembershipCard from '@/components/customer/MembershipCard';

declare global {
    interface Window {
        Razorpay: any;
    }
}

// Helper to determine if a transaction is a credit (deposit, refund, bonus, referral reward, cashback)
export const isCreditTransaction = (tx: WalletTransaction) => {
    const type = (tx.type as string)?.toLowerCase();
    const desc = (tx.description || '').toLowerCase();
    return (
        type === 'credit' ||
        type === 'deposit' ||
        type === 'refund' ||
        type === 'bonus' ||
        type === 'referral' ||
        type === 'cashback' ||
        desc.includes('referral') ||
        desc.includes('bonus') ||
        desc.includes('welcome') ||
        desc.includes('reward') ||
        desc.includes('deposit') ||
        desc.includes('added') ||
        (tx as any).isCredit === true
    );
};

export default function WalletPage() {
    const { user, customer } = useAuth();

    // Real Balance
    const balance = customer?.walletBalance || 0;

    // Stats
    const [totalSpent, setTotalSpent] = useState(0);
    const [referralCount, setReferralCount] = useState(0);
    const [referralsEarned, setReferralsEarned] = useState(0);
    const [referralBonusFromTxs, setReferralBonusFromTxs] = useState(0);

    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [issuedCard, setIssuedCard] = useState<IssuedCard | null>(null);
    const [loadingHistory, setLoadingHistory] = useState(true);

    // Add Funds State
    const [addAmount, setAddAmount] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

    // Withdrawal State
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
    const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);

    // Bank Details State
    const [bankDetails, setBankDetails] = useState({
        bankName: '',
        accountNumber: '',
        accountHolderName: '',
        ifscCode: ''
    });
    const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);
    const [isSavingBank, setIsSavingBank] = useState(false);

    // Initialize Bank Details from Customer Profile
    useEffect(() => {
        if (customer?.bankDetails) {
            setBankDetails(customer.bankDetails);
        }
    }, [customer]);

    // Fetch Transactions
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'customers', user.uid, 'walletTransactions'),
            orderBy('createdAt', 'desc'),
            limit(20)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const txs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
            })) as WalletTransaction[];

            setTransactions(txs);

            // Calculate Total Spent (ONLY debits/payments - NEVER referral bonus or credits)
            const spent = txs
                .filter(t => !isCreditTransaction(t) && (t.type === 'payment' || t.type === 'withdrawal' || (t.type as string) === 'debit'))
                .reduce((acc, curr) => acc + (curr.amount || 0), 0);
            setTotalSpent(spent);

            // Sum referral earnings from transactions
            const txReferralSum = txs
                .filter(t => {
                    const desc = (t.description || '').toLowerCase();
                    const type = (t.type as string)?.toLowerCase();
                    return type === 'referral' || desc.includes('referral') || desc.includes('invite');
                })
                .reduce((acc, curr) => acc + (curr.amount || 0), 0);
            setReferralBonusFromTxs(txReferralSum);

            setLoadingHistory(false);
        }, () => {
            setLoadingHistory(false);
        });

        return () => unsubscribe();
    }, [user]);

    // Live Tracking of Referrals
    useEffect(() => {
        if (!user) return;
        const qRef = query(collection(db, 'referrals'), where('referrerId', '==', user.uid));
        const unsubscribe = onSnapshot(qRef, (snap) => {
            setReferralCount(snap.size);
            const totalEarned = snap.docs.reduce((acc, doc) => acc + (Number(doc.data().rewardAmount) || 50), 0);
            setReferralsEarned(totalEarned);
        }, () => {});
        return () => unsubscribe();
    }, [user]);

    // Derived Total Referral Bonus Balance
    const profileReferral = (customer as any)?.referralEarnings || (customer as any)?.referralBonus || (customer as any)?.referralPointsEarned || 0;
    const totalReferralBonus = Math.max(profileReferral, referralsEarned, referralBonusFromTxs);

    // Fetch Issued Card
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'issuedCards'), where('customerId', '==', user.uid), limit(1));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const cardData = snapshot.docs[0].data();
                setIssuedCard({
                    id: snapshot.docs[0].id,
                    ...cardData,
                    expiryDate: cardData.expiryDate?.toDate() || new Date(),
                    issuedAt: cardData.issuedAt?.toDate() || new Date(),
                } as IssuedCard);
            } else {
                setIssuedCard(null);
            }
        }, () => {
            setIssuedCard(null);
        });
        return () => unsubscribe();
    }, [user]);

    const handleAddFunds = async () => {
        if (!addAmount || parseFloat(addAmount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        setIsProcessingPayment(true);

        try {
            // 1. Initiate Order
            const result = await initiateAddFunds(user!.uid, parseFloat(addAmount));

            if (!result.success || !result.orderId) {
                throw new Error(result.error || 'Failed to create order');
            }

            // 2. Open Razorpay
            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // Ensure this is in env
                amount: parseFloat(addAmount) * 100, // Amount in paise
                currency: "INR",
                name: "Hunger",
                description: "Add Money to Wallet",
                order_id: result.orderId,
                handler: async function (response: any) {
                    // 3. Verify Payment
                    toast.info('Verifying payment...');
                    const verifyResult = await verifyAndAddFunds(
                        user!.uid,
                        response.razorpay_payment_id,
                        response.razorpay_order_id,
                        response.razorpay_signature,
                        parseFloat(addAmount)
                    );

                    if (verifyResult.success) {
                        toast.success(`Successfully added ₹${addAmount}!`);
                        setIsAddOpen(false);
                        setAddAmount('');
                    } else {
                        toast.error('Payment verification failed');
                    }
                    setIsProcessingPayment(false);
                },
                prefill: {
                    name: user?.displayName || "",
                    email: user?.email || "",
                    contact: customer?.phone || ""
                },
                theme: {
                    color: "#F97316"
                },
                modal: {
                    ondismiss: function () {
                        setIsProcessingPayment(false);
                        toast.error("Payment cancelled");
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();

        } catch (error) {
            console.error(error);
            toast.error('Failed to initiate payment');
            setIsProcessingPayment(false);
        }
    };

    const handleWithdraw = async () => {
        if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
            toast.error('Invalid amount');
            return;
        }
        if (parseFloat(withdrawAmount) > balance) {
            toast.error('Insufficient wallet balance');
            return;
        }
        if (!bankDetails.accountNumber || !bankDetails.ifscCode) {
            toast.error('Please fill in bank details');
            return;
        }

        setIsSubmittingWithdraw(true);

        try {
            const result = await requestWithdrawal(
                user!.uid,
                parseFloat(withdrawAmount),
                bankDetails,
                user!.displayName || 'Customer',
                user!.email || ''
            );

            if (result.success) {
                toast.success('Withdrawal request submitted successfully!');
                setIsWithdrawOpen(false);
                setWithdrawAmount('');
                // Reset bank details if needed, or keep for convenience
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error('Failed to submit request');
            setIsSubmittingWithdraw(false);
        }
    };

    // Membership Request State
    const [isRequestOpen, setIsRequestOpen] = useState(false);
    const [requestContact, setRequestContact] = useState('');
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

    // Load contact from profile if available
    useEffect(() => {
        if (customer?.phone) {
            setRequestContact(customer.phone);
        }
    }, [customer]);

    const handleSaveBankDetails = async () => {
        if (!bankDetails.accountNumber || !bankDetails.ifscCode || !bankDetails.bankName || !bankDetails.accountHolderName) {
            toast.error('Please fill in all bank details');
            return;
        }

        setIsSavingBank(true);
        try {
            await updateDoc(doc(db, 'customers', user!.uid), {
                bankDetails: bankDetails,
                updatedAt: new Date() // Client side timestamp for immediate update, rule allows it or server timestamp
            });
            toast.success('Bank details saved successfully!');
            setIsBankDialogOpen(false);
        } catch (error) {
            console.error(error);
            toast.error('Failed to save bank details');
        } finally {
            setIsSavingBank(false);
        }
    };

    const handleRequestMembership = async () => {
        if (!requestContact || requestContact.length < 10) {
            toast.error("Please enter a valid contact number");
            return;
        }

        if (!customer?.bankDetails?.accountNumber) {
            toast.error("Please add bank details first");
            setIsRequestOpen(false);
            setIsBankDialogOpen(true);
            return;
        }

        setIsSubmittingRequest(true);
        try {
            // Check existing request logic moved to client side or rely on rules/UI state
            // UI state `customer.membershipStatus` already checks this, so we proceed directly

            // Create Request
            const requestRef = await addDoc(collection(db, 'membershipRequests'), {
                customerId: user!.uid,
                customerName: customer?.name || user!.displayName || 'Customer',
                customerEmail: user!.email || '',
                contactNumber: requestContact,
                status: 'pending',
                createdAt: serverTimestamp(),
                bankDetails: bankDetails, // Use current state or customer profile
            });

            // Update Customer Status
            await updateDoc(doc(db, 'customers', user!.uid), {
                membershipStatus: 'pending',
                updatedAt: serverTimestamp()
            });

            toast.success("Membership request submitted successfully!");
            setIsRequestOpen(false);
        } catch (error) {
            console.error(error);
            toast.error("Failed to submit request");
        } finally {
            setIsSubmittingRequest(false);
        }
    };

    return (
        <div className="min-h-screen text-foreground pb-24 md:pb-16 font-sans">
            <Script src="https://checkout.razorpay.com/v1/checkout.js" />

            <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                            My Wallet
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Manage your balance, add funds, and view transactions</p>
                    </div>
                    <div className="flex gap-2.5 sm:gap-3 flex-wrap">
                        {/* Add Funds Dialog */}
                        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md shadow-primary/20 rounded-xl">
                                    <ArrowUpRight className="mr-1.5 h-4 w-4" /> Add Funds
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-card border-border text-card-foreground sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Add Funds to Wallet</DialogTitle>
                                    <DialogDescription className="text-muted-foreground">
                                        Enter the amount you want to add to your wallet balance.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="amount">Amount (₹)</Label>
                                        <div className="relative">
                                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                            <Input
                                                id="amount"
                                                placeholder="e.g. 500"
                                                className="pl-9 bg-muted/40 border-border text-foreground"
                                                value={addAmount}
                                                onChange={(e) => setAddAmount(e.target.value)}
                                                type="number"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {[500, 1000, 2000].map((amt) => (
                                            <Button
                                                key={amt}
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 border-border hover:bg-accent text-foreground rounded-xl text-xs font-semibold"
                                                onClick={() => setAddAmount(amt.toString())}
                                            >
                                                +₹{amt}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="ghost" onClick={() => setIsAddOpen(false)} className="text-muted-foreground hover:text-foreground" disabled={isProcessingPayment}>Cancel</Button>
                                    <Button onClick={handleAddFunds} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl" disabled={isProcessingPayment}>
                                        {isProcessingPayment ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : 'Proceed to Pay'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Withdraw Dialog */}
                        <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="border-border hover:bg-accent text-foreground font-semibold rounded-xl">
                                    <ArrowDownLeft className="mr-1.5 h-4 w-4" /> Withdraw
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-card border-border text-card-foreground sm:max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Withdraw Funds</DialogTitle>
                                    <DialogDescription className="text-muted-foreground">
                                        Transfer funds from your wallet to your linked bank account.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-3">
                                    <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between">
                                        <span className="text-sm text-foreground">Available Withdrawal Balance</span>
                                        <span className="font-bold text-primary text-base">₹{balance.toFixed(2)}</span>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="w-amount">Withdrawal Amount (₹)</Label>
                                        <div className="relative">
                                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                            <Input
                                                id="w-amount"
                                                placeholder="Enter amount"
                                                className="pl-9 bg-muted/40 border-border text-foreground"
                                                value={withdrawAmount}
                                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                                type="number"
                                                max={balance}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-2">
                                        <h4 className="text-sm font-semibold text-foreground">Bank Details</h4>
                                        <Input
                                            placeholder="Bank Name"
                                            className="bg-muted/40 border-border text-foreground"
                                            value={bankDetails.bankName}
                                            onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                                        />
                                        <Input
                                            placeholder="Account Holder Name"
                                            className="bg-muted/40 border-border text-foreground"
                                            value={bankDetails.accountHolderName}
                                            onChange={(e) => setBankDetails({ ...bankDetails, accountHolderName: e.target.value })}
                                        />
                                        <div className="grid grid-cols-2 gap-3">
                                            <Input
                                                placeholder="Account Number"
                                                className="bg-muted/40 border-border text-foreground"
                                                value={bankDetails.accountNumber}
                                                onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                                            />
                                            <Input
                                                placeholder="IFSC Code"
                                                className="bg-muted/40 border-border text-foreground"
                                                value={bankDetails.ifscCode}
                                                onChange={(e) => setBankDetails({ ...bankDetails, ifscCode: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="ghost" onClick={() => setIsWithdrawOpen(false)} className="text-muted-foreground hover:text-foreground" disabled={isSubmittingWithdraw}>Cancel</Button>
                                    <Button onClick={handleWithdraw} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl" disabled={isSubmittingWithdraw}>
                                        {isSubmittingWithdraw ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : 'Confirm Withdrawal'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Redeem Code / Voucher Quick Link */}
                        <Link href="/customer/rewards#voucher">
                            <Button variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-semibold rounded-xl gap-1.5 shadow-sm">
                                <Gift className="h-4 w-4" /> Redeem Code
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Hero Wallet Balance Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {/* 1. Available Balance Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-emerald-950/70 via-emerald-900/40 to-card border border-emerald-500/30 shadow-xl group hover:border-emerald-500/50 transition-all"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none group-hover:scale-110 transition-transform">
                            <Wallet className="w-24 h-24 text-emerald-400" />
                        </div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                    <Wallet className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Available Balance</h3>
                                    <p className="text-[11px] text-muted-foreground">Ready for orders & withdrawal</p>
                                </div>
                            </div>
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-bold uppercase">
                                Usable
                            </Badge>
                        </div>
                        <div className="my-2">
                            <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tight flex items-baseline gap-1">
                                <span className="text-emerald-500">₹</span>{balance.toFixed(2)}
                            </div>
                        </div>
                        <div className="pt-3 border-t border-emerald-500/15 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Usable Wallet Amount</span>
                            <button
                                onClick={() => setIsAddOpen(true)}
                                className="text-emerald-500 hover:text-emerald-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                            >
                                + Add Funds
                            </button>
                        </div>
                    </motion.div>

                    {/* 2. Referral Bonus Balance Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-amber-950/70 via-orange-950/40 to-card border border-amber-500/30 shadow-xl group hover:border-amber-500/50 transition-all"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none group-hover:scale-110 transition-transform">
                            <Sparkles className="w-24 h-24 text-amber-400" />
                        </div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                                    <Gift className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">Referral Bonus Balance</h3>
                                    <p className="text-[11px] text-muted-foreground">Credited to wallet • Never debited</p>
                                </div>
                            </div>
                            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] font-bold uppercase">
                                Bonus
                            </Badge>
                        </div>
                        <div className="my-2">
                            <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tight flex items-baseline gap-1">
                                <span className="text-amber-500">₹</span>{totalReferralBonus.toFixed(2)}
                            </div>
                        </div>
                        <div className="pt-3 border-t border-amber-500/15 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                                {referralCount > 0 ? `${referralCount} Friend${referralCount > 1 ? 's' : ''} Joined` : 'Earn ₹50 per friend'}
                            </span>
                            <Link
                                href="/customer/referral"
                                className="text-amber-500 hover:text-amber-400 font-bold hover:underline flex items-center gap-1"
                            >
                                Invite Friends →
                            </Link>
                        </div>
                    </motion.div>

                    {/* 3. Total Spent / Lifetime Debit Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-blue-950/60 via-slate-900/30 to-card border border-blue-500/25 shadow-xl group hover:border-blue-500/40 transition-all md:col-span-2 lg:col-span-1"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none group-hover:scale-110 transition-transform">
                            <TrendingUp className="w-24 h-24 text-blue-400" />
                        </div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">Total Spent</h3>
                                    <p className="text-[11px] text-muted-foreground">Food orders & withdrawals</p>
                                </div>
                            </div>
                            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] font-bold uppercase">
                                Lifetime
                            </Badge>
                        </div>
                        <div className="my-2">
                            <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tight flex items-baseline gap-1">
                                <span className="text-blue-500">₹</span>{totalSpent.toFixed(2)}
                            </div>
                        </div>
                        <div className="pt-3 border-t border-blue-500/15 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{transactions.length} Total Transactions</span>
                            <span className="text-blue-400 font-medium">All-time</span>
                        </div>
                    </motion.div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

                    {/* Left Column: Membership Card & Quick Stats */}
                    <div className="lg:col-span-1 space-y-6">

                        {/* Membership Card - Glassmorphism */}
                        {/* Membership Section */}
                        {issuedCard || customer?.membershipId ? (
                            /* Membership Card - Glassmorphism */
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="relative overflow-hidden rounded-3xl p-6 aspect-[1.586/1] flex flex-col justify-between shadow-2xl group cursor-pointer bg-gradient-to-br from-neutral-950 via-zinc-900 to-neutral-900 text-white border border-white/15"
                            >
                                {/* Decorative Elements */}
                                <div className="absolute top-[-40%] left-[-40%] w-[80%] h-[80%] bg-primary/25 blur-[70px] rounded-full group-hover:bg-primary/35 transition-all duration-700 pointer-events-none" />
                                <div className="absolute bottom-[-40%] right-[-40%] w-[80%] h-[80%] bg-amber-500/20 blur-[70px] rounded-full group-hover:bg-amber-500/30 transition-all duration-700 pointer-events-none" />

                                <div className="relative z-10 flex justify-between items-start">
                                    <div>
                                        <h3 className="font-black text-lg tracking-wider text-white flex items-center gap-1.5">
                                            HUNGER<span className="text-primary font-extrabold">PREMIUM</span>
                                        </h3>
                                        <span className="text-[11px] text-zinc-300 font-semibold uppercase tracking-widest">VIP Membership Card</span>
                                    </div>
                                    {issuedCard ? (
                                        <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-xl backdrop-blur-md border border-white/15">
                                            <IndianRupee className="w-4 h-4 text-primary" />
                                            <span className="text-base font-black text-white">₹{balance.toFixed(0)}</span>
                                        </div>
                                    ) : (
                                        <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/15 text-primary">
                                            <IndianRupee className="w-5 h-5" />
                                        </div>
                                    )}
                                </div>

                                <div className="relative z-10 flex-1 flex flex-col justify-center my-2">
                                    {issuedCard ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <CreditCard className="w-7 h-7 text-white/70" />
                                                <div className="text-lg sm:text-xl font-mono text-white tracking-widest drop-shadow-md">
                                                    {issuedCard.cardNumber?.match(/.{1,4}/g)?.join(' ') || '**** **** **** ****'}
                                                </div>
                                            </div>
                                            <div className="flex gap-8 text-xs text-zinc-300 uppercase tracking-wider font-mono pl-10">
                                                <div>
                                                    <span className="block text-[8px] text-zinc-400">Valid Thru</span>
                                                    {issuedCard.expiryDate.toLocaleDateString(undefined, { month: '2-digit', year: '2-digit' })}
                                                </div>
                                                <div>
                                                    <span className="block text-[8px] text-zinc-400">CVV</span>
                                                    {issuedCard.cvv}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="text-[11px] text-zinc-300 font-bold uppercase tracking-wider mb-0.5">Current Balance</div>
                                            <div className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-sm">
                                                ₹{balance.toFixed(2)}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="relative z-10 flex justify-between items-end">
                                    <div>
                                        <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-0.5">Card Holder</div>
                                        <div className="font-bold tracking-wide uppercase text-sm text-white">{user?.displayName || customer?.name || 'Valued Customer'}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-0.5">
                                            {issuedCard ? 'Issued' : 'Member Since'}
                                        </div>
                                        <div className="font-bold tracking-wide text-xs text-white">
                                            {issuedCard
                                                ? issuedCard.issuedAt.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                                                : customer?.createdAt ? new Date(customer.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '2024'}
                                        </div>
                                        {!issuedCard && <div className="text-[9px] text-zinc-400 font-mono uppercase mt-0.5">ID: {customer?.membershipId || 'N/A'}</div>}
                                    </div>
                                </div>
                            </motion.div>
                        ) : customer?.membershipStatus === 'pending' ? (
                            <Card className="bg-card border-2 border-dashed border-amber-500/40 text-card-foreground aspect-[1.586/1] flex flex-col items-center justify-center text-center p-6 rounded-3xl shadow-xs">
                                <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
                                <h3 className="text-xl font-bold text-foreground mb-2">Request Pending</h3>
                                <p className="text-muted-foreground text-sm max-w-xs">Your membership request is being reviewed by our team. Please wait for approval.</p>
                            </Card>
                        ) : (
                            <Card className="bg-card border-2 border-dashed border-border hover:border-primary/50 text-card-foreground aspect-[1.586/1] flex flex-col items-center justify-center text-center p-6 rounded-3xl transition-colors group shadow-xs">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                                    <Wallet className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground mb-1">No Membership Card</h3>
                                <p className="text-muted-foreground text-xs sm:text-sm mb-5 max-w-xs">Get exclusive benefits & zero delivery fees with our Premium Membership Card.</p>
                                <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-md">
                                            Request Membership Card
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-card border-border text-card-foreground sm:max-w-md shadow-2xl rounded-3xl">
                                        <DialogHeader>
                                            <DialogTitle className="text-lg font-bold">Request Membership Card</DialogTitle>
                                            <DialogDescription className="text-muted-foreground text-xs sm:text-sm">
                                                Please confirm your details to request a new membership card.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            {/* Auto-load profile details */}
                                            <div className="p-4 bg-muted/40 rounded-2xl border border-border space-y-2">
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-muted-foreground font-medium">Name:</span>
                                                    <span className="text-sm font-bold text-foreground">{customer?.name || user?.displayName || 'Customer'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-muted-foreground font-medium">Email:</span>
                                                    <span className="text-sm font-bold text-foreground">{user?.email}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-muted-foreground font-medium">Bank Details:</span>
                                                    {customer?.bankDetails?.accountNumber ? (
                                                        <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-500/20 bg-green-500/10 font-bold">Attached</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-red-600 dark:text-red-400 border-red-500/20 bg-red-500/10 font-bold">Missing</Badge>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="contact" className="text-xs font-bold text-foreground">Contact Number</Label>
                                                <Input
                                                    id="contact"
                                                    placeholder="Enter your phone number"
                                                    value={requestContact}
                                                    onChange={(e) => setRequestContact(e.target.value)}
                                                    className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl"
                                                />
                                            </div>

                                            {!customer?.bankDetails?.accountNumber && (
                                                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs font-medium text-amber-700 dark:text-amber-300">
                                                    You must add your bank details before requesting a membership card.
                                                </div>
                                            )}
                                        </div>
                                        <DialogFooter className="gap-2">
                                            <Button variant="ghost" onClick={() => setIsRequestOpen(false)} className="text-muted-foreground hover:text-foreground rounded-xl">Cancel</Button>
                                            {customer?.bankDetails?.accountNumber ? (
                                                <Button onClick={handleRequestMembership} disabled={isSubmittingRequest} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl">
                                                    {isSubmittingRequest ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : 'Submit Request'}
                                                </Button>
                                            ) : (
                                                <Button onClick={() => { setIsRequestOpen(false); setIsBankDialogOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl">
                                                    Add Bank Details
                                                </Button>
                                            )}
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </Card>
                        )}

                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <Card className="bg-card border-border/80 hover:border-primary/40 transition-colors rounded-2xl sm:rounded-3xl shadow-xs">
                                <CardContent className="p-4 sm:p-5 flex flex-col items-center justify-center text-center">
                                    <div className="p-2.5 mb-2 rounded-2xl bg-red-500/10 text-red-500">
                                        <TrendingUp className="w-5 h-5" />
                                    </div>
                                    <p className="text-xs font-semibold text-muted-foreground">Total Spent</p>
                                    <p className="text-lg sm:text-xl font-black text-foreground">₹{totalSpent.toLocaleString()}</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-card border-border/80 hover:border-primary/40 transition-colors rounded-2xl sm:rounded-3xl shadow-xs">
                                <CardContent className="p-4 sm:p-5 flex flex-col items-center justify-center text-center">
                                    <div className="p-2.5 mb-2 rounded-2xl bg-green-500/10 text-green-500">
                                        <Banknote className="w-5 h-5" />
                                    </div>
                                    <p className="text-xs font-semibold text-muted-foreground">Add Funds</p>
                                    <p className="text-lg sm:text-xl font-black text-primary cursor-pointer hover:underline transition-colors" onClick={() => setIsAddOpen(true)}>+ Top Up</p>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="bg-card border-border/80 rounded-2xl sm:rounded-3xl shadow-xs">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold text-foreground">Spending Overview</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-xs sm:text-sm font-semibold mb-1.5 text-foreground">
                                            <span>Food Orders</span>
                                            <span className="font-bold">75%</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-primary w-[75%]" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs sm:text-sm font-semibold mb-1.5 text-foreground">
                                            <span>Delivery Fees</span>
                                            <span className="font-bold">15%</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 w-[15%]" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs sm:text-sm font-semibold mb-1.5 text-foreground">
                                            <span>Tips</span>
                                            <span className="font-bold">10%</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 w-[10%]" />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Add Bank Account Card */}
                        <Card className="bg-card border-border/80 hover:border-primary/40 transition-colors rounded-2xl sm:rounded-3xl shadow-xs group">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div className="space-y-1">
                                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                                        <CreditCard className="w-4 h-4 text-primary" />
                                        Active Bank Account
                                    </CardTitle>
                                </div>
                                <Dialog open={isBankDialogOpen} onOpenChange={setIsBankDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                            <div className="bg-muted p-1.5 rounded-xl border border-border">
                                                {/* Edit Icon */}
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                            </div>
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-card border-border text-card-foreground shadow-2xl rounded-3xl sm:max-w-md">
                                        <DialogHeader>
                                            <DialogTitle className="text-lg font-bold">{customer?.bankDetails ? 'Update' : 'Add'} Bank Details</DialogTitle>
                                            <DialogDescription className="text-muted-foreground text-xs sm:text-sm">
                                                These details will be used for withdrawals and membership verification.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold text-foreground">Bank Name</Label>
                                                <Input
                                                    placeholder="e.g. HDFC Bank"
                                                    className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl"
                                                    value={bankDetails.bankName}
                                                    onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold text-foreground">Account Holder Name</Label>
                                                <Input
                                                    placeholder="e.g. John Doe"
                                                    className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl"
                                                    value={bankDetails.accountHolderName}
                                                    onChange={(e) => setBankDetails({ ...bankDetails, accountHolderName: e.target.value })}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-bold text-foreground">Account Number</Label>
                                                    <Input
                                                        placeholder="XXXXXXXX1234"
                                                        className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl"
                                                        value={bankDetails.accountNumber}
                                                        onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-bold text-foreground">IFSC Code</Label>
                                                    <Input
                                                        placeholder="HDFC0001234"
                                                        className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl"
                                                        value={bankDetails.ifscCode}
                                                        onChange={(e) => setBankDetails({ ...bankDetails, ifscCode: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <DialogFooter className="gap-2">
                                            <Button variant="ghost" onClick={() => setIsBankDialogOpen(false)} className="text-muted-foreground hover:text-foreground rounded-xl">Cancel</Button>
                                            <Button onClick={handleSaveBankDetails} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl" disabled={isSavingBank}>
                                                {isSavingBank ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : 'Save Details'}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </CardHeader>
                            <CardContent>
                                {customer?.bankDetails?.accountNumber ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                    {customer.bankDetails.bankName.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm text-foreground">{customer.bankDetails.bankName}</div>
                                                    <div className="text-xs text-muted-foreground font-medium">•••• {customer.bankDetails.accountNumber.slice(-4)}</div>
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="border-green-500/20 text-green-600 dark:text-green-400 bg-green-500/10 text-[10px] uppercase font-bold tracking-wider">
                                                Verified
                                            </Badge>
                                        </div>
                                        <div className="pt-3 border-t border-border/60 flex justify-between text-xs text-muted-foreground">
                                            <span>Holder: <span className="font-bold text-foreground">{customer.bankDetails.accountHolderName}</span></span>
                                            <span>IFSC: <span className="font-bold text-foreground">{customer.bankDetails.ifscCode}</span></span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-4 text-center space-y-3">
                                        <div className="p-3 bg-muted rounded-full text-muted-foreground">
                                            <Banknote className="w-6 h-6 opacity-60" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-foreground">No Bank Account Linked</p>
                                            <p className="text-xs text-muted-foreground">Link your account for faster withdrawals.</p>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => setIsBankDialogOpen(true)} className="border-primary/40 text-primary hover:bg-primary/10 rounded-xl w-full font-bold">
                                            Add Bank Account
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                    </div>

                    {/* Right Column: Transaction History */}
                    <div className="lg:col-span-2">
                        <Card className="bg-card border-border/80 h-full rounded-2xl sm:rounded-3xl shadow-xs">
                            <CardHeader className="flex flex-row items-center justify-between pb-6 border-b border-border/60">
                                <div>
                                    <CardTitle className="text-xl font-black text-foreground">Transaction History</CardTitle>
                                    <CardDescription className="text-muted-foreground text-xs sm:text-sm">Recent activity on your wallet balance</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="space-y-3">
                                    {loadingHistory ? (
                                        <div className="flex justify-center py-8"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>
                                    ) : transactions.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <History className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                            <p className="font-semibold text-sm">No transactions yet</p>
                                        </div>
                                    ) : (
                                        transactions.map((tx) => {
                                            const isCredit = isCreditTransaction(tx);
                                            return (
                                                <div key={tx.id} className="group flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-muted/30 hover:bg-muted/60 border border-border/70 hover:border-primary/40 transition-all">
                                                    <div className="flex items-center gap-3 sm:gap-4">
                                                        <div className={`p-2.5 sm:p-3 rounded-2xl ${
                                                            isCredit
                                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                                : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                                        }`}>
                                                            {isCredit ? (
                                                                <ArrowDownLeft className="h-5 w-5" />
                                                            ) : (
                                                                <ArrowUpRight className="h-5 w-5" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors">{tx.description}</p>
                                                            <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                                                <History className="w-3 h-3" /> {tx.createdAt.toLocaleDateString()}
                                                                <span className="w-1 h-1 bg-border rounded-full" />
                                                                <span className="capitalize font-medium">{isCredit ? 'Credit' : tx.type}</span>
                                                                {tx.referenceId && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground border border-border">{tx.referenceId.slice(0, 8)}...</span>}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`font-black text-sm sm:text-base ${
                                                            isCredit
                                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                                : 'text-foreground'
                                                        }`}>
                                                            {isCredit ? '+' : '-'}₹{tx.amount.toLocaleString()}
                                                        </p>
                                                        <Badge variant="secondary" className={`mt-1 text-[10px] uppercase font-bold ${
                                                            tx.status === 'completed'
                                                                ? isCredit
                                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                                    : 'bg-green-500/10 text-green-600 dark:text-green-400'
                                                                : tx.status === 'pending'
                                                                ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                                                                : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                                        }`}>
                                                            {tx.status}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                </div>
            </div>
        </div>
    );
}
