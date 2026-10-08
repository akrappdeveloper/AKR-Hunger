import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, runTransaction, serverTimestamp, collection } from 'firebase/firestore';
import { getRiderEarningSettings } from '@/lib/rider-wallet-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { settlementId, adminId, action, rejectionReason } = body;

    if (!settlementId || !adminId || !action) {
      return NextResponse.json({ error: 'Missing settlementId, adminId, or action' }, { status: 400 });
    }

    const settings = await getRiderEarningSettings();

    const result = await runTransaction(db, async (transaction) => {
      const settlementRef = doc(db, 'codSettlements', settlementId);
      const settlementSnap = await transaction.get(settlementRef);
      if (!settlementSnap.exists()) throw new Error('Settlement record not found');

      const settleData = settlementSnap.data();
      if (settleData.status === 'VERIFIED') throw new Error('Settlement already verified');

      const riderId = settleData.riderId;
      const amount = Number(settleData.amount || 0);
      const riderRef = doc(db, 'deliveryPersons', riderId);
      const riderSnap = await transaction.get(riderRef);
      if (!riderSnap.exists()) throw new Error('Rider profile not found');

      const riderData = riderSnap.data();
      const codLimit = Number(riderData.codLimit || settings.defaultCodLimit);
      const prevCodCollected = Number(riderData.codCollected || 0);
      const prevCodDeposited = Number(riderData.codDeposited || 0);

      if (action === 'APPROVE') {
        const newCodDeposited = prevCodDeposited + amount;
        const newCodOutstanding = Math.max(0, prevCodCollected - newCodDeposited);
        const isCodBlocked = newCodOutstanding >= codLimit;
        const availableEarnings = Number(riderData.availableEarnings || 0);
        const newWalletBalance = availableEarnings - newCodOutstanding;

        // Verify settlement
        transaction.update(settlementRef, {
          status: 'VERIFIED',
          verifiedAt: serverTimestamp(),
          verifiedBy: adminId,
          updatedAt: serverTimestamp(),
        });

        // Update Rider & Auto-unblock if under limit
        transaction.update(riderRef, {
          codDeposited: newCodDeposited,
          codOutstanding: newCodOutstanding,
          codBlocked: isCodBlocked,
          walletBalance: newWalletBalance,
          lastSettlementAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Add ledger record
        const txRef = doc(collection(riderRef, 'walletTransactions'));
        transaction.set(txRef, {
          transactionId: `TX-SETTLE-${Date.now()}`,
          riderId,
          type: 'COD_SETTLEMENT',
          amount,
          direction: 'CREDIT',
          status: 'COMPLETED',
          createdAt: serverTimestamp(),
          description: `Admin Verified COD Deposit ₹${amount} (Approved by ${adminId})`,
          isDebit: false,
        });

        return { status: 'VERIFIED', unblocked: !isCodBlocked, codOutstanding: newCodOutstanding };
      } else {
        // REJECT
        transaction.update(settlementRef, {
          status: 'FAILED',
          rejectionReason: rejectionReason || 'Rejected by Admin',
          rejectedAt: serverTimestamp(),
          rejectedBy: adminId,
          updatedAt: serverTimestamp(),
        });

        return { status: 'FAILED' };
      }
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[API Admin Settlements] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
