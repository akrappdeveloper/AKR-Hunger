import React from 'react';
import { DeliveryLayoutWrapper } from './DeliveryLayoutWrapper';
import { Metadata } from 'next';
import { generateDeliveryJobSchema, generateOrganizationSchema } from '@/lib/seo/schemas';

export const metadata: Metadata = {
  title: 'AKR Hunger Delivery Partner - Earn Money Delivering Food | Flexible Jobs',
  description: 'Become a delivery partner with AKR Hunger. Flexible hours, competitive earnings, weekly payouts. Join thousands of delivery partners earning great income!',
  keywords: [
    'AKR Hunger delivery',
    'delivery partner',
    'food delivery jobs',
    'become delivery driver',
    'delivery partner jobs',
    'AKR Hunger for delivery',
    'delivery earnings',
    'part time delivery jobs',
  ],
  alternates: {
    canonical: 'https://akrhunger.vercel.app/delivery/login',
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://akrhunger.vercel.app/delivery/login',
    title: 'AKR Hunger Delivery Partner - Earn Money Delivering Food',
    description: 'Flexible hours, competitive earnings, weekly payouts. Join as a delivery partner.',
    siteName: 'AKR Hunger Delivery Partners',
    images: [
      {
        url: 'https://akrhunger.vercel.app/akrhunger.png',
        width: 1200,
        height: 630,
        alt: 'AKR Hunger Delivery Partner',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AKR Hunger Delivery Partner - Earn Money Delivering',
    description: 'Flexible hours, competitive earnings. Join as delivery partner.',
    images: ['https://akrhunger.vercel.app/akrhunger.png'],
  },
  verification: {
    google: "K8s0MzX1Az9Dc3Mh9SeLVJFVcqQH_LsLdlXgWLhbvHw",
  },
};

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const organizationSchema = generateOrganizationSchema();
  const deliveryJobSchema = generateDeliveryJobSchema();

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
    </>
  );
}
