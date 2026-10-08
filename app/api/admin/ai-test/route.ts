import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { baseUrl, model } = await request.json();

    if (!baseUrl || !model) {
      return NextResponse.json({ error: 'Missing baseUrl or model' }, { status: 400 });
    }

    // Validate URL format
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Test Ollama connection with a simple request
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: 'Hello',
          stream: false,
          options: { num_predict: 5 },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        return NextResponse.json({ connected: true, model });
      } else {
        return NextResponse.json({ connected: false, error: `HTTP ${res.status}` });
      }
    } catch (fetchError: any) {
      clearTimeout(timer);
      return NextResponse.json({
        connected: false,
        error: fetchError.name === 'AbortError' ? 'Timeout — AI server not responding' : 'Connection refused',
      });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
