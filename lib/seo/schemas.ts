/**
 * SEO Schema Generators for AKR Hunger Food Delivery Platform
 * Generates JSON-LD structured data for different panel types
 */

const baseUrl = 'https://akrhunger.vercel.app'

export interface BreadcrumbItem {
    name: string
    url: string
}

/**
 * Generate Organization schema for the main brand
 */
export function generateOrganizationSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Hunger',
        url: baseUrl,
        logo: `${baseUrl}/akrhunger.png`,
        description: 'Leading food delivery platform connecting customers with restaurants',
        sameAs: [
            // Add social media links here when available
        ],
    }
}

/**
 * Generate FoodEstablishment + Service schema for customer panel
 */
export function generateFoodDeliverySchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'Service',
        serviceType: 'Food Delivery',
        provider: {
            '@type': 'Organization',
            name: 'Hunger',
            url: baseUrl,
        },
        areaServed: {
            '@type': 'Country',
            name: 'India',
        },
        description: 'Order food online from your favorite restaurants. Fast delivery, great prices, wide selection.',
    }
}

/**
 * Generate SoftwareApplication schema for restaurant partner portal
 */
export function generateRestaurantPortalSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'AKR Hunger Restaurant Partner Portal',
        applicationCategory: 'BusinessApplication',
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'INR',
        },
        description: 'Restaurant management dashboard for partners. Manage menu, orders, earnings, and grow your business.',
        operatingSystem: 'Web',
        url: `${baseUrl}/restaurant/login`,
    }
}

/**
 * Generate JobPosting schema for delivery partner opportunities
 */
export function generateDeliveryJobSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: 'Delivery Partner - Food Delivery',
        description: 'Join AKR Hunger as a delivery partner. Flexible hours, competitive earnings, and be your own boss.',
        hiringOrganization: {
            '@type': 'Organization',
            name: 'AKR Hunger',
            url: baseUrl,
        },
        jobLocation: {
            '@type': 'Place',
            address: {
                '@type': 'PostalAddress',
                addressCountry: 'IN',
            },
        },
        employmentType: 'CONTRACTOR',
        baseSalary: {
            '@type': 'MonetaryAmount',
            currency: 'INR',
            value: {
                '@type': 'QuantitativeValue',
                minValue: 15000,
                maxValue: 50000,
                unitText: 'MONTH',
            },
        },
        datePosted: new Date().toISOString(),
        validThrough: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days from now
    }
}

/**
 * Generate Breadcrumb schema for navigation
 */
export function generateBreadcrumbSchema(items: BreadcrumbItem[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url,
        })),
    }
}

/**
 * Generate WebSite schema with search action
 */
export function generateWebSiteSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'AKR Hunger',
        url: baseUrl,
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `${baseUrl}/customer/search?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
        },
    }
}

/**
 * Generate FAQ schema for common platform questions
 */
export function generateFAQSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: 'What is AKR Hunger?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'AKR Hunger is a leading food delivery platform that connects customers with their favorite local restaurants for fast and reliable food delivery.',
                },
            },
            {
                '@type': 'Question',
                name: 'How to order food on AKR Hunger?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'You can order food on AKR Hunger by visiting our website or downloading our mobile app. Simply browse restaurants, select your items, and checkout securely.',
                },
            },
            {
                '@type': 'Question',
                name: 'Is AKR Hunger available near me?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'AKR Hunger is rapidly expanding across major cities. You can check availability by entering your delivery address on our homepage or app.',
                },
            },
            {
                '@type': 'Question',
                name: 'Is AKR Hunger mobile friendly?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Yes, AKR Hunger is fully optimized for mobile devices. We offer a seamless experience on both our responsive website and dedicated mobile applications.',
                },
            },
            {
                '@type': 'Question',
                name: 'Does AKR Hunger provide fast delivery?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Yes, we prioritize speed. Our advanced logistics network ensures your food reaches you hot and fresh in the shortest time possible.',
                },
            },
        ],
    }
}

/**
 * Generate Restaurant schema for detailed restaurant pages
 */
export function generateRestaurantSchema(restaurant: any, menuItems: any[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Restaurant',
        name: restaurant.name,
        image: restaurant.image,
        url: `${baseUrl}/customer/restaurant/${restaurant.id}`,
        telephone: restaurant.phone,
        address: {
            '@type': 'PostalAddress',
            streetAddress: restaurant.address,
            addressCountry: 'IN',
        },
        geo: {
            '@type': 'GeoCoordinates',
            latitude: restaurant.location?.lat,
            longitude: restaurant.location?.lng,
        },
        servesCuisine: restaurant.cuisineType,
        priceRange: '₹₹',
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: restaurant.averageRating || restaurant.rating || 4.2,
            reviewCount: restaurant.totalReviews || restaurant.reviews || 0,
            bestRating: 5,
            worstRating: 1,
        },
        hasMenu: {
            '@type': 'Menu',
            name: 'Main Menu',
            hasMenuSection: Object.entries(
                menuItems.reduce((acc: any, item: any) => {
                    if (!acc[item.category]) acc[item.category] = [];
                    acc[item.category].push(item);
                    return acc;
                }, {})
            ).map(([category, items]: [string, any]) => ({
                '@type': 'MenuSection',
                name: category,
                hasMenuItem: items.map((item: any) => ({
                    '@type': 'MenuItem',
                    name: item.name,
                    description: item.description,
                    offers: {
                        '@type': 'Offer',
                        price: item.price,
                        priceCurrency: 'INR',
                    },
                })),
            })),
        },
    }
}

/**
 * Generate Product schema for individual menu items
 */
export function generateMenuItemSchema(item: any, restaurantName: string) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: item.name,
        image: item.image,
        description: item.description,
        brand: {
            '@type': 'Restaurant',
            name: restaurantName,
        },
        offers: {
            '@type': 'Offer',
            url: `${baseUrl}/customer/product/${item.id}`,
            priceCurrency: 'INR',
            price: item.price,
            availability: 'https://schema.org/InStock',
        },
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: item.averageRating || 4.5,
            reviewCount: item.totalReviews || 1,
        },
    }
}
