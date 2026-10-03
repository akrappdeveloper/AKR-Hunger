'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MapPin, Phone, Clock, Truck, Navigation, ArrowLeft,
  Star, Package, TrendingUp, CheckCircle2, BarChart3, Loader2,
  Award, Calendar, AlertCircle
} from 'lucide-react';

export default function DeliveryProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'delivery_partners', user.uid), snap => {
      if (snap.exists()) {
        setProfile({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // Calculate performance grade
  const getGrade = (rating: number) => {
    if (rating >= 4.8) return { grade: 'A+', color: 'text-emerald-500', label: 'Excellent' };
    if (rating >= 4.5) return { grade: 'A', color: 'text-blue-500', label: 'Very Good' };
    if (rating >= 4.0) return { grade: 'B', color: 'text-amber-500', label: 'Good' };
    return { grade: 'C', color: 'text-rose-500', label: 'Needs Improvement' };
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;

  if (!profile) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
      <h2 className="text-xl font-bold mb-2">Profile not found</h2>
      <p className="text-muted-foreground">Please complete your registration first</p>
    </div>
  );

  const rating = profile.averageRating || 0;
  const gradeInfo = getGrade(rating);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 pt-8 pb-20">
        <div className="absolute inset-0 opacity-10 text-8xl select-none pointer-events-none">
          <span className="absolute top-4 left-6">🛵</span>
          <span className="absolute bottom-4 right-12 text-5xl">⭐</span>
        </div>
        <div className="container max-w-2xl mx-auto px-4">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/80 hover:text-white mb-8">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl flex-shrink-0">
              🛵
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">{profile.name || 'Delivery Partner'}</h1>
              <p className="text-white/70 text-sm">{profile.vehicleType || 'Bike'} • {profile.vehicleNumber || 'N/A'}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={`${profile.isAvailable ? 'bg-emerald-500' : 'bg-rose-500'} text-white border-0`}>
                  {profile.isAvailable ? '🟢 Available' : '🔴 Offline'}
                </Badge>
                {profile.isVerified && (
                  <Badge className="bg-blue-500 text-white border-0">✓ Verified</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 -mt-10 pb-20 space-y-5">
        {/* Performance Grade */}
        <Card className="rounded-3xl border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Performance Grade</p>
                <div className={`text-5xl font-black ${gradeInfo.color}`}>{gradeInfo.grade}</div>
                <p className="text-sm font-medium">{gradeInfo.label}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                  <span className="text-3xl font-black">{rating.toFixed(1)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {profile.totalRatings || 0} ratings
                </p>
              </div>
            </div>
            {/* Rating breakdown */}
            {[5, 4, 3, 2, 1].map(stars => {
              const count = profile.ratingBreakdown?.[stars] || 0;
              const total = profile.totalRatings || 1;
              const pct = (count / total) * 100;
              return (
                <div key={stars} className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs w-2">{stars}</span>
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
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
            { label: 'Today\'s Orders', value: profile.todayDeliveries || 0, icon: '🛵', color: 'from-emerald-500 to-teal-600' },
            { label: 'This Week', value: profile.weekDeliveries || 0, icon: '📅', color: 'from-purple-500 to-violet-600' },
            { label: 'Acceptance Rate', value: `${profile.acceptanceRate || 95}%`, icon: '✅', color: 'from-amber-500 to-orange-600' },
          ].map((stat, i) => (
            <Card key={i} className="rounded-2xl border-0 shadow-md">
              <CardContent className="p-4">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-lg mb-3`}>
                  {stat.icon}
                </div>
                <p className="text-2xl font-black">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Personal Details */}
        <Card className="rounded-2xl border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-500" /> Personal Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Full Name', value: profile.name },
              { label: 'Phone', value: profile.phone },
              { label: 'Email', value: profile.email },
              { label: 'City', value: profile.city },
              { label: 'Vehicle Type', value: profile.vehicleType },
              { label: 'Vehicle Number', value: profile.vehicleNumber },
              { label: 'License Number', value: profile.licenseNumber },
              { label: 'Joined', value: profile.createdAt?.toDate?.()?.toLocaleDateString() },
            ].map((item, i) => (
              item.value ? (
                <div key={i} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              ) : null
            ))}
          </CardContent>
        </Card>

        {/* Documents Status */}
        <Card className="rounded-2xl border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" /> Document Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Aadhar Card', status: profile.documents?.aadhar },
              { label: 'Driving License', status: profile.documents?.license },
              { label: 'Vehicle RC', status: profile.documents?.rc },
              { label: 'Insurance', status: profile.documents?.insurance },
              { label: 'PAN Card', status: profile.documents?.pan },
            ].map((doc, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                <span className="text-sm font-medium">{doc.label}</span>
                <Badge className={
                  doc.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-0' :
                  doc.status === 'pending' ? 'bg-amber-100 text-amber-700 border-0' :
                  'bg-rose-100 text-rose-700 border-0'
                }>
                  {doc.status === 'approved' ? '✓ Approved' : doc.status === 'pending' ? '⏳ Pending' : '✗ Missing'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button
          onClick={() => router.push('/delivery/settings')}
          className="w-full h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white gap-2"
        >
          Edit Profile & Settings
        </Button>
      </div>
    </div>
  );
}
