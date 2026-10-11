import { NextRequest, NextResponse } from 'next/server';
import { admin, adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, role = 'customer', userId, browserInfo } = body;

    if (!token || !userId) {
      return NextResponse.json(
        { error: 'Token and userId are required', success: false },
        { status: 400 }
      );
    }

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin Firestore not initialized', success: false },
        { status: 500 }
      );
    }

    const updateData: Record<string, any> = {
      fcmToken: token,
      fcmTokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      webPushDevice: {
        browser: browserInfo?.browser || 'Unknown',
        os: browserInfo?.os || 'Unknown',
        userAgent: browserInfo?.userAgent || '',
        updatedAt: new Date().toISOString(),
      },
    };

    // Primary target collection
    let primaryCollection = 'users';
    if (role === 'customer') {
      primaryCollection = 'customers';
    } else if (role === 'restaurant') {
      primaryCollection = 'restaurants';
    } else if (role === 'delivery') {
      primaryCollection = 'deliveryPersons';
    }

    // 1. Save to primary role collection
    try {
      const docRef = adminDb.collection(primaryCollection).doc(userId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        await docRef.update(updateData);
      } else {
        await docRef.set(updateData, { merge: true });
      }
    } catch (e) {
      console.warn(`[save-token] Notice saving to ${primaryCollection}:`, e);
    }

    // 2. Also save to users collection for cross-collection lookup
    try {
      const userRef = adminDb.collection('users').doc(userId);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        await userRef.update(updateData);
      } else {
        await userRef.set(updateData, { merge: true });
      }
    } catch (e) {
      console.warn('[save-token] Notice saving to users:', e);
    }

    // 3. If restaurant, also check if there is a restaurant doc with ownerId == userId
    if (role === 'restaurant') {
      try {
        const ownerSnap = await adminDb
          .collection('restaurants')
          .where('ownerId', '==', userId)
          .limit(1)
          .get();
        if (!ownerSnap.empty) {
          await ownerSnap.docs[0].ref.update(updateData);
        }
      } catch (e) {
        // silent
      }
    }

    return NextResponse.json({
      success: true,
      message: `Token registered for ${role} (${userId})`,
    });
  } catch (error: any) {
    console.error('[save-token] Error persisting token:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save token', success: false },
      { status: 500 }
    );
  }
}
