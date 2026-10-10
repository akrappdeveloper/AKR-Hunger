'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, where, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PointsAccount, PointsTransaction, Restaurant } from '@/lib/types';
import {
    Search,
    Wallet,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownLeft,
    Clock,
    MoreVertical,
    PlusCircle,
    MinusCircle,
    Store,
    Filter,
    CreditCard
} from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function PointsPage() {
    const [accounts, setAccounts] = useState<(PointsAccount & { restaurantName?: string, restaurantImage?: string })[]>([]);
    const [restaurants, setRestaurants] = useState<Record<string, Restaurant>>({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Selection & Transactions
    const [selectedAccount, setSelectedAccount] = useState<(PointsAccount & { restaurantName?: string, restaurantImage?: string }) | null>(null);
    const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);

    // Adjust Points Dialog
    const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
    const [adjustType, setAdjustType] = useState<'add' | 'deduct'>('add');
    const [adjustAmount, setAdjustAmount] = useState('');
    const [adjustDescription, setAdjustDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 1. Fetch Restaurants (One-time or Listener) to map IDs to Names
    useEffect(() => {
        const q = query(collection(db, 'restaurants'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const restMap: Record<string, Restaurant> = {};
            snapshot.docs.forEach(doc => {
                restMap[doc.id] = { id: doc.id, ...doc.data() } as Restaurant;
            });
            setRestaurants(restMap);
        });
        return () => unsubscribe();
    }, []);

    // 2. Fetch Points Accounts
    useEffect(() => {
        const q = query(collection(db, 'pointsAccounts'), orderBy('totalPoints', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const acct = doc.data() as PointsAccount;
                return {
                    id: doc.id,
                    ...acct,
                    restaurantName: restaurants[acct.userId]?.name || 'Unknown Restaurant',
                    restaurantImage: restaurants[acct.userId]?.image,
                };
            });
            // Re-map with latest restaurants if needed, but dependency on 'restaurants' might cause loop if not careful.
            // Better to merge in render or in a separate effect. 
            // Here we rely on restaurants already being populated or updating on next render? 
            // Actually, let's just use the restaurants state in the map function.
            // But verify useEffect dependency.
        });
        // We need a stable listener. 
        // Let's optimize: Listener sets raw accounts. Another effect merges names.
    }, []); // accounts listener

    // Optimized Data Fetching
    useEffect(() => {
        const q = query(collection(db, 'pointsAccounts'), orderBy('totalPoints', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const rawAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PointsAccount));

            setAccounts(prev => {
                // Merge with current restaurants state
                return rawAccounts.map(acc => ({
                    ...acc,
                    restaurantName: restaurants[acc.userId]?.name || 'Loading...',
                    restaurantImage: restaurants[acc.userId]?.image
                }));
            });
            setLoading(false);
        });
        return () => unsubscribe();
    }, [restaurants]); // Re-run when restaurants load to update names


    // 3. Fetch Transactions when Account Selected
    useEffect(() => {
        if (!selectedAccount?.userId) return;
        setLoadingTransactions(true);
        const q = query(
            collection(db, 'pointsTransactions'),
            where('userId', '==', selectedAccount.userId),
            orderBy('createdAt', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PointsTransaction)));
            setLoadingTransactions(false);
        });
        return () => unsubscribe();
    }, [selectedAccount]);

    const handleAdjustPoints = async () => {
        if (!selectedAccount || !adjustAmount || !adjustDescription) return;

        setIsSubmitting(true);
        const amount = parseInt(adjustAmount);
        if (isNaN(amount) || amount <= 0) {
            alert("Invalid amount");
            setIsSubmitting(false);
            return;
        }

        const finalAmount = adjustType === 'add' ? amount : -amount;
        const newBalance = (selectedAccount.availablePoints || 0) + finalAmount;

        if (newBalance < 0) {
            alert("Insufficient funds for deduction");
            setIsSubmitting(false);
            return;
        }

        try {
            // 1. Update Account
            const accountRef = doc(db, 'pointsAccounts', selectedAccount.id!);
            await updateDoc(accountRef, {
                availablePoints: newBalance,
                totalPoints: adjustType === 'add' ? (selectedAccount.totalPoints || 0) + amount : selectedAccount.totalPoints, // Total usually only goes up? Or tracks lifetime earnings? Let's assume lifetime earnings tracks adds.
                updatedAt: serverTimestamp()
            });

            // 2. Create Transaction Record
            await addDoc(collection(db, 'pointsTransactions'), {
                userId: selectedAccount.userId,
                type: adjustType === 'add' ? 'bonus' : 'spent', // 'spent' or 'penalty' ? using 'spent' for deduction for now
                amount: amount, // Transaction amount usually absolute? or signed? Type definition says amount: number. Let's keep it positive and use type to distinguish. 
                // Wait, if it's a deduction, balance goes down.
                description: `Admin Adjustment: ${adjustDescription}`,
                balanceBefore: selectedAccount.availablePoints,
                balanceAfter: newBalance,
                createdAt: serverTimestamp()
            });

            setIsAdjustDialogOpen(false);
            setAdjustAmount('');
            setAdjustDescription('');
        } catch (error) {
            console.error("Error adjusting points:", error);
            alert("Failed to adjust points");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filtered Accounts
    const filteredAccounts = accounts.filter(acc =>
        acc.restaurantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.userId.includes(searchTerm)
    );

    // Stats
    const totalCirculation = accounts.reduce((acc, curr) => acc + (curr.availablePoints || 0), 0);
    const totalSpentGlobal = accounts.reduce((acc, curr) => acc + (curr.spentPoints || 0), 0);

    // Date Helper
    const formatDate = (date: any) => {
        if (!date) return '-';
        if (date.toDate) return date.toDate().toLocaleString();
        if (date instanceof Date) return date.toLocaleString();
        return '-';
    };

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-100px)]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Points & Wallet Management</h1>
                    <p className="text-foreground font-medium">Monitor restaurant point balances and transactions.</p>
                </div>
                <div className="flex gap-2">
                    {/* Potential global actions */}
                </div>
            </div>

            {/* Enhanced Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
                <Card className="bg-gradient-to-br from-blue-900/20 to-black/40 border-blue-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(59,130,246,0.1)] group hover:shadow-[0_0_40px_rgba(59,130,246,0.2)] transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold text-blue-400 uppercase tracking-widest">Total In Circulation</CardTitle>
                        <Wallet className="h-5 w-5 text-blue-500 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground tracking-tight">{totalCirculation.toLocaleString()} <span className="text-sm text-muted-foreground font-normal">pts</span></div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-900/20 to-black/40 border-purple-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(168,85,247,0.1)] group hover:shadow-[0_0_40px_rgba(168,85,247,0.2)] transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold text-purple-400 uppercase tracking-widest">Total Spent (Lifetime)</CardTitle>
                        <TrendingUp className="h-5 w-5 text-purple-500 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground tracking-tight">{totalSpentGlobal.toLocaleString()} <span className="text-sm text-muted-foreground font-normal">pts</span></div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-900/20 to-black/40 border-green-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(34,197,94,0.1)] group hover:shadow-[0_0_40px_rgba(34,197,94,0.2)] transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold text-green-400 uppercase tracking-widest">Active Accounts</CardTitle>
                        <Store className="h-5 w-5 text-green-500 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground tracking-tight">{accounts.length}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-6 overflow-hidden">
                {/* Left: Accounts List */}
                <Card className="flex-1 flex flex-col bg-background/40 border-border/50 backdrop-blur-xl shadow-2xl overflow-hidden">
                    <div className="p-4 border-b border-border/50 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by Restaurant Name or ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-background/20 border-border/50 text-foreground placeholder:text-muted-foreground focus:bg-background/40 focus:border-blue-500/50 transition-all"
                            />
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        <Table>
                            <TableHeader className="bg-card/80 sticky top-0 z-10 text-xs uppercase tracking-wider">
                                <TableRow className="border-border/50 hover:bg-transparent">
                                    <TableHead className="text-foreground font-bold">Restaurant</TableHead>
                                    <TableHead className="text-foreground font-bold text-right">Available Pts</TableHead>
                                    <TableHead className="text-foreground font-bold text-right">Total Earned</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-32 text-center text-foreground">Loading accounts...</TableCell>
                                    </TableRow>
                                ) : filteredAccounts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-32 text-center text-foreground">No accounts found</TableCell>
                                    </TableRow>
                                ) : (
                                    filteredAccounts.map((account) => (
                                        <TableRow
                                            key={account.id}
                                            className={`border-border/50 cursor-pointer transition-colors ${selectedAccount?.id === account.id ? 'bg-blue-900/20 hover:bg-blue-900/30' : 'hover:bg-secondary/40'}`}
                                            onClick={() => setSelectedAccount(account)}
                                        >
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8 ring-1 ring-gray-700">
                                                        <AvatarImage src={account.restaurantImage} />
                                                        <AvatarFallback className="bg-secondary text-xs font-bold">{account.restaurantName?.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-foreground text-sm">{account.restaurantName}</span>
                                                        <span className="text-[10px] text-foreground font-mono truncate max-w-[120px]">{account.userId}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-bold hover:bg-blue-500/20">
                                                    {account.availablePoints?.toLocaleString()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground font-mono text-xs">
                                                {account.totalPoints?.toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                <Wallet className="h-4 w-4 text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </Card>

                {/* Right: Details & Transactions */}
                <div className="w-full md:w-[450px] flex flex-col gap-6 overflow-hidden">
                    {selectedAccount ? (
                        <>
                            {/* Account Summary Card */}
                            <Card className="bg-card border-border/50 shrink-0">
                                <CardHeader className="pb-4 border-b border-border/50 bg-card/50">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-12 w-12 ring-2 ring-blue-500/30">
                                                <AvatarImage src={selectedAccount.restaurantImage} />
                                                <AvatarFallback className="bg-blue-900 text-blue-300 font-bold text-lg">{selectedAccount.restaurantName?.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <CardTitle className="text-lg text-foreground">{selectedAccount.restaurantName}</CardTitle>
                                                <CardDescription className="text-xs text-muted-foreground font-mono">ID: {selectedAccount.userId}</CardDescription>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="outline" className="border-blue-500 text-blue-400 hover:bg-blue-950" onClick={() => setIsAdjustDialogOpen(true)}>
                                            <CreditCard className="mr-2 h-3 w-3" /> Adjust
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6 grid grid-cols-2 gap-4">
                                    <div className="bg-background p-4 rounded-xl border border-border/50 flex flex-col items-center justify-center">
                                        <span className="text-xs text-muted-foreground uppercase font-bold mb-1">Available Balance</span>
                                        <span className="text-2xl font-bold text-foreground">{selectedAccount.availablePoints?.toLocaleString()}</span>
                                    </div>
                                    <div className="bg-background p-4 rounded-xl border border-border/50 flex flex-col items-center justify-center">
                                        <span className="text-xs text-muted-foreground uppercase font-bold mb-1">Lifetime Spent</span>
                                        <span className="text-2xl font-bold text-muted-foreground">{selectedAccount.spentPoints?.toLocaleString()}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Transaction History */}
                            <Card className="flex-1 flex flex-col bg-card/40 border-border/50 overflow-hidden min-h-0">
                                <CardHeader className="py-3 px-4 border-b border-border/50 bg-card/50 sticky top-0 z-10">
                                    <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                        <Clock className="h-4 w-4" /> Recent Transactions
                                    </CardTitle>
                                </CardHeader>
                                <ScrollArea className="flex-1">
                                    <div className="p-0">
                                        {loadingTransactions ? (
                                            <div className="p-8 text-center text-xs text-muted-foreground">Loading history...</div>
                                        ) : transactions.length === 0 ? (
                                            <div className="p-8 text-center text-xs text-muted-foreground">No transactions found.</div>
                                        ) : (
                                            transactions.map((tx) => (
                                                <div key={tx.id} className="p-3 border-b border-border/50 hover:bg-secondary/30 transition-colors flex justify-between items-center group">
                                                    <div className="flex items-start gap-3">
                                                        <div className={`mt-1 p-1.5 rounded-full ${tx.type === 'purchase' ? 'bg-green-500/10 text-green-400' :
                                                            tx.type === 'bonus' ? 'bg-blue-500/10 text-blue-400' :
                                                                tx.type === 'spent' ? 'bg-orange-500/10 text-orange-400' :
                                                                    'bg-red-500/10 text-red-400'
                                                            }`}>
                                                            {tx.type === 'purchase' || tx.type === 'bonus' ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-foreground">{tx.description}</p>
                                                            <p className="text-[10px] text-muted-foreground flex items-center gap-2">
                                                                <span>{formatDate(tx.createdAt)}</span>
                                                                <span className="w-1 h-1 rounded-full bg-secondary"></span>
                                                                <span className="capitalize">{tx.type}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className={`text-sm font-bold ${tx.type === 'purchase' || tx.type === 'bonus' ? 'text-green-400' : 'text-muted-foreground'
                                                        }`}>
                                                        {tx.type === 'purchase' || tx.type === 'bonus' ? '+' : '-'}{tx.amount}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                            </Card>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-card/20 border border-border/50 rounded-xl border-dashed">
                            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-muted-foreground font-medium text-center">Select an Account</h3>
                            <p className="text-muted-foreground text-xs text-center max-w-[200px] mt-1">Click on a restaurant from the list to view their wallet details and history.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Adjust Points Dialog */}
            <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
                <DialogContent className="bg-card border-border/50 text-foreground sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Adjust Points Balance</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Manually add or deduct points for {selectedAccount?.restaurantName}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-muted-foreground">Type</Label>
                            <Select value={adjustType} onValueChange={(val: 'add' | 'deduct') => setAdjustType(val)}>
                                <SelectTrigger className="col-span-3 bg-background border-border/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border/50 text-foreground">
                                    <SelectItem value="add">Add Bonus Points</SelectItem>
                                    <SelectItem value="deduct">Deduct Penalty</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-muted-foreground">Amount</Label>
                            <Input
                                id="amount"
                                type="number"
                                placeholder="e.g. 500"
                                className="col-span-3 bg-background border-border/50 text-foreground"
                                value={adjustAmount}
                                onChange={(e) => setAdjustAmount(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-muted-foreground">Reason</Label>
                            <Input
                                id="reason"
                                placeholder="e.g. Goodwill bonus"
                                className="col-span-3 bg-background border-border/50 text-foreground"
                                value={adjustDescription}
                                onChange={(e) => setAdjustDescription(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAdjustDialogOpen(false)} className="border-border/50 text-muted-foreground hover:bg-secondary hover:text-foreground">Cancel</Button>
                        <Button onClick={handleAdjustPoints} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-500 text-foreground">
                            {isSubmitting ? 'Processing...' : 'Confirm Adjustment'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
