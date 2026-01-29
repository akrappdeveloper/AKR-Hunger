'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Restaurant } from '@/lib/types';

interface RestaurantUser extends User {
  restaurantId?: string;
}

interface RestaurantAuthContextType {
  user: RestaurantUser | null;
  restaurant: Restaurant | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const RestaurantAuthContext = createContext<RestaurantAuthContextType | undefined>(undefined);

export function RestaurantAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<RestaurantUser | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Get restaurant data
        try {
          const restaurantDoc = await getDoc(doc(db, 'restaurants', firebaseUser.uid));
          if (restaurantDoc.exists()) {
            const restaurantData = {
              ...restaurantDoc.data(),
              id: restaurantDoc.id,
            } as Restaurant;
            setRestaurant(restaurantData);
            setUser({ ...firebaseUser, restaurantId: restaurantDoc.id } as RestaurantUser);
          }
        } catch (error) {
          console.error('[v0] Error fetching restaurant:', error);
        }
      } else {
        setUser(null);
        setRestaurant(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signup = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <RestaurantAuthContext.Provider value={{ user, restaurant, loading, login, signup, logout }}>
      {children}
    </RestaurantAuthContext.Provider>
  );
}

export function useRestaurantAuth() {
  const context = useContext(RestaurantAuthContext);
  if (!context) {
    throw new Error('useRestaurantAuth must be used within RestaurantAuthProvider');
  }
  return context;
}
