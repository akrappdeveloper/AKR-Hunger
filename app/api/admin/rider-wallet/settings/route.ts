import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { DEFAULT_RIDER_EARNING_SETTINGS, getRiderEarningSettings } from '@/lib/rider-wallet-service';

export async function GET() {
  try {
    const settings = await getRiderEarningSettings();
    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const settingsRef = doc(db, 'systemSettings', 'riderEarning');

    const updatedSettings = {
      deliveryChargeRiderShare: Number(body.deliveryChargeRiderShare ?? 80),
      platformShare: Number(body.platformShare ?? 20),
      defaultCodLimit: Number(body.defaultCodLimit ?? 3000),
      allowPrepaidWhenCodBlocked: body.allowPrepaidWhenCodBlocked !== false,
      minWithdrawal: Number(body.minWithdrawal ?? 100),
      maxDailyWithdrawal: Number(body.maxDailyWithdrawal ?? 5000),
      withdrawalProcessingFee: Number(body.withdrawalProcessingFee ?? 0),
      updatedAt: serverTimestamp(),
      updatedBy: body.adminId || 'ADMIN',
    };

    await setDoc(settingsRef, updatedSettings, { merge: true });

    return NextResponse.json({
      success: true,
      message: 'Rider Earning Settings saved successfully',
      settings: updatedSettings,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
