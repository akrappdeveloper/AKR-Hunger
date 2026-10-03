'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  MapPin, Plus, Trash2, Edit2, Home, Briefcase, Building2,
  CheckCircle2, ArrowLeft, Navigation, Loader2, Star
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog';

interface Address {
  id: string;
  label: string;
  type: 'home' | 'work' | 'other';
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  isDefault: boolean;
  createdAt?: any;
}

const ADDRESS_TYPES = [
  { value: 'home', label: 'Home', icon: Home, color: 'from-emerald-500 to-teal-600' },
  { value: 'work', label: 'Work', icon: Briefcase, color: 'from-blue-500 to-indigo-600' },
  { value: 'other', label: 'Other', icon: Building2, color: 'from-purple-500 to-violet-600' },
];

const emptyForm = {
  label: '',
  type: 'home' as 'home' | 'work' | 'other',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
  landmark: '',
  isDefault: false,
};

export default function AddressesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'addresses'),
      orderBy('isDefault', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setAddresses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Address)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [user]);

  const openAdd = () => {
    setEditingAddress(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (addr: Address) => {
    setEditingAddress(addr);
    setForm({
      label: addr.label,
      type: addr.type,
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2 || '',
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      landmark: addr.landmark || '',
      isDefault: addr.isDefault,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.addressLine1 || !form.city || !form.state || !form.pincode) {
      toast.error('Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...form,
        label: form.label || (form.type === 'home' ? 'Home' : form.type === 'work' ? 'Work' : 'Other'),
        updatedAt: serverTimestamp(),
      };
      // If setting as default, unset others
      if (form.isDefault) {
        for (const addr of addresses) {
          if (addr.isDefault && addr.id !== editingAddress?.id) {
            await updateDoc(doc(db, 'users', user.uid, 'addresses', addr.id), { isDefault: false });
          }
        }
      }
      if (editingAddress) {
        await updateDoc(doc(db, 'users', user.uid, 'addresses', editingAddress.id), data);
        toast.success('Address updated');
      } else {
        await addDoc(collection(db, 'users', user.uid, 'addresses'), {
          ...data,
          createdAt: serverTimestamp(),
        });
        toast.success('Address added');
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error('Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'addresses', id));
      toast.success('Address removed');
    } catch {
      toast.error('Failed to delete address');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (addr: Address) => {
    if (!user || addr.isDefault) return;
    try {
      for (const a of addresses) {
        if (a.isDefault) {
          await updateDoc(doc(db, 'users', user.uid, 'addresses', a.id), { isDefault: false });
        }
      }
      await updateDoc(doc(db, 'users', user.uid, 'addresses', addr.id), { isDefault: true });
      toast.success('Default address updated');
    } catch {
      toast.error('Failed to update default');
    }
  };

  const getTypeInfo = (type: string) => ADDRESS_TYPES.find(t => t.value === type) || ADDRESS_TYPES[2];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 pt-8 pb-16">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-8 text-6xl">📍</div>
          <div className="absolute bottom-4 right-12 text-4xl">🗺️</div>
          <div className="absolute top-12 right-24 text-3xl">🏠</div>
        </div>
        <div className="container max-w-3xl mx-auto px-4">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Saved Addresses</h1>
              <p className="text-white/80">Manage your delivery locations</p>
            </div>
            <div className="bg-white/20 rounded-2xl p-4 backdrop-blur-sm">
              <MapPin className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-3xl mx-auto px-4 -mt-8 pb-20">
        {/* Add New Address Button */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Button
            onClick={openAdd}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold text-base shadow-lg shadow-orange-500/30 mb-6 gap-2"
          >
            <Plus className="w-5 h-5" /> Add New Address
          </Button>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : addresses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div className="text-7xl mb-4">📍</div>
            <h3 className="text-xl font-bold mb-2">No saved addresses</h3>
            <p className="text-muted-foreground mb-6">Add your home, work, or other locations for faster checkout</p>
            <Button onClick={openAdd} className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl gap-2">
              <Plus className="w-4 h-4" /> Add Your First Address
            </Button>
          </motion.div>
        ) : (
          <AnimatePresence>
            <div className="space-y-4">
              {addresses.map((addr, i) => {
                const typeInfo = getTypeInfo(addr.type);
                const TypeIcon = typeInfo.icon;
                return (
                  <motion.div
                    key={addr.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className={`border-2 transition-all duration-200 ${addr.isDefault ? 'border-orange-500/60 shadow-lg shadow-orange-500/10' : 'border-border hover:border-orange-500/30'}`}>
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${typeInfo.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                            <TypeIcon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-foreground">{addr.label}</span>
                              {addr.isDefault && (
                                <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/30 text-xs px-2 py-0.5">
                                  <Star className="w-3 h-3 mr-1" />Default
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ''}
                              {addr.landmark ? ` (Near ${addr.landmark})` : ''}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {addr.city}, {addr.state} — {addr.pincode}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                          {!addr.isDefault && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetDefault(addr)}
                              className="flex-1 rounded-xl text-xs gap-1.5 border-orange-500/30 text-orange-600 hover:bg-orange-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Set Default
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(addr)}
                            className="flex-1 rounded-xl text-xs gap-1.5"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(addr.id)}
                            disabled={deletingId === addr.id}
                            className="rounded-xl text-xs gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/30"
                          >
                            {deletingId === addr.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-r from-orange-500 to-amber-500 p-6">
            <DialogTitle className="text-white text-xl font-bold">
              {editingAddress ? '✏️ Edit Address' : '📍 Add New Address'}
            </DialogTitle>
            <DialogDescription className="text-white/80">
              {editingAddress ? 'Update your delivery address details' : 'Add a new delivery location'}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Address Type */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Address Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {ADDRESS_TYPES.map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setForm(f => ({ ...f, type: t.value as any }))}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        form.type === t.value
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                          : 'border-border hover:border-orange-500/40'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-xs font-medium">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label htmlFor="addr-label">Label (Optional)</Label>
              <Input
                id="addr-label"
                placeholder="e.g. Mom's House, Office Campus..."
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                className="mt-1 rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="addr-line1">Address Line 1 *</Label>
              <Input
                id="addr-line1"
                placeholder="Flat/Door no., Street, Area"
                value={form.addressLine1}
                onChange={e => setForm(f => ({ ...f, addressLine1: e.target.value }))}
                className="mt-1 rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="addr-line2">Address Line 2</Label>
              <Input
                id="addr-line2"
                placeholder="Colony, Building name (optional)"
                value={form.addressLine2}
                onChange={e => setForm(f => ({ ...f, addressLine2: e.target.value }))}
                className="mt-1 rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="addr-landmark">Landmark</Label>
              <Input
                id="addr-landmark"
                placeholder="Near hospital, school, etc."
                value={form.landmark}
                onChange={e => setForm(f => ({ ...f, landmark: e.target.value }))}
                className="mt-1 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="addr-city">City *</Label>
                <Input
                  id="addr-city"
                  placeholder="City"
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  className="mt-1 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="addr-pincode">Pincode *</Label>
                <Input
                  id="addr-pincode"
                  placeholder="000000"
                  value={form.pincode}
                  maxLength={6}
                  onChange={e => setForm(f => ({ ...f, pincode: e.target.value.replace(/\D/g, '') }))}
                  className="mt-1 rounded-xl"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="addr-state">State *</Label>
              <Input
                id="addr-state"
                placeholder="State"
                value={form.state}
                onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                className="mt-1 rounded-xl"
              />
            </div>

            <label className="flex items-center gap-3 p-3 rounded-xl border border-orange-500/30 bg-orange-50 dark:bg-orange-950/10 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
                className="w-4 h-4 accent-orange-500"
              />
              <div>
                <p className="text-sm font-medium">Set as default address</p>
                <p className="text-xs text-muted-foreground">Use this address for all future orders</p>
              </div>
            </label>
          </div>
          <DialogFooter className="p-6 pt-0 gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {editingAddress ? 'Update Address' : 'Save Address'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
