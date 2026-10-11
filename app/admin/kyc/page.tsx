'use client';

import { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, addDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, ShieldX, Eye, Video, VideoOff, Mic, MicOff,
  Phone, PhoneOff, FileText, User, Car, Calendar, CheckCircle2,
  XCircle, Clock, Search, Filter, CameraOff,
  AlertTriangle, ChevronRight, ExternalLink, X,
  RefreshCw, ZoomIn
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import KycVideoCall from '@/components/kyc/KycVideoCall';

interface KycApplication {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  vehicle?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  vehicleImage?: string;
  drivingLicense?: string;
  aadharFront?: string;
  aadharBack?: string;
  panCard?: string;
  selfie?: string;
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  kycStatus?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt?: any;
}

const DOC_LABELS: Record<string, string> = {
  vehicleImage: 'Vehicle RC / Photo',
  drivingLicense: 'Driving License',
  aadharFront: 'Aadhaar (Front)',
  aadharBack: 'Aadhaar (Back)',
  panCard: 'PAN Card',
  selfie: 'Selfie with ID',
};

export default function AdminKycPage() {
  const [applications, setApplications] = useState<KycApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selected, setSelected] = useState<KycApplication | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [docViewer, setDocViewer] = useState<{ url: string; title: string } | null>(null);
  const [vkycRequests, setVkycRequests] = useState<Record<string, any>>({});

  // WebRTC
  const [callOpen, setCallOpen] = useState(false);

  useEffect(() => {
    let unsubDelivery: () => void = () => {};
    let unsubVkyc: () => void = () => {};

    try {
      // 1. Delivery Persons Query with graceful error callback
      const q = query(collection(db, 'deliveryPersons'));
      unsubDelivery = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as KycApplication));
          // Safe client-side sorting by creation timestamp
          list.sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const timeB = b.createdAt?.toMillis?.() || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return timeB - timeA;
          });
          setApplications(list);
          setLoading(false);
        },
        (error) => {
          console.warn('[KYC] deliveryPersons listener notice:', error.message || error);
          setLoading(false);
        }
      );
    } catch (err) {
      console.warn('[KYC] Error subscribing to deliveryPersons:', err);
      setLoading(false);
    }

    try {
      // 2. Video KYC Requests with explicit error handler preventing uncaught console errors
      const qVkyc = query(collection(db, 'vkyc_requests'));
      unsubVkyc = onSnapshot(
        qVkyc,
        (snap) => {
          const requests: Record<string, any> = {};
          snap.forEach((d) => {
            requests[d.id] = d.data();
          });
          setVkycRequests(requests);
        },
        (error) => {
          // Gracefully suppress permission warning if vkyc collection is not yet provisioned
          console.warn('[KYC] vkyc_requests listener notice (non-fatal):', error.message || error);
        }
      );
    } catch (err) {
      console.warn('[KYC] Error subscribing to vkyc_requests:', err);
    }

    return () => {
      unsubDelivery();
      unsubVkyc();
    };
  }, []);

  const getStatus = (app: KycApplication) => app.kycStatus || app.verificationStatus || 'pending';

  const filtered = applications.filter(a => {
    const s = getStatus(a);
    const matchSearch = !search || a.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.email?.toLowerCase().includes(search.toLowerCase()) || a.phone?.includes(search);
    const matchFilter = filter === 'all' || s === filter;
    return matchSearch && matchFilter;
  });

  const approveKyc = async (id: string) => {
    setApproving(true);
    try {
      await updateDoc(doc(db, 'deliveryPersons', id), {
        verificationStatus: 'approved', kycStatus: 'approved',
        kycApprovedAt: serverTimestamp(), isVerified: true,
      });
      await addDoc(collection(db, 'notifications'), {
        userId: id, userType: 'delivery', type: 'kyc',
        title: 'KYC Approved!',
        message: 'Congratulations! Your KYC has been approved. You can now start accepting deliveries.',
        isRead: false, createdAt: serverTimestamp(),
      });
      toast.success('KYC Approved!'); setDetailOpen(false); setSelected(null);
    } catch { toast.error('Failed to approve'); }
    finally { setApproving(false); }
  };

  const rejectKyc = async (id: string) => {
    if (!rejectionReason.trim()) { toast.error('Please provide rejection reason'); return; }
    setRejecting(true);
    try {
      await updateDoc(doc(db, 'deliveryPersons', id), {
        verificationStatus: 'rejected', kycStatus: 'rejected',
        rejectionReason: rejectionReason.trim(), kycRejectedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'notifications'), {
        userId: id, userType: 'delivery', type: 'kyc',
        title: 'KYC Rejected',
        message: `Your KYC was rejected. Reason: ${rejectionReason.trim()}. Please resubmit correct documents.`,
        isRead: false, createdAt: serverTimestamp(),
      });
      toast.success('KYC Rejected'); setDetailOpen(false); setSelected(null); setRejectionReason('');
    } catch { toast.error('Failed to reject'); }
    finally { setRejecting(false); }
  };

  const startVideoCall = async () => {
    if (!selected) return;
    setCallOpen(true);

    // 1. Initialize calling session in Firestore
    try {
      await setDoc(
        doc(db, 'kycVideoCalls', selected.id),
        {
          callId: selected.id,
          deliveryPersonId: selected.id,
          deliveryPersonName: selected.name || 'Delivery Partner',
          adminName: 'Hunger Admin Desk',
          caller: 'admin',
          status: 'calling',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('[KYC] Call init notice:', e);
    }

    // 2. Add in-app notification
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: selected.id,
        userType: 'delivery',
        type: 'vkyc_call',
        title: '📞 Live Video KYC Call',
        message: 'Hunger Admin Desk is calling for your Live Video KYC verification. Tap to answer.',
        isRead: false,
        createdAt: serverTimestamp(),
      });
    } catch (_) {}

    // 3. Dispatch FCM Push Notification to Delivery Partner's Android device
    try {
      fetch('/api/notifications/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selected.id,
          role: 'delivery',
          title: '📞 Live Video KYC Call Incoming',
          body: 'Hunger Admin Desk is calling for Live Video KYC Verification. Tap to connect now!',
          data: {
            type: 'vkyc_call',
            callId: selected.id,
            adminName: 'Hunger Admin Desk',
            action: 'open_vkyc_call',
          },
        }),
      }).catch((e) => console.warn('[KYC] FCM Push notice:', e));
    } catch (_) {}

    toast.info(`Calling ${selected.name} for Live Video KYC...`);
  };

  const stats = { total: applications.length, pending: applications.filter(a => getStatus(a)==='pending').length, approved: applications.filter(a => getStatus(a)==='approved').length, rejected: applications.filter(a => getStatus(a)==='rejected').length };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-md shadow-violet-500/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span>KYC Verification</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Review, verify identity documents, and approve delivery partner onboardings.
          </p>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search rider name, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 rounded-xl bg-background border-border text-foreground placeholder:text-muted-foreground w-64 text-sm font-medium focus:border-violet-500"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="h-10 rounded-xl bg-background border-border text-foreground w-36 text-sm font-semibold">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              <SelectItem value="all">All Applications</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 4 Stat Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Applicants', value: stats.total, icon: User, color: 'from-blue-600 to-indigo-600', textColor: 'text-blue-600 dark:text-blue-400' },
          { label: 'Pending Review', value: stats.pending, icon: Clock, color: 'from-amber-500 to-orange-600', textColor: 'text-amber-600 dark:text-amber-400' },
          { label: 'Approved KYC', value: stats.approved, icon: CheckCircle2, color: 'from-emerald-500 to-teal-600', textColor: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Rejected Documents', value: stats.rejected, icon: XCircle, color: 'from-rose-500 to-red-600', textColor: 'text-rose-600 dark:text-rose-400' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="rounded-2xl border-border bg-card shadow-xs hover:shadow-md transition-all">
              <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl sm:text-3xl font-black font-mono mt-1 ${s.textColor}`}>{s.value}</p>
                </div>
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shrink-0 shadow-sm`}>
                  <s.icon className="w-5 h-5 text-white" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Applications Table / List Card */}
      <Card className="bg-card border-border shadow-md rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground text-base font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-violet-500" />
              <span>Applications ({filtered.length})</span>
            </CardTitle>
            <Badge variant="outline" className="border-border text-xs font-medium text-muted-foreground">
              Filter: {filter.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-8 h-8 text-violet-500 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
                <ShieldCheck className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-foreground font-semibold">No applications found</p>
              <p className="text-muted-foreground text-xs mt-1">There are no delivery partners matching the selected filter.</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map((app, i) => {
                const status = getStatus(app);
                return (
                  <motion.div
                    key={app.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="flex items-center gap-4 px-6 py-4 border-b border-border hover:bg-muted/40 transition-colors cursor-pointer group"
                    onClick={() => {
                      setSelected(app);
                      setDetailOpen(true);
                    }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-xs">
                      {app.name?.charAt(0)?.toUpperCase() || 'D'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-bold text-sm truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                        {app.name}
                      </p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {app.phone || 'No phone'} • {app.vehicleType || app.vehicle || 'Vehicle details pending'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Badge
                        className={`text-xs font-bold px-2.5 py-0.5 border ${
                          status === 'approved'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : status === 'rejected'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending'}
                      </Badge>

                      {vkycRequests[app.id] && status === 'pending' && (
                        <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 text-xs font-bold">
                          V-KYC Booked
                        </Badge>
                      )}

                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-xl font-black text-foreground">
              <ShieldCheck className="w-6 h-6 text-violet-500" />
              <span>KYC Review: {selected?.name}</span>
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-6 mt-2">
              <div className="flex items-center gap-3">
                <Badge
                  className={`px-3 py-1 text-xs font-bold border ${
                    getStatus(selected) === 'approved'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : getStatus(selected) === 'rejected'
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  }`}
                >
                  {getStatus(selected) === 'approved'
                    ? 'Approved'
                    : getStatus(selected) === 'rejected'
                    ? 'Rejected'
                    : 'Pending Review'}
                </Badge>
                {selected.rejectionReason && (
                  <span className="text-rose-600 dark:text-rose-400 text-xs font-medium">
                    Reason: {selected.rejectionReason}
                  </span>
                )}
              </div>

              {/* Applicant Metadata Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Full Name', value: selected.name },
                  { label: 'Mobile Number', value: selected.phone },
                  { label: 'Email Address', value: selected.email },
                  { label: 'Vehicle Type', value: selected.vehicleType || selected.vehicle },
                  { label: 'Vehicle Number', value: selected.vehicleNumber },
                  {
                    label: 'Application Date',
                    value: selected.createdAt?.toDate?.()
                      ? selected.createdAt.toDate().toLocaleDateString()
                      : 'Recently submitted',
                  },
                ].map((item) => (
                  <div key={item.label} className="bg-muted/40 rounded-xl p-3 border border-border">
                    <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider mb-1">
                      {item.label}
                    </p>
                    <p className="text-foreground text-sm font-semibold truncate">{item.value || '—'}</p>
                  </div>
                ))}
              </div>

              {/* Submitted Documents Section */}
              <div>
                <h3 className="text-foreground font-bold text-sm mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-violet-500" />
                  <span>Submitted Identification Documents</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(DOC_LABELS).map(([key, label]) => {
                    const url = (selected as any)[key];
                    return (
                      <div
                        key={key}
                        className={`rounded-xl border p-3 transition-all ${
                          url
                            ? 'border-violet-500/30 bg-violet-500/5 hover:border-violet-500/50'
                            : 'border-border bg-muted/20'
                        }`}
                      >
                        <p className="text-muted-foreground text-xs font-medium mb-2">{label}</p>
                        {url ? (
                          <button
                            type="button"
                            onClick={() => setDocViewer({ url, title: label })}
                            className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 text-xs font-bold cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Document</span>
                            <ExternalLink className="w-3 h-3 ml-0.5" />
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            <span>Not submitted</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live WebRTC Video Call Section */}
              <div className="bg-gradient-to-r from-blue-900/10 via-violet-900/10 to-indigo-900/10 rounded-2xl p-4.5 border border-blue-500/25">
                <h3 className="text-foreground font-bold text-sm mb-1.5 flex items-center gap-2">
                  <Video className="w-4 h-4 text-blue-500" />
                  <span>Live Video Verification (WebRTC)</span>
                </h3>

                {vkycRequests[selected.id] && (
                  <div className="mb-3.5 p-3 bg-blue-500/10 rounded-xl border border-blue-500/30 flex justify-between items-center">
                    <div>
                      <p className="text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-0.5">
                        Requested V-KYC Slot
                      </p>
                      <p className="text-foreground text-xs font-semibold">
                        {vkycRequests[selected.id].requestedDate} at {vkycRequests[selected.id].requestedTimeSlot}
                      </p>
                    </div>
                    <Badge className="bg-blue-600 text-white font-bold text-xs">Pending Call</Badge>
                  </div>
                )}

                <p className="text-muted-foreground text-xs mb-3.5">
                  Conduct a live two-way encrypted video stream to verify the applicant and validate physical credentials in real-time.
                </p>
                <Button
                  onClick={startVideoCall}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 text-xs h-9 rounded-xl shadow-md cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                  <span>Accept & Connect with Partner</span>
                </Button>
              </div>

              {/* Review Actions: Pending */}
              {getStatus(selected) === 'pending' && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <Textarea
                    placeholder="Enter rejection reason (required if rejecting applicant)..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground resize-none rounded-xl text-xs font-medium"
                    rows={3}
                  />
                  <div className="flex gap-3">
                    <Button
                      onClick={() => approveKyc(selected.id)}
                      disabled={approving}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 rounded-xl shadow-md cursor-pointer"
                    >
                      {approving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>Approve KYC</span>
                    </Button>
                    <Button
                      onClick={() => rejectKyc(selected.id)}
                      disabled={rejecting}
                      variant="outline"
                      className="flex-1 border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-bold gap-2 rounded-xl cursor-pointer"
                    >
                      {rejecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      <span>Reject KYC</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Review Actions: Already Approved or Rejected */}
              {getStatus(selected) !== 'pending' && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <Textarea
                    placeholder="Enter updated audit notes or new rejection reason..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground resize-none rounded-xl text-xs font-medium"
                    rows={2}
                  />
                  <div className="flex gap-3">
                    <Button
                      onClick={() => approveKyc(selected.id)}
                      disabled={approving || getStatus(selected) === 'approved'}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Re-Approve</span>
                    </Button>
                    <Button
                      onClick={() => rejectKyc(selected.id)}
                      disabled={rejecting}
                      variant="outline"
                      className="border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-bold gap-2 rounded-xl cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Document Viewer Modal */}
      <Dialog open={!!docViewer} onOpenChange={() => setDocViewer(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-2xl rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold text-foreground">
              <ZoomIn className="w-5 h-5 text-violet-500" />
              <span>{docViewer?.title}</span>
            </DialogTitle>
          </DialogHeader>
          {docViewer && (
            <div className="flex flex-col items-center mt-3">
              <img
                src={docViewer.url}
                alt={docViewer.title}
                className="max-w-full max-h-[70vh] object-contain rounded-xl border border-border shadow-xs"
              />
              <a
                href={docViewer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 flex items-center gap-1.5 text-xs font-bold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open high-res original in new tab</span>
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* WebRTC Video Call */}
      {selected && (
        <KycVideoCall
          isOpen={callOpen}
          onClose={() => setCallOpen(false)}
          role="admin"
          deliveryPersonId={selected.id}
          deliveryPersonName={selected.name}
          onKycApproved={() => {
            setDetailOpen(false);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
