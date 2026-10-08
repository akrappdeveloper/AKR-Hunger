import { NextRequest, NextResponse } from 'next/server';
import { joinGroupOrder } from '@/lib/group-order-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inviteCode, userId, userName, avatar } = body;

    if (!inviteCode || !userId || !userName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await joinGroupOrder({ inviteCode, userId, userName, avatar });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Join group order error:', error);
    return NextResponse.json({ error: 'Failed to join group order' }, { status: 500 });
  }
}
