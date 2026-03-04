import { generateOpenApi } from '@ts-rest/open-api';

import { NEXT_PUBLIC_WEBAPP_URL } from '@hanzo/sign-lib/constants/app';
import { env } from '@hanzo/sign-lib/utils/env';

import { ApiContractV1 } from './contract';

const appName = env('NEXT_PUBLIC_APP_NAME') || 'Hanzo Sign';

export const OpenAPIV1 = Object.assign(
  generateOpenApi(
    ApiContractV1,
    {
      info: {
        title: `${appName} API`,
        version: '1.0.0',
        description: `API V1 is deprecated, but will continue to be supported. For more details, see https://docs.sign.hanzo.ai/developers/public-api. \n\nThe ${appName} API for retrieving, creating, updating and deleting documents.`,
      },
      servers: [
        {
          url: NEXT_PUBLIC_WEBAPP_URL(),
        },
      ],
    },
    {
      setOperationId: true,
    },
  ),
  {
    components: {
      securitySchemes: {
        authorization: {
          type: 'apiKey',
          in: 'header',
          name: 'Authorization',
        },
      },
    },
    security: [
      {
        authorization: [],
      },
    ],
  },
);
