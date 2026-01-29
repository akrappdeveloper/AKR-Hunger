'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Customer, Address } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, MapPin, Phone, Mail, User, Save, Edit2, Plus, Home, Briefcase, Trash2, LogOut, ChevronRight } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from 'sonner';

export default function ProfilePage() {
  const { user, customer, logout } = useAuth();
  const [profile, setProfile] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Address Dialog State
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [newAddress, setNewAddress] = useState({
    street: '',
    city: '',
    state: '',
    pincode: '',
    type: 'Home' as 'Home' | 'Work' | 'Other'
  });

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, 'customers', user!.uid);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = snapshot.data() as Customer;
        setProfile(data);
        setFormData({
          name: data.name || '',
          phone: data.phone || '',
          email: data.email || user!.email || '',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateDoc(doc(db, 'customers', user!.uid), {
        name: formData.name,
        phone: formData.phone,
        updatedAt: new Date(),
      });
      setIsEditing(false);
      await loadProfile();
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAddress = async () => {
    if (!newAddress.street || !newAddress.city || !newAddress.pincode) {
      toast.error("Please fill all address fields");
      return;
    }

    try {
      setAddressLoading(true);
      const addressData: Address = {
        id: `addr_${Date.now()}`,
        customerId: user!.uid,
        street: newAddress.street,
        city: newAddress.city,
        state: newAddress.state,
        pincode: newAddress.pincode,
        country: 'India', // Type requirement, though unused
        type: newAddress.type,
        isDefault: (profile?.addresses?.length || 0) === 0,
        createdAt: new Date(),
        latitude: 0,
        longitude: 0
      };

      await updateDoc(doc(db, 'customers', user!.uid), {
        addresses: arrayUnion(addressData)
      });

      setIsAddressDialogOpen(false);
      setNewAddress({ street: '', city: '', state: '', pincode: '', type: 'Home' });
      await loadProfile();
      toast.success('Address added successfully');
    } catch (error) {
      console.error("Error adding address:", error);
      toast.error("Failed to save address");
    } finally {
      setAddressLoading(false);
    }
  };

  const handleDeleteAddress = async (addressToDelete: Address) => {
    if (!profile) return;
    const updatedAddresses = profile.addresses?.filter(a => a.id !== addressToDelete.id) || [];

    // Optimistic update
    setProfile({ ...profile, addresses: updatedAddresses });

    try {
      await updateDoc(doc(db, 'customers', user!.uid), {
        addresses: updatedAddresses
      });
      toast.success('Address removed');
    } catch (err) {
      console.error("Error deleting address:", err);
      toast.error('Failed to remove address');
      await loadProfile(); // Revert
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20 font-sans selection:bg-orange-500/30">

      {/* Header Banner */}
      <div className="h-64 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600 to-red-600 opacity-90" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30" />
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black to-transparent" />
      </div>

      <div className="max-w-4xl mx-auto px-4 relative -mt-24 z-10">

        {/* Profile Card */}
        <div className="flex flex-col md:flex-row gap-6 items-end md:items-center mb-8">
          <div className="relative group">
            <Avatar className="w-32 h-32 border-4 border-black rounded-3xl shadow-2xl">
              <AvatarImage src={user?.photoURL || ''} className="object-cover" />
              <AvatarFallback className="bg-gray-800 text-3xl font-bold text-gray-400 rounded-3xl">
                {user?.email?.[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute bottom-2 right-2 bg-white/10 backdrop-blur-md p-2 rounded-xl text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-white/20">
              <Camera className="w-4 h-4" />
            </div>
          </div>

          <div className="flex-1 mb-2">
            <h1 className="text-4xl font-black text-white mb-1">{formData.name || 'User'}</h1>
            <p className="text-gray-400 font-medium">{formData.email}</p>
          </div>

          <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">

          {/* Left Col: Personal Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-900/50 backdrop-blur-md border border-white/5 rounded-3xl p-6 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <User className="w-5 h-5 text-orange-500" /> Personal Information
                </h2>
                {!isEditing ? (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10">
                    <Edit2 className="w-4 h-4 mr-2" /> Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="text-gray-400">Cancel</Button>
                    <Button size="sm" onClick={handleSave} disabled={saving} className="bg-orange-600 hover:bg-orange-700 font-bold">
                      {saving ? <Spinner className="w-4 h-4" /> : 'Save Changes'}
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-400">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-4 top-3.5 w-4 h-4 text-gray-500" />
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={!isEditing}
                      className="pl-11 bg-black/40 border-gray-800 text-white focus:border-orange-500 h-12 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-400">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-3.5 w-4 h-4 text-gray-500" />
                    <Input
                      value={formData.email}
                      disabled={true}
                      className="pl-11 bg-black/20 border-gray-800 text-gray-500 h-12 rounded-xl cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-400">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-3.5 w-4 h-4 text-gray-500" />
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      disabled={!isEditing}
                      className="pl-11 bg-black/40 border-gray-800 text-white focus:border-orange-500 h-12 rounded-xl"
                      placeholder="+91 00000 00000"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Addresses */}
            <div className="bg-gray-900/50 backdrop-blur-md border border-white/5 rounded-3xl p-6 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-500" /> Saved Addresses
                </h2>

                <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg pointer-events-auto cursor-pointer">
                      <Plus className="w-4 h-4 mr-2" /> Add New
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Address</DialogTitle>
                      <DialogDescription className="text-gray-400">
                        Enter your delivery location details below.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="street" className="text-gray-300">Street Address</Label>
                        <Input id="street" className="bg-black/50 border-gray-700 focus:border-orange-500" placeholder="Flat No, Building, Street" value={newAddress.street} onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="city" className="text-gray-300">City</Label>
                          <Input id="city" className="bg-black/50 border-gray-700 focus:border-orange-500" placeholder="City" value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="pincode" className="text-gray-300">Pincode</Label>
                          <Input id="pincode" className="bg-black/50 border-gray-700 focus:border-orange-500" placeholder="110001" value={newAddress.pincode} onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })} />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-gray-300">Address Type</Label>
                        <div className="flex gap-4">
                          {['Home', 'Work', 'Other'].map((type) => (
                            <div
                              key={type}
                              onClick={() => setNewAddress({ ...newAddress, type: type as any })}
                              className={`cursor-pointer px-4 py-2 rounded-lg border flex items-center gap-2 transition-colors ${newAddress.type === type ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-gray-700 bg-black/20 hover:bg-gray-800 text-gray-400'}`}
                            >
                              {type === 'Home' && <Home className="w-4 h-4" />}
                              {type === 'Work' && <Briefcase className="w-4 h-4" />}
                              {type === 'Other' && <MapPin className="w-4 h-4" />}
                              {type}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddAddress} disabled={addressLoading} className="bg-orange-600 hover:bg-orange-700 w-full font-bold">
                        {addressLoading ? <Spinner className="w-4 h-4 mr-2" /> : 'Save Address'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-4">
                {profile?.addresses && profile.addresses.length > 0 ? (
                  profile.addresses.map(addr => (
                    <div key={addr.id} className="flex justify-between items-start p-4 border border-white/5 rounded-xl hover:bg-white/5 transition-colors bg-black/20 group">
                      <div className="flex gap-4">
                        <div className={`mt-1 w-10 h-10 rounded-full flex items-center justify-center ${addr.type === 'Home' ? 'bg-orange-500/10 text-orange-500' : addr.type === 'Work' ? 'bg-purple-500/10 text-purple-500' : 'bg-gray-700/30 text-gray-400'}`}>
                          {addr.type === 'Home' && <Home className="w-5 h-5" />}
                          {addr.type === 'Work' && <Briefcase className="w-5 h-5" />}
                          {addr.type === 'Other' && <MapPin className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-white">{addr.type}</p>
                            {addr.isDefault && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold uppercase">Default</span>}
                          </div>
                          <p className="text-sm text-gray-400 mt-1 max-w-[200px] sm:max-w-xs">{addr.street}</p>
                          <p className="text-sm text-gray-500">{addr.city}, {addr.pincode}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteAddress(addr)} className="text-gray-600 hover:text-red-500 hover:bg-red-500/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-2">No addresses saved</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Col: Quick Stats or Ads */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl p-6 relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-xl font-bold text-white mb-2">AKR Prime Member</h3>
                <p className="text-indigo-200 text-sm mb-4">You're saving 20% on all delivery charges!</p>
                <Button variant="secondary" className="w-full bg-white text-indigo-900 hover:bg-indigo-50 font-bold">
                  View Benefits
                </Button>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
