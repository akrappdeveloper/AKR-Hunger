import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type RestaurantNotificationType = 'order' | 'menu' | 'review' | 'payment' | 'campaign';

export interface CreateNotificationParams {
  restaurantId: string;
  type: RestaurantNotificationType;
  title: string;
  message: string;
  actionLink?: string;
  orderId?: string;
  metadata?: Record<string, any>;
}

/**
 * Creates a real-time notification document for a restaurant partner in Firestore.
 */
export async function createRestaurantNotification(params: CreateNotificationParams): Promise<string> {
  const { restaurantId, type, title, message, actionLink, orderId, metadata } = params;

  const docRef = await addDoc(collection(db, 'notifications'), {
    userId: restaurantId,
    restaurantId: restaurantId,
    userType: 'restaurant',
    type,
    title,
    message,
    actionLink: actionLink || `/restaurant/${type === 'order' && orderId ? `orders/${orderId}` : type === 'order' ? 'orders' : type === 'menu' ? 'menu' : type === 'review' ? 'reviews' : type === 'payment' ? 'wallet' : 'campaigns'}`,
    orderId: orderId || null,
    isRead: false,
    read: false,
    createdAt: new Date().toISOString(),
    timestamp: serverTimestamp(),
    metadata: metadata || {},
  });

  return docRef.id;
}

/**
 * Sample / Test Notification Generator for testing all 5 notification categories
 */
export const SAMPLE_NOTIFICATIONS: Record<
  RestaurantNotificationType,
  { title: string; message: string; defaultAction: string }[]
> = {
  order: [
    {
      title: 'New Customer Order Received! 🛍️',
      message: 'New order #SALRAXCT5509 with 3 items received for ₹720.00. Tap to review & accept.',
      defaultAction: '/restaurant/orders',
    },
    {
      title: 'Delivery Partner Assigned 🛵',
      message: 'Driver Amit Kumar has accepted Order #SALRAXCT5509 and will arrive in 8 mins for pickup.',
      defaultAction: '/restaurant/orders/tracking',
    },
  ],
  menu: [
    {
      title: 'Menu Item Live on Customer App 🍛',
      message: '"Chef\'s Special Butter Chicken" is now verified and live on your digital menu.',
      defaultAction: '/restaurant/menu',
    },
    {
      title: 'Inventory Stock Reminder ⚠️',
      message: 'Your inventory for "Tandoori Roti" is running low for tonight\'s peak hours.',
      defaultAction: '/restaurant/menu',
    },
  ],
  review: [
    {
      title: 'New 5-Star Customer Review! ⭐⭐⭐⭐⭐',
      message: 'Customer Priya M. commented: "Super fresh food, fast delivery and wonderful packaging!"',
      defaultAction: '/restaurant/reviews',
    },
    {
      title: 'Customer Feedback Received 💬',
      message: 'A diner left feedback for their recent order. Tap to view and send a complimentary reply.',
      defaultAction: '/restaurant/reviews',
    },
  ],
  payment: [
    {
      title: 'Bank Settlement Payout Credited 💸',
      message: 'Daily settlement of ₹12,450.00 processed to your registered HDFC bank account.',
      defaultAction: '/restaurant/wallet',
    },
    {
      title: 'Merchant Wallet Balance Updated 💳',
      message: 'Platform earnings statement for the current week is now ready for download.',
      defaultAction: '/restaurant/wallet',
    },
  ],
  campaign: [
    {
      title: 'Weekend Boost Campaign Active 🚀',
      message: 'Your "Flat ₹100 Off" discount campaign is now active across your service pincodes.',
      defaultAction: '/restaurant/campaigns',
    },
    {
      title: 'Loyalty Reward Points Credited 🎁',
      message: '500 Partner Growth reward points credited for maintaining 98%+ on-time kitchen prep.',
      defaultAction: '/restaurant/campaigns',
    },
  ],
};
