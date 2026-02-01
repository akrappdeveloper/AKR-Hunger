import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/context/AuthContext'
import { CartProvider } from '@/context/CartContext'
import { RestaurantAuthProvider } from '@/context/RestaurantAuthContext'
import CustomerNavbar from '@/components/customer/CustomerNavbar'
import './globals.css'
import '../styles/animations.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'AKR Hunger - Food Delivery, Restaurant & Delivery Partner Platform',
  description: 'AKR Hunger connects customers, restaurants, and delivery partners. Order food online, grow your restaurant business, or earn as a delivery partner.',
  keywords: [
    'AKR Hunger',
    'food delivery',
    'restaurant partner',
    'delivery partner',
    'order food online',
    'food delivery platform',
  ],
  metadataBase: new URL('https://akrhunger.vercel.app'),
  generator: 'v0.app',
  icons: {
    icon: '/akrhunger.png',
    apple: '/akrhunger.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased bg-gray-50 dark:bg-gray-950 pb-20 md:pb-0`}>
        <AuthProvider>
          <RestaurantAuthProvider>
            <CartProvider>
              {children}
              <Analytics />
            </CartProvider>
          </RestaurantAuthProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
