import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'today';

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(now.getMonth() - 1);
    }

    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('status', '==', 'delivered'),
      where('createdAt', '>=', startDate)
    );

    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map((doc) => doc.data());

    // Calculate earnings
    const totalEarnings = orders.reduce((sum, order) => sum + (order.deliveryCharge || 0), 0);
    const avgRating = 4.8; // Mock value
    const onTimeRate = 96; // Mock value
    const completedToday = orders.filter(o => {
      const orderDate = new Date(o.createdAt?.toDate?.() || o.createdAt);
      const today = new Date();
      return orderDate.toDateString() === today.toDateString();
    }).length;

    const earnings = {
      today: period === 'today' ? totalEarnings : 0,
      week: period === 'week' ? totalEarnings : 0,
      month: period === 'month' ? totalEarnings : 0,
      totalDeliveries: orders.length,
      avgRating,
      onTimeRate,
      completedToday,
      earnings: generateDailyEarnings(orders, period),
    };

    return NextResponse.json({ earnings }, { status: 200 });
  } catch (error) {
    console.error('[v0] Error fetching earnings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch earnings' },
      { status: 500 }
    );
  }
}

function generateDailyEarnings(orders: any[], period: string) {
  const result = [];
  const now = new Date();

  for (let i = 0; i < (period === 'today' ? 24 : period === 'week' ? 7 : 30); i++) {
    const date = new Date(now);
    if (period === 'today') {
      date.setHours(now.getHours() - i);
    } else {
      date.setDate(date.getDate() - i);
    }

    const amount = Math.random() * 100;
    const label = period === 'today' ? date.getHours() + ':00' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    result.push({ date: label, amount });
  }

  return result.reverse();
}
