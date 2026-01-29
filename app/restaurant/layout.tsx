import React from "react"
import { RestaurantAuthProvider } from '@/context/RestaurantAuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import RestaurantSidebar from '@/components/restaurant/RestaurantSidebar';
import RestaurantBottomNav from '@/components/restaurant/RestaurantBottomNav';

export default function RestaurantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RestaurantAuthProvider>
      <NotificationProvider>
        <div className="flex h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
          <RestaurantSidebar />
          <main className="flex-1 overflow-y-auto mb-16 md:mb-0">
            <div className="max-w-screen-2xl mx-auto">
              {children}
            </div>
          </main>
          <RestaurantBottomNav />
        </div>
      </NotificationProvider>
    </RestaurantAuthProvider>
  );
}
