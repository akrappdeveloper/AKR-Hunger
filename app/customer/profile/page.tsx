'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore'; // Added onSnapshot, removed getDoc, arrayUnion
import { db } from '@/lib/firebase';
import { Customer, Address } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { Camera, MapPin, Phone, Mail, User, Save, Edit2, Plus, Home, Briefcase, Trash2, LogOut, ChevronRight, CheckCircle2, Loader2, Sparkles, LifeBuoy, ShieldCheck, AlertCircle, Gift, Navigation } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { uploadImage } from '@/lib/imageUpload';
import ImageUploadDialog from '@/components/ImageUploadDialog';
import PhoneVerificationDialog from '@/components/customer/PhoneVerificationDialog';
import MembershipCard from '@/components/customer/MembershipCard';
import ThemeToggle from '@/components/customer/ThemeToggle';
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
import { getAccurateCurrentLocation, lookupPostalPincode } from '@/lib/reverse-geocode';

export default function ProfilePage() {
  const { user, customer, logout } = useAuth();
  const [profile, setProfile] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved'); // Replaced 'saving' state

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

  // Phone Verification Dialog State
  const [isPhoneDialogOpen, setIsPhoneDialogOpen] = useState(false);

  // Real-time Profile Listener
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const unsub = onSnapshot(doc(db, 'customers', user.uid), (docSnippet) => {
      if (docSnippet.exists()) {
        const data = docSnippet.data() as Customer;
        setProfile(data);

        // Only update local form data if it's the first load or if we are not currently editing (to avoid separate cursor)
        // Ideally, for auto-save, we can just sync. But to keep it simple and responsive:
        // We update formData only if it is empty (initial load) to avoid overwriting user typing if latency.
        // Actually, let's trust the user input primarily.
        setFormData(prev => {
          // If previous name is empty, it's likely first load.
          if (!prev.name) {
            return {
              name: data.name || '',
              phone: data.phone || '',
              email: data.email || user.email || '',
            };
          }
          return prev;
        });

        // Ensure email is always synced
        setFormData(prev => ({ ...prev, email: data.email || user.email || '' }));
      }
      setLoading(false);
    }, (error) => {
      console.error("Snapshot error:", error);
      toast.error("Error connecting to live profile");
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // Auto-Save Effect (Debounced)
  useEffect(() => {
    if (!profile || !user) return;

    // Check if changes exist
    const hasChanges = formData.name !== (profile.name || '') || formData.phone !== (profile.phone || '');

    if (hasChanges) {
      setSaveStatus('saving');
      const handler = setTimeout(async () => {
        try {
          const cleanNew = (formData.phone || '').replace(/\D/g, '').slice(-10);
          const cleanOldVerified = (profile.verifiedPhone || '').replace(/\D/g, '').slice(-10);
          const stillVerified = Boolean(profile.phoneVerified && cleanNew.length === 10 && cleanNew === cleanOldVerified);

          await updateDoc(doc(db, 'customers', user.uid), {
            name: formData.name,
            phone: formData.phone,
            phoneVerified: stillVerified,
            updatedAt: new Date(),
          });
          setSaveStatus('saved');
          // No toast for auto-save to allow smooth typing
        } catch (error) {
          console.error("Auto-save error:", error);
          setSaveStatus('error');
        }
      }, 1000); // 1 second debounce

      return () => clearTimeout(handler);
    } else {
      setSaveStatus('saved');
    }
  }, [formData, profile, user]);

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
      setImageUploadOpen(false);

      // Convert Blob to File
      const file = new File([croppedImageBlob], `profile_${user.uid}_${Date.now()}.jpg`, { type: 'image/jpeg' });

      // Upload using multi-tier upload utility
      const downloadURL = await uploadImage(file, 'avatars', user.uid);

      // Update Firestore
      await updateDoc(doc(db, 'customers', user.uid), {
        avatar: downloadURL,
        updatedAt: new Date()
      });

      // onSnapshot will update local state automatically
      toast.success("Profile picture updated!");

    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };


  // GPS Auto-detect State
  const [gpsLoading, setGpsLoading] = useState(false);

  const handleGpsAutoLocate = async () => {
    setGpsLoading(true);
    try {
      toast.info('Acquiring high-accuracy GPS & postal address...');
      const geo = await getAccurateCurrentLocation();
      setNewAddress((prev) => ({
        ...prev,
        street: geo.street || prev.street,
        city: geo.city || prev.city,
        state: geo.state || prev.state,
        pincode: geo.pincode || prev.pincode,
        plusCode: geo.plusCode || prev.plusCode,
      }));
      toast.success(`📍 Location detected: ${geo.city} ${geo.pincode ? `(${geo.pincode})` : ''}`);
    } catch (err: any) {
      toast.error(err?.message || 'Unable to fetch location. Please check browser permissions.');
    } finally {
      setGpsLoading(false);
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
      const details = await lookupPostalPincode(pincode);
      if (details.verified) {
        setNewAddress((prev) => ({
          ...prev,
          city: details.district,
          state: details.state,
        }));
        toast.success(details.message || `Location found: ${details.district}, ${details.state}`);
      }
    } catch (error) {
      console.error('Error fetching pincode details:', error);
    }
  };

  // Removed loadProfile function

  // Removed handleSave function

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
      // No need to call loadProfile, onSnapshot will update state
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
      // No need to call loadProfile, onSnapshot will update state
    }
  };

  const handleSetDefault = async (addressId: string) => {
    if (!profile || !profile.addresses) return;

    // Optimistic update
    const updatedAddresses = profile.addresses.map(addr => ({
      ...addr,
      isDefault: addr.id === addressId
    }));
    setProfile({ ...profile, addresses: updatedAddresses });

    try {
      await updateDoc(doc(db, 'customers', user!.uid), {
        addresses: updatedAddresses
      });
      toast.success("Default address updated");
      // Also update local storage if this matches current logic
      const newDefault = updatedAddresses.find(a => a.id === addressId);
      if (newDefault) {
        localStorage.setItem('deliveryAddress', JSON.stringify(newDefault));
      }
    } catch (error) {
      console.error("Error setting default:", error);
      toast.error("Failed to update default address");
    }
  };


  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-40 sm:pb-24 font-sans selection:bg-primary/20">

      {/* Header Banner */}
      <div className="h-44 sm:h-60 relative overflow-hidden bg-gradient-to-r from-orange-600 via-amber-600 to-red-600">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/15 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 relative -mt-20 sm:-mt-24 z-10">

        {/* Profile Card */}
        <div className="flex flex-col md:flex-row gap-5 items-start md:items-end justify-between mb-8 bg-card/85 backdrop-blur-xl border border-border/80 p-5 sm:p-6 rounded-3xl shadow-lg">
          <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-end w-full md:w-auto">
            <div className="relative group flex-shrink-0">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl border-4 border-background bg-muted shadow-xl overflow-hidden relative">
                {profile?.avatar ? (
                  <img src={profile.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
                    <User className="w-12 h-12 sm:w-16 sm:h-16" />
                  </div>
                )}
                {/* Overlay for Image Edit */}
                <div
                  onClick={handleImageClick}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer backdrop-blur-xs text-white"
                >
                  <Camera className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Change</span>
                </div>
              </div>
              {uploadingImage && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-3xl z-20">
                  <Spinner className="w-7 h-7 text-primary" />
                </div>
              )}
              {/* Hidden Input */}
              <input
                type="file"
                ref={imageInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect}
              />
            </div>

            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-1">{formData.name || 'User'}</h1>
              <p className="text-muted-foreground text-sm font-medium">{formData.email}</p>
            </div>
          </div>

          <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive w-full sm:w-auto rounded-xl" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>

        <ImageUploadDialog
          isOpen={imageUploadOpen}
          onClose={() => setImageUploadOpen(false)}
          imageSrc={selectedImageSrc}
          onCropComplete={handleCropSave}
        />

        <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">

          {/* Left Col: Personal Info & Theme */}
          <div className="lg:col-span-2 space-y-6">

            {/* Theme & Display Preferences */}
            <div className="bg-card border border-border/80 rounded-3xl p-5 sm:p-7 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg sm:text-xl font-black flex items-center gap-2 text-foreground">
                  <Sparkles className="w-5 h-5 text-primary" /> Theme & Appearance
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Choose your theme style. Preview and switch with a single tap.
                </p>
              </div>
              <ThemeToggle variant="tiles" />
            </div>

            {/* Personal Info */}
            <div className="bg-card border border-border/80 rounded-3xl p-5 sm:p-7 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg sm:text-xl font-black flex items-center gap-2 text-foreground">
                  <User className="w-5 h-5 text-primary" /> Personal Information
                </h2>

                {/* Auto-save Status Indicator */}
                <div className="flex items-center gap-2">
                  {saveStatus === 'saving' && (
                    <div className="flex items-center gap-2 text-primary text-xs font-semibold animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </div>
                  )}
                  {saveStatus === 'saved' && (
                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                    </div>
                  )}
                  {saveStatus === 'error' && (
                    <div className="flex items-center gap-1.5 text-destructive text-xs font-bold">
                      <Loader2 className="w-3.5 h-3.5" /> Save Failed
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="pl-11 bg-muted/40 border-border text-foreground focus:border-primary/50 h-11 rounded-xl"
                      placeholder="Enter your name"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={formData.email}
                      disabled={true}
                      className="pl-11 bg-muted/20 border-border/50 text-muted-foreground h-11 rounded-xl cursor-not-allowed opacity-75"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground">Phone Number</Label>
                    {(() => {
                      const cleanCurrent = (formData.phone || '').replace(/\D/g, '').slice(-10);
                      const cleanVerified = (profile?.verifiedPhone || (profile?.phoneVerified ? profile?.phone : '') || '').replace(/\D/g, '').slice(-10);
                      const isVerified = Boolean(profile?.phoneVerified && cleanCurrent.length === 10 && cleanCurrent === cleanVerified);

                      if (isVerified) {
                        return (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase px-2 py-0.5 rounded-md inline-flex items-center gap-1 shadow-xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Verified
                          </Badge>
                        );
                      }

                      return (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            if (cleanCurrent.length < 10) {
                              toast.error('Please enter a valid 10-digit mobile number first');
                              return;
                            }
                            setIsPhoneDialogOpen(true);
                          }}
                          disabled={cleanCurrent.length < 10}
                          className="h-6 text-[11px] font-black rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-xs gap-1 px-2.5 transition-all"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" /> Verify
                        </Button>
                      );
                    })()}
                  </div>

                  <div className="relative">
                    <Phone className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                    {(() => {
                      const cleanCurrent = (formData.phone || '').replace(/\D/g, '').slice(-10);
                      const cleanVerified = (profile?.verifiedPhone || (profile?.phoneVerified ? profile?.phone : '') || '').replace(/\D/g, '').slice(-10);
                      const isVerified = Boolean(profile?.phoneVerified && cleanCurrent.length === 10 && cleanCurrent === cleanVerified);

                      return (
                        <>
                          <Input
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className={`pl-11 pr-24 bg-muted/40 border text-foreground focus:border-primary/50 h-11 rounded-xl font-medium transition-colors ${
                              isVerified ? 'border-emerald-500/40 focus:border-emerald-500' : 'border-border'
                            }`}
                            placeholder="+91 00000 00000"
                          />
                          <div className="absolute right-2 top-2">
                            {isVerified ? (
                              <span className="h-7 px-2.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-lg flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                              </span>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  if (cleanCurrent.length < 10) {
                                    toast.error('Please enter a valid 10-digit mobile number first');
                                    return;
                                  }
                                  setIsPhoneDialogOpen(true);
                                }}
                                disabled={cleanCurrent.length < 10}
                                className="h-7 text-xs font-black bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-3 shadow-xs gap-1"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" /> Verify
                              </Button>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Used for order delivery coordination & driver OTP</span>
                    {(() => {
                      const cleanCurrent = (formData.phone || '').replace(/\D/g, '').slice(-10);
                      const cleanVerified = (profile?.verifiedPhone || (profile?.phoneVerified ? profile?.phone : '') || '').replace(/\D/g, '').slice(-10);
                      const isVerified = Boolean(profile?.phoneVerified && cleanCurrent.length === 10 && cleanCurrent === cleanVerified);

                      if (!isVerified && cleanCurrent.length >= 10) {
                        return (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Unverified Number
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Addresses */}
            <div className="bg-card border border-border/80 rounded-3xl p-5 sm:p-7 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg sm:text-xl font-black flex items-center gap-2 text-foreground">
                  <MapPin className="w-5 h-5 text-primary" /> Saved Addresses
                </h2>

                <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={openAddAddress} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl pointer-events-auto cursor-pointer shadow-md">
                      <Plus className="w-4 h-4 mr-1.5" /> Add New
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border text-card-foreground sm:max-w-md shadow-2xl">
                    <DialogHeader>
                      <DialogTitle>{editingAddressId ? 'Edit Address' : 'Add New Address'}</DialogTitle>
                      <DialogDescription className="text-muted-foreground">
                        {editingAddressId ? 'Update your' : 'Enter new'} delivery location details below.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-3">
                      {/* GPS Quick Detect Button */}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleGpsAutoLocate}
                        disabled={gpsLoading}
                        className="w-full gap-2 text-xs font-bold border-primary/40 text-primary hover:bg-primary/10 rounded-xl h-10 cursor-pointer shadow-sm"
                      >
                        {gpsLoading ? (
                          <Spinner className="w-3.5 h-3.5" />
                        ) : (
                          <Navigation className="w-3.5 h-3.5 text-primary" />
                        )}
                        <span>{gpsLoading ? 'Detecting Coordinates...' : 'Auto-fill Current Location (GPS)'}</span>
                      </Button>

                      {/* Search / Pincode Section */}
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div className="grid gap-1.5">
                          <Label htmlFor="pincode" className="text-xs font-semibold text-muted-foreground">Pincode *</Label>
                          <Input id="pincode" maxLength={6} className="bg-muted/40 border-border text-foreground focus:border-primary/50 h-10 rounded-xl" placeholder="110001" value={newAddress.pincode} onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value.replace(/[^0-9]/g, '') })} />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="plusCode" className="text-xs font-semibold text-muted-foreground">Plus Code (Optional)</Label>
                          <Input id="plusCode" className="bg-muted/40 border-border text-foreground focus:border-primary/50 h-10 rounded-xl" placeholder="V2H7+FP" value={newAddress.plusCode} onChange={(e) => setNewAddress({ ...newAddress, plusCode: e.target.value })} />
                        </div>
                      </div>

                      <div className="grid gap-1.5">
                        <Label htmlFor="street" className="text-xs font-semibold text-muted-foreground">Street Address *</Label>
                        <Input id="street" className="bg-muted/40 border-border text-foreground focus:border-primary/50 h-10 rounded-xl" placeholder="Flat No, Building, Street" value={newAddress.street} onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })} />
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div className="grid gap-1.5">
                          <Label htmlFor="city" className="text-xs font-semibold text-muted-foreground">City</Label>
                          <Input id="city" className="bg-muted/20 border-border/60 text-muted-foreground h-10 rounded-xl" placeholder="Auto-filled" value={newAddress.city} readOnly />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="state" className="text-xs font-semibold text-muted-foreground">State</Label>
                          <Input id="state" className="bg-muted/20 border-border/60 text-muted-foreground h-10 rounded-xl" placeholder="Auto-filled" value={newAddress.state} readOnly />
                        </div>
                      </div>

                      <div className="grid gap-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">Address Type</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {['home', 'work', 'other'].map((type) => (
                            <div
                              key={type}
                              onClick={() => setNewAddress({ ...newAddress, type: type as any })}
                              className={`cursor-pointer px-3 py-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all capitalize text-xs font-bold ${newAddress.type === type ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                            >
                              {type === 'home' && <Home className="w-3.5 h-3.5" />}
                              {type === 'work' && <Briefcase className="w-3.5 h-3.5" />}
                              {type === 'other' && <MapPin className="w-3.5 h-3.5" />}
                              {type}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddressSubmit} disabled={addressLoading} className="bg-primary hover:bg-primary/90 text-primary-foreground w-full font-bold rounded-xl shadow-md">
                        {addressLoading ? <Spinner className="w-4 h-4 mr-2" /> : (editingAddressId ? 'Update Address' : 'Save Address')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-3">
                {profile?.addresses && profile.addresses.length > 0 ? (
                  profile.addresses.map(addr => (
                    <div key={addr.id} className="flex justify-between items-start p-3.5 sm:p-4 border border-border/70 rounded-2xl hover:border-primary/40 hover:bg-muted/30 transition-all bg-card/60 group">
                      <div className="flex gap-3 sm:gap-4 min-w-0">
                        <div className={`mt-0.5 w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${(addr.type as string) === 'home' || (addr.type as string) === 'Home' ? 'bg-blue-500/10 text-blue-500' : (addr.type as string) === 'work' || (addr.type as string) === 'Work' ? 'bg-purple-500/10 text-purple-500' : 'bg-muted text-muted-foreground'}`}>
                          {((addr.type as string) === 'home' || (addr.type as string) === 'Home') && <Home className="w-4 h-4 sm:w-5 sm:h-5" />}
                          {((addr.type as string) === 'work' || (addr.type as string) === 'Work') && <Briefcase className="w-4 h-4 sm:w-5 sm:h-5" />}
                          {((addr.type as string) === 'other' || (addr.type as string) === 'Other') && <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm sm:text-base text-foreground capitalize">{addr.type}</p>
                            {addr.isDefault && <span className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full font-bold uppercase">Default</span>}
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate max-w-[180px] sm:max-w-xs">{addr.street}</p>
                          <p className="text-xs text-muted-foreground/80">{addr.city}, {addr.pincode}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!addr.isDefault && (
                          <Button variant="ghost" size="icon" onClick={() => handleSetDefault(addr.id)} className="text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 w-8 h-8 rounded-lg" title="Set as Default">
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => openEditAddress(addr)} className="text-muted-foreground hover:text-primary hover:bg-primary/10 w-8 h-8 rounded-lg">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteAddress(addr)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 w-8 h-8 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No saved addresses</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Col: Prime & Membership */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gradient-to-br from-primary via-orange-600 to-amber-600 rounded-3xl p-6 relative overflow-hidden text-white shadow-lg shadow-primary/20">
              <div className="relative z-10">
                <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-md mb-2 text-xs font-black">PRIME MEMBER</Badge>
                <h3 className="text-xl font-black text-white mb-1">Hunger Prime Pass</h3>
                <p className="text-white/90 text-xs sm:text-sm mb-4 leading-relaxed">Enjoy zero delivery fees and priority customer support on every order!</p>
                <Button variant="secondary" className="w-full bg-white text-primary hover:bg-white/90 font-black rounded-xl shadow-md">
                  View Benefits
                </Button>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10" />
            </div>

            {/* Membership Card Section */}
            <div className='mt-6 mb-4'>
              <h3 className="text-base sm:text-lg font-black text-foreground mb-4 flex items-center gap-2">
                <span className="text-primary">◆</span> Membership Card
              </h3>
              <MembershipCard
                balance={profile?.walletBalance || 0}
                userName={formData.name || 'Valued Customer'}
                membershipId={profile?.membershipId}
              />
            </div>

            {/* Refer & Earn Navigation Card */}
            <div className='mb-3'>
              <Link href="/customer/referral" className="block w-full">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-card border border-orange-500/30 hover:border-orange-500 hover:bg-orange-500/10 transition-all flex items-center justify-between group shadow-xs cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Gift className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-foreground">Refer & Earn ₹50 Cash</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          Live Tracking
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Invite friends, get ₹50 free wallet balance each</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            </div>

            {/* Help & Support Navigation Card */}
            <div className='mb-20 md:mb-0'>
              <Link href="/customer/support" className="block w-full">
                <div className="p-4 rounded-2xl bg-card border border-border/80 hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-between group shadow-xs cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                      <LifeBuoy className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Help & Support Center</h4>
                      <p className="text-xs text-muted-foreground">Order issues, AI chatbot, tickets & refunds</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* Luxury Phone Verification OTP Dialog */}
      {user && (
        <PhoneVerificationDialog
          isOpen={isPhoneDialogOpen}
          onClose={() => setIsPhoneDialogOpen(false)}
          phoneNumber={formData.phone}
          customerId={user.uid}
          onSuccess={(verifiedPhone) => {
            setFormData((prev) => ({ ...prev, phone: verifiedPhone }));
            setProfile((prev) =>
              prev
                ? {
                    ...prev,
                    phone: verifiedPhone,
                    phoneVerified: true,
                    verifiedPhone: verifiedPhone.replace(/\D/g, '').slice(-10),
                  }
                : null
            );
          }}
        />
      )}
    </div>
  );
}
