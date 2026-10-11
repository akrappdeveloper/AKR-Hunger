'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  detectBrowserInfo,
  requestWebPushSubscription,
  setupForegroundWebPushListener,
  persistPushToken,
  sendTestWebPushNotification,
  BrowserInfo,
  UserRole,
} from '@/lib/web-push';
import { auth, messaging } from '@/lib/firebase';
import { getToken } from 'firebase/messaging';
import { onAuthStateChanged } from 'firebase/auth';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || 'BKBieUeVIq-2sW74jzr6egToaP1jfnzBZd4sJav8VgnSH90t9yt8y5UpdMC3pBvIOWLn2WKf1R-wnHUJfsDZs';

interface UseFcmTokenOptions {
  role?: UserRole;
  autoRequest?: boolean;
}

export const useFcmToken = (options: UseFcmTokenOptions = {}) => {
  const { role = 'customer', autoRequest = false } = options;

  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('hunger_fcm_token');
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [loading, setLoading] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo>({
    browser: 'Loading...',
    os: 'Loading...',
    isSupported: true,
    isIOS: false,
    isStandalone: false,
    permission: 'default',
    userAgent: '',
  });

  // Initialize browser detection & check existing permission on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const info = detectBrowserInfo();
    setBrowserInfo(info);
    setPermission(info.permission);

    // If already granted, silently retrieve token and set up listeners
    if (info.isSupported && info.permission === 'granted') {
      silentRetrieveToken();
    } else if (autoRequest && info.isSupported && info.permission === 'default') {
      // Only auto-request if explicitly specified (not recommended by Safari/Chrome without gesture)
      requestPermission();
    }

    // Set up foreground listener if permitted
    if (info.permission === 'granted') {
      setupForegroundWebPushListener(role);
    }
  }, [role, autoRequest]);

  // Silent token retrieval for users who already granted permission
  const silentRetrieveToken = useCallback(async () => {
    try {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

      const reg = await navigator.serviceWorker.ready;
      const msg = await messaging;
      if (msg && reg) {
        const currentToken = await getToken(msg, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: reg,
        });

        if (currentToken) {
          setToken(currentToken);
          persistPushToken(currentToken, role);
        }
      }
    } catch (err) {
      console.warn('[useFcmToken] Silent token retrieval notice:', err);
    }
  }, [role]);

  // Listen for auth changes to ensure token is synced when user logs in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && token) {
        persistPushToken(token, role, user.uid);
      }
    });
    return () => unsubscribe();
  }, [token, role]);

  // Explicit user-gesture permission request (compatible with Chrome, Safari, Edge)
  const requestPermission = useCallback(async () => {
    setLoading(true);
    try {
      const res = await requestWebPushSubscription(role);
      setPermission(res.permission);
      if (res.success && res.token) {
        setToken(res.token);
      }
      // Refresh browser info
      setBrowserInfo(detectBrowserInfo());
      return res;
    } finally {
      setLoading(false);
    }
  }, [role]);

  // Trigger test push
  const sendTestPush = useCallback(
    async (title?: string, body?: string, actionUrl?: string) => {
      let activeToken = token;
      if (!activeToken && typeof window !== 'undefined') {
        try {
          activeToken = localStorage.getItem('hunger_fcm_token');
        } catch (e) {}
      }

      return sendTestWebPushNotification({
        token: activeToken || undefined,
        role,
        userId: auth.currentUser?.uid,
        title,
        body,
        actionUrl,
      });
    },
    [token, role]
  );

  return {
    fcmToken: token,
    permission,
    loading,
    browserInfo,
    isSupported: browserInfo.isSupported,
    requestPermission,
    sendTestPush,
  };
};

export default useFcmToken;
