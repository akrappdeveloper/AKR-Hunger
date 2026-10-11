'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Address } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  Home,
  Briefcase,
  Navigation,
  Plus,
  Check,
  Search,
  ExternalLink,
  Loader2,
  AlertCircle,
  Sparkles,
  Globe,
  Edit2,
  Save,
  CheckCircle2,
  RefreshCw,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { getAccurateCurrentLocation, lookupPostalPincode, GeocodedAddress } from '@/lib/reverse-geocode';

interface DeliveryLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servicePincodes?: string[];
}

export default function DeliveryLocationDialog({
  open,
  onOpenChange,
  servicePincodes,
}: DeliveryLocationDialogProps) {
  const router = useRouter();
  const { user, customer } = useAuth();
  const { deliveryAddress, setDeliveryAddress } = useCart();

  const [searchFilter, setSearchFilter] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  // Real-time Detected Location Card State
  const [detectedGeo, setDetectedGeo] = useState<GeocodedAddress | null>(null);
  const [isEditingDetected, setIsEditingDetected] = useState(false);
  const [editedStreet, setEditedStreet] = useState('');
  const [editedArea, setEditedArea] = useState('');
  const [editedCity, setEditedCity] = useState('');
  const [editedState, setEditedState] = useState('');
  const [editedCountry, setEditedCountry] = useState('India');
  const [editedPincode, setEditedPincode] = useState('');
  const [editedPincodeStatus, setEditedPincodeStatus] = useState<string>('');

  // New Address Form State
  const [newAddrType, setNewAddrType] = useState<'home' | 'work' | 'other'>('home');
  const [street, setStreet] = useState('');
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincodeLoading, setPincodeLoading] = useState(false);

  // Auto-fetch city & state on pincode entry
  const handlePincodeChange = async (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setPincode(clean);
    if (clean.length === 6) {
      setPincodeLoading(true);
      try {
        const details = await lookupPostalPincode(clean);
        if (details.verified) {
          setCity(details.district);
          setState(details.state);
          toast.success(details.message || `Location: ${details.district}, ${details.state}`);
        } else {
          toast.info(details.message || 'Pincode not recognized in postal circle');
        }
      } catch (err) {
        console.error('Error fetching pincode:', err);
      } finally {
        setPincodeLoading(false);
      }
    }
  };

  // Select existing address
  const handleSelectAddress = (addr: Address) => {
    setDeliveryAddress(addr);
    localStorage.setItem('deliveryAddress', JSON.stringify(addr));
    toast.success(`Delivering to ${addr.type.toUpperCase()}: ${addr.city} (${addr.pincode})`);
    onOpenChange(false);
  };

  // Detected Card: handle pincode edit with postal registry verification
  const handleDetectedPincodeChange = async (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setEditedPincode(clean);
    if (clean.length === 6) {
      setPincodeLoading(true);
      try {
        const details = await lookupPostalPincode(clean);
        if (details.verified) {
          setEditedCity(details.district);
          setEditedState(details.state);
          setEditedPincodeStatus(`Verified: ${details.postOfficeName || details.district}`);
          toast.success(`Verified: ${details.district}, ${details.state}`);
        } else {
          setEditedPincodeStatus('Unverified in postal registry');
        }
      } catch {
        setEditedPincodeStatus('Could not verify pincode');
      } finally {
        setPincodeLoading(false);
      }
    } else {
      setEditedPincodeStatus('');
    }
  };

  // Use Current Location (High-Accuracy GPS + Realtime IP + Postal Geocoding)
  const handleUseCurrentLocation = async (fillFormOnly = false) => {
    setGpsLoading(true);
    try {
      toast.info('Acquiring realtime GPS, public IP & postal details...');
      const geo = await getAccurateCurrentLocation();

      setDetectedGeo(geo);
      setEditedStreet(geo.street);
      setEditedArea(geo.area);
      setEditedCity(geo.city);
      setEditedState(geo.state);
      setEditedCountry(geo.country || 'India');
      setEditedPincode(geo.pincode);
      setEditedPincodeStatus(geo.pincode ? 'Pincode resolved' : 'Please verify pincode');

      if (isAddingNew || fillFormOnly) {
        setIsAddingNew(true);
        setStreet(geo.street);
        setCity(geo.city);
        setState(geo.state);
        setPincode(geo.pincode);
        if (geo.area) setLandmark(geo.area);
        toast.success(`📍 GPS location auto-filled: ${geo.city} ${geo.pincode ? `(${geo.pincode})` : ''}`);
        return;
      }

      toast.success(`📍 Realtime location detected: ${geo.city} • PIN: ${geo.pincode || 'Manual input'}`);
    } catch (err: any) {
      toast.error(err?.message || 'Unable to retrieve location. Please check browser permissions.');
    } finally {
      setGpsLoading(false);
    }
  };

  // Confirm and set detected location as active delivery location
  const handleConfirmDetectedLocation = async (saveToProfile = false) => {
    if (!detectedGeo) return;
    const pin = editedPincode.trim() || detectedGeo.pincode || '000000';
    const finalCity = editedCity.trim() || detectedGeo.city || 'Current Location';
    const finalState = editedState.trim() || detectedGeo.state || '';
    const finalStreet = editedStreet.trim() || detectedGeo.street;
    const finalCountry = editedCountry.trim() || detectedGeo.country || 'India';
    const finalArea = editedArea.trim() || detectedGeo.area;

    const liveAddress: Address = {
      id: `gps-${Date.now()}`,
      customerId: user?.uid || 'guest',
      type: 'other',
      street: finalArea ? `${finalStreet}, ${finalArea}` : finalStreet,
      city: finalCity,
      state: finalState,
      pincode: pin,
      latitude: detectedGeo.latitude,
      longitude: detectedGeo.longitude,
      plusCode: detectedGeo.plusCode,
      isDefault: false,
      createdAt: new Date(),
    };

    setDeliveryAddress(liveAddress);
    localStorage.setItem('deliveryAddress', JSON.stringify(liveAddress));

    if (user && saveToProfile) {
      try {
        const existingAddresses: Address[] = customer?.addresses || [];
        const nonGps = existingAddresses.filter((a) => !a.id.startsWith('gps-'));
        const updatedList = [liveAddress, ...nonGps.slice(0, 8)];
        await setDoc(
          doc(db, 'customers', user.uid),
          {
            addresses: updatedList,
            updatedAt: new Date(),
          },
          { merge: true }
        );
        toast.success('Address saved to your profile!');
      } catch (dbErr) {
        console.warn('Could not archive GPS address:', dbErr);
      }
    }

    toast.success(`📍 Delivering to: ${finalCity} (${pin})`);
    onOpenChange(false);
  };

  // Save new address and select it
  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!street.trim() || !city.trim() || !pincode.trim()) {
      toast.error('Please fill in street, pincode, and city');
      return;
    }

    if (!user) {
      // Guest address session
      const tempAddress: Address = {
        id: `guest-${Date.now()}`,
        customerId: 'guest',
        type: newAddrType,
        street: landmark ? `${street} (Near ${landmark})` : street,
        city,
        state,
        pincode,
        latitude: 0,
        longitude: 0,
        isDefault: true,
        createdAt: new Date(),
      };
      setDeliveryAddress(tempAddress);
      localStorage.setItem('deliveryAddress', JSON.stringify(tempAddress));
      toast.success('Delivery location set!');
      setIsAddingNew(false);
      onOpenChange(false);
      return;
    }

    setSavingAddress(true);
    try {
      const existingAddresses: Address[] = customer?.addresses || [];
      const newAddressObj: Address = {
        id: Date.now().toString(),
        customerId: user.uid,
        type: newAddrType,
        street: landmark ? `${street} (Near ${landmark})` : street,
        city,
        state,
        pincode,
        latitude: 0,
        longitude: 0,
        isDefault: existingAddresses.length === 0,
        createdAt: new Date(),
      };

      const updatedList = [newAddressObj, ...existingAddresses];
      await setDoc(
        doc(db, 'customers', user.uid),
        {
          addresses: updatedList,
          defaultAddressId: existingAddresses.length === 0 ? newAddressObj.id : customer?.defaultAddressId,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      setDeliveryAddress(newAddressObj);
      localStorage.setItem('deliveryAddress', JSON.stringify(newAddressObj));
      toast.success('New address saved & selected!');
      setIsAddingNew(false);
      // Reset form
      setStreet('');
      setPincode('');
      setCity('');
      setState('');
      setLandmark('');
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to save address:', err);
      toast.error('Failed to save address. Please try again.');
    } finally {
      setSavingAddress(false);
    }
  };

  const addresses: Address[] = customer?.addresses || [];
  const filteredAddresses = addresses.filter((a) => {
    const query = searchFilter.toLowerCase();
    return (
      a.street?.toLowerCase().includes(query) ||
      a.city?.toLowerCase().includes(query) ||
      a.pincode?.toLowerCase().includes(query) ||
      a.type?.toLowerCase().includes(query)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-card-foreground sm:max-w-xl md:max-w-2xl p-0 overflow-hidden shadow-2xl rounded-3xl selection:bg-primary/20">
        {/* Luxury Header Banner */}
        <div className="relative p-5 sm:p-7 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border-b border-border/70">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25 ring-4 ring-primary/10">
                <MapPin className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                  Select Delivery Location
                  <Badge variant="outline" className="border-primary/40 text-primary text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {addresses.length} Saved
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs sm:text-sm mt-0.5">
                  Confirm your doorstep address for fast and fresh gourmet delivery
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Action Row: Live GPS & Add New Address Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* GPS Button */}
            <button
              type="button"
              onClick={() => handleUseCurrentLocation(false)}
              disabled={gpsLoading}
              className="flex items-center gap-3 p-3.5 rounded-2xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all text-left group cursor-pointer shadow-sm hover:border-primary/60"
            >
              <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-105 transition-transform">
                {gpsLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Navigation className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-black text-foreground flex items-center gap-1.5">
                  Use Current Location
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {gpsLoading ? 'Detecting coordinates...' : 'Fast GPS detection for accurate drop'}
                </p>
              </div>
            </button>

            {/* Add New Address Button */}
            <button
              type="button"
              onClick={() => setIsAddingNew(!isAddingNew)}
              className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left group cursor-pointer shadow-sm ${
                isAddingNew
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/80 bg-muted/40 hover:bg-muted text-foreground'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover:scale-105 ${
                isAddingNew ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground'
              }`}>
                <Plus className={`w-5 h-5 transition-transform duration-300 ${isAddingNew ? 'rotate-45' : ''}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-black text-foreground">
                  {isAddingNew ? 'Close Form' : 'Add New Address'}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {isAddingNew ? 'Click to cancel adding' : 'Save home, office or other location'}
                </p>
              </div>
            </button>
          </div>

          {/* Real-time Detected Location Card (with IP, GPS, Pincode, City, State, Country & Manual Edit) */}
          {detectedGeo && (
            <div className="p-4 sm:p-5 rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-card to-background shadow-lg space-y-4 animate-in fade-in-50 duration-300">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                    <Navigation className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                      Realtime Detected Location
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    </h4>
                    <p className="text-[11px] text-muted-foreground">Original GPS + Public IP Geolocation</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={isEditingDetected ? 'default' : 'outline'}
                    onClick={() => setIsEditingDetected(!isEditingDetected)}
                    className="h-7 px-2.5 rounded-lg text-xs font-bold gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{isEditingDetected ? 'Done Editing' : 'Manual Edit'}</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleUseCurrentLocation(false)}
                    disabled={gpsLoading}
                    className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Re-scan GPS"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                  </Button>
                  <button
                    type="button"
                    onClick={() => setDetectedGeo(null)}
                    className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Realtime Technical Telemetry Row: IP & GPS Accuracy */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/60 border border-border/60">
                  <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">Public IP Address</span>
                    <span className="font-mono font-bold text-foreground truncate block">{detectedGeo.ipAddress || '103.xxx.xxx.xxx'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/60 border border-border/60">
                  <Navigation className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">GPS Coordinates</span>
                    <span className="font-mono font-bold text-foreground truncate block">
                      {detectedGeo.latitude.toFixed(5)}°, {detectedGeo.longitude.toFixed(5)}° {detectedGeo.accuracy ? `(±${Math.round(detectedGeo.accuracy)}m)` : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Location Data Form / Display */}
              {isEditingDetected ? (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-foreground block mb-1">Street / House / Landmark</label>
                    <Input
                      value={editedStreet}
                      onChange={(e) => setEditedStreet(e.target.value)}
                      placeholder="Flat 101, Road / Landmark"
                      className="h-9 text-xs rounded-xl bg-card border-border"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-foreground block mb-1">Locality / Area</label>
                      <Input
                        value={editedArea}
                        onChange={(e) => setEditedArea(e.target.value)}
                        placeholder="e.g. Chinhat"
                        className="h-9 text-xs rounded-xl bg-card border-border"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-foreground block mb-1">
                        Pincode (6-digit) {pincodeLoading && <Loader2 className="w-3 h-3 inline animate-spin text-primary ml-1" />}
                      </label>
                      <Input
                        value={editedPincode}
                        maxLength={6}
                        onChange={(e) => handleDetectedPincodeChange(e.target.value)}
                        placeholder="e.g. 226028"
                        className="h-9 text-xs font-bold font-mono rounded-xl bg-card border-border"
                      />
                      {editedPincodeStatus && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                          {editedPincodeStatus}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-foreground block mb-1">City</label>
                      <Input
                        value={editedCity}
                        onChange={(e) => setEditedCity(e.target.value)}
                        placeholder="e.g. Lucknow"
                        className="h-9 text-xs rounded-xl bg-card border-border"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-foreground block mb-1">State</label>
                      <Input
                        value={editedState}
                        onChange={(e) => setEditedState(e.target.value)}
                        placeholder="e.g. Uttar Pradesh"
                        className="h-9 text-xs rounded-xl bg-card border-border"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-foreground block mb-1">Country</label>
                      <Input
                        value={editedCountry}
                        onChange={(e) => setEditedCountry(e.target.value)}
                        placeholder="India"
                        className="h-9 text-xs rounded-xl bg-card border-border"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-card border border-border space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        {[editedStreet, editedArea].filter(Boolean).join(', ') || 'Doorstep Location'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[editedCity, editedState, editedCountry].filter(Boolean).join(', ')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono text-sm font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20 block">
                        {editedPincode || detectedGeo.pincode || 'PIN Needed'}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1 mt-0.5">
                        <CheckCircle2 className="w-3 h-3" /> India Post
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Buttons: Deliver to this location or save */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleConfirmDetectedLocation(true)}
                  className="rounded-xl text-xs font-bold border-border hover:bg-muted"
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  Save & Deliver
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleConfirmDetectedLocation(false)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-xl text-xs px-4 shadow-md"
                >
                  <Check className="w-3.5 h-3.5 mr-1 stroke-[3]" />
                  Deliver to This Location
                </Button>
              </div>
            </div>
          )}

          {/* Inline Add Address Form */}
          {isAddingNew && (
            <form onSubmit={handleSaveNewAddress} className="p-4 sm:p-5 rounded-2xl bg-muted/40 border border-border space-y-4 animate-in fade-in-50 duration-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    New Address Details
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleUseCurrentLocation(true)}
                    disabled={gpsLoading}
                    className="h-7 px-2.5 rounded-lg text-[11px] font-bold border-primary/40 text-primary hover:bg-primary/10 gap-1 cursor-pointer"
                    title="Auto-fill form using current GPS coordinates & postal registry"
                  >
                    {gpsLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Navigation className="w-3 h-3" />
                    )}
                    <span>Auto-fill GPS</span>
                  </Button>
                </div>
                <div className="flex gap-1.5 bg-card p-1 rounded-xl border border-border">
                  {(['home', 'work', 'other'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewAddrType(type)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                        newAddrType === type
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Street / Flat / Apartment *
                </label>
                <Input
                  required
                  placeholder="e.g. Flat 402, Royal Palms, MG Road"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="bg-card border-border text-foreground placeholder:text-muted-foreground h-10 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Pincode * {pincodeLoading && <Loader2 className="w-3 h-3 inline animate-spin text-primary ml-1" />}
                  </label>
                  <Input
                    required
                    maxLength={6}
                    placeholder="e.g. 560001"
                    value={pincode}
                    onChange={(e) => handlePincodeChange(e.target.value)}
                    className="bg-card border-border text-foreground placeholder:text-muted-foreground h-10 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">City *</label>
                  <Input
                    required
                    placeholder="e.g. Bengaluru"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="bg-card border-border text-foreground placeholder:text-muted-foreground h-10 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">State</label>
                  <Input
                    placeholder="e.g. Karnataka"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="bg-card border-border text-foreground placeholder:text-muted-foreground h-10 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Landmark (Optional)
                </label>
                <Input
                  placeholder="e.g. Opposite Metro Pillar 140"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  className="bg-card border-border text-foreground placeholder:text-muted-foreground h-10 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsAddingNew(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingAddress}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-md text-xs px-5"
                >
                  {savingAddress ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    'Save & Deliver Here'
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Search Filter for saved addresses if > 2 */}
          {addresses.length > 2 && (
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search your saved addresses..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-9 h-10 text-xs rounded-xl bg-muted/40 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          )}

          {/* Saved Addresses List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              Saved Delivery Addresses
            </h4>

            {filteredAddresses.length > 0 ? (
              filteredAddresses.map((addr) => {
                const isSelected = deliveryAddress?.id === addr.id;
                const isServiceable =
                  !servicePincodes ||
                  servicePincodes.length === 0 ||
                  servicePincodes.includes(addr.pincode);

                return (
                  <div
                    key={addr.id}
                    onClick={() => handleSelectAddress(addr)}
                    className={`relative p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-start gap-3.5 group shadow-sm ${
                      isSelected
                        ? 'bg-primary/10 border-primary ring-2 ring-primary/30'
                        : 'bg-card border-border/80 hover:border-primary/40 hover:bg-muted/30'
                    }`}
                  >
                    {/* Icon Box */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition-colors ${
                        addr.type === 'home'
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                          : addr.type === 'work'
                          ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {addr.type === 'home' && <Home className="w-5 h-5" />}
                      {addr.type === 'work' && <Briefcase className="w-5 h-5" />}
                      {addr.type === 'other' && <MapPin className="w-5 h-5" />}
                    </div>

                    {/* Address Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-sm sm:text-base capitalize text-foreground">
                          {addr.type}
                        </span>
                        {addr.isDefault && (
                          <span className="text-[10px] font-extrabold bg-primary/15 text-primary px-2 py-0.5 rounded-full tracking-wide uppercase">
                            Default
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full tracking-wide uppercase flex items-center gap-1">
                            <Check className="w-3 h-3 stroke-[3]" /> Active
                          </span>
                        )}
                        {!isServiceable && (
                          <span className="text-[10px] font-bold bg-destructive/15 text-destructive px-2 py-0.5 rounded-full flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Unserviceable
                          </span>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-foreground/90 font-medium leading-relaxed">
                        {addr.street}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {addr.city}{addr.state ? `, ${addr.state}` : ''} - <span className="font-bold text-foreground">{addr.pincode}</span>
                      </p>
                    </div>

                    {/* Radio / Selection Indicator */}
                    <div className="flex-shrink-0 self-center">
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30'
                            : 'border-muted-foreground/30 group-hover:border-primary/60'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 px-4 bg-muted/20 rounded-2xl border border-dashed border-border/80 space-y-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">No addresses found</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {searchFilter ? 'No matches for your search' : 'Add your first delivery address to get started'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingNew(true)}
                  className="rounded-xl text-xs font-bold gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Address
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-muted/40 border-t border-border flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              router.push('/customer/profile');
            }}
            className="text-xs font-bold text-muted-foreground hover:text-foreground gap-1.5 rounded-xl"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Manage in Profile
          </Button>

          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs px-5 shadow-sm"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
