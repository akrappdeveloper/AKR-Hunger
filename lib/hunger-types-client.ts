/**
 * Hunger Types — Client-safe re-exports
 * =======================================
 * This file re-exports types from hunger-types.ts for use in
 * client components (no server-only imports).
 */

export type {
  GroupOrder,
  GroupMember,
  GroupMemberCartItem,
  StudentProfile,
  StudentDeal,
  MealPlan,
  MealPlanItem,
  Subscription,
  SubscriptionMealEntry,
  DeliveryPromise,
  DeliveryPromiseConfig,
  HungerCircle,
  CircleMember,
  CircleAddress,
  FoodProof,
  RestaurantQualityScore,
  HungerWallet,
  EnhancedWalletTransaction,
  RewardAccount,
  RewardTransaction,
  RewardConfig,
  AIRequestRecord,
  PartnerEarningsStats,
  FairRouteScore,
} from './hunger-types';

export type { MealIntent, AIConfig } from './ai-gateway';
