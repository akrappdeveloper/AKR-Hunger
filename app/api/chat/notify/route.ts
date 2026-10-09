import { NextResponse } from 'next/server';
import { admin, messaging, adminRealtimeDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { chatId, orderId, senderId, senderName, senderRole, messagePreview } = body;

    if (!chatId || !senderId) {
      return NextResponse.json({ error: 'Missing required chat parameters' }, { status: 400 });
    }

    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin uninitialized' }, { status: 500 });
    }

    // 1. Fetch chat participants from RTDB
    let recipientUids: string[] = [];
    if (adminRealtimeDb) {
      try {
        const snap = await adminRealtimeDb.ref(`chats/${chatId}/participants`).once('value');
        if (snap.exists()) {
          const participants = snap.val();
          recipientUids = Object.keys(participants).filter((uid) => uid !== senderId);
        }
      } catch (rtdbErr) {
        console.warn('[ChatNotify] RTDB read warning:', rtdbErr);
      }
    }

    // Fallback if RTDB read didn't resolve recipients: check Order in Firestore
    if (recipientUids.length === 0 && orderId) {
      try {
        const orderSnap = await admin.firestore().collection('orders').doc(orderId).get();
        if (orderSnap.exists) {
          const o = orderSnap.data();
          const possible = [o?.customerId, o?.restaurantId, o?.deliveryPersonId].filter(Boolean);
          recipientUids = possible.filter((id) => id !== senderId);
        }
      } catch (err) {
        console.warn('[ChatNotify] Order fallback warning:', err);
      }
    }

    const shortOrder = orderId ? `#${orderId.slice(-6).toUpperCase()}` : '';
    const title = `${senderName || 'New Message'} (${shortOrder || 'Hunger'})`;
    const bodyText = messagePreview || 'You received a new message.';

    // 2. Deliver in-app notification and FCM for each recipient
    for (const recipientId of recipientUids) {
      try {
        // Add Firestore notification
        await admin.firestore().collection('notifications').add({
          userId: recipientId,
          userType: 'customer', // generic receiver bucket
          type: 'chat',
          subType: 'chat-message',
          title,
          message: bodyText,
          orderId: orderId || null,
          read: false,
          isRead: false,
          deleted: false,
          actionUrl: `/customer/chat/${chatId}`,
          metadata: { chatId, orderId, senderId, senderRole },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // FCM push attempt
        if (messaging) {
          // Look up user fcmToken in users or deliveryPersons or restaurants
          let fcmToken: string | null = null;
          const userDoc = await admin.firestore().collection('users').doc(recipientId).get();
          if (userDoc.exists && userDoc.data()?.fcmToken) {
            fcmToken = userDoc.data()?.fcmToken;
          } else {
            const driverDoc = await admin.firestore().collection('deliveryPersons').doc(recipientId).get();
            if (driverDoc.exists && driverDoc.data()?.fcmToken) {
              fcmToken = driverDoc.data()?.fcmToken;
            } else {
              const restDoc = await admin.firestore().collection('restaurants').doc(recipientId).get();
              if (restDoc.exists && restDoc.data()?.fcmToken) {
                fcmToken = restDoc.data()?.fcmToken;
              }
            }
          }

          if (fcmToken) {
            await messaging.send({
              token: fcmToken,
              notification: {
                title,
                body: bodyText,
              },
              data: {
                chatId,
                orderId: orderId || '',
                type: 'chat_message',
                actionUrl: `/customer/chat/${chatId}`,
              },
            });
          }
        }
      } catch (recipErr) {
        console.warn(`[ChatNotify] Failed sending to recipient ${recipientId}:`, recipErr);
      }
    }

    return NextResponse.json({ success: true, notifiedCount: recipientUids.length });
  } catch (error: any) {
    console.error('[ChatNotify] Error:', error);
    return NextResponse.json({ error: error.message || 'Notification error' }, { status: 500 });
  }
}
