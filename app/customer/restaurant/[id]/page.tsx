import { Metadata } from 'next';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { notFound } from 'next/navigation';
import RestaurantClient from './RestaurantClient';
import { generateRestaurantSchema } from '@/lib/seo/schemas';
import { Restaurant, MenuItem } from '@/lib/types';
import Script from 'next/script';
import { sanitizeForClient } from '@/lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getRestaurantData(id: string) {
  try {
    const restaurantDoc = await getDoc(doc(db, 'restaurants', id));
    if (!restaurantDoc.exists()) return null;

    const restaurant = { id: restaurantDoc.id, ...restaurantDoc.data() } as Restaurant;

    const menuItemsRef = collection(db, 'menuItems');
    const q = query(
      menuItemsRef,
      where('restaurantId', '==', id),
      where('approvalStatus', '==', 'approved'),
      where('isLive', '==', true)
    );
    const snapshot = await getDocs(q);
    const menuItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));

    return { restaurant, menuItems };
  } catch (error) {
    console.error('Error fetching restaurant data:', error);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getRestaurantData(id);

  if (!data) {
    return {
      title: 'Restaurant Not Found | Hunger',
      description: 'The requested restaurant could not be found.',
    };
  }

  const { restaurant } = data;
  const description = `Order online from ${restaurant.name} on Hunger. ${restaurant.description?.slice(0, 100) || 'Best food delivery near you'}.`;

  return {
    title: `${restaurant.name} - Order Online | Hunger`,
    description: description,
    openGraph: {
      title: `${restaurant.name} - Order Online`,
      description: description,
      images: restaurant.image ? [{ url: restaurant.image }] : [],
      url: `https://akrhunger.vercel.app/customer/restaurant/${id}`,
    },
  };
}

export default async function RestaurantPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getRestaurantData(id);

  if (!data) {
    notFound();
  }

  const { restaurant, menuItems } = data;
  const jsonLd = generateRestaurantSchema(restaurant, menuItems);

  return (
    <>
      <Script
        id="restaurant-json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <RestaurantClient
        restaurantId={id}
        initialRestaurant={sanitizeForClient(restaurant)}
        initialMenuItems={sanitizeForClient(menuItems)}
      />
    </>
  );
}

