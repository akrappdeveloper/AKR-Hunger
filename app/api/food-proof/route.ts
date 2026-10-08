import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      orderId, restaurantId, menuItemId,
      customerPhotoUrl, portionFeedback,
      packagingFeedback, tasteFeedback,
      missingItems, additionalNotes,
    } = body;

    if (!orderId || !restaurantId || !customerPhotoUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate feedback values
    const validPortion = ['too_less', 'normal', 'generous'];
    const validPackaging = ['poor', 'acceptable', 'excellent'];
    const validTaste = ['disappointing', 'okay', 'great'];

    if (!validPortion.includes(portionFeedback) ||
        !validPackaging.includes(packagingFeedback) ||
        !validTaste.includes(tasteFeedback)) {
      return NextResponse.json({ error: 'Invalid feedback values' }, { status: 400 });
    }

    const proof = {
      orderId,
      restaurantId,
      menuItemId: menuItemId || null,
      customerPhotoUrl,
      portionFeedback,
      packagingFeedback,
      tasteFeedback,
      missingItems: Array.isArray(missingItems) ? missingItems.slice(0, 10) : [],
      additionalNotes: typeof additionalNotes === 'string' ? additionalNotes.slice(0, 500) : '',
      isVerified: false,
      flagged: false,
      createdAt: new Date().toISOString(),
    };

    await adminDb.collection('foodProofs').add(proof);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Food proof error:', error);
    return NextResponse.json({ error: 'Failed to submit food proof' }, { status: 500 });
  }
}
