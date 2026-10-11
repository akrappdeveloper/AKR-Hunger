'use client';

import { useFcmToken } from '@/hooks/use-fcm-token';
import { UserRole } from '@/lib/web-push';

interface FCMInitializerProps {
  role?: UserRole;
}

export default function FCMInitializer({ role = 'customer' }: FCMInitializerProps) {
  // Silent listener and token maintenance for the active session
  useFcmToken({ role, autoRequest: false });

  return null;
}
