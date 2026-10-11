'use client';

import { messaging, db, auth } from '@/lib/firebase';
import { getToken, onMessage, MessagePayload } from 'firebase/messaging';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

export type UserRole = 'customer' | 'restaurant' | 'delivery' | 'admin';

export interface BrowserInfo {
  browser: string;
  os: string;
  isSupported: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  permission: NotificationPermission | 'unsupported';
  userAgent: string;
}

export function normalizeVapidKey(key?: string): string | undefined {
  if (!key) return undefined;
  const trimmed = key.trim();
  if (trimmed.length < 20) return undefined;
  try {
    const padding = (4 - (trimmed.length % 4)) % 4;
    const padded = trimmed + '='.repeat(padding);
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    if (typeof window !== 'undefined') {
      window.atob(base64);
    }
    return trimmed;
  } catch (e) {
    console.warn('[WebPush] Invalid VAPID key format, omitting vapidKey option:', e);
    return undefined;
  }
}

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';

/**
 * Detect browser, operating system, and Web Push capability across Chrome, Safari, Edge, Firefox, etc.
 */
export function detectBrowserInfo(): BrowserInfo {
  if (typeof window === 'undefined') {
    return {
      browser: 'Server',
      os: 'Unknown',
      isSupported: false,
      isIOS: false,
      isStandalone: false,
      permission: 'unsupported',
      userAgent: '',
    };
  }

  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  // Detect OS
  if (/iPad|iPhone|iPod/.test(ua)) {
    os = 'iOS';
  } else if (/Android/.test(ua)) {
    os = 'Android';
  } else if (/Windows NT/.test(ua)) {
    os = 'Windows';
  } else if (/Macintosh|Mac OS X/.test(ua)) {
    os = 'macOS';
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
  }

  // Detect Browser (Order matters due to UA substrings)
  if (/Edg\//i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/SamsungBrowser/i.test(ua)) {
    browser = 'Samsung Internet';
  } else if (/OPR\/|Opera/i.test(ua)) {
    browser = 'Opera';
  } else if (/Chrome|CriOS/i.test(ua) && !/Edg/i.test(ua)) {
    browser = 'Google Chrome';
  } else if (/Firefox|FxiOS/i.test(ua)) {
    browser = 'Mozilla Firefox';
  } else if (/Safari/i.test(ua) && !/Chrome|CriOS|Edg/i.test(ua)) {
    browser = 'Apple Safari';
  }

  // Detect Brave
  if ((navigator as any).brave && typeof (navigator as any).brave.isBrave === 'function') {
    browser = 'Brave';
  }

  const isIOS = os === 'iOS';
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true;

  const isSupported =
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  const permission: NotificationPermission | 'unsupported' =
    'Notification' in window ? Notification.permission : 'unsupported';

  return {
    browser,
    os,
    isSupported,
    isIOS,
    isStandalone,
    permission,
    userAgent: ua,
  };
}

/**
 * Play a gentle, high-priority notification chime using the Web Audio API.
 * Works natively across Chrome, Safari, Edge, Firefox without audio file dependencies.
 */
export function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Tone 1 (High bell chime)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2 (Higher bell chime)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.12); // A5
    gain2.gain.setValueAtTime(0.25, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch (err) {
    console.warn('[WebPush] Web Audio chime notice:', err);
  }
}

/**
 * Register Service Worker for Web Push with root scope.
 */
export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    await navigator.serviceWorker.ready;
    console.log('[WebPush] Service worker registered successfully. Scope:', registration.scope);
    return registration;
  } catch (err) {
    console.error('[WebPush] Service worker registration error:', err);
    return null;
  }
}

/**
 * Save FCM Push Token to Firestore and backend API based on user role.
 */
export async function persistPushToken(
  token: string,
  role: UserRole,
  userId?: string
): Promise<void> {
  // 1. Immediately cache in localStorage for instant access across tabs
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('hunger_fcm_token', token);
    } catch (e) {}
  }

  const effectiveUid = userId || auth.currentUser?.uid;
  if (!effectiveUid) {
    console.log('[WebPush] No authenticated user ID available yet to persist token');
    return;
  }

  const browserInfo = detectBrowserInfo();

  try {
    const tokenPayload = {
      fcmToken: token,
      fcmTokenUpdatedAt: serverTimestamp(),
      webPushDevice: {
        browser: browserInfo.browser,
        os: browserInfo.os,
        updatedAt: new Date().toISOString(),
      },
    };

    let targetCollection = 'users';
    if (role === 'customer') {
      targetCollection = 'customers';
    } else if (role === 'restaurant') {
      targetCollection = 'restaurants';
    } else if (role === 'delivery') {
      targetCollection = 'deliveryPersons';
    }

    // Direct Firestore update to primary role collection
    const docRef = doc(db, targetCollection, effectiveUid);
    await setDoc(docRef, tokenPayload, { merge: true });

    // Also sync to users collection if different
    if (targetCollection !== 'users') {
      try {
        await setDoc(doc(db, 'users', effectiveUid), tokenPayload, { merge: true });
      } catch (e) {}
    }

    // 2. Also notify backend API endpoint for multi-collection sync
    await fetch('/api/notifications/save-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        role,
        userId: effectiveUid,
        browserInfo,
      }),
    }).catch((e) => console.warn('[WebPush] Server token sync notice:', e));

    console.log(`[WebPush] Token successfully persisted for ${role} (${effectiveUid})`);
  } catch (error) {
    console.error('[WebPush] Error persisting token to Firestore:', error);
  }
}

