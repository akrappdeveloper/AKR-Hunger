import { collection, doc, getDoc, getDocs, updateDoc, setDoc, query, orderBy, onSnapshot, where, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RiderWalletTransaction, WithdrawalRequest, CodSettlementRequest, Payment, WalletTransaction } from '@/lib/types';

export class FinanceService {
  /**
   * Fetch all withdrawal requests from delivery partners
   */
  static async getWithdrawalRequests(): Promise<WithdrawalRequest[]> {
    const q = query(collection(db, 'withdrawalRequests'), orderBy('requestedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithdrawalRequest));
  }

  static listenWithdrawalRequests(callback: (requests: WithdrawalRequest[]) => void) {
    const q = query(collection(db, 'withdrawalRequests'), orderBy('requestedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithdrawalRequest)));
    });
  }

  /**
   * Process a withdrawal request (approve/reject)
   */
  static async processWithdrawal(id: string, status: 'COMPLETED' | 'FAILED', failureReason?: string, adminReference?: string): Promise<void> {
    const docRef = doc(db, 'withdrawalRequests', id);
    const updates: Partial<WithdrawalRequest> = {
      status,
      processedAt: new Date(),
    };
    if (failureReason) updates.failureReason = failureReason;
    if (adminReference) updates.adminReference = adminReference;

    await updateDoc(docRef, updates);
  }

  /**
   * Fetch all restaurant payments/settlements
   */
  static listenRestaurantPayments(callback: (payments: Payment[]) => void) {
    const q = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    });
  }

  /**
   * Fetch customer wallet transactions
   */
  static listenCustomerWallet(callback: (transactions: WalletTransaction[]) => void) {
    const q = query(collection(db, 'walletTransactions'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WalletTransaction)));
    });
  }

  /**
   * Process customer wallet recharge/deduction
   */
  static async addWalletTransaction(customerId: string, amount: number, type: 'deposit' | 'withdrawal' | 'bonus', description: string): Promise<void> {
    const newTx = {
      customerId,
      amount,
      type,
      status: 'completed',
      description,
      createdAt: new Date(),
    };
    await addDoc(collection(db, 'walletTransactions'), newTx);

    // Update customer balance (would ideally be done via Cloud Functions or transactions in production)
    const custRef = doc(db, 'customers', customerId);
    const custSnap = await getDoc(custRef);
    if (custSnap.exists()) {
      const currentBalance = custSnap.data().walletBalance || 0;
      const newBalance = type === 'withdrawal' ? currentBalance - amount : currentBalance + amount;
      await updateDoc(custRef, { walletBalance: newBalance });
    }
  }
}
