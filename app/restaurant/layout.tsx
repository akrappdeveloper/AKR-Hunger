import React from "react"
import { NotificationProvider } from '@/context/NotificationContext';
import { RestaurantLayoutWrapper } from './RestaurantLayoutWrapper';
import { Metadata } from 'next';
import { generateRestaurantPortalSchema, generateOrganizationSchema, generateFAQSchema } from '@/lib/seo/schemas';

export const metadata: Metadata = {
  title: 'Hunger Restaurant Partner - Grow Your Business | Restaurant Management',
  applicationName: 'Hunger Restaurant Portal',
  icons: {
    icon: '/hunger.png',
    apple: '/apple-icon.png',
  },
  description: 'Join Hunger as a restaurant partner. Manage your menu, orders, and earnings with our powerful restaurant dashboard. List your restaurant today!',
  keywords: [
    'Hunger restaurant',
    'restaurant partner',
    'list your restaurant',
    'restaurant management',
    'restaurant dashboard',
    'Hunger for restaurants',
    'become restaurant partner',
    'restaurant owner portal',
  ],
  alternates: {
    canonical: 'https://shunger.vercel.app/restaurant/login',
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://shunger.vercel.app/restaurant/login',
    title: 'Hunger Restaurant Partner - Grow Your Business',
    description: 'Join Hunger as a restaurant partner. Manage menu, orders, and grow your business.',
    siteName: 'Hunger Restaurant Partners',
    images: [
      {
        url: 'https://shunger.vercel.app/hunger.png',
        width: 1200,
        height: 630,
        alt: 'Hunger Restaurant Partner Portal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hunger Restaurant Partner - Grow Your Business',
    description: 'Join Hunger as a restaurant partner and manage your business',
    images: ['https://shunger.vercel.app/hunger.png'],
  },
};

export default function RestaurantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const organizationSchema = generateOrganizationSchema();
  const restaurantPortalSchema = generateRestaurantPortalSchema();
  const faqSchema = generateFAQSchema();

  return (
    <NotificationProvider>
      <RestaurantLayoutWrapper>
        {children}
      </RestaurantLayoutWrapper>

      {/* JSON-LD Schema for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantPortalSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </NotificationProvider>
  );
}
