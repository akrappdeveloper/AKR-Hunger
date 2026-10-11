import { NextRequest, NextResponse } from 'next/server';
import { admin, messaging, adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      token: directToken,
      userId,
      role = 'customer',
      title = 'Hunger Notification 🔔',
      body: messageBody = 'You have a new update on Hunger',
      actionUrl = '/',
      data = {},
    } = body;

    let targetToken = directToken;

    // Multi-collection token lookup across users, customers, restaurants, deliveryPersons
    if (!targetToken && userId && adminDb) {
      try {
        // 1. Role-specific collection lookup
        if (role === 'customer') {
          const custSnap = await adminDb.collection('customers').doc(userId).get();
          if (custSnap.exists && custSnap.data()?.fcmToken) {
            targetToken = custSnap.data()?.fcmToken;
          }
        } else if (role === 'restaurant') {
          const restSnap = await adminDb.collection('restaurants').doc(userId).get();
          if (restSnap.exists && restSnap.data()?.fcmToken) {
            targetToken = restSnap.data()?.fcmToken;
          } else {
            // Check by ownerId
            const ownerSnap = await adminDb.collection('restaurants').where('ownerId', '==', userId).limit(1).get();
            if (!ownerSnap.empty && ownerSnap.docs[0].data()?.fcmToken) {
              targetToken = ownerSnap.docs[0].data()?.fcmToken;
            }
          }
        } else if (role === 'delivery') {
          const delSnap = await adminDb.collection('deliveryPersons').doc(userId).get();
          if (delSnap.exists && delSnap.data()?.fcmToken) {
            targetToken = delSnap.data()?.fcmToken;
          }
        }

        // 2. Global users collection fallback
        if (!targetToken) {
          const userSnap = await adminDb.collection('users').doc(userId).get();
          if (userSnap.exists && userSnap.data()?.fcmToken) {
            targetToken = userSnap.data()?.fcmToken;
          }
        }

        // 3. Fallback to customers collection if still not found
        if (!targetToken && role !== 'customer') {
          const custSnap = await adminDb.collection('customers').doc(userId).get();
          if (custSnap.exists && custSnap.data()?.fcmToken) {
            targetToken = custSnap.data()?.fcmToken;
          }
        }
      } catch (lookupErr) {
        console.warn('[send-push] Token lookup notice:', lookupErr);
      }
    }

    // If no target token is available, return 200 with skipped: true instead of 400
    // This avoids triggering browser-level unhandled Bad Request console errors
    if (!targetToken) {
      return NextResponse.json(
        {
          success: false,
          skipped: true,
          error:
            'No Web Push registration token found for this device or user. Please click "Enable Push Notifications" first.',
        },
        { status: 200 }
      );
    }

    if (!messaging) {
      return NextResponse.json(
        {
          success: false,
          skipped: true,
          error:
            'Firebase Cloud Messaging is not initialized on the server. Please check FIREBASE_PRIVATE_KEY and credentials.',
        },
        { status: 200 }
      );
    }

    // Format robust Web Push message compatible with Chrome, Safari, Edge, Firefox, and Open Browsers
    const fcmMessage = {
      token: targetToken,
      notification: {
        title,
        body: messageBody,
      },
      webpush: {
        headers: {
          Urgency: 'high',
          TTL: '86400', // 24 hours
        },
        notification: {
          title,
          body: messageBody,
          icon: '/hunger.png',
          badge: '/icon-light-32x32.png',
          vibrate: [200, 100, 200, 100, 200],
          requireInteraction: true,
          tag: data?.orderId || 'hunger-alert',
          actions: [
            {
              action: 'open',
              title: 'Open Hunger',
            },
          ],
        },
        fcmOptions: {
          link: actionUrl || '/',
        },
      },
      data: {
        title,
        body: messageBody,
        actionUrl: actionUrl || '/',
        click_action: actionUrl || '/',
        role: String(role),
        sentAt: new Date().toISOString(),
        ...data,
      },
    };

    console.log('[send-push] Dispatching Web Push to token:', targetToken.slice(0, 14) + '...');
    const messageId = await messaging.send(fcmMessage);

    // Also persist in Firestore notifications collection if userId is available
    if (userId && adminDb) {
      try {
        await adminDb.collection('notifications').add({
          userId,
          userType: role,
          type: data?.type || 'system',
          subType: data?.subType || 'web_push_test',
          title,
          message: messageBody,
          orderId: data?.orderId || null,
          actionUrl,
          read: false,
          isRead: false,
          createdAt: new Date().toISOString(),
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          metadata: {
            ...data,
            deliveredVia: 'web-push',
            messageId,
          },
        });
      } catch (dbErr) {
        console.warn('[send-push] Firestore notification archive notice:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      messageId,
      message: 'Web Push notification delivered successfully',
      targetRole: role,
    });
  } catch (error: any) {
    console.error('[send-push] Push delivery error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to send Web Push notification',
        code: error?.code,
      },
      { status: 200 }
    );
  }
}
