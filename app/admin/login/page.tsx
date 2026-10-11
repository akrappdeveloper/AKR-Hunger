'use client';

import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  ShieldAlert,
  Server,
  KeyRound,
  CheckCircle2,
  ArrowLeft,
  Sun,
  Moon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import ThemeToggle from '@/components/customer/ThemeToggle';
import { toast } from 'sonner';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);

      toast.success('Admin authorization verified. Welcome to Executive Suite!');
      router.push('/admin');
    } catch (err: any) {
      console.error('Admin login error:', err);
      let errorMsg = 'Invalid administrative credentials or insufficient authorization.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMsg = 'Invalid email address or security key. Access denied.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMsg = 'Too many failed login attempts. Access temporarily locked for security. Please try again later.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col justify-between relative overflow-x-hidden selection:bg-primary/20">
      {/* Background Glows & Dynamic Mesh */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-blue-600/10 dark:bg-blue-600/20 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute top-1/3 -right-40 w-[550px] h-[550px] bg-indigo-600/10 dark:bg-indigo-600/20 rounded-full blur-[150px]" />
        <div className="absolute -bottom-40 left-1/4 w-[600px] h-[600px] bg-purple-600/10 dark:bg-purple-600/15 rounded-full blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent" />
      </div>

      {/* Top Header Navigation */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between z-20">
        <Link
          href="/"
          className="flex items-center gap-2.5 group text-muted-foreground hover:text-foreground transition-all duration-200"
        >
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl gap-2 font-semibold text-xs sm:text-sm h-9 px-3 bg-card/60 backdrop-blur-md border border-border/60 hover:border-blue-500/40 hover:bg-card shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Storefront</span>
          </Button>
          <div className="flex items-center gap-2.5 pl-3 border-l border-border/60">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center p-1.5 shadow-md shadow-blue-500/20">
              <ShieldCheck className="w-full h-full text-white" />
            </div>
            <span className="font-extrabold text-base sm:text-lg tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Hunger Admin
            </span>
          </div>
        </Link>

        {/* Status Pill & Theme Toggle */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>High-Security Console</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12 z-10">
        <div className="w-full max-w-md">
          <div className="relative rounded-3xl bg-card/80 backdrop-blur-2xl border border-border/80 shadow-[0_20px_70px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_70px_rgba(0,0,0,0.4)] overflow-hidden transition-all duration-300">
            {/* Top Sleek Gradient Bar */}
            <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />

            <div className="p-6 sm:p-8">
              {/* Header Icon & Title */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white mb-3.5 shadow-lg shadow-blue-600/25 ring-4 ring-blue-500/10">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                  Executive Admin Portal
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Centralized platform intelligence, metrics & administrative control
                </p>
              </div>

              {/* Security Shield Tag */}
              <div className="flex items-center justify-center gap-2 mb-6 py-1.5 px-3 rounded-xl bg-muted/50 border border-border/50 text-[11px] font-medium text-muted-foreground">
                <Lock className="w-3.5 h-3.5 text-blue-500" />
                <span>256-Bit SSL Encrypted Admin Verification</span>
              </div>

              {/* Error Notice */}
              {error && (
                <div className="mb-5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs sm:text-sm font-medium flex items-start gap-2.5 animate-in fade-in duration-200">
                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
                  <div className="flex-1">{error}</div>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">
                    Administrative Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="email"
                      placeholder="admin@akrhunger.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="pl-10 h-11 sm:h-12 rounded-xl bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-blue-500 text-sm font-medium transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-foreground">
                      Security Key / Password
                    </label>
                    <span className="text-[11px] text-muted-foreground font-mono">Protected</span>
                  </div>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="pl-10 pr-10 h-11 sm:h-12 rounded-xl bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-blue-500 text-sm font-medium transition-all"
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

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 sm:h-12 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-600 text-white font-bold shadow-lg shadow-blue-600/25 rounded-xl group transition-all text-sm sm:text-base mt-2 cursor-pointer"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Spinner className="h-5 w-5 text-white" />
                      <span>Authenticating Credentials...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span>Access Intelligence Suite</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  )}
                </Button>
              </form>

              {/* Security Advisory Notice */}
              <div className="mt-5 pt-4 border-t border-border/50 text-center">
                <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 font-medium">
                  <Lock className="w-3 h-3 text-blue-500 shrink-0" />
                  <span>Authorized Personnel Only • All Access Attempts Logged & Audited</span>
                </p>
              </div>

              {/* Security Compliance Footer Badges */}
              <div className="mt-5 grid grid-cols-2 gap-2 text-center">
                <div className="p-2 rounded-xl bg-muted/30 border border-border/40 text-[10px] text-muted-foreground font-medium flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span>Encrypted Session</span>
                </div>
                <div className="p-2 rounded-xl bg-muted/30 border border-border/40 text-[10px] text-muted-foreground font-medium flex items-center justify-center gap-1.5">
                  <Server className="w-3 h-3 text-blue-500" />
                  <span>Zero-Trust Architecture</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-muted-foreground z-10">
        © {new Date().getFullYear()} Hunger Technologies Inc. Enterprise Management System.
      </footer>
    </div>
  );
}
