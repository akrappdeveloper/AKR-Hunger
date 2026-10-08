'use client';

import React, { useEffect, useState } from 'react';
import { DeliveryAuthProvider, useDeliveryAuth } from '@/context/DeliveryAuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import DeliverySidebar from '@/components/delivery/DeliverySidebar';
import DeliveryBottomNav from '@/components/delivery/DeliveryBottomNav';
import FloatingAIChatWidget from '@/components/ai/FloatingAIChatWidget';
import { usePathname, useRouter } from 'next/navigation';
import { AlertCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DeliveryLayoutWrapper({ children }: { children: React.ReactNode }) {
    return (
        <DeliveryAuthProvider>
            <NotificationProvider>
                <DeliveryLayoutContent>
                    {children}
                </DeliveryLayoutContent>
            </NotificationProvider>
        </DeliveryAuthProvider>
    );
}

function DeliveryLayoutContent({ children }: { children: React.ReactNode }) {
    const { deliveryPartner, loading, user } = useDeliveryAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [isLocked, setIsLocked] = useState(false);

    const isAuthPage =
        pathname === '/delivery/login' ||
        pathname === '/delivery/register' ||
        pathname.startsWith('/delivery/login') ||
        pathname.startsWith('/delivery/register');

    useEffect(() => {
        if (!loading && deliveryPartner && !isAuthPage) {
            const balance = Number(deliveryPartner.walletBalance || 0);
            const cashLimit = Number((deliveryPartner as any)?.cashLimit || 3000);
            const codCollected = Number((deliveryPartner as any)?.codCollected || 0);
            const codDeposited = Number((deliveryPartner as any)?.codDeposited || 0);
            const remainingCod = Math.max(0, codCollected - codDeposited);

            // Account is locked if cash-in-hand COD exceeds limit (₹3,000) or net debt exceeds limit
            const locked = remainingCod > cashLimit || balance < -cashLimit;
            setIsLocked(locked);

            // If account is locked, redirect to wallet page if not already there
            if (locked && !pathname.includes('/delivery/wallet') && !pathname.includes('/delivery/support')) {
                router.push('/delivery/wallet');
            }
        }
    }, [deliveryPartner, loading, pathname, router, isAuthPage]);

    // Full screen standalone view for auth pages (login, register)
    if (isAuthPage) {
        return <div className="w-full min-h-screen bg-background text-foreground">{children}</div>;
    }

    if (loading) return null; // Or a loader

    return (
        <div className="flex min-h-screen bg-black text-white pb-32 md:pb-0 relative isolation-isolate">
            {/* Global Background for Delivery Panel */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black -z-10" />

            {user && <DeliverySidebar />}

            <main className="flex-1 overflow-auto h-screen relative z-0">
                {isLocked && !pathname.includes('/delivery/wallet') ? (
                    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                            <Lock className="w-10 h-10 text-red-500" />
                        </div>
                        <h1 className="text-3xl font-black text-white mb-2">Cash Limit Exceeded</h1>
                        <p className="text-gray-400 max-w-md mb-8">
                            Your cash-in-hand limit (₹{((deliveryPartner as any)?.cashLimit || 3000).toLocaleString('en-IN')}) has been reached.
                            Please deposit collected COD cash to continue receiving orders.
                        </p>
                        <Button
                            onClick={() => router.push('/delivery/wallet')}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold h-12 px-8 rounded-xl shadow-lg shadow-red-900/30"
                        >
                            Deposit Cash & Unlock
                        </Button>
                    </div>
                ) : (
                    children
                )}
            </main>

            {user && <DeliveryBottomNav />}
            <FloatingAIChatWidget role="delivery" buttonText="Rider AI" />
        </div>
    );
}
