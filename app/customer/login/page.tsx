'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/context/AuthContext';
import {
  User,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Eye,
  EyeOff,
  Clock,
  ShieldCheck,
  Star,
  Store,
  Bike,
  Flame,
  CheckCircle2,
  HeartHandshake
} from 'lucide-react';
import ThemeToggle from '@/components/customer/ThemeToggle';

export default function LoginPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/customer');
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userId = userCredential.user.uid;

      // Check if this user is actually a customer
      const customerDoc = await getDoc(doc(db, 'customers', userId));

      if (!customerDoc.exists()) {
        await auth.signOut();
        setError('This account is not registered as a customer. Please sign up or use the restaurant/delivery portal.');
        setLoading(false);
        return;
      }

      router.push('/customer');
    } catch (err: any) {
      const message =
        err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password'
          ? 'Invalid email or password. Please check your credentials.'
          : err.message || 'Login failed. Please try again.';
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
      // Check if this email is already used by a restaurant
      const restaurantsQuery = query(collection(db, 'restaurants'), where('email', '==', email));
      const restaurantSnapshot = await getDocs(restaurantsQuery);

      if (!restaurantSnapshot.empty) {
        setError('This email is already registered as a restaurant partner. Please use a different email.');
        setLoading(false);
        return;
      }

      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Create customer document in Firestore
      await setDoc(doc(db, 'customers', userCredential.user.uid), {
        email,
        name,
        phone,
        addresses: [],
        defaultAddressId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      router.push('/customer');
    } catch (err: any) {
      const message =
        err.code === 'auth/email-already-in-use'
          ? 'An account with this email already exists. Please sign in instead.'
          : err.code === 'auth/weak-password'
          ? 'Password should be at least 6 characters.'
          : err.message || 'Signup failed. Please try again.';
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
    <div className="min-h-screen bg-background text-foreground relative flex flex-col justify-between selection:bg-primary/25 overflow-x-hidden">
      {/* Dynamic Ambient Mesh Glows */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-20 w-[550px] h-[550px] bg-primary/15 rounded-full blur-[130px] opacity-70 animate-pulse transition-all duration-1000" />
        <div className="absolute top-1/2 -right-32 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[150px] opacity-60 pointer-events-none" />
        <div className="absolute -bottom-20 left-1/3 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px] opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.1),rgba(255,255,255,0))]" />
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
            className="rounded-xl gap-2 font-semibold text-xs sm:text-sm h-9 px-3 bg-card/60 backdrop-blur-md border border-border/50 hover:border-primary/40 hover:bg-card shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Explore Menu</span>
          </Button>
          <div className="flex items-center gap-2.5 pl-3 border-l border-border/60">
            <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center p-1 ring-1 ring-primary/25">
              <img src="/akrhunger.png" alt="AKR Hunger Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-extrabold text-base sm:text-lg tracking-tight">
              AKR<span className="text-primary font-black">Hunger</span>
            </span>
          </div>
        </Link>

        {/* Action Controls (Portal Switcher Pill & Theme Toggle) */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-card/60 backdrop-blur-md border border-border/50 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Customer Portal</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-6 sm:py-10 z-10">
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Visual / Value Proposition Column (Visible on Desktop) */}
          <div className="hidden lg:flex lg:col-span-6 flex-col justify-center space-y-8 pr-4">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>The Culinary Experience</span>
              </div>
              <h1 className="text-4xl xl:text-5xl font-black tracking-tight leading-[1.15] text-foreground">
                Savor Every Craving,{' '}
                <span className="bg-gradient-to-r from-primary via-orange-500 to-amber-500 bg-clip-text text-transparent">
                  Delivered Hot & Fast.
                </span>
              </h1>
              <p className="text-muted-foreground text-base leading-relaxed max-w-md">
                Join thousands of food lovers enjoying chef-crafted delights, live GPS tracking, and irresistible culinary deals delivered straight to your door.
              </p>
            </div>

            {/* Perks Cards Grid */}
            <div className="grid grid-cols-2 gap-3.5 pt-2">
              <div className="p-3.5 rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 hover:border-primary/40 transition-all group shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <Clock className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">30-Min Fast Track</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Express delivery from your neighborhood favorites.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 hover:border-primary/40 transition-all group shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <Flame className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">Curated Delights</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Handpicked premium dining and authentic cuisines.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 hover:border-primary/40 transition-all group shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">Safe & Hygienic</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Strict kitchen safety protocols & contactless handoff.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 hover:border-primary/40 transition-all group shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <Star className="w-5 h-5 fill-blue-500/30 text-blue-500" />
                </div>
                <h4 className="font-bold text-sm text-foreground">4.9 Star Rating</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Over 100,000+ satisfied foodie reviews & counting.</p>
              </div>
            </div>

            {/* Social Proof Live Pill */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-card/40 backdrop-blur-md border border-border/50 shadow-inner">
              <div className="flex -space-x-2 overflow-hidden">
                <div className="inline-block h-8 w-8 rounded-full ring-2 ring-background bg-gradient-to-tr from-orange-400 to-amber-500 flex items-center justify-center text-[10px] font-bold text-white">AK</div>
                <div className="inline-block h-8 w-8 rounded-full ring-2 ring-background bg-gradient-to-tr from-emerald-400 to-teal-500 flex items-center justify-center text-[10px] font-bold text-white">RH</div>
                <div className="inline-block h-8 w-8 rounded-full ring-2 ring-background bg-gradient-to-tr from-primary to-rose-500 flex items-center justify-center text-[10px] font-bold text-white">MS</div>
              </div>
              <div className="text-xs">
                <span className="font-bold text-foreground">12,400+ meals</span>{' '}
                <span className="text-muted-foreground">delivered across the city today</span>
              </div>
            </div>
          </div>

          {/* Right Auth Card Column */}
          <div className="w-full lg:col-span-6 flex justify-center">
            <div className="w-full max-w-md">
              <div className="relative rounded-3xl bg-card/85 backdrop-blur-2xl border border-border/70 shadow-2xl overflow-hidden transition-all duration-300 hover:shadow-primary/5">
                {/* Glowing Top Gradient Bar */}
                <div className="h-1.5 bg-gradient-to-r from-primary via-orange-500 to-amber-500" />

                <div className="p-6 sm:p-8">
                  {/* Brand & Title Header */}
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-3 shadow-md shadow-primary/15 ring-2 ring-primary/20">
                      <img src="/akrhunger.png" alt="AKR Hunger" className="w-8 h-8 object-contain" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center justify-center gap-1.5">
                      {isLogin ? 'Welcome Back' : 'Create Account'}
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      {isLogin
                        ? 'Sign in to access your saved addresses & orders'
                        : 'Unlock exclusive coupons, faster checkouts & rewards'}
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
                      Sign In
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
                      Sign Up
                    </button>
                  </div>

                  {/* Error Notification Alert */}
                  {error && (
                    <div className="mb-5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs sm:text-sm font-medium flex items-start gap-2.5 animate-in fade-in duration-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 flex-shrink-0" />
                      <div className="flex-1">{error}</div>
                    </div>
                  )}

                  {/* Interactive Auth Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                      <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div>
                          <label className="text-xs font-bold text-foreground block mb-1.5">
                            Full Name
                          </label>
                          <div className="relative">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <Input
                              type="text"
                              placeholder="e.g. Rahul Sharma"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              required={!isLogin}
                              className="pl-10 h-11 rounded-xl bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-primary text-sm font-medium transition-all"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-foreground block mb-1.5">
                            Phone Number
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <Input
                              type="tel"
                              placeholder="+91 98765 43210"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              required={!isLogin}
                              className="pl-10 h-11 rounded-xl bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-primary text-sm font-medium transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1.5">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="pl-10 h-11 rounded-xl bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-primary text-sm font-medium transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-foreground">
                          Password
                        </label>
                        {!isLogin && (
                          <span className="text-[11px] text-muted-foreground">Min. 6 characters</span>
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
                          className="pl-10 pr-10 h-11 rounded-xl bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-primary text-sm font-medium transition-all"
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

                    <Button
                      type="submit"
                      className="w-full h-11 sm:h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/25 rounded-xl group transition-all text-sm sm:text-base mt-3 cursor-pointer"
                      disabled={loading}
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <Spinner className="h-5 w-5 text-primary-foreground" />
                          <span>Processing...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span>{isLogin ? 'Sign In to AKR Hunger' : 'Create Free Account'}</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      )}
                    </Button>
                  </form>

                  {/* Switch Action Subtext */}
                  <div className="mt-5 text-center">
                    <p className="text-xs text-muted-foreground">
                      {isLogin ? "Don't have an account yet?" : 'Already registered with us?'}
                      <button
                        type="button"
                        onClick={() => {
                          setIsLogin(!isLogin);
                          setError('');
                        }}
                        className="ml-1 text-primary hover:underline font-bold transition-colors cursor-pointer"
                      >
                        {isLogin ? 'Sign up here' : 'Sign in instead'}
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
                        href="/restaurant/login"
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted border border-border/60 hover:border-border text-xs font-semibold text-foreground transition-all group"
                      >
                        <Store className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
                        <span>Restaurant Partner</span>
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
        © {new Date().getFullYear()} AKR Hunger Technologies Inc. All rights reserved.
      </footer>
    </div>
  );
}
