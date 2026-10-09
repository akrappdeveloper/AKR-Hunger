'use client';

import { useState, useEffect, useRef } from 'react';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MapPin, Phone, Clock, ArrowLeft, Star, Package, TrendingUp,
  CheckCircle2, Loader2, AlertCircle, ShieldCheck, ShieldAlert,
  Upload, FileText, Camera, Eye, ChevronRight, User,
  Mail, Car, Wallet, Calendar, Edit3, Save, X, Info, Video,
  Sparkles, Check, ExternalLink, RefreshCw, Zap, Shield, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { uploadToCloudinary } from '@/lib/cloudinary';
import KycVideoCall from '@/components/kyc/KycVideoCall';

const KYC_DOCS = [
  { key: 'aadharFront', label: 'Aadhaar Card (Front)', required: true, hint: 'Clear photo of front side with name & photo' },
  { key: 'aadharBack', label: 'Aadhaar Card (Back)', required: true, hint: 'Clear photo of back side with full address' },
  { key: 'drivingLicense', label: 'Driving License', required: true, hint: 'Valid transport/motorcycle driving license' },
  { key: 'vehicleImage', label: 'Vehicle RC / Photo', required: true, hint: 'Registration certificate or vehicle with number plate' },
  { key: 'panCard', label: 'PAN Card', required: false, hint: 'Optional for tax TDS exemption and fast settlement' },
  { key: 'selfie', label: 'Selfie with ID', required: false, hint: 'Hold your Aadhaar/Driving license next to your face' },
];

