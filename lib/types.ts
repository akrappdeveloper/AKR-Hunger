// User types
export interface Customer {
  id?: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  addresses?: Address[];
  defaultAddressId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  orders?: string[];
  favorites?: string[]; // Array of MenuItem Ids
}

export interface Address {
  id: string;
  customerId: string;
  type: 'home' | 'work' | 'other';
  street: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  createdAt: Date;
}

export interface Restaurant {
  id?: string;
  name: string;
  description?: string;
  image?: string;
  rating?: number;
  reviews?: number;
  deliveryTime?: number;
  deliveryCharge?: number;
  minimumOrder?: number;
  cuisineType?: string[];
  isOpen?: boolean;
  isActive?: boolean;
  address: string; // Keep for backward compatibility
  // Structured address fields
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  phone: string;
  email: string;
  createdAt?: Date;
  updatedAt?: Date;
  // Enhanced for reviews and search
  averageRating?: number;
  totalReviews?: number;
  popularItems?: string[]; // Menu item IDs
  // Bank details for settlements
  bankDetails?: {
    bankName: string;
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    updatedAt?: Date;
  };
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  image: string;
  images?: string[]; // Multiple images support
  price: number;
  category: string;
  vegetarian: boolean;
  spicy: boolean;
  available: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Additional details
  preparationTime?: number; // in minutes
  servings?: number;
  calories?: number;
  allergens?: string[];
  tags?: string[];
  isBestSeller?: boolean;
  isNew?: boolean;
  // Enhanced for reviews and search
  averageRating?: number;
  totalReviews?: number;
  dietary?: ('vegetarian' | 'non-vegetarian' | 'vegan')[];
  // Admin approval workflow
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  isLive?: boolean;
  submittedAt?: Date;
  approvedAt?: Date;
  rejectionReason?: string;
}

export interface CartItem {
  id: string;
  menuItemId: string;
  restaurantId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  restaurantName: string;
  category?: string;
  specialInstructions?: string;
  addedAt: Date;
}

export interface Order {
  id?: string;
  customerId?: string;
  restaurantId?: string;
  items?: OrderItem[];
  deliveryAddress?: Address | string;
  status?: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
  paymentMethod?: 'cod' | 'online';
  paymentStatus?: 'pending' | 'completed' | 'failed';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  subtotal?: number;
  deliveryCharge?: number;
  taxes?: number;
  total?: number;
  specialInstructions?: string;
  deliveryPersonId?: string;
  estimatedDeliveryTime?: number;
  createdAt?: Date | any;
  updatedAt?: Date;
  customerName?: string;
  customerPhone?: string;
  restaurantName?: string;
  // Enhanced for promotions and reviews
  promotionId?: string;
  discountAmount?: number;
  hasReview?: boolean;
  // Delivery partner workflow fields
  deliveryPersonName?: string;
  deliveryPersonPhone?: string;
  deliveryVehicle?: string;
  deliveryStatus?: 'pending_acceptance' | 'going_to_restaurant' | 'picked_up' | 'going_to_customer' | 'delivered';
  restaurantAddress?: string;
  restaurantLocation?: { lat: number; lng: number };
  deliveredAt?: Date | any;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  specialInstructions?: string;
}

export interface DeliveryPerson {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatar?: string;
  rating: number;
  vehicle: string;
  vehicleNumber: string;
  status: 'online' | 'offline' | 'on_delivery';
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  createdAt: Date;
  // Verification fields
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  vehicleImage?: string;
  drivingLicense?: string;
}

// Alias for admin panel
export type DeliveryPartner = DeliveryPerson & {
  isAvailable?: boolean;
  vehicleType?: string;
  vehicleNumber?: string;
  completedDeliveries?: number;
};

// Review Interface removed from here as it is consolidated below

export interface RestaurantResponse {
  message: string;
  respondedAt: Date;
}

// Promotion Types
export interface Promotion {
  id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'free_delivery';
  value: number; // Percentage (e.g., 20) or Fixed amount (e.g., 50)
  description: string;
  minOrderAmount?: number;
  maxDiscount?: number; // Cap for percentage discounts
  applicableRestaurants?: string[]; // Empty = all restaurants
  usageLimit?: number; // Total uses allowed
  usageCount: number; // Current usage
  perUserLimit?: number; // Uses per user
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  createdAt: Date;
  createdBy: string; // Admin ID
}

