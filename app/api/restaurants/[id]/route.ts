import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const restaurantId = params.id;

    // Fetch restaurant details
    const restaurantRef = doc(db, 'restaurants', restaurantId);
    const restaurantDoc = await getDoc(restaurantRef);

    if (!restaurantDoc.exists()) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      );
    }

    // Fetch menu items for this restaurant
    const menuItemsRef = collection(db, 'menuItems');
    const menuItemsQuery = query(
      menuItemsRef,
      where('restaurantId', '==', restaurantId),
      where('approvalStatus', '==', 'approved'),
      where('isLive', '==', true)
    );
    const menuItemsSnapshot = await getDocs(menuItemsQuery);
    const menuItems = menuItemsSnapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));

    return NextResponse.json({
      restaurant: { ...restaurantDoc.data(), id: restaurantDoc.id },
      menuItems,
    });
  } catch (error) {
    console.error('[v0] Error fetching restaurant details:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: 'Failed to fetch restaurant details' },
      { status: 500 }
    );
  }
}
