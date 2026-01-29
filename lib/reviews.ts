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
    limit,
    increment,
    arrayUnion,
    arrayRemove,
    Timestamp,
} from 'firebase/firestore';
import type { Review, RestaurantResponse } from './types';

/**
 * Submit a new review for a restaurant or menu item
 */
export async function submitReview(reviewData: Omit<Review, 'id' | 'helpful' | 'createdAt'>): Promise<string> {
    try {
        const reviewsRef = collection(db, 'reviews');

        const newReview = {
            ...reviewData,
            helpful: 0,
            helpfulVoters: [],
            createdAt: Timestamp.now(),
        };

        const docRef = await addDoc(reviewsRef, newReview);

        // Update aggregated ratings
        await updateAggregatedRatings(reviewData.restaurantId, reviewData.menuItemId);

        // Mark order as reviewed
        if (reviewData.orderId) {
            const orderRef = doc(db, 'orders', reviewData.orderId);
            await updateDoc(orderRef, { hasReview: true });
        }

        return docRef.id;
    } catch (error) {
        console.error('Error submitting review:', error);
        throw new Error('Failed to submit review');
    }
}

/**
 * Update aggregated ratings for restaurant and/or menu item
 */
async function updateAggregatedRatings(restaurantId: string, menuItemId?: string): Promise<void> {
    try {
        // Update restaurant rating
        const restaurantReviewsQuery = query(
            collection(db, 'reviews'),
            where('restaurantId', '==', restaurantId)
        );

        const restaurantReviews = await getDocs(restaurantReviewsQuery);
        const restaurantRatings = restaurantReviews.docs.map(doc => doc.data().rating as number);

        if (restaurantRatings.length > 0) {
            const averageRating = restaurantRatings.reduce((sum, rating) => sum + rating, 0) / restaurantRatings.length;
            const restaurantRef = doc(db, 'restaurants', restaurantId);

            await updateDoc(restaurantRef, {
                averageRating: parseFloat(averageRating.toFixed(1)),
                totalReviews: restaurantRatings.length,
                rating: parseFloat(averageRating.toFixed(1)), // Keep for backward compatibility
                reviews: restaurantRatings.length, // Keep for backward compatibility
            });
        }

        // Update menu item rating if applicable
        if (menuItemId) {
            const itemReviewsQuery = query(
                collection(db, 'reviews'),
                where('menuItemId', '==', menuItemId)
            );

            const itemReviews = await getDocs(itemReviewsQuery);
            const itemRatings = itemReviews.docs.map(doc => doc.data().rating as number);

            if (itemRatings.length > 0) {
                const averageRating = itemRatings.reduce((sum, rating) => sum + rating, 0) / itemRatings.length;
                const menuItemRef = doc(db, 'menuItems', menuItemId);

                await updateDoc(menuItemRef, {
                    averageRating: parseFloat(averageRating.toFixed(1)),
                    totalReviews: itemRatings.length,
                });
            }
        }
    } catch (error) {
        console.error('Error updating aggregated ratings:', error);
    }
}

/**
 * Fetch reviews for a restaurant with optional filtering and sorting
 */
export async function getRestaurantReviews(
    restaurantId: string,
    options: {
        ratingFilter?: number;
        sortBy?: 'recent' | 'rating' | 'helpful';
        limitCount?: number;
    } = {}
): Promise<Review[]> {
    try {
        const { ratingFilter, sortBy = 'recent', limitCount = 10 } = options;

        let reviewsQuery = query(
            collection(db, 'reviews'),
            where('restaurantId', '==', restaurantId)
        );

        // Apply rating filter
        if (ratingFilter) {
            reviewsQuery = query(reviewsQuery, where('rating', '==', ratingFilter));
        }

        // Apply sorting
        if (sortBy === 'recent') {
            reviewsQuery = query(reviewsQuery, orderBy('createdAt', 'desc'));
        } else if (sortBy === 'rating') {
            reviewsQuery = query(reviewsQuery, orderBy('rating', 'desc'));
        } else if (sortBy === 'helpful') {
            reviewsQuery = query(reviewsQuery, orderBy('helpful', 'desc'));
        }

        // Apply limit
        reviewsQuery = query(reviewsQuery, limit(limitCount));

        const reviewsSnapshot = await getDocs(reviewsQuery);

        return reviewsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
            response: doc.data().response ? {
                ...doc.data().response,
                respondedAt: doc.data().response.respondedAt?.toDate(),
            } : undefined,
        })) as Review[];
    } catch (error) {
        console.error('Error fetching reviews:', error);
        return [];
    }
}

