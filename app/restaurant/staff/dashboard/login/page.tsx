'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import {
  Users, KeyRound, Mail, Eye, EyeOff, Loader2, ShieldCheck,
  ChefHat, AlertTriangle, ArrowRight, Utensils
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Please enter both email and password');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const uid = userCredential.user.uid;

      // Verify that this user is a staff member
      const userDoc = await getDoc(doc(db, 'users', uid));
      const idTokenResult = await userCredential.user.getIdTokenResult(true);
      const isStaffClaim = idTokenResult.claims.role === 'staff' || idTokenResult.claims.isStaff === true;

      const uData = userDoc.exists() ? userDoc.data() : null;
      const isStaff = isStaffClaim || uData?.isStaff === true || uData?.role === 'staff';

      if (!isStaff) {
        await signOut(auth);
        setErrorMsg('Access Denied: This portal is only for restaurant staff members. Restaurant owners should use the main partner login.');
        toast.error('Not a staff account');
        return;
      }

      if (uData?.status === 'inactive') {
        await signOut(auth);
        setErrorMsg('Your staff account is currently inactive. Please contact your restaurant manager.');
        toast.error('Account inactive');
        return;
      }

      if (uData?.status === 'on_leave') {
        toast.warning('Welcome back! Note: Your status is marked as On Leave in the system.');
      } else {
        toast.success(`Welcome back, ${uData?.name || 'Team Member'}!`);
      }

      // Route to Staff Dashboard
      router.push('/restaurant/staff/dashboard');
    } catch (err: any) {
      console.error('[Staff Login Error]:', err);
      let message = 'Failed to sign in. Please check your credentials.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        message = 'Invalid staff email or password. Please verify your credentials.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Too many failed login attempts. Please wait a few minutes and try again.';
      }
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/30 to-background relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="border-border/60 shadow-2xl backdrop-blur-xl bg-card/95">
          <CardHeader className="text-center pb-6 pt-8">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-primary flex items-center justify-center shadow-lg shadow-purple-500/25 mb-4">
              <ChefHat className="w-8 h-8 text-white" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 mx-auto mb-2 border border-purple-500/20">
              <ShieldCheck className="w-3.5 h-3.5" /> Staff Portal
            </div>
            <CardTitle className="text-2xl font-black tracking-tight">
              Restaurant Crew Sign In
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-1">
              Enter the credentials provided by your restaurant manager
            </CardDescription>
          </CardHeader>

          <CardContent>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="leading-snug">{errorMsg}</span>
              </motion.div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="staff-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Staff Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="staff-email"
                    type="email"
                    placeholder="staff@restaurant.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="pl-10 h-11 bg-background/50 border-input focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="staff-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Password
                  </Label>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="staff-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pl-10 pr-10 h-11 bg-background/50 border-input focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 mt-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-primary hover:from-purple-700 hover:to-primary text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all duration-200"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying Credentials...
                  </>
                ) : (
                  <>
                    Sign In to Staff Panel <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-border/60 text-center">
              <p className="text-xs text-muted-foreground">
                Restaurant Owner or Partner?{' '}
                <Link
                  href="/restaurant/login"
                  className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  Owner Login Here <Utensils className="w-3 h-3" />
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
