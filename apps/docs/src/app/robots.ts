import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    host: 'https://docs.sign.hanzo.ai',
    sitemap: 'https://docs.sign.hanzo.ai/sitemap.xml',
  };
}
