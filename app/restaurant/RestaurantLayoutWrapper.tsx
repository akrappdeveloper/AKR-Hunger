'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRestaurantAuth } from '@/context/RestaurantAuthContext';
import RestaurantSidebar from '@/components/restaurant/RestaurantSidebar';
import RestaurantBottomNav from '@/components/restaurant/RestaurantBottomNav';
import FloatingAIChatWidget from '@/components/ai/FloatingAIChatWidget';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FCMInitializer from '@/components/fcm-initializer';

const ROUTE_PERMISSION_MAP: Record<string, string> = {
  '/restaurant/orders': 'orders',
  '/restaurant/chat': 'orders',
  '/restaurant/menu': 'menu',
  '/restaurant/schedule': 'schedule',
  '/restaurant/staff': 'staff',
  '/restaurant/wallet': 'wallet',
  '/restaurant/quality': 'quality',
  '/restaurant/campaigns': 'campaigns',
  '/restaurant/analytics': 'analytics',
  '/restaurant/reviews': 'reviews',
  '/restaurant/settings': 'settings',
  '/restaurant/profile': 'settings',
};

export function RestaurantLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isStaff, hasPermission } = useRestaurantAuth();

  const isAuthPage =
    pathname === '/restaurant/login' ||
    pathname.startsWith('/restaurant/login') ||
    pathname.includes('/staff/login') ||
    pathname.includes('/staff/dashboard/login');

  // Full screen standalone view for auth pages (login)
  if (isAuthPage) {
    return <div className="w-full min-h-screen bg-background text-foreground">{children}</div>;
  }

  // Check if staff has permission for the current path
  let hasRouteAccess = true;
  let requiredPermission = '';
  if (isStaff && pathname) {
    for (const [routePrefix, perm] of Object.entries(ROUTE_PERMISSION_MAP)) {
      if (pathname === routePrefix || pathname.startsWith(routePrefix + '/')) {
        if (!hasPermission(perm)) {
          hasRouteAccess = false;
          requiredPermission = perm;
          break;
        }
      }
    }
  }

  return (
    <div className="flex h-screen bg-background text-foreground transition-colors duration-300">
      <FCMInitializer role="restaurant" />
      {user && <RestaurantSidebar />}
      <main className="flex-1 overflow-y-auto mb-16 md:mb-0 bg-background">
        <div className="max-w-screen-2xl mx-auto min-h-full">
          {!hasRouteAccess ? (
            <div className="min-h-[70vh] flex items-center justify-center p-6">
              <div className="max-w-md w-full text-center p-8 rounded-3xl bg-card border border-border shadow-xl">
                <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-foreground">Access Restricted</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Your staff role does not have permission to access the <strong>{requiredPermission}</strong> module.
                </p>
                <p className="text-xs text-muted-foreground/80 mt-1">
                  Please contact your restaurant owner or manager to grant this permission.
                </p>
                <div className="mt-6">
                  <Button asChild className="rounded-xl gap-2 font-bold bg-primary text-primary-foreground">
                    <Link href="/restaurant/staff/dashboard">
                      <ArrowLeft className="w-4 h-4" /> Return to Staff Dashboard
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
      {user && <RestaurantBottomNav />}
      <FloatingAIChatWidget role="restaurant" buttonText="Partner AI" />
    </div>
  );
}
