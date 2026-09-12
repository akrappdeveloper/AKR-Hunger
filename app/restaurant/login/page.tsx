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
  BarChart3
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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

      // Check if this user is actually a restaurant
      const restaurantDoc = await getDoc(doc(db, 'restaurants', userId));

      if (!restaurantDoc.exists()) {
        await auth.signOut();
        setError('This account is not registered as a restaurant partner. Please check your credentials or register your restaurant.');
        setLoading(false);
        return;
      }
      router.push('/restaurant');
    } catch (err: any) {
      const message =
        err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password'
          ? 'Invalid email or password. Please verify your merchant credentials.'
          : err.message || 'Failed to login. Please check your credentials.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // First check if this email is already used by a customer
      const customersQuery = query(collection(db, 'customers'), where('email', '==', email));
      const customerSnapshot = await getDocs(customersQuery);

      if (!customerSnapshot.empty) {
        setError('This email is already registered as a customer account. Please use a distinct business email for your restaurant.');
        setLoading(false);
        return;
      }

      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const userId = userCredential.user.uid;

      // Parse cuisines into array
      const cuisineArray = cuisines
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c);

      // Create restaurant document in Firestore
      await setDoc(doc(db, 'restaurants', userId), {
        name: restaurantName,
        ownerName,
        ownerId: userId,
        email,
        phone,
        address,
        cuisines: cuisineArray.length > 0 ? cuisineArray : ['Multi-Cuisine'],
        description: `Delicious ${cuisineArray.join(', ')} cuisine`,
        rating: 0,
        reviews: 0,
        deliveryTime: 30,
        deliveryCharge: 40,
        minimumOrder: 100,
        isOpen: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      router.push('/restaurant');
    } catch (err: any) {
      const message =
        err.code === 'auth/email-already-in-use'
          ? 'An account with this email already exists. Please sign in.'
          : err.code === 'auth/weak-password'
          ? 'Password must be at least 6 characters.'
          : err.message || 'Failed to create restaurant account. Please try again.';
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
        <Link
          href="/customer"
          className="flex items-center gap-2 group text-muted-foreground hover:text-foreground transition-all duration-200"
        >
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl gap-2 font-semibold text-xs sm:text-sm h-9 px-3 bg-card/60 backdrop-blur-md border border-border/50 hover:border-amber-500/40 hover:bg-card shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Storefront</span>
          </Button>
          <div className="flex items-center gap-2.5 pl-3 border-l border-border/60">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center p-1.5 ring-1 ring-amber-500/25">
              <Store className="w-full h-full text-amber-500" />
            </div>
            <span className="font-extrabold text-base sm:text-lg tracking-tight">
              AKR<span className="text-amber-500 font-black">Merchant</span>
            </span>
          </div>
        </Link>

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
