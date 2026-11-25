'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { CartItem, Address } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { buildCleanItemPayload, getItemCustomizationSignature } from '@/lib/customization-utils';

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
        if (!isLoaded) {
          if (data.cartItems) {
            setItems(data.cartItems as CartItem[] || []);
            if (data.cartRestaurantId) setRestaurantId(data.cartRestaurantId);
          }

          // Address Initialization Logic
          const savedAddress = localStorage.getItem('deliveryAddress');
          let initialAddress = null;
          const profileAddresses = data.addresses || [];

          if (savedAddress) {
            try {
              initialAddress = JSON.parse(savedAddress);
              if (initialAddress?.pincode === '000000' && profileAddresses.length > 0) {
                const betterAddr =
                  profileAddresses.find((a: any) => a.pincode && a.pincode !== '000000' && a.isDefault) ||
                  profileAddresses.find((a: any) => a.pincode && a.pincode !== '000000');
                if (betterAddr) initialAddress = betterAddr;
              }
            } catch (e) {
              initialAddress = null;
            }
          }

          // If no saved address or it's invalid, fallback to profile default
          if (!initialAddress && profileAddresses.length > 0) {
            initialAddress = profileAddresses.find((a: any) => a.isDefault) || profileAddresses[0];
          }

          if (initialAddress) {
            setDeliveryAddressState(initialAddress);
            // Ensure local storage is synced if we fell back to default
            if (!savedAddress || initialAddress.pincode !== '000000') {
              localStorage.setItem('deliveryAddress', JSON.stringify(initialAddress));
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
          cartItems: items.map(buildCleanItemPayload),
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
    const cleanItem = buildCleanItemPayload(item);
    const incomingSig = getItemCustomizationSignature(cleanItem);
    setItems((prevItems) => {
      // Check if same item with identical customizations already exists
      const existingItem = prevItems.find(
        (i) => getItemCustomizationSignature(i) === incomingSig
      );

      if (existingItem) {
        // Update quantity if identical item + customizations exists
        return prevItems.map((i) =>
          getItemCustomizationSignature(i) === incomingSig
            ? { ...i, quantity: i.quantity + cleanItem.quantity }
            : i
        );
      }

      // Set restaurant ID on first item
      if (prevItems.length === 0) {
        setRestaurantId(cleanItem.restaurantId);
      }

      return [...prevItems, cleanItem];
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prevItems) => {
      const newItems = prevItems.filter((i) => i.id !== itemId && i.menuItemId !== itemId);
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
        i.id === itemId || i.menuItemId === itemId ? { ...i, quantity } : i
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
