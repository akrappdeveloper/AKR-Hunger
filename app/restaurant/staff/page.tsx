'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Users, Plus, Trash2, Edit2, Phone, Mail, Shield,
  ChefHat, Loader2, CheckCircle2, Search, UserCheck, UserX
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'manager' | 'chef' | 'cashier' | 'helper';
  status: 'active' | 'on_leave' | 'inactive';
  joinedAt?: any;
  salary?: number;
}

const ROLES = [
  { value: 'manager', label: 'Manager', icon: Shield, color: 'from-purple-500 to-violet-600' },
  { value: 'chef', label: 'Chef', icon: ChefHat, color: 'from-orange-500 to-amber-600' },
  { value: 'cashier', label: 'Cashier', icon: Users, color: 'from-blue-500 to-indigo-600' },
  { value: 'helper', label: 'Helper', icon: UserCheck, color: 'from-emerald-500 to-teal-600' },
];

const STATUS_COLORS = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  on_leave: 'bg-amber-100 text-amber-700 border-amber-200',
  inactive: 'bg-rose-100 text-rose-700 border-rose-200',
};

const emptyForm = { name: '', phone: '', email: '', role: 'chef' as const, status: 'active' as const, salary: '' };

export default function RestaurantStaffPage() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Get restaurant ID from user profile
    const unsub = onSnapshot(doc(db, 'users', user.uid), async snap => {
      const restaurantId = snap.data()?.restaurantId;
      if (!restaurantId) { setLoading(false); return; }

      const staffQ = query(
        collection(db, 'restaurants', restaurantId, 'staff'),
        orderBy('joinedAt', 'desc')
      );
      onSnapshot(staffQ, staffSnap => {
        setStaff(staffSnap.docs.map(d => ({ id: d.id, ...d.data() } as StaffMember)));
        setLoading(false);
      });
    });
    return () => unsub();
  }, [user]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (s: StaffMember) => {
    setEditing(s);
    setForm({ name: s.name, phone: s.phone, email: s.email || '', role: s.role, status: s.status, salary: s.salary?.toString() || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !form.name || !form.phone) { toast.error('Name and phone are required'); return; }
    setSaving(true);
    try {
      const userSnap = await (await import('firebase/firestore')).getDoc(doc(db, 'users', user.uid));
      const restaurantId = userSnap.data()?.restaurantId;
      if (!restaurantId) { toast.error('Restaurant not found'); return; }

      const data = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        role: form.role,
        status: form.status,
        salary: form.salary ? parseFloat(form.salary) : 0,
        updatedAt: serverTimestamp(),
      };

      if (editing) {
        await updateDoc(doc(db, 'restaurants', restaurantId, 'staff', editing.id), data);
        toast.success('Staff updated');
      } else {
        await addDoc(collection(db, 'restaurants', restaurantId, 'staff'), { ...data, joinedAt: serverTimestamp() });
        toast.success('Staff member added');
      }
      setDialogOpen(false);
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: StaffMember) => {
    if (!user) return;
    setDeletingId(s.id);
    try {
      const userSnap = await (await import('firebase/firestore')).getDoc(doc(db, 'users', user.uid));
      const restaurantId = userSnap.data()?.restaurantId;
      await deleteDoc(doc(db, 'restaurants', restaurantId, 'staff', s.id));
      toast.success('Staff removed');
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = staff.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.role.includes(search.toLowerCase())
  );
  const activeCount = staff.filter(s => s.status === 'active').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-500" /> Staff Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your kitchen & service team</p>
        </div>
        <Button onClick={openAdd} className="bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-2xl gap-2">
          <Plus className="w-4 h-4" /> Add Staff
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Staff', value: staff.length, icon: '👥', color: 'from-blue-500 to-indigo-600' },
          { label: 'Active Today', value: activeCount, icon: '✅', color: 'from-emerald-500 to-teal-600' },
          { label: 'On Leave', value: staff.filter(s => s.status === 'on_leave').length, icon: '🏖️', color: 'from-amber-500 to-orange-600' },
          { label: 'Chefs', value: staff.filter(s => s.role === 'chef').length, icon: '👨‍🍳', color: 'from-rose-500 to-pink-600' },
        ].map((stat, i) => (
          <Card key={i} className="rounded-2xl border-0 shadow-md">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-lg`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-black">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search staff by name or role..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 rounded-2xl"
        />
      </div>

      {/* Staff List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="py-12 text-center">
            <div className="text-5xl mb-3">👥</div>
            <p className="text-muted-foreground">No staff members found. Add your first team member!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <AnimatePresence>
            {filtered.map((member, i) => {
              const role = ROLES.find(r => r.value === member.role) || ROLES[1];
              const Icon = role.icon;
              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="rounded-2xl border-0 shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${role.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold">{member.name}</span>
                            <Badge className={`text-xs ${STATUS_COLORS[member.status]}`}>
                              {member.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground capitalize">{member.role}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{member.phone}</span>
                            {member.salary && <span>₹{member.salary}/mo</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button variant="outline" size="sm" onClick={() => openEdit(member)} className="flex-1 rounded-xl text-xs gap-1">
                          <Edit2 className="w-3 h-3" /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(member)}
                          disabled={deletingId === member.id}
                          className="rounded-xl text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          {deletingId === member.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Staff Member' : 'Add New Staff Member'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} className="mt-1 rounded-xl" placeholder="Staff member name" />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input value={form.phone} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} className="mt-1 rounded-xl" placeholder="+91 00000 00000" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} className="mt-1 rounded-xl" placeholder="email@example.com" />
            </div>
            <div>
              <Label>Role</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {ROLES.map(r => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.value}
                      onClick={() => setForm((f: any) => ({ ...f, role: r.value }))}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm transition-all ${
                        form.role === r.value ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20' : 'border-border'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${r.color} flex items-center justify-center`}>
                        <Icon className="w-3 h-3 text-white" />
                      </div>
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <select
                  value={form.status}
                  onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}
                  className="w-full mt-1 h-10 rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="on_leave">On Leave</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <Label>Monthly Salary (₹)</Label>
                <Input
                  type="number"
                  value={form.salary}
                  onChange={e => setForm((f: any) => ({ ...f, salary: e.target.value }))}
                  className="mt-1 rounded-xl"
                  placeholder="15000"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {editing ? 'Update' : 'Add Staff'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
