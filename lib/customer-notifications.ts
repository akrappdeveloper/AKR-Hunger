import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  orderBy,
  limit,
} from 'firebase/firestore';

export type CustomerNotificationType =
  | 'order'
  | 'payment'
  | 'wallet'
  | 'promo'
  | 'system';

export interface CreateNotificationParams {
  userId: string;
  userType?: 'customer' | 'restaurant' | 'delivery' | 'admin';
  type: CustomerNotificationType;
  subType?: string; // e.g. 'order-placed', 'order-confirmed', 'payment-success', etc.
  title: string;
  message: string;
  orderId?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * Creates a notification document in Firestore.
 */
export async function createCustomerNotification(params: CreateNotificationParams): Promise<string | null> {
  try {
    if (!params.userId) return null;

    const notifData = {
      userId: params.userId,
      userType: params.userType || 'customer',
      type: params.type,
      subType: params.subType || params.type,
      title: params.title,
      message: params.message,
      read: false,
      isRead: false,
      deleted: false,
      orderId: params.orderId || null,
      actionUrl: params.actionUrl || (params.orderId ? `/customer/orders/${params.orderId}` : null),
      metadata: params.metadata || {},
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'notifications'), notifData);
    return docRef.id;
  } catch (error) {
    console.error('[CustomerNotifications] Error creating notification:', error);
    return null;
  }
}

/**
 * Sends notification when an order is placed.
 */
export async function notifyOrderPlaced({
  orderId,
  customerId,
  restaurantName,
  total,
  paymentMethod,
}: {
  orderId: string;
  customerId: string;
  restaurantName: string;
  total: number;
  paymentMethod: 'wallet' | 'cod' | 'online';
}) {
  const shortId = orderId.slice(-6).toUpperCase();

  // 1. Order Placement Notification
  await createCustomerNotification({
    userId: customerId,
    type: 'order',
    subType: 'order-placed',
    title: 'Order Placed Successfully! 🛍️',
    message: `Your order #${shortId} from ${restaurantName} for ₹${total.toFixed(2)} has been placed! Sit back while the kitchen prepares it.`,
    orderId,
    actionUrl: `/customer/orders/${orderId}`,
    metadata: {
      total,
      restaurantName,
      paymentMethod,
      status: 'pending',
    },
  });

  // 2. Corresponding Payment Notification
  if (paymentMethod === 'cod') {
    await createCustomerNotification({
      userId: customerId,
      type: 'payment',
      subType: 'cod-pending',
      title: 'Cash on Delivery Selected 💵',
      message: `Please keep ₹${total.toFixed(2)} in cash ready for the delivery partner upon arrival for Order #${shortId}.`,
      orderId,
      actionUrl: `/customer/orders/${orderId}`,
      metadata: {
        total,
        paymentMethod: 'cod',
        status: 'pending',
      },
    });
  } else if (paymentMethod === 'wallet') {
    await createCustomerNotification({
      userId: customerId,
      type: 'payment',
      subType: 'wallet-debit',
      title: 'Paid via Hunger Wallet 💰',
      message: `₹${total.toFixed(2)} was debited securely from your Hunger Wallet balance for Order #${shortId}.`,
      orderId,
      actionUrl: `/customer/orders/${orderId}`,
      metadata: {
        total,
        paymentMethod: 'wallet',
        status: 'completed',
      },
    });
  }
}

/**
 * Sends notification when online payment completes or fails.
 */
