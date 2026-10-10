'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { CustomerWithdrawalRequest } from '@/lib/types';
import { approveWithdrawal, rejectWithdrawal } from '@/lib/wallet-actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { Search, Filter, CheckCircle, XCircle, Clock, Banknote, User, AlertCircle, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ProtectedRoute } from '@/components/admin/ProtectedRoute';

export default function CustomerWalletAdminPage() {
    const [requests, setRequests] = useState<CustomerWithdrawalRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [rejectId, setRejectId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [customerIdToReject, setCustomerIdToReject] = useState<string>('');

    useEffect(() => {
        const q = query(collection(db, 'customerWithdrawals'), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
                processedAt: doc.data().processedAt?.toDate(),
            })) as CustomerWithdrawalRequest[];
            setRequests(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleApprove = async (id: string, customerId: string) => {
        try {
            const result = await approveWithdrawal(id, customerId);
            if (result.success) {
                toast.success('Withdrawal approved successfully');
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error('Failed to approve request');
        }
    };

    const handleReject = async () => {
        if (!rejectId || !rejectReason) return;

        try {
            const result = await rejectWithdrawal(rejectId, customerIdToReject, rejectReason);
            if (result.success) {
                toast.success('Withdrawal rejected and refunded');
                setRejectId(null);
                setRejectReason('');
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error('Failed to reject request');
        }
    };

    const filteredRequests = requests.filter(req =>
        filterStatus === 'all' ? true : req.status === filterStatus
    );

    return (
        <ProtectedRoute allowedRoles={['super_admin', 'finance_admin', 'support_admin']}>
        <div className="space-y-8 p-6 md:p-8 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
                        Wallet Management
                    </h1>
                    <p className="text-muted-foreground mt-2 text-lg">Manage withdrawal requests and monitor transactions.</p>
                </div>
                <div className="flex flex-wrap gap-2 bg-card/50 p-1.5 rounded-xl border border-border/50 backdrop-blur-md">
                    {['all', 'pending', 'approved', 'rejected'].map((status) => (
                        <Button
                            key={status}
                            variant={filterStatus === status ? 'secondary' : 'ghost'}
                            onClick={() => setFilterStatus(status as any)}
                            className={`capitalize ${filterStatus === status
                                ? 'bg-card text-foreground hover:bg-gray-200 shadow-lg'
                                : 'text-muted-foreground hover:text-foreground hover:bg-card/5'
                                }`}
                        >
                            {status}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card className="bg-gradient-to-br from-yellow-900/20 to-black/40 border-yellow-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(234,179,8,0.1)] group hover:shadow-[0_0_40px_rgba(234,179,8,0.2)] transition-all duration-300">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-yellow-400 uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Pending Requests
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-foreground mb-1 tracking-tight">
                            {requests.filter(r => r.status === 'pending').length}
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">Awaiting Action</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-900/20 to-black/40 border-emerald-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(16,185,129,0.1)] group hover:shadow-[0_0_40px_rgba(16,185,129,0.2)] transition-all duration-300">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                            <ArrowUpRight className="w-4 h-4" />
                            Total Disbursed
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-foreground mb-1 tracking-tight">
                            ₹{requests.filter(r => r.status === 'approved').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">Successfully Transferred</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-900/20 to-black/40 border-blue-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(59,130,246,0.1)] group hover:shadow-[0_0_40px_rgba(59,130,246,0.2)] transition-all duration-300">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                            <Banknote className="w-4 h-4" />
                            Largest Withdrawal
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-foreground mb-1 tracking-tight">
                            ₹{Math.max(...requests.map(r => r.amount), 0).toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">Single Transaction</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Table Card */}
            <Card className="bg-background/40 border-border/50 backdrop-blur-xl shadow-2xl overflow-hidden">
                <CardHeader className="border-b border-border/50 bg-card/5 pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl text-foreground font-bold flex items-center gap-2">
                                <Banknote className="h-5 w-5 text-green-400" />
                                Withdrawal Requests
                            </CardTitle>
                            <CardDescription className="text-muted-foreground mt-1">Review and process customer fund withdrawals</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-foreground bg-blue-500/20 px-3 py-1.5 rounded-full border border-blue-500/20">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Showing {filteredRequests.length} requests
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="text-center py-20 text-muted-foreground animate-pulse">Loading transaction data...</div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground">
                            <div className="w-16 h-16 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Search className="w-8 h-8 opacity-20 text-foreground" />
                            </div>
                            <p className="text-lg font-medium text-muted-foreground">No requests found</p>
                            <p className="text-sm mt-1">Try adjusting the filters</p>
                        </div>
                    ) : (
                        <div className="rounded-md">
                            <Table>
                                <TableHeader className="bg-background/20 hover:bg-background/20">
                                    <TableRow className="border-border/50">
                                        <TableHead className="text-muted-foreground font-medium pl-6">Request ID</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Customer</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Amount</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Bank Details</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Date & Time</TableHead>
                                        <TableHead className="text-muted-foreground font-medium">Status</TableHead>
                                        <TableHead className="text-muted-foreground font-medium text-right pr-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRequests.map((req) => (
                                        <TableRow key={req.id} className="border-border/50 hover:bg-card/[0.02] transition-colors group">
                                            <TableCell className="font-mono text-xs text-muted-foreground pl-6">
                                                <span className="bg-secondary/50 px-2 py-1 rounded border border-border/50 group-hover:border-border/50 transition-colors">
                                                    #{req.id.slice(0, 8)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-foreground font-bold text-xs ring-2 ring-black">
                                                        {req.customerName.charAt(0)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-foreground">{req.customerName}</span>
                                                        <span className="text-xs text-muted-foreground">{req.customerEmail}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-bold text-lg text-foreground tabular-nums tracking-tight">
                                                    ₹{req.amount.toLocaleString()}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm text-muted-foreground space-y-0.5">
                                                    <p className="font-medium text-foreground/90">{req.bankDetails?.bankName}</p>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                                                        <span>{req.bankDetails?.accountNumber}</span>
                                                        <span className="w-1 h-1 bg-secondary rounded-full" />
                                                        <span>{req.bankDetails?.ifscCode}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                <div className="flex flex-col">
                                                    <span className="text-foreground text-sm">{format(req.createdAt, 'MMM d, yyyy')}</span>
                                                    <span className="text-xs text-muted-foreground">{format(req.createdAt, 'h:mm a')}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`
                                                    rounded-full px-3 py-0.5 font-medium border
                                                    ${req.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : ''}
                                                    ${req.status === 'approved' ? 'bg-green-500/10 text-green-500 border-green-500/20' : ''}
                                                    ${req.status === 'rejected' ? 'bg-red-500/10 text-red-500 border-red-500/20' : ''}
                                                `}>
                                                    {req.status === 'pending' && <Clock className="w-3 h-3 mr-1.5 animate-pulse" />}
                                                    {req.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1.5" />}
                                                    {req.status === 'rejected' && <XCircle className="w-3 h-3 mr-1.5" />}
                                                    {req.status?.toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                {req.status === 'pending' ? (
                                                    <div className="flex justify-end gap-2 opacity-100 transition-opacity">
                                                        <Button
                                                            size="sm"
                                                            className="bg-green-600 hover:bg-green-500 text-foreground shadow-lg shadow-green-900/20 border border-green-400/20"
                                                            onClick={() => handleApprove(req.id, req.customerId)}
                                                        >
                                                            <CheckCircle className="w-4 h-4 mr-1" /> Approve
                                                        </Button>

                                                        <Dialog open={rejectId === req.id} onOpenChange={(open) => {
                                                            if (!open) setRejectId(null);
                                                            else {
                                                                setRejectId(req.id);
                                                                setCustomerIdToReject(req.customerId);
                                                            }
                                                        }}>
                                                            <DialogTrigger asChild>
                                                                <Button size="sm" variant="outline" className="border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/50">
                                                                    Reject
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="bg-[#0a0a0a] border-border/50 text-foreground">
                                                                <DialogHeader>
                                                                    <DialogTitle>Reject Withdrawal Request</DialogTitle>
                                                                    <DialogDescription className="text-muted-foreground">
                                                                        Provide a reason for rejecting this request. The funds will be refunded to the customer's wallet.
                                                                    </DialogDescription>
                                                                </DialogHeader>
                                                                <div className="py-4">
                                                                    <Input
                                                                        placeholder="Rejection reason (e.g. Invalid bank details)"
                                                                        value={rejectReason}
                                                                        onChange={(e) => setRejectReason(e.target.value)}
                                                                        className="bg-card border-border/50 text-foreground focus:border-red-500/50 transition-colors"
                                                                    />
                                                                </div>
                                                                <DialogFooter>
                                                                    <Button variant="ghost" onClick={() => setRejectId(null)} className="hover:text-foreground">Cancel</Button>
                                                                    <Button variant="destructive" onClick={handleReject} className="bg-red-600 hover:bg-red-500">
                                                                        Confirm Rejection
                                                                    </Button>
                                                                </DialogFooter>
                                                            </DialogContent>
                                                        </Dialog>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground font-mono">
                                                        {format(req.processedAt || new Date(), 'dd/MM/yy HH:mm')}
                                                    </span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
        </ProtectedRoute>
    );
}
