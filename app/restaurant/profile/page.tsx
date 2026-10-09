'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { db } from '@/lib/firebase';
import {
  doc, onSnapshot, updateDoc, setDoc, getDoc, serverTimestamp,
  collection, query, where, getDocs
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Store, Save, Loader2, Camera, MapPin, Phone, Mail,
  Globe, Instagram, Facebook, CheckCircle2, AlertCircle, Tag,
  UtensilsCrossed, Star, Percent, Compass, ShieldCheck, Eye, EyeOff,
  UploadCloud, RefreshCw, Check, Sparkles, Building2, CreditCard,
  ChevronRight, Share2, Info, Map as MapIcon, Image as ImageIcon,
  Clock, IndianRupee, Landmark, ExternalLink, SlidersHorizontal,
  Flame, HeartHandshake, FileCheck, CheckCircle, Navigation, Plus, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import SafeImage from '@/components/ui/safe-image';
import MapPickerDialog, { PickedLocation } from '@/components/restaurant/MapPickerDialog';
import { uploadImage } from '@/lib/imageUpload';
import { uploadToCloudinary } from '@/lib/cloudinary';

const CUISINE_OPTIONS = [
  'North Indian', 'South Indian', 'Biryani', 'Chinese', 'Mughlai',
  'Fast Food', 'Street Food', 'Italian', 'Pizza', 'Burgers',
  'Mexican', 'Continental', 'Tandoor', 'Beverages', 'Desserts',
  'Bakery', 'Seafood', 'Healthy Food', 'Rolls', 'Momos',
  'Japanese', 'Thai', 'Chaat', 'Thali'
];

const CATEGORY_OPTIONS = [
  { value: 'Fine Dining', label: 'Fine Dining (Luxury & Table Service)' },
  { value: 'Casual Dining', label: 'Casual Dining (Family Restaurant)' },
  { value: 'Cloud Kitchen', label: 'Cloud Kitchen (Delivery-Only Kitchen)' },
  { value: 'Cafe', label: 'Cafe & Bistro' },
  { value: 'Fast Food', label: 'Quick Service / Fast Food' },
  { value: 'Bakery', label: 'Bakery & Confectionery' },
  { value: 'Dhaba', label: 'Traditional Dhaba' },
  { value: 'Food Court', label: 'Mall Food Court / Kiosk' },
  { value: 'Dessert Parlour', label: 'Dessert & Ice Cream Parlour' },
];

const DIETARY_OPTIONS = [
  {
    field: 'isVeg',
    title: 'Veg Options Available',
    description: 'Vegetarian dishes available on the menu',
    icon: '🥬',
    badgeText: 'VEG AVAILABLE',
  },
  {
    field: 'isPureVeg',
    title: '100% Pure Veg Kitchen',
    description: 'Strictly vegetarian kitchen, zero non-veg prepared',
    icon: '✅',
    badgeText: '100% PURE VEG',
  },
  {
    field: 'isJainFriendly',
    title: 'Jain Friendly Options',
    description: 'No onion, no garlic & root-vegetable-free preparation',
    icon: '🌿',
    badgeText: 'JAIN AVAILABLE',
  },
  {
    field: 'isGlutenFree',
    title: 'Gluten-Free Choices',
    description: 'Wheat-free, celiac friendly recipes available',
    icon: '🌾',
    badgeText: 'GLUTEN-FREE',
  },
  {
    field: 'isKetoFriendly',
    title: 'Keto & Healthy Menu',
    description: 'Low-carb, high-protein & fitness-conscious meals',
    icon: '🥣',
    badgeText: 'KETO / HEALTHY',
  },
  {
    field: 'isLateNight',
    title: 'Late Night Delivery',
    description: 'Kitchen operates past midnight for late cravings',
    icon: '🌙',
    badgeText: 'LATE NIGHT',
  },
  {
    field: 'isEcoPackaging',
    title: 'Eco-Friendly Packaging',
    description: '100% biodegradable or plastic-free containers',
    icon: '📦',
    badgeText: 'ECO-PACKAGING',
  },
  {
    field: 'isKidsFriendly',
    title: 'Kids & Family Friendly',
    description: 'Mild spices & child-friendly portions available',
    icon: '👶',
    badgeText: 'KIDS FRIENDLY',
  },
  {
    field: 'isFreshlyPrepared',
    title: 'Fresh Daily Preparation',
    description: 'Cooked fresh on order, zero pre-frozen food',
    icon: '🧊',
    badgeText: 'FRESH PREP',
  },
];

export default function RestaurantProfilePage() {
  const { user: generalUser } = useAuth();
  const { user: restaurantUser, restaurant: authRestaurant } = useRestaurantAuth();
  const activeUser = restaurantUser || generalUser;

  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const [pincodeValidating, setPincodeValidating] = useState(false);
  const [pincodeSuccessMsg, setPincodeSuccessMsg] = useState('');
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [activeTab, setActiveTab] = useState('brand');

  // Image upload states
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoProgress, setLogoProgress] = useState(0);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerProgress, setBannerProgress] = useState(0);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'Casual Dining',
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
    servicePincodes: [] as string[],
    minimumOrder: 0, // Default 0: No Minimum Limit
    deliveryFee: 30, // Default standard delivery fee
    packagingFee: 10, // Default eco packaging fee
    gstNumber: '',
    fssaiLicense: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    accountHolderName: '',
    acceptsCash: true, // Default enabled
    acceptsUpi: true, // Default enabled
    acceptsCard: true, // Default enabled
    isVeg: false,
    isPureVeg: false,
    isJainFriendly: false,
    isGlutenFree: false,
    isKetoFriendly: false,
    isLateNight: false,
    isEcoPackaging: false,
    isKidsFriendly: false,
    isFreshlyPrepared: false,
    imageUrl: '',
    bannerUrl: '',
    isOpen: true,
    rating: 4.8,
    totalReviews: 0,
  });

  // Service Pincodes helper states
  const [newServicePincode, setNewServicePincode] = useState('');
  const [addingPincode, setAddingPincode] = useState(false);

  const handleAddServicePincode = async () => {
    const cleanPin = newServicePincode.replace(/\D/g, '').slice(0, 6);
    if (cleanPin.length !== 6) {
      toast.error('Please enter a valid 6-digit postal pincode');
      return;
    }
    if (form.servicePincodes.includes(cleanPin)) {
      toast.info(`PIN ${cleanPin} is already in your service area`);
      setNewServicePincode('');
      return;
    }

    setAddingPincode(true);
    let areaName = '';
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
      const data = await res.json();
      if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
        areaName = data[0].PostOffice[0].District || data[0].PostOffice[0].Name || '';
      }
    } catch { }

    setForm(prev => ({
      ...prev,
      servicePincodes: [...prev.servicePincodes, cleanPin]
    }));
    toast.success(`Added PIN ${cleanPin}${areaName ? ` (${areaName})` : ''} to delivery coverage!`);
    setNewServicePincode('');
    setAddingPincode(false);
  };

  const handleRemoveServicePincode = (pin: string) => {
    setForm(prev => ({
      ...prev,
      servicePincodes: prev.servicePincodes.filter(p => p !== pin)
    }));
    toast.info(`Removed PIN ${pin} from delivery coverage`);
  };

  const handleAddCurrentPincodeToService = () => {
    if (!form.pincode || form.pincode.length !== 6) {
      toast.error('Please configure your 6-digit restaurant pincode first');
      return;
    }
    if (form.servicePincodes.includes(form.pincode)) {
      toast.info(`Restaurant PIN ${form.pincode} is already in your service area`);
      return;
    }
    setForm(prev => ({
      ...prev,
      servicePincodes: [form.pincode, ...prev.servicePincodes]
    }));
    toast.success(`Added kitchen PIN ${form.pincode} to delivery coverage!`);
  };

  const handleResetEconomicsDefaults = () => {
    setForm(prev => ({
      ...prev,
      minimumOrder: 0, // No minimum order limit
      deliveryFee: 30, // Standard base delivery
      packagingFee: 10, // Standard packaging
      acceptsCash: true, // Default ON
      acceptsUpi: true, // Default ON
      acceptsCard: true, // Default ON
    }));
    toast.success('Reset Order Economics & Payment Gateways to recommended platform defaults (No minimum order limit)!');
  };

  const [initialFormSnapshot, setInitialFormSnapshot] = useState<string>('');

  // Determine if form has dirty (unsaved) changes
  const isDirty = useMemo(() => {
    if (!initialFormSnapshot) return false;
    return JSON.stringify(form) !== initialFormSnapshot;
  }, [form, initialFormSnapshot]);

  // Profile Completeness Calculation
  const completeness = useMemo(() => {
    const checks = [
      Boolean(form.name.trim()),
      Boolean(form.description.trim()),
      Boolean(form.category),
      form.cuisines.length > 0,
      Boolean(form.imageUrl),
      Boolean(form.bannerUrl),
      Boolean(form.phone.trim()),
      Boolean(form.email.trim()),
      Boolean(form.address.trim()),
      Boolean(form.pincode && form.pincode.length === 6),
      Boolean(form.lat && form.lng),
      Boolean(form.fssaiLicense && form.fssaiLicense.length >= 10),
      Boolean(form.bankName && form.accountNumber && form.ifscCode),
    ];
    const passed = checks.filter(Boolean).length;
    return Math.round((passed / checks.length) * 100);
  }, [form]);

  // Initial Load & Real-Time Sync
  useEffect(() => {
    if (!activeUser) return;

    let unsubscribeSnapshot: (() => void) | null = null;

    const init = async () => {
      try {
        setLoading(true);
        let resolvedRid: string | null = null;

        // 1. Check user.restaurantId
        if ((activeUser as any)?.restaurantId) {
          resolvedRid = (activeUser as any).restaurantId;
        }

        // 2. Check doc in users/{uid}
        if (!resolvedRid) {
          try {
            const uSnap = await getDoc(doc(db, 'users', activeUser.uid));
            if (uSnap.exists() && uSnap.data()?.restaurantId) {
              resolvedRid = uSnap.data().restaurantId;
            }
          } catch { }
        }

        // 3. Check direct restaurants/{uid}
        if (!resolvedRid) {
          try {
            const rDirect = await getDoc(doc(db, 'restaurants', activeUser.uid));
            if (rDirect.exists()) {
              resolvedRid = activeUser.uid;
            }
          } catch { }
        }

        // 4. Query restaurants by ownerId
        if (!resolvedRid) {
          try {
            const ownerQuery = query(collection(db, 'restaurants'), where('ownerId', '==', activeUser.uid));
            const ownerSnap = await getDocs(ownerQuery);
            if (!ownerSnap.empty) {
              resolvedRid = ownerSnap.docs[0].id;
            }
          } catch { }
        }

        if (!resolvedRid) {
          resolvedRid = activeUser.uid;
        }

        setRestaurantId(resolvedRid);

        // Listen in real-time
        unsubscribeSnapshot = onSnapshot(doc(db, 'restaurants', resolvedRid), rSnap => {
          if (rSnap.exists()) {
            const d = rSnap.data();
            const loadedForm = {
              name: d.name || '',
              description: d.description || '',
              category: d.category || 'Casual Dining',
              cuisines: Array.isArray(d.cuisines) ? d.cuisines : (Array.isArray(d.cuisineType) ? d.cuisineType : []),
              phone: d.phone || '',
              email: d.email || activeUser.email || '',
              website: d.website || '',
              instagram: d.socialLinks?.instagram || d.instagram || '',
              facebook: d.socialLinks?.facebook || d.facebook || '',
              address: d.address || d.street || '',
              city: d.city || '',
              state: d.state || '',
              pincode: (d.pincode || d.restaurantPincode || '').toString(),
              lat: (d.latitude ?? d.coordinates?.latitude ?? d.lat ?? '')?.toString(),
              lng: (d.longitude ?? d.coordinates?.longitude ?? d.lng ?? '')?.toString(),
              deliveryRadius: d.deliveryRadius || 5,
              servicePincodes: Array.isArray(d.servicePincodes) ? d.servicePincodes : [],
              minimumOrder: d.minimumOrder ?? 0, // Default 0: No minimum order limit
              deliveryFee: d.deliveryFee ?? d.deliveryCharge ?? 30,
              packagingFee: d.packagingFee ?? 10,
              gstNumber: d.gstNumber || '',
              fssaiLicense: d.fssaiLicense || d.fssaiNumber || d.fssaiId || '',
              bankName: d.bankDetails?.bankName || '',
              accountNumber: d.bankDetails?.accountNumber || '',
              ifscCode: d.bankDetails?.ifscCode || '',
              accountHolderName: d.bankDetails?.accountHolderName || '',
              acceptsCash: d.paymentMethods?.cash ?? true,
              acceptsUpi: d.paymentMethods?.upi ?? true,
              acceptsCard: d.paymentMethods?.card ?? true,
              isVeg: d.isVeg || false,
              isPureVeg: d.isPureVeg || false,
              isJainFriendly: d.isJainFriendly || d.jainFriendly || false,
              isGlutenFree: d.isGlutenFree || d.glutenFree || false,
              isKetoFriendly: d.isKetoFriendly || d.ketoFriendly || false,
              isLateNight: d.isLateNight || d.lateNight || false,
              isEcoPackaging: d.isEcoPackaging || d.ecoPackaging || false,
              isKidsFriendly: d.isKidsFriendly || d.kidsFriendly || false,
              isFreshlyPrepared: d.isFreshlyPrepared || d.freshlyPrepared || false,
              imageUrl: d.imageUrl || d.image || '',
              bannerUrl: d.bannerUrl || '',
              isOpen: d.isOpen ?? true,
              rating: d.averageRating || d.rating || 4.8,
              totalReviews: d.totalReviews || d.reviews || 0,
            };
            setForm(loadedForm);
            setInitialFormSnapshot(JSON.stringify(loadedForm));
            if (loadedForm.pincode && loadedForm.pincode.length === 6) {
              setPincodeSuccessMsg(`PIN ${loadedForm.pincode} Verified`);
            }
          }
          setLoading(false);
        }, () => {
          setLoading(false);
        });

      } catch (e) {
        console.warn('Profile init notice:', e);
        setLoading(false);
      }
    };

    init();

    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [activeUser]);

  // Cuisine toggler
  const toggleCuisine = (c: string) => {
    setForm(prev => ({
      ...prev,
      cuisines: prev.cuisines.includes(c)
        ? prev.cuisines.filter(x => x !== c)
        : [...prev.cuisines, c],
    }));
  };

  // Map Location Picked Handler
  const handleLocationPicked = (loc: PickedLocation) => {
    setForm(prev => ({
      ...prev,
      address: loc.address || loc.formattedAddress || prev.address,
      city: loc.city || prev.city,
      state: loc.state || prev.state,
      pincode: loc.pincode || prev.pincode,
      lat: loc.latitude.toFixed(6),
      lng: loc.longitude.toFixed(6),
    }));
    if (loc.pincode) {
      setPincodeSuccessMsg(`Postal PIN ${loc.pincode} Confirmed`);
    }
    toast.success(`📍 Map Location Locked: ${loc.address || 'Coordinates saved'} (PIN: ${loc.pincode || form.pincode})`);
  };

  // Auto Detect GPS Handler
  const handleAutoDetectGPS = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocatingGps(false);
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setForm(prev => ({
          ...prev,
          lat: lat.toString(),
          lng: lng.toString(),
        }));

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
            { headers: { 'User-Agent': 'Hunger-Restaurant-Profile/2.0' } }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const road = addr.road || addr.street || addr.suburb || '';
            const cName = addr.city || addr.town || addr.village || addr.county || '';
            const sName = addr.state || '';
            let pCode = addr.postcode || '';
            if (!pCode && data.display_name) {
              const m = data.display_name.match(/\b([1-9][0-9]{5})\b/);
              if (m) pCode = m[1];
            }

            setForm(prev => ({
              ...prev,
              address: road ? `${road}, ${cName}` : prev.address,
              city: cName || prev.city,
              state: sName || prev.state,
              pincode: pCode || prev.pincode,
            }));

            if (pCode) {
              setPincodeSuccessMsg(`Live Postal PIN: ${pCode}`);
            }
          }
        } catch (e) {
          console.warn('GPS geocoding notice:', e);
        }
        toast.success(`📍 Live GPS Locked: ${lat}°, ${lng}°`);
      },
      (err) => {
        setLocatingGps(false);
        toast.error('Could not get GPS location: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Postal PIN verification
  const verifyPincodePostal = async (code: string) => {
    const cleanPin = code.replace(/\D/g, '').slice(0, 6);
    if (cleanPin.length !== 6) {
      setPincodeSuccessMsg('');
      return;
    }
    try {
      setPincodeValidating(true);
      const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
      const data = await res.json();
      if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
        const po = data[0].PostOffice[0];
        setForm(prev => ({
          ...prev,
          pincode: cleanPin,
          city: po.District || po.Block || prev.city,
          state: po.State || prev.state,
        }));
        setPincodeSuccessMsg(`Verified: ${po.District || po.Name}, ${po.State}`);
        toast.success(`✓ Postal Match: ${po.District || po.Name}, ${po.State}`);
      } else {
        setPincodeSuccessMsg('Valid 6-digit PIN format');
      }
    } catch {
      setPincodeSuccessMsg('Format verified');
    } finally {
      setPincodeValidating(false);
    }
  };

  // Direct Image Upload (Logo) via Cloudinary with Real-time Progress & Direct Firebase Save
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WEBP)');
      return;
    }
    setUploadingLogo(true);
    setLogoProgress(0);
    try {
      let downloadUrl = '';
      try {
        downloadUrl = await uploadToCloudinary(file, (pct) => setLogoProgress(pct));
      } catch (cloudErr) {
        // Multi-tier failover
        downloadUrl = await uploadImage(file, 'restaurant-logos', restaurantId || 'profile', (pct) => setLogoProgress(pct));
      }

      // 1. Update local form state immediately
      setForm(prev => ({ ...prev, imageUrl: downloadUrl }));

      // 2. Immediately save to Firebase Firestore so it's permanently stored!
      const targetRid = restaurantId || (authRestaurant as any)?.id || (activeUser as any)?.restaurantId || activeUser?.uid;
      if (targetRid) {
        await setDoc(doc(db, 'restaurants', targetRid), {
          imageUrl: downloadUrl,
          image: downloadUrl,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        console.log('[Profile] Logo successfully saved to Firebase doc:', targetRid, downloadUrl);
      }

      toast.success('Restaurant Logo uploaded and saved to Firebase!');
    } catch (err: any) {
      console.error('[Profile] Failed to upload or save logo:', err);
      toast.error(err?.message || 'Failed to upload logo image');
    } finally {
      setUploadingLogo(false);
      setLogoProgress(0);
    }
  };

  // Direct Image Upload (Banner) via Cloudinary with Real-time Progress & Direct Firebase Save
  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WEBP)');
      return;
    }
    setUploadingBanner(true);
    setBannerProgress(0);
    try {
      let downloadUrl = '';
      try {
        downloadUrl = await uploadToCloudinary(file, (pct) => setBannerProgress(pct));
      } catch (cloudErr) {
        // Multi-tier failover
        downloadUrl = await uploadImage(file, 'restaurant-banners', restaurantId || 'profile', (pct) => setBannerProgress(pct));
      }

      // 1. Update local form state immediately
      setForm(prev => ({ ...prev, bannerUrl: downloadUrl }));

      // 2. Immediately save to Firebase Firestore so it's permanently stored!
      const targetRid = restaurantId || (authRestaurant as any)?.id || (activeUser as any)?.restaurantId || activeUser?.uid;
      if (targetRid) {
        await setDoc(doc(db, 'restaurants', targetRid), {
          bannerUrl: downloadUrl,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        console.log('[Profile] Banner successfully saved to Firebase doc:', targetRid, downloadUrl);
      }

      toast.success('Cover Banner uploaded and saved to Firebase!');
    } catch (err: any) {
      console.error('[Profile] Failed to upload or save banner:', err);
      toast.error(err?.message || 'Failed to upload cover banner');
    } finally {
      setUploadingBanner(false);
      setBannerProgress(0);
    }
  };

  // Save Profile Handler
  const handleSave = async () => {
    if (!restaurantId) {
      toast.error('Restaurant ID not found. Please log in again.');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Restaurant name is required!');
      setActiveTab('brand');
      return;
    }
    if (!form.phone.trim()) {
      toast.error('Primary contact phone number is required!');
      setActiveTab('contact');
      return;
    }

    setSaving(true);
    try {
      const latNum = form.lat ? parseFloat(form.lat) : null;
      const lngNum = form.lng ? parseFloat(form.lng) : null;
      const cleanFssai = form.fssaiLicense.replace(/\D/g, '').slice(0, 14);

      const updatePayload: Record<string, any> = {
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        cuisines: form.cuisines,
        cuisineType: form.cuisines,
        phone: form.phone.trim(),
        email: form.email.trim(),
        website: form.website.trim(),
        socialLinks: {
          instagram: form.instagram.trim(),
          facebook: form.facebook.trim()
        },
        address: form.address.trim(),
        street: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        restaurantPincode: form.pincode.trim(),
        latitude: latNum,
        longitude: lngNum,
        coordinates: latNum && lngNum ? { latitude: latNum, longitude: lngNum } : null,
        deliveryRadius: Number(form.deliveryRadius) || 5,
        servicePincodes: form.servicePincodes,
        minimumOrder: Number(form.minimumOrder) || 0, // 0 for no minimum limit
        deliveryFee: Number(form.deliveryFee) || 30,
        deliveryCharge: Number(form.deliveryFee) || 30,
        packagingFee: Number(form.packagingFee) || 10,
        gstNumber: form.gstNumber.trim().toUpperCase(),
        fssaiLicense: cleanFssai,
        fssaiNumber: cleanFssai,
        bankDetails: {
          bankName: form.bankName.trim(),
          accountNumber: form.accountNumber.trim(),
          ifscCode: form.ifscCode.trim().toUpperCase(),
          accountHolderName: form.accountHolderName.trim(),
          updatedAt: serverTimestamp(),
        },
        paymentMethods: {
          cash: form.acceptsCash,
          upi: form.acceptsUpi,
          card: form.acceptsCard
        },
        isVeg: form.isVeg,
        isPureVeg: form.isPureVeg,
        isJainFriendly: form.isJainFriendly,
        isGlutenFree: form.isGlutenFree,
        isKetoFriendly: form.isKetoFriendly,
        isLateNight: form.isLateNight,
        isEcoPackaging: form.isEcoPackaging,
        isKidsFriendly: form.isKidsFriendly,
        isFreshlyPrepared: form.isFreshlyPrepared,
        isHalal: false,
        imageUrl: form.imageUrl,
        image: form.imageUrl,
        bannerUrl: form.bannerUrl,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'restaurants', restaurantId), updatePayload, { merge: true });
      setInitialFormSnapshot(JSON.stringify(form));
      toast.success('Restaurant Profile saved and published successfully!');
    } catch (err: any) {
      console.error('Profile save error:', err);
      toast.error('Failed to save profile: ' + (err?.message || 'Check connection'));
    } finally {
      setSaving(false);
    }
  };

  const f = (field: string) => (e: any) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  const fb = (field: string) => (v: boolean) => setForm(prev => ({ ...prev, [field]: v }));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 p-8">
        <div className="w-12 h-12 border-4 border-t-orange-500 border-r-amber-500 border-b-yellow-500 border-l-muted rounded-full animate-spin" />
        <p className="text-sm font-semibold text-muted-foreground animate-pulse">Loading Live Restaurant Profile...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-[1500px] mx-auto text-foreground">

      {/* --- FLOATING / STICKY TOP ACTION HEADER --- */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border border-border/70 rounded-3xl p-4 sm:p-5 shadow-lg shadow-black/5 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 shrink-0">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                  {form.name || 'Restaurant Profile'}
                </h1>
                {form.fssaiLicense && form.fssaiLicense.length === 14 && (
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold gap-1 px-2 py-0.5">
                    <ShieldCheck className="w-3 h-3" /> FSSAI Verified
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Public storefront branding, GPS pickup counter, pricing, legal & bank payouts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            {isDirty && (
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 animate-pulse hidden md:inline-flex items-center gap-1.5 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/25">
                <Sparkles className="w-3.5 h-3.5" /> Unsaved Changes
              </span>
            )}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-10 px-5 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs gap-2 shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Publishing...' : 'Save Profile Changes'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* --- HERO BANNER & AVATAR SHOWCASE --- */}
      <Card className="rounded-3xl border-border/80 shadow-md bg-card overflow-hidden relative group">
        {/* Panoramic Banner Area */}
        <div className="relative h-48 sm:h-64 lg:h-72 w-full overflow-hidden bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600">
          {form.bannerUrl ? (
            <SafeImage
              src={form.bannerUrl}
              alt="Restaurant Cover Banner"
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/80 p-6 text-center space-y-2 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/40 via-orange-600/30 to-black/60">
              <Camera className="w-10 h-10 opacity-60" />
              <p className="text-sm font-semibold">Upload an inviting panoramic cover image</p>
              <p className="text-xs text-white/60">Recommended size: 1600 × 500 px</p>
            </div>
          )}

          {/* Banner Edit Trigger Button */}
          <div className="absolute top-4 right-4 z-10">
            <input
              type="file"
              ref={bannerInputRef}
              onChange={handleBannerFileChange}
              accept="image/*"
              className="hidden"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => bannerInputRef.current?.click()}
              disabled={uploadingBanner}
              className="rounded-2xl bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/20 text-xs font-bold gap-2 shadow-md transition-all"
            >
              {uploadingBanner ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                  <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full transition-all duration-150"
                      style={{ width: `${bannerProgress}%` }}
                    />
                  </div>
                  <span className="font-mono text-[11px] font-bold">{bannerProgress}%</span>
                </div>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5" />
                  <span>Change Cover Banner</span>
                </>
              )}
            </Button>
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>

        {/* Profile Card Overlay with Logo Avatar & Highlights */}
        <div className="p-6 pt-0 relative -mt-16 sm:-mt-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
              {/* Logo Avatar */}
              <div className="relative group/logo w-28 h-28 sm:w-36 sm:h-36 rounded-3xl border-4 border-card bg-card shadow-xl overflow-hidden shrink-0">
                {form.imageUrl ? (
                  <SafeImage
                    src={form.imageUrl}
                    alt={form.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white">
                    <Store className="w-12 h-12" />
                  </div>
                )}

                <input
                  type="file"
                  ref={logoInputRef}
                  onChange={handleLogoFileChange}
                  accept="image/*"
                  className="hidden"
                />

                {/* Hover overlay for changing logo */}
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className={`absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white transition-all duration-300 text-xs font-bold gap-1.5 cursor-pointer ${
                    uploadingLogo ? 'opacity-100 bg-black/80 z-20' : 'opacity-0 group-hover/logo:opacity-100'
                  }`}
                >
                  {uploadingLogo ? (
                    <div className="flex flex-col items-center justify-center w-full px-3 space-y-1.5">
                      <div className="relative w-8 h-8 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
                        <span className="text-[10px] font-mono font-black text-white absolute">{logoProgress}%</span>
                      </div>
                      <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full transition-all duration-150"
                          style={{ width: `${logoProgress}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-200">
                        {logoProgress === 100 ? 'Finalizing...' : 'Uploading'}
                      </span>
                    </div>
                  ) : (
                    <>
                      <Camera className="w-5 h-5" />
                      <span>Change Logo</span>
                    </>
                  )}
                </button>
              </div>

              {/* Title & Category Details */}
              <div className="space-y-1.5 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                    {form.name || 'Add Restaurant Name'}
                  </h2>
                  <Badge variant="outline" className="text-xs font-bold border-orange-500/30 text-orange-600 dark:text-orange-400 bg-orange-500/10">
                    {form.category}
                  </Badge>
                  {form.isPureVeg && (
                    <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                      100% PURE VEG
                    </Badge>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 max-w-2xl">
                  {form.description || 'Add an appetizing description of your kitchen, culinary traditions, and specialty dishes.'}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground font-medium">
                  <span className="flex items-center gap-1 text-amber-500 font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    {Number(form.rating).toFixed(1)} ({form.totalReviews} reviews)
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-orange-500" />
                    {form.city ? `${form.city}, ${form.state || ''}` : 'Location unconfigured'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-mono">
                    <Compass className="w-3.5 h-3.5 text-cyan-500" />
                    {form.servicePincodes.length > 0 ? `${form.servicePincodes.length} Pincodes Area` : `${form.deliveryRadius} km coverage`}
                  </span>
                </div>
              </div>
            </div>

            {/* Completeness Health Meter */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 min-w-[220px] space-y-2 shrink-0">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Profile Strength
                </span>
                <span className={completeness >= 80 ? 'text-emerald-500' : 'text-amber-500'}>
                  {completeness}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  style={{ width: `${completeness}%` }}
                  className={`h-full transition-all duration-500 rounded-full ${completeness >= 80
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : 'bg-gradient-to-r from-amber-500 to-orange-400'
                    }`}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {completeness >= 90
                  ? 'High visibility in diner search algorithm'
                  : 'Complete missing fields for maximum order reach'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* --- MAIN TAB NAVIGATION --- */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className="bg-muted/70 border border-border p-1.5 rounded-2xl flex flex-wrap h-auto gap-1">
          <TabsTrigger value="brand" className="rounded-xl px-4 py-2 text-xs font-bold gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Store className="w-3.5 h-3.5 text-orange-500" /> Store Brand
          </TabsTrigger>
          <TabsTrigger value="location" className="rounded-xl px-4 py-2 text-xs font-bold gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <MapPin className="w-3.5 h-3.5 text-emerald-500" /> GPS & Pickup Counter
          </TabsTrigger>
          <TabsTrigger value="contact" className="rounded-xl px-4 py-2 text-xs font-bold gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Phone className="w-3.5 h-3.5 text-blue-500" /> Contact & Social
          </TabsTrigger>
          <TabsTrigger value="pricing" className="rounded-xl px-4 py-2 text-xs font-bold gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Percent className="w-3.5 h-3.5 text-amber-500" /> Pricing & Payments
          </TabsTrigger>
          <TabsTrigger value="compliance" className="rounded-xl px-4 py-2 text-xs font-bold gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-500" /> Legal & Bank Settlements
          </TabsTrigger>
          <TabsTrigger value="preview" className="rounded-xl px-4 py-2 text-xs font-bold gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Eye className="w-3.5 h-3.5 text-cyan-500" /> Customer Preview
          </TabsTrigger>
        </TabsList>

        {/* ======================================================== */}
        {/* --- TAB 1: STORE IDENTITY & BRAND --- */}
        {/* ======================================================== */}
        <TabsContent value="brand" className="space-y-6">
          <Card className="rounded-3xl border-border/80 bg-card shadow-sm">
            <CardHeader className="pb-4 border-b border-border/60">
              <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                <Store className="w-5 h-5 text-orange-500" /> Storefront Identity & Category
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Set customer-facing name, culinary category, and specialty cuisine badges
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Restaurant Brand Name *
                  </Label>
                  <Input
                    value={form.name}
                    onChange={f('name')}
                    placeholder="e.g. Royal Biryani & Kebabs"
                    className="h-11 rounded-xl text-sm font-semibold border-border bg-muted/20"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Appears prominently across search results and customer orders.
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Dining Category *
                  </Label>
                  <select
                    value={form.category}
                    onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full h-11 rounded-xl border border-border bg-muted/20 px-3 text-sm font-medium text-foreground focus:outline-none"
                  >
                    {CATEGORY_OPTIONS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Groups your restaurant in platform discovery filters.
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Store Bio & Description
                  </Label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {form.description.length} / 500
                  </span>
                </div>
                <Textarea
                  value={form.description}
                  onChange={f('description')}
                  rows={3}
                  maxLength={500}
                  placeholder="Share your culinary heritage, chef recommendations, and what makes your dishes authentic..."
                  className="rounded-xl resize-none text-sm border-border bg-muted/20"
                />
              </div>

              {/* Cuisines multi-select */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-orange-500" />
                    Specialty Cuisines ({form.cuisines.length} Selected)
                  </Label>
                  {form.cuisines.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, cuisines: [] }))}
                      className="text-xs font-bold text-orange-500 hover:underline"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 p-3.5 rounded-2xl bg-muted/20 border border-border">
                  {CUISINE_OPTIONS.map(c => {
                    const isSelected = form.cuisines.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleCuisine(c)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isSelected
                          ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20 scale-[1.02]'
                          : 'bg-card border border-border text-muted-foreground hover:border-orange-500/40 hover:text-foreground'
                          }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        <span>{c}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dietary, Health & Kitchen Specialties */}
              <div className="pt-4 border-t border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      Dietary, Health & Kitchen Specialties
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Enable badges to help diners filter dishes matching their lifestyle and dietary preferences
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs font-semibold self-start sm:self-auto border-border">
                    {[
                      form.isVeg, form.isPureVeg, form.isJainFriendly,
                      form.isGlutenFree, form.isKetoFriendly, form.isLateNight,
                      form.isEcoPackaging, form.isKidsFriendly, form.isFreshlyPrepared
                    ].filter(Boolean).length} Active
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {DIETARY_OPTIONS.map(({ field, title, description, icon }) => {
                    const active = Boolean((form as any)[field]);
                    return (
                      <div
                        key={field}
                        className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${active
                          ? 'bg-emerald-500/10 border-emerald-500/30 shadow-sm'
                          : 'bg-muted/20 border-border hover:border-border/80'
                          }`}
                      >
                        <div className="min-w-0 pr-2">
                          <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5 truncate">
                            <span className="text-base shrink-0">{icon}</span>
                            <span className="truncate">{title}</span>
                          </h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                            {description}
                          </p>
                        </div>
                        <Switch
                          checked={active}
                          onCheckedChange={fb(field)}
                          className="shrink-0"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Direct URLs Fallback inputs */}
              <div className="pt-4 border-t border-border/60">
                <details className="group/details">
                  <summary className="text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-orange-500" />
                    Advanced: Manual Image URLs (External Host Support)
                  </summary>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-2">
                    <div>
                      <Label className="text-[11px] font-semibold text-muted-foreground">Logo Direct URL</Label>
                      <Input
                        value={form.imageUrl}
                        onChange={f('imageUrl')}
                        placeholder="https://..."
                        className="h-9 rounded-xl text-xs font-mono mt-1 border-border bg-muted/20"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-muted-foreground">Cover Banner Direct URL</Label>
                      <Input
                        value={form.bannerUrl}
                        onChange={f('bannerUrl')}
                        placeholder="https://..."
                        className="h-9 rounded-xl text-xs font-mono mt-1 border-border bg-muted/20"
                      />
                    </div>
                  </div>
                </details>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* --- TAB 2: GPS, MAP & PICKUP COUNTER --- */}
        {/* ======================================================== */}
        <TabsContent value="location" className="space-y-6">
          <Card className="rounded-3xl border-border/80 bg-card shadow-sm">
            <CardHeader className="pb-4 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-emerald-500" /> Kitchen Pickup Location & GPS Coordinates
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Accurate GPS markers allow delivery riders to navigate straight to your food handover counter
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="h-9 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs gap-1.5 shadow-md shadow-orange-500/20"
                  >
                    <Compass className="w-4 h-4" /> Pinpoint on Map
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAutoDetectGPS}
                    disabled={locatingGps}
                    className="h-9 px-3.5 rounded-xl border-border text-xs font-bold gap-1.5"
                  >
                    {locatingGps ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
                    ) : (
                      <MapIcon className="w-3.5 h-3.5 text-emerald-500" />
                    )}
                    <span>{locatingGps ? 'Locating...' : 'Auto-Detect My GPS'}</span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* GPS Coordinates Status Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shrink-0">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">GPS Coordinate Verification:</span>
                      {form.lat && form.lng ? (
                        <Badge className="bg-emerald-500 text-white text-[10px] font-bold">LOCKED & ACTIVE</Badge>
                      ) : (
                        <Badge variant="outline" className="text-destructive border-destructive text-[10px] font-bold">UNCONFIGURED</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      {form.lat && form.lng
                        ? `Latitude: ${Number(form.lat).toFixed(6)}° • Longitude: ${Number(form.lng).toFixed(6)}°`
                        : 'No GPS coordinates locked. Tap "Pinpoint on Map" to drop an exact pin.'}
                    </p>
                  </div>
                </div>

                {form.lat && form.lng && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowMapPicker(true)}
                    className="rounded-xl text-xs font-bold border-emerald-500/40 text-emerald-600 dark:text-emerald-400 self-start sm:self-center"
                  >
                    Adjust Coordinates
                  </Button>
                )}
              </div>

              {/* Physical Street Address */}
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Complete Physical Address / Landmark / Floor *
                </Label>
                <Textarea
                  value={form.address}
                  onChange={f('address')}
                  rows={2}
                  placeholder="e.g. Shop No. 4, Ground Floor, Sai Plaza, Opp. Metro Pillar 42, Bandra West"
                  className="rounded-xl resize-none text-sm border-border bg-muted/20"
                />
              </div>

              {/* City, State, Real Pincode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    City / District *
                  </Label>
                  <Input
                    value={form.city}
                    onChange={f('city')}
                    placeholder="e.g. Mumbai"
                    className="h-11 rounded-xl text-sm border-border bg-muted/20"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    State / Region *
                  </Label>
                  <Input
                    value={form.state}
                    onChange={f('state')}
                    placeholder="e.g. Maharashtra"
                    className="h-11 rounded-xl text-sm border-border bg-muted/20"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Real Postal PIN (6 Digits) *
                    </Label>
                    {pincodeValidating && (
                      <span className="text-[10px] text-muted-foreground animate-pulse">Verifying...</span>
                    )}
                  </div>
                  <Input
                    value={form.pincode}
                    maxLength={6}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setForm(prev => ({ ...prev, pincode: val }));
                      if (val.length === 6) {
                        verifyPincodePostal(val);
                      } else {
                        setPincodeSuccessMsg('');
                      }
                    }}
                    onBlur={() => verifyPincodePostal(form.pincode)}
                    placeholder="e.g. 400050"
                    className="h-11 rounded-xl text-sm font-mono border-border bg-muted/20"
                  />
                  {pincodeSuccessMsg ? (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {pincodeSuccessMsg}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Auto-verifies with National Postal Registry.
                    </p>
                  )}
                </div>
              </div>

              {/* Delivery Coverage & Service Pincodes */}
              <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div>
                    <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-orange-500" /> Serviceable Delivery Pincodes
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Define the exact 6-digit postal zones where your kitchen delivers
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono font-bold border-orange-500/30 text-orange-600 dark:text-orange-400">
                      {form.servicePincodes.length > 0
                        ? `${form.servicePincodes.length} Pincodes Active`
                        : 'Open Radius Coverage'}
                    </Badge>
                  </div>
                </div>

                {/* Add Service Pincode Input Bar */}
                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <div className="relative flex-1 w-full">
                    <Navigation className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
                    <Input
                      value={newServicePincode}
                      onChange={(e) => setNewServicePincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddServicePincode();
                        }
                      }}
                      maxLength={6}
                      placeholder="Enter 6-digit delivery pincode (e.g. 400050)..."
                      className="pl-10 h-10 rounded-xl text-sm font-mono border-border bg-muted/20"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      type="button"
                      onClick={handleAddServicePincode}
                      disabled={addingPincode || newServicePincode.length !== 6}
                      className="h-10 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs gap-1.5 shrink-0 flex-1 sm:flex-none"
                    >
                      {addingPincode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Add Pincode
                    </Button>
                    {form.pincode && form.pincode.length === 6 && !form.servicePincodes.includes(form.pincode) && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddCurrentPincodeToService}
                        className="h-10 px-3 rounded-xl border-border text-xs font-bold gap-1 shrink-0"
                        title="Add your kitchen's own pincode to coverage"
                      >
                        + Add PIN {form.pincode}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Active Pincodes Badges List */}
                {form.servicePincodes.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Restricted to the following active postal zones:</span>
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, servicePincodes: [] }))}
                        className="text-xs text-destructive hover:underline font-semibold"
                      >
                        Clear All Pincodes
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-muted/20 border border-border">
                      {form.servicePincodes.map(pin => (
                        <div
                          key={pin}
                          className="bg-card border border-border hover:border-orange-500/40 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-mono font-bold text-foreground shadow-xs transition-colors"
                        >
                          <Navigation className="w-3 h-3 text-orange-500" />
                          <span>{pin}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveServicePincode(pin)}
                            className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                            title="Remove pincode"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-muted/20 border border-dashed border-border text-xs text-muted-foreground flex items-center gap-2">
                    <Info className="w-4 h-4 text-cyan-500 shrink-0" />
                    <span>
                      <strong>Open Radius Mode:</strong> Customers from all pincodes within your <strong>{form.deliveryRadius} km</strong> radial cutoff can order. Add specific pincodes above if you wish to restrict orders to designated postal areas.
                    </span>
                  </div>
                )}

                {/* Radial Distance Cutoff in KM */}
                <div className="pt-3 border-t border-border/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-cyan-500" /> Maximum Radial Distance Cutoff
                      </span>
                      <p className="text-[11px] text-muted-foreground">Furthest travel distance delivery riders will travel from pickup counter</p>
                    </div>
                    <span className="text-base font-black text-cyan-600 dark:text-cyan-400 font-mono">
                      {form.deliveryRadius} km
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="25"
                    step="1"
                    value={form.deliveryRadius}
                    onChange={(e) => setForm(prev => ({ ...prev, deliveryRadius: Number(e.target.value) }))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                    <span>1 km (Hyperlocal)</span>
                    <span>10 km (Standard)</span>
                    <span>25 km (Citywide)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* --- TAB 3: CONTACT & ONLINE PRESENCE --- */}
        {/* ======================================================== */}
        <TabsContent value="contact" className="space-y-6">
          <Card className="rounded-3xl border-border/80 bg-card shadow-sm">
            <CardHeader className="pb-4 border-b border-border/60">
              <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                <Phone className="w-5 h-5 text-blue-500" /> Communications & Social Media
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Phone contact for delivery riders, order inquiries, and customer verification
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Primary Contact Phone *
                  </Label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5" />
                    <Input
                      value={form.phone}
                      onChange={f('phone')}
                      placeholder="+91 98765 43210"
                      className="pl-10 h-11 rounded-xl text-sm font-mono border-border bg-muted/20"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Delivery partners use this number if they need pickup assistance.
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Official Kitchen Email
                  </Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5" />
                    <Input
                      value={form.email}
                      onChange={f('email')}
                      placeholder="manager@restaurant.com"
                      className="pl-10 h-11 rounded-xl text-sm border-border bg-muted/20"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Weekly settlement statements and invoices are delivered here.
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Official Website
                  </Label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5" />
                    <Input
                      value={form.website}
                      onChange={f('website')}
                      placeholder="https://www.yourkitchen.com"
                      className="pl-10 h-11 rounded-xl text-sm border-border bg-muted/20"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Instagram Handle
                  </Label>
                  <div className="relative">
                    <Instagram className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5" />
                    <Input
                      value={form.instagram}
                      onChange={f('instagram')}
                      placeholder="@yourkitchen_delight"
                      className="pl-10 h-11 rounded-xl text-sm border-border bg-muted/20"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Facebook Page URL
                  </Label>
                  <div className="relative">
                    <Facebook className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5" />
                    <Input
                      value={form.facebook}
                      onChange={f('facebook')}
                      placeholder="https://facebook.com/yourkitchenpage"
                      className="pl-10 h-11 rounded-xl text-sm border-border bg-muted/20"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* --- TAB 4: PRICING & PAYMENT MODES --- */}
        {/* ======================================================== */}
        <TabsContent value="pricing" className="space-y-6">
          <Card className="rounded-3xl border-border/80 bg-card shadow-sm">
            <CardHeader className="pb-4 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                    <Percent className="w-5 h-5 text-amber-500" /> Order Economics & Payment Gateways
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Configure minimum order thresholds, delivery charges, packaging fees, and customer payment methods
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetEconomicsDefaults}
                  className="rounded-xl border-border text-xs font-bold gap-1.5 self-start sm:self-auto hover:bg-amber-500/10 hover:text-amber-600"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-500" /> Reset to Recommended Defaults
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {/* Minimum Order Value - No Minimum Limit */}
                <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Minimum Order Value (₹)
                    </Label>
                    <Badge className={Number(form.minimumOrder) === 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]' : 'bg-muted text-muted-foreground text-[10px]'}>
                      {Number(form.minimumOrder) === 0 ? 'NO MINIMUM LIMIT' : `₹${form.minimumOrder} MIN`}
                    </Badge>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 font-bold text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      min={0}
                      value={form.minimumOrder}
                      onChange={f('minimumOrder')}
                      placeholder="0 (No Minimum Limit)"
                      className="pl-8 h-11 rounded-xl text-sm font-bold font-mono border-border bg-card"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Set <strong>0</strong> for no minimum limit (customers can order any amount).
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[0, 49, 99, 149].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, minimumOrder: preset }))}
                        className={`text-[10px] px-2 py-0.5 rounded-lg border font-mono transition-colors ${Number(form.minimumOrder) === preset
                          ? 'bg-amber-500 text-white border-amber-500 font-bold'
                          : 'bg-card border-border text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        {preset === 0 ? '₹0 (No Limit)' : `₹${preset}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Base Delivery Fee */}
                <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Base Delivery Fee (₹)
                    </Label>
                    <span className="text-[10px] text-muted-foreground font-mono">Default: ₹30</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 font-bold text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      min={0}
                      value={form.deliveryFee}
                      onChange={f('deliveryFee')}
                      className="pl-8 h-11 rounded-xl text-sm font-bold font-mono border-border bg-card"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Base rider dispatch fee applied at checkout.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[0, 20, 30, 40].map(fee => (
                      <button
                        key={fee}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, deliveryFee: fee }))}
                        className={`text-[10px] px-2 py-0.5 rounded-lg border font-mono transition-colors ${Number(form.deliveryFee) === fee
                          ? 'bg-amber-500 text-white border-amber-500 font-bold'
                          : 'bg-card border-border text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        {fee === 0 ? '₹0 (Free)' : `₹${fee}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Packaging Fee */}
                <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Packaging / Container Fee (₹)
                    </Label>
                    <span className="text-[10px] text-muted-foreground font-mono">Default: ₹10</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 font-bold text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      min={0}
                      value={form.packagingFee}
                      onChange={f('packagingFee')}
                      className="pl-8 h-11 rounded-xl text-sm font-bold font-mono border-border bg-card"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Covers food-grade tamper-evident packaging.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[0, 5, 10, 15].map(fee => (
                      <button
                        key={fee}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, packagingFee: fee }))}
                        className={`text-[10px] px-2 py-0.5 rounded-lg border font-mono transition-colors ${Number(form.packagingFee) === fee
                          ? 'bg-amber-500 text-white border-amber-500 font-bold'
                          : 'bg-card border-border text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        {fee === 0 ? '₹0 (Free)' : `₹${fee}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Accepted Payment Modes (Default Enabled) */}
              <div className="pt-4 border-t border-border/60">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      Accepted Customer Payment Methods (All Default: Enabled)
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Enabling all payment gateways maximizes checkout conversion and customer satisfaction
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                    {[form.acceptsUpi, form.acceptsCard, form.acceptsCash].filter(Boolean).length}/3 Gateways Active
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${form.acceptsUpi ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-muted/20 border-border'}`}>
                    <div>
                      <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                        ⚡ UPI & QR Instant Pay
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Google Pay, PhonePe, Paytm (Default: ON)</p>
                    </div>
                    <Switch checked={form.acceptsUpi} onCheckedChange={fb('acceptsUpi')} />
                  </div>

                  <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${form.acceptsCard ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-muted/20 border-border'}`}>
                    <div>
                      <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                        💳 Cards & NetBanking
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Visa, Mastercard, RuPay (Default: ON)</p>
                    </div>
                    <Switch checked={form.acceptsCard} onCheckedChange={fb('acceptsCard')} />
                  </div>

                  <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${form.acceptsCash ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-muted/20 border-border'}`}>
                    <div>
                      <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                        💵 Cash on Delivery (COD)
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Physical currency on doorstep (Default: ON)</p>
                    </div>
                    <Switch checked={form.acceptsCash} onCheckedChange={fb('acceptsCash')} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* --- TAB 5: LEGAL & BANK PAYOUTS --- */}
        {/* ======================================================== */}
        <TabsContent value="compliance" className="space-y-6">
          <Card className="rounded-3xl border-border/80 bg-card shadow-sm">
            <CardHeader className="pb-4 border-b border-border/60">
              <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-500" /> Regulatory License & Settlement Bank
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Mandatory 14-digit FSSAI food license and registered bank account for automated sales payouts
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* FSSAI & GST Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      FSSAI License ID (14 Digits) *
                    </Label>
                    <Badge className={form.fssaiLicense && form.fssaiLicense.length === 14 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}>
                      {form.fssaiLicense.length}/14 Digits
                    </Badge>
                  </div>
                  <Input
                    value={form.fssaiLicense}
                    maxLength={14}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 14);
                      setForm(prev => ({ ...prev, fssaiLicense: val }));
                    }}
                    placeholder="14-digit Food Safety License"
                    className="h-11 rounded-xl text-sm font-mono font-bold border-border bg-card"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Required by government food safety laws for delivery operations.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      GSTIN (Optional)
                    </Label>
                    <span className="text-[11px] text-muted-foreground font-mono">15 Characters</span>
                  </div>
                  <Input
                    value={form.gstNumber}
                    maxLength={15}
                    onChange={(e) => {
                      setForm(prev => ({ ...prev, gstNumber: e.target.value.toUpperCase().slice(0, 15) }));
                    }}
                    placeholder="e.g. 27AAAAA0000A1Z5"
                    className="h-11 rounded-xl text-sm font-mono font-bold border-border bg-card"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Required if claiming GST input tax credits.
                  </p>
                </div>
              </div>

              {/* Settlement Bank Account */}
              <div className="pt-4 border-t border-border/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-purple-500" /> Weekly Settlement Bank Details
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Your platform earnings are directly wired to this bank account every Monday
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAccountNumber(!showAccountNumber)}
                    className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
                  >
                    {showAccountNumber ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showAccountNumber ? 'Hide Numbers' : 'Reveal Account'}</span>
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Account Holder Name
                    </Label>
                    <Input
                      value={form.accountHolderName}
                      onChange={f('accountHolderName')}
                      placeholder="Name as printed in Passbook / Cheque"
                      className="h-11 rounded-xl text-sm border-border bg-muted/20"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Bank Name
                    </Label>
                    <Input
                      value={form.bankName}
                      onChange={f('bankName')}
                      placeholder="e.g. HDFC Bank / State Bank of India"
                      className="h-11 rounded-xl text-sm border-border bg-muted/20"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Bank Account Number
                    </Label>
                    <Input
                      type={showAccountNumber ? 'text' : 'password'}
                      value={form.accountNumber}
                      onChange={f('accountNumber')}
                      placeholder="Account Number"
                      className="h-11 rounded-xl text-sm font-mono border-border bg-muted/20"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      IFSC Code (11 Characters)
                    </Label>
                    <Input
                      value={form.ifscCode}
                      maxLength={11}
                      onChange={(e) => {
                        setForm(prev => ({ ...prev, ifscCode: e.target.value.toUpperCase().slice(0, 11) }));
                      }}
                      placeholder="e.g. HDFC0001234"
                      className="h-11 rounded-xl text-sm font-mono font-bold border-border bg-muted/20"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* --- TAB 6: CUSTOMER APP LIVE PREVIEW --- */}
        {/* ======================================================== */}
        <TabsContent value="preview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="rounded-3xl border-border/80 bg-card shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-foreground">Live Customer Storefront Mockup</h3>
                    <p className="text-xs text-muted-foreground">
                      This is an authentic representation of how hungry customers see your restaurant card in the food delivery mobile feed.
                    </p>
                  </div>
                </div>

                {/* Mobile Feed Restaurant Card */}
                <div className="max-w-md mx-auto rounded-3xl overflow-hidden border border-border shadow-xl bg-card hover:shadow-2xl transition-all">
                  {/* Card Cover */}
                  <div className="relative h-44 w-full bg-muted">
                    {form.bannerUrl || form.imageUrl ? (
                      <SafeImage
                        src={form.bannerUrl || form.imageUrl}
                        alt="Restaurant card"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-orange-400 to-amber-500 flex items-center justify-center text-white font-bold">
                        {form.name || 'Your Restaurant'}
                      </div>
                    )}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[85%]">
                      {form.isPureVeg && (
                        <Badge className="bg-emerald-600 text-white text-[10px] font-bold shadow-md">
                          PURE VEG
                        </Badge>
                      )}
                      {form.isJainFriendly && (
                        <Badge className="bg-green-700 text-white text-[10px] font-bold shadow-md">
                          JAIN
                        </Badge>
                      )}
                      {form.isGlutenFree && (
                        <Badge className="bg-amber-600 text-white text-[10px] font-bold shadow-md">
                          GLUTEN-FREE
                        </Badge>
                      )}
                      {form.isLateNight && (
                        <Badge className="bg-indigo-600 text-white text-[10px] font-bold shadow-md">
                          LATE NIGHT
                        </Badge>
                      )}
                      {form.isEcoPackaging && (
                        <Badge className="bg-teal-700 text-white text-[10px] font-bold shadow-md">
                          ECO PACK
                        </Badge>
                      )}
                      <Badge className="bg-black/70 backdrop-blur-md text-white text-[10px] font-bold">
                        {form.category}
                      </Badge>
                    </div>

                    <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md text-white px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 shadow-md">
                      <Clock className="w-3 h-3 text-amber-400" /> 25-35 min
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-base text-foreground truncate max-w-[220px]">
                        {form.name || 'Restaurant Name'}
                      </h4>
                      <Badge className="bg-emerald-600 text-white font-black text-xs gap-1">
                        ★ {Number(form.rating).toFixed(1)}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {form.cuisines.length > 0 ? form.cuisines.join(' • ') : 'Delicious Dishes & Specialties'}
                    </p>

                    <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-orange-500" />
                        {form.city || 'Local Area'} • {form.deliveryRadius} km
                      </span>
                      <span className="font-semibold text-foreground">
                        {Number(form.minimumOrder) === 0 ? 'No min order' : `₹${form.minimumOrder} min order`}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Recommendations checklist */}
            <div className="space-y-4">
              <Card className="rounded-3xl border-border/80 bg-card shadow-sm p-6 space-y-4">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Readiness Checklist
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20">
                    <span>Store Name & Category</span>
                    {form.name ? <Check className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20">
                    <span>Logo & Cover Banner</span>
                    {form.imageUrl && form.bannerUrl ? <Check className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20">
                    <span>GPS Coordinates Locked</span>
                    {form.lat && form.lng ? <Check className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20">
                    <span>6-Digit Postal PIN</span>
                    {form.pincode && form.pincode.length === 6 ? <Check className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20">
                    <span>14-Digit FSSAI License</span>
                    {form.fssaiLicense && form.fssaiLicense.length === 14 ? <Check className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20">
                    <span>Payout Bank Account</span>
                    {form.bankName && form.accountNumber ? <Check className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
                  </div>
                </div>

                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full h-10 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                  Publish All Changes Now
                </Button>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* --- MAP LOCATION PICKER DIALOG --- */}
      <MapPickerDialog
        open={showMapPicker}
        onOpenChange={setShowMapPicker}
        onLocationSelect={handleLocationPicked}
        initialLat={form.lat ? parseFloat(form.lat) : undefined}
        initialLng={form.lng ? parseFloat(form.lng) : undefined}
        initialAddress={form.address}
        title="Pinpoint Restaurant Pickup Location on Map"
      />
    </div>
  );
}
