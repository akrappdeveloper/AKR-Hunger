import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: any;
  createdAt?: string;
}

export interface SearchSuggestion {
  id: string;
  title: string;
  subtitle?: string;
  type: 'dish' | 'restaurant' | 'cuisine' | 'recent' | 'trending';
  imageUrl?: string;
  link: string;
  price?: number;
  rating?: number;
}

const LOCAL_STORAGE_KEY = 'recentSearches_v2';

/**
 * Save search query to Firestore (if logged in) and LocalStorage
 */
export async function recordSearchQuery(term: string, userId?: string | null): Promise<void> {
  const cleanTerm = term.trim();
  if (!cleanTerm) return;

  // 1. Always update LocalStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    const updated = [cleanTerm, ...existing.filter((item) => item.toLowerCase() !== cleanTerm.toLowerCase())].slice(0, 15);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not save search to localStorage:', err);
  }

  // 2. If logged in, save to Firestore customers/{userId}/searchHistory
  if (userId) {
    try {
      const historyCol = collection(db, 'customers', userId, 'searchHistory');
      
      // Avoid immediate duplicate in Firestore
      const recentQuery = query(historyCol, where('query', '==', cleanTerm), limit(1));
      const existingDocs = await getDocs(recentQuery);
      
      if (!existingDocs.empty) {
        // Update timestamp or leave it
        return;
      }

      await addDoc(historyCol, {
        query: cleanTerm,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Could not save search to Firestore:', err);
    }
  }
}

/**
 * Get Search History (from Firestore if logged in, fallback to LocalStorage)
 */
export async function getSearchHistory(userId?: string | null): Promise<SearchHistoryItem[]> {
  // If user is logged in, try fetching from Firestore
  if (userId) {
    try {
      const historyCol = collection(db, 'customers', userId, 'searchHistory');
      const q = query(historyCol, orderBy('timestamp', 'desc'), limit(30));
      const snap = await getDocs(q);

      if (!snap.empty) {
        return snap.docs.map((d) => ({
          id: d.id,
          query: d.data().query || '',
          timestamp: d.data().timestamp,
        }));
      }
    } catch (err) {
      console.warn('Could not read search history from Firestore:', err);
    }
  }

  // Fallback to LocalStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const items: string[] = JSON.parse(raw);
      return items.map((term, i) => ({
        id: `local-${i}`,
        query: term,
        timestamp: null,
      }));
    }
  } catch (err) {
    console.warn('Could not parse local search history:', err);
  }

  return [];
}

/**
 * Delete a single search history item
 */
export async function removeSearchHistoryItem(
  itemId: string,
  queryTerm: string,
  userId?: string | null
): Promise<void> {
  // 1. Remove from LocalStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const existing: string[] = JSON.parse(raw);
      const filtered = existing.filter((t) => t.toLowerCase() !== queryTerm.toLowerCase());
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (err) {
    console.warn('Could not remove item from localStorage:', err);
  }

  // 2. Remove from Firestore
  if (userId && !itemId.startsWith('local-')) {
    try {
      await deleteDoc(doc(db, 'customers', userId, 'searchHistory', itemId));
    } catch (err) {
      console.warn('Could not delete history item from Firestore:', err);
    }
  }
}

/**
 * Clear all search history
 */
export async function clearAllSearchHistory(userId?: string | null): Promise<void> {
  // 1. Clear LocalStorage
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem('recentSearches'); // Also clear legacy key
  } catch (err) {
    console.warn('Could not clear localStorage:', err);
  }

  // 2. Clear Firestore subcollection
  if (userId) {
    try {
      const historyCol = collection(db, 'customers', userId, 'searchHistory');
      const snap = await getDocs(historyCol);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
    } catch (err) {
      console.warn('Could not clear Firestore search history:', err);
    }
  }
}

/**
 * Fetch real-time matching suggestions for dishes and restaurants
 */
export async function getLiveSuggestions(term: string): Promise<SearchSuggestion[]> {
  const cleanTerm = term.trim().toLowerCase();
  if (!cleanTerm || cleanTerm.length < 2) return [];

  const suggestions: SearchSuggestion[] = [];

  try {
    // Search Menu Items
    const menuRef = collection(db, 'menuItems');
    const menuSnap = await getDocs(query(menuRef, limit(80)));

    menuSnap.docs.forEach((d) => {
      const data = d.data();
      const name = (data.name || '').toLowerCase();
      const category = (data.category || '').toLowerCase();
      const description = (data.description || '').toLowerCase();

      if (name.includes(cleanTerm) || category.includes(cleanTerm) || description.includes(cleanTerm)) {
        suggestions.push({
          id: d.id,
          title: data.name,
          subtitle: data.category ? `Dish in ${data.category}` : 'Dish',
          type: 'dish',
          imageUrl: data.image || data.imageUrl,
          price: data.price,
          rating: data.averageRating || data.rating,
          link: `/customer/search?q=${encodeURIComponent(data.name)}`,
        });
      }
    });

    // Search Restaurants
    const restRef = collection(db, 'restaurants');
    const restSnap = await getDocs(query(restRef, limit(40)));

    restSnap.docs.forEach((d) => {
      const data = d.data();
      const name = (data.name || '').toLowerCase();
      const cuisines = Array.isArray(data.cuisineType)
        ? data.cuisineType.join(', ').toLowerCase()
        : (data.cuisine || '').toLowerCase();

      if (name.includes(cleanTerm) || cuisines.includes(cleanTerm)) {
        suggestions.push({
          id: d.id,
          title: data.name,
          subtitle: data.cuisineType?.join(', ') || 'Restaurant',
          type: 'restaurant',
          imageUrl: data.image || data.logo,
          rating: data.rating,
          link: `/customer/restaurant/${d.id}`,
        });
      }
    });
  } catch (err) {
    console.warn('Error fetching search suggestions:', err);
  }

  // Return up to 8 top matches
  return suggestions.slice(0, 8);
}
