import {
  ref,
  push,
  set,
  get,
  update,
  onValue,
  onDisconnect,
  serverTimestamp as rtdbServerTimestamp,
  DatabaseReference,
  query,
  orderByChild,
  limitToLast,
  off,
} from 'firebase/database';
import { realtimeDb } from '@/lib/firebase';

export type ChatType = 'customer_restaurant' | 'customer_delivery' | 'restaurant_delivery' | 'support';
export type ChatStatus = 'active' | 'order_completed' | 'closed' | 'reported' | 'archived';
export type UserRole = 'customer' | 'restaurant' | 'delivery' | 'admin' | 'system';
export type MessageType = 'TEXT' | 'IMAGE' | 'ORDER_UPDATE' | 'LOCATION' | 'SYSTEM' | 'QUICK_REPLY';
export type MessageDeliveryStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface ChatParticipant {
  role: UserRole;
  name: string;
  image?: string;
  phone?: string;
  joinedAt: number;
  active: boolean;
  lastReadMessageId?: string;
  lastReadAt?: number;
}

export interface ChatMessage {
  messageId: string;
  chatId: string;
  orderId: string;
  senderId: string;
  senderRole: UserRole;
  senderName: string;
  senderImage?: string;
  type: MessageType;
  text: string;
  mediaPath?: string;
  createdAt: number;
  serverTimestamp?: number | object;
  status: MessageDeliveryStatus;
  replyToMessageId?: string;
  replyToText?: string;
  replyToSenderName?: string;
  editedAt?: number;
  deletedAt?: number;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

export interface ChatConversation {
  chatId: string;
  orderId: string;
  orderNumber?: string;
  chatType: ChatType;
  status: ChatStatus;
  createdAt: number;
  updatedAt: number;
  lastMessage?: string;
  lastMessageAt?: number;
  lastMessageSenderId?: string;
  lastMessageSenderRole?: UserRole;
  restaurantName?: string;
  customerName?: string;
  deliveryName?: string;
  participants: Record<string, ChatParticipant>;
  messages?: Record<string, ChatMessage>;
}

export interface UserChatSummary {
  chatId: string;
  orderId: string;
  orderNumber?: string;
  chatType: ChatType;
  participantName: string;
  participantRole: UserRole;
  participantImage?: string;
  lastMessage: string;
  lastMessageAt: number;
  unreadCount: number;
  active: boolean;
  status: ChatStatus;
  updatedAt: number;
}

export const CUSTOMER_QUICK_REPLIES = [
  'Where is my order?',
  'Please check my order details.',
  'Please don\'t ring the doorbell, baby is sleeping.',
  'Call me when you arrive.',
  'Please deliver at the security gate.',
  'Thank you very much!'
];

export const RESTAURANT_QUICK_REPLIES = [
  'Your order is being freshly prepared.',
  'Order is ready and packed for pickup!',
  'Please wait at the counter for 3 minutes.',
  'We need 5 more minutes for complete preparation.',
  'Extra cutlery & napkins added as requested.',
  'Thank you for ordering with Hunger!'
];

export const DELIVERY_QUICK_REPLIES = [
  'I have picked up your order and am on the way! 🛵',
  'I am arriving in 2 minutes.',
  'I am at the location / entrance gate.',
  'Please confirm your exact house/building number.',
  'Traffic delay on route, reaching safely soon.',
  'Delivered with care. Enjoy your meal!'
];

export const ADMIN_QUICK_REPLIES = [
  'Hunger Support here. How may we assist you with this order?',
  'We have contacted the restaurant regarding your request.',
  'We are tracking your delivery partner now.',
  'Refund has been initiated for the missing item.',
  'This case has been marked as resolved.'
];

/**
 * Generates a stable, deterministic chat ID.
 * Guarantees that the same order + participant pair always reuses the exact same conversation.
 */
export function getDeterministicChatId(orderId: string, chatType: ChatType): string {
  const cleanOrderId = orderId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `chat_${cleanOrderId}_${chatType}`;
}

/**
 * Returns human-readable label for a chat type
 */
export function getChatTypeLabel(chatType: ChatType): string {
  switch (chatType) {
    case 'customer_restaurant':
      return 'Customer ↔ Restaurant';
    case 'customer_delivery':
      return 'Customer ↔ Delivery Partner';
    case 'restaurant_delivery':
      return 'Restaurant ↔ Delivery Partner';
    case 'support':
      return 'Hunger Support';
    default:
      return 'Chat';
  }
}

/**
 * Initializes or verifies an order chat in RTDB. Idempotent.
 */
export async function initializeOrderChat(params: {
  orderId: string;
  orderNumber?: string;
  chatType: ChatType;
  customer?: { id: string; name: string; image?: string; phone?: string };
  restaurant?: { id: string; name: string; image?: string; phone?: string };
  delivery?: { id: string; name: string; image?: string; phone?: string };
  creatorUid?: string;
  creatorRole?: UserRole;
}): Promise<string> {
  const chatId = getDeterministicChatId(params.orderId, params.chatType);
  if (!realtimeDb) return chatId;

  const chatRef = ref(realtimeDb, `chats/${chatId}`);
  const snapshot = await get(chatRef);
  const now = Date.now();

  const participants: Record<string, ChatParticipant> = {};

  if (params.customer?.id) {
    participants[params.customer.id] = {
      role: 'customer',
      name: params.customer.name || 'Customer',
      image: params.customer.image || '',
      phone: params.customer.phone || '',
      joinedAt: now,
      active: true,
      lastReadAt: now,
    };
  }

  if (params.restaurant?.id) {
    participants[params.restaurant.id] = {
      role: 'restaurant',
      name: params.restaurant.name || 'Restaurant',
      image: params.restaurant.image || '',
      phone: params.restaurant.phone || '',
      joinedAt: now,
      active: true,
      lastReadAt: now,
    };
  }

  if (params.delivery?.id) {
    participants[params.delivery.id] = {
      role: 'delivery',
      name: params.delivery.name || 'Delivery Partner',
      image: params.delivery.image || '',
      phone: params.delivery.phone || '',
      joinedAt: now,
      active: true,
      lastReadAt: now,
    };
  }

  if (!snapshot.exists()) {
    // New chat creation
    const newChat: ChatConversation = {
      chatId,
      orderId: params.orderId,
      orderNumber: params.orderNumber || `#${params.orderId.slice(-6).toUpperCase()}`,
      chatType: params.chatType,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      lastMessage: 'Chat conversation created',
      lastMessageAt: now,
      lastMessageSenderId: 'system',
      lastMessageSenderRole: 'system',
      restaurantName: params.restaurant?.name || 'Restaurant',
      customerName: params.customer?.name || 'Customer',
      deliveryName: params.delivery?.name || 'Delivery Partner',
      participants,
    };

    await set(chatRef, newChat);

    // Initial system message
    const msgRef = push(ref(realtimeDb, `chats/${chatId}/messages`));
    const initSystemMsg: ChatMessage = {
      messageId: msgRef.key || `sys_${now}`,
      chatId,
      orderId: params.orderId,
      senderId: 'system',
      senderRole: 'system',
      senderName: 'Hunger Official',
      type: 'SYSTEM',
      text: `Order ${params.orderNumber || ''} chat connected. Keep communications polite and order-related.`,
      createdAt: now,
      status: 'SENT',
    };
    await set(msgRef, initSystemMsg);
  } else {
    // Update existing participants if new rider or restaurant added
    const existing = snapshot.val() as ChatConversation;
    const updates: Record<string, any> = {
      [`chats/${chatId}/updatedAt`]: now,
    };

    Object.entries(participants).forEach(([uid, pData]) => {
      if (!existing.participants || !existing.participants[uid]) {
        updates[`chats/${chatId}/participants/${uid}`] = pData;
      }
    });

    if (params.delivery?.name && !existing.deliveryName) {
      updates[`chats/${chatId}/deliveryName`] = params.delivery.name;
    }

    if (Object.keys(updates).length > 1) {
      await update(ref(realtimeDb), updates);
    }
  }

  // Sync userChats indexes for fast queries
  await syncUserChatIndexes(chatId);
  return chatId;
}

/**
 * Denormalizes chat summary into /userChats/{uid}/{chatId}
 */
export async function syncUserChatIndexes(chatId: string) {
  if (!realtimeDb) return;
  try {
    const chatSnap = await get(ref(realtimeDb, `chats/${chatId}`));
    if (!chatSnap.exists()) return;

    const chatData = chatSnap.val() as ChatConversation;
    const participants = chatData.participants || {};
    const uids = Object.keys(participants);
    const now = Date.now();

    const updates: Record<string, any> = {};

    for (const uid of uids) {
      const myParticipant = participants[uid];
      if (!myParticipant || !myParticipant.active) continue;

      // Find the counterparty name for display
      let counterpartName = 'Chat';
      let counterpartRole: UserRole = 'system';
      let counterpartImage = '';

      for (const [otherUid, otherP] of Object.entries(participants)) {
        if (otherUid !== uid) {
          counterpartName = otherP.name;
          counterpartRole = otherP.role;
          counterpartImage = otherP.image || '';
          break;
        }
      }

      const summary: UserChatSummary = {
        chatId,
        orderId: chatData.orderId,
        orderNumber: chatData.orderNumber || `#${chatData.orderId.slice(-6).toUpperCase()}`,
        chatType: chatData.chatType,
        participantName: counterpartName,
        participantRole: counterpartRole,
        participantImage: counterpartImage,
        lastMessage: chatData.lastMessage || 'New conversation',
        lastMessageAt: chatData.lastMessageAt || now,
        unreadCount: 0, // Unread counts updated individually on message send
        active: chatData.status === 'active',
        status: chatData.status,
        updatedAt: chatData.updatedAt || now,
      };

      updates[`userChats/${uid}/${chatId}`] = summary;
    }

    if (Object.keys(updates).length > 0) {
      await update(ref(realtimeDb), updates);
    }
  } catch (err) {
    console.warn('[ChatService] Error syncing user chats:', err);
  }
}

/**
 * Send a message into the chat
 */
export async function sendChatMessage(params: {
  chatId: string;
  orderId: string;
  senderId: string;
  senderRole: UserRole;
  senderName: string;
  senderImage?: string;
  text: string;
  type?: MessageType;
  mediaPath?: string;
  replyToMessageId?: string;
  replyToText?: string;
  replyToSenderName?: string;
  location?: { latitude: number; longitude: number; address?: string };
}): Promise<ChatMessage> {
  if (!realtimeDb) throw new Error('Realtime Database not initialized');

  const now = Date.now();
  const messagesRef = ref(realtimeDb, `chats/${params.chatId}/messages`);
  const newMsgRef = push(messagesRef);
  const messageId = newMsgRef.key || `msg_${now}_${Math.random().toString(36).substring(2, 7)}`;

  const message: ChatMessage = {
    messageId,
    chatId: params.chatId,
    orderId: params.orderId,
    senderId: params.senderId,
    senderRole: params.senderRole,
    senderName: params.senderName,
    senderImage: params.senderImage || '',
    type: params.type || (params.mediaPath ? 'IMAGE' : params.location ? 'LOCATION' : 'TEXT'),
    text: params.text.trim(),
    mediaPath: params.mediaPath,
    createdAt: now,
    status: 'SENT',
    replyToMessageId: params.replyToMessageId,
    replyToText: params.replyToText,
    replyToSenderName: params.replyToSenderName,
    location: params.location,
  };

  const previewText = params.type === 'IMAGE' || params.mediaPath
    ? '📷 [Image attachment]'
    : params.type === 'LOCATION'
    ? '📍 [Location shared]'
    : params.text.trim();

  // 1. Write the message
  await set(newMsgRef, message);

  // 2. Update chat metadata
  const chatUpdates: Record<string, any> = {
    [`chats/${params.chatId}/lastMessage`]: previewText,
    [`chats/${params.chatId}/lastMessageAt`]: now,
    [`chats/${params.chatId}/lastMessageSenderId`]: params.senderId,
    [`chats/${params.chatId}/lastMessageSenderRole`]: params.senderRole,
    [`chats/${params.chatId}/updatedAt`]: now,
  };

  // 3. Fetch participants to increment unread counts and update summaries
  try {
    const chatSnap = await get(ref(realtimeDb, `chats/${params.chatId}/participants`));
    if (chatSnap.exists()) {
      const participants = chatSnap.val() as Record<string, ChatParticipant>;
      for (const [pUid, pData] of Object.entries(participants)) {
        if (!pData.active) continue;

        chatUpdates[`userChats/${pUid}/${params.chatId}/lastMessage`] = previewText;
        chatUpdates[`userChats/${pUid}/${params.chatId}/lastMessageAt`] = now;
        chatUpdates[`userChats/${pUid}/${params.chatId}/updatedAt`] = now;

        if (pUid !== params.senderId) {
          // Increment unread count for recipient
          const userChatRef = ref(realtimeDb, `userChats/${pUid}/${params.chatId}/unreadCount`);
          const currentCountSnap = await get(userChatRef);
          const currentCount = (currentCountSnap.val() || 0) + 1;
          chatUpdates[`userChats/${pUid}/${params.chatId}/unreadCount`] = currentCount;
        }
      }
    }
  } catch (syncErr) {
    console.warn('[ChatService] Error updating user summaries:', syncErr);
  }

  await update(ref(realtimeDb), chatUpdates);

  // 4. Trigger in-app/push notification in background
  try {
    if (typeof window !== 'undefined') {
      fetch('/api/chat/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: params.chatId,
          orderId: params.orderId,
          senderId: params.senderId,
          senderName: params.senderName,
          senderRole: params.senderRole,
          messagePreview: previewText,
        }),
      }).catch(() => {});
    }
  } catch (_) {}

  return message;
}

