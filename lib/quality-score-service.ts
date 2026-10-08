/**
 * Restaurant Quality Score Calculator
 * =====================================
 * Transparent, explainable scoring — no AI manipulation.
 * Formula-based scoring from real order data.
 */

import { RestaurantQualityScore } from './hunger-types';

interface QualityInput {
  restaurantId: string;
  // Reviews (0-5 scale)
  avgFoodRating: number;
  avgDeliveryRating: number;
  avgPackagingRating: number;
  avgPortionRating: number;
  // Order metrics
  totalOrders: number;
  cancelledOrders: number;
  accurateOrders: number;      // Orders with no missing/wrong items
  avgPrepTimeMinutes: number;  // Actual prep time
  expectedPrepTimeMinutes: number;
  totalComplaints: number;
  // Historical
  previousScore?: number;
}

const WEIGHTS = {
  foodQuality: 0.30,
  packaging: 0.15,
  portion: 0.10,
  orderAccuracy: 0.20,
  deliveryRating: 0.10,
  cancellationRate: 0.10,
  prepTimeAdherence: 0.05,
};

export function calculateRestaurantQualityScore(input: QualityInput): RestaurantQualityScore {
  const cancellationRate = input.totalOrders > 0
    ? (input.cancelledOrders / input.totalOrders) * 100
    : 0;

  const orderAccuracyRate = input.totalOrders > 0
    ? (input.accurateOrders / (input.totalOrders - input.cancelledOrders || 1)) * 100
    : 100;

  const complaintRate = input.totalOrders > 0
    ? (input.totalComplaints / input.totalOrders) * 100
    : 0;

  // Prep time adherence (1-5 score: 5 = always on time, 1 = very slow)
  const prepRatio = input.expectedPrepTimeMinutes > 0
    ? input.avgPrepTimeMinutes / input.expectedPrepTimeMinutes
    : 1;
  const prepScore = Math.max(1, Math.min(5, 5 - (prepRatio - 1) * 5));

  // Cancellation penalty (1-5 score: 5 = 0% cancellation)
  const cancellationScore = Math.max(1, 5 - (cancellationRate / 5));

  // Order accuracy score (convert % to 1-5)
  const orderAccuracyScore = Math.max(1, (orderAccuracyRate / 100) * 5);

  // Weighted overall score
  const overallScore = parseFloat((
    input.avgFoodRating * WEIGHTS.foodQuality +
    input.avgPackagingRating * WEIGHTS.packaging +
    input.avgPortionRating * WEIGHTS.portion +
    orderAccuracyScore * WEIGHTS.orderAccuracy +
    input.avgDeliveryRating * WEIGHTS.deliveryRating +
    cancellationScore * WEIGHTS.cancellationRate +
    prepScore * WEIGHTS.prepTimeAdherence
  ).toFixed(2));

  // Grade assignment
  let scoreGrade: RestaurantQualityScore['scoreGrade'];
  if (overallScore >= 4.5) scoreGrade = 'A';
  else if (overallScore >= 4.0) scoreGrade = 'B';
  else if (overallScore >= 3.0) scoreGrade = 'C';
  else if (overallScore >= 2.0) scoreGrade = 'D';
  else scoreGrade = 'F';

  // Trend
  let trend: RestaurantQualityScore['trend'] = 'stable';
  if (input.previousScore !== undefined) {
    if (overallScore > input.previousScore + 0.1) trend = 'up';
    else if (overallScore < input.previousScore - 0.1) trend = 'down';
  }

  return {
    restaurantId: input.restaurantId,
    foodQuality: parseFloat(input.avgFoodRating.toFixed(1)),
    packagingScore: parseFloat(input.avgPackagingRating.toFixed(1)),
    portionScore: parseFloat(input.avgPortionRating.toFixed(1)),
    orderAccuracy: parseFloat((orderAccuracyRate / 20).toFixed(1)), // Convert % to 0-5
    deliveryScore: parseFloat(input.avgDeliveryRating.toFixed(1)),
    cancellationRate: parseFloat(cancellationRate.toFixed(1)),
    avgPrepTime: input.avgPrepTimeMinutes,
    complaintRate: parseFloat(complaintRate.toFixed(1)),
    overallScore,
    scoreGrade,
    totalOrdersFactored: input.totalOrders,
    lastCalculated: new Date(),
    previousScore: input.previousScore,
    trend,
  };
}

/** Get explainable score breakdown for display */
export function explainScore(score: RestaurantQualityScore): string[] {
  const explanations: string[] = [];

  if (score.foodQuality >= 4.5) explanations.push('🌟 Exceptional food quality');
  else if (score.foodQuality >= 4.0) explanations.push('✅ Good food quality');
  else if (score.foodQuality < 3.5) explanations.push('⚠️ Food quality needs improvement');

  if (score.cancellationRate > 10) explanations.push('❗ High cancellation rate');
  else if (score.cancellationRate < 2) explanations.push('✅ Very low cancellation rate');

  if (score.orderAccuracy >= 4.5) explanations.push('✅ Excellent order accuracy');
  else if (score.orderAccuracy < 3.5) explanations.push('⚠️ Frequent missing/wrong items');

  if (score.avgPrepTime <= 20) explanations.push('⚡ Fast preparation time');
  else if (score.avgPrepTime > 40) explanations.push('🐌 Slow preparation time');

  return explanations;
}
