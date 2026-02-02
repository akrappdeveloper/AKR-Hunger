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
    <div className="flex min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background decorations */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 flex w-full">
        <AdminSidebar />
        <div className="flex-1 lg:ml-72 flex flex-col min-h-screen transition-all duration-300">
          {/* Added padding top for mobile to account for header if any, or just general spacing */}
          <main className="flex-1 p-4 lg:p-8 mt-14 lg:mt-0 mb-20 lg:mb-0 space-y-6">
            {children}
          </main>
        </div>
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
