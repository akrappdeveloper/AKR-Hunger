'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Users, Star, MapPin, Phone, Mail, CheckCircle2, XCircle,
  Loader2, Search, Plus, Filter, MoreVertical, Truck, Ban,
  Shield, TrendingUp, AlertTriangle, Edit2, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';

interface Driver {
  id: string;
  name: string;
  phone: string;
  email?: string;
  city: string;
  vehicleType: string;
  vehicleNumber?: string;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  isVerified: boolean;
  isAvailable: boolean;
  averageRating: number;
  totalDeliveries: number;
  totalEarnings: number;
  todayDeliveries: number;
  acceptanceRate: number;
  createdAt: any;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  inactive: 'bg-gray-100 text-gray-700 border-gray-200',
  suspended: 'bg-rose-100 text-rose-700 border-rose-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
};

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'delivery_partners'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Driver)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const updateDriverStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await updateDoc(doc(db, 'delivery_partners', id), { status, updatedAt: serverTimestamp() });
      toast.success(`Driver status updated to ${status}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleVerification = async (driver: Driver) => {
    setUpdatingId(driver.id);
    try {
      await updateDoc(doc(db, 'delivery_partners', driver.id), {
        isVerified: !driver.isVerified,
        updatedAt: serverTimestamp(),
      });
      toast.success(driver.isVerified ? 'Verification removed' : 'Driver verified!');
    } catch {
      toast.error('Failed to update verification');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = drivers.filter(d => {
    const matchSearch = !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search) ||
      d.city?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: drivers.length,
    active: drivers.filter(d => d.status === 'active').length,
    available: drivers.filter(d => d.isAvailable).length,
    pending: drivers.filter(d => d.status === 'pending').length,
    avgRating: drivers.length ? (drivers.reduce((acc, d) => acc + (d.averageRating || 0), 0) / drivers.length).toFixed(1) : '0.0',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-500" /> Delivery Drivers
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage all delivery partner accounts</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Drivers', value: stats.total, icon: '🛵', color: 'from-blue-500 to-indigo-600' },
          { label: 'Active', value: stats.active, icon: '✅', color: 'from-emerald-500 to-teal-600' },
          { label: 'Online Now', value: stats.available, icon: '🟢', color: 'from-cyan-500 to-blue-600' },
          { label: 'Pending Review', value: stats.pending, icon: '⏳', color: 'from-amber-500 to-orange-600' },
          { label: 'Avg Rating', value: `⭐ ${stats.avgRating}`, icon: '⭐', color: 'from-yellow-400 to-amber-500' },
        ].map((stat, i) => (
          <Card key={i} className="rounded-2xl border-0 shadow-md">
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-sm mb-2`}>
                {stat.icon}
              </div>
              <p className="text-2xl font-black">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name, phone, city..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl" />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'pending', 'inactive', 'suspended'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition-all ${
                statusFilter === s ? 'bg-blue-500 text-white' : 'bg-muted text-foreground hover:bg-muted/70'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Driver Table / Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="py-12 text-center">
            <div className="text-5xl mb-3">🛵</div>
            <p className="text-muted-foreground">No drivers found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((driver, i) => (
              <motion.div
                key={driver.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="rounded-2xl border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-xl flex-shrink-0">
                        🛵
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold">{driver.name}</span>
                          {driver.isVerified && (
                            <CheckCircle2 className="w-4 h-4 text-blue-500 fill-blue-500" />
                          )}
                          <Badge className={`text-xs ${STATUS_COLORS[driver.status] || ''}`}>
                            {driver.status}
                          </Badge>
                          {driver.isAvailable && (
                            <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Online</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span>📞 {driver.phone}</span>
                          <span>📍 {driver.city}</span>
                          <span>🏍️ {driver.vehicleType}</span>
                          {driver.vehicleNumber && <span>{driver.vehicleNumber}</span>}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 text-center flex-shrink-0">
                        <div>
                          <p className="font-bold text-sm">{driver.totalDeliveries || 0}</p>
                          <p className="text-xs text-muted-foreground">Deliveries</p>
                        </div>
                        <div>
                          <p className="font-bold text-sm flex items-center gap-0.5">
                            ⭐ {(driver.averageRating || 0).toFixed(1)}
                          </p>
                          <p className="text-xs text-muted-foreground">Rating</p>
                        </div>
                        <div>
                          <p className="font-bold text-sm">₹{driver.totalEarnings?.toFixed(0) || '0'}</p>
                          <p className="text-xs text-muted-foreground">Earnings</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setSelectedDriver(driver); setViewDialogOpen(true); }}
                          className="rounded-xl text-xs gap-1"
                        >
                          <Eye className="w-3 h-3" /> View
                        </Button>
                        {driver.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => updateDriverStatus(driver.id, 'active')}
                            disabled={updatingId === driver.id}
                            className="rounded-xl text-xs gap-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                          >
                            {updatingId === driver.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            Approve
                          </Button>
                        )}
                        {driver.status === 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateDriverStatus(driver.id, 'suspended')}
                            disabled={updatingId === driver.id}
                            className="rounded-xl text-xs gap-1 text-rose-600 border-rose-200 hover:bg-rose-50"
                          >
                            <Ban className="w-3 h-3" /> Suspend
                          </Button>
                        )}
                        {driver.status === 'suspended' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateDriverStatus(driver.id, 'active')}
                            disabled={updatingId === driver.id}
                            className="rounded-xl text-xs gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Reinstate
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleVerification(driver)}
                          disabled={updatingId === driver.id}
                          className={`rounded-xl text-xs gap-1 ${driver.isVerified ? 'text-amber-600 border-amber-200 hover:bg-amber-50' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}`}
                        >
                          <Shield className="w-3 h-3" />
                          {driver.isVerified ? 'Unverify' : 'Verify'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* View Driver Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle>Driver Details — {selectedDriver?.name}</DialogTitle>
          </DialogHeader>
          {selectedDriver && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Status', value: selectedDriver.status },
                  { label: 'Verified', value: selectedDriver.isVerified ? 'Yes ✓' : 'No' },
                  { label: 'Phone', value: selectedDriver.phone },
                  { label: 'City', value: selectedDriver.city },
                  { label: 'Vehicle', value: selectedDriver.vehicleType },
                  { label: 'Vehicle No.', value: selectedDriver.vehicleNumber || 'N/A' },
                  { label: 'Total Deliveries', value: selectedDriver.totalDeliveries || 0 },
                  { label: 'Rating', value: `⭐ ${(selectedDriver.averageRating || 0).toFixed(2)}` },
                  { label: 'Acceptance Rate', value: `${selectedDriver.acceptanceRate || 0}%` },
                  { label: 'Total Earnings', value: `₹${selectedDriver.totalEarnings?.toFixed(0) || '0'}` },
                  { label: 'Joined', value: selectedDriver.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A' },
                ].map((item, i) => (
                  <div key={i} className="p-3 rounded-xl bg-muted/40">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="font-semibold text-sm capitalize">{String(item.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)} className="rounded-xl">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
