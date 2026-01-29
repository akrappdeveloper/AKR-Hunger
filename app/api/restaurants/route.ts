import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const restaurantsRef = collection(db, 'restaurants');
    const restaurantsQuery = query(restaurantsRef, orderBy('rating', 'desc'));
    const snapshot = await getDocs(restaurantsQuery);

    const restaurants = snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));

    return NextResponse.json({ restaurants });
  } catch (error) {
    console.error('[v0] Error fetching restaurants from API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch restaurants' },
      { status: 500 }
    );
  }
}
