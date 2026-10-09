import { Metadata } from 'next';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { notFound } from 'next/navigation';
import ProductClient from './ProductClient';
import { generateMenuItemSchema } from '@/lib/seo/schemas';
import { MenuItem, Restaurant } from '@/lib/types';
import Script from 'next/script';
import { sanitizeForClient } from '@/lib/utils';

interface PageProps {
    params: Promise<{ id: string }>;
}

async function getProductData(id: string) {
    try {
        const productDoc = await getDoc(doc(db, 'menuItems', id));
        if (!productDoc.exists()) return null;

        const product = { id: productDoc.id, ...productDoc.data() } as MenuItem;

        let restaurant: Restaurant | null = null;
        if (product.restaurantId) {
            const restaurantDoc = await getDoc(doc(db, 'restaurants', product.restaurantId));
            if (restaurantDoc.exists()) {
                restaurant = { id: restaurantDoc.id, ...restaurantDoc.data() } as Restaurant;
            }
        }

        // Fetch recommendations (same restaurant, same category, exclude current)
        let recommendations: MenuItem[] = [];
        if (product.restaurantId && product.category) {

            // Improved Recommendation Logic: Fetch more, then filter locally to avoid index issues if precise indexes aren't set
            // Ideally should match the client helper logic but kept simple for server
            const menuRef = collection(db, 'menuItems');
            const q = query(
                menuRef,
                where('restaurantId', '==', product.restaurantId),
                where('category', '==', product.category)
            );
            const snapshot = await getDocs(q);
            recommendations = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as MenuItem))
                .filter(item => item.id !== id)
                .slice(0, 4);
        }

        return { product, restaurant, recommendations };
    } catch (error) {
        console.error('Error fetching product data:', error);
        return null;
    }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const data = await getProductData(id);

    if (!data || !data.product) {
        return {
            title: 'Item Not Found | Hunger',
            description: 'The requested menu item could not be found.',
        };
    }

    const { product, restaurant } = data;
    const priceText = `₹${product.price}`;
    const restaurantText = restaurant ? ` from ${restaurant.name}` : '';
    const description = `Order ${product.name}${restaurantText} for ${priceText}. ${product.description?.slice(0, 100) || 'Fresh and delicious'}.`;

    return {
        title: `${product.name} - Order Online | Hunger`,
        description: description,
        openGraph: {
            title: `${product.name} - Order Online`,
            description: description,
            images: product.image ? [{ url: product.image }] : [],
            url: `https://akrhunger.vercel.app/customer/product/${id}`,
        },
    };
}

export default async function ProductPage({ params }: PageProps) {
    const { id } = await params;
    const data = await getProductData(id);

    if (!data || !data.product) {
        notFound();
    }

    const { product, restaurant, recommendations } = data;
    const jsonLd = generateMenuItemSchema(product, restaurant?.name || 'Hunger');

    return (
        <>
            <Script
                id="product-json-ld"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <ProductClient
                productId={id}
                initialProduct={sanitizeForClient(product)}
                initialRestaurant={sanitizeForClient(restaurant)}
                initialRecommendations={sanitizeForClient(recommendations)}
            />
        </>
    );
}
