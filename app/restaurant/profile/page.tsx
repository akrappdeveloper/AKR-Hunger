'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Store, Save, Loader2, Camera, MapPin, Phone, Mail,
  Globe, Instagram, Facebook, CheckCircle2, AlertCircle, Tag,
  UtensilsCrossed, Star, Percent
} from 'lucide-react';
import { toast } from 'sonner';
import SafeImage from '@/components/ui/safe-image';

const CUISINE_OPTIONS = [
  'North Indian', 'South Indian', 'Chinese', 'Italian', 'Mexican',
  'Continental', 'Biryani', 'Fast Food', 'Desserts', 'Beverages',
  'Seafood', 'Mughlai', 'Thai', 'Japanese', 'Healthy',
];

const CATEGORY_OPTIONS = [
  'Restaurant', 'Cafe', 'Fast Food', 'Bakery', 'Cloud Kitchen',
  'Dhaba', 'Food Court', 'Buffet', 'Fine Dining',
];

export default function RestaurantProfilePage() {
  const { user } = useAuth();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    cuisines: [] as string[],
    phone: '',
    email: '',
    website: '',
    instagram: '',
    facebook: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    lat: '',
    lng: '',
    deliveryRadius: 5,
    minimumOrder: 100,
    deliveryFee: 30,
    packagingFee: 10,
    gstNumber: '',
    fssaiLicense: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    accountHolderName: '',
    acceptsCash: true,
    acceptsUpi: true,
    acceptsCard: true,
    isVeg: false,
    isHalal: false,
    isPureVeg: false,
    imageUrl: '',
    bannerUrl: '',
  });

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const rid = snap.data()?.restaurantId;
      if (!rid) { setLoading(false); return; }
      setRestaurantId(rid);

      onSnapshot(doc(db, 'restaurants', rid), rSnap => {
        if (rSnap.exists()) {
          const d = rSnap.data();
          setForm(prev => ({
            ...prev,
            name: d.name || '',
            description: d.description || '',
            category: d.category || '',
            cuisines: d.cuisines || [],
            phone: d.phone || '',
            email: d.email || '',
            website: d.website || '',
            instagram: d.socialLinks?.instagram || '',
            facebook: d.socialLinks?.facebook || '',
            address: d.address || '',
            city: d.city || '',
            state: d.state || '',
            pincode: d.pincode || '',
            deliveryRadius: d.deliveryRadius || 5,
            minimumOrder: d.minimumOrder || 100,
            deliveryFee: d.deliveryFee || 30,
            packagingFee: d.packagingFee || 10,
            gstNumber: d.gstNumber || '',
            fssaiLicense: d.fssaiLicense || '',
            bankName: d.bankDetails?.bankName || '',
            accountNumber: d.bankDetails?.accountNumber || '',
            ifscCode: d.bankDetails?.ifscCode || '',
            accountHolderName: d.bankDetails?.accountHolderName || '',
            acceptsCash: d.paymentMethods?.cash ?? true,
            acceptsUpi: d.paymentMethods?.upi ?? true,
            acceptsCard: d.paymentMethods?.card ?? true,
            isVeg: d.isVeg || false,
            isHalal: d.isHalal || false,
            isPureVeg: d.isPureVeg || false,
            imageUrl: d.imageUrl || '',
            bannerUrl: d.bannerUrl || '',
          }));
        }
        setLoading(false);
      });
    };
    init();
  }, [user]);

  const toggleCuisine = (c: string) => {
    setForm(prev => ({
      ...prev,
      cuisines: prev.cuisines.includes(c) ? prev.cuisines.filter(x => x !== c) : [...prev.cuisines, c],
    }));
  };

  const handleSave = async () => {
    if (!restaurantId || !form.name) { toast.error('Restaurant name is required'); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'restaurants', restaurantId), {
        name: form.name,
        description: form.description,
        category: form.category,
        cuisines: form.cuisines,
        phone: form.phone,
        email: form.email,
        website: form.website,
        socialLinks: { instagram: form.instagram, facebook: form.facebook },
        address: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        deliveryRadius: form.deliveryRadius,
        minimumOrder: form.minimumOrder,
        deliveryFee: form.deliveryFee,
        packagingFee: form.packagingFee,
        gstNumber: form.gstNumber,
        fssaiLicense: form.fssaiLicense,
        bankDetails: {
          bankName: form.bankName,
          accountNumber: form.accountNumber,
          ifscCode: form.ifscCode,
          accountHolderName: form.accountHolderName,
        },
        paymentMethods: { cash: form.acceptsCash, upi: form.acceptsUpi, card: form.acceptsCard },
        isVeg: form.isVeg,
        isHalal: form.isHalal,
        isPureVeg: form.isPureVeg,
        updatedAt: serverTimestamp(),
      });
      toast.success('Profile updated successfully!');
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const f = (field: string) => (e: any) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  const fb = (field: string) => (v: boolean) => setForm(prev => ({ ...prev, [field]: v }));

  if (loading) return <div className="flex items-center justify-center min-h-96"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Store className="w-6 h-6 text-orange-500" /> Restaurant Profile
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your restaurant's public information</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Profile
        </Button>
      </div>

      {/* Profile Images */}
      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Camera className="w-4 h-4" />Images</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Restaurant Logo URL</Label>
            <Input value={form.imageUrl} onChange={f('imageUrl')} className="mt-1 rounded-xl" placeholder="https://..." />
          </div>
          <div>
            <Label>Banner / Cover Image URL</Label>
            <Input value={form.bannerUrl} onChange={f('bannerUrl')} className="mt-1 rounded-xl" placeholder="https://..." />
          </div>
        </CardContent>
      </Card>

      {/* Basic Info */}
      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Store className="w-4 h-4" />Basic Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Restaurant Name *</Label>
            <Input value={form.name} onChange={f('name')} className="mt-1 rounded-xl" placeholder="Your Restaurant Name" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={f('description')} className="mt-1 rounded-xl resize-none" rows={3} placeholder="Tell customers what makes your restaurant special..." />
          </div>
          <div>
            <Label>Category</Label>
            <select value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))} className="w-full mt-1 h-10 rounded-xl border border-input bg-background px-3 text-sm">
              <option value="">Select category</option>
              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label>Cuisines (select all that apply)</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {CUISINE_OPTIONS.map(c => (
                <button
                  key={c}
                  onClick={() => toggleCuisine(c)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    form.cuisines.includes(c)
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'border-border hover:border-orange-400'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          {/* Food Type Badges */}
          <div className="flex flex-wrap gap-4">
            {[
              { field: 'isVeg', label: '🥬 Veg Menu' },
              { field: 'isPureVeg', label: '✅ Pure Veg' },
              { field: 'isHalal', label: '☪️ Halal Certified' },
            ].map(({ field, label }) => (
              <label key={field} className="flex items-center gap-2 cursor-pointer">
                <Switch checked={(form as any)[field]} onCheckedChange={fb(field)} />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Phone className="w-4 h-4" />Contact & Social</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={f('phone')} className="mt-1 rounded-xl" placeholder="+91 00000 00000" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={form.email} onChange={f('email')} className="mt-1 rounded-xl" placeholder="restaurant@email.com" />
          </div>
          <div>
            <Label>Website</Label>
            <Input value={form.website} onChange={f('website')} className="mt-1 rounded-xl" placeholder="https://yoursite.com" />
          </div>
          <div>
            <Label>Instagram Handle</Label>
            <Input value={form.instagram} onChange={f('instagram')} className="mt-1 rounded-xl" placeholder="@yourrestaurant" />
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4" />Location</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Full Address</Label>
            <Textarea value={form.address} onChange={f('address')} className="mt-1 rounded-xl resize-none" rows={2} placeholder="Shop/Building, Street, Area" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>City</Label>
              <Input value={form.city} onChange={f('city')} className="mt-1 rounded-xl" placeholder="City" />
            </div>
            <div>
              <Label>State</Label>
              <Input value={form.state} onChange={f('state')} className="mt-1 rounded-xl" placeholder="State" />
            </div>
            <div>
              <Label>Pincode</Label>
              <Input value={form.pincode} onChange={f('pincode')} className="mt-1 rounded-xl" placeholder="000000" maxLength={6} />
            </div>
          </div>
          <div>
            <Label>Delivery Radius (km)</Label>
            <Input type="number" value={form.deliveryRadius} onChange={f('deliveryRadius')} className="mt-1 rounded-xl w-32" min={1} max={50} />
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Percent className="w-4 h-4" />Pricing Settings</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div>
            <Label>Min. Order (₹)</Label>
            <Input type="number" value={form.minimumOrder} onChange={f('minimumOrder')} className="mt-1 rounded-xl" />
          </div>
          <div>
            <Label>Delivery Fee (₹)</Label>
            <Input type="number" value={form.deliveryFee} onChange={f('deliveryFee')} className="mt-1 rounded-xl" />
          </div>
          <div>
            <Label>Packaging Fee (₹)</Label>
            <Input type="number" value={form.packagingFee} onChange={f('packagingFee')} className="mt-1 rounded-xl" />
          </div>
        </CardContent>
      </Card>

      {/* Legal */}
      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Legal & Compliance</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>GST Number</Label>
            <Input value={form.gstNumber} onChange={f('gstNumber')} className="mt-1 rounded-xl" placeholder="22AAAAA0000A1Z5" />
          </div>
          <div>
            <Label>FSSAI License Number</Label>
            <Input value={form.fssaiLicense} onChange={f('fssaiLicense')} className="mt-1 rounded-xl" placeholder="FSSAI License No." />
          </div>
        </CardContent>
      </Card>

      {/* Bank Details */}
      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="pb-3"><CardTitle className="text-base">Bank Details (for Settlements)</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Account Holder Name</Label>
            <Input value={form.accountHolderName} onChange={f('accountHolderName')} className="mt-1 rounded-xl" />
          </div>
          <div>
            <Label>Bank Name</Label>
            <Input value={form.bankName} onChange={f('bankName')} className="mt-1 rounded-xl" />
          </div>
          <div>
            <Label>Account Number</Label>
            <Input value={form.accountNumber} onChange={f('accountNumber')} className="mt-1 rounded-xl" />
          </div>
          <div>
            <Label>IFSC Code</Label>
            <Input value={form.ifscCode} onChange={f('ifscCode')} className="mt-1 rounded-xl" placeholder="SBIN0001234" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