export async function notifyPaymentResult({
  orderId,
  customerId,
  amount,
  status,
  method = 'online',
  paymentId,
  errorReason,
}: {
  orderId: string;
  customerId: string;
  amount: number;
  status: 'completed' | 'failed' | 'cancelled';
  method?: 'online' | 'wallet';
  paymentId?: string;
  errorReason?: string;
}) {
  const shortId = orderId.slice(-6).toUpperCase();

  if (status === 'completed') {
    await createCustomerNotification({
      userId: customerId,
      type: 'payment',
      subType: 'payment-success',
      title: 'Payment Received! 💳',
      message: `₹${amount.toFixed(2)} received via Razorpay (Tx ID: ${paymentId || 'Verified'}) for Order #${shortId}.`,
      orderId,
      actionUrl: `/customer/orders/${orderId}`,
      metadata: {
        amount,
        paymentId,
        paymentMethod: method,
        status: 'completed',
      },
    });

    await createCustomerNotification({
      userId: customerId,
      type: 'order',
      subType: 'order-confirmed',
      title: 'Order Confirmed! ✅',
      message: `Your payment was verified. Order #${shortId} has been confirmed with the kitchen!`,
      orderId,
      actionUrl: `/customer/orders/${orderId}`,
      metadata: {
        amount,
        orderId,
        status: 'confirmed',
      },
    });
  } else {
    await createCustomerNotification({
      userId: customerId,
      type: 'payment',
      subType: 'payment-failed',
      title: 'Payment Incomplete ⚠️',
      message: errorReason
        ? `Payment for Order #${shortId} failed: ${errorReason}. Tap to review or retry.`
        : `Payment for Order #${shortId} was not completed. Tap to view your order.`,
      orderId,
      actionUrl: `/customer/orders/${orderId}`,
      metadata: {
        amount,
        paymentMethod: method,
        status: 'failed',
        errorReason,
      },
    });
  }
}

/**
 * Sends notification when order status changes (confirmed, preparing, ready, out for delivery, delivered, cancelled).
 */
export async function notifyOrderStatusUpdate({
  orderId,
  customerId,
  status,
  restaurantName,
  deliveryOtp,
}: {
  orderId: string;
  customerId: string;
  status: string;
  restaurantName?: string;
  deliveryOtp?: string;
}) {
  const shortId = orderId.slice(-6).toUpperCase();
  const rest = restaurantName || 'The restaurant';

  let title = 'Order Update 🍽️';
  let message = `Your order #${shortId} status has been updated to ${status.replace(/_/g, ' ')}.`;
  let subType = `order-${status}`;

  switch (status) {
    case 'confirmed':
      title = 'Order Confirmed by Restaurant! 👨‍🍳';
      message = `${rest} has accepted your order #${shortId}. The kitchen will start cooking shortly!`;
      break;
    case 'preparing':
      title = 'Kitchen is Preparing Your Food 🍳';
      message = `Delicious food is being freshly cooked for Order #${shortId} at ${rest}.`;
      break;
    case 'ready':
      title = 'Order Packed & Ready! 📦';
      message = `Order #${shortId} is freshly packed and awaiting delivery partner pickup.`;
      break;
    case 'out_for_delivery':
      title = 'Out for Delivery! 🛵';
      message = deliveryOtp
        ? `Your order #${shortId} from ${rest} is on its way! Share Delivery OTP ${deliveryOtp} with the driver.`
        : `Your order #${shortId} from ${rest} is on the way with your delivery partner!`;
      break;
    case 'delivered':
      title = 'Order Delivered! 🍽️';
      message = `Order #${shortId} from ${rest} has been delivered! Enjoy your delicious meal.`;
      break;
    case 'cancelled':
      title = 'Order Cancelled ❌';
      message = `Your order #${shortId} has been cancelled. If any payment was deducted, refund has been initiated.`;
      break;
  }

  await createCustomerNotification({
    userId: customerId,
    type: 'order',
    subType,
    title,
    message,
    orderId,
    actionUrl: `/customer/orders/${orderId}`,
    metadata: {
      orderId,
      status,
      restaurantName: rest,
      deliveryOtp,
    },
  });
}

/**
 * Sends notification when funds are added to wallet.
 */
export async function notifyWalletDeposit({
  customerId,
  amount,
  paymentId,
}: {
  customerId: string;
  amount: number;
  paymentId?: string;
}) {
  await createCustomerNotification({
    userId: customerId,
    type: 'wallet',
    subType: 'wallet-credit',
    title: 'Wallet Top-up Successful 💰',
    message: `₹${amount.toFixed(2)} was successfully added to your Hunger Wallet balance!`,
    actionUrl: '/customer/wallet',
    metadata: {
      amount,
      paymentId,
      type: 'deposit',
    },
  });
}

