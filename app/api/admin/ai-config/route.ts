import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const config = await request.json();

    // Validate
    const validProviders = ['ollama', 'llamacpp', 'disabled'];
    if (!validProviders.includes(config.provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    // Save to Firestore admin config
    await adminDb.collection('adminConfig').doc('aiSettings').set({
      ...config,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('AI config save error:', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const snap = await adminDb.collection('adminConfig').doc('aiSettings').get();
    if (snap.exists) {
      return NextResponse.json(snap.data());
    }
    // Return defaults
    return NextResponse.json({
      enabled: true,
      provider: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'qwen',
      maxTokens: 512,
      temperature: 0.3,
      timeoutMs: 8000,
      fallbackMode: 'rule',
      dailyRequestLimit: 10000,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}
