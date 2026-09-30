import React from "react"
import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/context/AuthContext'
import { CartProvider } from '@/context/CartContext'
import { RestaurantAuthProvider } from '@/context/RestaurantAuthContext'
import FCMInitializer from '@/components/fcm-initializer'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'
import '../styles/animations.css'

export const metadata: Metadata = {
  title: 'Hunger - Food Delivery, Restaurant & Delivery Partner Platform',
  description: 'Hunger connects customers, restaurants, and delivery partners. Order food online, grow your restaurant business, or earn as a delivery partner. Fast delivery, great earnings, seamless management.',
  keywords: [
    // Brand Keywords
    'Hunger',
    'Hunger app',
    'Hunger food delivery',

    // Customer/Food Delivery Keywords
    'food delivery',
    'order food online',
    'food delivery app',
    'online food ordering',
    'restaurant delivery',
    'food delivery service',
    'fast food delivery',
    'food delivery near me',
    'order food',
    'food ordering app',
    'online food delivery',
    'home delivery food',
    'food delivery platform',
    'restaurant food delivery',
    'quick food delivery',
    'food home delivery',

    // Restaurant Partner Keywords
    'restaurant partner',
    'restaurant management',
    'restaurant dashboard',
    'list your restaurant',
    'restaurant owner portal',
    'restaurant business',
    'grow restaurant business',
    'restaurant POS',
    'restaurant ordering system',
    'restaurant management system',
    'online restaurant management',

    // Delivery Partner Keywords
    'delivery partner',
    'delivery jobs',
    'food delivery jobs',
    'become delivery driver',
    'delivery partner jobs',
    'delivery boy jobs',
    'part time delivery jobs',
    'delivery earnings',
    'delivery driver opportunities',
    'flexible delivery jobs',
    'earn money delivery',
  ],
  metadataBase: new URL('https://akrhunger.vercel.app'),
  applicationName: 'Hunger',
  authors: [{ name: 'Hunger' }],
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  category: 'Food & Drink',
  classification: 'Food Delivery Platform',

  // Open Graph metadata for social sharing
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://akrhunger.vercel.app',
    siteName: 'Hunger',
    title: 'Hunger - Food Delivery & Restaurant Platform',
    description: 'Order delicious food online, partner with us as a restaurant, or earn as a delivery partner. Join thousands using Hunger!',
    images: [
      {
        url: 'https://akrhunger.vercel.app/hunger.png',
        width: 1200,
        height: 630,
        alt: 'Hunger - Food Delivery Platform',
      },
    ],
  },

  // Twitter Card metadata
  twitter: {
    card: 'summary_large_image',
    site: '@Hunger',
    creator: '@Hunger',
    title: 'Hunger - Food Delivery & Restaurant Platform',
    description: 'Order food, grow your restaurant, or earn as delivery partner',
    images: ['https://akrhunger.vercel.app/hunger.png'],
  },

  // Verification
  verification: {
    google: 'K8s0MzX1Az9Dc3Mh9SeLVJFVcqQH_LsLdlXgWLhbvHw',
  },

  // Icons
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/hunger.png', type: 'image/png' },
      { url: '/icon-light-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/hunger.png' },
    ],
    shortcut: '/favicon.ico',
  },

  // Manifest for PWA support
  manifest: '/manifest.json',

  // Additional metadata
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased bg-background text-foreground min-h-screen transition-colors duration-300 pb-20 md:pb-0`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          themes={['light', 'dark', 'sunset', 'midnight']}
        >
          <AuthProvider>
            <RestaurantAuthProvider>
              <FCMInitializer />
              <CartProvider>
                {children}
                <Analytics />
              </CartProvider>
            </RestaurantAuthProvider>
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
