import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { createGroupOrder } from '@/lib/group-order-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hostId, hostName, restaurantId, restaurantName, deadlineMinutes } = body;

    if (!hostId || !hostName || !restaurantId || !restaurantName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const groupOrder = await createGroupOrder({
      hostId,
      hostName,
      restaurantId,
      restaurantName,
      deadlineMinutes: deadlineMinutes || 20,
    });

    return NextResponse.json({ groupOrder });
  } catch (error) {
    console.error('Create group order error:', error);
    return NextResponse.json({ error: 'Failed to create group order' }, { status: 500 });
  }
}
