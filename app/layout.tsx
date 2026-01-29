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
  title: 'AKR Hunger Food - Food Delivery',
  description: 'Order food online from your favorite restaurants with AKR Hunger Food',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
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
