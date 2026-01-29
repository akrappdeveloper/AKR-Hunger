'use client';

import React from "react"

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/context/AuthContext';
import { User, Mail, Phone, Lock, UtensilsCrossed, ArrowRight, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
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
        // This account is not a customer - sign out and show error
        await auth.signOut();
        setError('This account is not registered as a customer. Please sign up or use the correct portal.');
        setLoading(false);
        return;
      }

      console.log('[v0] Login successful:', userCredential.user.email);
      router.push('/customer');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // First check if this email is already used by a restaurant
      const restaurantsQuery = query(collection(db, 'restaurants'), where('email', '==', email));
      const restaurantSnapshot = await getDocs(restaurantsQuery);

      if (!restaurantSnapshot.empty) {
        setError('This email is already registered as a restaurant account. Please use a different email or login to the restaurant portal.');
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

      console.log('[v0] Signup successful:', userCredential.user.email);
      router.push('/customer');
    } catch (err: any) {
      setError(err.message || 'Signup failed');
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
    <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-black to-blue-500/10" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

      {/* Main Card */}
      <div className="relative w-full max-w-md">
        {/* Glassmorphic Card */}
        <div className="relative backdrop-blur-xl bg-gray-900/40 border border-gray-800/50 rounded-2xl shadow-2xl shadow-orange-900/20 overflow-hidden">
          {/* Top Glow Border */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent" />

          {/* Header */}
          <div className="p-8 text-center border-b border-gray-800/50">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-900/50 transform hover:scale-105 transition-transform">
                <UtensilsCrossed className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
              {isLogin ? 'Welcome Back' : 'Join AKRHunger'}
              <Sparkles className="w-5 h-5 text-orange-500" />
            </h1>
            <p className="text-gray-400 text-sm">
              {isLogin
                ? 'Sign in to continue your food journey'
                : 'Create an account and start ordering'}
            </p>
          </div>

          {/* Form */}
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg backdrop-blur-sm">
                  {error}
                </div>
              )}

              {!isLogin && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-300 block mb-2 flex items-center gap-2">
                      <User className="w-4 h-4 text-orange-500" />
                      Full Name
                    </label>
                    <Input
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={!isLogin}
                      className="bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-orange-500/20 h-11"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-300 block mb-2 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-orange-500" />
                      Phone Number
                    </label>
                    <Input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required={!isLogin}
                      className="bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-orange-500/20 h-11"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-orange-500" />
                  Email Address
                </label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-orange-500/20 h-11"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-orange-500" />
                  Password
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-orange-500/20 h-11"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold shadow-lg shadow-orange-900/30 border-none rounded-lg group"
                disabled={loading}
              >
                {loading ? (
                  <Spinner className="mr-2 h-5 w-5" />
                ) : (
                  <>
                    {isLogin ? 'Sign In' : 'Create Account'}
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>

            {/* Toggle Login/Signup */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400 mb-2">
                {isLogin ? "Don't have an account?" : 'Already have an account?'}
              </p>
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-orange-500 hover:text-orange-400 font-semibold text-sm transition-colors underline decoration-orange-500/30 hover:decoration-orange-500"
              >
                {isLogin ? 'Create one now' : 'Sign in instead'}
              </button>
            </div>

            {/* Other Portals Link */}
            <div className="mt-8 pt-6 border-t border-gray-800/50">
              <p className="text-xs text-gray-500 text-center">
                Looking for a different portal?{' '}
                <Link href="/restaurant/login" className="text-orange-500 hover:underline">
                  Restaurant
                </Link>
                {' · '}
                <Link href="/delivery/login" className="text-orange-500 hover:underline">
                  Delivery
                </Link>
                {' · '}
                <Link href="/admin/login" className="text-orange-500 hover:underline">
                  Admin
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Glow */}
        <div className="absolute -bottom-px left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
      </div>
    </div>
  );
}
