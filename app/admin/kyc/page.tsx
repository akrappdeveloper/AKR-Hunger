'use client';

import { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
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
    const q = query(collection(db, 'deliveryPersons'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setApplications(snap.docs.map(d => ({ id: d.id, ...d.data() } as KycApplication)));
      setLoading(false);
    }, () => setLoading(false));

    const qVkyc = query(collection(db, 'vkyc_requests'));
    const unsubVkyc = onSnapshot(qVkyc, snap => {
      const requests: Record<string, any> = {};
      snap.forEach(d => { requests[d.id] = d.data(); });
      setVkycRequests(requests);
    });

    return () => { unsub(); unsubVkyc(); };
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

  const startVideoCall = () => {
    setCallOpen(true);
  };

  const stats = { total: applications.length, pending: applications.filter(a => getStatus(a)==='pending').length, approved: applications.filter(a => getStatus(a)==='approved').length, rejected: applications.filter(a => getStatus(a)==='rejected').length };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-foreground" /></div>
            KYC Verification
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Review and approve delivery partner KYC documents</p>
        </div>
        <div className="flex gap-3">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card/5 border-border/50 text-foreground placeholder:text-muted-foreground w-60" /></div>
          <Select value={filter} onValueChange={v => setFilter(v as any)}>
            <SelectTrigger className="bg-card/5 border-border/50 text-foreground w-36"><Filter className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-border/50 text-foreground"><SelectItem value="all">All</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[{label:'Total',value:stats.total,icon:User,color:'from-blue-600 to-indigo-600'},{label:'Pending',value:stats.pending,icon:Clock,color:'from-amber-500 to-orange-600'},{label:'Approved',value:stats.approved,icon:CheckCircle2,color:'from-emerald-500 to-teal-600'},{label:'Rejected',value:stats.rejected,icon:XCircle,color:'from-rose-500 to-red-600'}].map((s,i) => (
          <motion.div key={s.label} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:i*0.1}}>
            <Card className="bg-card/5 border-border/50"><CardContent className="p-4 flex items-center gap-3"><div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center flex-shrink-0`}><s.icon className="w-5 h-5 text-foreground" /></div><div><p className="text-2xl font-black text-foreground">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div></CardContent></Card>
          </motion.div>
        ))}
      </div>

      <Card className="bg-card/5 border-border/50">
        <CardHeader className="border-b border-border/50 pb-4"><CardTitle className="text-foreground flex items-center gap-2"><FileText className="w-4 h-4 text-violet-400" />Applications ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (<div className="flex items-center justify-center py-20"><RefreshCw className="w-8 h-8 text-violet-400 animate-spin" /></div>) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16"><ShieldCheck className="w-12 h-12 text-muted-foreground mb-3" /><p className="text-muted-foreground">No applications found</p></div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map((app, i) => {
                const status = getStatus(app);
                return (
                  <motion.div key={app.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.03}} className="flex items-center gap-4 px-6 py-4 border-b border-border/50 hover:bg-card/5 transition-colors cursor-pointer group" onClick={() => { setSelected(app); setDetailOpen(true); }}>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600/30 to-purple-700/30 flex items-center justify-center text-foreground font-bold border border-violet-500/20 flex-shrink-0">{app.name?.charAt(0)?.toUpperCase() || 'D'}</div>
                    <div className="flex-1 min-w-0"><p className="text-foreground font-semibold text-sm truncate">{app.name}</p><p className="text-muted-foreground text-xs">{app.phone} • {app.vehicleType || app.vehicle || 'Vehicle N/A'}</p></div>
                    <div className="flex items-center gap-3">
                      <Badge className={status==='approved'?'bg-emerald-500/20 text-emerald-400 border-emerald-500/30':status==='rejected'?'bg-rose-500/20 text-rose-400 border-rose-500/30':'bg-amber-500/20 text-amber-400 border-amber-500/30'}>{status==='approved'?'Approved':status==='rejected'?'Rejected':'Pending'}</Badge>
                      {vkycRequests[app.id] && status==='pending' && (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">V-KYC Booked</Badge>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
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
        <DialogContent className="bg-background border-border/50 text-foreground max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-3 text-xl"><ShieldCheck className="w-6 h-6 text-violet-400" />KYC Review: {selected?.name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Badge className={getStatus(selected)==='approved'?'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 px-3 py-1':getStatus(selected)==='rejected'?'bg-rose-500/20 text-rose-400 border-rose-500/30 px-3 py-1':'bg-amber-500/20 text-amber-400 border-amber-500/30 px-3 py-1'}>
                  {getStatus(selected)==='approved'?'Approved':getStatus(selected)==='rejected'?'Rejected':'Pending Review'}
                </Badge>
                {selected.rejectionReason && <span className="text-rose-400 text-sm">Reason: {selected.rejectionReason}</span>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[{label:'Name',value:selected.name},{label:'Phone',value:selected.phone},{label:'Email',value:selected.email},{label:'Vehicle',value:selected.vehicleType||selected.vehicle},{label:'Vehicle No.',value:selected.vehicleNumber},{label:'Applied',value:selected.createdAt?.toDate?.()?selected.createdAt.toDate().toLocaleDateString():'N/A'}].map(item => (
                  <div key={item.label} className="bg-card/5 rounded-xl p-3 border border-border/50"><p className="text-muted-foreground text-xs mb-1">{item.label}</p><p className="text-foreground text-sm font-medium">{item.value||'—'}</p></div>
                ))}
              </div>
              <div>
                <h3 className="text-foreground font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-violet-400" />Submitted Documents</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(DOC_LABELS).map(([key, label]) => {
                    const url = (selected as any)[key];
                    return (
                      <div key={key} className={`rounded-xl border ${url?'border-violet-500/30 bg-violet-500/5':'border-border/50 bg-card/5'} p-3`}>
                        <p className="text-muted-foreground text-xs mb-2">{label}</p>
                        {url ? (<button onClick={() => setDocViewer({url,title:label})} className="flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm font-medium"><Eye className="w-4 h-4" />View<ExternalLink className="w-3 h-3" /></button>) : (<span className="text-muted-foreground text-sm flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500" />Not submitted</span>)}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-gradient-to-r from-blue-900/30 to-violet-900/30 rounded-2xl p-4 border border-blue-500/20">
                <h3 className="text-foreground font-semibold mb-2 flex items-center gap-2"><Video className="w-4 h-4 text-blue-400" />Live Video Verification (WebRTC)</h3>
                
                {vkycRequests[selected.id] && (
                  <div className="mb-4 p-3 bg-blue-950/50 rounded-xl border border-blue-500/30 flex justify-between items-center">
                    <div>
                      <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider mb-1">Requested Slot</p>
                      <p className="text-foreground font-medium">{vkycRequests[selected.id].requestedDate} at {vkycRequests[selected.id].requestedTimeSlot}</p>
                    </div>
                    <Badge className="bg-blue-600 text-white">Pending Call</Badge>
                  </div>
                )}

                <p className="text-muted-foreground text-sm mb-3">Conduct a live video call to verify the applicant identity in real-time. Accept the V-KYC connection.</p>
                <Button onClick={startVideoCall} className="bg-blue-600 hover:bg-blue-700 text-foreground gap-2"><Video className="w-4 h-4" />Accept & Connect with Partner</Button>
              </div>
              {getStatus(selected) === 'pending' && (
                <div className="space-y-3">
                  <Textarea placeholder="Rejection reason (required if rejecting)..." value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} className="bg-card/5 border-border/50 text-foreground placeholder:text-muted-foreground resize-none" rows={3} />
                  <div className="flex gap-3">
                    <Button onClick={() => approveKyc(selected.id)} disabled={approving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-foreground gap-2">{approving?<RefreshCw className="w-4 h-4 animate-spin" />:<CheckCircle2 className="w-4 h-4" />}Approve KYC</Button>
                    <Button onClick={() => rejectKyc(selected.id)} disabled={rejecting} variant="outline" className="flex-1 border-rose-500/50 text-rose-400 hover:bg-rose-500/10 gap-2">{rejecting?<RefreshCw className="w-4 h-4 animate-spin" />:<XCircle className="w-4 h-4" />}Reject KYC</Button>
                  </div>
                </div>
              )}
              {getStatus(selected) !== 'pending' && (
                <div className="space-y-3">
                  <Textarea placeholder="New rejection reason..." value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} className="bg-card/5 border-border/50 text-foreground placeholder:text-muted-foreground resize-none" rows={2} />
                  <div className="flex gap-3">
                    <Button onClick={() => approveKyc(selected.id)} disabled={approving||getStatus(selected)==='approved'} className="bg-emerald-600 hover:bg-emerald-700 text-foreground gap-2 disabled:opacity-50"><CheckCircle2 className="w-4 h-4" />Re-Approve</Button>
                    <Button onClick={() => rejectKyc(selected.id)} disabled={rejecting} variant="outline" className="border-rose-500/50 text-rose-400 hover:bg-rose-500/10 gap-2"><XCircle className="w-4 h-4" />Reject</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Document Viewer */}
      <Dialog open={!!docViewer} onOpenChange={() => setDocViewer(null)}>
        <DialogContent className="bg-background border-border/50 text-foreground max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ZoomIn className="w-5 h-5 text-violet-400" />{docViewer?.title}</DialogTitle></DialogHeader>
          {docViewer && (
            <div className="flex flex-col items-center">
              <img src={docViewer.url} alt={docViewer.title} className="max-w-full max-h-[70vh] object-contain rounded-xl border border-border/50" />
              <a href={docViewer.url} target="_blank" rel="noopener noreferrer" className="mt-4 text-violet-400 hover:text-violet-300 flex items-center gap-2 text-sm"><ExternalLink className="w-4 h-4" />Open in new tab</a>
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
        />
      )}
    </div>
  );
}
