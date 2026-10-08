import { NextRequest, NextResponse } from 'next/server';
import { generateMenuDescription } from '@/lib/ai-gateway';

export async function POST(request: NextRequest) {
  try {
    const { rawInput, restaurantId } = await request.json();

    if (!rawInput || typeof rawInput !== 'string' || rawInput.length > 300) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    if (!restaurantId) {
      return NextResponse.json({ error: 'Restaurant ID required' }, { status: 400 });
    }

    const { result, mode } = await generateMenuDescription(rawInput);

    return NextResponse.json({
      result,
      mode,
      needsApproval: true, // Always require restaurant owner approval
    });
  } catch {
    return NextResponse.json({ error: 'Failed to generate description' }, { status: 500 });
  }
}
