import { db } from './firebase';
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
    increment,
} from 'firebase/firestore';
import type { Promotion, PromotionUsage } from './types';

/**
 * Validate a promotion code and return the promotion if valid
 */
export async function validatePromotionCode(
    code: string,
    customerId: string,
    orderTotal: number,
    restaurantId?: string
): Promise<{
    valid: boolean;
    promotion?: Promotion;
    error?: string;
}> {
    try {
        // Query for the promotion code (case-insensitive)
        const promotionsQuery = query(
            collection(db, 'promotions'),
            where('code', '==', code.toUpperCase()),
            where('isActive', '==', true)
        );

        const promotionsSnapshot = await getDocs(promotionsQuery);

        if (promotionsSnapshot.empty) {
            return { valid: false, error: 'Invalid promotion code' };
        }

        const promotionDoc = promotionsSnapshot.docs[0];
        const promotion = {
            id: promotionDoc.id,
            ...promotionDoc.data(),
            validFrom: promotionDoc.data().validFrom?.toDate(),
            validUntil: promotionDoc.data().validUntil?.toDate(),
            createdAt: promotionDoc.data().createdAt?.toDate(),
        } as Promotion;

        // Check if promotion is within valid date range
        const now = new Date();
        if (now < promotion.validFrom || now > promotion.validUntil) {
            return { valid: false, error: 'This promotion has expired' };
        }

        // Check if minimum order amount is met
        if (promotion.minOrderAmount && orderTotal < promotion.minOrderAmount) {
            return {
                valid: false,
                error: `Minimum order of ₹${promotion.minOrderAmount} required`,
            };
        }

        // Check if promotion is applicable to this restaurant
        if (
            promotion.applicableRestaurants &&
            promotion.applicableRestaurants.length > 0 &&
            restaurantId &&
            !promotion.applicableRestaurants.includes(restaurantId)
        ) {
            return {
                valid: false,
                error: 'This promotion is not applicable to this restaurant',
            };
        }

        if (
            (promotion as any).restaurantId &&
            restaurantId &&
            (promotion as any).restaurantId !== restaurantId
        ) {
            return {
                valid: false,
                error: 'This promotion is not applicable to this restaurant',
            };
        }

        // Check total usage limit
        if (promotion.usageLimit && promotion.usageCount >= promotion.usageLimit) {
            return { valid: false, error: 'This promotion has reached its usage limit' };
        }

        // Check per-user usage limit
        if (promotion.perUserLimit) {
            const usageQuery = query(
                collection(db, 'promotionUsages'),
                where('promotionId', '==', promotion.id),
                where('customerId', '==', customerId)
            );

            const usageSnapshot = await getDocs(usageQuery);

            if (usageSnapshot.size >= promotion.perUserLimit) {
                return {
                    valid: false,
                    error: 'You have already used this promotion the maximum number of times',
                };
            }
        }

        return { valid: true, promotion };
    } catch (error) {
        console.error('Error validating promotion code:', error);
        return { valid: false, error: 'Failed to validate promotion code' };
    }
}

/**
 * Calculate discount amount based on promotion
 */
export function calculateDiscount(
    promotion: Promotion,
    orderTotal: number,
    deliveryCharge: number
): number {
    let discount = 0;

    switch (promotion.type) {
        case 'percentage':
            discount = (orderTotal * promotion.value) / 100;
            if (promotion.maxDiscount && discount > promotion.maxDiscount) {
                discount = promotion.maxDiscount;
            }
            break;

        case 'fixed':
            discount = Math.min(promotion.value, orderTotal);
            break;

        case 'free_delivery':
            discount = deliveryCharge;
            break;

        default:
            discount = 0;
    }

    return parseFloat(discount.toFixed(2));
}

/**
 * Record promotion usage
 */
