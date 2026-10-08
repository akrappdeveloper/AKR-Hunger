import { NextRequest, NextResponse } from 'next/server';
import { lockGroupOrder } from '@/lib/group-order-service';

export async function POST(request: NextRequest) {
  try {
    const { groupId, hostId } = await request.json();
    if (!groupId || !hostId) {
      return NextResponse.json({ error: 'Missing groupId or hostId' }, { status: 400 });
    }
    await lockGroupOrder(groupId, hostId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to lock group' }, { status: 500 });
  }
}
