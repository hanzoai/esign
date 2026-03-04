import { generateOpenApiDocument } from 'trpc-to-openapi';

import { NEXT_PUBLIC_WEBAPP_URL } from '@hanzo/sign-lib/constants/app';
import { env } from '@hanzo/sign-lib/utils/env';

import { appRouter } from './router';

const appName = env('NEXT_PUBLIC_APP_NAME') || 'Hanzo Sign';

export const openApiDocument = {
  ...generateOpenApiDocument(appRouter, {
    title: `${appName} v2 API`,
    description: `Welcome to the ${appName} v2 API.\n\nThis API provides access to our system, which you can use to integrate applications, automate workflows, or build custom tools.`,
    version: '1.0.0',
    baseUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2`,
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
      },
    },
  }),

  /**
   * Dirty way to pass through the security field.
   */
  security: [
    {
      apiKey: [],
    },
  ],
};