/**
 * Mark a review as helpful
 */
export async function markReviewHelpful(reviewId: string, customerId: string): Promise<void> {
    try {
        const reviewRef = doc(db, 'reviews', reviewId);
        const reviewDoc = await getDoc(reviewRef);

        if (!reviewDoc.exists()) {
            throw new Error('Review not found');
        }

        const reviewData = reviewDoc.data();
        const helpfulVoters = reviewData.helpfulVoters || [];

        if (helpfulVoters.includes(customerId)) {
            // Remove vote
            await updateDoc(reviewRef, {
                helpful: increment(-1),
                helpfulVoters: arrayRemove(customerId),
            });
        } else {
            // Add vote
            await updateDoc(reviewRef, {
                helpful: increment(1),
                helpfulVoters: arrayUnion(customerId),
            });
        }
    } catch (error) {
        console.error('Error marking review helpful:', error);
        throw new Error('Failed to update helpful status');
    }
}

/**
 * Add restaurant response to a review
 */
export async function addRestaurantResponse(
    reviewId: string,
    response: string
): Promise<void> {
    try {
        const reviewRef = doc(db, 'reviews', reviewId);

        const restaurantResponse: RestaurantResponse = {
            message: response,
            respondedAt: new Date(),
        };

        await updateDoc(reviewRef, {
            response: restaurantResponse,
            updatedAt: Timestamp.now(),
        });
    } catch (error) {
        console.error('Error adding restaurant response:', error);
        throw new Error('Failed to add response');
    }
}

/**
 * Check if a customer has already reviewed an order
 */
export async function hasUserReviewedOrder(orderId: string, customerId: string): Promise<boolean> {
    try {
        const reviewsQuery = query(
            collection(db, 'reviews'),
            where('orderId', '==', orderId),
            where('customerId', '==', customerId)
        );

        const reviewsSnapshot = await getDocs(reviewsQuery);
        return !reviewsSnapshot.empty;
    } catch (error) {
        console.error('Error checking review status:', error);
        return false;
    }
}

/**
 * Get rating statistics for a restaurant
 */
export async function getRestaurantRatingStats(restaurantId: string): Promise<{
    averageRating: number;
    totalReviews: number;
    distribution: { [key: number]: number };
}> {
    try {
        const reviewsQuery = query(
            collection(db, 'reviews'),
            where('restaurantId', '==', restaurantId)
        );

        const reviewsSnapshot = await getDocs(reviewsQuery);
        const ratings = reviewsSnapshot.docs.map(doc => doc.data().rating as number);

        if (ratings.length === 0) {
            return {
                averageRating: 0,
                totalReviews: 0,
                distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            };
        }

        const averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;

        // Calculate distribution
        const distribution = ratings.reduce((acc, rating) => {
            acc[rating] = (acc[rating] || 0) + 1;
            return acc;
        }, {} as { [key: number]: number });

        // Ensure all ratings 1-5 are present
        for (let i = 1; i <= 5; i++) {
            if (!distribution[i]) {
                distribution[i] = 0;
            }
        }

        return {
            averageRating: parseFloat(averageRating.toFixed(1)),
            totalReviews: ratings.length,
            distribution,
        };
    } catch (error) {
        console.error('Error getting rating stats:', error);
        return {
            averageRating: 0,
            totalReviews: 0,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        };
    }
}
