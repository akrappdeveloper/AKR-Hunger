import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/lib/firebase-admin';
import {
  getOrCreateWallet,
  creditWallet,
  debitWallet,
  getWalletTransactions,
  calculateWalletUsage,
} from '@/lib/wallet-service';

async function verifyUser(request: NextRequest): Promise<string | null> {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const decoded = await getAuth(adminApp).verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

// GET /api/wallet — get wallet balance and transactions
export async function GET(request: NextRequest) {
  const uid = await verifyUser(request);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const wallet = await getOrCreateWallet(uid);
    const transactions = await getWalletTransactions(uid, 20);
    return NextResponse.json({ wallet, transactions });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch wallet' }, { status: 500 });
  }
}

// POST /api/wallet — credit wallet (top-up)
export async function POST(request: NextRequest) {
  const uid = await verifyUser(request);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { action, amount, orderId, description, paymentId } = await request.json();

    if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 });

    switch (action) {
      case 'topup': {
        if (!amount || amount < 10 || amount > 10000) {
          return NextResponse.json({ error: 'Amount must be ₹10–₹10,000' }, { status: 400 });
        }
        const result = await creditWallet(
          uid, amount, 'topup',
          `Wallet top-up via payment`,
          paymentId,
          { paymentId }
        );
        return NextResponse.json(result);
      }

      case 'debit': {
        if (!orderId || !amount) {
          return NextResponse.json({ error: 'orderId and amount required' }, { status: 400 });
        }
        const result = await debitWallet(uid, amount, orderId, description || 'Order payment');
        return NextResponse.json(result);
      }

      case 'usage_calc': {
        const wallet = await getOrCreateWallet(uid);
        const usage = calculateWalletUsage(wallet.balance, amount);
        return NextResponse.json(usage);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Wallet operation failed' }, { status: 500 });
  }
}
