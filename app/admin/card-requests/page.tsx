'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, where, doc, getDoc } from 'firebase/firestore';
import { MembershipRequest, Customer, IssuedCard } from '@/lib/types';
import { approveMembership, rejectMembership } from '@/lib/membership-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, CreditCard, User, Phone, Mail, MapPin, Calendar, Search, AlertCircle, ChevronRight, Filter, Wallet, Clock, ArrowUpRight, Edit2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import EditIssuedCardDialog from '@/components/admin/EditIssuedCardDialog';
import IssueCardDialog from '@/components/admin/IssueCardDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    const [cards, setCards] = useState<IssuedCard[]>([]);
    const [visibleCvvId, setVisibleCvvId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<MembershipRequest | null>(null);
    const [customerDetails, setCustomerDetails] = useState<Customer | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isRejectOpen, setIsRejectOpen] = useState(false);
    const [selectedCardToEdit, setSelectedCardToEdit] = useState<IssuedCard | null>(null);
    const [editCardDialogOpen, setEditCardDialogOpen] = useState(false);
    const [selectedRequestToIssue, setSelectedRequestToIssue] = useState<MembershipRequest | null>(null);
    const [issueCardDialogOpen, setIssueCardDialogOpen] = useState(false);

    // Filters
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'unissued' | 'rejected'>('all');
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
            // Don't set loading false yet, wait for cards
        });

        const qCards = query(collection(db, 'issuedCards'), orderBy('issuedAt', 'desc'));
        const unsubscribeCards = onSnapshot(qCards, (snapshot) => {
            const issuedCards = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                issuedAt: doc.data().issuedAt?.toDate() || new Date(),
                expiryDate: doc.data().expiryDate?.toDate() || new Date(),
            })) as IssuedCard[];
            setCards(issuedCards);
            setLoading(false);
        });

        return () => {
            unsubscribe();
            unsubscribeCards();
        };
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

    const handleApprove = async (request?: MembershipRequest) => {
        const targetRequest = request || selectedRequest;
        if (!targetRequest) return;

        setActionLoading(true);
        try {
            const result = await approveMembership(targetRequest.id);
            if (result.success) {
                toast.success(`Membership approved for ${targetRequest.customerName}`);
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
    const issuedCustomerIds = new Set(cards.map(c => c.customerId));

    const filteredRequests = requests.filter(req => {
        let matchesStatus = true;
        if (filterStatus === 'all') {
            matchesStatus = true;
        } else if (filterStatus === 'unissued') {
            matchesStatus = req.status === 'approved' && !issuedCustomerIds.has(req.customerId);
        } else {
            matchesStatus = req.status === filterStatus;
        }

        const searchLower = searchQuery.toLowerCase();
        const matchesSearch =
            req.customerName.toLowerCase().includes(searchLower) ||
            req.customerEmail.toLowerCase().includes(searchLower) ||
            req.contactNumber.includes(searchQuery);

        return matchesStatus && matchesSearch;
    });

    const pendingCount = requests.filter(r => r.status === 'pending').length;
    const approvedCount = requests.filter(r => r.status === 'approved').length;
    const cardsIssuedCount = cards.length;
    const unissuedCount = requests.filter(r => r.status === 'approved' && !issuedCustomerIds.has(r.customerId)).length;
    const rejectedCount = requests.filter(r => r.status === 'rejected').length;

    return (
        <div className="space-y-8 p-6 md:p-8 max-w-[1600px] mx-auto">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
                        Card Management
                    </h1>
                    <p className="text-muted-foreground mt-2 text-lg">Process new memberships, issue virtual cards, and view history.</p>
                </div>
            </div>

            {/* Statistics Dashboard */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Card className="bg-gradient-to-br from-blue-900/20 to-black/40 border-blue-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(59,130,246,0.1)] group hover:shadow-[0_0_40px_rgba(59,130,246,0.2)] transition-all duration-300">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                            <Wallet className="w-4 h-4" />
                            Total Requests
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground mb-1 tracking-tight">{requests.length}</div>
                        <p className="text-xs text-muted-foreground font-medium">Lifetime Applications</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-900/20 to-black/40 border-amber-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(245,158,11,0.1)] group hover:shadow-[0_0_40px_rgba(245,158,11,0.2)] transition-all duration-300">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Pending Review
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground mb-1 tracking-tight">{pendingCount}</div>
                        <p className="text-xs text-muted-foreground font-medium">Requires Review</p>
                    </CardContent>
                </Card>

                {/* Card Pending Issue Stat Card */}
                <Card
                    onClick={() => setFilterStatus('unissued')}
                    className={`bg-gradient-to-br from-amber-950/40 via-yellow-950/20 to-black/60 border-amber-500/30 backdrop-blur-md transition-all duration-300 cursor-pointer ${
                        unissuedCount > 0 ? 'ring-1 ring-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.15)]' : ''
                    }`}
                >
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-amber-300 uppercase tracking-widest flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-amber-400" />
                            Needs Card Issue
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-amber-400 mb-1 tracking-tight flex items-center gap-2">
                            {unissuedCount}
                            {unissuedCount > 0 && (
                                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] px-1.5 py-0">
                                    Action Required
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-amber-300/70 font-medium">Approved • Card Not Issued</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-900/20 to-black/40 border-emerald-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(16,185,129,0.1)] group hover:shadow-[0_0_40px_rgba(16,185,129,0.2)] transition-all duration-300">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Cards Active
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground mb-1 tracking-tight">{cardsIssuedCount}</div>
                        <p className="text-xs text-muted-foreground font-medium">Issued Virtual Cards</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-900/20 to-black/40 border-red-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(239,68,68,0.1)] group hover:shadow-[0_0_40px_rgba(239,68,68,0.2)] transition-all duration-300">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                            <XCircle className="w-4 h-4" />
                            Rejected
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground mb-1 tracking-tight">{rejectedCount}</div>
                        <p className="text-xs text-muted-foreground font-medium">Applications Denied</p>
                    </CardContent>
                </Card>
            </div>

            {/* Controls Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card/40 p-1 rounded-xl border border-border/50 backdrop-blur-sm">
                <div className="flex p-1 gap-1 w-full md:w-auto bg-background/20 rounded-lg overflow-x-auto">
                    {(['all', 'pending', 'unissued', 'approved', 'rejected'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`
                                px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap
                                ${filterStatus === status
                                    ? 'bg-secondary text-foreground shadow-lg'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-card/5'}
                            `}
                        >
                            {status === 'all'
                                ? 'All'
                                : status === 'pending'
                                ? `Pending (${pendingCount})`
                                : status === 'unissued'
                                ? `Needs Card Issue (${unissuedCount})`
                                : status === 'approved'
                                ? `Approved (${approvedCount})`
                                : `Rejected (${rejectedCount})`}
                        </button>
                    ))}
                </div>

                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-background/20 border-border/50 text-foreground placeholder:text-muted-foreground focus:bg-background/40 transition-all"
                    />
                </div>
            </div>

            {/* Content List */}
            <Tabs defaultValue="requests" className="w-full">
                <TabsList className="bg-card/50 border border-border/50 mb-6">
                    <TabsTrigger value="requests" className="data-[state=active]:bg-orange-500 data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors">Requests</TabsTrigger>
                    <TabsTrigger value="cards" className="data-[state=active]:bg-blue-600 data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors">Issued Cards</TabsTrigger>
                </TabsList>

                <TabsContent value="requests" className="mt-0">
                    <div className="grid gap-4">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-24 space-y-4">
                                <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
                                <p className="text-muted-foreground animate-pulse">Loading data...</p>
                            </div>
                        ) : filteredRequests.length === 0 ? (
                            <Card className="bg-card/40 border-border/50 p-16 text-center backdrop-blur-md">
                                <div className="w-20 h-20 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-border/50">
                                    <Search className="w-10 h-10 text-muted-foreground" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground mb-2">No Requests Found</h3>
                                <p className="text-muted-foreground">Try adjusting your filters or search query.</p>
                            </Card>
                        ) : (
                            <div className="grid gap-4">
                                {filteredRequests.map((request) => (
                                    <Card key={request.id} className={`
                                    bg-card/60 border-border/50 transition-all duration-300 group overflow-hidden
                                    ${request.status === 'pending' ? 'hover:border-orange-500/30 ring-1 ring-orange-500/10' : 'hover:border-border'}
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
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <h3 className="font-bold text-foreground text-lg">{request.customerName}</h3>
                                                        {request.status === 'pending' && (
                                                            <Badge variant="outline" className="text-orange-400 border-orange-500/20 bg-orange-500/10 text-[10px] px-2 py-0.5 uppercase tracking-widest">
                                                                Waitlist
                                                            </Badge>
                                                        )}
                                                        {request.status === 'approved' && (
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <Badge variant="outline" className="text-green-400 border-green-500/20 bg-green-500/10 text-[10px] px-2 py-0.5 uppercase tracking-widest">
                                                                    Approved
                                                                </Badge>
                                                                {!issuedCustomerIds.has(request.customerId) ? (
                                                                    <Badge variant="outline" className="text-amber-300 border-amber-500/40 bg-amber-500/15 text-[10px] px-2 py-0.5 uppercase tracking-wider font-bold animate-pulse flex items-center gap-1">
                                                                        <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                                                                        Card Not Issued
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/10 text-[10px] px-2 py-0.5 uppercase tracking-wider font-semibold">
                                                                        Card Active
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        )}
                                                        {request.status === 'rejected' && (
                                                            <Badge variant="outline" className="text-red-400 border-red-500/20 bg-red-500/10 text-[10px] px-2 py-0.5 uppercase tracking-widest">
                                                                Rejected
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                                                        <span className="flex items-center gap-1.5 hover:text-muted-foreground transition-colors">
                                                            <Mail className="w-3.5 h-3.5" /> {request.customerEmail}
                                                        </span>
                                                        <span className="hidden sm:inline w-1 h-1 bg-secondary rounded-full" />
                                                        <span className="flex items-center gap-1.5 hover:text-muted-foreground transition-colors">
                                                            <Phone className="w-3.5 h-3.5" /> {request.contactNumber}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-border/50 pt-4 md:pt-0 mt-2 md:mt-0">
                                                <div className="text-center sm:text-right mr-0 md:mr-6">
                                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                                                        {request.status === 'pending' ? 'Requested' : request.status === 'approved' ? 'Approved' : 'Rejected'}
                                                    </p>
                                                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 justify-center sm:justify-end">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        {request.status === 'pending'
                                                            ? (request.createdAt instanceof Date ? request.createdAt.toLocaleDateString() : 'Unknown')
                                                            : request.status === 'approved'
                                                                ? (request.approvedAt instanceof Date ? request.approvedAt.toLocaleDateString() : 'Unknown')
                                                                : (request.rejectedAt instanceof Date ? request.rejectedAt.toLocaleDateString() : 'Unknown')
                                                        }
                                                    </p>
                                                </div>

                                                <div className="flex gap-2.5 w-full sm:w-auto flex-wrap">
                                                    {request.status === 'approved' && !issuedCustomerIds.has(request.customerId) && (
                                                        <Button
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedRequestToIssue(request);
                                                                setIssueCardDialogOpen(true);
                                                            }}
                                                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-foreground font-bold text-xs rounded-xl shadow-lg shadow-blue-600/25 px-3 py-1.5 gap-1.5 transition-all"
                                                        >
                                                            <CreditCard className="w-3.5 h-3.5" /> Issue Card
                                                        </Button>
                                                    )}

                                                    <Button
                                                        onClick={() => handleViewDetails(request)}
                                                        className="flex-1 sm:flex-none bg-card/5 hover:bg-card/10 text-foreground border border-border/50 hover:border-border transition-all font-medium text-xs rounded-xl"
                                                    >
                                                        Details <ChevronRight className="w-4 h-4 ml-1 opacity-50" />
                                                    </Button>

                                                    {request.status === 'pending' && (
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="icon"
                                                                className="bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-foreground border border-green-500/20 transition-all rounded-xl"
                                                                onClick={() => handleApprove(request)}
                                                                title="Quick Approve"
                                                            >
                                                                <CheckCircle2 className="w-5 h-5" />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-foreground border border-red-500/20 transition-all rounded-xl"
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
                </TabsContent>

                <TabsContent value="cards" className="mt-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 space-y-4">
                            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                            <p className="text-muted-foreground animate-pulse">Loading cards...</p>
                        </div>
                    ) : cards.length === 0 ? (
                        <Card className="bg-card/40 border-border/50 p-16 text-center backdrop-blur-md">
                            <CreditCard className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-foreground mb-2">No Cards Issued Yet</h3>
                            <p className="text-muted-foreground">Approved memberships will appear here as issued cards.</p>
                        </Card>
                    ) : (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {cards.map((card) => (
                                <div
                                    key={card.id}
                                    onClick={() => {
                                        setSelectedCardToEdit(card);
                                        setEditCardDialogOpen(true);
                                    }}
                                    className="relative overflow-hidden rounded-2xl p-6 aspect-[1.586/1] flex flex-col justify-between shadow-2xl group border border-border/50 bg-background/40 backdrop-blur-md hover:border-blue-500/50 hover:shadow-blue-500/10 cursor-pointer transition-all duration-500"
                                >
                                    {/* Decorative Elements */}
                                    <div className="absolute top-[-50%] left-[-50%] w-[100%] h-[100%] bg-blue-500/10 blur-[80px] rounded-full group-hover:bg-blue-500/20 transition-all duration-700 pointer-events-none" />
                                    <div className="absolute bottom-[-50%] right-[-50%] w-[100%] h-[100%] bg-purple-500/10 blur-[80px] rounded-full group-hover:bg-purple-500/20 transition-all duration-700 pointer-events-none" />

                                    <div className="relative z-10 flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-sm tracking-wider text-foreground flex items-center gap-1.5">
                                                HUNGER<span className="text-blue-500">PREMIUM</span>
                                            </h3>
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                                                {card.tier || 'VIP'} Membership Card
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedCardToEdit(card);
                                                    setEditCardDialogOpen(true);
                                                }}
                                                className="h-6 px-2 text-[11px] bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 rounded-lg gap-1 font-semibold"
                                            >
                                                <Edit2 className="w-2.5 h-2.5" /> Edit
                                            </Button>
                                            <div className={`px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wider ${
                                                card.status === 'active'
                                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                    : card.status === 'blocked'
                                                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                                    : 'bg-card/10 border-border/50 text-foreground/70'
                                            }`}>
                                                {card.status}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="relative z-10">
                                        <div className="flex items-center gap-2 mb-1">
                                            <CreditCard className="w-4 h-4 text-blue-400" />
                                            <div className="text-xl font-mono text-foreground tracking-widest font-bold">
                                                {card.cardNumber?.match(/.{1,4}/g)?.join(' ') || '**** **** **** ****'}
                                            </div>
                                        </div>
                                        <div className="flex gap-8 text-[10px] text-muted-foreground uppercase tracking-wider font-mono pl-6">
                                            <span>EXP: {card.expiryDate instanceof Date ? card.expiryDate.toLocaleDateString(undefined, { month: '2-digit', year: '2-digit' }) : 'MM/YY'}</span>
                                            <span
                                                className="cursor-pointer hover:text-foreground transition-colors flex items-center gap-1"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setVisibleCvvId(visibleCvvId === card.id ? null : card.id);
                                                }}
                                                title="Click to toggle CVV"
                                            >
                                                CVV: {visibleCvvId === card.id ? card.cvv : '***'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="relative z-10 flex justify-between items-end border-t border-border/50 pt-3 mt-2">
                                        <div>
                                            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Card Holder</div>
                                            <div className="font-medium text-sm text-foreground uppercase truncate max-w-[150px]">{card.customerName}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Click to edit</div>
                                            <div className="font-medium text-xs text-blue-400 flex items-center gap-1 justify-end group-hover:underline">
                                                <Edit2 className="w-3 h-3" /> Edit Details
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Request Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="bg-[#0a0a0a] border-border/50 text-foreground max-w-2xl p-0 overflow-hidden shadow-2xl">
                    <DialogHeader className="p-6 pb-4 bg-card/50 border-b border-border/50">
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
                        <DialogDescription className="text-muted-foreground ml-12">
                            Review applicant details and eligibility metrics.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6">
                        {loadingDetails ? (
                            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                                <p className="text-sm text-muted-foreground">Fetching customer profile...</p>
                            </div>
                        ) : selectedRequest && (
                            <Tabs defaultValue="info" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 bg-card/50 border border-border/50 mb-6">
                                    <TabsTrigger value="info" className="data-[state=active]:bg-orange-500 data-[state=active]:text-foreground text-foreground hover:text-foreground transition-colors">Request Info</TabsTrigger>
                                    <TabsTrigger value="activity" className="data-[state=active]:bg-blue-600 data-[state=active]:text-foreground text-foreground hover:text-foreground transition-colors">Platform Activity</TabsTrigger>
                                </TabsList>

                                {/* Request Info Tab */}
                                <TabsContent value="info" className="space-y-6 mt-0">
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="group space-y-1">
                                                <span className="text-muted-foreground text-xs uppercase tracking-wider block">Applicant Name</span>
                                                <span className="font-medium text-lg text-foreground group-hover:text-orange-400 transition-colors">{selectedRequest.customerName}</span>
                                            </div>
                                            <div className="group space-y-1">
                                                <span className="text-muted-foreground text-xs uppercase tracking-wider block">Contact Number</span>
                                                <span className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">{selectedRequest.contactNumber}</span>
                                            </div>
                                            <div className="group space-y-1 col-span-2">
                                                <span className="text-muted-foreground text-xs uppercase tracking-wider block">Email Address</span>
                                                <span className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">{selectedRequest.customerEmail}</span>
                                            </div>
                                        </div>

                                        {selectedRequest.status === 'rejected' && selectedRequest.rejectionReason && (
                                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                                <span className="text-red-400 text-xs uppercase tracking-wider block mb-1">Rejection Reason</span>
                                                <p className="text-foreground text-sm">{selectedRequest.rejectionReason}</p>
                                            </div>
                                        )}

                                        {/* Card Pending Issue Notice */}
                                        {selectedRequest.status === 'approved' && !issuedCustomerIds.has(selectedRequest.customerId) && (
                                            <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                                                        <CreditCard className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-foreground font-bold text-sm">Membership Approved — Card Not Issued</p>
                                                        <p className="text-xs text-muted-foreground">This member is approved, but their virtual card has not been issued yet.</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    onClick={() => {
                                                        setSelectedRequestToIssue(selectedRequest);
                                                        setIssueCardDialogOpen(true);
                                                    }}
                                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-foreground font-bold text-xs rounded-xl shadow-md gap-1.5 shrink-0"
                                                >
                                                    <CreditCard className="w-3.5 h-3.5" /> Issue Card Now
                                                </Button>
                                            </div>
                                        )}
                                    </div>



                                    {/* Primary Delivery Address */}
                                    <div className="space-y-2">
                                        <h5 className="text-xs font-bold text-orange-400 uppercase tracking-widest border-b border-border/50 pb-2">Primary Delivery Address</h5>
                                        {customerDetails?.addresses && customerDetails.addresses.length > 0 ? (
                                            <div className="bg-gradient-to-r from-gray-900 to-black p-4 rounded-xl flex items-start gap-4 border border-border/50 hover:border-orange-500/30 transition-colors">
                                                <div className="p-2 bg-card/5 rounded-full mt-0.5">
                                                    <MapPin className="w-4 h-4 text-orange-500" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-foreground mb-1.5">{customerDetails.addresses[0].street}</p>
                                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                                        {customerDetails.addresses[0].city}, {customerDetails.addresses[0].state}
                                                        <span className="block text-muted-foreground text-xs mt-1">PIN: {customerDetails.addresses[0].pincode}</span>
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-card/50 border border-border/50 rounded-lg text-muted-foreground text-sm italic flex items-center gap-2">
                                                <AlertCircle className="w-4 h-4" /> No address saved.
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                {/* Platform Activity Tab */}
                                <TabsContent value="activity" className="space-y-6 mt-0">
                                    <div className="grid gap-4">
                                        <div className="space-y-4">
                                            {customerDetails ? (
                                                <>
                                                    <div className="p-4 bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 rounded-xl relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 p-3 opacity-10">
                                                            <Wallet className="w-16 h-16 text-green-500" />
                                                        </div>
                                                        <span className="text-green-500 text-xs uppercase tracking-wider block mb-2 font-bold">Current Wallet Balance</span>
                                                        <span className="font-bold text-3xl text-foreground">₹{customerDetails.walletBalance?.toFixed(2) || '0.00'}</span>
                                                    </div>

                                                    {/* Bank Details (Duplicated for Visibility) */}
                                                    <div className="space-y-2">
                                                        <h5 className="text-xs font-bold text-blue-400 uppercase tracking-widest border-b border-border/50 pb-2">Bank Details</h5>
                                                        {(selectedRequest.bankDetails || customerDetails?.bankDetails) ? (
                                                            <div className="bg-blue-900/10 p-4 rounded-lg border border-blue-500/20">
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <CreditCard className="w-4 h-4 text-blue-400" />
                                                                    <span className="text-blue-400 text-sm font-bold uppercase tracking-wider">Attached Account</span>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-y-2 text-sm text-muted-foreground">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] text-muted-foreground uppercase">Bank Name</span>
                                                                        <span className="font-medium text-foreground">{(selectedRequest.bankDetails || customerDetails?.bankDetails)?.bankName}</span>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] text-muted-foreground uppercase">Account Number</span>
                                                                        <span className="font-mono text-foreground">{(selectedRequest.bankDetails || customerDetails?.bankDetails)?.accountNumber}</span>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] text-muted-foreground uppercase">IFSC Code</span>
                                                                        <span className="font-mono text-foreground">{(selectedRequest.bankDetails || customerDetails?.bankDetails)?.ifscCode}</span>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] text-muted-foreground uppercase">Holder Name</span>
                                                                        <span className="font-medium text-foreground">{(selectedRequest.bankDetails || customerDetails?.bankDetails)?.accountHolderName}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="p-4 bg-card/50 border border-border/50 rounded-lg text-muted-foreground text-sm italic">
                                                                No bank details attached.
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="p-4 bg-card/50 border border-border/50 rounded-xl">
                                                            <span className="text-muted-foreground text-xs uppercase tracking-wider block mb-2">Member Since</span>
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="w-4 h-4 text-blue-500" />
                                                                <span className="font-medium text-foreground">
                                                                    {customerDetails.createdAt ? new Date(customerDetails.createdAt).toLocaleDateString(undefined, {
                                                                        year: 'numeric', month: 'long', day: 'numeric'
                                                                    }) : 'N/A'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="p-4 bg-card/50 border border-border/50 rounded-xl">
                                                            <span className="text-muted-foreground text-xs uppercase tracking-wider block mb-2">Saved Addresses</span>
                                                            <div className="flex items-center gap-2">
                                                                <MapPin className="w-4 h-4 text-purple-500" />
                                                                <span className="font-medium text-foreground">{customerDetails.addresses?.length || 0} Locations</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Additional Stats can calculate order stats here if available in future */}
                                                </>
                                            ) : (
                                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                                                    <AlertCircle className="w-4 h-4" />
                                                    Customer profile unavailable.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        )}
                    </div>

                    <DialogFooter className="p-4 bg-card/80 border-t border-border/50 gap-3 backdrop-blur-sm">
                        {selectedRequest?.status === 'pending' ? (
                            <div className="flex flex-col sm:flex-row w-full gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsRejectOpen(true)}
                                    className="flex-1 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/50"
                                >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Reject
                                </Button>
                                <Button
                                    onClick={() => handleApprove(selectedRequest)}
                                    disabled={actionLoading}
                                    className="flex-1 bg-green-600 hover:bg-green-500 text-foreground shadow-lg shadow-green-900/20"
                                >
                                    {actionLoading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2 w-4 h-4" />}
                                    Approve & Issue
                                </Button>
                            </div>
                        ) : (
                            <div className="w-full flex gap-3 flex-wrap">
                                {selectedRequest?.status === 'approved' && !issuedCustomerIds.has(selectedRequest.customerId) && (
                                    <Button
                                        onClick={() => {
                                            setSelectedRequestToIssue(selectedRequest);
                                            setIssueCardDialogOpen(true);
                                        }}
                                        className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-foreground font-bold rounded-xl shadow-lg shadow-blue-600/20 gap-2"
                                    >
                                        <CreditCard className="w-4 h-4" /> Issue Virtual Card
                                    </Button>
                                )}
                                <Button variant="ghost" onClick={() => setIsDetailsOpen(false)} className="flex-1 rounded-xl">
                                    Close Details
                                </Button>
                                <Button variant="outline" className="flex-1 border-border/50 hover:bg-card/5 rounded-xl" onClick={() => {
                                    toast.info("Full Account View Coming Soon");
                                }}>
                                    View Full Account
                                </Button>
                            </div>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            {/* Reject Reason Dialog */}
            < Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen} >
                <DialogContent className="bg-[#0a0a0a] border-border/50 text-foreground sm:max-w-md shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-red-500 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            Reject Application
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Please provide a reason. This will be visible to the customer.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Reason (e.g. Incomplete details, Duplicate account)"
                            className="bg-card border-border/50 text-foreground focus:border-red-500/50 min-h-[50px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsRejectOpen(false)} className="hover:text-foreground">Cancel</Button>
                        <Button onClick={handleReject} className="bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/20" disabled={!rejectionReason || actionLoading}>
                            {actionLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : 'Confirm Rejection'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            {/* Reusable Edit Issued Card Dialog */}
            <EditIssuedCardDialog
                card={selectedCardToEdit}
                open={editCardDialogOpen}
                onOpenChange={setEditCardDialogOpen}
            />

            {/* Issue Card Dialog for Approved Requests lacking a card */}
            <IssueCardDialog
                request={selectedRequestToIssue}
                open={issueCardDialogOpen}
                onOpenChange={setIssueCardDialogOpen}
            />

        </div >
    );
}
