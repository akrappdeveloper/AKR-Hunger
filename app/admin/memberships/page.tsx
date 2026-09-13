'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MembershipRequest, IssuedCard, Customer } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  IdCard, Users, CheckCircle, XCircle, Clock, CreditCard,
  Search, Shield, Award, AlertCircle, Ban, Eye, Edit2, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { serverTimestamp } from 'firebase/firestore';
import EditIssuedCardDialog from '@/components/admin/EditIssuedCardDialog';

export default function AdminMembershipsPage() {
  const [requests, setRequests] = useState<MembershipRequest[]>([]);
  const [cards, setCards] = useState<IssuedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MembershipRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailRequest, setDetailRequest] = useState<MembershipRequest | null>(null);
  const [selectedCardToEdit, setSelectedCardToEdit] = useState<IssuedCard | null>(null);
  const [editCardDialogOpen, setEditCardDialogOpen] = useState(false);

  useEffect(() => {
    const unsubRequests = onSnapshot(
      query(collection(db, 'membershipRequests'), orderBy('createdAt', 'desc')),
      (snap) => {
        const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id })) as MembershipRequest[];
        setRequests(data);
        setLoading(false);
      },
      (error) => {
        console.warn("Snapshot listener notice for membershipRequests:", error.message);
        setLoading(false);
      }
    );

    const unsubCards = onSnapshot(
      collection(db, 'issuedCards'),
      (snap) => {
        const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id })) as IssuedCard[];
        setCards(data);
      },
      (error) => {
        console.warn("Snapshot listener notice for issuedCards:", error.message);
      }
    );

    return () => {
      unsubRequests();
      unsubCards();
    };
  }, []);

  const handleApprove = async (request: MembershipRequest) => {
    try {
      // Update request status
      try {
        await updateDoc(doc(db, 'membershipRequests', request.id), {
          status: 'approved',
          approvedAt: serverTimestamp(),
        });
      } catch {
        await updateDoc(doc(db, 'membership_requests', request.id), {
          status: 'approved',
          approvedAt: serverTimestamp(),
        });
      }

      // Update customer membership status
      await updateDoc(doc(db, 'customers', request.customerId), {
        membershipStatus: 'approved',
        membershipId: request.id,
      });

      toast.success(`Membership approved for ${request.customerName}`);
    } catch (err) {
      toast.error('Failed to approve membership');
      console.error(err);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    try {
      try {
        await updateDoc(doc(db, 'membershipRequests', selectedRequest.id), {
          status: 'rejected',
          rejectedAt: serverTimestamp(),
          rejectionReason,
        });
      } catch {
        await updateDoc(doc(db, 'membership_requests', selectedRequest.id), {
          status: 'rejected',
          rejectedAt: serverTimestamp(),
          rejectionReason,
        });
      }

      await updateDoc(doc(db, 'customers', selectedRequest.customerId), {
        membershipStatus: 'rejected',
      });

      toast.success(`Membership rejected for ${selectedRequest.customerName}`);
      setRejectDialogOpen(false);
      setRejectionReason('');
    } catch (err) {
      toast.error('Failed to reject membership');
    }
  };

  const handleBlockCard = async (card: IssuedCard) => {
    try {
      const newStatus = card.status === 'active' ? 'blocked' : 'active';
      try {
        await updateDoc(doc(db, 'issuedCards', card.id), {
          status: newStatus,
        });
      } catch {
        await updateDoc(doc(db, 'issued_cards', card.id), {
          status: newStatus,
        });
      }
      toast.success(`Card ${newStatus === 'blocked' ? 'blocked' : 'unblocked'}`);
    } catch (err) {
      toast.error('Failed to update card status');
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved');
  const rejectedRequests = requests.filter(r => r.status === 'rejected');
  const activeCards = cards.filter(c => c.status === 'active');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'approved': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'rejected': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getCardStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'blocked': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'expired': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400">Loading memberships...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-gray-400 tracking-tight mb-2">
          Membership Management
        </h1>
        <p className="text-gray-400">Manage membership requests, approvals, and issued cards.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { title: 'Total Requests', value: requests.length, icon: IdCard, color: 'blue' },
          { title: 'Pending', value: pendingRequests.length, icon: Clock, color: 'yellow' },
          { title: 'Approved', value: approvedRequests.length, icon: CheckCircle, color: 'emerald' },
          { title: 'Rejected', value: rejectedRequests.length, icon: XCircle, color: 'red' },
          { title: 'Active Cards', value: activeCards.length, icon: CreditCard, color: 'purple' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          const colors: Record<string, string> = {
            blue: 'from-blue-600/20 to-blue-600/5 border-blue-500/20',
            yellow: 'from-yellow-600/20 to-yellow-600/5 border-yellow-500/20',
            emerald: 'from-emerald-600/20 to-emerald-600/5 border-emerald-500/20',
            red: 'from-red-600/20 to-red-600/5 border-red-500/20',
            purple: 'from-purple-600/20 to-purple-600/5 border-purple-500/20',
          };
          const iconColors: Record<string, string> = {
            blue: 'text-blue-400', yellow: 'text-yellow-400', emerald: 'text-emerald-400',
            red: 'text-red-400', purple: 'text-purple-400',
          };
          return (
            <Card key={i} className={`bg-gradient-to-br ${colors[stat.color]} border backdrop-blur-md shadow-xl`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <Icon className={`w-5 h-5 ${iconColors[stat.color]}`} />
                </div>
                <p className="text-2xl font-bold text-white font-mono">{stat.value}</p>
                <p className="text-[11px] text-gray-400 mt-1">{stat.title}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10 p-1">
          <TabsTrigger value="pending" className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-400 text-gray-400 gap-2">
            <Clock size={14} /> Pending ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-400 text-gray-400 gap-2">
            <IdCard size={14} /> All Requests
          </TabsTrigger>
          <TabsTrigger value="cards" className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-400 text-gray-400 gap-2">
            <CreditCard size={14} /> Issued Cards
          </TabsTrigger>
        </TabsList>

        {/* Pending Requests */}
        <TabsContent value="pending">
          <Card className="bg-black/40 border-white/10 backdrop-blur-md shadow-xl overflow-hidden">
            <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-400" />
                Pending Membership Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No pending requests</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="p-5 hover:bg-white/5 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-600/20 to-orange-600/20 flex items-center justify-center border border-white/5">
                            <IdCard className="w-5 h-5 text-yellow-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{req.customerName}</p>
                            <p className="text-gray-500 text-sm">{req.customerEmail}</p>
                            {req.contactNumber && (
                              <p className="text-gray-600 text-xs mt-0.5">📞 {req.contactNumber}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {req.bankDetails && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setDetailRequest(req); setDetailDialogOpen(true); }}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 gap-1"
                            >
                              <Eye size={14} /> Details
                            </Button>
                          )}
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(req)}
                              className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600/30 gap-1"
                            >
                              <CheckCircle size={14} /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setSelectedRequest(req); setRejectDialogOpen(true); }}
                              className="border-red-500/20 text-red-400 hover:bg-red-500/10 gap-1"
                            >
                              <XCircle size={14} /> Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Requests */}
        <TabsContent value="all">
          <Card className="bg-black/40 border-white/10 backdrop-blur-md shadow-xl overflow-hidden">
            <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                  <IdCard className="w-5 h-5 text-blue-400" />
                  All Membership Requests
                </CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-black/20 border-white/10 text-white placeholder:text-gray-500 w-48"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-gray-400">Customer</TableHead>
                      <TableHead className="text-gray-400">Email</TableHead>
                      <TableHead className="text-gray-400">Contact</TableHead>
                      <TableHead className="text-gray-400 text-center">Status</TableHead>
                      <TableHead className="text-gray-400">Date</TableHead>
                      <TableHead className="text-gray-400 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests
                      .filter(r => searchQuery === '' || r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || r.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((req) => (
                        <TableRow key={req.id} className="border-white/5 hover:bg-white/5 transition-colors">
                          <TableCell className="text-white font-medium text-sm">{req.customerName}</TableCell>
                          <TableCell className="text-gray-300 text-sm">{req.customerEmail}</TableCell>
                          <TableCell className="text-gray-300 text-sm">{req.contactNumber || '-'}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={`text-xs capitalize ${getStatusColor(req.status)}`}>
                              {req.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-400 text-sm">
                            {(req.createdAt as any)?.toDate ? (req.createdAt as any).toDate().toLocaleDateString() : (req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '-')}
                          </TableCell>
                          <TableCell className="text-center">
                            {req.status === 'pending' && (
                              <div className="flex items-center justify-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => handleApprove(req)} className="text-emerald-400 hover:bg-emerald-500/10 h-8 w-8 p-0">
                                  <CheckCircle size={14} />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => { setSelectedRequest(req); setRejectDialogOpen(true); }} className="text-red-400 hover:bg-red-500/10 h-8 w-8 p-0">
                                  <XCircle size={14} />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Issued Cards */}
        <TabsContent value="cards">
          <Card className="bg-black/40 border-white/10 backdrop-blur-md shadow-xl overflow-hidden">
            <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-400" />
                Issued Membership Cards
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {cards.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No cards issued yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/5 hover:bg-transparent">
                        <TableHead className="text-gray-400">Customer</TableHead>
                        <TableHead className="text-gray-400">Card Number</TableHead>
                        <TableHead className="text-gray-400 text-center">Status</TableHead>
                        <TableHead className="text-gray-400">Issued Date</TableHead>
                        <TableHead className="text-gray-400 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cards.map((card) => (
                        <TableRow
                          key={card.id}
                          onClick={() => {
                            setSelectedCardToEdit(card);
                            setEditCardDialogOpen(true);
                          }}
                          className="border-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
                        >
                          <TableCell className="text-white font-medium text-sm">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20 group-hover:scale-105 transition-transform">
                                <CreditCard className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-white font-semibold">{card.customerName}</p>
                                <span className="text-[11px] text-gray-500 font-mono">#{card.id.slice(0, 8)}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-300 font-mono text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-bold tracking-wider text-white">•••• •••• •••• {card.cardNumber?.slice(-4) || '****'}</span>
                              <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30 bg-blue-500/10 py-0 px-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                Click to Edit
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={`text-xs capitalize ${getCardStatusColor(card.status)}`}>
                              {card.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-400 text-sm">
                            {(card.issuedAt as any)?.toDate ? (card.issuedAt as any).toDate().toLocaleDateString() : (card.issuedAt ? new Date(card.issuedAt).toLocaleDateString() : '-')}
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedCardToEdit(card);
                                  setEditCardDialogOpen(true);
                                }}
                                className="h-8 gap-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/15"
                              >
                                <Edit2 size={12} /> Edit Details
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleBlockCard(card)}
                                className={`h-8 gap-1 text-xs ${card.status === 'active'
                                  ? 'text-red-400 hover:bg-red-500/10'
                                  : 'text-emerald-400 hover:bg-emerald-500/10'
                                  }`}
                              >
                                {card.status === 'active' ? <><Ban size={12} /> Block</> : <><CheckCircle size={12} /> Unblock</>}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="bg-gray-900 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400">Reject Membership</DialogTitle>
            <DialogDescription className="text-gray-400">
              Rejecting membership for {selectedRequest?.customerName}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Label className="text-gray-300 text-sm">Rejection Reason</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Provide a reason for rejection..."
              className="mt-1 bg-black/20 border-white/10 text-white min-h-[100px]"
            />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} className="border-white/10 text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Reject Membership
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="bg-gray-900 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
          </DialogHeader>
          {detailRequest && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Customer</p>
                  <p className="text-white font-medium text-sm">{detailRequest.customerName}</p>
                </div>
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Email</p>
                  <p className="text-white font-medium text-sm truncate">{detailRequest.customerEmail}</p>
                </div>
              </div>
              {detailRequest.bankDetails && (
                <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-2">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Bank Details</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Bank</p>
                      <p className="text-white">{detailRequest.bankDetails.bankName}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Account Holder</p>
                      <p className="text-white">{detailRequest.bankDetails.accountHolderName}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Account No.</p>
                      <p className="text-white font-mono">{detailRequest.bankDetails.accountNumber}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">IFSC</p>
                      <p className="text-white font-mono">{detailRequest.bankDetails.ifscCode}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reusable Edit Issued Card Dialog */}
      <EditIssuedCardDialog
        card={selectedCardToEdit}
        open={editCardDialogOpen}
        onOpenChange={setEditCardDialogOpen}
      />
    </div>
  );
}
