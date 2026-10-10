'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export type AdminRole = 'super_admin' | 'operations_admin' | 'finance_admin' | 'support_admin' | 'content_manager' | 'admin';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AdminRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { admin, loading, isAuthenticated } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/admin/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground gap-4">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p>Verifying permissions...</p>
      </div>
    );
  }

  if (!isAuthenticated || !admin) {
    return null; // Will redirect
  }

  const hasAccess = !allowedRoles || 
                    admin.role === 'super_admin' || 
                    allowedRoles.includes(admin.role as AdminRole);

  if (!hasAccess) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh] p-6">
        <Alert variant="destructive" className="max-w-md bg-red-950/50 border-red-900/50">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <AlertTitle className="text-red-400 font-bold ml-2">Access Denied</AlertTitle>
          <AlertDescription className="text-red-300 ml-2 mt-2">
            You do not have the required permissions to view this page or perform this action.
            Your current role is: <span className="font-mono font-bold">{admin.role}</span>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
