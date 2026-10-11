'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  detectBrowserInfo,
  requestWebPushSubscription,
  setupForegroundWebPushListener,
  persistPushToken,
  sendTestWebPushNotification,
  registerPushServiceWorker,
  normalizeVapidKey,
  BrowserInfo,
  UserRole,
} from '@/lib/web-push';
import { auth, messaging } from '@/lib/firebase';
import { getToken } from 'firebase/messaging';
import { onAuthStateChanged } from 'firebase/auth';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';

interface UseFcmTokenOptions {
  role?: UserRole;
  autoRequest?: boolean;
  enabled?: boolean;
}

export const useFcmToken = (options: UseFcmTokenOptions = {}) => {
  const { role = 'customer', autoRequest = false, enabled = true } = options;

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

  // Silent token retrieval for users who already granted permission
  const silentRetrieveToken = useCallback(async () => {
    if (!enabled) return;
    try {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

      const reg = await registerPushServiceWorker();
      if (!reg) return;

      const msg = await messaging;
      if (msg) {
        const tokenOptions: any = { serviceWorkerRegistration: reg };
        const validVapid = normalizeVapidKey(VAPID_KEY);
        if (validVapid) {
          tokenOptions.vapidKey = validVapid;
        }
        const currentToken = await getToken(msg, tokenOptions);

        if (currentToken) {
          setToken(currentToken);
          try {
            localStorage.setItem('hunger_fcm_token', currentToken);
          } catch (_) {}
          await persistPushToken(currentToken, role, auth.currentUser?.uid);
        }
      }
    } catch (err) {
      console.warn('[useFcmToken] Silent token retrieval notice:', err);
    }
  }, [role, enabled]);

  // Explicit user-gesture permission request (compatible with Chrome, Safari, Edge)
  const requestPermission = useCallback(async () => {
    setLoading(true);
    try {
      const res = await requestWebPushSubscription(role, auth.currentUser?.uid);
      setPermission(res.permission);
      if (res.success && res.token) {
        setToken(res.token);
        try {
          localStorage.setItem('hunger_fcm_token', res.token);
        } catch (_) {}
        await persistPushToken(res.token, role, auth.currentUser?.uid);
      }
      // Refresh browser info
      setBrowserInfo(detectBrowserInfo());
      return res;
    } finally {
      setLoading(false);
    }
  }, [role]);

  // Initialize browser detection & check existing permission on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return;

    const info = detectBrowserInfo();
    setBrowserInfo(info);
    setPermission(info.permission);

    // If already granted, silently retrieve token and set up listeners
    if (info.isSupported && info.permission === 'granted') {
      silentRetrieveToken();
      setupForegroundWebPushListener(role);
    } else if (autoRequest && info.isSupported && info.permission === 'default') {
      // Only auto-request if explicitly specified
      requestPermission();
    }
  }, [role, autoRequest, silentRetrieveToken, requestPermission]);

  // Listen for auth changes to ensure token is synced when user logs in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        let activeToken = token;
        if (!activeToken && typeof window !== 'undefined') {
          try {
            activeToken = localStorage.getItem('hunger_fcm_token');
          } catch (e) {}
        }
        if (activeToken) {
          setToken(activeToken);
          await persistPushToken(activeToken, role, user.uid);
        } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          await silentRetrieveToken();
        }
      }
    });
    return () => unsubscribe();
  }, [token, role, silentRetrieveToken]);

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
