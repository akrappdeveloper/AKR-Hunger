'use client';

import React from 'react';
import { DeliveryAuthProvider } from '@/context/DeliveryAuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import DeliverySidebar from '@/components/delivery/DeliverySidebar';
import DeliveryBottomNav from '@/components/delivery/DeliveryBottomNav';

export function DeliveryLayoutWrapper({ children }: { children: React.ReactNode }) {
    return (
        <DeliveryAuthProvider>
            <NotificationProvider>
                <div className="flex min-h-screen bg-black text-white pb-32 md:pb-0 relative isolation-isolate">
                    {/* Global Background for Delivery Panel */}
                    <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black -z-10" />

                    <DeliverySidebar />
                    <main className="flex-1 overflow-auto h-screen relative z-0">{children}</main>
                    <DeliveryBottomNav />
                </div>
            </NotificationProvider>
        </DeliveryAuthProvider>
    );
}
