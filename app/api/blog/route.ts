import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const articlesRef = collection(db, 'blogArticles');
    let q;

    if (category) {
      q = query(articlesRef, where('isPublished', '==', true), where('category', '==', category), orderBy('publishedAt', 'desc'), limit(20));
    } else {
      q = query(articlesRef, where('isPublished', '==', true), orderBy('publishedAt', 'desc'), limit(20));
    }

    const snapshot = await getDocs(q);
    const articles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ articles });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
