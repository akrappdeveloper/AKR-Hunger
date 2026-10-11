'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useFcmToken } from '@/hooks/use-fcm-token';
import { UserRole } from '@/lib/web-push';
import PushNotificationPromptBanner from '@/components/notifications/PushNotificationPromptBanner';

interface FCMInitializerProps {
  role?: UserRole;
}

export default function FCMInitializer({ role }: FCMInitializerProps) {
  const pathname = usePathname();

  // Dynamic route-aware role detection
  const resolvedRole: UserRole = React.useMemo(() => {
    if (role) return role;
    if (pathname?.startsWith('/restaurant')) return 'restaurant';
    if (pathname?.startsWith('/delivery')) return 'delivery';
    if (pathname?.startsWith('/admin')) return 'admin';
    return 'customer';
  }, [role, pathname]);

  const isAuthPage = pathname?.includes('/login') || pathname?.includes('/signup') || pathname?.includes('/auth');

  // Silent listener and token maintenance for the active session (skip on auth pages)
  useFcmToken({ role: resolvedRole, autoRequest: false, enabled: !isAuthPage });

  if (isAuthPage) return null;

  return <PushNotificationPromptBanner role={resolvedRole} />;
}
