'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { CartItem, Address } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';

interface CartContextType {
  items: CartItem[];
  restaurantId: string | null;
  deliveryAddress: Address | null;
  setDeliveryAddress: (address: Address | null) => void;
  addItem: (item: CartItem) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, customer } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddressState] = useState<Address | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // 1. Load from Firestore on mount/user change
  useEffect(() => {
    if (!user) {
      setItems([]);
      setRestaurantId(null);
      setIsLoaded(true);
      return;
    }

    // Listen to the customer document to get cart data
    const unsub = onSnapshot(doc(db, 'customers', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.cartItems) {
          // Determine if this is a remote update we should accept
          // For simplicity, we always accept remote if we haven't touched local yet?
          // Or just accept it. The issue is typing local triggering a write loop.
          // But Firestore writes are usually idempotent-ish if data is same.
          // However, let's just use strict sync: what's in DB is truth.
          // User actions update DB.
          // Actually, standard context updates local state.
          // Let's stick to: Local state drives UI. useEffect syncs to DB.
          // But to support multi-device, we need onSnapshot.

          // Let's use a simpler strategy for this task:
          // Load once on mount.
          // Save on change.
          if (!isLoaded) { // Only force load on first connect
            setItems(data.cartItems as CartItem[] || []);
            if (data.cartRestaurantId) setRestaurantId(data.cartRestaurantId);

            // Address Initialization Logic
            const savedAddress = localStorage.getItem('deliveryAddress');
            let initialAddress = null;

            if (savedAddress) {
              initialAddress = JSON.parse(savedAddress);
            }

            // If no saved address or it's invalid, fallback to profile default
            if (!initialAddress && data.addresses && data.addresses.length > 0) {
              initialAddress = data.addresses.find((a: any) => a.isDefault) || data.addresses[0];
            }

            if (initialAddress) {
              setDeliveryAddressState(initialAddress);
              // Ensure local storage is synced if we fell back to default
              if (!savedAddress) {
                localStorage.setItem('deliveryAddress', JSON.stringify(initialAddress));
              }
            }

            setIsLoaded(true);
          }
        } else {
          // No cart items, but check address
          if (!deliveryAddress && data.addresses && data.addresses.length > 0) {
            const savedAddress = localStorage.getItem('deliveryAddress');
            if (savedAddress) {
              setDeliveryAddressState(JSON.parse(savedAddress));
            } else {
              const defaultAddr = data.addresses.find((a: any) => a.isDefault) || data.addresses[0];
              setDeliveryAddressState(defaultAddr);
              localStorage.setItem('deliveryAddress', JSON.stringify(defaultAddr));
            }
          }
          setIsLoaded(true);
        }
      } else {
        setIsLoaded(true);
      }
    });

    return () => unsub();
  }, [user, isLoaded]); // dependencies

  // 2. Save to Firestore on change
  useEffect(() => {
    if (!user || !isLoaded || !customer) return;

    const saveCart = async () => {
      try {
        await updateDoc(doc(db, 'customers', user.uid), {
          cartItems: items,
          cartRestaurantId: restaurantId,
          updatedAt: new Date()
        });
      } catch (error) {
        console.error("Failed to save cart:", error);
      }
    };

    const timeout = setTimeout(saveCart, 1000); // 1s debounce
    return () => clearTimeout(timeout);
  }, [items, restaurantId, user, isLoaded, customer]);

  const setDeliveryAddress = useCallback((address: Address | null) => {
    setDeliveryAddressState(address);
    if (address) {
      localStorage.setItem('deliveryAddress', JSON.stringify(address));
    } else {
      localStorage.removeItem('deliveryAddress');
    }
  }, []);

  const addItem = useCallback((item: CartItem) => {
    setItems((prevItems) => {
      // Check if item already exists
      const existingItem = prevItems.find((i) => i.menuItemId === item.menuItemId);

      if (existingItem) {
        // Update quantity if item exists
        return prevItems.map((i) =>
          i.menuItemId === item.menuItemId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }

      // Set restaurant ID on first item
      if (prevItems.length === 0) {
        setRestaurantId(item.restaurantId);
      }

      return [...prevItems, item];
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prevItems) => {
      const newItems = prevItems.filter((i) => i.menuItemId !== itemId);
      if (newItems.length === 0) setRestaurantId(null);
      return newItems;
    });
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }

    setItems((prevItems) =>
      prevItems.map((i) =>
        i.menuItemId === itemId ? { ...i, quantity } : i
      )
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
    setRestaurantId(null);
  }, []);

  const getSubtotal = useCallback(() => {
    return items.reduce((total, item) => total + item.price * item.quantity, 0);
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        restaurantId,
        deliveryAddress,
        setDeliveryAddress,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getSubtotal,
        total: getSubtotal(),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