/**
 * Mark all messages in a chat as read by current user
 */
export async function markChatAsRead(chatId: string, currentUserId: string): Promise<void> {
  if (!realtimeDb || !chatId || !currentUserId) return;

  const now = Date.now();
  const updates: Record<string, any> = {
    [`userChats/${currentUserId}/${chatId}/unreadCount`]: 0,
    [`chats/${chatId}/participants/${currentUserId}/lastReadAt`]: now,
  };

  try {
    // Optionally update last messages to READ status
    const messagesQuery = query(ref(realtimeDb, `chats/${chatId}/messages`), limitToLast(20));
    const snap = await get(messagesQuery);
    if (snap.exists()) {
      const messages = snap.val() as Record<string, ChatMessage>;
      for (const [msgKey, msg] of Object.entries(messages)) {
        if (msg.senderId !== currentUserId && msg.status !== 'READ') {
          updates[`chats/${chatId}/messages/${msgKey}/status`] = 'READ';
        }
      }
    }

    await update(ref(realtimeDb), updates);
  } catch (err) {
    console.warn('[ChatService] Error marking as read:', err);
  }
}

/**
 * Sets typing indicator with auto-disconnect cleanup
 */
export function setTypingStatus(
  chatId: string,
  userId: string,
  userName: string,
  isTyping: boolean
): void {
  if (!realtimeDb || !chatId || !userId) return;

  const typingRef = ref(realtimeDb, `chatTyping/${chatId}/${userId}`);
  if (isTyping) {
    set(typingRef, {
      isTyping: true,
      userName,
      updatedAt: Date.now(),
    });
    onDisconnect(typingRef).remove();
  } else {
    set(typingRef, null);
  }
}

