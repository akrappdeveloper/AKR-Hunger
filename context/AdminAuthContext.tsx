'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface AdminUser {
  uid: string;
  email: string;
  role: 'super_admin' | 'admin' | 'moderator';
  name: string;
}

interface AdminAuthContextType {
  admin: AdminUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType>({
  admin: null,
  loading: true,
  isAuthenticated: false,
  logout: async () => { },
});

export const AdminAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const adminDoc = await getDoc(doc(db, 'admins', user.uid));
          if (adminDoc.exists()) {
            setAdmin({
              uid: user.uid,
              email: user.email || '',
              name: adminDoc.data().name,
              role: adminDoc.data().role,
            });
          } else {
            // Not an admin, but logged in? Sign out to be safe or just setAdmin(null)
            await signOut(auth);
            setAdmin(null);
          }
        } else {
          setAdmin(null);
        }
      } catch (error) {
        console.error("Admin auth check failed:", error);
        setAdmin(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        loading,
        isAuthenticated: admin !== null,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
};