/**
 * Checks past orders for the customer and generates real notifications if they don't already exist.
 * This guarantees any existing orders show up on the notifications page without any fake demo data!
 */
export async function syncExistingOrderNotifications(customerId: string) {
  try {
    if (!customerId) return;

    // Check existing notifications to avoid duplicate backfills
    const notifsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', customerId),
      limit(50)
    );
    const existingNotifsSnap = await getDocs(notifsQuery);
    const existingOrderIds = new Set<string>();

    existingNotifsSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.orderId) {
        existingOrderIds.add(data.orderId);
      }
    });

    // Fetch customer's real orders
    const ordersQuery = query(
      collection(db, 'orders'),
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const ordersSnap = await getDocs(ordersQuery);

    for (const orderDoc of ordersSnap.docs) {
      const order = orderDoc.data();
      const orderId = orderDoc.id;

      // If we already have notifications for this order, skip
      if (existingOrderIds.has(orderId)) continue;

      const shortId = orderId.slice(-6).toUpperCase();
      const total = Number(order.total || 0);
      const restName = order.restaurantName || 'Restaurant';
      const paymentMethod = order.paymentMethod || 'cod';
      const status = order.status || 'pending';

      // Backfill 1: Order Placed
      await createCustomerNotification({
        userId: customerId,
        type: 'order',
        subType: 'order-placed',
        title: 'Order Placed! 🛍️',
        message: `Order #${shortId} from ${restName} for ₹${total.toFixed(2)} was placed.`,
        orderId,
        actionUrl: `/customer/orders/${orderId}`,
        metadata: { total, restaurantName: restName, paymentMethod, status },
      });

      // Backfill 2: Payment info
      if (paymentMethod === 'online') {
        await createCustomerNotification({
          userId: customerId,
          type: 'payment',
          subType: 'payment-success',
          title: 'Payment Successful 💳',
          message: `₹${total.toFixed(2)} paid via Online Payment for Order #${shortId}.`,
          orderId,
          actionUrl: `/customer/orders/${orderId}`,
          metadata: { total, paymentMethod: 'online', status: 'completed' },
        });
      } else if (paymentMethod === 'wallet') {
        await createCustomerNotification({
          userId: customerId,
          type: 'payment',
          subType: 'wallet-debit',
          title: 'Paid via Hunger Wallet 💰',
          message: `₹${total.toFixed(2)} debited from Hunger Wallet for Order #${shortId}.`,
          orderId,
          actionUrl: `/customer/orders/${orderId}`,
          metadata: { total, paymentMethod: 'wallet', status: 'completed' },
        });
      }

      // Backfill 3: Latest status milestone if confirmed/out for delivery/delivered
      if (status === 'delivered') {
        await createCustomerNotification({
          userId: customerId,
          type: 'order',
          subType: 'order-delivered',
          title: 'Order Delivered! 🍽️',
          message: `Order #${shortId} from ${restName} has been delivered. Enjoy your meal!`,
          orderId,
          actionUrl: `/customer/orders/${orderId}`,
          metadata: { orderId, status: 'delivered', restaurantName: restName },
        });
      } else if (status === 'out_for_delivery') {
        await createCustomerNotification({
          userId: customerId,
          type: 'order',
          subType: 'order-out-for-delivery',
          title: 'Out for Delivery! 🛵',
          message: `Your order #${shortId} is on the way! OTP: ${order.deliveryOtp || '****'}.`,
          orderId,
          actionUrl: `/customer/orders/${orderId}`,
          metadata: { orderId, status: 'out_for_delivery', restaurantName: restName },
        });
      } else if (status === 'cancelled') {
        await createCustomerNotification({
          userId: customerId,
          type: 'order',
          subType: 'order-cancelled',
          title: 'Order Cancelled ❌',
          message: `Order #${shortId} was cancelled.`,
          orderId,
          actionUrl: `/customer/orders/${orderId}`,
          metadata: { orderId, status: 'cancelled', restaurantName: restName },
        });
      }
    }
  } catch (err) {
    console.error('[CustomerNotifications] Error syncing existing orders:', err);
  }
}
