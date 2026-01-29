'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { CartItem } from '@/lib/types';

interface CartContextType {
  items: CartItem[];
  restaurantId: string | null;
  addItem: (item: CartItem) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

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
    setItems((prevItems) => prevItems.filter((i) => i.menuItemId !== itemId));
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
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getSubtotal,
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
