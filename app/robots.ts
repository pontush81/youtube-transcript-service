import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  // Internal tool - no indexing
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  };
}
