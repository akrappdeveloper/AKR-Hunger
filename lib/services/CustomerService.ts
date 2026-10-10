import { collection, doc, getDoc, getDocs, updateDoc, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Customer } from '@/lib/types';

const COLLECTION_NAME = 'customers';

export class CustomerService {
  /**
   * Fetch all customers
   */
  static async getAllCustomers(): Promise<Customer[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
  }

  /**
   * Listen to all customers for real-time updates
   */
  static listenAllCustomers(callback: (customers: Customer[]) => void, onError: (error: Error) => void) {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      callback(data);
    }, onError);
  }

  /**
   * Fetch a single customer by ID
   */
  static async getCustomerById(id: string): Promise<Customer | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Customer;
    }
    return null;
  }

  /**
   * Update a customer
   */
  static async updateCustomer(id: string, updates: Partial<Customer>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date()
    });
  }

  /**
   * Delete a customer
   */
  static async deleteCustomer(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }

  /**
   * Block/Unblock customer
   */
  static async toggleBlockStatus(id: string, currentStatus: boolean): Promise<void> {
    return this.updateCustomer(id, { isBlocked: !currentStatus });
  }
}
