import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const restaurantId = searchParams.get('restaurantId');

    let q;
    const videosRef = collection(db, 'videos');

    if (type === 'story') {
      q = query(videosRef, where('type', '==', 'story'), where('isActive', '==', true), orderBy('createdAt', 'desc'), limit(50));
    } else if (restaurantId) {
      q = query(videosRef, where('restaurantId', '==', restaurantId), where('isActive', '==', true), orderBy('createdAt', 'desc'));
    } else {
      q = query(videosRef, where('isActive', '==', true), orderBy('createdAt', 'desc'), limit(30));
    }

    const snapshot = await getDocs(q);
    const videos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ videos });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const videosRef = collection(db, 'videos');

    const videoData = {
      ...body,
      views: 0,
      likes: 0,
      likedBy: [],
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(videosRef, videoData);
    return NextResponse.json({ id: docRef.id, message: 'Video uploaded successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
