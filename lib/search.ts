import { db } from './firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import type { Restaurant, SearchFilters } from './types';

/**
 * Search and filter restaurants based on criteria
 */
export async function searchRestaurants(filters: SearchFilters): Promise<Restaurant[]> {
    try {
        let restaurantsQuery = query(collection(db, 'restaurants'), where('isActive', '==', true));

        const restaurantsSnapshot = await getDocs(restaurantsQuery);
        let restaurants = restaurantsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
        })) as Restaurant[];

        // Apply client-side filtering (Firestore has limited query capabilities)

        // Text search on name and description
        if (filters.query) {
            const searchTerm = filters.query.toLowerCase();
            restaurants = restaurants.filter(
                (r) =>
                    r.name.toLowerCase().includes(searchTerm) ||
                    r.description?.toLowerCase().includes(searchTerm) ||
                    r.cuisineType?.some((c) => c.toLowerCase().includes(searchTerm))
            );
        }

        // Filter by cuisine types
        if (filters.cuisineTypes && filters.cuisineTypes.length > 0) {
            restaurants = restaurants.filter((r) =>
                r.cuisineType?.some((c) => filters.cuisineTypes!.includes(c))
            );
        }

        // Filter by rating
        if (filters.rating) {
            restaurants = restaurants.filter(
                (r) => (r.averageRating || r.rating || 0) >= filters.rating!
            );
        }

        // Filter by delivery time
        if (filters.deliveryTime) {
            restaurants = restaurants.filter(
                (r) => (r.deliveryTime || 0) <= filters.deliveryTime!
            );
        }

        // Filter by price range
        if (filters.priceRange) {
            restaurants = restaurants.filter(
                (r) =>
                    (r.minimumOrder || 0) >= filters.priceRange!.min &&
                    (r.minimumOrder || 0) <= filters.priceRange!.max
            );
        }

        // Apply sorting
        if (filters.sortBy) {
            restaurants.sort((a, b) => {
                let comparison = 0;

                switch (filters.sortBy) {
                    case 'rating':
                        comparison = (b.averageRating || b.rating || 0) - (a.averageRating || a.rating || 0);
                        break;
                    case 'deliveryTime':
                        comparison = (a.deliveryTime || 0) - (b.deliveryTime || 0);
                        break;
                    case 'price':
                        comparison = (a.minimumOrder || 0) - (b.minimumOrder || 0);
                        break;
                    case 'popularity':
                        comparison = (b.totalReviews || b.reviews || 0) - (a.totalReviews || a.reviews || 0);
                        break;
                    default:
                        comparison = 0;
                }

                return filters.sortOrder === 'desc' ? -comparison : comparison;
            });
        }

        return restaurants;
    } catch (error) {
        console.error('Error searching restaurants:', error);
        return [];
    }
}

/**
 * Get popular search suggestions based on restaurant names and cuisines
 */
export async function getSearchSuggestions(query: string): Promise<string[]> {
    if (!query || query.length < 2) {
        return [];
    }

    try {
        const restaurantsSnapshot = await getDocs(collection(db, 'restaurants'));
        const restaurants = restaurantsSnapshot.docs.map((doc) => doc.data() as Restaurant);

        const suggestions = new Set<string>();

        restaurants.forEach((restaurant) => {
            // Add matching restaurant names
            if (restaurant.name.toLowerCase().includes(query.toLowerCase())) {
                suggestions.add(restaurant.name);
            }

            // Add matching cuisine types
            restaurant.cuisineType?.forEach((cuisine) => {
                if (cuisine.toLowerCase().includes(query.toLowerCase())) {
                    suggestions.add(cuisine);
                }
            });
        });

        return Array.from(suggestions).slice(0, 5);
    } catch (error) {
        console.error('Error getting search suggestions:', error);
        return [];
    }
}

/**
 * Get all available cuisine types from restaurants
 */
export async function getAllCuisineTypes(): Promise<string[]> {
    try {
        const restaurantsSnapshot = await getDocs(collection(db, 'restaurants'));
        const cuisineTypesSet = new Set<string>();

        restaurantsSnapshot.docs.forEach((doc) => {
            const restaurant = doc.data() as Restaurant;
            restaurant.cuisineType?.forEach((cuisine) => cuisineTypesSet.add(cuisine));
        });

        return Array.from(cuisineTypesSet).sort();
    } catch (error) {
        console.error('Error getting cuisine types:', error);
        return [];
    }
}
