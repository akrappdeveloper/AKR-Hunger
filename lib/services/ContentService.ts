import { collection, doc, getDoc, getDocs, updateDoc, setDoc, query, orderBy, onSnapshot, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Promotion, AdCampaign } from '@/lib/types';

export class ContentService {
  /**
   * Listen to active banners (Could be just a generic config document or a collection)
   */
  static listenBanners(callback: (banners: any[]) => void) {
    const q = query(collection(db, 'banners'), orderBy('position', 'asc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }

  static async addBanner(data: any): Promise<void> {
    await addDoc(collection(db, 'banners'), data);
  }

  static async updateBanner(id: string, data: any): Promise<void> {
    await updateDoc(doc(db, 'banners', id), data);
  }

  static async deleteBanner(id: string): Promise<void> {
    await deleteDoc(doc(db, 'banners', id));
  }

  static async toggleBannerStatus(id: string, currentStatus: boolean): Promise<void> {
    await updateDoc(doc(db, 'banners', id), { isActive: !currentStatus });
  }

  /**
   * Promotions / Redeem Codes
   */
  static listenPromotions(callback: (promos: Promotion[]) => void) {
    const q = query(collection(db, 'promotions'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Promotion)));
    });
  }

  static async togglePromotionStatus(id: string, currentStatus: boolean): Promise<void> {
    await updateDoc(doc(db, 'promotions', id), { isActive: !currentStatus });
  }

  static async deletePromotion(id: string): Promise<void> {
    await deleteDoc(doc(db, 'promotions', id));
  }

  /**
   * Campaigns
   */
  static listenCampaigns(callback: (campaigns: AdCampaign[]) => void) {
    const q = query(collection(db, 'campaigns'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdCampaign)));
    });
  }

  static async updateCampaignStatus(id: string, status: AdCampaign['status']): Promise<void> {
    await updateDoc(doc(db, 'campaigns', id), { status });
  }
}
