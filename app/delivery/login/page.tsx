'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, deliveryPartner } = useDeliveryAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      <div className="min-h-screen flex items-center justify-center bg-black bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-black to-black p-4">
        <Card className="w-full max-w-md border-green-500/30 bg-gray-900/50 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-green-500/10 rounded-full">
                <AlertCircle className="w-12 h-12 text-green-500" />
              </div>
            </div>
            <CardTitle className="text-white text-xl">Application Submitted</CardTitle>
            <CardDescription className="text-gray-400">Your account is currently under review.</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-gray-300">
              Thank you for registering. Our admin team will verify your documents (Vehicle & License).
              Once approved, you will be able to log in and start delivering.
            </p>
            <Button variant="outline" onClick={() => setShowPending(false)} className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black p-4">
      <Card className="w-full max-w-md border-gray-800 bg-gray-900/50 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Package className="w-6 h-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white tracking-tight">Welcome Back</CardTitle>
          <CardDescription className="text-gray-400">Sign in to your delivery partner portal</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm flex items-center justify-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Email Address</label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02]" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Not registered yet?{' '}
            <Link href="/delivery/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Join the Fleet
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DeliveryLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black text-white">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
