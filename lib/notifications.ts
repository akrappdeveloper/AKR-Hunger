// Real-time notification types and utilities
export type NotificationType = 
  | 'order'
  | 'payment'
  | 'wallet'
  | 'promo'
  | 'system'
  | 'order-placed' 
  | 'order-confirmed' 
  | 'order-preparing' 
  | 'order-ready' 
  | 'order-out-for-delivery' 
  | 'order-delivered' 
  | 'order-cancelled'
  | 'delivery-assigned'
  | 'payment-failed'
  | 'payment-success'
  | 'restaurant-verified'
  | 'system-alert'
  | string;

export interface Notification {
  id: string;
  type: NotificationType;
  subType?: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  metadata?: Record<string, any>;
  read: boolean;
  isRead?: boolean;
  deleted?: boolean;
  createdAt: Date;
  userId: string;
  userType: 'customer' | 'restaurant' | 'delivery' | 'admin' | string;
  orderId?: string;
  icon?: string;
  actionUrl?: string;
}

export interface NotificationPreference {
  userId: string;
  userType: 'customer' | 'restaurant' | 'delivery' | 'admin';
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  orderUpdates: boolean;
  promotions: boolean;
  systemAlerts: boolean;
}

// Get notification icon based on type
export const getNotificationIcon = (type: NotificationType): string => {
  const icons: Record<NotificationType, string> = {
    'order-placed': '📦',
    'order-confirmed': '✅',
    'order-preparing': '👨‍🍳',
    'order-ready': '🎉',
    'order-out-for-delivery': '🚗',
    'order-delivered': '🏠',
    'order-cancelled': '❌',
    'delivery-assigned': '📍',
    'payment-failed': '💳',
    'restaurant-verified': '🏆',
    'system-alert': '⚠️',
  };
  return icons[type];
};

// Get notification color based on type
export const getNotificationColor = (type: NotificationType): string => {
  const colors: Record<NotificationType, string> = {
    'order-placed': 'bg-blue-50 border-blue-200',
    'order-confirmed': 'bg-green-50 border-green-200',
    'order-preparing': 'bg-yellow-50 border-yellow-200',
    'order-ready': 'bg-purple-50 border-purple-200',
    'order-out-for-delivery': 'bg-cyan-50 border-cyan-200',
    'order-delivered': 'bg-emerald-50 border-emerald-200',
    'order-cancelled': 'bg-red-50 border-red-200',
    'delivery-assigned': 'bg-indigo-50 border-indigo-200',
    'payment-failed': 'bg-orange-50 border-orange-200',
    'restaurant-verified': 'bg-teal-50 border-teal-200',
    'system-alert': 'bg-amber-50 border-amber-200',
  };
  return colors[type];
};
