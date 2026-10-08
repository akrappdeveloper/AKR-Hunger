import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, runTransaction, serverTimestamp, collection } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { withdrawalId, adminId, action, failureReason, adminReference } = body;

    if (!withdrawalId || !adminId || !action) {
      return NextResponse.json({ error: 'Missing withdrawalId, adminId, or action' }, { status: 400 });
    }

    const result = await runTransaction(db, async (transaction) => {
      const withdrawalRef = doc(db, 'withdrawals', withdrawalId);
      const withdrawalSnap = await transaction.get(withdrawalRef);
      if (!withdrawalSnap.exists()) throw new Error('Withdrawal record not found');

      const wdrData = withdrawalSnap.data();
      if (wdrData.status === 'COMPLETED') throw new Error('Withdrawal already completed');
      if (wdrData.status === 'FAILED' || wdrData.status === 'CANCELLED') throw new Error('Withdrawal already finalized');

      const riderId = wdrData.riderId;
      const amount = Number(wdrData.amount || 0);
      const riderRef = doc(db, 'deliveryPersons', riderId);
      const riderSnap = await transaction.get(riderRef);
      if (!riderSnap.exists()) throw new Error('Rider profile not found');

      const riderData = riderSnap.data();

      if (action === 'COMPLETE') {
        transaction.update(withdrawalRef, {
          status: 'COMPLETED',
          adminReference: adminReference || `PAYOUT-DONE-${Date.now()}`,
          processedAt: serverTimestamp(),
          processedBy: adminId,
          updatedAt: serverTimestamp(),
        });

        return { status: 'COMPLETED' };
      } else if (action === 'REJECT' || action === 'FAIL') {
        // Refund amount back to Available Earnings!
        const available = Number(riderData.availableEarnings || 0);
        const newAvailable = available + amount;
        const withdrawn = Math.max(0, Number(riderData.withdrawnAmount || 0) - amount);

        transaction.update(riderRef, {
          availableEarnings: newAvailable,
          withdrawnAmount: withdrawn,
          updatedAt: serverTimestamp(),
        });

        transaction.update(withdrawalRef, {
          status: 'FAILED',
          failureReason: failureReason || 'Rejected by Admin payout desk',
          processedAt: serverTimestamp(),
          processedBy: adminId,
          updatedAt: serverTimestamp(),
        });

        // Add Refund Reversal to Ledger (Preserve financial audit trail)
        const txRef = doc(collection(riderRef, 'walletTransactions'));
        transaction.set(txRef, {
          transactionId: `TX-REV-${Date.now()}`,
          riderId,
          type: 'REFUND_ADJUSTMENT',
          amount,
          direction: 'CREDIT',
          balanceBefore: available,
          balanceAfter: newAvailable,
          status: 'COMPLETED',
          createdAt: serverTimestamp(),
          description: `Withdrawal Refund ₹${amount} (Reason: ${failureReason || 'Admin Rejected'})`,
          isDebit: false,
        });

        return { status: 'FAILED', refunded: true, newAvailable };
      }

      throw new Error('Invalid action');
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[API Admin Withdrawals] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
