import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    host: 'https://docs.esign.hanzo.ai',
    sitemap: 'https://docs.esign.hanzo.ai/sitemap.xml',
  };
}
