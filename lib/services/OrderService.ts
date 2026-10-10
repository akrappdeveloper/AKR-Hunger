import { collection, doc, getDoc, getDocs, updateDoc, deleteDoc, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order } from '@/lib/types';

const COLLECTION_NAME = 'orders';

export class OrderService {
  /**
   * Fetch all orders
   */
  static async getAllOrders(): Promise<Order[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
  }

  /**
   * Listen to all orders for real-time updates
   */
  static listenAllOrders(callback: (orders: Order[]) => void, onError: (error: Error) => void) {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      callback(data);
    }, onError);
  }

  /**
   * Fetch a single order by ID
   */
  static async getOrderById(id: string): Promise<Order | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Order;
    }
    return null;
  }

  /**
   * Update an order's status
   */
  static async updateOrderStatus(id: string, newStatus: Order['status']): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      status: newStatus,
      updatedAt: new Date()
    });
  }

  /**
   * Update entire order details
   */
  static async updateOrder(id: string, updates: Partial<Order>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date()
    });
  }

  /**
   * Delete an order
   */
  static async deleteOrder(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }

  /**
   * Fetch active orders (e.g. pending, preparing, out_for_delivery)
   */
  static async getActiveOrders(): Promise<Order[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('status', 'in', ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery']),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
  }
}
