'use client';

import { useState, useEffect, useRef } from 'react';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  MapPin, Phone, Clock, Truck, ArrowLeft, Star, Package, TrendingUp,
  CheckCircle2, Loader2, Award, AlertCircle, ShieldCheck, ShieldX,
  Upload, FileText, Camera, Eye, RefreshCw, ChevronRight, User,
  Mail, Car, Wallet, Calendar, Edit3, Save, X, Info, Video, PhoneCall
} from 'lucide-react';
import { toast } from 'sonner';
import { uploadToCloudinary } from '@/lib/cloudinary';
import Image from 'next/image';
import KycVideoCall from '@/components/kyc/KycVideoCall';

const KYC_DOCS = [
  { key: 'aadharFront', label: 'Aadhaar Card (Front)', required: true, hint: 'Clear photo of front side' },
  { key: 'aadharBack', label: 'Aadhaar Card (Back)', required: true, hint: 'Clear photo of back side' },
  { key: 'drivingLicense', label: 'Driving License', required: true, hint: 'Valid driving license' },
  { key: 'vehicleImage', label: 'Vehicle RC / Photo', required: true, hint: 'Vehicle registration certificate' },
  { key: 'panCard', label: 'PAN Card', required: false, hint: 'Optional for tax purposes' },
  { key: 'selfie', label: 'Selfie with ID', required: false, hint: 'Hold ID card next to your face' },
];

