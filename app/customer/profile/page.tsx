'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { Customer, Address } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, MapPin, Phone, Mail, User, Save, Edit2, Plus, Home, Briefcase, Trash2, LogOut, ChevronRight } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import ImageUploadDialog from '@/components/ImageUploadDialog';
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
import { useRef } from 'react';

export default function ProfilePage() {
  const { user, customer, logout } = useAuth();
  const [profile, setProfile] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Image Upload State
  const [imageUploadOpen, setImageUploadOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Address Dialog State
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null); // For edit mode
  const [newAddress, setNewAddress] = useState({
    street: '',
    city: '',
    state: '',
    pincode: '',
    plusCode: '',
    type: 'home' as 'home' | 'work' | 'other'
  });

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  // Image Upload Handlers
  const handleImageClick = () => {
    imageInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setSelectedImageSrc(e.target.result as string);
          setImageUploadOpen(true);
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset value to allow re-selecting same file
    event.target.value = '';
  };

  const handleCropSave = async (croppedImageBlob: Blob) => {
    if (!user) return;
    try {
      setUploadingImage(true);
      setImageUploadOpen(false); // Close dialog immediately or keep open with spinner? Let's close and show toast loading

      const storageRef = ref(storage, `profile_images/${user.uid}_${Date.now()}.jpg`);
      await uploadBytes(storageRef, croppedImageBlob);
      const downloadURL = await getDownloadURL(storageRef);

      // Update Firestore
      await updateDoc(doc(db, 'customers', user.uid), {
        avatar: downloadURL,
        updatedAt: new Date()
      });

      // Update Local State
      setProfile(prev => prev ? { ...prev, avatar: downloadURL } : null);

      // Ideally trigger auth update if context allows, but local state profile is what we display mostly.
      toast.success("Profile picture updated!");

    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };


  // Pincode Auto-fill Effect
  useEffect(() => {
    if (newAddress.pincode.length === 6) {
      fetchCityStateFromPincode(newAddress.pincode);
    }
  }, [newAddress.pincode]);

  const fetchCityStateFromPincode = async (pincode: string) => {
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();
      if (data && data[0] && data[0].Status === 'Success') {
        const postOffice = data[0].PostOffice[0];
        setNewAddress(prev => ({
          ...prev,
          city: postOffice.District,
          state: postOffice.State
        }));
        toast.success(`Location found: ${postOffice.District}, ${postOffice.State}`);
      }
    } catch (error) {
      console.error("Error fetching pincode details:", error);
    }
  };

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

  const openAddAddress = () => {
    setEditingAddressId(null);
    setNewAddress({ street: '', city: '', state: '', pincode: '', plusCode: '', type: 'home' });
    setIsAddressDialogOpen(true);
  };

  const openEditAddress = (addr: Address) => {
    setEditingAddressId(addr.id);
    setNewAddress({
      street: addr.street,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      plusCode: addr.plusCode || '',
      type: (addr.type as any) || 'home'
    });
    setIsAddressDialogOpen(true);
  };

  const handleAddressSubmit = async () => {
    if (!newAddress.street || !newAddress.city || !newAddress.pincode) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      setAddressLoading(true);

      let updatedAddresses = profile?.addresses || [];

      if (editingAddressId) {
        // Edit Mode: Update existing address
        updatedAddresses = updatedAddresses.map(a =>
          a.id === editingAddressId
            ? { ...a, ...newAddress, updatedAt: new Date() }
            : a
        );
      } else {
        // Add Mode: Create new address
        const addressData: Address = {
          id: `addr_${Date.now()}`,
          customerId: user!.uid,
          street: newAddress.street,
          city: newAddress.city,
          state: newAddress.state,
          pincode: newAddress.pincode,
          plusCode: newAddress.plusCode,
          type: newAddress.type,
          isDefault: updatedAddresses.length === 0,
          createdAt: new Date(),
          latitude: 0,
          longitude: 0
        };
        updatedAddresses = [...updatedAddresses, addressData];
      }

      // Save entire array to Firestore
      await updateDoc(doc(db, 'customers', user!.uid), {
        addresses: updatedAddresses
      });

      setIsAddressDialogOpen(false);
      setNewAddress({ street: '', city: '', state: '', pincode: '', plusCode: '', type: 'home' });
      setEditingAddressId(null);
      await loadProfile(); // Reload to sync state
      toast.success(editingAddressId ? 'Address updated' : 'Address added');
    } catch (error) {
      console.error("Error saving address:", error);
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
            <input
              type="file"
              ref={imageInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              className="hidden"
            />
            <Avatar className="w-32 h-32 border-4 border-black rounded-3xl shadow-2xl">
              <AvatarImage src={profile?.avatar || user?.photoURL || ''} className="object-cover" />
              <AvatarFallback className="bg-gray-800 text-3xl font-bold text-gray-400 rounded-3xl">
                {user?.email?.[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div
              onClick={handleImageClick}
              className="absolute bottom-2 right-2 bg-white/10 backdrop-blur-md p-2 rounded-xl text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-white/20 hover:bg-white/20"
            >
              <Camera className="w-4 h-4" />
            </div>
            {uploadingImage && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-3xl">
                <Spinner className="w-8 h-8" />
              </div>
            )}
          </div>

          <ImageUploadDialog
            isOpen={imageUploadOpen}
            onClose={() => setImageUploadOpen(false)}
            imageSrc={selectedImageSrc}
            onCropComplete={handleCropSave}
          />

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
                    <Button size="sm" onClick={openAddAddress} className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg pointer-events-auto cursor-pointer">
                      <Plus className="w-4 h-4 mr-2" /> Add New
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingAddressId ? 'Edit Address' : 'Add New Address'}</DialogTitle>
                      <DialogDescription className="text-gray-400">
                        {editingAddressId ? 'Update your' : 'Enter new'} delivery location details below.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">

                      {/* Search / Pincode Section */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="pincode" className="text-gray-300">Pincode *</Label>
                          <Input id="pincode" maxLength={6} className="bg-black/50 border-gray-700 focus:border-orange-500" placeholder="110001" value={newAddress.pincode} onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value.replace(/[^0-9]/g, '') })} />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="plusCode" className="text-gray-300">Plus Code (Optional)</Label>
                          <Input id="plusCode" className="bg-black/50 border-gray-700 focus:border-orange-500" placeholder="V2H7+FP" value={newAddress.plusCode} onChange={(e) => setNewAddress({ ...newAddress, plusCode: e.target.value })} />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="street" className="text-gray-300">Street Address *</Label>
                        <Input id="street" className="bg-black/50 border-gray-700 focus:border-orange-500" placeholder="Flat No, Building, Street" value={newAddress.street} onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="city" className="text-gray-300">City</Label>
                          <Input id="city" className="bg-black/50 border-gray-700 focus:border-orange-500" placeholder="Auto-filled" value={newAddress.city} readOnly />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="state" className="text-gray-300">State</Label>
                          <Input id="state" className="bg-black/50 border-gray-700 focus:border-orange-500" placeholder="Auto-filled" value={newAddress.state} readOnly />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label className="text-gray-300">Address Type</Label>
                        <div className="flex gap-4">
                          {['home', 'work', 'other'].map((type) => (
                            <div
                              key={type}
                              onClick={() => setNewAddress({ ...newAddress, type: type as any })}
                              className={`cursor-pointer px-4 py-2 rounded-lg border flex items-center gap-2 transition-colors capitalize ${newAddress.type === type ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-gray-700 bg-black/20 hover:bg-gray-800 text-gray-400'}`}
                            >
                              {type === 'home' && <Home className="w-4 h-4" />}
                              {type === 'work' && <Briefcase className="w-4 h-4" />}
                              {type === 'other' && <MapPin className="w-4 h-4" />}
                              {type}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddressSubmit} disabled={addressLoading} className="bg-orange-600 hover:bg-orange-700 w-full font-bold">
                        {addressLoading ? <Spinner className="w-4 h-4 mr-2" /> : (editingAddressId ? 'Update Address' : 'Save Address')}
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
                        <div className={`mt-1 w-10 h-10 rounded-full flex items-center justify-center ${(addr.type as string) === 'home' || (addr.type as string) === 'Home' ? 'bg-orange-500/10 text-orange-500' : (addr.type as string) === 'work' || (addr.type as string) === 'Work' ? 'bg-purple-500/10 text-purple-500' : 'bg-gray-700/30 text-gray-400'}`}>
                          {((addr.type as string) === 'home' || (addr.type as string) === 'Home') && <Home className="w-5 h-5" />}
                          {((addr.type as string) === 'work' || (addr.type as string) === 'Work') && <Briefcase className="w-5 h-5" />}
                          {((addr.type as string) === 'other' || (addr.type as string) === 'Other') && <MapPin className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-white capitalize">{addr.type}</p>
                            {addr.isDefault && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold uppercase">Default</span>}
                          </div>
                          <p className="text-sm text-gray-400 mt-1 max-w-[200px] sm:max-w-xs">{addr.street}</p>
                          <p className="text-sm text-gray-500">{addr.city}, {addr.pincode}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditAddress(addr)} className="text-gray-400 hover:text-blue-500 hover:bg-blue-500/10">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteAddress(addr)} className="text-gray-600 hover:text-red-500 hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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
