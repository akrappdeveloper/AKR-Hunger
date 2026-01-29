import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sortBy = searchParams.get('sortBy') || 'distance';

    const ordersRef = collection(db, 'orders');
    
    // Fetch orders ready for delivery (no delivery person assigned yet)
    const q = query(
      ordersRef,
      where('status', '==', 'ready'),
      where('deliveryPersonId', '==', null),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    let orders = snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));

    // Sort based on preference
    if (sortBy === 'earning') {
      orders.sort((a, b) => (b.deliveryCharge || 0) - (a.deliveryCharge || 0));
    } else if (sortBy === 'time') {
      orders.sort((a, b) => (a.estimatedDeliveryTime || 0) - (b.estimatedDeliveryTime || 0));
    }

    return NextResponse.json({ orders }, { status: 200 });
  } catch (error) {
    console.error('[v0] Error fetching available orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available orders' },
      { status: 500 }
    );
  }
}
