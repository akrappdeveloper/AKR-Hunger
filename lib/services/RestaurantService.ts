import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, DocumentSnapshot, QuerySnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Restaurant, MenuItem, Review } from '@/lib/types';

const COLLECTION_NAME = 'restaurants';
const MENU_COLLECTION = 'menuItems';
const REVIEWS_COLLECTION = 'reviews';

export class RestaurantService {
  /**
   * Fetch all restaurants
   */
  static async getAllRestaurants(): Promise<Restaurant[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Restaurant));
  }

  /**
   * Listen to all restaurants for real-time updates
   */
  static listenAllRestaurants(callback: (restaurants: Restaurant[]) => void, onError: (error: Error) => void) {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Restaurant));
      callback(data);
    }, onError);
  }

  /**
   * Fetch a single restaurant by ID
   */
  static async getRestaurantById(id: string): Promise<Restaurant | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Restaurant;
    }
    return null;
  }

  /**
   * Create a new restaurant
   */
  static async createRestaurant(restaurant: Omit<Restaurant, 'id'>): Promise<string> {
    const newDocRef = doc(collection(db, COLLECTION_NAME));
    await setDoc(newDocRef, {
      ...restaurant,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return newDocRef.id;
  }

  /**
   * Update an existing restaurant
   */
  static async updateRestaurant(id: string, updates: Partial<Restaurant>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date()
    });
  }

  /**
   * Delete a restaurant
   */
  static async deleteRestaurant(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }

  /**
   * Toggle restaurant active status
   */
  static async toggleStatus(id: string, currentStatus: boolean): Promise<void> {
    return this.updateRestaurant(id, { isActive: !currentStatus });
  }

  // ==========================================
  // Menu Related Operations
  // ==========================================

  /**
   * Fetch all menu items for a specific restaurant
   */
  static async getRestaurantMenu(restaurantId: string): Promise<MenuItem[]> {
    const q = query(collection(db, MENU_COLLECTION), where('restaurantId', '==', restaurantId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
  }

  // ==========================================
  // Review Related Operations
  // ==========================================

  /**
   * Fetch all reviews for a specific restaurant
   */
  static async getRestaurantReviews(restaurantId: string): Promise<Review[]> {
    const q = query(collection(db, REVIEWS_COLLECTION), where('restaurantId', '==', restaurantId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
  }

  /**
   * Fetch total review count for a restaurant
   */
  static async getReviewCount(restaurantId: string): Promise<number> {
    const q = query(collection(db, REVIEWS_COLLECTION), where('restaurantId', '==', restaurantId));
    const snapshot = await getDocs(q);
    return snapshot.size;
  }
}
