// User types
export interface Customer {
  id?: string;
  email: string;
  password?: string;
  name: string;
  displayName?: string; // alias for name (used by some pages)
  phone?: string;
  phoneVerified?: boolean;
  verifiedPhone?: string;
  avatar?: string;
  addresses?: Address[];
  defaultAddressId?: string;
  createdAt?: Date | any;
  updatedAt?: Date | any;
  orders?: string[];
  favorites?: string[]; // Array of MenuItem Ids
  favoriteRestaurants?: string[]; // Array of Restaurant Ids
  walletBalance?: number;
  membershipId?: string;
  membershipStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  isBlocked?: boolean;
  image?: string; // Alias for avatar or separate field
  rewardPoints?: number; // Loyalty reward points balance
  referralCode?: string;
  referralCount?: number;
  referralEarnings?: number;
  referredBy?: string;
  usedReferralCode?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
  };
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
  plusCode?: string;
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
  password?: string;
  createdAt?: Date;
  updatedAt?: Date;
  // Enhanced for reviews and search
  averageRating?: number;
  totalReviews?: number;
  popularItems?: string[]; // Menu item IDs
  imageUrl?: string; // Primary display image URL
  // Bank details for settlements
  bankDetails?: {
    bankName: string;
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    updatedAt?: Date;
  };
  servicePincodes?: string[];
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
  rejectionReason?: string;
  isLive?: boolean;
  submittedAt?: Date;
  // Customization & Add-on options provided by restaurant
  customizations?: CustomizationGroup[];
  addOns?: CustomizationOption[];
  addons?: CustomizationOption[];
  sizes?: CustomizationOption[];
  variants?: CustomizationOption[];
}

export interface CustomizationOption {
  id?: string;
  name: string;
  price: number;
  description?: string;
  category?: string;
  isDefault?: boolean;
}

