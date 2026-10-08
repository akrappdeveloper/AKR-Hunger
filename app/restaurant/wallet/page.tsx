'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    Wallet as WalletIcon, TrendingUp, DollarSign, Clock,
    CheckCircle, Landmark, ArrowDownCircle, ArrowUpCircle,
    Lock, ShieldAlert, AlertTriangle, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Transaction {
    id: string;
    orderId: string;
    amount: number;
    type: 'earning' | 'withdrawal';
    status: 'completed' | 'pending' | 'rejected';
    date: Date;
    customerName?: string;
}

export default function RestaurantWalletPage() {
    const router = useRouter();
    const { user, restaurant, loading: authLoading } = useRestaurantAuth();

    const [loading, setLoading] = useState(true);
    const [totalEarnings, setTotalEarnings] = useState(0);
    const [availableBalance, setAvailableBalance] = useState(0);
    const [pendingWithdrawals, setPendingWithdrawals] = useState(0);
    const [totalWithdrawn, setTotalWithdrawn] = useState(0);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    // Withdrawal Dialog
    const [withdrawalDialog, setWithdrawalDialog] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);

    // Feedback Dialogs
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string, open: boolean }>({
        type: 'success',
        message: '',
        open: false
    });

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/restaurant/login');
            return;
        }
        loadWalletData();
    }, [user, authLoading, router]);

    const loadWalletData = async () => {
        try {
            setLoading(true);
            const ordersRef = collection(db, 'orders');
            const withdrawalsRef = collection(db, 'withdrawalRequests');

            // 1. Get all delivered orders (Earnings)
            const qOrders = query(
                ordersRef,
                where('restaurantId', '==', user!.uid),
                where('status', '==', 'delivered')
            );
            const snapshotOrders = await getDocs(qOrders);

            let totalEarned = 0;
            const orderTrans: Transaction[] = [];

            snapshotOrders.docs.forEach(doc => {
                const data = doc.data();
                // Calculate items subtotal
                const subtotal = data.items?.reduce((sum: number, item: any) => {
                    return sum + (item.price * item.quantity);
                }, 0) || 0;

                totalEarned += subtotal;

                orderTrans.push({
                    id: doc.id,
                    orderId: doc.id,
                    amount: subtotal,
                    type: 'earning',
                    status: 'completed',
                    date: data.createdAt?.toDate() || new Date(),
                    customerName: data.customerName || 'Customer',
                });
            });

            // 2. Get all withdrawal requests
            const qWithdrawals = query(
                withdrawalsRef,
                where('restaurantId', '==', user!.uid)
            );
            const snapshotWithdrawals = await getDocs(qWithdrawals);

            let totalPending = 0;
            let totalWithdrawn = 0;
            const withdrawalTrans: Transaction[] = [];

            snapshotWithdrawals.docs.forEach(doc => {
                const data = doc.data();
                const amount = data.amount || 0;

                if (data.status === 'pending') {
                    totalPending += amount;
                } else if (data.status === 'completed') {
                    totalWithdrawn += amount;
                }

                withdrawalTrans.push({
                    id: doc.id,
                    orderId: `WD-${doc.id.slice(0, 6)}`,
                    amount: amount,
                    type: 'withdrawal',
                    status: data.status,
                    date: data.requestedAt?.toDate() || new Date(),
                    customerName: 'Bank Transfer'
                });
            });

            // 3. Calculate Final Balances
            // Available = Total Earnings - (Pending + Completed Withdrawals)
            const currentAvailable = totalEarned - (totalPending + totalWithdrawn);

            setTotalEarnings(totalEarned);
            setAvailableBalance(currentAvailable);
            setPendingWithdrawals(totalPending);
            setTotalWithdrawn(totalWithdrawn); // Need to add this state

            // Merge and sort transactions
            const allTrans = [...orderTrans, ...withdrawalTrans].sort((a, b) =>
                b.date.getTime() - a.date.getTime()
            );
            setTransactions(allTrans);

        } catch (error) {
            console.error('[Wallet] Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const hasValidBank = Boolean(
      restaurant?.bankDetails &&
      restaurant.bankDetails.bankName?.trim() &&
      restaurant.bankDetails.accountNumber?.trim() &&
      restaurant.bankDetails.ifscCode?.trim()
    );

    const handleWithdrawalSubmit = async () => {
        try {
            if (!hasValidBank) {
                toast.error('Withdrawal Locked: Bank account details are required before requesting a payout.');
                setFeedback({
                    type: 'error',
                    message: 'You cannot request a withdrawal without adding your verified bank account details. Please add your bank details in Settings first.',
                    open: true
                });
                return;
            }

            const amount = parseFloat(withdrawAmount);
            if (isNaN(amount) || amount <= 0) {
                toast.error('Please enter a valid withdrawal amount');
                return;
            }

            if (amount > availableBalance) {
                toast.error(`Cannot withdraw more than available balance (₹${availableBalance.toFixed(2)})`);
                return;
            }

            setSubmittingWithdrawal(true);

            // Save withdrawal request to Firestore with bank details
            await addDoc(collection(db, 'withdrawalRequests'), {
                restaurantId: user!.uid,
                restaurantName: restaurant?.name || 'Restaurant',
                amount: amount,
                status: 'pending',
                bankDetails: {
                    bankName: restaurant?.bankDetails?.bankName || '',
                    accountHolderName: restaurant?.bankDetails?.accountHolderName || restaurant?.name || '',
                    accountNumber: restaurant?.bankDetails?.accountNumber || '',
                    ifscCode: restaurant?.bankDetails?.ifscCode || '',
                },
                requestedAt: new Date(),
                createdAt: new Date(),
            });

            setWithdrawalDialog(false);
            setWithdrawAmount('');
            setFeedback({
                type: 'success',
                message: 'Your withdrawal request has been submitted successfully to the admin.',
                open: true
            });
            toast.success('Withdrawal request submitted successfully!');

            // Reload wallet data
            loadWalletData();
        } catch (error) {
            console.error('[Wallet] Error submitting withdrawal:', error);
            setFeedback({
                type: 'error',
                message: 'Failed to submit withdrawal request. Please try again later or contact support.',
                open: true
            });
            toast.error('Failed to submit withdrawal request.');
        } finally {
            setSubmittingWithdrawal(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="p-8 min-h-screen bg-background flex items-center justify-center">
                <Spinner className="w-8 h-8 text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 space-y-6 transition-colors duration-300 font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-emerald-500 via-teal-500 to-green-500 bg-clip-text text-transparent flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center shadow-md">
                            <WalletIcon className="w-7 h-7 text-emerald-500" />
                        </div>
                        Wallet
                    </h1>
                    <p className="text-muted-foreground mt-2 text-base md:text-lg font-medium">Track your earnings and manage payouts</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Earnings */}
                <Card className="p-6 relative overflow-hidden group hover:shadow-lg transition-all bg-card border-border">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                            <TrendingUp className="w-6 h-6 text-emerald-500" />
                        </div>
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold">All Time</Badge>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground font-semibold uppercase tracking-wide">Total Earnings</p>
                    <p className="text-3xl sm:text-4xl font-bold text-foreground mt-2">₹{totalEarnings.toFixed(2)}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 font-medium">Order subtotal only</p>
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-tl-full pointer-events-none" />
                </Card>

                {/* Available Balance */}
                <Card className="p-6 relative overflow-hidden group hover:shadow-lg transition-all bg-card border-border">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                            <DollarSign className="w-6 h-6 text-blue-500" />
                        </div>
                        <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 font-bold">Available</Badge>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground font-semibold uppercase tracking-wide">Available Balance</p>
                    <p className="text-3xl sm:text-4xl font-bold text-foreground mt-2">₹{availableBalance.toFixed(2)}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 font-medium">Ready for withdrawal</p>
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-500/5 rounded-tl-full pointer-events-none" />
                </Card>

                {/* Pending Withdrawals */}
                <Card className="p-6 relative overflow-hidden group hover:shadow-lg transition-all bg-card border-border">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                            <Clock className="w-6 h-6 text-amber-500" />
                        </div>
                        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold">Pending</Badge>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground font-semibold uppercase tracking-wide">Pending Withdrawals</p>
                    <p className="text-3xl sm:text-4xl font-bold text-foreground mt-2">₹{pendingWithdrawals.toFixed(2)}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 font-medium">Being processed</p>
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-amber-500/5 rounded-tl-full pointer-events-none" />
                </Card>

                {/* Total Withdrawn (Bank Cart) */}
                <Card className="p-6 relative overflow-hidden group hover:shadow-lg transition-all bg-card border-border">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                            <Landmark className="w-6 h-6 text-purple-500" />
                        </div>
                        <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 font-bold">Processed</Badge>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground font-semibold uppercase tracking-wide">Bank Received</p>
                    <p className="text-3xl sm:text-4xl font-bold text-foreground mt-2">₹{totalWithdrawn.toFixed(2)}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 font-medium">Successfully transferred</p>
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500/5 rounded-tl-full pointer-events-none" />
                </Card>
            </div>

            {/* Bank Account Info & Withdrawal Control */}
            {hasValidBank ? (
                <Card className="p-6 bg-card border-border shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center shadow-sm">
                                <Landmark className="w-7 h-7 text-emerald-500" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-foreground font-bold text-lg">Linked Bank Account</p>
                                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                                    Verified & Ready
                                  </Badge>
                                </div>
                                <p className="text-muted-foreground text-sm font-medium mt-1">
                                    {restaurant?.bankDetails?.accountHolderName || restaurant?.name} • {restaurant?.bankDetails?.bankName} (IFSC: {restaurant?.bankDetails?.ifscCode})
                                </p>
                                <p className="text-muted-foreground text-sm font-mono mt-0.5">
                                    Account No: {restaurant?.bankDetails?.accountNumber.replace(/./g, (c: string, i: number) =>
                                        i < (restaurant?.bankDetails?.accountNumber.length || 0) - 4 ? '•' : c
                                    )}
                                </p>
                            </div>
                        </div>
                        <Button
                            onClick={() => setWithdrawalDialog(true)}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm shadow-md h-11 px-6 rounded-xl"
                            disabled={availableBalance <= 0}
                        >
                            Request Withdrawal
                        </Button>
                    </div>
                </Card>
            ) : (
                <Card className="p-6 bg-red-500/10 border-red-500/30">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-500 flex items-center justify-center shrink-0">
                                <Lock className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-foreground font-bold text-base">Withdrawal Locked — Bank Account Required</p>
                                  <Badge className="bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 text-[10px]">
                                    Not Configured
                                  </Badge>
                                </div>
                                <p className="text-muted-foreground text-xs sm:text-sm mt-1 max-w-xl">
                                    You cannot request a withdrawal without adding your verified bank account details (Bank Name, Account Holder Name, Account Number, and IFSC Code).
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            <Button
                                asChild
                                className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs h-10 px-4 rounded-xl gap-1.5 shadow-md shadow-red-600/20"
                            >
                                <Link href="/restaurant/settings">
                                    <Landmark className="w-4 h-4" /> Link Bank in Settings
                                </Link>
                            </Button>
                            <Button
                                disabled
                                variant="outline"
                                className="border-border text-muted-foreground opacity-60 font-semibold text-xs h-10 px-3 rounded-xl cursor-not-allowed"
                                title="Add bank account in Settings to enable withdrawal"
                            >
                                <Lock className="w-3.5 h-3.5 mr-1" /> Request Locked
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* Transaction History */}
            <Card className="p-6 bg-card border-border shadow-sm">
                <h2 className="text-2xl font-bold text-foreground mb-6">Transaction History</h2>

                {transactions.length === 0 ? (
                    <div className="text-center py-12">
                        <WalletIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-40" />
                        <p className="text-muted-foreground font-medium">No transactions yet</p>
                        <p className="text-muted-foreground/80 text-sm mt-2">Complete orders to start earning</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {transactions.map((transaction) => (
                            <div
                                key={transaction.id}
                                className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border hover:bg-muted/60 transition"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${transaction.type === 'earning'
                                        ? 'bg-emerald-500/10 border border-emerald-500/30'
                                        : 'bg-red-500/10 border border-red-500/30'
                                        }`}>
                                        {transaction.type === 'earning' ? (
                                            <ArrowUpCircle className="w-5 h-5 text-emerald-500" />
                                        ) : (
                                            <ArrowDownCircle className="w-5 h-5 text-red-500" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-foreground font-semibold">
                                            {transaction.type === 'earning' ? 'Order Payment (Subtotal)' : 'Withdrawal'}
                                        </p>
                                        <p className="text-sm text-muted-foreground font-medium">
                                            {transaction.customerName} • Order #{transaction.orderId.slice(0, 8)}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {transaction.date.toLocaleDateString()} {transaction.date.toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-xl font-bold ${transaction.type === 'earning' ? 'text-emerald-500' : 'text-red-500'
                                        }`}>
                                        {transaction.type === 'earning' ? '+' : '-'}₹{transaction.amount.toFixed(2)}
                                    </p>
                                    <Badge className={`mt-1 capitalize ${transaction.status === 'completed'
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                            : transaction.status === 'rejected'
                                                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                        }`}>
                                        {transaction.status}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Withdrawal Dialog */}
            <Dialog open={withdrawalDialog} onOpenChange={setWithdrawalDialog}>
                <DialogContent className="bg-card border-border text-card-foreground shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-foreground">Request Withdrawal</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Enter the amount you want to withdraw from your wallet
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground font-semibold">Available Balance:</span>
                                <span className="text-2xl font-bold text-emerald-500">₹{availableBalance.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="amount" className="text-foreground font-semibold">Withdrawal Amount</Label>
                            <Input
                                id="amount"
                                type="number"
                                placeholder="Enter amount"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                className="bg-card border-border text-foreground text-lg font-semibold"
                                min="0"
                                max={availableBalance}
                                step="0.01"
                            />
                            <div className="flex gap-2 mt-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setWithdrawAmount((availableBalance / 4).toFixed(2))}
                                    className="bg-muted text-foreground border-border hover:bg-muted/80"
                                >
                                    25%
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setWithdrawAmount((availableBalance / 2).toFixed(2))}
                                    className="bg-muted text-foreground border-border hover:bg-muted/80"
                                >
                                    50%
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setWithdrawAmount(availableBalance.toFixed(2))}
                                    className="bg-muted text-foreground border-border hover:bg-muted/80"
                                >
                                    100% (Full)
                                </Button>
                            </div>
                        </div>

                        {restaurant?.bankDetails && (
                            <div className="p-4 bg-muted/30 rounded-xl border border-border">
                                <p className="text-xs text-muted-foreground font-semibold mb-2 uppercase tracking-wider">Withdrawal will be sent to:</p>
                                <p className="text-foreground font-bold">{restaurant?.bankDetails?.accountHolderName}</p>
                                <p className="text-muted-foreground text-sm">{restaurant?.bankDetails?.bankName}</p>
                                <p className="text-muted-foreground text-sm font-mono">
                                    {restaurant?.bankDetails?.accountNumber.replace(/./g, (c: string, i: number) =>
                                        i < (restaurant?.bankDetails?.accountNumber.length || 0) - 4 ? '•' : c
                                    )}
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setWithdrawalDialog(false);
                                setWithdrawAmount('');
                            }}
                            className="border-border text-foreground hover:bg-muted"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleWithdrawalSubmit}
                            disabled={submittingWithdrawal || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                        >
                            {submittingWithdrawal && <Spinner className="mr-2 h-4 w-4" />}
                            Submit Withdrawal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Feedback Dialog */}
            <Dialog open={feedback.open} onOpenChange={(open) => setFeedback(prev => ({ ...prev, open }))}>
                <DialogContent className="bg-card border-border text-card-foreground max-w-sm text-center shadow-2xl">
                    <div className="flex justify-center mb-4">
                        {feedback.type === 'success' ? (
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border-2 border-emerald-500">
                                <CheckCircle className="w-8 h-8 text-emerald-500" />
                            </div>
                        ) : (
                            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center border-2 border-destructive">
                                <ArrowDownCircle className="w-8 h-8 text-destructive" />
                            </div>
                        )}
                    </div>
                    <DialogTitle className="text-xl font-bold mb-2 text-foreground">
                        {feedback.type === 'success' ? 'Success!' : 'Error'}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-base">
                        {feedback.message}
                    </DialogDescription>
                    <DialogFooter className="mt-6 flex justify-center">
                        <Button
                            onClick={() => setFeedback(prev => ({ ...prev, open: false }))}
                            className={feedback.type === 'success' ? "bg-primary text-primary-foreground hover:bg-primary/90 w-full font-bold" : "bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full font-bold"}
                        >
                            {feedback.type === 'success' ? 'Great!' : 'Close'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