let activeMessageUnsubscribe: (() => void) | null = null;

/**
 * Setup foreground Web Push listener.
 * When tab is active, displays rich toast with audio chime and action button.
 */
export async function setupForegroundWebPushListener(role: UserRole = 'customer') {
  if (typeof window === 'undefined') return;

  try {
    const msg = await messaging;
    if (!msg) return;

    if (activeMessageUnsubscribe) {
      activeMessageUnsubscribe();
      activeMessageUnsubscribe = null;
    }

    activeMessageUnsubscribe = onMessage(msg, (payload: MessagePayload) => {
      console.log('[WebPush] Foreground message received:', payload);

      // Play audio chime
      playNotificationSound();

      const title = payload.notification?.title || payload.data?.title || 'New Hunger Alert 🔔';
      const body = payload.notification?.body || payload.data?.body || payload.data?.message || 'You have a new update';
      const actionUrl = payload.data?.actionUrl || payload.data?.click_action || payload.fcmOptions?.link;

      // Show rich Sonner toast
      toast(title, {
        description: body,
        duration: 8000,
        action: actionUrl
          ? {
              label: 'View',
              onClick: () => {
                window.location.href = actionUrl;
              },
            }
          : undefined,
      });

      // If document is currently hidden (user in another tab), trigger system notification as well
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            body,
            icon: payload.notification?.icon || '/hunger.png',
            badge: '/icon-light-32x32.png',
            vibrate: [200, 100, 200],
            data: { actionUrl: actionUrl || '/' },
          } as any);
        });
      }
    });
  } catch (err) {
    console.warn('[WebPush] Foreground listener setup notice:', err);
  }
}

/**
 * Request Web Push Permission and retrieve FCM Token.
 * MUST be triggered from a direct user action (button click) for cross-browser reliability (especially Safari).
 */
export async function requestWebPushSubscription(
  role: UserRole = 'customer',
  userId?: string
): Promise<{ success: boolean; token?: string; permission: NotificationPermission | 'unsupported'; error?: string }> {
  const browserInfo = detectBrowserInfo();

  if (!browserInfo.isSupported) {
    return {
      success: false,
      permission: 'unsupported',
      error: 'Web Push Notifications are not supported by this browser environment.',
    };
  }

  // Handle Safari on iOS requirement (iOS 16.4+ requires PWA added to home screen)
  if (browserInfo.isIOS && !browserInfo.isStandalone) {
    console.info('[WebPush] iOS Safari requires adding the web app to Home Screen for Web Push notifications.');
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        permission,
        error:
          permission === 'denied'
            ? 'Notification permission was denied in your browser settings. Please unblock notifications to receive live updates.'
            : 'Notification permission request was dismissed.',
      };
    }

    // Register service worker
    const reg = await registerPushServiceWorker();
    if (!reg) {
      return {
        success: false,
        permission,
        error: 'Failed to initialize Service Worker. Please check that HTTPS or localhost is enabled.',
      };
    }

    const msg = await messaging;
    if (!msg) {
      return {
        success: false,
        permission,
        error: 'Firebase Cloud Messaging could not be initialized on this browser.',
      };
    }

    // Retrieve FCM token safely
    const tokenOptions: any = { serviceWorkerRegistration: reg };
    const validVapid = normalizeVapidKey(VAPID_KEY);
    if (validVapid) {
      tokenOptions.vapidKey = validVapid;
    }
    const token = await getToken(msg, tokenOptions);

    if (!token) {
      return {
        success: false,
        permission,
        error: 'Could not generate a Web Push registration token.',
      };
    }

    console.log('[WebPush] Web Push FCM Token retrieved:', token);

    // Save token to database
    await persistPushToken(token, role, userId);

    // Setup foreground listener
    await setupForegroundWebPushListener(role);

    return {
      success: true,
      token,
      permission,
    };
  } catch (err: any) {
    console.error('[WebPush] Error subscribing to web push:', err);
    return {
      success: false,
      permission: 'Notification' in window ? Notification.permission : 'unsupported',
      error: err?.message || 'An unknown error occurred while enabling Web Push.',
    };
  }
}

/**
 * Send a Live Test Web Push Notification via the backend API.
 */
export async function sendTestWebPushNotification(params: {
  token?: string;
  role: UserRole;
  userId?: string;
  title?: string;
  body?: string;
  actionUrl?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const cachedToken =
      typeof window !== 'undefined'
        ? localStorage.getItem('hunger_fcm_token') || undefined
        : undefined;
    const effectiveToken = params.token || cachedToken;
    const effectiveUserId = params.userId || auth.currentUser?.uid;

    if (!effectiveToken && !effectiveUserId) {
      return {
        success: false,
        error:
          'Please click "Enable Push Notifications" on your browser first to generate a notification token.',
      };
    }

    const res = await fetch('/api/notifications/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: effectiveToken,
        role: params.role,
        userId: effectiveUserId,
        title: params.title || '🔔 Test Notification from Hunger',
        body: params.body || 'Web Push is working seamlessly on your browser!',
        actionUrl: params.actionUrl || '/',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to dispatch notification' };
    }

    return { success: true, messageId: data.messageId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to trigger test push' };
  }
}
