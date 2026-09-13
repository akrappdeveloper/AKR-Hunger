'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Store,
  ChefHat,
  Mail,
  Lock,
  Phone,
  MapPin,
  Utensils,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  TrendingUp,
  Users,
  BadgePercent,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Bike,
  User,
  ShieldCheck,
  BarChart3,
  LocateFixed,
  Navigation,
  Compass
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export default function RestaurantLoginPage() {
  const router = useRouter();
  const { user } = useRestaurantAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [cuisines, setCuisines] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locatingGps, setLocatingGps] = useState(false);
  const [detectedArea, setDetectedArea] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Derived indicator for valid coordinates
  const hasGpsCoordinates = Boolean(
    latitude.trim() &&
    longitude.trim() &&
    !isNaN(Number(latitude)) &&
    !isNaN(Number(longitude))
  );

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/restaurant');
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userId = userCredential.user.uid;

      // Check if this user is actually registered as a restaurant (check doc ID first, then ownerId)
      let isRestaurant = false;
      try {
        const restaurantDoc = await getDoc(doc(db, 'restaurants', userId));
        if (restaurantDoc.exists()) {
          isRestaurant = true;
        } else {
          const ownerQuery = query(collection(db, 'restaurants'), where('ownerId', '==', userId));
          const ownerSnapshot = await getDocs(ownerQuery);
          if (!ownerSnapshot.empty) {
            isRestaurant = true;
          }
        }
      } catch (checkErr: any) {
        console.warn('[Restaurant Login] Role verification notice:', checkErr);
      }

      if (!isRestaurant) {
        await auth.signOut();
        setError('This account is not registered as a restaurant partner. Please verify your credentials or register your restaurant.');
        setLoading(false);
        return;
      }

      router.push('/restaurant');
    } catch (err: any) {
      console.error('[Restaurant Login] Authentication error:', err);
      let message = 'Failed to login. Please check your credentials.';
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-email'
      ) {
        message = 'Invalid email or password. Please verify your merchant credentials.';
      } else if (
        err.code === 'permission-denied' ||
        err.message?.includes('Missing or insufficient permissions')
      ) {
        message = 'Access Denied: This account is not authorized as a restaurant partner. Please verify your credentials.';
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDetectGPS = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser. You can enter coordinates manually.');
      return;
    }

    setLocatingGps(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLatitude(lat.toFixed(6));
          setLongitude(lng.toFixed(6));

          // Attempt reverse geocoding via OpenStreetMap Nominatim
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
            );
            if (res.ok) {
              const data = await res.json();
              const road = data?.address?.road || data?.address?.suburb || data?.address?.neighbourhood || '';
              const city = data?.address?.city || data?.address?.town || data?.address?.state_district || data?.address?.county || '';
              const state = data?.address?.state || '';
              const postcode = data?.address?.postcode || '';

              const areaParts = [road, city, state, postcode].filter(Boolean);
              if (areaParts.length > 0) {
                const fullArea = areaParts.join(', ');
                setDetectedArea(fullArea);
                if (!address.trim()) {
                  setAddress(fullArea);
                }
              }
            }
          } catch (e) {
            console.warn('[GPS] Reverse geocoding notice:', e);
          }

          toast.success(`Kitchen GPS locked: ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`);
        } catch (posErr) {
          console.warn('[GPS] Position processing notice:', posErr);
        } finally {
          setLocatingGps(false);
        }
      },
      (err) => {
        console.warn('[GPS] Geolocation notice (code ' + err.code + '):', err.message);
        setLocatingGps(false);
        if (err.code === 1) {
          toast.error('Location permission was denied. You can enter your street address or coordinates manually.');
        } else if (err.code === 2) {
          toast.error('Location unavailable on this device. You can enter coordinates manually.');
        } else {
          toast.error('GPS request timed out. You can enter coordinates manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Check if email is already registered to a restaurant (restaurants has public read permission)
      const cleanEmail = email.trim().toLowerCase();
      try {
        const restaurantQuery = query(collection(db, 'restaurants'), where('email', '==', cleanEmail));
        const restaurantSnapshot = await getDocs(restaurantQuery);

        if (!restaurantSnapshot.empty) {
          setError('This email is already registered as a restaurant partner. Please sign in instead.');
          setLoading(false);
          return;
        }
      } catch (checkErr) {
        // If querying restaurants fails for any reason, continue to Firebase Auth which enforces uniqueness
        console.warn('[Restaurant Signup] Email check notice:', checkErr);
      }

      // 2. Create user in Firebase Auth (enforces unique email across all users)
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const userId = userCredential.user.uid;

      // Parse cuisines into array
      const cuisineArray = cuisines
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c);

      // Parse coordinates (convert string to float, fallback to Delhi defaults if not supplied)
      const latNum = latitude ? parseFloat(latitude) : 28.7041;
      const lngNum = longitude ? parseFloat(longitude) : 77.1025;

      // 3. Create restaurant document in Firestore
      await setDoc(doc(db, 'restaurants', userId), {
        name: restaurantName.trim(),
        ownerName: ownerName.trim(),
        ownerId: userId,
        email: cleanEmail,
        phone: phone.trim(),
        address: address.trim(),
        latitude: latNum,
        longitude: lngNum,
        coordinates: {
          latitude: latNum,
          longitude: lngNum,
        },
        cuisines: cuisineArray.length > 0 ? cuisineArray : ['Multi-Cuisine'],
        description: `Delicious ${cuisineArray.join(', ') || 'Multi-Cuisine'} cuisine`,
        rating: 0,
        reviews: 0,
        deliveryTime: 30,
        deliveryCharge: 40,
        minimumOrder: 100,
        isOpen: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      router.push('/restaurant');
    } catch (err: any) {
      console.error('[Restaurant Signup] Error:', err);
      let message = 'Failed to create restaurant account. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        message = 'An account with this email already exists. Please sign in or use a different email.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password must be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Please provide a valid email address.';
      } else if (
        err.code === 'permission-denied' ||
        err.message?.includes('Missing or insufficient permissions')
      ) {
        message = 'Permission error creating restaurant profile. Please ensure Firestore rules are updated.';
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (isLogin) {
      handleLogin(e);
    } else {
      handleSignup(e);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative flex flex-col justify-between selection:bg-amber-500/25 overflow-x-hidden">
      {/* Dynamic Ambient Mesh Glows (Culinary Gold, Copper & Flame Accents) */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/3 w-[550px] h-[550px] bg-amber-500/12 rounded-full blur-[140px] opacity-70 animate-pulse transition-all duration-1000" />
        <div className="absolute top-1/2 -right-32 w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-[150px] opacity-60" />
        <div className="absolute -bottom-20 -left-20 w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-[140px] opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(245,158,11,0.08),rgba(255,255,255,0))]" />
      </div>

      {/* Top Header Navigation */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between z-20">
        <div className="flex items-center gap-2 group text-muted-foreground hover:text-foreground transition-all duration-200">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="rounded-xl gap-2 font-semibold text-xs sm:text-sm h-9 px-3 bg-card/60 backdrop-blur-md border border-border/50 hover:border-amber-500/40 hover:bg-card shadow-sm"
          >
            <Link href="/customer">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Storefront</span>
            </Link>
          </Button>
          <Link href="/customer" className="flex items-center gap-2.5 pl-3 border-l border-border/60">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center p-1.5 ring-1 ring-amber-500/25">
              <Store className="w-full h-full text-amber-500" />
            </div>
            <span className="font-extrabold text-base sm:text-lg tracking-tight">
              AKR<span className="text-amber-500 font-black">Merchant</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-card/60 backdrop-blur-md border border-border/50 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Merchant Partner Portal</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-6 sm:py-10 z-10">
        <div className={`w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center ${isLogin ? 'max-w-5xl' : 'max-w-6xl'}`}>
          
          {/* Left Merchant Showcase (Desktop) */}
          <div className={`hidden lg:flex flex-col justify-center space-y-8 pr-4 ${isLogin ? 'lg:col-span-6' : 'lg:col-span-5'}`}>
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-500 text-xs font-bold tracking-wide uppercase">
                <ChefHat className="w-3.5 h-3.5 text-amber-500" />
                <span>Culinary Partner Growth</span>
              </div>
              <h1 className="text-4xl xl:text-5xl font-black tracking-tight leading-[1.15] text-foreground">
                Turn Every Table into a{' '}
                <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">
                  High-Growth Digital Empire.
                </span>
              </h1>
              <p className="text-muted-foreground text-base leading-relaxed max-w-md">
                Reach over 100,000+ hungry diners across the city. Manage real-time orders, track kitchen analytics, and scale your restaurant revenue effortlessly.
              </p>
            </div>

            {/* Merchant Highlights */}
            <div className="grid grid-cols-2 gap-3.5 pt-2">
              <div className="p-3.5 rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 hover:border-amber-500/40 transition-all group shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">3.5x Order Surge</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Average revenue increase for newly onboarded kitchens.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 hover:border-amber-500/40 transition-all group shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <BadgePercent className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">0% Setup Commission</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Zero platform charges for your first 30 days of service.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 hover:border-amber-500/40 transition-all group shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">Live Kitchen Display</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Streamlined KOTs, automated prep timers & inventory alerts.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 hover:border-amber-500/40 transition-all group shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">100k+ Food Lovers</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Instantly discoverable to verified repeat hungry customers.</p>
              </div>
            </div>

            {/* Merchant Payout Stat Pill */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-card/40 backdrop-blur-md border border-border/50 shadow-inner">
              <div className="w-3 h-3 rounded-full bg-amber-500 animate-ping" />
              <div className="text-xs">
                <span className="font-bold text-foreground">₹4.2+ Crores</span>{' '}
                <span className="text-muted-foreground">settled to partner restaurants this month</span>
              </div>
            </div>
          </div>

          {/* Right Merchant Auth Card */}
          <div className={`w-full flex justify-center ${isLogin ? 'lg:col-span-6' : 'lg:col-span-7'}`}>
            <div className={`w-full ${isLogin ? 'max-w-md' : 'max-w-xl'}`}>
              <div className="relative rounded-3xl bg-card/85 backdrop-blur-2xl border border-border/70 shadow-2xl overflow-hidden transition-all duration-300 hover:shadow-amber-500/5">
                {/* Glowing Top Amber-Orange Gradient */}
                <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />

                <div className="p-6 sm:p-8">
                  {/* Header */}
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-500 mb-3 shadow-md shadow-amber-500/20 ring-2 ring-amber-500/20">
                      <Store className="w-7 h-7" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                      {isLogin ? 'Restaurant Sign In' : 'Partner Registration'}
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      {isLogin
                        ? 'Manage your menus, orders & earnings in real time'
                        : 'List your restaurant and begin receiving orders in minutes'}
                    </p>
                  </div>

                  {/* Mode Switcher Segment Tabs */}
                  <div className="grid grid-cols-2 p-1 bg-muted/60 backdrop-blur-sm rounded-xl mb-6 border border-border/50 text-xs sm:text-sm font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setIsLogin(true);
                        setError('');
                      }}
                      className={`py-2 rounded-lg transition-all duration-200 cursor-pointer ${
                        isLogin
                          ? 'bg-card text-foreground shadow-sm font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Partner Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsLogin(false);
                        setError('');
                      }}
                      className={`py-2 rounded-lg transition-all duration-200 cursor-pointer ${
                        !isLogin
                          ? 'bg-card text-foreground shadow-sm font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Register Restaurant
                    </button>
                  </div>

                  {/* Error Notification Alert */}
                  {error && (
                    <div className="mb-5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs sm:text-sm font-medium flex items-start gap-2.5 animate-in fade-in duration-200">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">{error}</div>
                    </div>
                  )}

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* 2-Column Responsive Grid for Registration Fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-xs font-bold text-foreground block mb-1.5">
                              Restaurant Name *
                            </label>
                            <div className="relative">
                              <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                              <Input
                                type="text"
                                placeholder="e.g. Royal Biryani House"
                                value={restaurantName}
                                onChange={(e) => setRestaurantName(e.target.value)}
                                required={!isLogin}
                                className="pl-10 h-11 rounded-xl bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-amber-500 text-sm font-medium transition-all"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-foreground block mb-1.5">
                              Owner Full Name *
                            </label>
                            <div className="relative">
                              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                              <Input
                                type="text"
                                placeholder="e.g. Vikramaditya Roy"
                                value={ownerName}
                                onChange={(e) => setOwnerName(e.target.value)}
                                required={!isLogin}
                                className="pl-10 h-11 rounded-xl bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-amber-500 text-sm font-medium transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-xs font-bold text-foreground block mb-1.5">
                              Phone Number *
                            </label>
                            <div className="relative">
                              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                              <Input
                                type="tel"
                                placeholder="+91 98765 43210"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required={!isLogin}
                                className="pl-10 h-11 rounded-xl bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-amber-500 text-sm font-medium transition-all"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-foreground block mb-1.5">
                              Cuisine Types *
                            </label>
                            <div className="relative">
                              <Utensils className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                              <Input
                                type="text"
                                placeholder="e.g. Biryani, North Indian, Mughlai"
                                value={cuisines}
                                onChange={(e) => setCuisines(e.target.value)}
                                required={!isLogin}
                                className="pl-10 h-11 rounded-xl bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-amber-500 text-sm font-medium transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-foreground block mb-1.5">
                            Restaurant Street Address *
                          </label>
                          <div className="relative">
                            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <Input
                              type="text"
                              placeholder="Shop 12, High Street Food Plaza, Sector 4"
                              value={address}
                              onChange={(e) => setAddress(e.target.value)}
                              required={!isLogin}
                              className="pl-10 h-11 rounded-xl bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-amber-500 text-sm font-medium transition-all"
                            />
                          </div>
                        </div>

                        {/* Interactive Kitchen GPS Location Pinpoint */}
                        <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/25 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center ring-1 ring-amber-500/25 flex-shrink-0">
                                <Navigation className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="text-xs font-bold text-foreground">
                                    Kitchen GPS Pinpoint
                                  </h4>
                                  {hasGpsCoordinates ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                                      <CheckCircle2 className="w-3 h-3" /> GPS Locked
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-medium text-muted-foreground">
                                      Optional but recommended
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  Guides delivery riders directly to your pickup counter
                                </p>
                              </div>
                            </div>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleDetectGPS}
                              disabled={locatingGps}
                              className="h-8 px-3 rounded-xl border-amber-500/40 hover:bg-amber-500/10 hover:border-amber-500 text-amber-600 dark:text-amber-400 font-bold text-xs gap-1.5 transition-all shadow-sm cursor-pointer self-start sm:self-auto"
                            >
                              {locatingGps ? (
                                <>
                                  <Spinner className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Detecting GPS...</span>
                                </>
                              ) : (
                                <>
                                  <LocateFixed className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                                  <span>Auto-Detect GPS</span>
                                </>
                              )}
                            </Button>
                          </div>

                          {/* Detected Area Pill if Nominatim succeeded */}
                          {detectedArea && (
                            <div className="text-[11px] bg-card/80 rounded-xl p-2.5 border border-border/60 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                                <MapPin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                <span className="truncate">
                                  Detected: <strong className="text-foreground">{detectedArea}</strong>
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setAddress(detectedArea)}
                                className="text-[10px] font-bold text-amber-500 hover:underline flex-shrink-0 cursor-pointer"
                              >
                                Use as Address
                              </button>
                            </div>
                          )}

                          {/* Latitude and Longitude Dual Input Fields */}
                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                                Latitude (°N)
                              </label>
                              <div className="relative">
                                <Compass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                <Input
                                  type="number"
                                  step="any"
                                  placeholder="e.g. 28.7041"
                                  value={latitude}
                                  onChange={(e) => setLatitude(e.target.value)}
                                  className="pl-8 h-9 rounded-lg bg-card/80 border-border/70 text-foreground text-xs font-mono transition-all"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                                Longitude (°E)
                              </label>
                              <div className="relative">
                                <Compass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                <Input
                                  type="number"
                                  step="any"
                                  placeholder="e.g. 77.1025"
                                  value={longitude}
                                  onChange={(e) => setLongitude(e.target.value)}
                                  className="pl-8 h-9 rounded-lg bg-card/80 border-border/70 text-foreground text-xs font-mono transition-all"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Email & Password (Works for both Login & Signup) */}
                    <div className={!isLogin ? 'grid grid-cols-1 sm:grid-cols-2 gap-3.5' : 'space-y-4'}>
                      <div>
                        <label className="text-xs font-bold text-foreground block mb-1.5">
                          Business Email Address *
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                          <Input
                            type="email"
                            placeholder="partner@restaurant.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                            className="pl-10 h-11 rounded-xl bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-amber-500 text-sm font-medium transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-foreground">
                            Password *
                          </label>
                          {!isLogin && (
                            <span className="text-[11px] text-muted-foreground">Min. 6 chars</span>
                          )}
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            disabled={loading}
                            className="pl-10 pr-10 h-11 rounded-xl bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-amber-500 text-sm font-medium transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 sm:h-12 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:opacity-95 text-white font-bold shadow-lg shadow-amber-500/25 rounded-xl group transition-all text-sm sm:text-base mt-3 cursor-pointer"
                      disabled={loading}
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <Spinner className="h-5 w-5 text-white" />
                          <span>{isLogin ? 'Authenticating Merchant...' : 'Creating Partner Account...'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span>{isLogin ? 'Sign In to Restaurant Dashboard' : 'Complete Restaurant Registration'}</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      )}
                    </Button>
                  </form>

                  {/* Switch Action Subtext */}
                  <div className="mt-5 text-center">
                    <p className="text-xs text-muted-foreground">
                      {isLogin ? 'Looking to list a new restaurant?' : 'Already have a registered restaurant?'}
                      <button
                        type="button"
                        onClick={() => {
                          setIsLogin(!isLogin);
                          setError('');
                        }}
                        className="ml-1 text-amber-500 hover:underline font-bold transition-colors cursor-pointer"
                      >
                        {isLogin ? 'Register your kitchen here' : 'Sign in to dashboard'}
                      </button>
                    </p>
                  </div>

                  {/* Cross-Portal Switcher Footer */}
                  <div className="mt-6 pt-5 border-t border-border/60">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center mb-2.5">
                      Switch Role Portal
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href="/customer/login"
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted border border-border/60 hover:border-border text-xs font-semibold text-foreground transition-all group"
                      >
                        <User className="w-3.5 h-3.5 text-orange-500 group-hover:scale-110 transition-transform" />
                        <span>Customer Portal</span>
                      </Link>
                      <Link
                        href="/delivery/login"
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted border border-border/60 hover:border-border text-xs font-semibold text-foreground transition-all group"
                      >
                        <Bike className="w-3.5 h-3.5 text-blue-500 group-hover:scale-110 transition-transform" />
                        <span>Delivery Fleet</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="w-full py-4 text-center text-xs text-muted-foreground z-10">
        © {new Date().getFullYear()} AKR Hunger Restaurant Commerce Network. All rights reserved.
      </footer>
    </div>
  );
}
