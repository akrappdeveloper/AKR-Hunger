import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://akrhunger.vercel.app'

    return [
        // Main Homepage
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },

        // Sub-sitemaps
        {
            url: `${baseUrl}/customer/sitemap.xml`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },

        // Restaurant Pages
        { url: `${baseUrl}/restaurant/menu`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
        { url: `${baseUrl}/restaurant/quality`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
        { url: `${baseUrl}/restaurant/reviews`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },

        // Delivery Pages
        { url: `${baseUrl}/delivery/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    ]
}
