import React from "react"
import CustomerNavbar from '@/components/customer/CustomerNavbar';
import CustomerMobileNav from '@/components/customer/MobileNav';
import CustomerFooter from '@/components/customer/CustomerFooter';
import ActiveOrderFloatingTracker from '@/components/customer/ActiveOrderFloatingTracker';
import FloatingAIChatWidget from '@/components/ai/FloatingAIChatWidget';
import { NotificationProvider } from '@/context/NotificationContext';
import { Metadata } from 'next';
import { generateFoodDeliverySchema, generateWebSiteSchema, generateOrganizationSchema, generateFAQSchema } from '@/lib/seo/schemas';

export const metadata: Metadata = {
  title: 'Hunger - Order Food Online | Fast Delivery from Best Restaurants',
  applicationName: 'Hunger',
  icons: {
    icon: '/hunger.png',
    apple: '/apple-icon.png',
  },
  description: 'Order delicious food online from your favorite restaurants with Hunger. Fast delivery, great prices, wide selection of cuisines. Download now!',
  keywords: [
    'food delivery',
    'order food online',
    'Hunger',
    'restaurant delivery',
    'online food order',
    'food delivery app',
    'fast food delivery',
    'best restaurants near me',
  ],
  alternates: {
    canonical: 'https://shunger.vercel.app/customer',
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://shunger.vercel.app/customer',
    title: 'Hunger - Order Food Online | Fast Delivery',
    description: 'Order delicious food online from your favorite restaurants. Fast delivery, great prices, wide selection.',
    siteName: 'Hunger',
    images: [
      {
        url: 'https://shunger.vercel.app/hunger.png',
        width: 1200,
        height: 630,
        alt: 'Hunger Food Delivery',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hunger - Order Food Online | Fast Delivery',
    description: 'Order delicious food online from your favorite restaurants',
    images: ['https://shunger.vercel.app/hunger.png'],
  },
};

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const organizationSchema = generateOrganizationSchema();
  const websiteSchema = generateWebSiteSchema();
  const foodDeliverySchema = generateFoodDeliverySchema();
  const faqSchema = generateFAQSchema();

  return (
    <NotificationProvider>
      <div className="min-h-screen min-h-[100dvh] w-full overflow-x-hidden bg-background text-foreground transition-colors duration-300 selection:bg-primary/20 flex flex-col">
        <CustomerNavbar />
        <main className="flex-1 w-full pb-20 md:pb-6">{children}</main>
        <CustomerFooter />
        <CustomerMobileNav />
        <ActiveOrderFloatingTracker />
        <FloatingAIChatWidget role="customer" buttonText="Help AI" />

        {/* JSON-LD Schema for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(foodDeliverySchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      </div>
    </NotificationProvider>
  );
}
