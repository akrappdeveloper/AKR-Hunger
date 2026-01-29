'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle } from 'lucide-react';

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
        // This account is not a restaurant - sign out and show error
        await auth.signOut();
        setError('This account is not registered as a restaurant. Please use the restaurant signup form or check your credentials.');
        setLoading(false);
        return;
      }
      console.log('[Restaurant] Login successful');
      router.push('/restaurant');
    } catch (err: any) {
      console.error('[Restaurant] Login error:', err);
      setError(err.message || 'Failed to login. Please check your credentials.');
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
        setError('This email is already registered as a customer account. Please use a different email for your restaurant.');
        setLoading(false);
        return;
      }

      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const userId = userCredential.user.uid;

      // Parse cuisines into array
      const cuisineArray = cuisines.split(',').map(c => c.trim()).filter(c => c);

      // Create restaurant document in Firestore
      await setDoc(doc(db, 'restaurants', userId), {
        name: restaurantName,
        ownerName,
        ownerId: userId,
        email,
        phone,
        address,
        cuisines: cuisineArray,
        description: `Delicious ${cuisineArray.join(', ')} cuisine`,
        rating: 0,
        reviews: 0,
        deliveryTime: 30,
        deliveryCharge: 50,
        minimumOrder: 250,
        isOpen: true,
        image: 'https://via.placeholder.com/300',
        coordinates: {
          latitude: 0,
          longitude: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log('[Restaurant] Signup successful:', userCredential.user.email);
      router.push('/restaurant');
    } catch (err: any) {
      console.error('[Restaurant] Signup error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-900/20 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-red-900/20 via-transparent to-transparent" />

      <Card className="w-full max-w-lg relative z-10 bg-gray-900/50 border-gray-700 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center pb-8">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-500 via-red-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-500/30 ring-4 ring-orange-500/20">
              <span className="text-5xl">🍳</span>
            </div>
          </div>
          <CardTitle className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-orange-400 via-red-400 to-orange-300 bg-clip-text text-transparent mb-3">
            {isLogin ? 'Restaurant Login' : 'Register Your Restaurant'}
          </CardTitle>
          <CardDescription className="text-gray-300 text-base font-medium">
            {isLogin
              ? 'Access your restaurant dashboard and manage orders'
              : 'Join our platform and start serving delicious food'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex gap-3 p-4 bg-red-900/30 border border-red-500/40 rounded-xl backdrop-blur-sm">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300 font-medium">{error}</p>
              </div>
            )}

            {!isLogin && (
              <>
                <div>
                  <label className="text-sm font-semibold text-white block mb-2">
                    Restaurant Name *
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g., Tasty Bites Restaurant"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    required={!isLogin}
                    className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20 h-12"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-white block mb-2">
                    Owner Name *
                  </label>
                  <Input
                    type="text"
                    placeholder="Your full name"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    required={!isLogin}
                    className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20 h-12"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-white block mb-2">
                    Phone Number *
                  </label>
                  <Input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required={!isLogin}
                    className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20 h-12"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-white block mb-2">
                    Restaurant Address *
                  </label>
                  <Input
                    type="text"
                    placeholder="123 Main St, City, State, ZIP"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required={!isLogin}
                    className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20 h-12"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-white block mb-2">
                    Cuisine Types *
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g., Italian, Chinese, Indian (comma separated)"
                    value={cuisines}
                    onChange={(e) => setCuisines(e.target.value)}
                    required={!isLogin}
                    className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20 h-12"
                  />
                  <p className="text-xs text-gray-400 mt-2 font-medium">
                    Separate multiple cuisines with commas
                  </p>
                </div>
              </>
            )}

            <div>
              <label className="text-sm font-semibold text-white block mb-2">
                Email *
              </label>
              <Input
                type="email"
                placeholder="restaurant@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20 h-12"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-white block mb-2">
                Password *
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20 h-12"
              />
              {!isLogin && (
                <p className="text-xs text-gray-400 mt-2 font-medium">
                  Must be at least 6 characters
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-orange-500 via-red-500 to-orange-600 hover:from-orange-600 hover:via-red-600 hover:to-orange-700 text-white font-bold text-base shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40 transition-all transform hover:scale-[1.02]"
              disabled={loading}
            >
              {loading && <Spinner className="mr-2 h-4 w-4" />}
              {isLogin ? 'Sign In' : 'Create Restaurant Account'}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-300 font-medium">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
            </p>
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-orange-400 hover:text-orange-300 hover:underline font-semibold text-sm mt-2 transition-colors"
            >
              {isLogin ? 'Register your restaurant' : 'Sign in instead'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
