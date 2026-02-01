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
                <div className="flex min-h-screen bg-black pb-40 md:pb-0">
                    <DeliverySidebar />
                    <main className="flex-1 overflow-auto">{children}</main>
                    <DeliveryBottomNav />
                </div>
            </NotificationProvider>
        </DeliveryAuthProvider>
    );
}
