import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin-db';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, query, where, limit, serverTimestamp } from 'firebase/firestore';

function toSeconds(val: any): number {
  if (!val) return 0;
  if (typeof val?.seconds === 'number') return val.seconds;
  if (typeof val?.toDate === 'function') return Math.floor(val.toDate().getTime() / 1000);
  const ms = new Date(val).getTime();
  return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const restaurantId = searchParams.get('restaurantId');

    let videoDocs: any[] = [];
    let menuDocs: any[] = [];
    const restaurantMap = new Map<string, { name: string; image: string }>();

    if (adminDb) {
      const [vSnap, mSnap, rSnap] = await Promise.all([
        adminDb.collection('videos').where('isActive', '==', true).get(),
        adminDb.collection('menuItems').get(),
        adminDb.collection('restaurants').get(),
      ]);
      rSnap.docs.forEach((d) => {
        const rd = d.data() || {};
        restaurantMap.set(d.id, {
          name: rd.name || rd.restaurantName || 'Restaurant Partner',
          image: rd.image || '/hunger.png',
        });
      });
      videoDocs = vSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      menuDocs = mSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } else {
      const [vSnap, mSnap, rSnap] = await Promise.all([
        getDocs(query(collection(db, 'videos'), where('isActive', '==', true), limit(50))),
        getDocs(query(collection(db, 'menuItems'), limit(200))),
        getDocs(query(collection(db, 'restaurants'), limit(100))),
      ]);
      rSnap.docs.forEach((d) => {
        const rd = d.data() as any;
        restaurantMap.set(d.id, {
          name: rd.name || rd.restaurantName || 'Restaurant Partner',
          image: rd.image || '/hunger.png',
        });
      });
      videoDocs = vSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      menuDocs = mSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    const seenVideoUrls = new Set<string>();
    const combined: any[] = [];

    // 1. Add uploaded videos/stories from `videos` collection
    videoDocs.forEach((v) => {
      if (!v.restaurantId) return;
      if (restaurantId && v.restaurantId !== restaurantId) return;
      if (type === 'story' && v.type !== 'story') return;

      const restInfo = restaurantMap.get(v.restaurantId);
      const videoUrl = typeof v.videoUrl === 'string' ? v.videoUrl.trim() : '';
      if (videoUrl) seenVideoUrls.add(`${v.restaurantId}::${videoUrl}`);

      combined.push({
        ...v,
        restaurantName: v.restaurantName || restInfo?.name || 'Restaurant Partner',
        restaurantImage: v.restaurantImage || restInfo?.image || '/hunger.png',
        source: 'video',
      });
    });

    // 2. Include menu item videos (when type !== 'story')
    if (type !== 'story') {
      menuDocs.forEach((item) => {
        if (!item.restaurantId) return;
        if (restaurantId && item.restaurantId !== restaurantId) return;
        const approved = !item.approvalStatus || item.approvalStatus === 'approved';
        const available = item.available !== false && item.isAvailable !== false;
        const notDeleted = item.deleted !== true && item.isDeleted !== true;
        if (!approved || !available || !notDeleted) return;

        const urls: string[] = Array.from(
          new Set(
            [
              ...(Array.isArray(item.videos) ? item.videos : []),
              ...(item.videoUrl ? [item.videoUrl] : []),
              ...(item.video ? [item.video] : []),
            ].filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
          )
        );

        const restInfo = restaurantMap.get(item.restaurantId);
        urls.forEach((url, idx) => {
          const dedupKey = `${item.restaurantId}::${url}`;
          if (seenVideoUrls.has(dedupKey)) return;
          seenVideoUrls.add(dedupKey);

          combined.push({
            id: `menu_${item.id}_${idx}`,
            menuItemId: item.id,
            price: Number(item.price || 0),
            category: item.category || '',
            restaurantId: item.restaurantId,
            restaurantName: restInfo?.name || 'Restaurant Partner',
            restaurantImage: restInfo?.image || '/hunger.png',
            title: item.name || 'Chef Special Dish',
            description: item.description || `${item.name || 'Dish'} showcase video`,
            videoUrl: url,
            thumbnailUrl: item.image || (Array.isArray(item.images) ? item.images[0] : '') || restInfo?.image || '',
            imageUrl: item.image || '',
            type: 'menu_video',
            views: Number(item.views || 0),
            likes: Number(item.likes || 0),
            isActive: true,
            createdAt: item.updatedAt || item.createdAt || null,
            source: 'menu_item',
          });
        });
      });
    }

    combined.sort((a, b) => toSeconds(b.createdAt) - toSeconds(a.createdAt));

    return NextResponse.json({ videos: combined.slice(0, 80) });
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
