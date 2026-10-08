import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminId, riderId, amount, reason, adjustmentType } = body;

    if (!adminId || !riderId || !amount || !reason) {
      return NextResponse.json(
        { error: 'Missing required adjustment parameters (adminId, riderId, amount, reason)' },
        { status: 400 }
      );
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount === 0) {
      return NextResponse.json({ error: 'Adjustment amount cannot be zero' }, { status: 400 });
    }

    const result = await runTransaction(db, async (transaction) => {
      const riderRef = doc(db, 'deliveryPersons', riderId);
      const riderSnap = await transaction.get(riderRef);
      if (!riderSnap.exists()) throw new Error('Rider profile not found');

      const data = riderSnap.data();
      const prevAvailable = Number(data.availableEarnings || 0);
      const newAvailable = Math.max(0, prevAvailable + numAmount);

      // Update Rider available earnings
      transaction.update(riderRef, {
        availableEarnings: newAvailable,
        totalEarnings: Math.max(0, Number(data.totalEarnings || 0) + (numAmount > 0 ? numAmount : 0)),
        updatedAt: serverTimestamp(),
      });

      // Log Financial Audit Ledger in rider's walletTransactions
      const txRef = doc(collection(riderRef, 'walletTransactions'));
      transaction.set(txRef, {
        transactionId: `TX-ADM-${Date.now()}`,
        riderId,
        type: 'ADMIN_ADJUSTMENT',
        amount: Math.abs(numAmount),
        direction: numAmount > 0 ? 'CREDIT' : 'DEBIT',
        balanceBefore: prevAvailable,
        balanceAfter: newAvailable,
        status: 'COMPLETED',
        createdAt: serverTimestamp(),
        description: `Admin Adjustment: ${reason} (by ${adminId})`,
        adminId,
        reason,
      });

      // Log to system admin audit collection
      const auditRef = doc(collection(db, 'adminFinancialAudits'));
      transaction.set(auditRef, {
        adminId,
        riderId,
        amount: numAmount,
        reason,
        adjustmentType: adjustmentType || 'MANUAL_CORRECTION',
        previousBalance: prevAvailable,
        newBalance: newAvailable,
        timestamp: serverTimestamp(),
      });

      return { prevAvailable, newAvailable };
    });

    return NextResponse.json({
      success: true,
      message: `Adjustment of ₹${numAmount} successfully applied with audit record`,
      ...result,
    });
  } catch (err: any) {
    console.error('[API Admin Adjust] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
