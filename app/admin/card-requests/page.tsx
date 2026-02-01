'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, where, doc, getDoc } from 'firebase/firestore';
import { MembershipRequest, Customer } from '@/lib/types';
import { approveMembership, rejectMembership } from '@/lib/membership-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, CreditCard, User, Phone, Mail, MapPin, Calendar, Search, AlertCircle, ChevronRight, Filter, Wallet, Clock, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export default function CardRequestsPage() {
    const [requests, setRequests] = useState<MembershipRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<MembershipRequest | null>(null);
    const [customerDetails, setCustomerDetails] = useState<Customer | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isRejectOpen, setIsRejectOpen] = useState(false);

    // Filters
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch All Requests
    useEffect(() => {
        // Removed the 'where' clause to fetch history as well
        const q = query(
            collection(db, 'membershipRequests'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const reqs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
                // Safety check for other timestamps
                approvedAt: doc.data().approvedAt?.toDate(),
                rejectedAt: doc.data().rejectedAt?.toDate(),
            })) as MembershipRequest[];
            setRequests(reqs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleViewDetails = async (request: MembershipRequest) => {
        setSelectedRequest(request);
        setLoadingDetails(true);
        setIsDetailsOpen(true);

        try {
            const customerRef = doc(db, 'customers', request.customerId);
            const customerSnap = await getDoc(customerRef);
            if (customerSnap.exists()) {
                setCustomerDetails(customerSnap.data() as Customer);
            }
        } catch (error) {
            console.error("Error fetching customer details:", error);
            toast.error("Failed to load customer details");
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleApprove = async () => {
        if (!selectedRequest) return;

        setActionLoading(true);
        try {
            const result = await approveMembership(selectedRequest.id);
            if (result.success) {
                toast.success(`Membership approved for ${selectedRequest.customerName}`);
                setIsDetailsOpen(false);
                setSelectedRequest(null);
            } else {
                toast.error(result.error || "Failed to approve");
            }
        } catch (error) {
            toast.error("Error approving request");
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!selectedRequest) return;
        if (!rejectionReason) {
            toast.error("Please provide a reason");
            return;
        }

        setActionLoading(true);
        try {
            const result = await rejectMembership(selectedRequest.id, rejectionReason);
            if (result.success) {
                toast.success("Request rejected");
                setIsRejectOpen(false);
                setIsDetailsOpen(false);
                setSelectedRequest(null);
                setRejectionReason('');
            } else {
                toast.error(result.error || "Failed to reject");
            }
        } catch (error) {
            toast.error("Error rejecting request");
        } finally {
            setActionLoading(false);
        }
    };

    // Derived State
    const filteredRequests = requests.filter(req => {
        const matchesStatus = filterStatus === 'all' ? true : req.status === filterStatus;
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch =
            req.customerName.toLowerCase().includes(searchLower) ||
            req.customerEmail.toLowerCase().includes(searchLower) ||
            req.contactNumber.includes(searchQuery);

        return matchesStatus && matchesSearch;
    });

    const pendingCount = requests.filter(r => r.status === 'pending').length;
    const approvedCount = requests.filter(r => r.status === 'approved').length;
    const rejectedCount = requests.filter(r => r.status === 'rejected').length;

    return (
        <div className="space-y-8 p-6 md:p-8 max-w-[1600px] mx-auto">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
                        Card Management
                    </h1>
                    <p className="text-gray-400 mt-2 text-lg">Process new memberships and view history.</p>
                </div>
            </div>

            {/* Statistics Dashboard */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gray-900/40 border-white/10 backdrop-blur-md relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-2 relative z-10">
                        <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-blue-500" />
                            Total Requests
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-3xl font-bold text-white mb-1">{requests.length}</div>
                        <p className="text-xs text-blue-400 font-medium">Lifetime Applications</p>
                    </CardContent>
                </Card>

                <Card className="bg-gray-900/40 border-white/10 backdrop-blur-md relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-2 relative z-10">
                        <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-yellow-500" />
                            Pending
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-3xl font-bold text-white mb-1">{pendingCount}</div>
                        <p className="text-xs text-yellow-500 font-medium">Requires Attention</p>
                    </CardContent>
                </Card>

                <Card className="bg-gray-900/40 border-white/10 backdrop-blur-md relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-2 relative z-10">
                        <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            Cards Issued
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-3xl font-bold text-white mb-1">{approvedCount}</div>
                        <p className="text-xs text-green-500 font-medium">Total Active Members</p>
                    </CardContent>
                </Card>

                <Card className="bg-gray-900/40 border-white/10 backdrop-blur-md relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-2 relative z-10">
                        <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                            <XCircle className="w-4 h-4 text-red-500" />
                            Rejected
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-3xl font-bold text-white mb-1">{rejectedCount}</div>
                        <p className="text-xs text-red-400 font-medium">Applications Denied</p>
                    </CardContent>
                </Card>
            </div>

            {/* Controls Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-900/40 p-1 rounded-xl border border-white/5 backdrop-blur-sm">
                <div className="flex p-1 gap-1 w-full md:w-auto bg-black/20 rounded-lg overflow-x-auto">
                    {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`
                                px-4 py-2 rounded-md text-sm font-medium transition-all capitalize whitespace-nowrap
                                ${filterStatus === status
                                    ? 'bg-gray-700 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'}
                            `}
                        >
                            {status}
                        </button>
                    ))}
                </div>

                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                        placeholder="Search by name, email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-black/20 border-white/10 text-white placeholder:text-gray-600 focus:bg-black/40 transition-all"
                    />
                </div>
            </div>

            {/* Content List */}
            <div className="grid gap-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 space-y-4">
                        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
                        <p className="text-gray-400 animate-pulse">Loading data...</p>
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <Card className="bg-gray-900/40 border-white/10 p-16 text-center backdrop-blur-md">
                        <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
                            <Search className="w-10 h-10 text-gray-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No Requests Found</h3>
                        <p className="text-gray-400">Try adjusting your filters or search query.</p>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {filteredRequests.map((request) => (
                            <Card key={request.id} className={`
                                bg-gray-900/60 border-white/10 transition-all duration-300 group overflow-hidden
                                ${request.status === 'pending' ? 'hover:border-orange-500/30 ring-1 ring-orange-500/10' : 'hover:border-white/20'}
                            `}>
                                <CardContent className="p-5 flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="flex items-center gap-5 w-full md:w-auto">
                                        <div className={`
                                            w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-105 border
                                            ${request.status === 'pending' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' :
                                                request.status === 'approved' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                                                    'bg-red-500/10 border-red-500/20 text-red-500'}
                                        `}>
                                            <User className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="font-bold text-white text-lg">{request.customerName}</h3>
                                                {request.status === 'pending' && (
                                                    <Badge variant="outline" className="text-orange-400 border-orange-500/20 bg-orange-500/10 text-[10px] px-2 py-0.5 uppercase tracking-widest">
                                                        Waitlist
                                                    </Badge>
                                                )}
                                                {request.status === 'approved' && (
                                                    <Badge variant="outline" className="text-green-400 border-green-500/20 bg-green-500/10 text-[10px] px-2 py-0.5 uppercase tracking-widest">
                                                        Member
                                                    </Badge>
                                                )}
                                                {request.status === 'rejected' && (
                                                    <Badge variant="outline" className="text-red-400 border-red-500/20 bg-red-500/10 text-[10px] px-2 py-0.5 uppercase tracking-widest">
                                                        Rejected
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-400">
                                                <span className="flex items-center gap-1.5 hover:text-gray-300 transition-colors">
                                                    <Mail className="w-3.5 h-3.5" /> {request.customerEmail}
                                                </span>
                                                <span className="hidden sm:inline w-1 h-1 bg-gray-700 rounded-full" />
                                                <span className="flex items-center gap-1.5 hover:text-gray-300 transition-colors">
                                                    <Phone className="w-3.5 h-3.5" /> {request.contactNumber}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-gray-800 pt-4 md:pt-0 mt-2 md:mt-0">
                                        <div className="text-center sm:text-right mr-0 md:mr-6">
                                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
                                                {request.status === 'pending' ? 'Requested' : request.status === 'approved' ? 'Approved' : 'Rejected'}
                                            </p>
                                            <p className="text-sm font-medium text-gray-300 flex items-center gap-2 justify-center sm:justify-end">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {request.status === 'pending'
                                                    ? (request.createdAt instanceof Date ? request.createdAt.toLocaleDateString() : 'Unknown')
                                                    : request.status === 'approved'
                                                        ? (request.approvedAt instanceof Date ? request.approvedAt.toLocaleDateString() : 'Unknown')
                                                        : (request.rejectedAt instanceof Date ? request.rejectedAt.toLocaleDateString() : 'Unknown')
                                                }
                                            </p>
                                        </div>

                                        <div className="flex gap-3 w-full sm:w-auto">
                                            <Button
                                                onClick={() => handleViewDetails(request)}
                                                className="flex-1 sm:flex-none bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 transition-all font-medium"
                                            >
                                                Details <ChevronRight className="w-4 h-4 ml-1 opacity-50" />
                                            </Button>

                                            {request.status === 'pending' && (
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="icon"
                                                        className="bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white border border-green-500/20 transition-all"
                                                        onClick={() => { setSelectedRequest(request); handleApprove(); }}
                                                        title="Quick Approve"
                                                    >
                                                        <CheckCircle2 className="w-5 h-5" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all"
                                                        onClick={() => { setSelectedRequest(request); setIsRejectOpen(true); }}
                                                        title="Quick Reject"
                                                    >
                                                        <XCircle className="w-5 h-5" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Request Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="bg-[#0a0a0a] border-gray-800 text-white max-w-2xl p-0 overflow-hidden shadow-2xl">
                    <DialogHeader className="p-6 pb-4 bg-gray-900/50 border-b border-white/5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`
                                p-2 rounded-lg 
                                ${selectedRequest?.status === 'pending' ? 'bg-orange-500/10 text-orange-500' :
                                    selectedRequest?.status === 'approved' ? 'bg-green-500/10 text-green-500' :
                                        'bg-red-500/10 text-red-500'}
                            `}>
                                <User className="w-5 h-5" />
                            </div>
                            <DialogTitle className="text-xl">Membership Application</DialogTitle>
                        </div>
                        <DialogDescription className="text-gray-400 ml-12">
                            Review applicant details and eligibility metrics.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6">
                        {loadingDetails ? (
                            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                                <p className="text-sm text-gray-500">Fetching customer profile...</p>
                            </div>
                        ) : selectedRequest && (
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold text-orange-500 uppercase tracking-widest border-b border-white/10 pb-2">Request Info</h4>
                                        <div className="space-y-4">
                                            <div className="group">
                                                <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Applicant Name</span>
                                                <span className="font-medium text-lg text-white group-hover:text-orange-400 transition-colors">{selectedRequest.customerName}</span>
                                            </div>
                                            <div className="group">
                                                <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Contact Number</span>
                                                <span className="font-medium text-gray-300 group-hover:text-white transition-colors">{selectedRequest.contactNumber}</span>
                                            </div>
                                            <div className="group">
                                                <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Email Address</span>
                                                <span className="font-medium text-gray-300 group-hover:text-white transition-colors">{selectedRequest.customerEmail}</span>
                                            </div>
                                            {selectedRequest.status === 'rejected' && selectedRequest.rejectionReason && (
                                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                                    <span className="text-red-400 text-xs uppercase tracking-wider block mb-1">Rejection Reason</span>
                                                    <p className="text-white text-sm">{selectedRequest.rejectionReason}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold text-blue-500 uppercase tracking-widest border-b border-white/10 pb-2">Platform Activity</h4>
                                        <div className="space-y-4">
                                            {customerDetails ? (
                                                <>
                                                    <div className="bg-gray-900/50 p-3 rounded-lg border border-white/5">
                                                        <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Current Wallet Balance</span>
                                                        <span className="font-bold text-2xl text-green-400">₹{customerDetails.walletBalance?.toFixed(2) || '0.00'}</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Member Since</span>
                                                            <span className="font-medium text-gray-300">{customerDetails.createdAt ? new Date(customerDetails.createdAt).toLocaleDateString() : 'N/A'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Addresses</span>
                                                            <span className="font-medium text-gray-300">{customerDetails.addresses?.length || 0} saved</span>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                                                    <AlertCircle className="w-4 h-4" />
                                                    Customer profile unavailable.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {customerDetails?.addresses && customerDetails.addresses.length > 0 && (
                                    <div className="col-span-1 md:col-span-2 mt-2">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-white/10 pb-2 mb-3">Primary Delivery Address</h4>
                                        <div className="bg-gradient-to-r from-gray-900 to-black p-4 rounded-xl flex items-start gap-4 border border-white/5">
                                            <div className="p-2 bg-white/5 rounded-full mt-0.5">
                                                <MapPin className="w-4 h-4 text-gray-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-white mb-1">{customerDetails.addresses[0].street}</p>
                                                <p className="text-sm text-gray-400">{customerDetails.addresses[0].city}, {customerDetails.addresses[0].state} - {customerDetails.addresses[0].pincode}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-4 bg-gray-900/80 border-t border-white/5 gap-3 backdrop-blur-sm">
                        {selectedRequest?.status === 'pending' ? (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsRejectOpen(true)}
                                    className="border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/50"
                                >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Reject
                                </Button>
                                <Button
                                    onClick={handleApprove}
                                    disabled={actionLoading}
                                    className="bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20"
                                >
                                    {actionLoading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2 w-4 h-4" />}
                                    Approve & Issued Card
                                </Button>
                            </>
                        ) : (
                            <Button variant="ghost" onClick={() => setIsDetailsOpen(false)} className="w-full">
                                Close Details
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Reason Dialog */}
            <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
                <DialogContent className="bg-[#0a0a0a] border-gray-800 text-white sm:max-w-md shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-red-500 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            Reject Application
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Please provide a reason. This will be visible to the customer.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Reason (e.g. Incomplete details, Duplicate account)"
                            className="bg-gray-900 border-gray-700 text-white focus:border-red-500/50 min-h-[50px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsRejectOpen(false)} className="hover:text-white">Cancel</Button>
                        <Button onClick={handleReject} className="bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/20" disabled={!rejectionReason || actionLoading}>
                            {actionLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : 'Confirm Rejection'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
