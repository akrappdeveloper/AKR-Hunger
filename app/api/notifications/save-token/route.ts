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

    let targetCollection = 'users';
    if (role === 'restaurant') {
      targetCollection = 'restaurants';
    } else if (role === 'delivery') {
      targetCollection = 'deliveryPersons';
    }

    const docRef = adminDb.collection(targetCollection).doc(userId);
    const docSnap = await docRef.get();

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

    if (docSnap.exists) {
      await docRef.update(updateData);
    } else {
      await docRef.set(updateData, { merge: true });
    }

    // Also sync to users collection if delivery or restaurant user exists in both
    if (role !== 'customer') {
      try {
        const userRef = adminDb.collection('users').doc(userId);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
          await userRef.update({
            fcmToken: token,
            fcmTokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (e) {
        // Silent catch for secondary sync
      }
    }

    return NextResponse.json({
      success: true,
      message: `Token registered in ${targetCollection} for user ${userId}`,
    });
  } catch (error: any) {
    console.error('[save-token] Error persisting token:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save token', success: false },
      { status: 500 }
    );
  }
}
