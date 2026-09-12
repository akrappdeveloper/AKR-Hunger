'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Bike,
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Zap,
  Clock,
  CheckCircle2,
  TrendingUp,
  MapPin,
  FileCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Store,
  User,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import ThemeToggle from '@/components/customer/ThemeToggle';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useDeliveryAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPending, setShowPending] = useState(false);

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setShowPending(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/delivery');
    } catch (err: any) {
      if (err.message && err.message.includes('Access Denied')) {
        setError(err.message);
      } else {
        setError(err.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (showPending) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-blue-500/25 relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px]" />
        </div>

        {/* Top Minimal Bar */}
        <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between z-20">
          <Link href="/customer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <Button variant="ghost" size="sm" className="rounded-xl gap-2 font-semibold text-xs h-9 bg-card/60 backdrop-blur-md border border-border/50">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Button>
          </Link>
          <ThemeToggle />
        </header>

        {/* Application Submitted Luxury Modal Card */}
        <main className="flex-1 flex items-center justify-center p-4 z-10">
          <div className="w-full max-w-lg">
            <div className="rounded-3xl bg-card/90 backdrop-blur-2xl border border-border/80 shadow-2xl overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-blue-500 to-cyan-500" />
              
              <div className="p-6 sm:p-8 text-center space-y-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-500 ring-4 ring-emerald-500/10 shadow-lg shadow-emerald-500/20">
                  <FileCheck className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold uppercase tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Application Submitted
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                    Verification in Progress
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
                    Thank you for applying to the AKR Hunger Fleet! Our administrative verification team is actively reviewing your submitted documents.
                  </p>
                </div>

                {/* 3-Step Process Stepper */}
                <div className="bg-muted/40 rounded-2xl p-4 border border-border/60 text-left space-y-3.5">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold mt-0.5 flex-shrink-0">
                      ✓
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Step 1: Partner Application</h4>
                      <p className="text-[11px] text-muted-foreground">Basic details and vehicle profile recorded.</p>
                    </div>
                  </div>

                  <div className="w-0.5 h-3 bg-emerald-500/40 ml-3" />

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold mt-0.5 flex-shrink-0 animate-pulse">
                      2
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Step 2: Document Verification</h4>
                      <p className="text-[11px] text-muted-foreground">Driving license, RC & KYC identity validation in progress.</p>
                    </div>
                  </div>

                  <div className="w-0.5 h-3 bg-border ml-3" />

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-muted border border-border text-muted-foreground flex items-center justify-center text-xs font-bold mt-0.5 flex-shrink-0">
                      3
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground">Step 3: Fleet Activation & First Trip</h4>
                      <p className="text-[11px] text-muted-foreground">Instant dashboard access granted upon approval.</p>
                    </div>
                  </div>
                </div>

                {/* Timeline info notice */}
                <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-medium">
                  <Clock className="w-4 h-4" />
                  <span>Estimated turnaround time: <strong>24 to 48 hours</strong></span>
                </div>

                {/* Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowPending(false)}
                    className="flex-1 h-11 rounded-xl border-border hover:bg-muted font-bold text-xs sm:text-sm cursor-pointer"
                  >
                    Return to Fleet Sign In
                  </Button>
                  <Link href="/delivery/support" className="flex-1">
                    <Button
                      variant="ghost"
                      className="w-full h-11 rounded-xl text-muted-foreground hover:text-foreground font-semibold text-xs sm:text-sm gap-1.5"
                    >
                      <HelpCircle className="w-4 h-4" />
                      Contact Fleet Support
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="w-full py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} AKR Hunger Logistics Network.
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative flex flex-col justify-between selection:bg-blue-500/25 overflow-x-hidden">
      {/* Dynamic Ambient Mesh Glows (High-Tech Fleet Neon Blue & Deep Graphite) */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-32 -right-20 w-[550px] h-[550px] bg-blue-600/15 rounded-full blur-[140px] opacity-70 animate-pulse transition-all duration-1000" />
        <div className="absolute top-1/2 -left-32 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[150px] opacity-60" />
        <div className="absolute -bottom-20 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px] opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.08),rgba(255,255,255,0))]" />
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
            className="rounded-xl gap-2 font-semibold text-xs sm:text-sm h-9 px-3 bg-card/60 backdrop-blur-md border border-border/50 hover:border-blue-500/40 hover:bg-card shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Storefront</span>
          </Button>
          <div className="flex items-center gap-2.5 pl-3 border-l border-border/60">
            <div className="w-8 h-8 rounded-xl bg-blue-600/15 flex items-center justify-center p-1.5 ring-1 ring-blue-500/25">
              <Bike className="w-full h-full text-blue-500" />
            </div>
            <span className="font-extrabold text-base sm:text-lg tracking-tight">
              AKR<span className="text-blue-500 font-black">Fleet</span>
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-card/60 backdrop-blur-md border border-border/50 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>Delivery Partner Portal</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-6 sm:py-10 z-10">
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Fleet Value Proposition Showcase (Desktop) */}
          <div className="hidden lg:flex lg:col-span-6 flex-col justify-center space-y-8 pr-4">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-500 text-xs font-bold tracking-wide uppercase">
                <Zap className="w-3.5 h-3.5 text-blue-500" />
                <span>AKR Logistics Network</span>
              </div>
              <h1 className="text-4xl xl:text-5xl font-black tracking-tight leading-[1.15] text-foreground">
                Deliver Speed,{' '}
                <span className="bg-gradient-to-r from-blue-500 via-cyan-500 to-indigo-500 bg-clip-text text-transparent">
                  Earn Maximum Freedom.
                </span>
              </h1>
              <p className="text-muted-foreground text-base leading-relaxed max-w-md">
                Take control of your schedule. Join thousands of high-earning fleet champions delivering culinary orders with industry-leading payouts and instant settlements.
              </p>
            </div>

            {/* Fleet Benefit Cards */}
            <div className="grid grid-cols-2 gap-3.5 pt-2">
              <div className="p-3.5 rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 hover:border-blue-500/40 transition-all group shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">₹25K - ₹35K / Mo</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Competitive trip pay, peak surges & delivery bonuses.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 hover:border-blue-500/40 transition-all group shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <Zap className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">Instant Daily Payouts</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Transfer your earnings straight to your bank account anytime.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 hover:border-blue-500/40 transition-all group shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">₹5 Lakh Insurance</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Comprehensive on-duty accidental & medical security.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 hover:border-blue-500/40 transition-all group shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <MapPin className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">Smart AI Dispatch</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Optimal routes, batched pick-ups & minimal idle time.</p>
              </div>
            </div>

            {/* Live Fleet Counter Pill */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-card/40 backdrop-blur-md border border-border/50 shadow-inner">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
              <div className="text-xs">
                <span className="font-bold text-foreground">4,850+ Riders active</span>{' '}
                <span className="text-muted-foreground">completing deliveries right now</span>
              </div>
            </div>
          </div>

          {/* Right Fleet Auth Card */}
          <div className="w-full lg:col-span-6 flex justify-center">
            <div className="w-full max-w-md">
              <div className="relative rounded-3xl bg-card/85 backdrop-blur-2xl border border-border/70 shadow-2xl overflow-hidden transition-all duration-300 hover:shadow-blue-500/5">
                {/* Glowing Top Electric Blue Gradient */}
                <div className="h-1.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600" />

                <div className="p-6 sm:p-8">
                  {/* Header */}
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/15 text-blue-500 mb-3 shadow-md shadow-blue-600/20 ring-2 ring-blue-500/20">
                      <Bike className="w-7 h-7" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                      Fleet Partner Sign In
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      Access your delivery console, earnings & active trips
                    </p>
                  </div>

                  {/* Error Box */}
                  {error && (
                    <div className="mb-5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs sm:text-sm font-medium flex items-start gap-2.5 animate-in fade-in duration-200">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">{error}</div>
                    </div>
                  )}

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1.5">
                        Registered Partner Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                          type="email"
                          placeholder="rider@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={loading}
                          className="pl-10 h-11 rounded-xl bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-blue-500 text-sm font-medium transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-foreground">
                          Password
                        </label>
                        <Link
                          href="/delivery/support"
                          className="text-[11px] text-blue-500 hover:underline font-semibold"
                        >
                          Forgot?
                        </Link>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={loading}
                          className="pl-10 pr-10 h-11 rounded-xl bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-blue-500 text-sm font-medium transition-all"
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
                      className="w-full h-11 sm:h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-600/25 rounded-xl group transition-all text-sm sm:text-base mt-3 cursor-pointer"
                      disabled={loading}
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <Spinner className="h-5 w-5 text-white" />
                          <span>Signing in to Fleet...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span>Enter Delivery Console</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      )}
                    </Button>
                  </form>

                  {/* Register Callout */}
                  <div className="mt-5 text-center">
                    <p className="text-xs text-muted-foreground">
                      Want to deliver with AKR Hunger?{' '}
                      <Link
                        href="/delivery/register"
                        className="text-blue-500 hover:text-blue-400 font-bold hover:underline transition-colors"
                      >
                        Apply to Join the Fleet
                      </Link>
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
                        href="/restaurant/login"
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted border border-border/60 hover:border-border text-xs font-semibold text-foreground transition-all group"
                      >
                        <Store className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
                        <span>Restaurant Partner</span>
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
        © {new Date().getFullYear()} AKR Hunger Logistics Network. All rights reserved.
      </footer>
    </div>
  );
}

export default function DeliveryLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="w-8 h-8 text-blue-500" />
            <p className="text-xs font-semibold text-muted-foreground tracking-wide">Loading Fleet Portal...</p>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
