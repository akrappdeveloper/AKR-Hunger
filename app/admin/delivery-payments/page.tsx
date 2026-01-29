'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/spinner';
import {
    DollarSign,
    CheckCircle,
    XCircle,
    Clock,
    Search,
    Building,
    User,
    FileText,
    Download,
    RefreshCw,
    TrendingUp,
    AlertCircle,
    Eye,
    CreditCard,
    Calendar,
    Filter,
    MoreHorizontal,
    Check,
    X,
    ChevronRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface PayoutRequest {
    id: string;
    userId: string;
    userName: string;
    amount: number;
    status: 'pending' | 'accepted' | 'rejected';
    bankDetails: {
        bankName: string;
        holderName: string;
        accountNumber: string;
        ifscCode: string;
    };
    createdAt: any;
    processedAt?: any;
    email?: string;
}

export default function DeliveryPaymentsPage() {
    const [requests, setRequests] = useState<PayoutRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRequest, setSelectedRequest] = useState<PayoutRequest | null>(null);
    const [activeTab, setActiveTab] = useState('pending');

    useEffect(() => {
        const q = query(
            collection(db, 'payout_requests'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as PayoutRequest[];
            setRequests(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching requests:", error);
            toast.error("Failed to fetch payout requests");
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleStatusUpdate = async (id: string, newStatus: 'accepted' | 'rejected') => {
        try {
            await updateDoc(doc(db, 'payout_requests', id), {
                status: newStatus,
                processedAt: serverTimestamp()
            });
            toast.success(`Request ${newStatus === 'accepted' ? 'approved' : 'rejected'} successfully`);
            if (selectedRequest?.id === id) {
                setSelectedRequest(null);
            }
        } catch (error) {
            console.error("Error updating status:", error);
            toast.error("Failed to update status");
        }
    };

    const filteredRequests = requests.filter(req =>
        req.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const pendingRequests = filteredRequests.filter(req => req.status === 'pending');
    const acceptedRequests = filteredRequests.filter(req => req.status === 'accepted');
    const rejectedRequests = filteredRequests.filter(req => req.status === 'rejected');

    // Stats
    const totalPending = pendingRequests.reduce((sum, req) => sum + Number(req.amount || 0), 0);
    const totalAccepted = acceptedRequests.reduce((sum, req) => sum + Number(req.amount || 0), 0);
    const totalRejected = rejectedRequests.reduce((sum, req) => sum + Number(req.amount || 0), 0);
    const totalRequests = requests.length;

    const formatDate = (date: any) => {
        if (!date) return 'N/A';
        if (date?.toDate) return date.toDate().toLocaleDateString() + ' ' + date.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return 'N/A';
    };

    const exportPayments = () => {
        const csvContent = "data:text/csv;charset=utf-8,"
            + "ID,User,Amount,Status,Bank,Account,IFSC,Created Date\n"
            + requests.map(r =>
                `${r.id},${r.userName},${r.amount},${r.status},${r.bankDetails?.bankName},${r.bankDetails?.accountNumber},${r.bankDetails?.ifscCode},${formatDate(r.createdAt)}`
            ).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `delivery_payments_${new Date().toISOString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const RequestCard = ({ req }: { req: PayoutRequest }) => (
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 hover:border-gray-600 transition-all duration-300 shadow-lg hover:shadow-xl group">
            <CardContent className="p-5">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                        <div className={`p-3 rounded-xl transition-all duration-300 ${req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                                req.status === 'accepted' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                                    'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}>
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8 border-2 border-gray-700">
                                        <AvatarFallback className="bg-gray-800 text-white text-xs font-bold">
                                            {req.userName?.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <h3 className="text-lg font-bold text-white">{req.userName}</h3>
                                </div>
                                <Badge variant="outline" className={`capitalize font-bold ${req.status === 'pending' ? 'border-yellow-500/50 text-yellow-300 bg-yellow-500/10' :
                                        req.status === 'accepted' ? 'border-green-500/50 text-green-300 bg-green-500/10' :
                                            'border-red-500/50 text-red-300 bg-red-500/10'
                                    }`}>
                                    {req.status}
                                </Badge>
                            </div>
                            <p className="text-sm text-gray-300 mb-3 flex items-center gap-2 font-medium">
                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                {formatDate(req.createdAt)}
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div className="flex items-center gap-2 bg-gray-950/30 p-2 rounded-lg border border-gray-800/50">
                                    <Building className="w-4 h-4 text-blue-400" />
                                    <div className="flex flex-col">
                                        <span className="text-gray-400 text-xs">Bank</span>
                                        <span className="font-semibold text-gray-100">{req.bankDetails?.bankName}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-gray-950/30 p-2 rounded-lg border border-gray-800/50">
                                    <User className="w-4 h-4 text-blue-400" />
                                    <div className="flex flex-col">
                                        <span className="text-gray-400 text-xs">Account Holder</span>
                                        <span className="font-semibold text-gray-100">{req.bankDetails?.holderName}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-gray-950/30 p-2 rounded-lg border border-gray-800/50">
                                    <CreditCard className="w-4 h-4 text-blue-400" />
                                    <div className="flex flex-col">
                                        <span className="text-gray-400 text-xs">Account Number</span>
                                        <span className="font-semibold text-gray-100 font-mono">{req.bankDetails?.accountNumber}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-gray-950/30 p-2 rounded-lg border border-gray-800/50">
                                    <FileText className="w-4 h-4 text-blue-400" />
                                    <div className="flex flex-col">
                                        <span className="text-gray-400 text-xs">IFSC Code</span>
                                        <span className="font-semibold text-gray-100 font-mono">{req.bankDetails?.ifscCode}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 min-w-[160px] justify-between">
                        <div className="text-right">
                            <p className="text-xs text-gray-400 font-medium mb-1">Amount</p>
                            <span className="text-3xl font-bold text-green-300">₹{parseFloat(req.amount as any).toFixed(2)}</span>
                        </div>
                        <div className="flex gap-2 w-full">
                            {req.status === 'pending' ? (
                                <>
                                    <Button
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-500 flex-1 font-bold text-white shadow-lg"
                                        onClick={() => handleStatusUpdate(req.id, 'accepted')}
                                    >
                                        <CheckCircle className="w-4 h-4 mr-1" /> Accept
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="flex-1 font-bold shadow-lg"
                                        onClick={() => handleStatusUpdate(req.id, 'rejected')}
                                    >
                                        <XCircle className="w-4 h-4 mr-1" /> Reject
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="flex-1 text-gray-300 hover:text-white hover:bg-gray-800 font-medium"
                                        onClick={() => setSelectedRequest(req)}
                                    >
                                        <Eye className="w-4 h-4 mr-1" /> View
                                    </Button>
                                </>
                            )}
                        </div>
                        {req.status !== 'pending' && (
                            <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                                {req.status === 'accepted' ? (
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
                <p className="text-gray-300 font-medium">Loading payment requests...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Delivery Payments</h1>
                    <p className="text-gray-200 font-medium">Manage withdrawal requests from delivery partners.</p>
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
                            {pendingRequests.length} request{pendingRequests.length !== 1 ? 's' : ''}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-900/30 to-gray-900 border-green-500/30 text-white shadow-lg hover:shadow-green-500/20 transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-gray-100 uppercase tracking-widest">Accepted</CardTitle>
                        <CheckCircle className="h-5 w-5 text-green-300" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-green-300 mb-1">₹{totalAccepted.toFixed(2)}</div>
                        <p className="text-xs text-gray-200 font-medium flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {acceptedRequests.length} approved
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
                        <p className="text-xs text-gray-200 font-medium">{rejectedRequests.length} declined</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-900/30 to-gray-900 border-blue-500/30 text-white shadow-lg hover:shadow-blue-500/20 transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-gray-100 uppercase tracking-widest">Total Requests</CardTitle>
                        <FileText className="h-5 w-5 text-blue-300" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-blue-300 mb-1">{totalRequests}</div>
                        <p className="text-xs text-gray-200 font-medium">All time</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-gray-900/70 border-gray-800 backdrop-blur-sm shadow-2xl">
                <CardHeader className="pb-3 border-b border-gray-800">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                            <TabsList className="bg-gray-950 border border-gray-800 h-10 p-1">
                                <TabsTrigger value="pending" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-white text-gray-200 font-medium">
                                    Pending
                                    <Badge className="ml-2 bg-yellow-500/20 text-yellow-300 border-0">{pendingRequests.length}</Badge>
                                </TabsTrigger>
                                <TabsTrigger value="accepted" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-gray-200 font-medium">
                                    Accepted
                                    <Badge className="ml-2 bg-green-500/20 text-green-300 border-0">{acceptedRequests.length}</Badge>
                                </TabsTrigger>
                                <TabsTrigger value="rejected" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-gray-200 font-medium">
                                    Rejected
                                    <Badge className="ml-2 bg-red-500/20 text-red-300 border-0">{rejectedRequests.length}</Badge>
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search requests..."
                                className="bg-gray-950 border-gray-700 text-white pl-10 placeholder:text-gray-500 focus-visible:ring-blue-500 focus-visible:border-blue-500 h-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
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

                        <TabsContent value="accepted" className="mt-0 space-y-4">
                            {acceptedRequests.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                    <p className="font-medium">No accepted requests found.</p>
                                </div>
                            ) : (
                                acceptedRequests.map(req => <RequestCard key={req.id} req={req} />)
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

            {/* Request Details Dialog */}
            <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
                <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
                            Payment Request Details
                            <Badge variant="outline" className={`capitalize ${selectedRequest?.status === 'pending' ? 'border-yellow-500 text-yellow-300' :
                                    selectedRequest?.status === 'accepted' ? 'border-green-500 text-green-300' :
                                        'border-red-500 text-red-300'
                                }`}>
                                {selectedRequest?.status}
                            </Badge>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-xs text-gray-400 font-medium uppercase">User Name</p>
                                <p className="text-white font-bold text-lg">{selectedRequest?.userName}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-gray-400 font-medium uppercase">Amount</p>
                                <p className="text-green-300 font-bold text-2xl">₹{parseFloat(selectedRequest?.amount as any).toFixed(2)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-gray-400 font-medium uppercase">Created At</p>
                                <p className="text-gray-200 font-medium">{formatDate(selectedRequest?.createdAt)}</p>
                            </div>
                            {selectedRequest?.processedAt && (
                                <div className="space-y-1">
                                    <p className="text-xs text-gray-400 font-medium uppercase">Processed At</p>
                                    <p className="text-gray-200 font-medium">{formatDate(selectedRequest?.processedAt)}</p>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-gray-800 pt-4">
                            <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Bank Details</h4>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="bg-gray-950/50 p-3 rounded-lg border border-gray-800">
                                    <p className="text-xs text-gray-400 font-medium mb-1">Bank Name</p>
                                    <p className="text-white font-semibold">{selectedRequest?.bankDetails?.bankName}</p>
                                </div>
                                <div className="bg-gray-950/50 p-3 rounded-lg border border-gray-800">
                                    <p className="text-xs text-gray-400 font-medium mb-1">Account Holder</p>
                                    <p className="text-white font-semibold">{selectedRequest?.bankDetails?.holderName}</p>
                                </div>
                                <div className="bg-gray-950/50 p-3 rounded-lg border border-gray-800">
                                    <p className="text-xs text-gray-400 font-medium mb-1">Account Number</p>
                                    <p className="text-white font-semibold font-mono">{selectedRequest?.bankDetails?.accountNumber}</p>
                                </div>
                                <div className="bg-gray-950/50 p-3 rounded-lg border border-gray-800">
                                    <p className="text-xs text-gray-400 font-medium mb-1">IFSC Code</p>
                                    <p className="text-white font-semibold font-mono">{selectedRequest?.bankDetails?.ifscCode}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
