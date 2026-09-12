'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Customer } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  customer: Customer | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let customerUnsub: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);

      if (customerUnsub) {
        customerUnsub();
        customerUnsub = null;
      }

      if (authUser) {
        // Set up real-time listener for customer profile from Firestore
        customerUnsub = onSnapshot(
          doc(db, 'customers', authUser.uid),
          (customerDoc) => {
            if (customerDoc.exists()) {
              setCustomer({
                ...customerDoc.data(),
                id: customerDoc.id,
              } as Customer);
            } else {
              setCustomer(null);
            }
            setLoading(false);
          },
          (error) => {
            console.error('Error listening to customer profile:', error);
            setLoading(false);
          }
        );
      } else {
        setCustomer(null);
        setLoading(false);
      }
    });

    return () => {
      if (customerUnsub) customerUnsub();
      unsubscribe();
    };
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setCustomer(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, customer, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
