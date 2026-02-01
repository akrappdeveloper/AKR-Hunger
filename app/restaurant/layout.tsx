import React from "react"
import { RestaurantAuthProvider } from '@/context/RestaurantAuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import RestaurantSidebar from '@/components/restaurant/RestaurantSidebar';
import RestaurantBottomNav from '@/components/restaurant/RestaurantBottomNav';
import { Toaster } from '@/components/ui/sonner';
import { Metadata } from 'next';
import { generateRestaurantPortalSchema, generateOrganizationSchema } from '@/lib/seo/schemas';

export const metadata: Metadata = {
  title: 'AKR Hunger Restaurant Partner - Grow Your Business | Restaurant Management',
  description: 'Join AKR Hunger as a restaurant partner. Manage your menu, orders, and earnings with our powerful restaurant dashboard. List your restaurant today!',
  keywords: [
    'AKR Hunger restaurant',
    'restaurant partner',
    'list your restaurant',
    'restaurant management',
    'restaurant dashboard',
    'AKR Hunger for restaurants',
    'become restaurant partner',
    'restaurant owner portal',
  ],
  alternates: {
    canonical: 'https://akrhunger.vercel.app/restaurant/login',
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://akrhunger.vercel.app/restaurant/login',
    title: 'AKR Hunger Restaurant Partner - Grow Your Business',
    description: 'Join AKR Hunger as a restaurant partner. Manage menu, orders, and grow your business.',
    siteName: 'AKR Hunger Restaurant Partners',
    images: [
      {
        url: 'https://akrhunger.vercel.app/akrhunger.png',
        width: 1200,
        height: 630,
        alt: 'AKR Hunger Restaurant Partner Portal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AKR Hunger Restaurant Partner - Grow Your Business',
    description: 'Join AKR Hunger as a restaurant partner and manage your business',
    images: ['https://akrhunger.vercel.app/akrhunger.png'],
  },
  verification: {
    google: "K8s0MzX1Az9Dc3Mh9SeLVJFVcqQH_LsLdlXgWLhbvHw",
  },
};

export default function RestaurantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const organizationSchema = generateOrganizationSchema();
  const restaurantPortalSchema = generateRestaurantPortalSchema();

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
        <Toaster theme="dark" position="top-right" />

        {/* JSON-LD Schema for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantPortalSchema) }}
        />
      </NotificationProvider>
    </RestaurantAuthProvider>
  );
}