/**
 * Registers user presence with onDisconnect hook
 */
export function registerUserPresence(userId: string, userName: string, role: UserRole): () => void {
  if (!realtimeDb || !userId) return () => {};

  const presenceRef = ref(realtimeDb, `chatPresence/${userId}`);
  const connectedRef = ref(realtimeDb, '.info/connected');

  const unsubscribe = onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      set(presenceRef, {
        online: true,
        lastSeen: Date.now(),
        name: userName,
        role,
      });

      onDisconnect(presenceRef).set({
        online: false,
        lastSeen: Date.now(),
        name: userName,
        role,
      });
    }
  });

  return () => {
    unsubscribe();
    set(presenceRef, {
      online: false,
      lastSeen: Date.now(),
      name: userName,
      role,
    });
  };
}

/**
 * Post an authoritative system message for order status update (e.g. "Order Confirmed", "Driver Arrived")
 */
export async function sendOrderEventSystemMessage(
  orderId: string,
  eventTitle: string,
  eventDescription: string
): Promise<void> {
  if (!realtimeDb) return;

  const chatTypes: ChatType[] = ['customer_restaurant', 'customer_delivery', 'restaurant_delivery'];
  const now = Date.now();

  for (const cType of chatTypes) {
    const chatId = getDeterministicChatId(orderId, cType);
    const chatRef = ref(realtimeDb, `chats/${chatId}`);
    const snap = await get(chatRef);

    if (snap.exists()) {
      const msgRef = push(ref(realtimeDb, `chats/${chatId}/messages`));
      const sysMsg: ChatMessage = {
        messageId: msgRef.key || `evt_${now}`,
        chatId,
        orderId,
        senderId: 'system',
        senderRole: 'system',
        senderName: 'Hunger Updates',
        type: 'ORDER_UPDATE',
        text: `⚡ ${eventTitle}: ${eventDescription}`,
        createdAt: now,
        status: 'SENT',
      };

      await set(msgRef, sysMsg);
      await update(chatRef, {
        lastMessage: sysMsg.text,
        lastMessageAt: now,
        updatedAt: now,
      });
    }
  }
}

/**
 * Report a chat message or inappropriate conduct
 */
export async function submitChatReport(params: {
  chatId: string;
  orderId?: string;
  messageId?: string;
  reportedBy: string;
  reporterRole: UserRole;
  reason: string;
}): Promise<string> {
  if (!realtimeDb) throw new Error('Realtime Database unavailable');

  const reportRef = push(ref(realtimeDb, 'chatReports'));
  const reportId = reportRef.key || `rep_${Date.now()}`;

  await set(reportRef, {
    reportId,
    chatId: params.chatId,
    orderId: params.orderId || '',
    messageId: params.messageId || null,
    reportedBy: params.reportedBy,
    reporterRole: params.reporterRole,
    reason: params.reason,
    status: 'pending',
    createdAt: Date.now(),
  });

  // Mark conversation status as reported
  await update(ref(realtimeDb, `chats/${params.chatId}`), {
    status: 'reported',
  });

  return reportId;
}