export async function recordPromotionUsage(
    promotionId: string,
    customerId: string,
    orderId: string,
    discountAmount: number
): Promise<void> {
    try {
        // Add usage record
        await addDoc(collection(db, 'promotionUsages'), {
            promotionId,
            customerId,
            orderId,
            discountAmount,
            usedAt: Timestamp.now(),
        });

        // Increment usage count
        const promotionRef = doc(db, 'promotions', promotionId);
        await updateDoc(promotionRef, {
            usageCount: increment(1),
        });
    } catch (error) {
        console.error('Error recording promotion usage:', error);
        throw new Error('Failed to record promotion usage');
    }
}

/**
 * Create a new promotion (Admin only)
 */
export async function createPromotion(
    promotionData: Omit<Promotion, 'id' | 'usageCount' | 'createdAt'>
): Promise<string> {
    try {
        const promotionsRef = collection(db, 'promotions');

        const newPromotion = {
            ...promotionData,
            code: promotionData.code.toUpperCase(),
            usageCount: 0,
            validFrom: Timestamp.fromDate(promotionData.validFrom),
            validUntil: Timestamp.fromDate(promotionData.validUntil),
            createdAt: Timestamp.now(),
        };

        const docRef = await addDoc(promotionsRef, newPromotion);
        return docRef.id;
    } catch (error) {
        console.error('Error creating promotion:', error);
        throw new Error('Failed to create promotion');
    }
}

/**
 * Update an existing promotion (Admin only)
 */
export async function updatePromotion(
    promotionId: string,
    updates: Partial<Promotion>
): Promise<void> {
    try {
        const promotionRef = doc(db, 'promotions', promotionId);

        const updateData: any = { ...updates };

        if (updates.code) {
            updateData.code = updates.code.toUpperCase();
        }

        if (updates.validFrom) {
            updateData.validFrom = Timestamp.fromDate(updates.validFrom);
        }

        if (updates.validUntil) {
            updateData.validUntil = Timestamp.fromDate(updates.validUntil);
        }

        await updateDoc(promotionRef, updateData);
    } catch (error) {
        console.error('Error updating promotion:', error);
        throw new Error('Failed to update promotion');
    }
}

/**
 * Get all promotions (Admin only)
 */
export async function getAllPromotions(): Promise<Promotion[]> {
    try {
        const promotionsQuery = query(
            collection(db, 'promotions'),
            orderBy('createdAt', 'desc')
        );

        const promotionsSnapshot = await getDocs(promotionsQuery);

        return promotionsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            validFrom: doc.data().validFrom?.toDate(),
            validUntil: doc.data().validUntil?.toDate(),
            createdAt: doc.data().createdAt?.toDate(),
        })) as Promotion[];
    } catch (error) {
        console.error('Error fetching promotions:', error);
        return [];
    }
}

/**
 * Get active promotions for customers
 */
export async function getActivePromotions(): Promise<Promotion[]> {
    try {
        const now = Timestamp.now();

        const promotionsQuery = query(
            collection(db, 'promotions'),
            where('isActive', '==', true),
            orderBy('createdAt', 'desc')
        );

        const promotionsSnapshot = await getDocs(promotionsQuery);

        // Filter by date range (Firestore doesn't support range queries on Timestamp easily)
        const activePromotions = promotionsSnapshot.docs
            .map((doc) => ({
                id: doc.id,
                ...doc.data(),
                validFrom: doc.data().validFrom?.toDate(),
                validUntil: doc.data().validUntil?.toDate(),
                createdAt: doc.data().createdAt?.toDate(),
            }))
            .filter((promo: any) => {
                const validFrom = promo.validFrom;
                const validUntil = promo.validUntil;
                const nowDate = now.toDate();
                return nowDate >= validFrom && nowDate <= validUntil;
            }) as Promotion[];

        return activePromotions;
    } catch (error) {
        console.error('Error fetching active promotions:', error);
        return [];
    }
}

/**
 * Generate a random promotion code
 */
export function generatePromotionCode(prefix: string = ''): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = prefix.toUpperCase();
    const length = 8 - prefix.length;

    for (let i = 0; i < length; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return code;
}
