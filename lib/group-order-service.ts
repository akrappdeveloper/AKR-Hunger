/**
 * Hunger Group Order Service
 * ===========================
 * Manages group ordering, split payment, invite links, QR codes.
 */

import { db } from './firebase';
import {
  collection, doc, setDoc, updateDoc, onSnapshot,
  serverTimestamp, arrayUnion, Timestamp, getDoc
} from 'firebase/firestore';
import { GroupOrder, GroupMember, GroupMemberCartItem } from './hunger-types';
import QRCode from 'qrcode';

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hunger.app';

/** Generate a random 6-char invite code */
function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/** Create a new group order */
export async function createGroupOrder(params: {
  hostId: string;
  hostName: string;
  restaurantId: string;
  restaurantName: string;
  deadlineMinutes?: number;
}): Promise<GroupOrder> {
  const inviteCode = generateInviteCode();
  const inviteLink = `${APP_BASE_URL}/customer/group/${inviteCode}`;

  let qrCodeData: string | undefined;
  try {
    qrCodeData = await QRCode.toDataURL(inviteLink, { width: 200, margin: 1 });
  } catch {
    // QR generation optional
  }

  const groupId = doc(collection(db, 'groupOrders')).id;
  const hostMember: GroupMember = {
    userId: params.hostId,
    name: params.hostName,
    isHost: true,
    joinedAt: new Date(),
    items: [],
    subtotal: 0,
    paymentStatus: 'pending',
  };

  const deadline = params.deadlineMinutes
    ? new Date(Date.now() + params.deadlineMinutes * 60000)
    : undefined;

  const groupOrder: GroupOrder = {
    id: groupId,
    hostId: params.hostId,
    hostName: params.hostName,
    restaurantId: params.restaurantId,
    restaurantName: params.restaurantName,
    inviteCode,
    inviteLink,
    qrCodeData,
    status: 'open',
    members: [hostMember],
    deadline,
    createdAt: new Date(),
  };

  await setDoc(doc(db, 'groupOrders', groupId), {
    ...groupOrder,
    createdAt: serverTimestamp(),
    deadline: deadline ? Timestamp.fromDate(deadline) : null,
  });

  return groupOrder;
}

/** Join an existing group order via invite code */
export async function joinGroupOrder(params: {
  inviteCode: string;
  userId: string;
  userName: string;
  avatar?: string;
}): Promise<{ success: boolean; groupOrder?: GroupOrder; error?: string }> {
  // Find group by invite code
  const { query, where, getDocs } = await import('firebase/firestore');
  const q = query(
    collection(db, 'groupOrders'),
    where('inviteCode', '==', params.inviteCode),
    where('status', '==', 'open')
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    return { success: false, error: 'Invalid or expired invite code.' };
  }

  const groupDoc = snap.docs[0];
  const groupOrder = { id: groupDoc.id, ...groupDoc.data() } as GroupOrder;

  // Check if already a member
  if (groupOrder.members.some(m => m.userId === params.userId)) {
    return { success: true, groupOrder };
  }

  // Check deadline
  if (groupOrder.deadline && new Date() > new Date(groupOrder.deadline)) {
    return { success: false, error: 'This group order has expired.' };
  }

  const newMember: GroupMember = {
    userId: params.userId,
    name: params.userName,
    avatar: params.avatar,
    isHost: false,
    joinedAt: new Date(),
    items: [],
    subtotal: 0,
    paymentStatus: 'pending',
  };

  await updateDoc(doc(db, 'groupOrders', groupDoc.id), {
    members: arrayUnion(newMember),
    updatedAt: serverTimestamp(),
  });

  return { success: true, groupOrder };
}

/** Update a member's cart items in a group order */
export async function updateGroupMemberCart(params: {
  groupId: string;
  userId: string;
  items: GroupMemberCartItem[];
}): Promise<void> {
  const groupRef = doc(db, 'groupOrders', params.groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) throw new Error('Group order not found');

  const data = snap.data() as GroupOrder;
  const subtotal = params.items.reduce((s, i) => s + i.price * i.quantity, 0);

  const updatedMembers = data.members.map(m =>
    m.userId === params.userId
      ? { ...m, items: params.items, subtotal }
      : m
  );

  const totalAmount = updatedMembers.reduce((s, m) => s + (m.subtotal || 0), 0);

  await updateDoc(groupRef, {
    members: updatedMembers,
    totalAmount,
    updatedAt: serverTimestamp(),
  });
}

/** Lock the group order (host only) */
export async function lockGroupOrder(groupId: string, hostId: string): Promise<void> {
  const snap = await getDoc(doc(db, 'groupOrders', groupId));
  if (!snap.exists()) throw new Error('Group not found');
  const data = snap.data() as GroupOrder;
  if (data.hostId !== hostId) throw new Error('Only host can lock the group.');

  await updateDoc(doc(db, 'groupOrders', groupId), {
    status: 'locked',
    updatedAt: serverTimestamp(),
  });
}

/** Subscribe to real-time group order updates */
export function subscribeToGroupOrder(
  groupId: string,
  callback: (g: GroupOrder) => void
): () => void {
  return onSnapshot(doc(db, 'groupOrders', groupId), snap => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() } as GroupOrder);
    }
  });
}

/** Calculate split payment amounts */
export function calculateSplitAmounts(
  group: GroupOrder,
  deliveryFee: number,
  platformFee: number,
  taxes: number
): Record<string, number> {
  const foodTotal = group.members.reduce((s, m) => s + (m.subtotal || 0), 0);
  const totalExtra = deliveryFee + platformFee + taxes;

  const splits: Record<string, number> = {};
  group.members.forEach(member => {
    const share = foodTotal > 0 ? (member.subtotal || 0) / foodTotal : 0;
    splits[member.userId] = parseFloat(((member.subtotal || 0) + share * totalExtra).toFixed(2));
  });
  return splits;
}
