'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import RestaurantSidebar from '@/components/restaurant/RestaurantSidebar';
import RestaurantBottomNav from '@/components/restaurant/RestaurantBottomNav';
import FloatingAIChatWidget from '@/components/ai/FloatingAIChatWidget';

export function RestaurantLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useRestaurantAuth();
  const isAuthPage = pathname === '/restaurant/login' || pathname.startsWith('/restaurant/login');

  // Full screen standalone view for auth pages (login)
  if (isAuthPage) {
    return <div className="w-full min-h-screen bg-background text-foreground">{children}</div>;
  }

  return (
    <div className="flex h-screen bg-background text-foreground transition-colors duration-300">
      {user && <RestaurantSidebar />}
      <main className="flex-1 overflow-y-auto mb-16 md:mb-0 bg-background">
        <div className="max-w-screen-2xl mx-auto min-h-full">
          {children}
        </div>
      </main>
      {user && <RestaurantBottomNav />}
      <FloatingAIChatWidget role="restaurant" buttonText="Partner AI" />
    </div>
  );
}
