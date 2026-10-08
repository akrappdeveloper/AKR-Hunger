import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/lib/firebase-admin';
import {
  getOrCreateRewardAccount,
  awardOrderPoints,
  awardReviewPoints,
  redeemPoints,
  calculateRedemption,
  getTierBenefits,
  getNextTierThreshold,
  DEFAULT_REWARD_CONFIG,
} from '@/lib/rewards-service';

async function verifyUser(request: NextRequest): Promise<string | null> {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const decoded = await getAuth(adminApp).verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

// GET /api/rewards — get reward account
export async function GET(request: NextRequest) {
  const uid = await verifyUser(request);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const account = await getOrCreateRewardAccount(uid);
    const benefits = getTierBenefits(account.tier);
    const nextThreshold = getNextTierThreshold(account.tier);

    return NextResponse.json({ account, benefits, nextThreshold });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch rewards' }, { status: 500 });
  }
}

// POST /api/rewards — perform reward actions
export async function POST(request: NextRequest) {
  const uid = await verifyUser(request);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { action, orderId, orderAmount, pointsToRedeem, reviewId } = await request.json();

    switch (action) {
      case 'earn_order': {
        if (!orderId || !orderAmount) {
          return NextResponse.json({ error: 'Missing orderId/orderAmount' }, { status: 400 });
        }
        const result = await awardOrderPoints(uid, orderId, orderAmount);
        return NextResponse.json(result);
      }

      case 'earn_review': {
        if (!reviewId) return NextResponse.json({ error: 'Missing reviewId' }, { status: 400 });
        const result = await awardReviewPoints(uid, reviewId);
        return NextResponse.json(result);
      }

      case 'redeem': {
        if (!pointsToRedeem || !orderId) {
          return NextResponse.json({ error: 'Missing pointsToRedeem/orderId' }, { status: 400 });
        }
        const result = await redeemPoints(uid, pointsToRedeem, orderId);
        return NextResponse.json(result);
      }

      case 'calc_redemption': {
        const account = await getOrCreateRewardAccount(uid);
        const calc = calculateRedemption(
          account.points, orderAmount || 0, DEFAULT_REWARD_CONFIG
        );
        return NextResponse.json(calc);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Rewards operation failed' }, { status: 500 });
  }
}
