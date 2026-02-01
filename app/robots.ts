import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = 'https://akrhunger.vercel.app'

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: '/admin/',
        },
        sitemap: [
            `${baseUrl}/sitemap.xml`,
            `${baseUrl}/customer/sitemap.xml`,
            `${baseUrl}/restaurant/sitemap.xml`,
            `${baseUrl}/delivery/sitemap.xml`,
        ],
    }
}
