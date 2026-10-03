'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Order } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bike, ChefHat, ShoppingBag, Navigation, X, Clock, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function ActiveOrderFloatingTracker() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  // Subscribe to real-time active orders for this logged-in customer
  useEffect(() => {
    if (!user) {
      setActiveOrder(null);
      return;
    }

    try {
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('customerId', '==', user.uid));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const active = snapshot.docs
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as Order[];

          // Filter for in-progress statuses
          const ongoing = active
            .filter((o) =>
              ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(
                o.status || ''
              )
            )
            .sort((a, b) => {
              const tA = (a.createdAt as any)?.seconds || 0;
              const tB = (b.createdAt as any)?.seconds || 0;
              return tB - tA;
            });

          if (ongoing.length > 0) {
            setActiveOrder(ongoing[0]);
            setIsDismissed(false);
          } else {
            setActiveOrder(null);
          }
        },
        (err) => {
          console.error('ActiveOrderFloatingTracker error:', err);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('Failed to setup active order listener:', err);
    }
  }, [user]);

  // Don't show on auth pages or when user is already on the tracking/detail page
  if (!activeOrder || isDismissed) return null;
  if (
    pathname.includes('/login') ||
    pathname.includes('/signup') ||
    pathname === `/customer/orders/tracking/${activeOrder.id}` ||
    pathname === `/customer/orders/${activeOrder.id}`
  ) {
    return null;
  }

  const getStatusDetails = (status: string) => {
    switch (status) {
      case 'pending':
      case 'confirmed':
        return {
          title: 'Order Confirmed',
          desc: 'Restaurant received your order',
          icon: ShoppingBag,
          color: 'text-amber-500',
          bg: 'bg-amber-500/10 border-amber-500/20',
          eta: '~30-40 min',
        };
      case 'preparing':
        return {
          title: 'Kitchen Preparing Meal',
          desc: 'Fresh culinary prep in progress',
          icon: ChefHat,
          color: 'text-orange-500',
          bg: 'bg-orange-500/10 border-orange-500/20',
          eta: '~25-35 min',
        };
      case 'ready':
        return {
          title: 'Food Packed & Ready',
          desc: 'Awaiting delivery partner pickup',
          icon: ShoppingBag,
          color: 'text-blue-500',
          bg: 'bg-blue-500/10 border-blue-500/20',
          eta: '~20-25 min',
        };
      case 'out_for_delivery':
        return {
          title: 'Out for Delivery',
          desc: activeOrder.deliveryPersonName
            ? `${activeOrder.deliveryPersonName} is on the way`
            : 'Delivery partner on the way',
          icon: Bike,
          color: 'text-emerald-500',
          bg: 'bg-emerald-500/10 border-emerald-500/20',
          eta: '~10-15 min',
        };
      default:
        return {
          title: 'Order in Progress',
          desc: 'Live updates active',
          icon: Bike,
          color: 'text-primary',
          bg: 'bg-primary/10 border-primary/20',
          eta: '~30 min',
        };
    }
  };

  const statusInfo = getStatusDetails(activeOrder.status || 'pending');
  const IconComponent = statusInfo.icon;

  return (
    <aside
      aria-label="Active delivery order tracking"
      className="fixed z-40 bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:max-w-md w-auto transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
    >
      <div className="bg-card/95 dark:bg-card/95 backdrop-blur-2xl border-2 border-primary/30 dark:border-primary/40 rounded-3xl p-3.5 sm:p-4 shadow-[0_12px_36px_rgba(0,0,0,0.25)] text-foreground relative overflow-hidden group">
        {/* Glowing Top Edge */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500" />

        <div className="flex items-center justify-between gap-3">
          {/* Status Icon & Main Info */}
          <div
            onClick={() => router.push(`/customer/orders/tracking/${activeOrder.id}`)}
            className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${statusInfo.bg} ${statusInfo.color} shadow-sm group-hover:scale-105 transition-transform`}
            >
              <IconComponent className="w-5 h-5 animate-bounce" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-primary flex items-center gap-1 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block shrink-0" />
                  {statusInfo.title}
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 h-4 border-border/80 font-bold shrink-0 hidden sm:inline-flex"
                >
                  #{activeOrder.id ? (activeOrder.id.length <= 14 ? activeOrder.id : activeOrder.id.slice(-8)).toUpperCase() : 'ORDER'}
                </Badge>
              </div>

              <p className="text-xs font-bold text-foreground truncate mt-0.5">
                {activeOrder.restaurantName || 'Restaurant'}
              </p>

              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium mt-0.5">
                <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold">
                  <Clock className="w-3 h-3" /> {statusInfo.eta}
                </span>
                <span>•</span>
                <span>{activeOrder.items?.length || 1} items</span>
              </div>
            </div>
          </div>

          {/* Action Button & Dismiss */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Link href={`/customer/orders/tracking/${activeOrder.id}`}>
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs rounded-xl px-3.5 py-2 shadow-md shadow-primary/20 gap-1 h-9"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Track</span>
              </Button>
            </Link>

            <button
              onClick={() => setIsDismissed(true)}
              className="w-7 h-7 rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
              title="Minimize"
              aria-label="Minimize active tracker"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
