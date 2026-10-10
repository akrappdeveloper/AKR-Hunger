import React from 'react';
import { DeliveryLayoutWrapper } from './DeliveryLayoutWrapper';
import { Metadata } from 'next';
import { generateDeliveryJobSchema, generateOrganizationSchema, generateFAQSchema } from '@/lib/seo/schemas';

export const metadata: Metadata = {
  title: 'Hunger Delivery Partner - Earn Money Delivering Food | Flexible Jobs',
  applicationName: 'Hunger Delivery',
  icons: {
    icon: '/hunger.png',
    apple: '/apple-icon.png',
  },
  description: 'Become a delivery partner with Hunger. Flexible hours, competitive earnings, weekly payouts. Join thousands of delivery partners earning great income!',
  keywords: [
    'Hunger delivery',
    'delivery partner',
    'food delivery jobs',
    'become delivery driver',
    'delivery partner jobs',
    'Hunger for delivery',
    'delivery earnings',
    'part time delivery jobs',
  ],
  alternates: {
    canonical: 'https://shunger.vercel.app/delivery/login',
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://shunger.vercel.app/delivery/login',
    title: 'Hunger Delivery Partner - Earn Money Delivering Food',
    description: 'Flexible hours, competitive earnings, weekly payouts. Join as a delivery partner.',
    siteName: 'Hunger Delivery Partners',
    images: [
      {
        url: 'https://shunger.vercel.app/hunger.png',
        width: 1200,
        height: 630,
        alt: 'Hunger Delivery Partner',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hunger Delivery Partner - Earn Money Delivering',
    description: 'Flexible hours, competitive earnings. Join as delivery partner.',
    images: ['https://shunger.vercel.app/hunger.png'],
  },
};

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const organizationSchema = generateOrganizationSchema();
  const deliveryJobSchema = generateDeliveryJobSchema();
  const faqSchema = generateFAQSchema();

  return (
    <>
      <DeliveryLayoutWrapper>
        {children}
      </DeliveryLayoutWrapper>

      {/* JSON-LD Schema for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(deliveryJobSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  );
}