export default function DeliveryProfilePage() {
  const { user } = useDeliveryAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'kyc' | 'stats'>('profile');

  // KYC state
  const [kycUploading, setKycUploading] = useState<Record<string, boolean>>({});
  const [kycFiles, setKycFiles] = useState<Record<string, File | null>>({});
  const [kycSubmitting, setKycSubmitting] = useState(false);
  const [docPreviews, setDocPreviews] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // WebRTC Video KYC
  const [videoCallOpen, setVideoCallOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'deliveryPersons', user.uid), snap => {
      if (snap.exists()) setProfile({ id: snap.id, ...snap.data() });
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // Listen for Live KYC Video calls from Admin
  useEffect(() => {
    if (!user) return;
    const callDocRef = doc(db, 'kycVideoCalls', user.uid);
    const unsub = onSnapshot(callDocRef, snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === 'calling' && data.caller === 'admin') {
          setIncomingCall(data);
        } else if (data.status === 'ended' || data.status === 'rejected') {
          setIncomingCall(null);
        }
      } else {
        setIncomingCall(null);
      }
    });
    return () => unsub();
  }, [user]);

  const handleDeclineIncomingCall = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'kycVideoCalls', user.uid), {
        status: 'ended',
        endedAt: serverTimestamp(),
      });
    } catch (_) {}
    setIncomingCall(null);
  };

  const getGrade = (rating: number) => {
    if (rating >= 4.8) return { grade: 'A+', color: 'text-emerald-400', label: 'Excellent', bg: 'from-emerald-500 to-teal-600' };
    if (rating >= 4.5) return { grade: 'A', color: 'text-blue-400', label: 'Very Good', bg: 'from-blue-500 to-indigo-600' };
    if (rating >= 4.0) return { grade: 'B', color: 'text-amber-400', label: 'Good', bg: 'from-amber-500 to-orange-600' };
    return { grade: 'C', color: 'text-rose-400', label: 'Needs Improvement', bg: 'from-rose-500 to-red-600' };
  };

  const getKycStatus = () => profile?.kycStatus || profile?.verificationStatus || 'pending';

  const getKycProgress = () => {
    if (!profile) return 0;
    const submitted = KYC_DOCS.filter(d => profile[d.key]).length;
    return Math.round((submitted / KYC_DOCS.length) * 100);
  };

  const handleFileSelect = (key: string, file: File) => {
    setKycFiles(prev => ({ ...prev, [key]: file }));
    const reader = new FileReader();
    reader.onload = e => setDocPreviews(prev => ({ ...prev, [key]: e.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const uploadDoc = async (key: string) => {
    const file = kycFiles[key];
    if (!file || !user) return;
    setKycUploading(prev => ({ ...prev, [key]: true }));
    try {
      const url = await uploadToCloudinary(file);
      await updateDoc(doc(db, 'deliveryPersons', user.uid), { [key]: url, kycUpdatedAt: serverTimestamp() });
      toast.success(`${KYC_DOCS.find(d => d.key === key)?.label} uploaded!`);
      setKycFiles(prev => ({ ...prev, [key]: null }));
    } catch { toast.error('Upload failed. Please try again.'); }
    finally { setKycUploading(prev => ({ ...prev, [key]: false })); }
  };

  const submitKyc = async () => {
    if (!user) return;
    const requiredDocs = KYC_DOCS.filter(d => d.required);
    const missing = requiredDocs.filter(d => !profile?.[d.key]);
    if (missing.length > 0) {
      toast.error(`Please upload: ${missing.map(d => d.label).join(', ')}`);
      return;
    }
    setKycSubmitting(true);
    try {
      await updateDoc(doc(db, 'deliveryPersons', user.uid), {
        verificationStatus: 'pending', kycStatus: 'pending',
        kycSubmittedAt: serverTimestamp(),
      });
      toast.success('KYC submitted for review! Admin will verify within 24-48 hours.');
    } catch { toast.error('Submission failed. Please try again.'); }
    finally { setKycSubmitting(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;
  if (!profile) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
      <h2 className="text-xl font-bold mb-2">Profile not found</h2>
      <p className="text-muted-foreground">Please complete your registration first</p>
    </div>
  );

  const rating = profile.averageRating || profile.rating || 0;
  const gradeInfo = getGrade(rating);
  const kycStatus = getKycStatus();
  const kycProgress = getKycProgress();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 pt-6 pb-20">
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
          <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-violet-300/30 blur-2xl" />
        </div>
        <div className="relative container max-w-2xl mx-auto px-4">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/70 hover:text-white mb-6 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-4xl flex-shrink-0 shadow-2xl">
              🛵
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-white">{profile.name || 'Delivery Partner'}</h1>
              <p className="text-white/60 text-sm mt-0.5">{profile.vehicleType || profile.vehicle || 'Bike'} • {profile.vehicleNumber || 'N/A'}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge className={`${profile.isAvailable ? 'bg-emerald-500' : 'bg-rose-500'} text-white border-0 text-xs`}>
                  {profile.isAvailable ? '🟢 Available' : '🔴 Offline'}
                </Badge>
                {kycStatus === 'approved' && <Badge className="bg-blue-500 text-white border-0 text-xs">✓ KYC Verified</Badge>}
                {kycStatus === 'pending' && <Badge className="bg-amber-500 text-white border-0 text-xs">⏳ KYC Pending</Badge>}
                {kycStatus === 'rejected' && <Badge className="bg-rose-600 text-white border-0 text-xs">✗ KYC Rejected</Badge>}
              </div>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-6 bg-white/10 rounded-2xl p-1">
            {(['profile','kyc','stats'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all capitalize ${activeTab===tab?'bg-white text-indigo-700 shadow-lg':'text-white/70 hover:text-white'}`}>
                {tab === 'kyc' ? 'KYC Docs' : tab.charAt(0).toUpperCase()+tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 -mt-10 space-y-5">

        {/* PROFILE TAB */}
        <AnimatePresence mode="wait">
          {activeTab === 'profile' && (
            <motion.div key="profile" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} className="space-y-4">
              <Card className="rounded-3xl border-0 shadow-xl">
                <CardContent className="p-6 space-y-3">
                  {[
                    { icon: User, label: 'Full Name', value: profile.name },
                    { icon: Phone, label: 'Phone', value: profile.phone },
                    { icon: Mail, label: 'Email', value: profile.email },
                    { icon: Car, label: 'Vehicle Type', value: profile.vehicleType || profile.vehicle },
                    { icon: Car, label: 'Vehicle Number', value: profile.vehicleNumber },
                    { icon: MapPin, label: 'City', value: profile.city },
                    { icon: Calendar, label: 'Joined', value: profile.createdAt?.toDate?.()?.toLocaleDateString?.() || 'N/A' },
                    {
                      icon: Wallet,
                      label: 'Wallet Balance',
                      value: profile.walletBalance != null
                        ? (Number(profile.walletBalance) < 0
                            ? `-₹${Math.abs(Number(profile.walletBalance)).toFixed(2)} (Pending Due)`
                            : Number(profile.walletBalance) === 0
                            ? '₹0.00 (All Clear)'
                            : `+₹${Number(profile.walletBalance).toFixed(2)} (Credit)`)
                        : '₹0.00'
                    },
                  ].filter(i => i.value).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-4 h-4 text-indigo-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="text-sm font-semibold">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Button onClick={() => router.push('/delivery/settings')} className="w-full h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white gap-2 shadow-lg shadow-blue-500/20">
                <Edit3 className="w-4 h-4" /> Edit Profile & Settings
              </Button>
            </motion.div>
          )}

          {/* KYC TAB */}
          {activeTab === 'kyc' && (
            <motion.div key="kyc" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} className="space-y-4">
              {/* KYC Status Card */}
              <Card className={`rounded-3xl border-0 shadow-xl overflow-hidden`}>
                <div className={`p-5 ${kycStatus==='approved'?'bg-gradient-to-r from-emerald-600 to-teal-600':kycStatus==='rejected'?'bg-gradient-to-r from-rose-600 to-red-700':'bg-gradient-to-r from-amber-500 to-orange-600'}`}>
                  <div className="flex items-center gap-3">
                    {kycStatus==='approved' ? <ShieldCheck className="w-8 h-8 text-white" /> : kycStatus==='rejected' ? <ShieldX className="w-8 h-8 text-white" /> : <ShieldCheck className="w-8 h-8 text-white/70" />}
                    <div>
                      <p className="text-white font-black text-lg">{kycStatus==='approved'?'KYC Verified!':kycStatus==='rejected'?'KYC Rejected':'KYC Pending Review'}</p>
                      <p className="text-white/80 text-sm">{kycStatus==='approved'?'Your identity is verified. You can accept deliveries.':kycStatus==='rejected'?`Reason: ${profile.rejectionReason || 'Please resubmit documents'}`:kycStatus==='pending' && profile.kycSubmittedAt?'Documents submitted. Admin will verify within 24-48 hours.':'Upload all required documents below.'}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-white/80 text-xs mb-1">
                      <span>Documents Uploaded</span>
                      <span>{kycProgress}%</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white rounded-full transition-all duration-500" style={{width:`${kycProgress}%`}} />
                    </div>
                  </div>
                </div>
              </Card>

              {/* WebRTC Video Call Card */}
              <Card className="rounded-3xl border-0 shadow-xl overflow-hidden bg-gradient-to-r from-violet-950/70 via-indigo-950/70 to-slate-950 border border-violet-500/30">
                <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-600/30 shrink-0">
                      <Video className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-base">Live Video Verification (WebRTC)</h4>
                        <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 text-[10px] font-mono">
                          P2P Encrypted
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Connect live with admin verification team for fast-track document approval.
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={() => setVideoCallOpen(true)}
                    className="w-full sm:w-auto h-10 px-5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs gap-2 shadow-lg shadow-violet-600/30 shrink-0"
                  >
                    <Video className="w-4 h-4" />
                    Start / Join Call
                  </Button>
                </div>
              </Card>

              {/* Documents List */}
              <div className="space-y-3">
                {KYC_DOCS.map(docItem => {
                  const existingUrl = profile[docItem.key];
                  const localFile = kycFiles[docItem.key];
                  const localPreview = docPreviews[docItem.key];
                  const isUploading = kycUploading[docItem.key];
                  const isUploaded = !!existingUrl;

                  return (
                    <Card key={docItem.key} className={`rounded-2xl border-0 shadow-md overflow-hidden ${isUploaded?'ring-2 ring-emerald-500/30':''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isUploaded?'bg-emerald-100 dark:bg-emerald-500/20':'bg-muted'}`}>
                            {isUploaded ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <FileText className="w-5 h-5 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold">{docItem.label}</p>
                              {docItem.required && <span className="text-xs text-rose-500">*required</span>}
                              {isUploaded && <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Uploaded</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{docItem.hint}</p>

                            {/* Preview */}
                            {(localPreview || existingUrl) && (
                              <div className="mt-3 relative">
                                <img src={localPreview || existingUrl} alt={docItem.label} className="w-full h-28 object-cover rounded-xl border border-border" />
                                {localPreview && !isUploading && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                                    <Badge className="bg-amber-500 text-white border-0">New — Not saved yet</Badge>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="flex gap-2 mt-3">
                              <input
                                ref={el => { fileInputRefs.current[docItem.key] = el; }}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => e.target.files?.[0] && handleFileSelect(docItem.key, e.target.files[0])}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => fileInputRefs.current[docItem.key]?.click()}
                                className="gap-1.5 text-xs"
                                disabled={isUploading}
                              >
                                <Camera className="w-3 h-3" />
                                {existingUrl ? 'Replace' : 'Select Photo'}
                              </Button>
                              {localFile && (
                                <Button
                                  size="sm"
                                  onClick={() => uploadDoc(docItem.key)}
                                  disabled={isUploading}
                                  className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                  {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                  {isUploading ? 'Uploading...' : 'Upload'}
                                </Button>
                              )}
                              {existingUrl && (
                                <a href={existingUrl} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-blue-500">
                                    <Eye className="w-3 h-3" /> View
                                  </Button>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Submit KYC Button */}
              {kycStatus !== 'approved' && (
                <Button
                  onClick={submitKyc}
                  disabled={kycSubmitting || kycProgress < 67}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-700 text-white gap-2 shadow-lg shadow-violet-500/20 disabled:opacity-50"
                >
                  {kycSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  {kycStatus === 'pending' && profile.kycSubmittedAt ? 'Resubmit KYC' : 'Submit KYC for Verification'}
                </Button>
              )}
              {kycProgress < 67 && kycStatus !== 'approved' && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <p className="text-amber-300 text-xs">Upload all required documents (marked with *) before submitting</p>
                </div>
              )}
            </motion.div>
          )}

          {/* STATS TAB */}
          {activeTab === 'stats' && (
            <motion.div key="stats" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} className="space-y-4">
              {/* Grade Card */}
              <Card className="rounded-3xl border-0 shadow-xl overflow-hidden">
                <div className={`bg-gradient-to-br ${gradeInfo.bg} p-6`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/70 text-sm">Performance Grade</p>
                      <div className="text-7xl font-black text-white mt-1">{gradeInfo.grade}</div>
                      <p className="text-white/80 font-semibold mt-1">{gradeInfo.label}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1 justify-center">
                        <Star className="w-6 h-6 text-yellow-300 fill-yellow-300" />
                        <span className="text-4xl font-black text-white">{rating.toFixed(1)}</span>
                      </div>
                      <p className="text-white/70 text-sm mt-1">{profile.totalRatings || 0} ratings</p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-5">
                  {[5,4,3,2,1].map(stars => {
                    const count = profile.ratingBreakdown?.[stars] || 0;
                    const total = profile.totalRatings || 1;
                    return (
                      <div key={stars} className="flex items-center gap-2 mb-2">
                        <span className="text-xs w-2">{stars}</span>
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full transition-all" style={{width:`${(count/total)*100}%`}} />
                        </div>
                        <span className="text-xs text-muted-foreground w-6">{count}</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Total Deliveries', value: profile.totalDeliveries || 0, icon: '📦', color: 'from-blue-500 to-indigo-600' },
                  { label: "Today's Orders", value: profile.todayDeliveries || 0, icon: '🛵', color: 'from-emerald-500 to-teal-600' },
                  { label: 'This Week', value: profile.weekDeliveries || 0, icon: '📅', color: 'from-purple-500 to-violet-600' },
                  { label: 'Acceptance Rate', value: `${profile.acceptanceRate || 95}%`, icon: '✅', color: 'from-amber-500 to-orange-600' },
                  { label: 'Total Earnings', value: `₹${(profile.totalEarnings || 0).toLocaleString()}`, icon: '💰', color: 'from-rose-500 to-pink-600' },
                  { label: 'Active Days', value: profile.activeDays || 0, icon: '🗓️', color: 'from-cyan-500 to-blue-600' },
                ].map((stat, i) => (
                  <Card key={i} className="rounded-2xl border-0 shadow-md">
                    <CardContent className="p-4">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-lg mb-3`}>{stat.icon}</div>
                      <p className="text-2xl font-black">{stat.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Incoming WebRTC Video Call Popup */}
      <AnimatePresence>
        {incomingCall && !videoCallOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-6 right-4 sm:right-6 z-50 max-w-sm w-full bg-gray-950 border-2 border-violet-500/50 rounded-3xl p-5 shadow-2xl shadow-violet-500/20 backdrop-blur-2xl"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-600/40 animate-pulse">
                <Video className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-base truncate">
                  {incomingCall.adminName || 'Admin Desk'}
                </p>
                <p className="text-violet-300 text-xs flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  Incoming Video KYC Call
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => {
                  setVideoCallOpen(true);
                  setIncomingCall(null);
                }}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs gap-1.5 shadow-lg shadow-emerald-600/30"
              >
                <Video className="w-4 h-4" /> Accept Call
              </Button>
              <Button
                variant="outline"
                onClick={handleDeclineIncomingCall}
                className="h-11 rounded-xl border-white/10 hover:bg-white/5 text-gray-300 text-xs px-4"
              >
                Decline
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WebRTC Video Call Component */}
      {user && (
        <KycVideoCall
          isOpen={videoCallOpen}
          onClose={() => setVideoCallOpen(false)}
          role="rider"
          deliveryPersonId={user.uid}
          deliveryPersonName={profile.name || 'Delivery Partner'}
        />
      )}
    </div>
  );
}
