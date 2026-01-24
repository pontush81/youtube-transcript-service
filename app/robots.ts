import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://tubebase.app';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/transcripts/', '/chat'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
