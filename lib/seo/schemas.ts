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
        name: 'AKR Hunger',
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
            name: 'AKR Hunger',
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
