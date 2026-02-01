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
    ArrowUpRight, ArrowDownLeft, DollarSign, Calendar, IndianRupee, Banknote, Loader2
} from 'lucide-react';
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

export default function WalletPage() {
    const { user, customer } = useAuth();

    // Real Balance
    const balance = customer?.walletBalance || 0;

    // Stats (calculated from transactions for simplicity or stored in profile)
    const [totalSpent, setTotalSpent] = useState(0);
    // const monthlyBudget = 5000.00; // Hardcoded for now, could be a setting

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

            // Calculate Total Spent (Debits)
            const spent = txs
                .filter(t => t.type === 'payment' || t.type === 'withdrawal')
                .reduce((acc, curr) => acc + curr.amount, 0);
            setTotalSpent(spent);

            setLoadingHistory(false);
        });

        return () => unsubscribe();
    }, [user]);

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
                name: "AKR Hunger",
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
        <div className="min-h-screen bg-black text-white p-4 md:p-8 pb-24">
            <Script src="https://checkout.razorpay.com/v1/checkout.js" />

            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            My Wallet
                        </h1>
                        <p className="text-gray-400 mt-1">Manage your payments, balance, and transaction history</p>
                    </div>
                    <div className="flex gap-3">
                        {/* Add Funds Dialog */}
                        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold">
                                    <ArrowUpRight className="mr-2 h-4 w-4" /> Add Funds
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-gray-900 border-gray-800 text-white">
                                <DialogHeader>
                                    <DialogTitle>Add Funds to Wallet</DialogTitle>
                                    <DialogDescription className="text-gray-400">
                                        Enter the amount you want to add to your AKR Wallet.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="amount">Amount (₹)</Label>
                                        <div className="relative">
                                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                                            <Input
                                                id="amount"
                                                placeholder="e.g. 500"
                                                className="pl-9 bg-gray-800 border-gray-700 text-white"
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
                                                className="flex-1 bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300"
                                                onClick={() => setAddAmount(amt.toString())}
                                            >
                                                +₹{amt}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="ghost" onClick={() => setIsAddOpen(false)} className="text-gray-400 hover:text-white" disabled={isProcessingPayment}>Cancel</Button>
                                    <Button onClick={handleAddFunds} className="bg-orange-500 hover:bg-orange-600 text-white" disabled={isProcessingPayment}>
                                        {isProcessingPayment ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : 'Proceed to Pay'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Withdraw Dialog */}
                        <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="border-gray-700 bg-transparent hover:bg-white/10 text-white">
                                    <ArrowDownLeft className="mr-2 h-4 w-4" /> Withdraw
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Withdraw Funds</DialogTitle>
                                    <DialogDescription className="text-gray-400">
                                        Transfer funds from your wallet to your linked bank account.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center justify-between">
                                        <span className="text-sm text-orange-200">Available Withdrawal Balance</span>
                                        <span className="font-bold text-orange-500">₹{balance.toFixed(2)}</span>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="w-amount">Withdrawal Amount (₹)</Label>
                                        <div className="relative">
                                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                                            <Input
                                                id="w-amount"
                                                placeholder="Enter amount"
                                                className="pl-9 bg-gray-800 border-gray-700 text-white"
                                                value={withdrawAmount}
                                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                                type="number"
                                                max={balance}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-2">
                                        <h4 className="text-sm font-semibold text-gray-300">Bank Details</h4>
                                        <Input
                                            placeholder="Bank Name"
                                            className="bg-gray-800 border-gray-700 text-white"
                                            value={bankDetails.bankName}
                                            onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                                        />
                                        <Input
                                            placeholder="Account Holder Name"
                                            className="bg-gray-800 border-gray-700 text-white"
                                            value={bankDetails.accountHolderName}
                                            onChange={(e) => setBankDetails({ ...bankDetails, accountHolderName: e.target.value })}
                                        />
                                        <div className="grid grid-cols-2 gap-3">
                                            <Input
                                                placeholder="Account Number"
                                                className="bg-gray-800 border-gray-700 text-white"
                                                value={bankDetails.accountNumber}
                                                onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                                            />
                                            <Input
                                                placeholder="IFSC Code"
                                                className="bg-gray-800 border-gray-700 text-white"
                                                value={bankDetails.ifscCode}
                                                onChange={(e) => setBankDetails({ ...bankDetails, ifscCode: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="ghost" onClick={() => setIsWithdrawOpen(false)} className="text-gray-400 hover:text-white" disabled={isSubmittingWithdraw}>Cancel</Button>
                                    <Button onClick={handleWithdraw} className="bg-white text-black hover:bg-gray-200" disabled={isSubmittingWithdraw}>
                                        {isSubmittingWithdraw ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : 'Confirm Withdrawal'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Membership Card & Quick Stats */}
                    <div className="lg:col-span-1 space-y-6">

                        {/* Membership Card - Glassmorphism */}
                        {/* Membership Section */}
                        {issuedCard || customer?.membershipId ? (
                            /* Membership Card - Glassmorphism */
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="relative overflow-hidden rounded-2xl p-6 aspect-[1.586/1] flex flex-col justify-between shadow-2xl group cursor-pointer"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                                    backdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}
                            >
                                {/* Decorative Elements */}
                                <div className="absolute top-[-50%] left-[-50%] w-[100%] h-[100%] bg-orange-500/20 blur-[80px] rounded-full group-hover:bg-orange-500/30 transition-all duration-700" />
                                <div className="absolute bottom-[-50%] right-[-50%] w-[100%] h-[100%] bg-blue-500/20 blur-[80px] rounded-full group-hover:bg-blue-500/30 transition-all duration-700" />

                                <div className="relative z-10 flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-lg tracking-wider">AKR<span className="text-orange-500">PREMIUM</span></h3>
                                        <span className="text-xs text-gray-300 uppercase tracking-widest">Membership Card</span>
                                    </div>
                                    {issuedCard ? (
                                        <div className="flex items-center gap-2">
                                            <IndianRupee className="w-5 h-5 text-white/80" />
                                            <span className="text-lg font-bold text-white">₹{balance.toFixed(0)}</span>
                                        </div>
                                    ) : (
                                        <IndianRupee className="w-8 h-8 text-white/80" />
                                    )}
                                </div>

                                <div className="relative z-10 flex-1 flex flex-col justify-center">
                                    {issuedCard ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <CreditCard className="w-8 h-8 text-white/60" />
                                                <div className="text-xl sm:text-2xl font-mono text-white tracking-widest drop-shadow-md">
                                                    {issuedCard.cardNumber?.match(/.{1,4}/g)?.join(' ') || '**** **** **** ****'}
                                                </div>
                                            </div>
                                            <div className="flex gap-8 text-xs text-gray-300 uppercase tracking-wider font-mono pl-11">
                                                <div>
                                                    <span className="block text-[8px] text-gray-500">Valid Thru</span>
                                                    {issuedCard.expiryDate.toLocaleDateString(undefined, { month: '2-digit', year: '2-digit' })}
                                                </div>
                                                <div>
                                                    <span className="block text-[8px] text-gray-500">CVV</span>
                                                    {issuedCard.cvv}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Balance</div>
                                            <div className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-200">
                                                ₹{balance.toFixed(2)}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="relative z-10 flex justify-between items-end">
                                    <div>
                                        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Card Holder</div>
                                        <div className="font-medium tracking-wide uppercase">{user?.displayName || customer?.name || 'Valued Customer'}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                                            {issuedCard ? 'Issued' : 'Member Since'}
                                        </div>
                                        <div className="font-medium tracking-wide">
                                            {issuedCard
                                                ? issuedCard.issuedAt.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                                                : customer?.createdAt ? new Date(customer.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '2024'}
                                        </div>
                                        {!issuedCard && <div className="text-[9px] text-gray-500 uppercase mt-1">ID: {customer?.membershipId || 'N/A'}</div>}
                                    </div>
                                </div>
                            </motion.div>
                        ) : customer?.membershipStatus === 'pending' ? (
                            <Card className="bg-gray-900/50 border-gray-800 aspect-[1.586/1] flex flex-col items-center justify-center text-center p-6 dashed border-2 border-yellow-500/30">
                                <Loader2 className="w-10 h-10 text-yellow-500 animate-spin mb-4" />
                                <h3 className="text-xl font-bold text-white mb-2">Request Pending</h3>
                                <p className="text-gray-400 text-sm">Your membership request is being reviewed by our team. Please wait for approval.</p>
                            </Card>
                        ) : (
                            <Card className="bg-gray-900/50 border-gray-800 aspect-[1.586/1] flex flex-col items-center justify-center text-center p-6 dashed border-2 border-gray-700 hover:border-orange-500/50 transition-colors group">
                                <Wallet className="w-12 h-12 text-gray-600 group-hover:text-orange-500 mb-4 transition-colors" />
                                <h3 className="text-xl font-bold text-white mb-2">No Membership Card</h3>
                                <p className="text-gray-400 text-sm mb-6">Get exclusive benefits with our Premium Membership Card.</p>
                                <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="bg-orange-500 hover:bg-orange-600 text-white font-bold">
                                            Request Membership Card
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-gray-900 border-gray-800 text-white">
                                        <DialogHeader>
                                            <DialogTitle>Request Membership Card</DialogTitle>
                                            <DialogDescription className="text-gray-400">
                                                Please confirm your details to request a new membership card.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            {/* Auto-load profile details */}
                                            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 space-y-2">
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-400">Name:</span>
                                                    <span className="text-sm font-medium">{customer?.name || user?.displayName || 'Customer'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-gray-400">Email:</span>
                                                    <span className="text-sm font-medium">{user?.email}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-gray-400">Bank Details:</span>
                                                    {customer?.bankDetails?.accountNumber ? (
                                                        <Badge variant="outline" className="text-green-500 border-green-500/20 bg-green-500/10">Attached</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/10">Missing</Badge>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="contact">Contact Number</Label>
                                                <Input
                                                    id="contact"
                                                    placeholder="Enter your phone number"
                                                    value={requestContact}
                                                    onChange={(e) => setRequestContact(e.target.value)}
                                                    className="bg-gray-800 border-gray-700 text-white"
                                                />
                                            </div>

                                            {!customer?.bankDetails?.accountNumber && (
                                                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-sm text-yellow-200">
                                                    You must add your bank details before requesting a membership card.
                                                </div>
                                            )}
                                        </div>
                                        <DialogFooter>
                                            <Button variant="ghost" onClick={() => setIsRequestOpen(false)} className="text-gray-400 hover:text-white">Cancel</Button>
                                            {customer?.bankDetails?.accountNumber ? (
                                                <Button onClick={handleRequestMembership} disabled={isSubmittingRequest} className="bg-orange-600 hover:bg-orange-700 font-bold w-full sm:w-auto">
                                                    {isSubmittingRequest ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : 'Submit Request'}
                                                </Button>
                                            ) : (
                                                <Button onClick={() => { setIsRequestOpen(false); setIsBankDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700 font-bold">
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
                            <Card className="bg-gray-900/50 border-gray-800 hover:bg-gray-900/80 transition-colors">
                                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                    <div className="p-2 mb-2 rounded-full bg-red-500/10 text-red-500">
                                        <TrendingUp className="w-5 h-5" />
                                    </div>
                                    <p className="text-xs text-gray-400">Total Spent</p>
                                    <p className="text-lg font-bold text-white">₹{totalSpent.toLocaleString()}</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-gray-900/50 border-gray-800 hover:bg-gray-900/80 transition-colors">
                                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                    <div className="p-2 mb-2 rounded-full bg-green-500/10 text-green-500">
                                        <Banknote className="w-5 h-5" />
                                    </div>
                                    <p className="text-xs text-gray-400">Add Funds</p>
                                    <p className="text-lg font-bold text-white cursor-pointer hover:text-orange-500 transition-colors" onClick={() => setIsAddOpen(true)}>+ Top Up</p>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="bg-gradient-to-br from-gray-900 to-gray-950 border-gray-800">
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-gray-400">Spending Overview</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span>Food Orders</span>
                                            <span className="font-bold">75%</span>
                                        </div>
                                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-orange-500 w-[75%]" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span>Delivery Fees</span>
                                            <span className="font-bold">15%</span>
                                        </div>
                                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 w-[15%]" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span>Tips</span>
                                            <span className="font-bold">10%</span>
                                        </div>
                                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-green-500 w-[10%]" />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Add Bank Account Card */}
                        <Card className="bg-gray-900/50 border-gray-800 hover:bg-gray-900/80 transition-colors group">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div className="space-y-1">
                                    <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                                        <CreditCard className="w-4 h-4 text-blue-500" />
                                        Active Bank Account
                                    </CardTitle>
                                </div>
                                <Dialog open={isBankDialogOpen} onOpenChange={setIsBankDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white">
                                            <div className="bg-gray-800 p-1.5 rounded-md">
                                                {/* Edit Icon */}
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                            </div>
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-gray-900 border-gray-800 text-white">
                                        <DialogHeader>
                                            <DialogTitle>{customer?.bankDetails ? 'Update' : 'Add'} Bank Details</DialogTitle>
                                            <DialogDescription className="text-gray-400">
                                                These details will be used for withdrawals and membership verification.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label>Bank Name</Label>
                                                <Input
                                                    placeholder="e.g. HDFC Bank"
                                                    className="bg-gray-800 border-gray-700 text-white"
                                                    value={bankDetails.bankName}
                                                    onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Account Holder Name</Label>
                                                <Input
                                                    placeholder="e.g. John Doe"
                                                    className="bg-gray-800 border-gray-700 text-white"
                                                    value={bankDetails.accountHolderName}
                                                    onChange={(e) => setBankDetails({ ...bankDetails, accountHolderName: e.target.value })}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-2">
                                                    <Label>Account Number</Label>
                                                    <Input
                                                        placeholder="XXXXXXXX1234"
                                                        className="bg-gray-800 border-gray-700 text-white"
                                                        value={bankDetails.accountNumber}
                                                        onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>IFSC Code</Label>
                                                    <Input
                                                        placeholder="HDFC0001234"
                                                        className="bg-gray-800 border-gray-700 text-white"
                                                        value={bankDetails.ifscCode}
                                                        onChange={(e) => setBankDetails({ ...bankDetails, ifscCode: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="ghost" onClick={() => setIsBankDialogOpen(false)} className="text-gray-400 hover:text-white">Cancel</Button>
                                            <Button onClick={handleSaveBankDetails} className="bg-blue-600 hover:bg-blue-700 text-white" disabled={isSavingBank}>
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
                                                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold">
                                                    {customer.bankDetails.bankName.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-white">{customer.bankDetails.bankName}</div>
                                                    <div className="text-xs text-gray-500">•••• {customer.bankDetails.accountNumber.slice(-4)}</div>
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="border-green-500/20 text-green-500 bg-green-500/10 text-[10px] uppercase tracking-wider">
                                                Verified
                                            </Badge>
                                        </div>
                                        <div className="pt-3 border-t border-gray-800 flex justify-between text-xs text-gray-500">
                                            <span>Holder: <span className="text-gray-300">{customer.bankDetails.accountHolderName}</span></span>
                                            <span>IFSC: <span className="text-gray-300">{customer.bankDetails.ifscCode}</span></span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-4 text-center space-y-3">
                                        <div className="p-3 bg-gray-800/50 rounded-full text-gray-500">
                                            <Banknote className="w-6 h-6 opacity-50" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-gray-300">No Bank Account Linked</p>
                                            <p className="text-xs text-gray-500">Link your account for faster withdrawals.</p>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => setIsBankDialogOpen(true)} className="border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 hover:text-white w-full">
                                            Add Bank Account
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                    </div>

                    {/* Right Column: Transaction History */}
                    <div className="lg:col-span-2">
                        <Card className="bg-gray-900/50 border-gray-800 h-full">
                            <CardHeader className="flex flex-row items-center justify-between pb-6">
                                <div>
                                    <CardTitle className="text-xl">Transaction History</CardTitle>
                                    <CardDescription>Recent activity on your wallet</CardDescription>
                                </div>
                                {/* <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                  <Calendar className="mr-2 h-4 w-4" /> Filter by Date
                </Button> */}
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {loadingHistory ? (
                                        <div className="flex justify-center py-8"><Loader2 className="animate-spin w-8 h-8 text-orange-500" /></div>
                                    ) : transactions.length === 0 ? (
                                        <div className="text-center py-12 text-gray-500">
                                            <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                            <p>No transactions yet</p>
                                        </div>
                                    ) : (
                                        transactions.map((tx) => (
                                            <div key={tx.id} className="group flex items-center justify-between p-4 rounded-xl bg-gray-800/30 hover:bg-gray-800/50 border border-gray-800/50 hover:border-gray-700 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-3 rounded-xl ${tx.type === 'deposit' || tx.type === 'refund' || tx.type === 'bonus'
                                                        ? 'bg-green-500/10 text-green-500'
                                                        : 'bg-red-500/10 text-red-500'
                                                        }`}>
                                                        {tx.type === 'deposit' || tx.type === 'refund' || tx.type === 'bonus' ? (
                                                            <ArrowDownLeft className="h-5 w-5" />
                                                        ) : (
                                                            <ArrowUpRight className="h-5 w-5" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-white group-hover:text-blue-400 transition-colors">{tx.description}</p>
                                                        <p className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                                            <History className="w-3 h-3" /> {tx.createdAt.toLocaleDateString()}
                                                            <span className="w-1 h-1 bg-gray-700 rounded-full" />
                                                            <span className="capitalize">{tx.type}</span>
                                                            {tx.referenceId && <span className="text-[10px] bg-gray-800 px-1 rounded ml-1">{tx.referenceId.slice(0, 8)}...</span>}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`font-bold ${tx.type === 'deposit' || tx.type === 'refund' || tx.type === 'bonus'
                                                        ? 'text-green-500'
                                                        : 'text-white'
                                                        }`}>
                                                        {tx.type === 'deposit' || tx.type === 'refund' || tx.type === 'bonus' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                                                    </p>
                                                    <Badge variant="secondary" className={`mt-1 text-[10px] uppercase ${tx.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                                                        tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'
                                                        }`}>
                                                        {tx.status}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))
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
