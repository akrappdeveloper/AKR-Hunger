import { NextResponse } from 'next/server';
import { admin, adminRealtimeDb } from '@/lib/firebase-admin';
import { getDeterministicChatId, ChatType, ChatConversation, ChatParticipant } from '@/lib/chat-service';

export async function POST(request: Request) {
  try {
    const { orderId, chatType, creatorUid, creatorRole } = await request.json();

    if (!orderId || !chatType) {
      return NextResponse.json({ error: 'orderId and chatType required' }, { status: 400 });
    }

    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    // 1. Fetch Order from Firestore
    const orderDoc = await admin.firestore().collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orderDoc.data();
    const chatId = getDeterministicChatId(orderId, chatType as ChatType);

    // 2. Fetch Restaurant & Customer names/phones if needed
    let customerName = order?.customerName || 'Customer';
    let customerPhone = order?.customerPhone || '';
    let restaurantName = order?.restaurantName || 'Restaurant';
    let restaurantPhone = order?.restaurantPhone || '';
    let deliveryName = order?.deliveryPersonName || 'Delivery Partner';
    let deliveryPhone = order?.deliveryPersonPhone || '';

    const customerId = order?.customerId;
    const restaurantId = order?.restaurantId;
    const deliveryId = order?.deliveryPersonId;

    const now = Date.now();
    const participants: Record<string, ChatParticipant> = {};

    if (customerId) {
      participants[customerId] = {
        role: 'customer',
        name: customerName,
        phone: customerPhone,
        joinedAt: now,
        active: true,
        lastReadAt: now,
      };
    }

    if (restaurantId) {
      participants[restaurantId] = {
        role: 'restaurant',
        name: restaurantName,
        phone: restaurantPhone,
        joinedAt: now,
        active: true,
        lastReadAt: now,
      };
    }

    if (deliveryId) {
      participants[deliveryId] = {
        role: 'delivery',
        name: deliveryName,
        phone: deliveryPhone,
        joinedAt: now,
        active: true,
        lastReadAt: now,
      };
    }

    // 3. Ensure conversation exists in RTDB if adminRealtimeDb available
    if (adminRealtimeDb) {
      try {
        const chatRef = adminRealtimeDb.ref(`chats/${chatId}`);
        const snap = await chatRef.once('value');

        if (!snap.exists()) {
          const orderNumber = order?.orderNumber || `#${orderId.slice(-6).toUpperCase()}`;
          const newChat: ChatConversation = {
            chatId,
            orderId,
            orderNumber,
            chatType: chatType as ChatType,
            status: 'active',
            createdAt: now,
            updatedAt: now,
            lastMessage: 'Conversation opened',
            lastMessageAt: now,
            restaurantName,
            customerName,
            deliveryName,
            participants,
          };
          await chatRef.set(newChat);

          // Add initial system greeting
          const sysMsgRef = chatRef.child('messages').push();
          await sysMsgRef.set({
            messageId: sysMsgRef.key,
            chatId,
            orderId,
            senderId: 'system',
            senderRole: 'system',
            senderName: 'Hunger System',
            type: 'SYSTEM',
            text: `Order ${orderNumber} chat connected.`,
            createdAt: now,
            status: 'SENT',
          });

          // Sync userChats
          for (const uid of Object.keys(participants)) {
            let counterpartName = 'Chat';
            let counterpartRole = 'system';
            for (const [oUid, oP] of Object.entries(participants)) {
              if (oUid !== uid) {
                counterpartName = oP.name;
                counterpartRole = oP.role;
                break;
              }
            }

            await adminRealtimeDb.ref(`userChats/${uid}/${chatId}`).set({
              chatId,
              orderId,
              orderNumber,
              chatType,
              participantName: counterpartName,
              participantRole: counterpartRole,
              lastMessage: 'Conversation opened',
              lastMessageAt: now,
              unreadCount: 0,
              active: true,
              status: 'active',
              updatedAt: now,
            });
          }
        } else {
          // If rider was assigned afterwards, update rider participant
          if (deliveryId) {
            await chatRef.child(`participants/${deliveryId}`).update({
              role: 'delivery',
              name: deliveryName,
              phone: deliveryPhone,
              joinedAt: now,
              active: true,
            });
            await chatRef.update({ deliveryName });
          }
        }
      } catch (rtdbErr) {
        console.warn('[ChatInit] RTDB write error:', rtdbErr);
      }
    }

    return NextResponse.json({
      success: true,
      chatId,
      orderData: {
        orderId,
        orderNumber: order?.orderNumber || `#${orderId.slice(-6).toUpperCase()}`,
        status: order?.status,
        total: order?.total,
        restaurantName,
        customerName,
        deliveryPersonName: deliveryName,
        items: order?.items?.map((it: any) => ({ name: it.name, quantity: it.quantity })) || [],
      },
    });
  } catch (error: any) {
    console.error('[ChatInit] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
