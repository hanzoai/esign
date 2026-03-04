import { NEXT_PUBLIC_WEBAPP_URL } from '@hanzo/sign-lib/constants/app';
import { env } from '@hanzo/sign-lib/utils/env';

const APP_NAME = env('NEXT_PUBLIC_APP_NAME') || 'Hanzo Sign';
const COMPANY_NAME = env('NEXT_PUBLIC_COMPANY_NAME') || 'Hanzo AI, Inc.';
const TWITTER_HANDLE = env('NEXT_PUBLIC_TWITTER_HANDLE') || '@hanzoai';

export const appMetaTags = (title?: string) => {
  const description = `${APP_NAME} — Secure document signing infrastructure. Fast, smart, and beautiful document signing with integrations and customizable templates.`;

  return [
    {
      title: title ? `${title} - ${APP_NAME}` : APP_NAME,
    },
    {
      name: 'description',
      content: description,
    },
    {
      name: 'keywords',
      content: `${APP_NAME}, document signing, secure signing infrastructure, smart templates, e-signatures`,
    },
    {
      name: 'author',
      content: COMPANY_NAME,
    },
    {
      name: 'robots',
      content: 'index, follow',
    },
    {
      property: 'og:title',
      content: `${APP_NAME} — Secure Document Signing Infrastructure`,
    },
    {
      property: 'og:description',
      content: description,
    },
    {
      property: 'og:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
    },
    {
      property: 'og:type',
      content: 'website',
    },
    {
      name: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      name: 'twitter:site',
      content: TWITTER_HANDLE,
    },
    {
      name: 'twitter:description',
      content: description,
    },
    {
      name: 'twitter:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
    },
  ];
};
