'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MenuItem } from '@/lib/types';
import {
    CheckCircle,
    XCircle,
    Clock,
    AlertCircle,
    Search,
    Filter,
    MoreVertical,
    Utensils,
    Leaf,
    Flame,
    Check,
    X,
    AlertTriangle,
    Info
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function MenuApprovalsPage() {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Dialog States
    const [rejectingItem, setRejectingItem] = useState<MenuItem | null>(null);
    const [approvingItem, setApprovingItem] = useState<MenuItem | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Feedback States
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string, title: string } | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'menuItems'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map((doc) => ({
                ...doc.data(),
                id: doc.id,
            })) as MenuItem[];
            setMenuItems(items);
            setLoading(false);
        }, (error) => {
            console.error('[Admin] Error fetching menu items:', error);
            setFeedback({
                type: 'error',
                title: 'Connection Error',
                message: `Failed to load menu items: ${error.message}`
            });
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const executeApproval = async () => {
        if (!approvingItem) return;

        try {
            setProcessingId(approvingItem.id!);
            await updateDoc(doc(db, 'menuItems', approvingItem.id!), {
                approvalStatus: 'approved',
                isLive: true,
                approvedAt: new Date(),
                updatedAt: new Date(),
            });
            setFeedback({
                type: 'success',
                title: 'Item Approved',
                message: `"${approvingItem.name}" is now live on the platform.`
            });
        } catch (error: any) {
            console.error('[Admin] Error approving item:', error);
            setFeedback({
                type: 'error',
                title: 'Approval Failed',
                message: error.message || 'Unknown error occurred while approving the item.'
            });
        } finally {
            setProcessingId(null);
            setApprovingItem(null);
        }
    };

    const handleRejectConfirm = async () => {
        if (!rejectingItem || !rejectionReason.trim()) {
            return;
        }

        try {
            setProcessingId(rejectingItem.id!);
            await updateDoc(doc(db, 'menuItems', rejectingItem.id!), {
                approvalStatus: 'rejected',
                isLive: false,
                rejectionReason: rejectionReason,
                updatedAt: new Date(),
            });
            setFeedback({
                type: 'success',
                title: 'Item Rejected',
                message: `"${rejectingItem.name}" has been rejected.`
            });
            setRejectingItem(null);
            setRejectionReason('');
        } catch (error: any) {
            console.error('[Admin] Error rejecting item:', error);
            setFeedback({
                type: 'error',
                title: 'Rejection Failed',
                message: error.message || 'Unknown error occurred while rejecting the item.'
            });
        } finally {
            setProcessingId(null);
        }
    };

    const handleToggleLive = async (item: MenuItem) => {
        try {
            setProcessingId(item.id!);
            await updateDoc(doc(db, 'menuItems', item.id!), {
                isLive: !item.isLive,
                updatedAt: new Date(),
            });
        } catch (error: any) {
            console.error('[Admin] Error toggling status:', error);
            setFeedback({
                type: 'error',
                title: 'Action Failed',
                message: error.message || 'Could not update item status.'
            });
        } finally {
            setProcessingId(null);
        }
    };

    // Parsing helper for FireStore timestamps
    const formatDate = (date: any) => {
        if (!date) return 'N/A';
        if (date?.toDate) return date.toDate().toLocaleDateString() + ' ' + date.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (date instanceof Date) return date.toLocaleDateString();
        return 'Invalid Date';
    };

    const pendingItems = menuItems.filter(item => item.approvalStatus === 'pending');
    const approvedItems = menuItems.filter(item => item.approvalStatus === 'approved');
    const rejectedItems = menuItems.filter(item => item.approvalStatus === 'rejected');

    const renderItemCard = (item: MenuItem) => (
        <div key={item.id} className="group bg-card border border-border/50 rounded-xl overflow-hidden hover:bg-secondary transition-all shadow-md">
            <div className="flex flex-col sm:flex-row h-full">
                {/* Image Section */}
                <div className="w-full sm:w-48 h-48 sm:h-auto bg-background relative shrink-0">
                    <Avatar className="w-full h-full rounded-none">
                        <AvatarImage src={item.image} className="object-cover w-full h-full opacity-90 hover:opacity-100 transition-opacity" />
                        <AvatarFallback className="rounded-none text-4xl bg-secondary text-muted-foreground">
                            <Utensils />
                        </AvatarFallback>
                    </Avatar>
                    <div className="absolute top-2 left-2 flex flex-col gap-1.5">
                        {item.vegetarian && (
                            <Badge className="bg-green-600 text-foreground hover:bg-green-700 w-fit shadow-md border-none">
                                <Leaf className="h-3 w-3 mr-1" /> Veg
                            </Badge>
                        )}
                        {item.spicy && (
                            <Badge className="bg-red-600 text-foreground hover:bg-red-700 w-fit shadow-md border-md border-none">
                                <Flame className="h-3 w-3 mr-1" /> Spicy
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 p-6 flex flex-col justify-between">
                    <div className="space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <h3 className="text-2xl font-bold text-foreground tracking-tight leading-none">{item.name}</h3>
                                <p className="text-sm text-muted-foreground font-semibold bg-secondary px-3 py-1 rounded-md w-fit capitalize flex items-center gap-2">
                                    <Utensils className="h-3 w-3" /> {item.category}
                                </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className="text-2xl font-bold text-green-400 text-right">₹{item.price}</span>
                                {item.approvalStatus === 'approved' && (
                                    <Badge variant={item.isLive ? 'default' : 'secondary'} className={
                                        item.isLive ? "bg-green-900/40 text-green-300 hover:bg-green-900/60 border-green-800" : "bg-secondary text-muted-foreground border-border/50"
                                    }>
                                        {item.isLive ? 'Live on App' : 'Offline'}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <p className="text-foreground text-base leading-relaxed line-clamp-2">
                            {item.description || 'No description provided.'}
                        </p>

                        <div className="flex items-center gap-6 text-sm text-muted-foreground pt-3 border-t border-border/50">
                            <span className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-blue-400" />
                                <span className="text-muted-foreground">Submitted:</span> {formatDate(item.createdAt || (item as any).submittedAt)}
                            </span>
                            <span className="font-mono text-muted-foreground text-xs bg-background px-2 py-1 rounded">ID: {item.id?.slice(0, 8)}</span>
                        </div>

                        {item.approvalStatus === 'rejected' && item.rejectionReason && (
                            <div className="bg-red-950/20 border border-red-900/50 rounded-lg p-3 mt-2 flex gap-3 items-start">
                                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-red-300 text-sm font-bold mb-1">Rejection Reason</p>
                                    <p className="text-red-200 text-sm opacity-90">{item.rejectionReason}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action Footer */}
                    <div className="flex items-center justify-end gap-3 mt-5 pt-2">
                        {item.approvalStatus === 'pending' && (
                            <>
                                <Button
                                    variant="destructive"
                                    className="gap-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40"
                                    onClick={() => setRejectingItem(item)}
                                    disabled={!!processingId}
                                >
                                    <XCircle className="h-4 w-4" /> Reject
                                </Button>
                                <Button
                                    className="gap-2 bg-green-600 hover:bg-green-500 text-foreground font-semibold shadow-lg shadow-green-900/20 px-6"
                                    onClick={() => setApprovingItem(item)}
                                    disabled={!!processingId}
                                >
                                    <CheckCircle className="h-4 w-4" /> Approve & Publish
                                </Button>
                            </>
                        )}

                        {item.approvalStatus === 'approved' && (
                            <Button
                                variant="outline"
                                className={`gap-2 ${item.isLive ? 'border-orange-500/30 text-orange-400 hover:bg-orange-950/30' : 'border-green-500/30 text-green-400 hover:bg-green-950/30'} bg-transparent`}
                                onClick={() => handleToggleLive(item)}
                                disabled={!!processingId}
                            >
                                {item.isLive ? <Ban className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                                {item.isLive ? 'Take Offline' : 'Make Live'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 p-1">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Menu Approvals</h1>
                    <p className="text-muted-foreground text-lg">Review and manage restaurant menu submissions.</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-orange-900/20 to-black/40 border-orange-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(249,115,22,0.1)] group hover:shadow-[0_0_40px_rgba(249,115,22,0.2)] transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-orange-400 uppercase tracking-widest flex items-center gap-2">
                            <Clock className="h-4 w-4" /> Pending Review
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-foreground tracking-tight">{pendingItems.length}</div>
                        <p className="text-xs text-muted-foreground font-medium mt-1">Awaiting decision</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-900/20 to-black/40 border-green-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(34,197,94,0.1)] group hover:shadow-[0_0_40px_rgba(34,197,94,0.2)] transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-green-400 uppercase tracking-widest flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" /> Approved Items
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-foreground tracking-tight">{approvedItems.length}</div>
                        <p className="text-xs text-muted-foreground font-medium mt-1">Live on platform</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-red-900/20 to-black/40 border-red-500/20 backdrop-blur-md shadow-[0_0_30px_rgba(239,68,68,0.1)] group hover:shadow-[0_0_40px_rgba(239,68,68,0.2)] transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                            <XCircle className="h-4 w-4" /> Rejected Items
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-foreground tracking-tight">{rejectedItems.length}</div>
                        <p className="text-xs text-muted-foreground font-medium mt-1">Requires changes</p>
                    </CardContent>
                </Card>
            </div>

            <div className="bg-background/40 border border-border/50 rounded-xl p-6 backdrop-blur-xl shadow-2xl">
                <Tabs defaultValue="pending" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-card/50 p-1 mb-8 rounded-lg border border-border/50 h-14">
                        <TabsTrigger value="pending" className="data-[state=active]:bg-orange-500 data-[state=active]:text-foreground text-muted-foreground h-12 text-base transition-all">Pending Approval</TabsTrigger>
                        <TabsTrigger value="approved" className="data-[state=active]:bg-green-600 data-[state=active]:text-foreground text-muted-foreground h-12 text-base transition-all">Approved History</TabsTrigger>
                        <TabsTrigger value="rejected" className="data-[state=active]:bg-red-600 data-[state=active]:text-foreground text-muted-foreground h-12 text-base transition-all">Rejected History</TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending" className="space-y-6 m-0 focus-visible:ring-0 focus-visible:outline-none">
                        {loading ? (
                            <div className="text-center py-20 text-muted-foreground flex flex-col items-center">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mb-4"></div>
                                <p className="animate-pulse">Loading menu items...</p>
                            </div>
                        ) : pendingItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed border-border/50 rounded-xl bg-card/20">
                                <CheckCircle className="h-16 w-16 mb-4 text-muted-foreground" />
                                <p className="text-xl font-medium text-muted-foreground">All caught up!</p>
                                <p className="text-sm text-muted-foreground">No pending menu items to review.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {pendingItems.map(renderItemCard)}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="approved" className="space-y-6 m-0 focus-visible:ring-0 focus-visible:outline-none">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {approvedItems.map(renderItemCard)}
                        </div>
                    </TabsContent>

                    <TabsContent value="rejected" className="space-y-6 m-0 focus-visible:ring-0 focus-visible:outline-none">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {rejectedItems.map(renderItemCard)}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Approval Confirmation Dialog */}
            <AlertDialog open={!!approvingItem} onOpenChange={(open) => !open && setApprovingItem(null)}>
                <AlertDialogContent className="bg-card border-border/50 text-foreground">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-green-400">
                            <CheckCircle className="h-5 w-5" /> Confirm Approval
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            Are you sure you want to approve <strong>{approvingItem?.name}</strong>?
                            <br />
                            This item will become live on the app immediately.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-transparent border-border/50 text-muted-foreground hover:bg-secondary hover:text-foreground">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={executeApproval}
                            className="bg-green-600 hover:bg-green-700 text-foreground"
                        >
                            Approve Item
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Rejection Dialog */}
            <Dialog open={!!rejectingItem} onOpenChange={(open) => {
                if (!open) {
                    setRejectingItem(null);
                    setRejectionReason('');
                }
            }}>
                <DialogContent className="bg-card border-border/50 text-foreground sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-400">
                            <XCircle className="h-5 w-5" /> Reject Menu Item
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Please provide a reason for rejecting "{rejectingItem?.name}". This will be visible to the restaurant owner.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea
                            placeholder="Ex: Image quality is low, Price is invalid..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="bg-secondary border-border/50 text-foreground min-h-[100px] placeholder:text-muted-foreground focus-visible:ring-red-500"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRejectingItem(null)} className="text-muted-foreground hover:text-foreground hover:bg-secondary">
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleRejectConfirm}
                            disabled={!rejectionReason.trim()}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Reject Item
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Feedback Dialog (Success/Error) */}
            <Dialog open={!!feedback} onOpenChange={(open) => !open && setFeedback(null)}>
                <DialogContent className={`border text-foreground sm:max-w-[400px] ${feedback?.type === 'success' ? 'bg-card border-green-900' : 'bg-card border-red-900'
                    }`}>
                    <DialogHeader>
                        <DialogTitle className={`flex items-center gap-3 text-xl ${feedback?.type === 'success' ? 'text-green-400' : 'text-red-400'
                            }`}>
                            {feedback?.type === 'success' ? <CheckCircle className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                            {feedback?.title}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground pt-2 text-base leading-relaxed">
                            {feedback?.message}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="pt-4">
                        <Button
                            onClick={() => setFeedback(null)}
                            className={feedback?.type === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                        >
                            Dismiss
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function Ban(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <path d="m4.9 4.9 14.2 14.2" />
        </svg>
    );
}
