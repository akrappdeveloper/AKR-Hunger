import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const restaurantId = searchParams.get('restaurantId');

        const promotionsRef = collection(db, 'promotions');
        const q = query(promotionsRef, where('isActive', '==', true));
        const snapshot = await getDocs(q);
        const now = new Date();

        const validPromotions = snapshot.docs
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    validFrom: data.validFrom?.toDate ? data.validFrom.toDate().toISOString() : data.validFrom,
                    validUntil: data.validUntil?.toDate ? data.validUntil.toDate().toISOString() : data.validUntil,
                };
            })
            .filter((promo: any) => {
                const validFrom = promo.validFrom ? new Date(promo.validFrom) : null;
                const validUntil = promo.validUntil ? new Date(promo.validUntil) : null;
                if (validFrom && now < validFrom) return false;
                if (validUntil && now > validUntil) return false;
                if (promo.usageLimit && (promo.usageCount || 0) >= promo.usageLimit) return false;
                if (restaurantId) {
                    if (promo.restaurantId && promo.restaurantId !== restaurantId) return false;
                    if (promo.applicableRestaurants && promo.applicableRestaurants.length > 0) {
                        return promo.applicableRestaurants.includes(restaurantId);
                    }
                }
                return true;
            });

        return NextResponse.json({ promotions: validPromotions }, { status: 200 });
    } catch (error) {
        // Return empty array gracefully without breaking customer experience
        return NextResponse.json({ promotions: [] }, { status: 200 });
    }
}
