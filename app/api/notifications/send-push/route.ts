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

    // If no direct token provided, attempt to look up from Firestore by userId and role
    if (!targetToken && userId && adminDb) {
      try {
        let collectionName = 'users';
        if (role === 'restaurant') {
          collectionName = 'restaurants';
        } else if (role === 'delivery') {
          collectionName = 'deliveryPersons';
        }

        const docSnap = await adminDb.collection(collectionName).doc(userId).get();
        if (docSnap.exists) {
          targetToken = docSnap.data()?.fcmToken;
        }

        // Fallback for delivery or restaurant if stored in users
        if (!targetToken && role !== 'customer') {
          const userSnap = await adminDb.collection('users').doc(userId).get();
          if (userSnap.exists) {
            targetToken = userSnap.data()?.fcmToken;
          }
        }
      } catch (lookupErr) {
        console.warn('[send-push] Token lookup notice:', lookupErr);
      }
    }

    if (!targetToken) {
      return NextResponse.json(
        {
          error:
            'No Web Push registration token found. Please click "Enable Push Notifications" on your browser first.',
          success: false,
        },
        { status: 400 }
      );
    }

    if (!messaging) {
      return NextResponse.json(
        {
          error:
            'Firebase Cloud Messaging is not initialized on the server. Please check FIREBASE_PRIVATE_KEY and credentials.',
          success: false,
        },
        { status: 500 }
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
        error: error?.message || 'Failed to send Web Push notification',
        code: error?.code,
        success: false,
      },
      { status: 500 }
    );
  }
}
