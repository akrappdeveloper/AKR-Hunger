'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, sendPasswordResetEmail, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, increment } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import GoogleAuthModal from '@/components/customer/GoogleAuthModal';
import { toast } from 'sonner';
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
  HeartHandshake,
  Smartphone,
  Gift,
  KeyRound,
  RefreshCw,
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
  const [referralInput, setReferralInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot password dialog states
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState('');

  // Read URL query (?mode=signup, ?ref=...) or localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode') || params.get('tab');
      if (modeParam === 'signup' || modeParam === 'register') {
        setIsLogin(false);
      }
      const refParam = params.get('ref') || localStorage.getItem('hunger_referral_code');
      if (refParam && refParam.trim()) {
        const cleanRef = refParam.trim().toUpperCase();
        setReferralInput(cleanRef);
        setIsLogin(false); // Switch to sign up mode automatically
        toast.success(`🎁 Referral code ${cleanRef} applied! You'll get ₹50 free wallet balance on signup.`);
      }
    }
  }, []);

  const getRedirectTarget = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const red = params.get('redirect');
      if (red && red.startsWith('/')) return red;
    }
    return '/customer';
  };

  // Google Auth & Phone Dialog State
  const [isGoogleAuthModalOpen, setIsGoogleAuthModalOpen] = useState(false);
  const [isPopupBlocked, setIsPopupBlocked] = useState(false);
  const [googleModalError, setGoogleModalError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isRedirectChecking, setIsRedirectChecking] = useState(true);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [authenticatedGoogleUser, setAuthenticatedGoogleUser] = useState<{
    uid: string;
    name: string;
    email: string;
  } | null>(null);

  // Reusable unified handler for Google user authentication (Popup & Redirect)
  const processGoogleUser = async (googleUser: FirebaseUser) => {
    // 1. Verify account is not a registered restaurant partner
    const restaurantsQuery = query(collection(db, 'restaurants'), where('email', '==', googleUser.email));
    const restaurantSnapshot = await getDocs(restaurantsQuery);

    if (!restaurantSnapshot.empty) {
      await auth.signOut();
      setError('This Google account is already registered as a restaurant partner. Please use the restaurant portal.');
      setGoogleLoading(false);
      setIsGoogleSigningIn(false);
      setIsGoogleAuthModalOpen(false);
      return;
    }

    // 2. Fetch or create customer document in Firestore
    const customerRef = doc(db, 'customers', googleUser.uid);
    const customerDoc = await getDoc(customerRef);

    if (!customerDoc.exists()) {
      const newReferralCode = 'HUNGER' + Math.random().toString(36).substring(2, 7).toUpperCase();
      const codeToApply = (referralInput || (typeof window !== 'undefined' ? localStorage.getItem('hunger_referral_code') : '') || '').trim().toUpperCase();

      let referrerId: string | null = null;
      let referrerName: string = 'Hunger Friend';

      if (codeToApply) {
        try {
          const codeSnap = await getDoc(doc(db, 'referralCodes', codeToApply));
          if (codeSnap.exists()) {
            const data = codeSnap.data();
            referrerId = data?.uid || data?.userId || null;
            if (data?.userName) referrerName = data.userName;
          }
        } catch (e) {
          console.warn('Google referral check error', e);
        }

        if (!referrerId) {
          try {
            const custQuery = query(collection(db, 'customers'), where('referralCode', '==', codeToApply));
            const custSnap = await getDocs(custQuery);
            if (!custSnap.empty) {
              const d = custSnap.docs[0];
              referrerId = d.id;
              if (d.data()?.name) referrerName = d.data().name;
            }
          } catch (e) {
            console.warn('Customer referral lookup error', e);
          }
        }
      }

      const isReferralValid = !!(referrerId && referrerId !== googleUser.uid);
      const initialWallet = isReferralValid ? 50 : 0;

      const newCustomerData: any = {
        email: googleUser.email || '',
        name: googleUser.displayName || 'Customer',
        phone: googleUser.phoneNumber || '',
        avatar: googleUser.photoURL || '',
        addresses: [],
        defaultAddressId: null,
        favorites: [],
        favoriteRestaurants: [],
        walletBalance: initialWallet,
        membershipStatus: 'none',
        isBlocked: false,
        rewardPoints: 0,
        referralCode: newReferralCode,
        referralCount: 0,
        referralEarnings: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (isReferralValid) {
        newCustomerData.referredBy = referrerId;
        newCustomerData.usedReferralCode = codeToApply;
      }

      await setDoc(customerRef, newCustomerData);

      // Send Welcome Email via Resend
      if (googleUser.email) {
        fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'welcome',
            email: googleUser.email,
            name: googleUser.displayName || 'Foodie',
            role: 'customer',
          }),
        }).catch((err) => console.error('[Resend] Google customer welcome email notice:', err));
      }

      // Register new referral code
      await setDoc(doc(db, 'referralCodes', newReferralCode), {
        code: newReferralCode,
        uid: googleUser.uid,
        userId: googleUser.uid,
        userName: googleUser.displayName || 'Customer',
        userEmail: googleUser.email || '',
        createdAt: serverTimestamp(),
      });

      if (isReferralValid && referrerId) {
        try {
          await updateDoc(doc(db, 'customers', referrerId), {
            walletBalance: increment(50),
            referralCount: increment(1),
            referralEarnings: increment(50),
            referralPointsEarned: increment(50),
          });

          await addDoc(collection(db, 'referrals'), {
            referrerId,
            referrerName,
            referredUserId: googleUser.uid,
            referredUserName: googleUser.displayName || 'Customer',
            referredUserEmail: googleUser.email || '',
            referredUserPhone: googleUser.phoneNumber || '',
            referralCode: codeToApply,
            rewardAmount: 50,
            status: 'completed',
            channel: 'web',
            createdAt: serverTimestamp(),
          });

          await addDoc(collection(db, 'customers', googleUser.uid, 'walletTransactions'), {
            customerId: googleUser.uid,
            amount: 50,
            type: 'credit',
            status: 'completed',
            description: `🎁 Welcome Referral Bonus (${codeToApply})`,
            createdAt: serverTimestamp(),
          });

          await addDoc(collection(db, 'walletTransactions'), {
            customerId: googleUser.uid,
            amount: 50,
            type: 'credit',
            status: 'completed',
            description: `🎁 Welcome Referral Bonus (${codeToApply})`,
            createdAt: serverTimestamp(),
          });

          await addDoc(collection(db, 'customers', referrerId, 'walletTransactions'), {
            customerId: referrerId,
            amount: 50,
            type: 'credit',
            status: 'completed',
            description: `🎉 Referral Reward - ${googleUser.displayName || 'Customer'} joined`,
            createdAt: serverTimestamp(),
          });

          await addDoc(collection(db, 'walletTransactions'), {
            customerId: referrerId,
            amount: 50,
            type: 'credit',
            status: 'completed',
            description: `🎉 Referral Reward - ${googleUser.displayName || 'Customer'} joined`,
            createdAt: serverTimestamp(),
          });

          await addDoc(collection(db, 'notifications'), {
            userId: referrerId,
            title: '🎉 Referral Reward Earned!',
            message: `${googleUser.displayName || 'Friend'} joined using your referral link. ₹50 has been credited to your Hunger Wallet!`,
            type: 'referral',
            read: false,
            createdAt: serverTimestamp(),
          });

          if (typeof window !== 'undefined') {
            localStorage.removeItem('hunger_referral_code');
          }
          toast.success('🎉 Welcome! ₹50 referral bonus has been added to your wallet!');
        } catch (rewardErr) {
          console.error('Google referral reward error:', rewardErr);
        }
      }

      // Prompt for phone number since Google account doesn't provide phone
      if (!googleUser.phoneNumber) {
        setAuthenticatedGoogleUser({
          uid: googleUser.uid,
          name: googleUser.displayName || 'Customer',
          email: googleUser.email || '',
        });
        setPhoneInput('');
        setPhoneError('');
        setIsGoogleAuthModalOpen(false);
        setIsPhoneModalOpen(true);
        setGoogleLoading(false);
        setIsGoogleSigningIn(false);
        return;
      }
    } else {
      // Customer profile exists: check if phone is present and not empty
      const customerData = customerDoc.data();
      const existingPhone = customerData?.phone ? String(customerData.phone).trim() : '';

      if (!existingPhone) {
        setAuthenticatedGoogleUser({
          uid: googleUser.uid,
          name: customerData?.name || googleUser.displayName || 'Customer',
          email: customerData?.email || googleUser.email || '',
        });
        setPhoneInput('');
        setPhoneError('');
        setIsGoogleAuthModalOpen(false);
        setIsPhoneModalOpen(true);
        setGoogleLoading(false);
        setIsGoogleSigningIn(false);
        return;
      }
    }

    // Already has phone number: proceed to customer portal
    setIsGoogleAuthModalOpen(false);
    setIsGoogleSigningIn(false);
    setGoogleLoading(false);
    toast.success(`Welcome back, ${googleUser.displayName || 'Foodie'}!`);
    router.push(getRedirectTarget());
  };

  // Check for returning Google Redirect sign-in result on page mount
  useEffect(() => {
    let isMounted = true;
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user && isMounted) {
          setIsGoogleSigningIn(true);
          setGoogleLoading(true);
          await processGoogleUser(result.user);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Google Redirect Result Error:', err);
          setError(err.message || 'Google redirect sign-in failed. Please try again.');
        }
      } finally {
        if (isMounted) {
          setIsRedirectChecking(false);
          setGoogleLoading(false);
        }
      }
    };

    checkRedirect();
    return () => {
      isMounted = false;
    };
  }, []);

  // Redirect if already logged in (pause redirect while Google sign-in or phone setup dialog is active)
  useEffect(() => {
    const getRedirectTarget = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const red = params.get('redirect');
        if (red && red.startsWith('/')) return red;
      }
      return '/customer';
    };

    if (user && !isRedirectChecking && !isGoogleSigningIn && !isPhoneModalOpen) {
      router.push(getRedirectTarget());
    }
  }, [user, isRedirectChecking, isGoogleSigningIn, isPhoneModalOpen, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const getRedirectTarget = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const red = params.get('redirect');
        if (red && red.startsWith('/')) return red;
      }
      return '/customer';
    };

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !password) {
        setError('Please enter both email and password.');
        setLoading(false);
        return;
      }

      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const userId = userCredential.user.uid;

      // Check if this user is a restaurant or delivery partner
      const [restaurantsQuerySnap, deliveryQuerySnap] = await Promise.all([
        getDocs(query(collection(db, 'restaurants'), where('email', '==', cleanEmail))).catch(() => null),
        getDocs(query(collection(db, 'delivery_partners'), where('email', '==', cleanEmail))).catch(() => null),
      ]);

      if (restaurantsQuerySnap && !restaurantsQuerySnap.empty) {
        await auth.signOut();
        setError('This account is registered as a restaurant partner. Please use the restaurant portal.');
        setLoading(false);
        return;
      }

      if (deliveryQuerySnap && !deliveryQuerySnap.empty) {
        await auth.signOut();
        setError('This account is registered as a delivery fleet partner. Please use the delivery portal.');
        setLoading(false);
        return;
      }

      // Check if customer profile exists in Firestore
      const customerDoc = await getDoc(doc(db, 'customers', userId)).catch(() => null);

      if (!customerDoc || !customerDoc.exists()) {
        // Auto-provision customer document so user is never locked out
        const newReferralCode = 'HUNGER' + Math.random().toString(36).substring(2, 7).toUpperCase();
        const newCustomerData: any = {
          email: userCredential.user.email || cleanEmail,
          name: userCredential.user.displayName || cleanEmail.split('@')[0],
          phone: userCredential.user.phoneNumber || '',
          avatar: userCredential.user.photoURL || '',
          addresses: [],
          defaultAddressId: null,
          favorites: [],
          favoriteRestaurants: [],
          walletBalance: 0,
          membershipStatus: 'none',
          isBlocked: false,
          rewardPoints: 0,
          referralCode: newReferralCode,
          referralCount: 0,
          referralEarnings: 0,
          password,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await setDoc(doc(db, 'customers', userId), newCustomerData);

        // Also register referral code in directory
        await setDoc(doc(db, 'referralCodes', newReferralCode), {
          code: newReferralCode,
          uid: userId,
          userId,
          userName: newCustomerData.name,
          userEmail: newCustomerData.email,
          createdAt: serverTimestamp(),
        }).catch((e) => console.warn('Referral registry notice:', e));
      } else {
        // Sync password to customer doc in Firestore for seamless cross-platform login
        try {
          await updateDoc(doc(db, 'customers', userId), {
            password,
            updatedAt: new Date(),
          });
        } catch (syncErr) {
          console.warn('[Customer Login] Password sync notice:', syncErr);
        }
      }

      toast.success('Signed in successfully!');
      router.push(getRedirectTarget());
    } catch (err: any) {
      console.error('[Customer Login] Error:', err);
      let message = 'Login failed. Please try again.';
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password'
      ) {
        message = 'Invalid email or password. Please verify your credentials or click "Forgot password?".';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Too many failed attempts. Access temporarily restricted. Try again later or reset password.';
      } else if (err.code === 'auth/user-disabled') {
        message = 'This customer account has been suspended. Please contact customer support.';
      } else if (err.code === 'auth/network-request-failed') {
        message = 'Network connection failed. Please check your internet connection.';
      } else if (err.message) {
        message = err.message;
      }
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
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !password) {
        setError('Please enter both email and password.');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        setLoading(false);
        return;
      }

      // Check if this email is already used by a restaurant
      const restaurantsQuery = query(collection(db, 'restaurants'), where('email', '==', cleanEmail));
      const restaurantSnapshot = await getDocs(restaurantsQuery).catch(() => null);

      if (restaurantSnapshot && !restaurantSnapshot.empty) {
        setError('This email is already registered as a restaurant partner. Please use a different email.');
        setLoading(false);
        return;
      }

      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);

      const newUid = userCredential.user.uid;
      const myNewReferralCode = 'HUNGER' + Math.random().toString(36).substring(2, 7).toUpperCase();
      const codeToApply = (referralInput || (typeof window !== 'undefined' ? localStorage.getItem('hunger_referral_code') : '') || '').trim().toUpperCase();

      let referrerId: string | null = null;
      let referrerName: string = 'Hunger Friend';

      if (codeToApply) {
        try {
          const codeSnap = await getDoc(doc(db, 'referralCodes', codeToApply));
          if (codeSnap.exists()) {
            const data = codeSnap.data();
            referrerId = data?.uid || data?.userId || null;
            if (data?.userName) referrerName = data.userName;
          }
        } catch (e) {
          console.warn('Referral check error', e);
        }

        if (!referrerId) {
          try {
            const custQuery = query(collection(db, 'customers'), where('referralCode', '==', codeToApply));
            const custSnap = await getDocs(custQuery);
            if (!custSnap.empty) {
              const d = custSnap.docs[0];
              referrerId = d.id;
              if (d.data()?.name) referrerName = d.data().name;
            }
          } catch (e) {
            console.warn('Customer referral lookup error', e);
          }
        }
      }

      const isReferralValid = !!(referrerId && referrerId !== newUid);
      const initialWallet = isReferralValid ? 50 : 0;

      // Create customer document in Firestore with complete details matching Android app
      const customerData: any = {
        email: cleanEmail,
        password,
        name: name.trim() || cleanEmail.split('@')[0],
        phone: phone.trim(),
        avatar: '',
        addresses: [],
        defaultAddressId: null,
        favorites: [],
        favoriteRestaurants: [],
        walletBalance: initialWallet,
        membershipStatus: 'none',
        isBlocked: false,
        rewardPoints: 0,
        referralCode: myNewReferralCode,
        referralCount: 0,
        referralEarnings: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (isReferralValid) {
        customerData.referredBy = referrerId;
        customerData.usedReferralCode = codeToApply;
      }

      await setDoc(doc(db, 'customers', newUid), customerData);

      // Send Welcome Email via Resend
      if (cleanEmail) {
        fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'welcome',
            email: cleanEmail,
            name: name.trim() || 'Foodie',
            role: 'customer',
          }),
        }).catch((err) => console.error('[Resend] Customer welcome email notice:', err));
      }

      // Register new referral code in referralCodes registry
      await setDoc(doc(db, 'referralCodes', myNewReferralCode), {
        code: myNewReferralCode,
        uid: newUid,
        userId: newUid,
        userName: name.trim() || 'Customer',
        userEmail: cleanEmail,
        createdAt: serverTimestamp(),
      });

      // If valid referral, reward referrer, create referrals tracking entry & wallet transactions
      if (isReferralValid && referrerId) {
        try {
          // 1. Update Referrer balance & stats (+₹50)
          await updateDoc(doc(db, 'customers', referrerId), {
            walletBalance: increment(50),
            referralCount: increment(1),
            referralEarnings: increment(50),
            referralPointsEarned: increment(50),
          });

          // 2. Add to referrals tracking collection
          await addDoc(collection(db, 'referrals'), {
            referrerId,
            referrerName,
            referredUserId: newUid,
            referredUserName: name.trim() || 'Customer',
            referredUserEmail: cleanEmail,
            referredUserPhone: phone.trim(),
            referralCode: codeToApply,
            rewardAmount: 50,
            status: 'completed',
            channel: 'web',
            createdAt: serverTimestamp(),
          });

          // 3. Wallet transaction for referee
          await addDoc(collection(db, 'customers', newUid, 'walletTransactions'), {
            customerId: newUid,
            amount: 50,
            type: 'credit',
            status: 'completed',
            description: `🎁 Welcome Referral Bonus (${codeToApply})`,
            createdAt: serverTimestamp(),
          });

          await addDoc(collection(db, 'walletTransactions'), {
            customerId: newUid,
            amount: 50,
            type: 'credit',
            status: 'completed',
            description: `🎁 Welcome Referral Bonus (${codeToApply})`,
            createdAt: serverTimestamp(),
          });

          // 4. Wallet transaction for referrer
          await addDoc(collection(db, 'customers', referrerId, 'walletTransactions'), {
            customerId: referrerId,
            amount: 50,
            type: 'credit',
            status: 'completed',
            description: `🎉 Referral Reward - ${name.trim() || 'Friend'} joined`,
            createdAt: serverTimestamp(),
          });

          await addDoc(collection(db, 'walletTransactions'), {
            customerId: referrerId,
            amount: 50,
            type: 'credit',
            status: 'completed',
            description: `🎉 Referral Reward - ${name.trim() || 'Friend'} joined`,
            createdAt: serverTimestamp(),
          });

          // 5. Notification for referrer
          await addDoc(collection(db, 'notifications'), {
            userId: referrerId,
            title: '🎉 Referral Reward Earned!',
            message: `${name.trim() || 'Friend'} joined using your referral link. ₹50 has been credited to your Hunger Wallet!`,
            type: 'referral',
            read: false,
            createdAt: serverTimestamp(),
          });

          if (typeof window !== 'undefined') {
            localStorage.removeItem('hunger_referral_code');
          }
          toast.success('🎉 Welcome! ₹50 referral bonus has been added to your wallet!');
        } catch (rewardErr) {
          console.error('Error applying referral reward:', rewardErr);
        }
      }

      router.push(getRedirectTarget());
    } catch (err: any) {
      console.error('[Customer Signup] Error:', err);
      let message = 'Signup failed. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        message = 'An account with this email already exists. Please sign in above.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (err.code === 'auth/operation-not-allowed') {
        message = 'Email registration is currently unavailable. Please use Google Sign In.';
      } else if (err.code === 'auth/network-request-failed') {
        message = 'Network connection failed. Please check your internet connection.';
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordError('');
    setForgotPasswordSuccess(false);

    const cleanResetEmail = forgotPasswordEmail.trim().toLowerCase();
    if (!cleanResetEmail) {
      setForgotPasswordError('Please enter your registered email address.');
      return;
    }

    setForgotPasswordLoading(true);
    try {
      await sendPasswordResetEmail(auth, cleanResetEmail);
      setForgotPasswordSuccess(true);
      toast.success(`Password reset link sent to ${cleanResetEmail}`);
    } catch (err: any) {
      console.error('Password reset error:', err);
      let msg = 'Failed to send reset link. Please try again.';
      if (err.code === 'auth/user-not-found') {
        msg = 'No Hunger account found with this email.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many requests. Please wait a moment and try again.';
      } else if (err.message) {
        msg = err.message;
      }
      setForgotPasswordError(msg);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (isLogin) {
      handleLogin(e);
    } else {
      handleSignup(e);
    }
  };

  // Google Sign-In with Floating Window (Popup)
  const handleGooglePopupSignIn = async () => {
    setGoogleModalError('');
    setError('');
    setGoogleLoading(true);
    setIsGoogleSigningIn(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      await processGoogleUser(result.user);
    } catch (err: any) {
      console.error('Google Popup Sign-In Error:', err);
      setGoogleLoading(false);
      setIsGoogleSigningIn(false);

      if (err.code === 'auth/popup-blocked') {
        setIsPopupBlocked(true);
        setIsGoogleAuthModalOpen(true);
        setGoogleModalError('');
      } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setGoogleModalError(err.message || 'Google sign-in failed. Please try again.');
      }
    }
  };

  // Google Sign-In with Direct Redirect (100% immune to popup blockers)
  const handleGoogleRedirectSignIn = async () => {
    setGoogleModalError('');
    setError('');
    setGoogleLoading(true);
    setIsGoogleSigningIn(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      console.error('Google Redirect Sign-In Error:', err);
      setGoogleLoading(false);
      setIsGoogleSigningIn(false);
      setGoogleModalError(err.message || 'Failed to start redirect sign-in. Please try again.');
    }
  };

  const handleSavePhone = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPhoneError('');

    const digitsOnly = phoneInput.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      setPhoneError('Please enter a valid 10-digit mobile number.');
      return;
    }

    const last10 = digitsOnly.slice(-10);
    const formattedPhone = `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;

    const targetUid = authenticatedGoogleUser?.uid || user?.uid;
    if (!targetUid) {
      setPhoneError('Authentication session expired. Please sign in again.');
      return;
    }

    setSavingPhone(true);
    try {
      await updateDoc(doc(db, 'customers', targetUid), {
        phone: formattedPhone,
        updatedAt: new Date(),
      });

      toast.success('Mobile number saved! Welcome to Hunger.');
      setIsPhoneModalOpen(false);
      router.push(getRedirectTarget());
    } catch (err: any) {
      console.error('Error saving phone number:', err);
      setPhoneError(err.message || 'Failed to save phone number. Please try again.');
    } finally {
      setSavingPhone(false);
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
              <img src="/hunger.png" alt="Hunger Logo" className="w-full h-full object-contain rounded-lg" />
            </div>
            <span className="font-extrabold text-base sm:text-lg tracking-tight text-primary">
              Hunger
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
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-3 shadow-md shadow-primary/15 ring-2 ring-primary/20 overflow-hidden">
                      <img src="/hunger.png" alt="Hunger" className="w-10 h-10 object-contain rounded-xl" />
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

                  {/* Active Session Info Banner (if user is already authenticated) */}
                  {user && !isGoogleSigningIn && !isPhoneModalOpen && (
                    <div className="mb-5 p-3 rounded-2xl bg-primary/10 border border-primary/25 text-xs text-foreground flex items-center justify-between gap-2 animate-in fade-in">
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                        <span className="truncate">Active: <strong>{user.email || user.displayName}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => router.push(getRedirectTarget())}
                          className="h-7 px-2.5 text-xs font-bold bg-primary text-primary-foreground rounded-lg cursor-pointer"
                        >
                          Explore Menu
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            await auth.signOut();
                            toast.info('Signed out. You can now log into a different account.');
                          }}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          Switch
                        </Button>
                      </div>
                    </div>
                  )}

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

                  {/* Google Authentication Button - Opens our Custom Google Auth Popup */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setError('');
                      setGoogleModalError('');
                      setIsGoogleAuthModalOpen(true);
                    }}
                    disabled={googleLoading || loading}
                    className="w-full h-11 sm:h-12 rounded-xl border border-border/80 hover:border-primary/40 bg-card/60 hover:bg-muted/50 text-foreground font-bold flex items-center justify-center gap-3 shadow-xs transition-all text-xs sm:text-sm cursor-pointer mb-5 group"
                  >
                    {googleLoading && isGoogleSigningIn && !isGoogleAuthModalOpen ? (
                      <div className="flex items-center gap-2">
                        <Spinner className="w-4 h-4 text-primary" />
                        <span className="text-muted-foreground">Connecting with Google...</span>
                      </div>
                    ) : (
                      <>
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        <span>Continue with Google</span>
                      </>
                    )}
                  </Button>

                  {/* Separator */}
                  <div className="relative flex items-center justify-center mb-5">
                    <div className="border-t border-border/70 w-full" />
                    <span className="bg-card px-3 text-[11px] font-bold tracking-wider text-muted-foreground uppercase absolute">
                      Or with email
                    </span>
                  </div>

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
                        {!isLogin ? (
                          <span className="text-[11px] text-muted-foreground">Min. 6 characters</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setForgotPasswordEmail(email);
                              setForgotPasswordError('');
                              setForgotPasswordSuccess(false);
                              setIsForgotPasswordOpen(true);
                            }}
                            className="text-[11px] text-primary hover:underline font-bold transition-colors cursor-pointer"
                          >
                            Forgot password?
                          </button>
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

                    {!isLogin && (
                      <div className="pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Gift className="w-3.5 h-3.5 text-orange-500" />
                            <span>Referral Code (Optional)</span>
                          </label>
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                            +₹50 Welcome Cash
                          </span>
                        </div>
                        <div className="relative">
                          <Gift className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500 pointer-events-none" />
                          <Input
                            type="text"
                            placeholder="e.g. HUNGERUSBAR"
                            value={referralInput}
                            onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                            className="pl-10 h-11 rounded-xl bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-primary text-sm font-mono font-bold tracking-wider transition-all uppercase"
                          />
                        </div>
                        {referralInput && (
                          <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Referral code active! ₹50 bonus will be added to your wallet on signup.</span>
                          </div>
                        )}
                      </div>
                    )}

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
                          <span>{isLogin ? 'Sign In to Hunger' : 'Create Free Account'}</span>
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
        © {new Date().getFullYear()} Hunger Technologies Inc. All rights reserved.
      </footer>

      {/* Google Sign-in Mandatory Phone Setup Dialog */}
      <Dialog open={isPhoneModalOpen} onOpenChange={(open) => {
        // Keep open until phone is saved
        if (!open && !savingPhone && phoneInput.length === 10) {
          handleSavePhone();
        }
      }}>
        <DialogContent
          className="max-w-md rounded-3xl p-6 sm:p-7 bg-card border border-border shadow-2xl"
          showCloseButton={false}
        >
          <DialogHeader className="text-center sm:text-left space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto sm:mx-0 shadow-sm ring-1 ring-primary/25">
              <Phone className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              One Last Step: Enter Phone Number
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Welcome to Hunger, <strong className="text-foreground">{authenticatedGoogleUser?.name || 'Foodie'}</strong>! To coordinate your food deliveries and share your delivery OTP, please enter your mobile number.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePhone} className="space-y-4 my-2">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">
                Mobile Number
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center gap-1 text-xs font-bold text-muted-foreground pointer-events-none select-none">
                  <span>🇮🇳</span>
                  <span>+91</span>
                </div>
                <Input
                  type="tel"
                  inputMode="numeric"
                  autoFocus
                  maxLength={10}
                  placeholder="98765 43210"
                  value={phoneInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setPhoneInput(val);
                    if (phoneError) setPhoneError('');
                  }}
                  className="pl-16 h-12 rounded-xl bg-muted/40 border-border/80 text-foreground placeholder:text-muted-foreground text-sm font-semibold tracking-wider transition-all focus:border-primary focus:bg-background"
                />
              </div>
              {phoneError && (
                <p className="text-xs text-destructive mt-1.5 font-medium flex items-center gap-1 animate-in fade-in">
                  <span className="w-1 h-1 rounded-full bg-destructive inline-block" />
                  {phoneError}
                </p>
              )}
            </div>

            <DialogFooter className="pt-2 sm:pt-3">
              <Button
                type="submit"
                disabled={savingPhone || phoneInput.length !== 10}
                className="w-full h-12 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground text-sm shadow-md shadow-primary/20 gap-2 cursor-pointer transition-all"
              >
                {savingPhone ? (
                  <>
                    <Spinner className="w-4 h-4 text-primary-foreground" />
                    <span>Saving Phone Number...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Save Phone Number</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Forgot Password Dialog */}
      <Dialog
        open={isForgotPasswordOpen}
        onOpenChange={(open) => {
          setIsForgotPasswordOpen(open);
          if (!open) {
            setForgotPasswordError('');
            setForgotPasswordSuccess(false);
          }
        }}
      >
        <DialogContent className="max-w-md rounded-3xl p-6 sm:p-7 bg-card border border-border shadow-2xl">
          <DialogHeader className="text-center sm:text-left space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto sm:mx-0 shadow-sm ring-1 ring-primary/25">
              <KeyRound className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Reset Your Password
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Enter the email associated with your Hunger account and we'll send you an instant link to securely reset your password.
            </DialogDescription>
          </DialogHeader>

          {forgotPasswordSuccess ? (
            <div className="my-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Password Reset Email Sent!</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Please check your inbox (and spam folder) for the password reset instructions sent to <strong>{forgotPasswordEmail}</strong>.
              </p>
              <Button
                type="button"
                onClick={() => {
                  setIsForgotPasswordOpen(false);
                  setForgotPasswordSuccess(false);
                }}
                className="w-full mt-3 h-10 rounded-xl font-bold bg-primary text-primary-foreground text-xs"
              >
                Back to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4 my-2">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  Your Account Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoFocus
                    required
                    value={forgotPasswordEmail}
                    onChange={(e) => {
                      setForgotPasswordEmail(e.target.value);
                      if (forgotPasswordError) setForgotPasswordError('');
                    }}
                    className="pl-10 h-12 rounded-xl bg-muted/40 border-border/80 text-foreground placeholder:text-muted-foreground text-sm font-medium transition-all focus:border-primary focus:bg-background"
                  />
                </div>
                {forgotPasswordError && (
                  <p className="text-xs text-destructive mt-1.5 font-medium flex items-center gap-1 animate-in fade-in">
                    <span className="w-1 h-1 rounded-full bg-destructive inline-block" />
                    {forgotPasswordError}
                  </p>
                )}
              </div>

              <DialogFooter className="pt-2 sm:pt-3 flex gap-2 sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsForgotPasswordOpen(false)}
                  className="rounded-xl h-11 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={forgotPasswordLoading || !forgotPasswordEmail.trim()}
                  className="flex-1 h-11 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground text-xs shadow-md shadow-primary/20 gap-2 cursor-pointer transition-all"
                >
                  {forgotPasswordLoading ? (
                    <>
                      <Spinner className="w-4 h-4 text-primary-foreground" />
                      <span>Sending Link...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Reset Link</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Our Custom Google Auth Popup Modal */}
      <GoogleAuthModal
        isOpen={isGoogleAuthModalOpen}
        onClose={() => {
          setIsGoogleAuthModalOpen(false);
          setGoogleModalError('');
        }}
        onPopupSignIn={handleGooglePopupSignIn}
        onRedirectSignIn={handleGoogleRedirectSignIn}
        loading={googleLoading}
        isPopupBlocked={isPopupBlocked}
        error={googleModalError}
      />
    </div>
  );
}

