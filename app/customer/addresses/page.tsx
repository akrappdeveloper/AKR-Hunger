'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import {
  doc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
  deleteDoc,
  setDoc,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Home,
  Briefcase,
  Building2,
  CheckCircle2,
  ArrowLeft,
  Navigation,
  Loader2,
  Star,
  Check,
  Compass,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface Address {
  id: string;
  customerId?: string;
  label?: string;
  type: 'home' | 'work' | 'other';
  street: string;
  addressLine1?: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  createdAt?: any;
}

const ADDRESS_TYPES = [
  { value: 'home', label: 'Home', icon: Home, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  { value: 'work', label: 'Work', icon: Briefcase, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  { value: 'other', label: 'Other', icon: Building2, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
];

const emptyForm = {
  type: 'home' as 'home' | 'work' | 'other',
  street: '',
  city: '',
  state: '',
  pincode: '',
  landmark: '',
  isDefault: false,
};

export default function AddressesPage() {
  const { user, customer } = useAuth();
  const { setDeliveryAddress } = useCart();
  const router = useRouter();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);

  // Real-time synchronization with Firestore customers/{user.uid}
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, 'customers', user.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const rawList: any[] = data.addresses || [];
          const normalized: Address[] = rawList.map((a: any, idx: number) => ({
            id: a.id || `addr-${idx}`,
            customerId: a.customerId || user.uid,
            type: a.type || 'home',
            street: a.street || a.addressLine1 || '',
            addressLine1: a.addressLine1 || a.street || '',
            addressLine2: a.addressLine2 || '',
            city: a.city || '',
            state: a.state || '',
            pincode: a.pincode || '',
            landmark: a.landmark || '',
            latitude: a.latitude || 0,
            longitude: a.longitude || 0,
            isDefault: a.isDefault || a.id === data.defaultAddressId,
            createdAt: a.createdAt,
          }));

          setAddresses(normalized);
          setDefaultId(data.defaultAddressId || (normalized.find((a) => a.isDefault)?.id ?? null));
        } else {
          setAddresses([]);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching addresses:', error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  // Open Add Dialog
  const openAdd = () => {
    setEditingAddress(null);
    setForm({
      ...emptyForm,
      isDefault: addresses.length === 0,
    });
    setDialogOpen(true);
  };

  // Open Edit Dialog
  const openEdit = (addr: Address) => {
    setEditingAddress(addr);
    setForm({
      type: addr.type,
      street: addr.street || addr.addressLine1 || '',
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      landmark: addr.landmark || '',
      isDefault: addr.isDefault || addr.id === defaultId,
    });
    setDialogOpen(true);
  };

  // Pincode auto-lookup
  const handlePincodeChange = async (val: string) => {
    setForm((prev) => ({ ...prev, pincode: val }));
    if (val.length === 6 && /^\d+$/.test(val)) {
      setPincodeLoading(true);
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${val}`);
        const data = await res.json();
        if (data && data[0] && data[0].Status === 'Success') {
          const po = data[0].PostOffice[0];
          setForm((prev) => ({
            ...prev,
            city: po.District || po.Division || prev.city,
            state: po.State || prev.state,
          }));
          toast.success(`Detected: ${po.District}, ${po.State}`);
        }
      } catch (err) {
        console.warn('Pincode fetch error:', err);
      } finally {
        setPincodeLoading(false);
      }
    }
  };

  // GPS auto-locate
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
          );
          const data = await res.json();
          if (data && data.address) {
            const addr = data.address;
            const road = addr.road || addr.suburb || addr.neighbourhood || '';
            const detectedCity = addr.city || addr.town || addr.county || '';
            const detectedState = addr.state || '';
            const detectedPostcode = (addr.postcode || '').replace(/\D/g, '').slice(0, 6);

            setForm((prev) => ({
              ...prev,
              street: road || prev.street || data.display_name.split(',')[0],
              city: detectedCity || prev.city,
              state: detectedState || prev.state,
              pincode: detectedPostcode || prev.pincode,
            }));
            toast.success('Live GPS address detected!');
          }
        } catch (err) {
          toast.error('Could not reverse geocode location');
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        toast.error('Unable to fetch GPS position. Check browser permissions.');
      },
      { timeout: 10000 }
    );
  };

  // Save or Update Address in Firebase
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please log in to save addresses');
      return;
    }

    if (!form.street.trim() || !form.city.trim() || !form.pincode.trim()) {
      toast.error('Please fill in complete street, city, and 6-digit pincode');
      return;
    }

    setSaving(true);
    try {
      const isFirst = addresses.length === 0;
      const willBeDefault = form.isDefault || isFirst;

      let updatedList: Address[];
      let targetId = editingAddress?.id || Date.now().toString();

      if (editingAddress) {
        // Update existing address
        updatedList = addresses.map((a) => {
          if (a.id === editingAddress.id) {
            return {
              ...a,
              type: form.type,
              street: form.street.trim(),
              addressLine1: form.street.trim(),
              city: form.city.trim(),
              state: form.state.trim(),
              pincode: form.pincode.trim(),
              landmark: form.landmark.trim(),
              isDefault: willBeDefault,
            };
          }
          return willBeDefault ? { ...a, isDefault: false } : a;
        });
      } else {
        // Add new address
        const newAddressObj: Address = {
          id: targetId,
          customerId: user.uid,
          type: form.type,
          street: form.street.trim(),
          addressLine1: form.street.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
          landmark: form.landmark.trim(),
          isDefault: willBeDefault,
          latitude: 0,
          longitude: 0,
          createdAt: new Date(),
        };

        const existingUnset = willBeDefault
          ? addresses.map((a) => ({ ...a, isDefault: false }))
          : addresses;

        updatedList = [newAddressObj, ...existingUnset];
      }

      const newDefaultId = willBeDefault ? targetId : defaultId || updatedList[0]?.id;

      // 1. Update Firestore customers/{user.uid}
      await updateDoc(doc(db, 'customers', user.uid), {
        addresses: updatedList,
        defaultAddressId: newDefaultId,
        updatedAt: new Date(),
      });

      // 2. Dual-sync with users/{user.uid}/addresses subcollection for backward compatibility
      try {
        const subColDoc = doc(db, 'users', user.uid, 'addresses', targetId);
        await setDoc(subColDoc, {
          id: targetId,
          type: form.type,
          street: form.street.trim(),
          addressLine1: form.street.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
          landmark: form.landmark.trim(),
          isDefault: willBeDefault,
          updatedAt: new Date(),
        });
      } catch (_) {}

      // 3. If set as default, update active cart/session delivery address
      if (willBeDefault) {
        const defaultObj = updatedList.find((a) => a.id === targetId);
        if (defaultObj) {
          setDeliveryAddress(defaultObj as any);
          localStorage.setItem('deliveryAddress', JSON.stringify(defaultObj));
        }
      }

      toast.success(editingAddress ? 'Address updated successfully!' : 'New address added!');
      setDialogOpen(false);
    } catch (err) {
      console.error('Failed to save address:', err);
      toast.error('Failed to save address. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Set Address as Default
  const handleSetDefault = async (addr: Address) => {
    if (!user) return;
    try {
      const updatedList = addresses.map((a) => ({
        ...a,
        isDefault: a.id === addr.id,
      }));

      await updateDoc(doc(db, 'customers', user.uid), {
        addresses: updatedList,
        defaultAddressId: addr.id,
        updatedAt: new Date(),
      });

      setDeliveryAddress(addr as any);
      localStorage.setItem('deliveryAddress', JSON.stringify(addr));
      toast.success(`Default delivery address set to ${addr.type.toUpperCase()}`);
    } catch (err) {
      toast.error('Failed to set default address');
    }
  };

  // Delete Address
  const handleDelete = async (addrId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to remove this delivery address?')) return;

    try {
      const updatedList = addresses.filter((a) => a.id !== addrId);
      const isDeletingDefault = addrId === defaultId;
      const newDefaultId = isDeletingDefault ? updatedList[0]?.id || null : defaultId;

      await updateDoc(doc(db, 'customers', user.uid), {
        addresses: updatedList,
        defaultAddressId: newDefaultId,
        updatedAt: new Date(),
      });

      // Also remove from subcollection
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'addresses', addrId));
      } catch (_) {}

      toast.success('Address removed');
    } catch (err) {
      toast.error('Failed to delete address');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 selection:bg-primary/20">
      {/* Top Header Banner matching Customer Panel */}
      <div className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-primary/5 to-transparent border-b border-border/50 py-8 sm:py-12">
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link
              href="/customer/profile"
              className="inline-flex items-center gap-1.5 hover:text-foreground font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Profile
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                  <MapPin className="w-5 h-5" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  Saved Addresses
                </h1>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-bold">
                  {addresses.length} {addresses.length === 1 ? 'saved' : 'saved'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                Manage your home, office, and other delivery locations for lightning-fast checkout.
              </p>
            </div>

            <Button
              onClick={openAdd}
              size="lg"
              className="rounded-2xl gap-2 font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
            >
              <Plus className="w-4 h-4" /> Add New Address
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 rounded-3xl bg-muted/40 animate-pulse border border-border/50"
              />
            ))}
          </div>
        ) : addresses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <AnimatePresence>
              {addresses.map((addr, index) => {
                const isDefault = addr.isDefault || addr.id === defaultId;
                const typeObj =
                  ADDRESS_TYPES.find((t) => t.value === addr.type) || ADDRESS_TYPES[0];
                const IconComponent = typeObj.icon;

                return (
                  <motion.div
                    key={addr.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                  >
                    <Card
                      className={`relative rounded-3xl border transition-all duration-300 overflow-hidden group bg-card ${
                        isDefault
                          ? 'border-primary/60 shadow-lg shadow-primary/5 ring-1 ring-primary/30'
                          : 'border-border/70 hover:border-primary/40 hover:shadow-md'
                      }`}
                    >
                      <CardContent className="p-5 sm:p-6 flex flex-col justify-between h-full">
                        <div>
                          {/* Top Row: Type Badge + Default Badge */}
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${typeObj.color}`}
                            >
                              <IconComponent className="w-3.5 h-3.5" />
                              <span className="capitalize">{addr.type}</span>
                            </span>

                            {isDefault ? (
                              <Badge className="bg-primary text-primary-foreground font-bold text-[11px] gap-1 px-2.5 py-0.5 rounded-full shadow-sm">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Default Address
                              </Badge>
                            ) : (
                              <button
                                onClick={() => handleSetDefault(addr)}
                                className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                              >
                                Set as Default
                              </button>
                            )}
                          </div>

                          {/* Address Details */}
                          <div className="space-y-1 mb-4">
                            <p className="text-base font-bold text-foreground leading-snug break-words">
                              {addr.street}
                            </p>
                            {addr.landmark && (
                              <p className="text-xs text-muted-foreground font-medium">
                                Landmark: <span className="text-foreground">{addr.landmark}</span>
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {addr.city}, {addr.state} —{' '}
                              <span className="font-semibold text-foreground">{addr.pincode}</span>
                            </p>
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(addr)}
                            className="rounded-xl gap-1.5 text-xs font-semibold hover:bg-muted"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-muted-foreground" /> Edit
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(addr.id)}
                            className="rounded-xl gap-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          /* Empty State */
          <div className="max-w-md mx-auto text-center py-16 px-4">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-muted/60 border border-border/60 flex items-center justify-center text-muted-foreground mb-4">
              <Compass className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">No delivery addresses saved</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-6">
              Add your home, office, or favorite spots to get your food delivered seamlessly with a single click.
            </p>
            <Button
              onClick={openAdd}
              size="lg"
              className="rounded-2xl gap-2 font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/25"
            >
              <Plus className="w-4 h-4" /> Add Delivery Address
            </Button>
          </div>
        )}
      </div>

      {/* Add / Edit Address Dialog Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-card text-card-foreground border-border/80 shadow-2xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground">
              {editingAddress ? 'Edit Address' : 'Add New Address'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Provide complete delivery address details for fast and accurate order delivery.
            </DialogDescription>
          </DialogHeader>

          {/* Quick GPS Auto-fill Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleUseCurrentLocation}
            disabled={gpsLoading}
            className="w-full rounded-2xl gap-2 font-semibold border-primary/30 text-primary hover:bg-primary/10 transition-colors my-1"
          >
            {gpsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Navigation className="w-4 h-4" />
            )}
            Use Current Location (GPS)
          </Button>

          <form onSubmit={handleSave} className="space-y-4 mt-2">
            {/* Address Type Selector */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                Address Type
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {ADDRESS_TYPES.map((t) => {
                  const Icon = t.icon;
                  const isSelected = form.type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, type: t.value as any }))}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border text-xs font-bold transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary shadow-sm'
                          : 'border-border/60 hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Street / Building Address */}
            <div className="space-y-1.5">
              <Label htmlFor="street" className="text-xs font-bold text-foreground">
                Flat, House no., Building, Street *
              </Label>
              <Input
                id="street"
                required
                value={form.street}
                onChange={(e) => setForm((prev) => ({ ...prev, street: e.target.value }))}
                placeholder="e.g. Flat 402, Sunshine Apartments, 12th Main"
                className="rounded-xl bg-muted/50 border-border/70 text-sm"
              />
            </div>

            {/* Landmark */}
            <div className="space-y-1.5">
              <Label htmlFor="landmark" className="text-xs font-bold text-foreground">
                Landmark (Optional)
              </Label>
              <Input
                id="landmark"
                value={form.landmark}
                onChange={(e) => setForm((prev) => ({ ...prev, landmark: e.target.value }))}
                placeholder="e.g. Near Metro Station / Opposite City Mall"
                className="rounded-xl bg-muted/50 border-border/70 text-sm"
              />
            </div>

            {/* Pincode & City */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pincode" className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Pincode *</span>
                  {pincodeLoading && <span className="text-[10px] text-primary animate-pulse">Detecting...</span>}
                </Label>
                <Input
                  id="pincode"
                  required
                  maxLength={6}
                  value={form.pincode}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  placeholder="6-digit Pincode"
                  className="rounded-xl bg-muted/50 border-border/70 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-xs font-bold text-foreground">
                  City *
                </Label>
                <Input
                  id="city"
                  required
                  value={form.city}
                  onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="e.g. Mumbai, Bengaluru"
                  className="rounded-xl bg-muted/50 border-border/70 text-sm"
                />
              </div>
            </div>

            {/* State */}
            <div className="space-y-1.5">
              <Label htmlFor="state" className="text-xs font-bold text-foreground">
                State
              </Label>
              <Input
                id="state"
                value={form.state}
                onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
                placeholder="e.g. Maharashtra, Karnataka"
                className="rounded-xl bg-muted/50 border-border/70 text-sm"
              />
            </div>

            {/* Set as Default Checkbox */}
            <label className="flex items-center gap-2.5 pt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary accent-primary"
              />
              <span className="text-xs font-semibold text-foreground">
                Make this my default delivery address
              </span>
            </label>

            <DialogFooter className="pt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="rounded-xl flex-1 font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="rounded-xl flex-1 font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Saving...
                  </>
                ) : editingAddress ? (
                  'Update Address'
                ) : (
                  'Save Address'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
