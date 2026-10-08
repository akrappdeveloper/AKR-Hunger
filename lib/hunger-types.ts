/**
 * Hunger Feature Types Extensions
 * ================================
 * Additional types for new Hunger platform features:
 * - Group Orders & Split Payment
 * - Student Mode
 * - Meal Subscriptions
 * - Delivery Promise
 * - Hunger Circle (Family Groups)
 * - Real Food Proof
 * - Hunger Wallet (enhanced)
 * - Hunger Rewards
 * - AI Observability
 */

// ─────────────────────────────────────────────────────────────────────────────
// GROUP ORDER & SPLIT PAYMENT
// ─────────────────────────────────────────────────────────────────────────────

export interface GroupOrder {
  id: string;
  hostId: string;
  hostName: string;
  restaurantId: string;
  restaurantName: string;
  inviteCode: string;        // 6-char alphanumeric code
  inviteLink: string;        // full URL
  qrCodeData?: string;       // QR code payload
  status: 'open' | 'locked' | 'placed' | 'cancelled';
  deadline?: Date;           // Optional ordering deadline
  members: GroupMember[];
  combinedOrderId?: string;  // Final order ID placed with restaurant
  totalAmount?: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface GroupMember {
  userId: string;
  name: string;
  avatar?: string;
  isHost: boolean;
  joinedAt: Date;
  items: GroupMemberCartItem[];
  subtotal: number;
  paymentStatus: 'pending' | 'paid' | 'split';
  paymentAmount?: number;
  paymentId?: string;        // Razorpay payment ID
}

export interface GroupMemberCartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  specialInstructions?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT MODE
// ─────────────────────────────────────────────────────────────────────────────

export interface StudentProfile {
  id: string;
  customerId: string;
  collegeName: string;
  collegeId?: string;         // Uploaded ID card URL
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'unverified';
  verifiedAt?: Date;
  expiresAt?: Date;           // Verification expiry (usually 1 year)
  hostelAddress?: string;
  hostelPincode?: string;
  budgetCap?: number;         // Self-imposed daily spending limit
  enabledAt: Date;
}

export interface StudentDeal {
  id: string;
  title: string;
  description: string;
  priceCategory: '99' | '149' | '199';  // Budget categories
  restaurantId?: string;
  menuItemIds: string[];
  discount: number;           // % off
  isActive: boolean;
  availableFrom?: string;     // e.g. "18:00"
  availableTo?: string;       // e.g. "02:00" (late night)
  days?: string[];            // ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
  validUntil: Date;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// MEAL SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface MealPlan {
  id: string;
  restaurantId: string;
  restaurantName: string;
  title: string;              // e.g. "Student Lunch Plan"
  description: string;
  planType: 'lunch' | 'dinner' | 'lunch_dinner' | 'office' | 'custom';
  mealsPerDay: number;        // 1 or 2
  daysPerWeek: number;        // 5, 6, or 7
  pricePerMonth: number;
  totalMealsPerMonth: number;
  items: MealPlanItem[];      // What's included
  isActive: boolean;
  createdAt: Date;
}

export interface MealPlanItem {
  menuItemId?: string;
  name: string;
  description?: string;
}

export interface Subscription {
  id: string;
  customerId: string;
  restaurantId: string;
  planId: string;
  planTitle: string;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  startDate: Date;
  endDate: Date;
  pricePerMonth: number;
  mealsRemaining: number;
  mealsTaken: number;
  totalMeals: number;
  deliveryAddress: string;
  pausedUntil?: Date;
  skippedDates?: string[];    // ISO date strings
  holidayPauseDates?: string[];
  renewalReminder: boolean;
  mealHistory: SubscriptionMealEntry[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface SubscriptionMealEntry {
  date: string;               // ISO date string
  mealType: 'lunch' | 'dinner';
  orderId?: string;
  status: 'delivered' | 'skipped' | 'paused' | 'missed';
}

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY PROMISE
// ─────────────────────────────────────────────────────────────────────────────

export interface DeliveryPromise {
  orderId: string;
  estimatedMinutes: number;
  guaranteedMinutes?: number;   // If admin enables guaranteed delivery
  promisedBy?: Date;
  restaurantPrepMinutes: number;
  riderDistanceMinutes: number;
  trafficBuffer: number;
  isGuaranteed: boolean;
  compensationAmount?: number;  // ₹ wallet credit if breached
  status: 'active' | 'breached' | 'fulfilled' | 'expired';
  breachedAt?: Date;
  compensationIssued?: boolean;
}

export interface DeliveryPromiseConfig {
  enableGuarantee: boolean;
  gracePeriodMinutes: number;   // Extra time before "breach"
  compensationRupees: number;   // e.g. ₹20
  maxDailyCompensationPerUser: number;
  maxDailyCompensationTotal: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HUNGER CIRCLE (Family/Friend Groups)
// ─────────────────────────────────────────────────────────────────────────────

export interface HungerCircle {
  id: string;
  ownerId: string;
  name: string;               // e.g. "Aman Family"
  members: CircleMember[];
  sharedWallet?: {
    enabled: boolean;
    balance: number;
    contributionRules?: string;
  };
  savedAddresses: CircleAddress[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface CircleMember {
  userId: string;
  name: string;
  phone?: string;
  avatar?: string;
  role: 'owner' | 'member';
  isHost?: boolean;
  foodPreferences?: {
    vegetarian?: boolean;
    allergies?: string[];
    favoriteCuisines?: string[];
  };
  defaultAddressId?: string;
  canOrderForOthers: boolean;
  notifyOnOrder: boolean;
  joinedAt: Date;
}

export interface CircleAddress {
  id: string;
  memberId: string;
  memberName: string;
  label: string;              // e.g. "Aman's Hostel"
  address: string;
  latitude: number;
  longitude: number;
  pincode: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// REAL FOOD PROOF
// ─────────────────────────────────────────────────────────────────────────────

export interface FoodProof {
  id: string;
  orderId: string;
  customerId: string;
  restaurantId: string;
  menuItemId?: string;
  customerPhotoUrl: string;   // Uploaded by customer
  restaurantPhotoUrl?: string; // Restaurant's menu photo for comparison
  portionFeedback: 'too_less' | 'normal' | 'generous';
  packagingFeedback: 'poor' | 'acceptable' | 'excellent';
  tasteFeedback: 'disappointing' | 'okay' | 'great';
  missingItems?: string[];
  additionalNotes?: string;
  isVerified?: boolean;        // Admin/CV model verified
  flagged?: boolean;           // Inappropriate or duplicate
  cvScore?: number;            // Local CV quality score 0-1
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESTAURANT QUALITY SCORE
// ─────────────────────────────────────────────────────────────────────────────

export interface RestaurantQualityScore {
  restaurantId: string;
  // Component scores (0-5 scale)
  foodQuality: number;
  packagingScore: number;
  portionScore: number;
  orderAccuracy: number;
  deliveryScore: number;
  // Operational metrics
  cancellationRate: number;   // %
  avgPrepTime: number;        // minutes
  complaintRate: number;      // %
  // Overall
  overallScore: number;       // Weighted 0-5
  scoreGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  totalOrdersFactored: number;
  lastCalculated: Date;
  // Trend
  previousScore?: number;
  trend?: 'up' | 'down' | 'stable';
}

// ─────────────────────────────────────────────────────────────────────────────
// HUNGER WALLET (Enhanced)
// ─────────────────────────────────────────────────────────────────────────────

export interface HungerWallet {
  id?: string;
  customerId: string;
  balance: number;
  cashBalance?: number;        // From deposits / withdrawals
  refundBalance?: number;      // From refunds (follows payment rules)
  promoBalance?: number;       // From coupons, referrals, compensation
  totalBalance?: number;
  currency?: 'INR';
  isActive?: boolean;
  autoTopUpEnabled?: boolean;
  autoTopUpThreshold?: number;
  autoTopUpAmount?: number;
  createdAt?: Date;
  updatedAt?: Date;
  lastUpdated?: Date;
}

export interface EnhancedWalletTransaction {
  id: string;
  customerId: string;
  bucket?: 'cash' | 'refund' | 'promo';
  amount: number;             // Positive = credit, Negative = debit
  type: 'deposit' | 'refund' | 'promo_credit' | 'referral' | 'compensation' | 'payment' | 'cashback' | 'withdrawal' | 'expiry' | 'topup' | 'debit' | 'bonus' | 'transfer';
  description: string;
  orderId?: string;
  sourceId?: string;
  referenceId?: string;
  expiresAt?: Date;           // For promo credits
  balanceBefore?: number;
  balanceAfter: number;
  status?: 'completed' | 'pending' | 'failed' | 'reversed';
  metadata?: Record<string, any>;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// HUNGER REWARDS (Points)
// ─────────────────────────────────────────────────────────────────────────────

export interface RewardAccount {
  id?: string;
  customerId: string;
  points: number;
  lifetimePoints: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  totalOrders?: number;
  lastEarnedAt?: Date;
  lastRedeemedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RewardTransaction {
  id: string;
  customerId: string;
  type: 'earn' | 'redeem' | 'expire' | 'bonus' | 'earned_order' | 'earned_referral' | 'earned_review' | 'earned_bonus' | 'redeemed' | 'expired';
  points: number;
  pointsAfter?: number;
  reason?: 'order' | 'review' | 'referral' | 'group_order' | 'subscription' | 'discovery' | 'birthday' | 'streak' | 'admin' | string;
  description?: string;
  orderId?: string;
  sourceId?: string;
  expiresAt?: Date;
  createdAt: Date;
}

export interface RewardConfig {
  pointsPerRupee: number;
  redemptionRate: number;
  minRedemptionPoints: number;
  maxRedemptionPercent: number;
  referralBonus: number;
  reviewBonus: number;
  groupOrderBonus: number;
  orderBonus?: number;
  milestoneBonus?: {
    ordersCount: number;
    bonusPoints: number;
  };
  pointsPerOrder?: number;
  reviewPoints?: number;
  referralPoints?: number;
  subscriptionBonus?: number;
  discoveryPoints?: number;
  pointsToRupees?: number;
  maxRedemptionPerOrder?: number;
  expiryDays?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI OBSERVABILITY
// ─────────────────────────────────────────────────────────────────────────────

export interface AIRequestRecord {
  id?: string;
  feature: 'smart_meal' | 'semantic_search' | 'menu_description' | 'support' | 'recommendation' | 'voice' | 'restaurant_assistant';
  userId?: string;
  userType?: 'customer' | 'restaurant' | 'admin';
  mode: 'ai' | 'rule' | 'normal';
  provider?: string;
  model?: string;
  latencyMs: number;
  success: boolean;
  fallbackReason?: string;
  tokenCount?: number;
  userFeedback?: 'helpful' | 'not_helpful';
  timestamp?: Date;
  createdAt?: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY PARTNER FAIRNESS
// ─────────────────────────────────────────────────────────────────────────────

export interface PartnerEarningsStats {
  partnerId: string;
  date: string;               // YYYY-MM-DD
  // Orders
  totalOrders: number;
  completedOrders: number;
  // Earnings
  baseEarnings: number;
  bonusEarnings: number;
  incentives: number;
  totalEarnings: number;
  pendingSettlement: number;
  // Distance & Time
  totalDistanceKm: number;
  totalTimeMinutes: number;
  waitingTimeMinutes: number;
  // Efficiency
  earningsPerKm: number;
  earningsPerHour: number;
  fairRouteScore: number;      // 0-100 (higher = more fair routes)
  // Rating
  averageRating: number;
  // Breakdown
  avgOrderValue: number;
}

export interface FairRouteScore {
  orderId: string;
  partnerId: string;
  pickupDistanceKm: number;
  dropDistanceKm: number;
  totalDistanceKm: number;
  estimatedTimeMin: number;
  earningsForRoute: number;
  earningsPerKm: number;
  fairScore: number;          // 0-100
  isEfficient: boolean;       // true if above platform average
}


