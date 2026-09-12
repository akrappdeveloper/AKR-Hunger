import { MetadataRoute } from 'next'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://akrhunger.vercel.app'

    // Static Routes
    const staticRoutes: MetadataRoute.Sitemap = [
        {
            url: `${baseUrl}/customer`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        {
            url: `${baseUrl}/customer/favorites`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/customer/search`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/customer/cart`,
            lastModified: new Date(),
            changeFrequency: 'always',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/customer/orders`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/customer/support`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
        },
    ]

    // Fetch Restaurants
    let restaurantRoutes: MetadataRoute.Sitemap = []
    try {
        const restaurantsQuery = query(collection(db, 'restaurants'), where('isActive', '==', true))
        const restaurantSnapshot = await getDocs(restaurantsQuery)

        restaurantRoutes = restaurantSnapshot.docs.map(doc => ({
            url: `${baseUrl}/customer/restaurant/${doc.id}`,
            lastModified: doc.data().updatedAt?.toDate() || new Date(),
            changeFrequency: 'daily',
            priority: 0.8,
        }))
    } catch (error) {
        console.error('Error fetching restaurants for sitemap:', error)
    }

    // Fetch Products (Menu Items)
    let productRoutes: MetadataRoute.Sitemap = []
    try {
        const productsQuery = query(
            collection(db, 'menuItems'),
            where('isLive', '==', true),
            where('approvalStatus', '==', 'approved')
        )
        const productSnapshot = await getDocs(productsQuery)

        productRoutes = productSnapshot.docs.map(doc => ({
            url: `${baseUrl}/customer/product/${doc.id}`,
            lastModified: doc.data().updatedAt?.toDate() || new Date(),
            changeFrequency: 'weekly',
            priority: 0.7,
        }))
    } catch (error) {
        console.error('Error fetching products for sitemap:', error)
    }

    return [...staticRoutes, ...restaurantRoutes, ...productRoutes]
}
