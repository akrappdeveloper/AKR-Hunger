'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';

/**
 * CHECKOUT PAGE REDIRECT
 * 
 * Since we merged the Checkout view into the /customer/cart page for a smoother
 * single-page checkout experience (modern best practice), this page now just
 * redirects to the cart if accessed directly.
 */

export default function CheckoutPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/customer/cart');
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Spinner className="text-orange-500 w-8 h-8" />
    </div>
  );
}