export interface PromotionUsage {
  id: string;
  promotionId: string;
  customerId: string;
  orderId: string;
  discountAmount: number;
  usedAt: Date;
}

// Search & Filter Types
export interface SearchFilters {
  query?: string;
  cuisineTypes?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  rating?: number; // Minimum rating
  deliveryTime?: number; // Maximum delivery time in minutes
  dietary?: ('vegetarian' | 'non-vegetarian' | 'vegan')[];
  sortBy?: 'rating' | 'deliveryTime' | 'popularity' | 'price';
  sortOrder?: 'asc' | 'desc';
}

// Support Ticket Types
export interface TicketReply {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  userType: 'admin' | 'restaurant' | 'customer' | 'delivery';
  message: string;
  createdAt: Date | any;
}

export interface SupportTicket {
  id?: string;
  userId: string;
  userType: 'customer' | 'restaurant' | 'delivery';
  userName: string;
  userEmail: string;
  subject: string;
  category: 'technical' | 'billing' | 'order' | 'account' | 'feature' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  attachments?: string[];
  adminResponse?: string;
  replies?: TicketReply[];
  createdAt: Date;
  updatedAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
}

// Notification Types
export interface Notification {
  id?: string;
  userId: string;
  userType: 'customer' | 'restaurant' | 'delivery' | 'admin';
  type: 'order' | 'menu' | 'review' | 'payment' | 'campaign' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  actionLink?: string;
  metadata?: any;
  createdAt: Date;
}

// Review & Rating Types - Consolidated
export interface Review {
  id?: string;
  customerId: string;
  customerName: string;
  customerAvatar?: string;
  restaurantId: string;
  menuItemId?: string;
  menuItemName?: string;
  orderId?: string;
  rating: number; // 1-5
  title?: string;
  comment: string;
  images?: string[];
  helpful?: number;
  helpfulVoters?: string[];
  response?: RestaurantResponse | string; // Allow flexible response type
  isVerified?: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

// Quality Metrics Types
export interface QualityMetrics {
  id?: string;
  menuItemId: string;
  menuItemName: string;
  restaurantId: string;
  // Metrics
  totalOrders: number;
  successfulOrders: number;
  cancelledOrders: number;
  averageRating: number;
  totalReviews: number;
  qualityScore: number; // Calculated (0-100)
  // Components
  orderSuccessRate: number; // %
  customerSatisfaction: number; // %
  consistencyScore: number; // %
  lastUpdated: Date;
}

// Advertisement Campaign Types
export interface AdCampaign {
  id?: string;
  restaurantId: string;
  restaurantName: string;
  menuItemId: string;
  menuItemName: string;
  menuItemImage: string;
  // Campaign details
  title: string;
  description: string;
  budget: 'daily' | 'monthly';
  dailyCost: number; // in points
  monthlyCost: number; // in points
  // Status
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  isActive: boolean;
  // Metrics
  totalClicks: number;
  totalSpent: number; // in points
  pointsRemaining: number;
  impressions: number;
  clickThroughRate: number; // %
  // Dates
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

// Ad Click Tracking
export interface AdClick {
  id?: string;
  campaignId: string;
  restaurantId: string;
  customerId?: string;
  clickedAt: Date;
  cost: number; // 1 point = 0.50 rupee
  ipAddress?: string;
  userAgent?: string;
}

// Points & Payment Types
export interface PointsAccount {
  id?: string;
  userId: string;
  userType: 'restaurant';
  totalPoints: number;
  availablePoints: number;
  spentPoints: number;
  // Conversion: 100 rupees = 20 points
  // 1 point = 5 rupees value
  // 1 click = 1 point = 0.50 rupee deduction
  createdAt: Date;
  updatedAt: Date;
}

export interface PointsTransaction {
  id?: string;
  userId: string;
  type: 'purchase' | 'spent' | 'refund' | 'bonus';
  amount: number; // Points
  rupeesAmount?: number; // For purchases
  description: string;
  relatedCampaignId?: string;
  relatedPaymentId?: string;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: Date;
}

export interface Payment {
  id?: string;
  userId: string;
  userType: 'restaurant';
  // Razorpay details
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  // Payment info
  amount: number; // in rupees
  pointsPurchased: number; // Points received
  status: 'pending' | 'success' | 'failed';
  paymentMethod?: string;
  createdAt: Date;
  completedAt?: Date;
}



export interface Cart {
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
}
