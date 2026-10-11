// Firebase Cloud Messaging Service Worker for Hunger Food Delivery Platform
// Supports Google Chrome, Apple Safari (macOS & iOS 16.4+), Microsoft Edge, Firefox, Opera, and all Open Browsers

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase with akr-hunger configuration
firebase.initializeApp({
  apiKey: "AIzaSyCJjEX3uUa1WMA4IQ7rsZ_KZcLe_dFw0iM",
  authDomain: "akr-hunger.firebaseapp.com",
  databaseURL: "https://akr-hunger-default-rtdb.firebaseio.com",
  projectId: "akr-hunger",
  storageBucket: "akr-hunger.firebasestorage.app",
  messagingSenderId: "670606536695",
  appId: "1:670606536695:web:1c0ce5d53d5b69c05508f2",
  measurementId: "G-1R9F1FWN1Q"
});

const messaging = firebase.messaging();

// Handle Service Worker lifecycle
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle Background Messages via Firebase Messaging
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Hunger Notification';
  const notificationBody = payload.notification?.body || payload.data?.body || payload.data?.message || 'New update available';
  const icon = payload.notification?.icon || payload.data?.icon || '/hunger.png';
  const badge = payload.notification?.badge || payload.data?.badge || '/icon-light-32x32.png';
  const clickUrl = payload.fcmOptions?.link || payload.data?.actionUrl || payload.data?.click_action || payload.data?.url || '/';

  const notificationOptions = {
    body: notificationBody,
    icon: icon,
    badge: badge,
    vibrate: [200, 100, 200, 100, 200],
    tag: payload.data?.orderId || payload.data?.tag || 'hunger-web-push',
    renotify: true,
    requireInteraction: true,
    data: {
      ...payload.data,
      actionUrl: clickUrl,
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: 'Open Hunger' }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Universal Push Event Handler
// Fallback for raw Web Push payloads across Safari, Edge, Chrome, and open browsers
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  try {
    const rawData = event.data.json();
    console.log('[firebase-messaging-sw.js] Raw push event json:', rawData);

    // If already handled by Firebase onBackgroundMessage, avoid duplicate
    if (rawData.notification || rawData.data) {
      const notif = rawData.notification || {};
      const data = rawData.data || {};
      const title = notif.title || data.title || 'Hunger Update';
      const body = notif.body || data.body || data.message || 'You have a new update';
      const actionUrl = rawData.fcmOptions?.link || data.actionUrl || data.click_action || data.url || '/';

      const options = {
        body: body,
        icon: notif.icon || data.icon || '/hunger.png',
        badge: notif.badge || data.badge || '/icon-light-32x32.png',
        vibrate: [200, 100, 200],
        tag: data.orderId || data.tag || 'hunger-push-alert',
        renotify: true,
        data: {
          ...data,
          actionUrl: actionUrl,
        },
        actions: [
          { action: 'open', title: 'Open Hunger' }
        ]
      };

      event.waitUntil(self.registration.showNotification(title, options));
    }
  } catch (e) {
    // Plain text push fallback
    const text = event.data.text();
    console.log('[firebase-messaging-sw.js] Raw push text:', text);
    event.waitUntil(
      self.registration.showNotification('Hunger Alert', {
        body: text,
        icon: '/hunger.png',
        badge: '/icon-light-32x32.png',
        vibrate: [200, 100, 200],
        data: { actionUrl: '/' }
      })
    );
  }
});

// Notification Click Handler: Deep Link navigation across all platforms
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);
  event.notification.close();

  const data = event.notification.data || {};
  const destinationUrl = data.actionUrl || data.click_action || data.url || data.link || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open with Hunger, focus it and navigate
      for (const client of clientList) {
        if (client.url && client.url.includes(self.location.origin) && 'focus' in client) {
          if (destinationUrl && destinationUrl !== '/' && 'navigate' in client) {
            client.navigate(destinationUrl);
          }
          return client.focus();
        }
      }

      // Otherwise open a new window/tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(destinationUrl);
      }
    })
  );
});
