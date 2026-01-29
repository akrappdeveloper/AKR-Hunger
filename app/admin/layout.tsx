'use client';

import React from "react"

import { AdminAuthProvider } from '@/context/AdminAuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminBottomNav from '@/components/admin/AdminBottomNav';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Skip check for login page
    if (pathname === '/admin/login') return;

    if (!loading && !isAuthenticated) {
      router.push('/admin/login');
    }
  }, [isAuthenticated, loading, router, pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Allow login page to render without sidebar
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-900">
      <AdminSidebar />
      <div className="flex-1 lg:ml-64">
        <main className="p-8 mt-14 lg:mt-0 mb-16 lg:mb-0">{children}</main>
      </div>
      <AdminBottomNav />
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <NotificationProvider>
        <AdminLayoutContent>{children}</AdminLayoutContent>
      </NotificationProvider>
    </AdminAuthProvider>
  );
}