export interface CustomizationGroup {
  id?: string;
  name: string;
  type?: 'single' | 'multiple';
  min?: number;
  max?: number;
  required?: boolean;
  options: CustomizationOption[];
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

// ==========================================
// Delivery Stage Flow (Professional Route System)
// ==========================================
export type DeliveryStage =
  | 'TO_PICKUP'         // Driver heading to restaurant
  | 'ARRIVED_PICKUP'    // Driver arrived at restaurant, waiting for food
  | 'PICKED_UP'         // Food picked up, about to head to customer
  | 'TO_CUSTOMER'       // Driver heading to customer
  | 'ARRIVED_CUSTOMER'  // Driver arrived at customer location
  | 'DELIVERED'         // Order delivered, GPS tracking stops
  | 'RETURNING_TO_RESTAURANT' // Driver returning cancelled order to restaurant
  | 'RETURNED_TO_RESTAURANT'; // Cancelled order returned to restaurant counter

export interface DeliveryFlow {
  driverId: string;
  stage: DeliveryStage;
  pickup: {
    restaurantId: string;
    latitude: number;
    longitude: number;
    address: string;
  };
  drop: {
    customerId: string;
    latitude: number;
    longitude: number;
    address: string;
  };
  // Stage timestamps
  assignedAt?: any;
  arrivedPickupAt?: any;
  pickedUpAt?: any;
  arrivedCustomerAt?: any;
  deliveredAt?: any;
  returnedAt?: any;
}

/** Get route destination based on delivery stage */
export function getRouteDestination(stage?: DeliveryStage): 'restaurant' | 'customer' | null {
  switch (stage) {
    case 'TO_PICKUP':
    case 'ARRIVED_PICKUP':
    case 'RETURNING_TO_RESTAURANT':
    case 'RETURNED_TO_RESTAURANT':
      return 'restaurant';
    case 'PICKED_UP':
    case 'TO_CUSTOMER':
    case 'ARRIVED_CUSTOMER':
      return 'customer';
    case 'DELIVERED':
    default:
      return null;
  }
}

/** Get human-readable stage label */
export function getStageLabel(stage?: DeliveryStage): string {
  switch (stage) {
    case 'TO_PICKUP': return 'Heading to Restaurant';
    case 'ARRIVED_PICKUP': return 'Arrived at Restaurant';
    case 'PICKED_UP': return 'Order Picked Up';
    case 'TO_CUSTOMER': return 'On the way to Customer';
    case 'ARRIVED_CUSTOMER': return 'Arrived at Customer';
    case 'DELIVERED': return 'Delivered';
    case 'RETURNING_TO_RESTAURANT': return 'Returning to Restaurant';
    case 'RETURNED_TO_RESTAURANT': return 'Returned to Restaurant';
    default: return 'Pending';
  }
}

/** Get stage color for badges */
export function getStageColor(stage?: DeliveryStage): { bg: string; text: string; border: string } {
  switch (stage) {
    case 'TO_PICKUP':
      return { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/25' };
    case 'ARRIVED_PICKUP':
      return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/25' };
    case 'PICKED_UP':
    case 'TO_CUSTOMER':
      return { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/25' };
    case 'ARRIVED_CUSTOMER':
      return { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/25' };
    case 'DELIVERED':
      return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/25' };
    case 'RETURNING_TO_RESTAURANT':
    case 'RETURNED_TO_RESTAURANT':
      return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/25' };
    default:
      return { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/25' };
  }
}

export interface Order {
  id?: string;
  orderId?: string;
  orderNumber?: string;
  customerId?: string;
  restaurantId?: string;
  items?: OrderItem[];
  deliveryAddress?: Address | string;
  status?: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'returned_to_restaurant';
  paymentMethod?: 'cod' | 'online' | 'wallet';
  paymentStatus?: 'pending' | 'completed' | 'failed' | 'paid';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  walletTransactionId?: string;
  subtotal?: number;
  packagingCharges?: number;
  platformFee?: number;
  taxableValue?: number;
  cgst?: number;
  sgst?: number;
  deliveryCharge?: number;
  deliveryFee?: number;
  taxes?: number;
  total?: number;
  amountPaid?: number;
  balanceDue?: number;
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
  deliveryStatus?: 'pending_acceptance' | 'going_to_restaurant' | 'picked_up' | 'going_to_customer' | 'delivered' | 'returning_to_restaurant' | 'returned_to_restaurant';
  restaurantAddress?: string;
  restaurantLocation?: { lat: number; lng: number };
  restaurantPhone?: string;
  deliveredAt?: Date | any;
  returnedAt?: Date | any;
  targetDeliveryIds?: string[]; // IDs of specific delivery partners this order is broadcast to
  deliveryOtp?: string; // OTP for delivery verification
  returnOtp?: string; // OTP for restaurant return drop verification
  deliveryEarnings?: number; // Exact earnings credited to driver (80% of delivery fee)
  cancellationCompensation?: number; // ₹20 travel compensation on customer cancelled return
  cancellationReason?: string;
  // Professional delivery flow (stage-based)
  delivery?: DeliveryFlow;
  // Extended fields
  discount?: number;
  restaurantPincode?: string;
  isRated?: boolean;
  estimatedDeliveryMinutes?: number;
  outForDeliveryAt?: Date | any;
  readyAt?: Date | any;
  confirmedAt?: Date | any;
  cancelledAt?: Date | any;
  ratings?: Record<string, { rating: number; comment: string; ratedAt: Date }>;
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
  password?: string;
  avatar?: string;
  rating: number;
  averageRating?: number; // alias for rating
  vehicle: string;
  vehicleNumber: string;
  status: 'online' | 'offline' | 'on_delivery';
  isAvailable?: boolean; // Helper sync with status
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  createdAt: Date;
  // Verification fields
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  kycStatus?: 'pending' | 'approved' | 'rejected';
  isVerified?: boolean;
  kycApprovedAt?: any;
  kycSubmittedAt?: any;
  rejectionReason?: string;
  vehicleImage?: string;
  drivingLicense?: string;
  bankDetails?: {
    bankName: string;
    holderName: string;
    accountNumber: string;
    ifscCode: string;
  };
  walletBalance?: number; // Positive = Debt (Cash in Hand), Negative = Earnings
  servicePincodes?: string[];
  pincodeFilterActive?: boolean;
}

// Alias for admin panel
export type DeliveryPartner = DeliveryPerson & {
  isAvailable?: boolean;
  vehicleType?: string;
  vehicleNumber?: string;
  completedDeliveries?: number;
};

// GPS Live Location (stored in driverLocations/{driverId})
export interface DriverLocation {
  driverId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number; // km/h
  heading: number; // degrees from north
  isOnline: boolean;
  activeOrderId?: string;
  updatedAt: any; // serverTimestamp
}

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
  ticketId?: string;
  userId?: string;
  userName?: string;
  userType?: 'admin' | 'restaurant' | 'customer' | 'delivery' | string;
  sender?: 'customer' | 'support' | 'admin' | 'ai' | string;
  senderName?: string;
  text?: string;
  message?: string;
  createdAt?: any;
  timestamp?: any;
}

export interface SupportTicket {
  id?: string;
  userId?: string;
  customerId?: string;
  userType?: 'customer' | 'restaurant' | 'delivery' | string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  orderId?: string;
  subject: string;
  category?: 'order' | 'refund' | 'payment' | 'delivery' | 'food_quality' | 'account' | 'technical' | 'billing' | 'feature' | 'other' | string;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | string;
  description: string;
  message?: string;
  status: 'open' | 'in_progress' | 'in-progress' | 'resolved' | 'closed' | 'rejected' | string;
  attachments?: string[];
  adminResponse?: string;
  replies?: TicketReply[];
  createdAt: any;
  updatedAt?: any;
  resolvedAt?: any;
  closedAt?: any;
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



export interface WalletTransaction {
  id: string;
  customerId: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'payment' | 'refund' | 'bonus';
  status: 'pending' | 'completed' | 'failed';
  referenceId?: string; // Order ID or Payment ID
  description: string;
  createdAt: Date;
}

export interface CustomerWithdrawalRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  bankDetails: {
    accountHolderName: string;
    accountNumber: string;
    bankName: string;
    ifscCode: string;
  };
  rejectionReason?: string;
  createdAt: Date;
  processedAt?: Date;
}

export interface MembershipRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  contactNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  address?: Address; // Optional snapshot of address
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
  };
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
}

export interface IssuedCard {
  id: string;
  customerId: string;
  customerName: string;
  cardNumber: string;
  expiryDate: Date;
  cvv: string;
  status: 'active' | 'blocked' | 'expired';
  issuedAt: Date;
  issuedBy?: string;
  tier?: string;
  cardType?: string;
  balance?: number;
  updatedAt?: Date;
}

export interface DealItem {
  id: string;
  code: string;
  title: string;
  description: string;
  emoji?: string;
  discountType: 'percentage' | 'flat' | 'fixed' | 'free_delivery';
  discountValue: number;
  minOrder?: number;
  maxDiscount?: number;
  category?: string;
  isActive: boolean;
  validUntil?: string;
  createdAt?: any;
  usageCount?: number;
}

export interface RedeemCodeItem {
  id: string;
  code: string;
  type: 'points' | 'wallet' | 'discount';
  value: number;
  description?: string;
  maxRedemptions?: number;
  redemptionCount?: number;
  isActive: boolean;
  expiresAt?: string;
  createdAt?: any;
}

export { generateProfessionalOrderId, formatOrderId } from './order-utils';
