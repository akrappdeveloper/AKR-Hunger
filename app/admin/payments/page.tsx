'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader } from '@/components/ui/spinner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Search,
    Wallet,
    CheckCircle,
    Clock,
    XCircle,
    Landmark,
    Check,
    Store,
    Download,
    RefreshCw,
    TrendingUp,
    AlertCircle,
    FileText,
    Eye,
    X
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { toast } from 'sonner';

export default function AdminPaymentsPage() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('pending');

    // Dialog State
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isRejectOpen, setIsRejectOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [customReason, setCustomReason] = useState('');

    const REJECT_REASONS = [
        "Incorrect Bank Details provided",
        "Suspected fraudulent activity",
        "Account verification pending",
        "Duplicate withdrawal request",
        "Other (Specify below)"
    ];

    useEffect(() => {
        const q = query(
            collection(db, 'withdrawalRequests'),
            orderBy('requestedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRequests(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleProcessPayment = async () => {
        if (!selectedRequest) return;
        setProcessing(true);
        try {
            await updateDoc(doc(db, 'withdrawalRequests', selectedRequest.id), {
                status: 'completed',
                processedAt: new Date()
            });
            toast.success("Payment marked as completed successfully");
            setIsDetailsOpen(false);
        } catch (error) {
            console.error("Error updating payment:", error);
            toast.error("Failed to update payment status");
        } finally {
            setProcessing(false);
        }
    };

    const handleRejectPayment = async () => {
        if (!selectedRequest) return;
        setProcessing(true);

        const finalReason = rejectReason === "Other (Specify below)" ? customReason : rejectReason;

        if (!finalReason) {
            toast.error("Please provide a reason for rejection");
            setProcessing(false);
            return;
        }

        try {
            // 1. Update Withdrawal Request Status
            await updateDoc(doc(db, 'withdrawalRequests', selectedRequest.id), {
                status: 'rejected',
                rejectionReason: finalReason,
                rejectedAt: new Date()
            });

            // 2. Send Notification to Restaurant
            await addDoc(collection(db, 'notifications'), {
                userId: selectedRequest.restaurantId,
                userType: 'restaurant',
                title: "Withdrawal Request Rejected",
                message: `Your withdrawal request for ₹${selectedRequest.amount} has been rejected. Reason: ${finalReason}. The amount has been refunded to your wallet.`,
                type: "alert",
                isRead: false,
                createdAt: new Date().toISOString()
            });

            toast.success("Payment rejected and restaurant notified");
            setIsRejectOpen(false);
            setIsDetailsOpen(false);
            setRejectReason('');
            setCustomReason('');
        } catch (error) {
            console.error("Error rejecting payment:", error);
            toast.error("Failed to reject payment");
        } finally {
            setProcessing(false);
        }
    };

    const filteredRequests = requests.filter(req => {
        const matchesSearch = req.restaurantName?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });

    const pendingRequests = filteredRequests.filter(req => req.status === 'pending');
    const completedRequests = filteredRequests.filter(req => req.status === 'completed');
    const rejectedRequests = filteredRequests.filter(req => req.status === 'rejected');

    // Stats
    const totalPending = requests.filter(r => r.status === 'pending').reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalPaid = requests.filter(r => r.status === 'completed').reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalRejected = requests.filter(r => r.status === 'rejected').reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalRequestsCount = requests.length;

    const exportPayments = () => {
        const csvContent = "data:text/csv;charset=utf-8,"
            + "ID,Restaurant,Amount,Status,Requested Date\n"
            + requests.map(r =>
                `${r.id},${r.restaurantName},${r.amount},${r.status},${r.requestedAt?.toDate().toLocaleString()}`
            ).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `restaurant_payments_${new Date().toISOString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const RequestCard = ({ req }: { req: any }) => (
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 hover:border-gray-600 transition-all duration-300 shadow-lg hover:shadow-xl group">
            <CardContent className="p-5">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                        <div className={`p-3 rounded-xl transition-all duration-300 ${req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                            req.status === 'completed' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                                'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}>
                            <Store className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8 border-2 border-gray-700">
                                        <AvatarFallback className="bg-gray-800 text-white text-xs font-bold">
                                            {req.restaurantName?.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <h3 className="text-lg font-bold text-white">{req.restaurantName}</h3>
                                </div>
                                <Badge variant="outline" className={`capitalize font-bold ${req.status === 'pending' ? 'border-yellow-500/50 text-yellow-300 bg-yellow-500/10' :
                                    req.status === 'completed' ? 'border-green-500/50 text-green-300 bg-green-500/10' :
                                        'border-red-500/50 text-red-300 bg-red-500/10'
                                    }`}>
                                    {req.status}
                                </Badge>
                            </div>
                            <p className="text-sm text-gray-300 mb-3 flex items-center gap-2 font-medium">
                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                {req.requestedAt?.toDate().toLocaleString()}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 min-w-[160px] justify-between">
                        <div className="text-right">
                            <p className="text-xs text-gray-400 font-medium mb-1">Amount</p>
                            <span className="text-3xl font-bold text-green-300">₹{req.amount?.toFixed(2)}</span>
                        </div>

                        <Button
                            size="sm"
                            variant={req.status === 'pending' ? 'default' : 'ghost'}
                            className={`${req.status === 'pending'
                                ? 'bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg'
                                : 'text-gray-300 hover:text-white hover:bg-gray-800 font-medium'
                                }`}
                            onClick={() => {
                                setSelectedRequest(req);
                                setIsDetailsOpen(true);
                            }}
                        >
                            <Eye className="w-4 h-4 mr-1" /> View Details
                        </Button>

                        {req.status !== 'pending' && (
                            <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                                {req.status === 'completed' ? (
                                    <>
                                        <Check className="w-3 h-3 text-green-400" />
                                        Approved
                                    </>
                                ) : (
                                    <>
                                        <X className="w-3 h-3 text-red-400" />
                                        Declined
                                    </>
                                )}
                            </span>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    if (loading) return (
        <div className="flex justify-center items-center h-screen bg-gray-950 text-white">
            <div className="flex flex-col items-center gap-3">
                <Loader />
                <p className="text-gray-300 font-medium">Loading payments...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2 flex items-center gap-2">
                        <Wallet className="w-8 h-8 text-green-500" />
                        Restaurant Payments
                    </h1>
                    <p className="text-gray-200 font-medium">Manage withdrawal requests from restaurants.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={exportPayments} variant="outline" className="border-gray-600 bg-gray-800/50 text-white hover:bg-gray-700 hover:text-white hover:border-gray-500 font-semibold">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                    <Button onClick={() => window.location.reload()} variant="outline" className="border-gray-600 bg-gray-800/50 text-white hover:bg-gray-700 hover:text-white hover:border-gray-500 font-semibold">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Enhanced Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-gradient-to-br from-yellow-900/30 to-gray-900 border-yellow-500/30 text-white shadow-lg hover:shadow-yellow-500/20 transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-gray-100 uppercase tracking-widest">Pending</CardTitle>
                        <Clock className="h-5 w-5 text-yellow-300" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-yellow-300 mb-1">₹{totalPending.toFixed(2)}</div>
                        <p className="text-xs text-gray-200 font-medium flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {requests.filter(r => r.status === 'pending').length} pending
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-900/30 to-gray-900 border-green-500/30 text-white shadow-lg hover:shadow-green-500/20 transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-gray-100 uppercase tracking-widest">Accepted</CardTitle>
                        <CheckCircle className="h-5 w-5 text-green-300" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-green-300 mb-1">₹{totalPaid.toFixed(2)}</div>
                        <p className="text-xs text-gray-200 font-medium flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {requests.filter(r => r.status === 'completed').length} approved
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-900/30 to-gray-900 border-red-500/30 text-white shadow-lg hover:shadow-red-500/20 transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-gray-100 uppercase tracking-widest">Rejected</CardTitle>
                        <XCircle className="h-5 w-5 text-red-300" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-red-300 mb-1">₹{totalRejected.toFixed(2)}</div>
                        <p className="text-xs text-gray-200 font-medium">{requests.filter(r => r.status === 'rejected').length} declined</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-900/30 to-gray-900 border-blue-500/30 text-white shadow-lg hover:shadow-blue-500/20 transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-gray-100 uppercase tracking-widest">Total Requests</CardTitle>
                        <FileText className="h-5 w-5 text-blue-300" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-blue-300 mb-1">{totalRequestsCount}</div>
                        <p className="text-xs text-gray-200 font-medium">All time</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <Card className="bg-gray-900/70 border-gray-800 backdrop-blur-sm shadow-2xl">
                    <CardHeader className="pb-3 border-b border-gray-800">
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                            <div className="w-full md:w-auto">
                                <TabsList className="bg-gray-950 border border-gray-800 h-10 p-1">
                                    <TabsTrigger value="pending" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-white text-gray-200 font-medium">
                                        Pending
                                        <Badge className="ml-2 bg-yellow-500/20 text-yellow-300 border-0">{pendingRequests.length}</Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="completed" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-gray-200 font-medium">
                                        Accepted
                                        <Badge className="ml-2 bg-green-500/20 text-green-300 border-0">{completedRequests.length}</Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="rejected" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-gray-200 font-medium">
                                        Rejected
                                        <Badge className="ml-2 bg-red-500/20 text-red-300 border-0">{rejectedRequests.length}</Badge>
                                    </TabsTrigger>
                                </TabsList>
                            </div>
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search restaurant..."
                                    className="bg-gray-950 border-gray-700 text-white pl-10 placeholder:text-gray-500 focus-visible:ring-blue-500 focus-visible:border-blue-500 h-10"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[600px] p-6">
                            <TabsContent value="pending" className="mt-0 space-y-4">
                                {pendingRequests.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400">
                                        <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                        <p className="font-medium">No pending requests found.</p>
                                    </div>
                                ) : (
                                    pendingRequests.map(req => <RequestCard key={req.id} req={req} />)
                                )}
                            </TabsContent>

                            <TabsContent value="completed" className="mt-0 space-y-4">
                                {completedRequests.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400">
                                        <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                        <p className="font-medium">No approved requests found.</p>
                                    </div>
                                ) : (
                                    completedRequests.map(req => <RequestCard key={req.id} req={req} />)
                                )}
                            </TabsContent>

                            <TabsContent value="rejected" className="mt-0 space-y-4">
                                {rejectedRequests.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400">
                                        <XCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                        <p className="font-medium">No rejected requests found.</p>
                                    </div>
                                ) : (
                                    rejectedRequests.map(req => <RequestCard key={req.id} req={req} />)
                                )}
                            </TabsContent>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </Tabs>

            {/* Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle>Payment Details</DialogTitle>
                        <DialogDescription>Review bank details and process payment</DialogDescription>
                    </DialogHeader>

                    {selectedRequest && (
                        <div className="space-y-6 py-4">
                            <div className="p-4 bg-gray-800/50 rounded-lg space-y-3 border border-gray-700">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Amount Request</span>
                                    <span className="text-xl font-bold text-white">₹{selectedRequest.amount?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Status</span>
                                    <span className={`capitalize font-bold 
                                        ${selectedRequest.status === 'completed' ? 'text-green-400' : ''}
                                        ${selectedRequest.status === 'pending' ? 'text-orange-400' : ''}
                                        ${selectedRequest.status === 'rejected' ? 'text-red-400' : ''}
                                    `}>
                                        {selectedRequest.status}
                                    </span>
                                </div>
                                {selectedRequest.status === 'rejected' && (
                                    <div className="pt-2 border-t border-gray-700 mt-2">
                                        <p className="text-xs text-red-400 font-semibold uppercase">Rejection Reason</p>
                                        <p className="text-gray-300 text-sm mt-1">{selectedRequest.rejectionReason}</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <h4 className="font-semibold text-gray-300 flex items-center gap-2">
                                    <Landmark className="w-4 h-4" /> Bank Account Details
                                </h4>
                                <div className="p-4 bg-gray-800/50 rounded-lg space-y-3 border border-gray-700">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Account Holder</p>
                                        <p className="font-medium text-white">{selectedRequest.bankDetails?.accountHolderName}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Bank Name</p>
                                        <p className="font-medium text-white">{selectedRequest.bankDetails?.bankName}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Account Number</p>
                                        <p className="font-medium text-white font-mono tracking-wider">{selectedRequest.bankDetails?.accountNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">IFSC Code</p>
                                        <p className="font-medium text-white font-mono">{selectedRequest.bankDetails?.ifscCode}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            {selectedRequest.status === 'pending' ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <Button
                                        className="bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-900/50 font-bold h-12"
                                        onClick={() => setIsRejectOpen(true)}
                                        disabled={processing}
                                    >
                                        <XCircle className="w-5 h-5 mr-2" />
                                        Reject
                                    </Button>
                                    <Button
                                        className="bg-green-600 hover:bg-green-700 text-white font-bold h-12"
                                        onClick={handleProcessPayment}
                                        disabled={processing}
                                    >
                                        {processing ? "Processing..." : (
                                            <>
                                                <CheckCircle className="w-5 h-5 mr-2" />
                                                Mark as Paid
                                            </>
                                        )}
                                    </Button>
                                </div>
                            ) : (
                                <div className={`flex items-center justify-center gap-2 p-3 rounded-lg border font-bold ${selectedRequest.status === 'completed'
                                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                    }`}>
                                    {selectedRequest.status === 'completed' ? <Check className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                    Payment {selectedRequest.status}
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Reject Reason Dialog */}
            <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
                <DialogContent className="bg-gray-900 border-gray-800 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-red-400 flex items-center gap-2">
                            <XCircle className="w-5 h-5" />
                            Reject Withdrawal Request
                        </DialogTitle>
                        <DialogDescription>
                            Please select a reason for rejection. The amount will be refunded to the restaurant's wallet.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid gap-2">
                            {REJECT_REASONS.map(reason => (
                                <div
                                    key={reason}
                                    onClick={() => setRejectReason(reason)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all ${rejectReason === reason
                                        ? 'bg-red-900/30 border-red-500 text-white'
                                        : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800'
                                        }`}
                                >
                                    {reason}
                                </div>
                            ))}
                        </div>

                        {rejectReason === "Other (Specify below)" && (
                            <Input
                                placeholder="Type specific reason..."
                                value={customReason}
                                onChange={(e) => setCustomReason(e.target.value)}
                                className="bg-gray-800 border-gray-700 text-white"
                            />
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsRejectOpen(false)} className="text-gray-400">Cancel</Button>
                        <Button
                            onClick={handleRejectPayment}
                            className="bg-red-600 hover:bg-red-700 font-bold"
                            disabled={!rejectReason || processing}
                        >
                            {processing ? "Rejecting..." : "Confirm Rejection"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
