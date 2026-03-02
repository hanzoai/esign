import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

export const appMetaTags = (title?: string) => {
  const description =
    'Hanzo Sign — Secure document signing infrastructure. Fast, smart, and beautiful document signing with integrations and customizable templates.';

  return [
    {
      title: title ? `${title} - Hanzo Sign` : 'Hanzo Sign',
    },
    {
      name: 'description',
      content: description,
    },
    {
      name: 'keywords',
      content:
        'Hanzo Sign, document signing, secure signing infrastructure, smart templates, e-signatures',
    },
    {
      name: 'author',
      content: 'Hanzo AI, Inc.',
    },
    {
      name: 'robots',
      content: 'index, follow',
    },
    {
      property: 'og:title',
      content: 'Hanzo Sign — Secure Document Signing Infrastructure',
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
      content: '@hanzoai',
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
