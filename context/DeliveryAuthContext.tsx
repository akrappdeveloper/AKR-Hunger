'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { DeliveryPerson } from '@/lib/types';

interface DeliveryAuthContextType {
  user: any | null;
  deliveryPartner: DeliveryPerson | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Omit<DeliveryPerson, 'id' | 'rating' | 'status' | 'createdAt'>, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateLocation: (latitude: number, longitude: number, extra?: { accuracy?: number; speed?: number; heading?: number }) => Promise<void>;
  updateStatus: (status: 'online' | 'offline' | 'on_delivery') => Promise<void>;
}

const DeliveryAuthContext = createContext<DeliveryAuthContextType | undefined>(undefined);

export function DeliveryAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [deliveryPartner, setDeliveryPartner] = useState<DeliveryPerson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        try {
          const partnerDoc = await getDoc(doc(db, 'deliveryPersons', currentUser.uid));
          if (partnerDoc.exists()) {
            setDeliveryPartner({
              ...partnerDoc.data(),
              id: partnerDoc.id,
            } as DeliveryPerson);
          } else {
            // Handle case where auth exists but firestore doc doesn't (maybe newly registered but doc creation failed?)
            setDeliveryPartner(null);
          }
        } catch (error) {
          console.error("Error fetching delivery partner profile:", error);
          setDeliveryPartner(null);
        }

      } else {
        setUser(null);
        setDeliveryPartner(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // 1. Explicitly Block Admins
      const adminDoc = await getDoc(doc(db, 'admins', uid));
      if (adminDoc.exists()) {
        await signOut(auth);
        throw new Error('This is an Administrator account. Please use the Admin Portal.');
      }

      // 2. Strict Role Check: Verify if this user is actually a Delivery Partner
      const docRef = doc(db, 'deliveryPersons', uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        // User exists in Firebase Auth (maybe as Customer or Restaurant) but NOT as Delivery Partner
        await signOut(auth);
        throw new Error('Access Denied: This account is not registered as a Delivery Partner.');
      }

      const deliveryData = docSnap.data();

      // 3. Verification Status Check
      // Block login if not approved (as per user request: "without register approve dont login")
      if (deliveryData.verificationStatus === 'pending') {
        await signOut(auth);
        throw new Error('Your application is currently under review. Please wait for Admin approval.');
      } else if (deliveryData.verificationStatus === 'rejected') {
        await signOut(auth);
        const reason = deliveryData.rejectionReason ? ` Reason: ${deliveryData.rejectionReason}` : '';
        throw new Error(`Your application has been rejected.${reason}`);
      }

      // If verificationStatus is 'approved' (or missing/undefined implies old/active), allow proceed.
      // Note: verificationStatus is optional in type, so we treat undefined as valid or handle accordingly.
      // or strictly block if we want to force verification for everyone. 
      // For new flow, it is 'pending' by default.

      // Sync password to delivery doc in Firestore
      try {
        await updateDoc(docRef, { password });
      } catch (syncErr) {
        console.warn('[v0] Delivery partner password sync notice:', syncErr);
      }

      // If valid, state listener will handle the rest
    } catch (error: any) {
      console.error('[v0] Delivery login error:', error);
      // Re-throw with clean message
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        throw new Error('Invalid email or password.');
      }
      throw error;
    }
  };

  const register = async (data: Omit<DeliveryPerson, 'id' | 'rating' | 'status' | 'createdAt'>, password: string) => {
    try {
      // Note: createUserWithEmailAndPassword will fail if email is already in use by ANY role (Customer/Restaurant)
      // This satisfies the requirement: "email used in customer/restaurant... cannot register"
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, password);
      const uid = userCredential.user.uid;

      const newPartner: Omit<DeliveryPerson, 'id'> = {
        ...data,
        rating: 5.0, // Initial rating
        status: 'offline',
        isAvailable: false,
        createdAt: new Date(),
      };

      await setDoc(doc(db, 'deliveryPersons', uid), {
        ...newPartner,
        isAvailable: false,
        password: password,
        createdAt: serverTimestamp()
      });

    } catch (error: any) {
      console.error('[v0] Delivery registration error:', error);
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('This email is already registered (possibly as a Customer or Restaurant).');
      }
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('[v0] Delivery logout error:', error);
      throw error;
    }
  };

  const updateLocation = async (latitude: number, longitude: number, extra?: { accuracy?: number; speed?: number; heading?: number }) => {
    if (user && deliveryPartner) {
      try {
        await updateDoc(doc(db, 'deliveryPersons', user.uid), {
          currentLocation: { latitude, longitude }
        });
        await setDoc(doc(db, 'driverLocations', user.uid), {
          driverId: user.uid,
          latitude,
          longitude,
          accuracy: extra?.accuracy ?? 10,
          speed: extra?.speed ?? 0,
          heading: extra?.heading ?? 0,
          isOnline: true,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        console.log('[v0] Location updated:', { latitude, longitude });
      } catch (error) {
        console.error('[v0] Failed to update location:', error);
      }
    }
  };

  const updateStatus = async (status: 'online' | 'offline' | 'on_delivery') => {
    if (user && deliveryPartner) {
      try {
        const isAvail = status === 'online';
        await updateDoc(doc(db, 'deliveryPersons', user.uid), {
          status: status,
          isAvailable: isAvail,
          updatedAt: serverTimestamp()
        });
        if (status === 'offline') {
          await updateDoc(doc(db, 'driverLocations', user.uid), {
            isOnline: false,
            updatedAt: serverTimestamp(),
          }).catch(() => { });
        } else if (status === 'online') {
          await updateDoc(doc(db, 'driverLocations', user.uid), {
            isOnline: true,
            updatedAt: serverTimestamp(),
          }).catch(() => { });
        }
        console.log('[v0] Status updated:', status);
        // Optimistic update
        setDeliveryPartner(prev => prev ? { ...prev, status, isAvailable: isAvail } : null);
      } catch (error) {
        console.error('[v0] Failed to update status:', error);
      }
    }
  };

  return (
    <DeliveryAuthContext.Provider
      value={{ user, deliveryPartner, loading, login, register, logout, updateLocation, updateStatus }}
    >
      {children}
    </DeliveryAuthContext.Provider>
  );
}

export function useDeliveryAuth() {
  const context = useContext(DeliveryAuthContext);
  if (context === undefined) {
    throw new Error('useDeliveryAuth must be used within DeliveryAuthProvider');
  }
  return context;
}
