import { NextRequest, NextResponse } from 'next/server';
import { parseMealIntent } from '@/lib/ai-gateway';
import { createAILogger } from '@/lib/ai-gateway';

const logger = createAILogger();

export async function POST(request: NextRequest) {
  const start = Date.now();

  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string' || query.length > 500) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    // Sanitize input — never send sensitive data to AI
    const sanitized = query
      .replace(/password|token|card|cvv|otp|upi|pin/gi, '')
      .slice(0, 200);

    const { intent, mode } = await parseMealIntent(sanitized);

    logger.log({
      feature: 'smart_meal',
      mode,
      latencyMs: Date.now() - start,
      success: true,
      timestamp: new Date(),
    });

    return NextResponse.json({ intent, mode, query: sanitized });
  } catch (error) {
    logger.log({
      feature: 'smart_meal',
      mode: 'normal',
      latencyMs: Date.now() - start,
      success: false,
      timestamp: new Date(),
    });
    return NextResponse.json({ error: 'Failed to parse intent' }, { status: 500 });
  }
}
