'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    Wallet as WalletIcon, TrendingUp, DollarSign, Clock,
    CheckCircle, Landmark, ArrowDownCircle, ArrowUpCircle
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Transaction {
    id: string;
    orderId: string;
    amount: number;
    type: 'earning' | 'withdrawal';
    status: 'completed' | 'pending';
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
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    // Withdrawal Dialog
    const [withdrawalDialog, setWithdrawalDialog] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);

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

            // Get all delivered orders - simplified query
            const q = query(
                ordersRef,
                where('restaurantId', '==', user!.uid),
                where('status', '==', 'delivered')
            );

            const snapshot = await getDocs(q);
            let orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Sort by date
            orders = orders.sort((a: any, b: any) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateB.getTime() - dateA.getTime();
            });

            // Calculate earnings (only Subtotal - items total, exclude delivery)
            let total = 0;
            const trans: Transaction[] = [];

            orders.forEach((order: any) => {
                // Calculate items subtotal (excluding delivery charge and tax)
                const subtotal = order.items?.reduce((sum: number, item: any) => {
                    return sum + (item.price * item.quantity);
                }, 0) || 0;

                total += subtotal;

                trans.push({
                    id: order.id,
                    orderId: order.id,
                    amount: subtotal,
                    type: 'earning',
                    status: 'completed',
                    date: order.createdAt?.toDate() || new Date(),
                    customerName: order.customerName || 'Customer',
                });
            });

            setTotalEarnings(total);
            setAvailableBalance(total);
            setTransactions(trans);
        } catch (error) {
            console.error('[Wallet] Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleWithdrawalSubmit = async () => {
        try {
            if (!restaurant?.bankDetails) {
                alert('Please add bank details in Settings first');
                return;
            }

            const amount = parseFloat(withdrawAmount);
            if (isNaN(amount) || amount <= 0) {
                alert('Please enter a valid amount');
                return;
            }

            if (amount > availableBalance) {
                alert(`Cannot withdraw more than available balance (₹${availableBalance.toFixed(2)})`);
                return;
            }

            setSubmittingWithdrawal(true);

            // Save withdrawal request to Firestore with bank details
            await addDoc(collection(db, 'withdrawalRequests'), {
                restaurantId: user!.uid,
                restaurantName: restaurant.name || 'Restaurant',
                amount: amount,
                status: 'pending',
                bankDetails: {
                    bankName: restaurant.bankDetails.bankName,
                    accountHolderName: restaurant.bankDetails.accountHolderName,
                    accountNumber: restaurant.bankDetails.accountNumber,
                    ifscCode: restaurant.bankDetails.ifscCode,
                },
                requestedAt: new Date(),
                createdAt: new Date(),
            });

            alert('Withdrawal request submitted successfully!');
            setWithdrawalDialog(false);
            setWithdrawAmount('');

            // Reload wallet data
            loadWalletData();
        } catch (error) {
            console.error('[Wallet] Error submitting withdrawal:', error);
            alert('Failed to submit withdrawal request');
        } finally {
            setSubmittingWithdrawal(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-32 bg-gray-800/50 rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-400 via-emerald-400 to-green-300 bg-clip-text text-transparent flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30">
                            <WalletIcon className="w-7 h-7 text-white" />
                        </div>
                        Wallet
                    </h1>
                    <p className="text-gray-200 mt-2 text-lg font-medium">Track your earnings and manage payouts</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Earnings */}
                <Card className="p-6 relative overflow-hidden group hover:shadow-2xl transition-all bg-gray-800/50 border-green-700/30">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-green-500/20 rounded-xl border border-green-500/30">
                            <TrendingUp className="w-6 h-6 text-green-400" />
                        </div>
                        <Badge className="bg-green-500/20 text-green-300 border-green-500/30 font-bold">All Time</Badge>
                    </div>
                    <p className="text-sm text-gray-300 font-semibold uppercase tracking-wide">Total Earnings</p>
                    <p className="text-4xl font-bold text-white mt-2">₹{totalEarnings.toFixed(2)}</p>
                    <p className="text-sm text-gray-400 mt-2 font-medium">Order subtotal only</p>
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/20 to-transparent rounded-tl-full" />
                </Card>

                {/* Available Balance */}
                <Card className="p-6 relative overflow-hidden group hover:shadow-2xl transition-all bg-gray-800/50 border-blue-700/30">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30">
                            <DollarSign className="w-6 h-6 text-blue-400" />
                        </div>
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 font-bold">Available</Badge>
                    </div>
                    <p className="text-sm text-gray-300 font-semibold uppercase tracking-wide">Available Balance</p>
                    <p className="text-4xl font-bold text-white mt-2">₹{availableBalance.toFixed(2)}</p>
                    <p className="text-sm text-gray-400 mt-2 font-medium">Ready for withdrawal</p>
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent rounded-tl-full" />
                </Card>

                {/* Pending Withdrawals */}
                <Card className="p-6 relative overflow-hidden group hover:shadow-2xl transition-all bg-gray-800/50 border-orange-700/30">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-orange-500/20 rounded-xl border border-orange-500/30">
                            <Clock className="w-6 h-6 text-orange-400" />
                        </div>
                        <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 font-bold">Pending</Badge>
                    </div>
                    <p className="text-sm text-gray-300 font-semibold uppercase tracking-wide">Pending Withdrawals</p>
                    <p className="text-4xl font-bold text-white mt-2">₹{pendingWithdrawals.toFixed(2)}</p>
                    <p className="text-sm text-gray-400 mt-2 font-medium">Being processed</p>
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500/20 to-transparent rounded-tl-full" />
                </Card>
            </div>

            {/* Bank Account Info */}
            {restaurant?.bankDetails && (
                <Card className="p-6 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border-gray-700 backdrop-blur-sm shadow-xl">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                                <Landmark className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <p className="text-white font-bold text-lg">Linked Bank Account</p>
                                <p className="text-gray-300 text-sm font-medium mt-1">
                                    {restaurant.bankDetails.accountHolderName} • {restaurant.bankDetails.bankName}
                                </p>
                                <p className="text-gray-400 text-sm font-mono">
                                    {restaurant.bankDetails.accountNumber.replace(/./g, (c: string, i: number) =>
                                        i < restaurant.bankDetails.accountNumber.length - 4 ? '•' : c
                                    )}
                                </p>
                            </div>
                        </div>
                        <Button
                            onClick={() => setWithdrawalDialog(true)}
                            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 font-semibold shadow-lg"
                            disabled={availableBalance === 0}
                        >
                            Request Withdrawal
                        </Button>
                    </div>
                </Card>
            )}

            {!restaurant?.bankDetails && (
                <Card className="p-6 bg-orange-900/20 border-orange-700/30">
                    <div className="flex items-center gap-3">
                        <Clock className="w-6 h-6 text-orange-400" />
                        <div>
                            <p className="text-white font-semibold">Bank Account Not Configured</p>
                            <p className="text-gray-300 text-sm mt-1">
                                Please add your bank details in Settings to enable withdrawals.
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Transaction History */}
            <Card className="p-6 bg-gray-900/50 border-gray-800 backdrop-blur-sm shadow-xl">
                <h2 className="text-2xl font-bold text-white mb-6">Transaction History</h2>

                {transactions.length === 0 ? (
                    <div className="text-center py-12">
                        <WalletIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 font-medium">No transactions yet</p>
                        <p className="text-gray-500 text-sm mt-2">Complete orders to start earning</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {transactions.map((transaction) => (
                            <div
                                key={transaction.id}
                                className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl border border-gray-700 hover:bg-gray-800 transition"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${transaction.type === 'earning'
                                        ? 'bg-green-500/20 border border-green-500/30'
                                        : 'bg-red-500/20 border border-red-500/30'
                                        }`}>
                                        {transaction.type === 'earning' ? (
                                            <ArrowUpCircle className="w-5 h-5 text-green-400" />
                                        ) : (
                                            <ArrowDownCircle className="w-5 h-5 text-red-400" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-white font-semibold">
                                            {transaction.type === 'earning' ? 'Order Payment (Subtotal)' : 'Withdrawal'}
                                        </p>
                                        <p className="text-sm text-gray-400 font-medium">
                                            {transaction.customerName} • Order #{transaction.orderId.slice(0, 8)}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {transaction.date.toLocaleDateString()} {transaction.date.toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-xl font-bold ${transaction.type === 'earning' ? 'text-green-400' : 'text-red-400'
                                        }`}>
                                        {transaction.type === 'earning' ? '+' : '-'}₹{transaction.amount.toFixed(2)}
                                    </p>
                                    <Badge className={`mt-1 ${transaction.status === 'completed'
                                        ? 'bg-green-500/20 text-green-300 border-green-500/30'
                                        : 'bg-orange-500/20 text-orange-300 border-orange-500/30'
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
                <DialogContent className="bg-gray-900 border-gray-700">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-white">Request Withdrawal</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Enter the amount you want to withdraw from your wallet
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="p-4 bg-blue-900/20 border border-blue-700/30 rounded-xl">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-300 font-semibold">Available Balance:</span>
                                <span className="text-2xl font-bold text-green-400">₹{availableBalance.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="amount" className="text-white font-semibold">Withdrawal Amount</Label>
                            <Input
                                id="amount"
                                type="number"
                                placeholder="Enter amount"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                className="bg-gray-800 border-gray-700 text-white text-lg font-semibold"
                                min="0"
                                max={availableBalance}
                                step="0.01"
                            />
                            <div className="flex gap-2 mt-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setWithdrawAmount((availableBalance / 4).toFixed(2))}
                                    className="bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700"
                                >
                                    25%
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setWithdrawAmount((availableBalance / 2).toFixed(2))}
                                    className="bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700"
                                >
                                    50%
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setWithdrawAmount(availableBalance.toFixed(2))}
                                    className="bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700"
                                >
                                    100% (Full)
                                </Button>
                            </div>
                        </div>

                        {restaurant?.bankDetails && (
                            <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                                <p className="text-sm text-gray-400 font-semibold mb-2">Withdrawal will be sent to:</p>
                                <p className="text-white font-bold">{restaurant.bankDetails.accountHolderName}</p>
                                <p className="text-gray-300 text-sm">{restaurant.bankDetails.bankName}</p>
                                <p className="text-gray-400 text-sm font-mono">
                                    {restaurant.bankDetails.accountNumber.replace(/./g, (c: string, i: number) =>
                                        i < restaurant.bankDetails.accountNumber.length - 4 ? '•' : c
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
                            className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleWithdrawalSubmit}
                            disabled={submittingWithdrawal || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 font-semibold"
                        >
                            {submittingWithdrawal && <Spinner className="mr-2 h-4 w-4" />}
                            Submit Withdrawal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