export default function DeliveryProfilePage() {
  const { user, deliveryPartner, updateStatus } = useDeliveryAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'kyc' | 'stats'>('profile');

  // Avatar Uploading
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // KYC state
  const [kycUploading, setKycUploading] = useState<Record<string, boolean>>({});
  const [kycProgressMap, setKycProgressMap] = useState<Record<string, number>>({});
  const [kycFiles, setKycFiles] = useState<Record<string, File | null>>({});
  const [kycSubmitting, setKycSubmitting] = useState(false);
  const [docPreviews, setDocPreviews] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Document Lightbox Preview
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string } | null>(null);

  // Edit Profile Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    vehicleType: '',
    vehicleNumber: '',
    city: '',
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // WebRTC Video KYC
  const [videoCallOpen, setVideoCallOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);

  // Toggle Availability state
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Listen to profile updates in Firestore
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'deliveryPersons', user.uid), snap => {
      if (snap.exists()) {
        const data: any = { id: snap.id, ...snap.data() };
        setProfile(data);
        setEditFormData({
          name: data.name || '',
          phone: data.phone || '',
          vehicleType: data.vehicleType || data.vehicle || 'Bike',
          vehicleNumber: data.vehicleNumber || '',
          city: data.city || '',
        });
      }
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
    if (rating >= 4.8) return { grade: 'A+', color: 'text-emerald-400', label: 'Top Tier Partner', bg: 'from-emerald-500 to-teal-600', border: 'border-emerald-500/40' };
    if (rating >= 4.5) return { grade: 'A', color: 'text-blue-400', label: 'Preferred Partner', bg: 'from-blue-500 to-indigo-600', border: 'border-blue-500/40' };
    if (rating >= 4.0) return { grade: 'B', color: 'text-amber-400', label: 'Good Standing', bg: 'from-amber-500 to-orange-600', border: 'border-amber-500/40' };
    return { grade: 'C', color: 'text-rose-400', label: 'Needs Improvement', bg: 'from-rose-500 to-red-600', border: 'border-rose-500/40' };
  };

  const getKycStatus = () => profile?.kycStatus || profile?.verificationStatus || 'pending';

  const getKycProgress = () => {
    if (!profile) return 0;
    const submitted = KYC_DOCS.filter(d => profile[d.key]).length;
    return Math.round((submitted / KYC_DOCS.length) * 100);
  };

  // Avatar Upload via Cloudinary with Progress
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a valid photo file (JPG, PNG, WEBP)');
      return;
    }
    setUploadingAvatar(true);
    setAvatarProgress(0);
    try {
      const url = await uploadToCloudinary(file, (pct) => setAvatarProgress(pct));
      await updateDoc(doc(db, 'deliveryPersons', user.uid), {
        avatar: url,
        photoURL: url,
        updatedAt: serverTimestamp(),
      });
      toast.success('Profile avatar updated successfully!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload photo to Cloudinary');
    } finally {
      setUploadingAvatar(false);
      setAvatarProgress(0);
    }
  };

  // Toggle Live Availability
  const handleToggleAvailability = async (checked: boolean) => {
    if (!user) return;
    setTogglingStatus(true);
    try {
      if (updateStatus) {
        await updateStatus(checked ? 'online' : 'offline');
      } else {
        await updateDoc(doc(db, 'deliveryPersons', user.uid), {
          isAvailable: checked,
          status: checked ? 'online' : 'offline',
          updatedAt: serverTimestamp(),
        });
      }
      toast.success(checked ? '🟢 You are now Online & Available for orders' : '🔴 You are now Offline');
    } catch (err) {
      toast.error('Failed to update availability status');
    } finally {
      setTogglingStatus(false);
    }
  };

  // Select local doc file
  const handleFileSelect = (key: string, file: File) => {
    setKycFiles(prev => ({ ...prev, [key]: file }));
    const reader = new FileReader();
    reader.onload = e => setDocPreviews(prev => ({ ...prev, [key]: e.target?.result as string }));
    reader.readAsDataURL(file);
  };

  // Upload single doc to Cloudinary with real-time percentage
  const uploadDoc = async (key: string) => {
    const file = kycFiles[key];
    if (!file || !user) return;
    setKycUploading(prev => ({ ...prev, [key]: true }));
    setKycProgressMap(prev => ({ ...prev, [key]: 0 }));
    try {
      const url = await uploadToCloudinary(file, (pct) => {
        setKycProgressMap(prev => ({ ...prev, [key]: pct }));
      });
      await updateDoc(doc(db, 'deliveryPersons', user.uid), {
        [key]: url,
        kycUpdatedAt: serverTimestamp(),
      });
      toast.success(`${KYC_DOCS.find(d => d.key === key)?.label} uploaded to Cloudinary!`);
      setKycFiles(prev => ({ ...prev, [key]: null }));
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed. Please check network connection.');
    } finally {
      setKycUploading(prev => ({ ...prev, [key]: false }));
      setKycProgressMap(prev => ({ ...prev, [key]: 0 }));
    }
  };

  // Final KYC Submission
  const submitKyc = async () => {
    if (!user) return;
    const requiredDocs = KYC_DOCS.filter(d => d.required);
    const missing = requiredDocs.filter(d => !profile?.[d.key]);
    if (missing.length > 0) {
      toast.error(`Please upload required documents: ${missing.map(d => d.label).join(', ')}`);
      return;
    }
    setKycSubmitting(true);
    try {
      await updateDoc(doc(db, 'deliveryPersons', user.uid), {
        verificationStatus: 'pending',
        kycStatus: 'pending',
        kycSubmittedAt: serverTimestamp(),
      });
      toast.success('KYC submitted for review! Admin verification will complete shortly.');
    } catch {
      toast.error('Submission failed. Please try again.');
    } finally {
      setKycSubmitting(false);
    }
  };

  // Save Edit Profile Modal
  const handleSaveProfile = async () => {
    if (!user) return;
    if (!editFormData.name.trim()) {
      toast.error('Full name is required');
      return;
    }
    setIsSavingEdit(true);
    try {
      await updateDoc(doc(db, 'deliveryPersons', user.uid), {
        name: editFormData.name.trim(),
        phone: editFormData.phone.trim(),
        vehicleType: editFormData.vehicleType.trim(),
        vehicle: editFormData.vehicleType.trim(),
        vehicleNumber: editFormData.vehicleNumber.trim().toUpperCase(),
        city: editFormData.city.trim(),
        updatedAt: serverTimestamp(),
      });
      toast.success('Profile details updated successfully!');
      setIsEditModalOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update profile details');
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <p className="text-sm font-medium text-slate-400">Loading delivery partner profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Partner Profile Not Found</h2>
        <p className="text-slate-400 max-w-sm mb-6 text-sm">
          Your delivery account record could not be loaded. Please complete your registration or contact support.
        </p>
        <Button onClick={() => router.push('/delivery/login')} className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white">
          Back to Login
        </Button>
      </div>
    );
  }

  const rating = Number(profile.averageRating || profile.rating || 0);
  const gradeInfo = getGrade(rating);
  const kycStatus = getKycStatus();
  const kycProgress = getKycProgress();
  const isOnline = !!profile.isAvailable;

  const initials = (profile.name || 'DP')
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-28 md:pb-12 text-slate-100 font-sans">
      
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-xl border border-white/10"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </button>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditModalOpen(true)}
            className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs gap-1.5 h-9"
          >
            <Edit3 className="w-3.5 h-3.5 text-blue-400" /> Edit Profile
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push('/delivery/settings')}
            className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs gap-1.5 h-9 hidden sm:inline-flex"
          >
            Settings
          </Button>
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900/80 border border-white/10 shadow-2xl backdrop-blur-2xl">
        {/* Futuristic Mesh Background */}
        <div className="h-36 sm:h-44 w-full relative overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-800">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,_rgba(255,255,255,0.2),_transparent_60%)]" />
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-900/95 to-transparent" />
          
          {/* Subtle Partner Badge on Banner */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="text-[11px] font-mono tracking-widest uppercase bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-white/80 border border-white/10">
              ID: {user?.uid?.slice(0, 8)}...
            </span>
          </div>
        </div>

        {/* Profile Content Overlap */}
        <div className="px-5 sm:px-8 pb-7 -mt-16 sm:-mt-20 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            
            {/* Avatar & Rider Identity */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
              {/* Avatar Box with Cloudinary trigger */}
              <div className="relative group/avatar w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-slate-800 border-4 border-slate-900 shadow-2xl overflow-hidden shrink-0 ring-2 ring-white/10">
                {profile.avatar || profile.photoURL ? (
                  <img
                    src={profile.avatar || profile.photoURL}
                    alt={profile.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover/avatar:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-700 flex flex-col items-center justify-center text-white">
                    <span className="text-3xl font-black tracking-wider">{initials}</span>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-blue-200 mt-0.5">Rider</span>
                  </div>
                )}

                {/* Cloudinary Upload Overlay Button */}
                <input
                  type="file"
                  ref={avatarInputRef}
                  onChange={handleAvatarFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className={`absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white transition-all duration-300 text-[11px] font-bold gap-1 cursor-pointer ${
                    uploadingAvatar ? 'opacity-100 bg-slate-950/85 z-20' : 'opacity-0 group-hover/avatar:opacity-100'
                  }`}
                  title="Upload profile picture to Cloudinary"
                >
                  {uploadingAvatar ? (
                    <div className="flex flex-col items-center justify-center w-full px-2 space-y-1.5">
                      <div className="relative w-10 h-10 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 border-t-blue-400 animate-spin" />
                        <span className="text-[11px] font-mono font-black text-blue-300">{avatarProgress}%</span>
                      </div>
                      <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden border border-white/10">
                        <motion.div
                          className="h-full bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${avatarProgress}%` }}
                          transition={{ duration: 0.15 }}
                        />
                      </div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-200">
                        {avatarProgress === 100 ? 'Saving...' : 'Uploading'}
                      </span>
                    </div>
                  ) : (
                    <>
                      <Camera className="w-5 h-5 text-white" />
                      <span>Change Photo</span>
                    </>
                  )}
                </button>
              </div>

              {/* Title & Metadata */}
              <div className="space-y-1.5 pb-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {profile.name || 'Delivery Partner'}
                  </h1>
                  {kycStatus === 'approved' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3.5 h-3.5" /> Certified Partner
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1 text-slate-300 font-medium">
                    <Car className="w-3.5 h-3.5 text-blue-400" />
                    {profile.vehicleType || profile.vehicle || 'Bike'} • {profile.vehicleNumber || 'Vehicle Unregistered'}
                  </span>
                  {profile.city && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400" /> {profile.city}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    <Star className="w-3 h-3 fill-amber-400" /> {rating.toFixed(1)} ({profile.totalRatings || 0} reviews)
                  </span>
                </div>
              </div>
            </div>

            {/* Live Online / Offline Toggle Card */}
            <div className="flex items-center justify-between sm:justify-end gap-4 bg-slate-950/60 border border-white/10 rounded-2xl p-3.5 px-4 backdrop-blur-md">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  <p className="text-xs font-bold text-white uppercase tracking-wider">
                    {isOnline ? 'Active & Ready' : 'Currently Offline'}
                  </p>
                </div>
                <p className="text-[11px] text-slate-400">
                  {isOnline ? 'Receiving delivery dispatches' : 'Turn on to receive order broadcasts'}
                </p>
              </div>

              <div className="flex items-center gap-2 pl-2">
                <Switch
                  checked={isOnline}
                  onCheckedChange={handleToggleAvailability}
                  disabled={togglingStatus}
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>
            </div>

          </div>

          {/* Segmented Tab Controls */}
          <div className="flex gap-2 mt-8 p-1.5 rounded-2xl bg-slate-950/70 border border-white/10">
            {[
              { id: 'profile', label: 'Rider Profile', icon: User },
              { id: 'kyc', label: 'KYC & Verification', icon: ShieldCheck, badge: `${KYC_DOCS.filter(d => profile[d.key]).length}/${KYC_DOCS.length}` },
              { id: 'stats', label: 'Performance & Stats', icon: TrendingUp, gradeBadge: gradeInfo.grade },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.id.toUpperCase()}</span>
                  {tab.badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-300'}`}>
                      {tab.badge}
                    </span>
                  )}
                  {tab.gradeBadge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${isActive ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-300'}`}>
                      {tab.gradeBadge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* TAB CONTENT AREA */}
      <AnimatePresence mode="wait">
        
        {/* ===================== TAB 1: RIDER PROFILE ===================== */}
        {activeTab === 'profile' && (
          <motion.div
            key="profile-tab"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* Left 2 Cols: Personal & Transport Details */}
            <div className="md:col-span-2 space-y-6">
              
              {/* Personal Details Card */}
              <div className="rounded-3xl bg-slate-900/60 border border-white/10 p-6 backdrop-blur-xl shadow-xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">Personal Information</h3>
                      <p className="text-xs text-slate-400">Official contact & identification details</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditModalOpen(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-8 gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Full Legal Name', value: profile.name, icon: User },
                    { label: 'Registered Phone', value: profile.phone, icon: Phone },
                    { label: 'Account Email', value: profile.email, icon: Mail },
                    { label: 'Operating City', value: profile.city || 'Not Assigned', icon: MapPin },
                    { label: 'Partner Enrolled On', value: profile.createdAt?.toDate?.()?.toLocaleDateString?.('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) || 'N/A', icon: Calendar },
                    { label: 'Account Status', value: profile.status ? profile.status.toUpperCase() : 'ACTIVE', icon: Zap, isBadge: true },
                  ].map((item, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                      <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                        <item.icon className="w-3 h-3 text-slate-400" /> {item.label}
                      </p>
                      {item.isBadge ? (
                        <span className="inline-block text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          {item.value}
                        </span>
                      ) : (
                        <p className="text-sm font-semibold text-slate-100 truncate">{item.value || 'N/A'}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Vehicle & Transportation Card */}
              <div className="rounded-3xl bg-slate-900/60 border border-white/10 p-6 backdrop-blur-xl shadow-xl space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Car className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Vehicle & Transportation</h3>
                    <p className="text-xs text-slate-400">Road permit & transport specs</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                    <p className="text-[11px] font-medium text-slate-400">Vehicle Type</p>
                    <p className="text-sm font-bold text-slate-100">{profile.vehicleType || profile.vehicle || 'Bike (Standard 2-Wheeler)'}</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                    <p className="text-[11px] font-medium text-slate-400">Vehicle Number Plate</p>
                    <p className="text-sm font-mono font-bold text-blue-400">{profile.vehicleNumber || 'NOT REGISTERED'}</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                    <p className="text-[11px] font-medium text-slate-400">Insulated Delivery Bag</p>
                    <p className="text-sm font-semibold text-emerald-400">✓ Hunger Standard Thermal Kit</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                    <p className="text-[11px] font-medium text-slate-400">Road Safety Gear</p>
                    <p className="text-sm font-semibold text-emerald-400">✓ Helmet & Hi-Vis Vest Certified</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Wallet & Quick Actions */}
            <div className="space-y-6">
              
              {/* Wallet Card */}
              <div className="rounded-3xl bg-gradient-to-br from-slate-900/90 via-indigo-950/40 to-slate-900/90 border border-indigo-500/20 p-6 backdrop-blur-xl shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-indigo-400" /> Partner Wallet
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                    Live Balance
                  </span>
                </div>

                <div className="py-2">
                  <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                    {profile.walletBalance != null
                      ? (Number(profile.walletBalance) < 0
                          ? `-₹${Math.abs(Number(profile.walletBalance)).toFixed(2)}`
                          : `₹${Number(profile.walletBalance).toFixed(2)}`)
                      : '₹0.00'}
                  </div>
                  <p className="text-xs mt-1 text-slate-400">
                    {Number(profile.walletBalance || 0) < 0 ? (
                      <span className="text-rose-400 font-semibold">⚠️ Pending COD Cash Due for Deposit</span>
                    ) : (
                      <span className="text-emerald-400 font-semibold">✓ Net Available Credit / Payout</span>
                    )}
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <Button
                    onClick={() => router.push('/delivery/wallet')}
                    className="w-full h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs gap-2 shadow-lg shadow-indigo-600/30"
                  >
                    <Wallet className="w-3.5 h-3.5" /> Manage Wallet & COD Cash
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push('/delivery/earnings')}
                    className="w-full h-10 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold"
                  >
                    View Weekly Settlements
                  </Button>
                </div>
              </div>

              {/* Bank Details Card */}
              <div className="rounded-3xl bg-slate-900/60 border border-white/10 p-6 backdrop-blur-xl shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" /> Bank Payout Account
                  </h4>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                    Direct Transfer
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Payouts are settled directly to your verified bank account or UPI ID every Tuesday.
                </p>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-slate-300">
                  <p className="font-semibold">{profile.bankDetails?.bankName || 'HDFC Bank Ltd.'}</p>
                  <p className="font-mono text-slate-400 mt-0.5">
                    A/C: {profile.bankDetails?.accountNumber ? `••••${profile.bankDetails.accountNumber.slice(-4)}` : '••••8492'} • IFSC: {profile.bankDetails?.ifscCode || 'HDFC0001234'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push('/delivery/settings')}
                  className="w-full text-xs text-slate-400 hover:text-white h-8"
                >
                  Update Bank Details in Settings →
                </Button>
              </div>

            </div>
          </motion.div>
        )}

        {/* ===================== TAB 2: KYC & VERIFICATION ===================== */}
        {activeTab === 'kyc' && (
          <motion.div
            key="kyc-tab"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* KYC Status Banner */}
            <div className={`rounded-3xl p-6 border shadow-2xl relative overflow-hidden backdrop-blur-xl ${
              kycStatus === 'approved'
                ? 'bg-gradient-to-r from-emerald-950/70 via-teal-950/60 to-slate-950 border-emerald-500/30'
                : kycStatus === 'rejected'
                ? 'bg-gradient-to-r from-rose-950/70 via-red-950/60 to-slate-950 border-rose-500/30'
                : 'bg-gradient-to-r from-amber-950/70 via-orange-950/60 to-slate-950 border-amber-500/30'
            }`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                    kycStatus === 'approved'
                      ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                      : kycStatus === 'rejected'
                      ? 'bg-rose-500 text-white shadow-rose-500/30'
                      : 'bg-amber-500 text-white shadow-amber-500/30'
                  }`}>
                    {kycStatus === 'approved' ? (
                      <ShieldCheck className="w-7 h-7" />
                    ) : kycStatus === 'rejected' ? (
                      <ShieldAlert className="w-7 h-7" />
                    ) : (
                      <Clock className="w-7 h-7 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">
                      {kycStatus === 'approved' ? 'KYC Verification Approved & Certified' : kycStatus === 'rejected' ? 'KYC Verification Action Required' : 'KYC Verification Pending Review'}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
                      {kycStatus === 'approved'
                        ? 'Your identity documents have been legally verified. You are authorized to accept and deliver orders on the platform.'
                        : kycStatus === 'rejected'
                        ? `Document review was not approved: "${profile.rejectionReason || 'Please resubmit clearer photos of your Aadhaar card and driving license.'}"`
                        : profile.kycSubmittedAt
                        ? 'Documents submitted successfully. Admin verification team is actively reviewing your submission (estimated 12-24 hours).'
                        : 'Upload clear photos of all required identification documents below to activate order dispatches.'}
                    </p>
                  </div>
                </div>

                <div className="w-full sm:w-48 shrink-0 bg-black/40 border border-white/10 rounded-2xl p-3.5 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-medium">Progress</span>
                    <span className="font-bold text-white font-mono">{kycProgress}%</span>
                  </div>
                  <Progress value={kycProgress} className="h-2 bg-white/10" />
                  <p className="text-[10px] text-slate-400 text-center">
                    {KYC_DOCS.filter(d => profile[d.key]).length} of {KYC_DOCS.length} documents uploaded
                  </p>
                </div>
              </div>
            </div>

            {/* WebRTC Video Call Card */}
            <div className="rounded-3xl border border-violet-500/30 bg-gradient-to-r from-violet-950/70 via-indigo-950/70 to-slate-950 p-6 shadow-2xl backdrop-blur-2xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-600/30 shrink-0">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-base">Live Video Verification (WebRTC Fast-Track)</h4>
                      <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 text-[10px] font-mono">
                        P2P Encrypted
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 max-w-xl">
                      Want instant approval? Connect directly with the admin verification team over high-speed live video call to verify your original documents in 2 minutes.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => setVideoCallOpen(true)}
                  className="w-full sm:w-auto h-11 px-6 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs gap-2 shadow-lg shadow-violet-600/30 shrink-0"
                >
                  <Video className="w-4 h-4" /> Start Live Video Room
                </Button>
              </div>
            </div>

            {/* Documents Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {KYC_DOCS.map(docItem => {
                const existingUrl = profile[docItem.key];
                const localFile = kycFiles[docItem.key];
                const localPreview = docPreviews[docItem.key];
                const isUploading = kycUploading[docItem.key];
                const isUploaded = !!existingUrl;

                return (
                  <motion.div
                    key={docItem.key}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className={`rounded-3xl p-5 border backdrop-blur-xl transition-all duration-300 flex flex-col justify-between space-y-4 ${
                      isUploaded
                        ? 'bg-slate-900/70 border-emerald-500/30 shadow-lg shadow-emerald-500/5'
                        : 'bg-slate-900/50 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isUploaded ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-slate-400 border border-white/10'
                          }`}>
                            {isUploaded ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <FileText className="w-4 h-4" />}
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-sm leading-tight">{docItem.label}</h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">{docItem.hint}</p>
                          </div>
                        </div>

                        {docItem.required ? (
                          <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px] shrink-0">
                            Required
                          </Badge>
                        ) : (
                          <Badge className="bg-white/5 text-slate-400 border-white/10 text-[10px] shrink-0">
                            Optional
                          </Badge>
                        )}
                      </div>

                      {/* Image Preview Box with Active Upload Progress Overlay */}
                      <div className="relative h-32 rounded-2xl overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center group/preview">
                        {localPreview || existingUrl ? (
                          <>
                            <img
                              src={localPreview || existingUrl}
                              alt={docItem.label}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover/preview:scale-105"
                            />
                            {/* Hover overlay with zoom button */}
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPreviewDoc({ title: docItem.label, url: localPreview || existingUrl })}
                                className="h-8 px-3 rounded-xl border-white/20 bg-white/10 text-white text-xs gap-1.5"
                              >
                                <Eye className="w-3.5 h-3.5" /> Fullscreen View
                              </Button>
                            </div>
                            {localPreview && !isUploading && (
                              <div className="absolute top-2 left-2">
                                <span className="bg-amber-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md">
                                  Not Saved Yet
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-500 p-4 text-center">
                            <Upload className="w-6 h-6 mb-1 opacity-40" />
                            <span className="text-[11px] font-medium">No document uploaded yet</span>
                          </div>
                        )}

                        {/* Real-time Upload Progress Overlay */}
                        <AnimatePresence>
                          {isUploading && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.96 }}
                              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-20 flex flex-col items-center justify-center p-4 space-y-2 text-center"
                            >
                              <div className="relative w-12 h-12 flex items-center justify-center">
                                <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 border-t-blue-400 animate-spin" />
                                <span className="text-xs font-black font-mono text-white">
                                  {kycProgressMap[docItem.key] || 0}%
                                </span>
                              </div>

                              <div className="w-full max-w-[140px] space-y-1">
                                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/10">
                                  <motion.div
                                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${kycProgressMap[docItem.key] || 0}%` }}
                                    transition={{ duration: 0.15 }}
                                  />
                                </div>
                                <p className="text-[10px] font-bold text-blue-300 uppercase tracking-wider animate-pulse">
                                  {kycProgressMap[docItem.key] === 100 ? 'Finalizing Cloud URL...' : `Uploading ${kycProgressMap[docItem.key] || 0}%`}
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <input
                        ref={el => { fileInputRefs.current[docItem.key] = el; }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => e.target.files?.[0] && handleFileSelect(docItem.key, e.target.files[0])}
                      />

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => fileInputRefs.current[docItem.key]?.click()}
                          disabled={isUploading}
                          className="flex-1 h-9 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold gap-1.5"
                        >
                          <Camera className="w-3.5 h-3.5 text-blue-400" />
                          {existingUrl ? 'Replace Photo' : 'Select Photo'}
                        </Button>

                        {localFile && (
                          <Button
                            size="sm"
                            onClick={() => uploadDoc(docItem.key)}
                            disabled={isUploading}
                            className="flex-1 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold gap-1.5 shadow-lg shadow-blue-600/30"
                          >
                            {isUploading ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>{kycProgressMap[docItem.key] || 0}%</span>
                              </>
                            ) : (
                              <>
                                <Upload className="w-3.5 h-3.5" />
                                <span>Save to Cloud</span>
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Submission Bar */}
            {kycStatus !== 'approved' && (
              <div className="rounded-3xl p-6 bg-slate-900/80 border border-white/10 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-0.5 text-center sm:text-left">
                  <h4 className="font-bold text-white text-base">Ready for Document Verification?</h4>
                  <p className="text-xs text-slate-400">
                    Ensure all required documents are clear and readable before submitting.
                  </p>
                </div>

                <Button
                  onClick={submitKyc}
                  disabled={kycSubmitting || kycProgress < 67}
                  className="w-full sm:w-auto h-12 px-8 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-bold text-sm gap-2 shadow-xl shadow-indigo-600/30 disabled:opacity-50"
                >
                  {kycSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  {kycStatus === 'pending' && profile.kycSubmittedAt ? 'Resubmit KYC Documents' : 'Submit KYC for Admin Approval'}
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* ===================== TAB 3: PERFORMANCE & STATS ===================== */}
        {activeTab === 'stats' && (
          <motion.div
            key="stats-tab"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Grade & Rating Spotlight */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Grade Banner */}
              <div className={`md:col-span-1 rounded-3xl p-6 bg-gradient-to-br ${gradeInfo.bg} border ${gradeInfo.border} shadow-2xl relative overflow-hidden flex flex-col justify-between text-white`}>
                <div className="space-y-1">
                  <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">Performance Rating</p>
                  <div className="text-7xl font-black tracking-tight">{gradeInfo.grade}</div>
                  <p className="text-white text-base font-bold">{gradeInfo.label}</p>
                </div>

                <div className="pt-6 border-t border-white/20 mt-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Star className="w-5 h-5 text-yellow-300 fill-yellow-300" />
                      <span className="text-2xl font-black">{rating.toFixed(1)}</span>
                    </div>
                    <p className="text-[11px] text-white/70">Based on customer ratings</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold">{profile.totalRatings || 0}</span>
                    <p className="text-[11px] text-white/70">Total reviews</p>
                  </div>
                </div>
              </div>

              {/* 5-Star Breakdown */}
              <div className="md:col-span-2 rounded-3xl bg-slate-900/60 border border-white/10 p-6 backdrop-blur-xl shadow-xl flex flex-col justify-center space-y-3">
                <h4 className="text-sm font-bold text-white mb-2">Customer Feedback Breakdown</h4>
                {[5, 4, 3, 2, 1].map(stars => {
                  const count = profile.ratingBreakdown?.[stars] || 0;
                  const total = profile.totalRatings || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={stars} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-12 text-xs font-bold text-slate-300 shrink-0">
                        <span>{stars}</span>
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      </div>
                      <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-right text-xs font-mono text-slate-400 w-12 shrink-0">
                        {count} ({pct}%)
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* KPI Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Total Deliveries', value: profile.totalDeliveries || 0, icon: '📦', color: 'from-blue-500 to-indigo-600' },
                { label: "Today's Orders", value: profile.todayDeliveries || 0, icon: '🛵', color: 'from-emerald-500 to-teal-600' },
                { label: 'Weekly Volume', value: profile.weekDeliveries || 0, icon: '📅', color: 'from-purple-500 to-violet-600' },
                { label: 'Acceptance Rate', value: `${profile.acceptanceRate || 98}%`, icon: '🎯', color: 'from-amber-500 to-orange-600' },
                { label: 'Total Earnings', value: `₹${(profile.totalEarnings || 0).toLocaleString('en-IN')}`, icon: '💰', color: 'from-rose-500 to-pink-600' },
                { label: 'Active Days', value: profile.activeDays || 0, icon: '🗓️', color: 'from-cyan-500 to-blue-600' },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
                  className="rounded-2xl p-4 bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-md space-y-2 cursor-pointer"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-lg shadow-md`}>
                    {stat.icon}
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-black text-white tracking-tight">{stat.value}</div>
                    <p className="text-[11px] text-slate-400 font-medium leading-tight mt-0.5">{stat.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Document Lightbox Preview Modal */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-3xl bg-slate-950 border border-white/10 text-white rounded-3xl p-6 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-400" /> {previewDoc?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              High-resolution document preview stored on Cloudinary
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 max-h-[70vh] rounded-2xl overflow-hidden border border-white/10 bg-black flex items-center justify-center">
            {previewDoc?.url && (
              <img
                src={previewDoc.url}
                alt={previewDoc.title}
                className="max-h-[65vh] w-auto object-contain rounded-xl"
              />
            )}
          </div>

          <DialogFooter className="flex justify-between items-center">
            {previewDoc?.url && (
              <a
                href={previewDoc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:underline flex items-center gap-1"
              >
                Open in new tab <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <Button onClick={() => setPreviewDoc(null)} className="rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs">
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md bg-slate-950 border border-white/10 text-white rounded-3xl p-6 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-blue-400" /> Edit Profile Details
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Update your registered rider information and vehicle details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Full Legal Name *</Label>
              <Input
                value={editFormData.name}
                onChange={e => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Rahul Sharma"
                className="bg-white/5 border-white/10 text-white rounded-xl h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Contact Phone Number</Label>
              <Input
                value={editFormData.phone}
                onChange={e => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+91 9876543210"
                className="bg-white/5 border-white/10 text-white rounded-xl h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Vehicle Type</Label>
                <Input
                  value={editFormData.vehicleType}
                  onChange={e => setEditFormData(prev => ({ ...prev, vehicleType: e.target.value }))}
                  placeholder="e.g. Motorcycle / Electric Scooter"
                  className="bg-white/5 border-white/10 text-white rounded-xl h-10 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Vehicle Number Plate</Label>
                <Input
                  value={editFormData.vehicleNumber}
                  onChange={e => setEditFormData(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                  placeholder="e.g. DL 01 AB 1234"
                  className="bg-white/5 border-white/10 text-white rounded-xl h-10 font-mono text-xs uppercase"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Operating City / Hub</Label>
              <Input
                value={editFormData.city}
                onChange={e => setEditFormData(prev => ({ ...prev, city: e.target.value }))}
                placeholder="e.g. New Delhi"
                className="bg-white/5 border-white/10 text-white rounded-xl h-10"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              className="rounded-xl border-white/10 text-slate-300 hover:bg-white/5 text-xs h-10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={isSavingEdit}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs h-10 gap-1.5"
            >
              {isSavingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Incoming WebRTC Video Call Popup */}
      <AnimatePresence>
        {incomingCall && !videoCallOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-6 right-4 sm:right-6 z-50 max-w-sm w-full bg-slate-950 border-2 border-violet-500/50 rounded-3xl p-5 shadow-2xl shadow-violet-500/20 backdrop-blur-2xl"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-600/40 animate-pulse">
                <Video className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-base truncate">
                  {incomingCall.adminName || 'Admin Verification Desk'}
                </p>
                <p className="text-violet-300 text-xs flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  Incoming Video KYC Verification
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
                <Video className="w-4 h-4" /> Accept & Connect
              </Button>
              <Button
                variant="outline"
                onClick={handleDeclineIncomingCall}
                className="h-11 rounded-xl border-white/10 hover:bg-white/5 text-slate-300 text-xs px-4"
              >
                Decline
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WebRTC Video Call Component Modal */}
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
