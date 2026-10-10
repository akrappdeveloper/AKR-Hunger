import { collection, doc, getDoc, getDocs, updateDoc, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DeliveryPerson } from '@/lib/types';

const COLLECTION_NAME = 'delivery_partners';

export class DeliveryService {
  /**
   * Fetch all delivery partners
   */
  static async getAllPartners(): Promise<DeliveryPerson[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryPerson));
  }

  /**
   * Listen to all delivery partners for real-time updates
   */
  static listenAllPartners(callback: (partners: DeliveryPerson[]) => void, onError: (error: Error) => void) {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryPerson));
      callback(data);
    }, onError);
  }

  /**
   * Fetch a single delivery partner by ID
   */
  static async getPartnerById(id: string): Promise<DeliveryPerson | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as DeliveryPerson;
    }
    return null;
  }

  /**
   * Update a delivery partner
   */
  static async updatePartner(id: string, updates: Partial<DeliveryPerson>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...updates
    });
  }

  /**
   * Delete a delivery partner
   */
  static async deletePartner(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }

  /**
   * Approve/Reject KYC
   */
  static async verifyKyc(id: string, status: 'approved' | 'rejected', reason?: string): Promise<void> {
    const updates: Partial<DeliveryPerson> = {
      kycStatus: status,
      verificationStatus: status,
      isVerified: status === 'approved',
    };
    
    if (status === 'approved') {
      updates.kycApprovedAt = new Date();
    } else if (reason) {
      updates.rejectionReason = reason;
    }

    return this.updatePartner(id, updates);
  }
}
