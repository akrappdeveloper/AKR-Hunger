import { NextRequest, NextResponse } from 'next/server';
import { processCampaignSchedules } from '@/lib/campaigns/lifecycle-engine';

async function runScheduler(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  if (configuredSecret) {
    const provided =
      request.headers.get('x-cron-secret') ||
      request.headers.get('authorization')?.replace('Bearer ', '');
    if (provided !== configuredSecret) {
      return NextResponse.json({ error: 'Unauthorized cron trigger' }, { status: 401 });
    }
  }

  const summary = await processCampaignSchedules(true);
  return NextResponse.json({
    success: true,
    executedAt: new Date().toISOString(),
    summary,
  });
}

export async function GET(request: NextRequest) {
  return runScheduler(request);
}

export async function POST(request: NextRequest) {
  return runScheduler(request);
}
