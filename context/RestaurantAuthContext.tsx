'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Restaurant } from '@/lib/types';

export interface RestaurantUser extends User {
  restaurantId?: string;
  isStaff?: boolean;
  staffRole?: string;
  permissions?: string[];
  staffStatus?: string;
  staffName?: string;
}

export interface RestaurantAuthContextType {
  user: RestaurantUser | null;
  restaurant: Restaurant | null;
  isStaff: boolean;
  staffRole: string | null;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const RestaurantAuthContext = createContext<RestaurantAuthContextType | undefined>(undefined);

export function RestaurantAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<RestaurantUser | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          let restaurantData: Restaurant | null = null;
          let restaurantId = '';
          let staffFlag = false;
          let currentStaffRole: string | null = null;
          let currentPermissions: string[] = [];

          // 1. Check user doc first (handles staff and users with restaurantId)
          const userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          const idToken = await firebaseUser.getIdTokenResult();
          const claimRestId = idToken.claims.restaurantId as string | undefined;
          const claimIsStaff = idToken.claims.role === 'staff' || idToken.claims.isStaff === true;
          const claimRole = idToken.claims.staffRole as string | undefined;

          if (userDocSnap.exists()) {
            const uData = userDocSnap.data();
            if (uData?.isStaff === true || uData?.role === 'staff' || claimIsStaff) {
              staffFlag = true;
              currentStaffRole = uData?.staffRole || uData?.role || claimRole || 'helper';
              currentPermissions = Array.isArray(uData?.permissions) && uData.permissions.length > 0
                ? uData.permissions
                : (currentStaffRole === 'manager'
                    ? ['orders', 'menu', 'schedule', 'quality', 'reviews', 'wallet', 'analytics', 'campaigns', 'staff', 'settings']
                    : currentStaffRole === 'chef'
                    ? ['orders', 'menu', 'schedule', 'quality']
                    : currentStaffRole === 'cashier'
                    ? ['orders', 'wallet', 'reviews']
                    : ['orders']);
              restaurantId = uData?.restaurantId || claimRestId || '';

              if (restaurantId) {
                const rDoc = await getDoc(doc(db, 'restaurants', restaurantId));
                if (rDoc.exists()) {
                  restaurantData = { ...rDoc.data(), id: rDoc.id } as Restaurant;
                }
              }
            } else if (uData?.restaurantId) {
              restaurantId = uData.restaurantId;
              const rDoc = await getDoc(doc(db, 'restaurants', restaurantId));
              if (rDoc.exists()) {
                restaurantData = { ...rDoc.data(), id: rDoc.id } as Restaurant;
              }
            }
          } else if (claimIsStaff && claimRestId) {
            staffFlag = true;
            currentStaffRole = claimRole || 'helper';
            currentPermissions = currentStaffRole === 'manager'
              ? ['orders', 'menu', 'schedule', 'quality', 'reviews', 'wallet', 'analytics', 'campaigns', 'staff', 'settings']
              : currentStaffRole === 'chef'
              ? ['orders', 'menu', 'schedule', 'quality']
              : currentStaffRole === 'cashier'
              ? ['orders', 'wallet', 'reviews']
              : ['orders'];
            restaurantId = claimRestId;
            const rDoc = await getDoc(doc(db, 'restaurants', restaurantId));
            if (rDoc.exists()) {
              restaurantData = { ...rDoc.data(), id: rDoc.id } as Restaurant;
            }
          }

          // 2. If not staff and not resolved via user doc, check direct restaurant doc or ownerId
          if (!restaurantData) {
            const restaurantDoc = await getDoc(doc(db, 'restaurants', firebaseUser.uid));
            if (restaurantDoc.exists()) {
              restaurantData = {
                ...restaurantDoc.data(),
                id: restaurantDoc.id,
              } as Restaurant;
              restaurantId = restaurantDoc.id;
            } else {
              const ownerQuery = query(collection(db, 'restaurants'), where('ownerId', '==', firebaseUser.uid));
              const ownerSnap = await getDocs(ownerQuery);
              if (!ownerSnap.empty) {
                const firstDoc = ownerSnap.docs[0];
                restaurantData = {
                  ...firstDoc.data(),
                  id: firstDoc.id,
                } as Restaurant;
                restaurantId = firstDoc.id;
              }
            }
          }

          if (restaurantData) {
            setRestaurant(restaurantData);
            setIsStaff(staffFlag);
            setStaffRole(currentStaffRole);
            setPermissions(currentPermissions);
            setUser({
              ...firebaseUser,
              restaurantId,
              isStaff: staffFlag,
              staffRole: currentStaffRole || undefined,
              permissions: currentPermissions,
              staffName: userDocSnap.exists() ? userDocSnap.data()?.name : undefined,
            } as RestaurantUser);
          } else {
            setRestaurant(null);
            setUser(null);
            setIsStaff(false);
            setStaffRole(null);
            setPermissions([]);
          }
        } catch (error: any) {
          console.error('[RestaurantAuth] Error fetching restaurant:', error);
          setRestaurant(null);
          setUser(null);
          setIsStaff(false);
          setStaffRole(null);
          setPermissions([]);
        }
      } else {
        setUser(null);
        setRestaurant(null);
        setIsStaff(false);
        setStaffRole(null);
        setPermissions([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const hasPermission = (permission: string): boolean => {
    // Restaurant owner has all permissions
    if (!isStaff) return true;
    // Manager has access to everything
    if (staffRole === 'manager') return true;
    if (permissions.includes('all')) return true;
    return permissions.includes(permission);
  };

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
    <RestaurantAuthContext.Provider
      value={{
        user,
        restaurant,
        isStaff,
        staffRole,
        permissions,
        hasPermission,
        loading,
        login,
        signup,
        logout,
      }}
    >
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
