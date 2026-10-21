import { TsRestHttpError, fetchRequestHandler } from '@ts-rest/serverless/fetch';
import { Hono } from 'hono';

import { ApiContractV1 } from '@hanzo/esign-api/v1/contract';
import { ApiContractV1Implementation } from '@hanzo/esign-api/v1/implementation';
import { OpenAPIV1 } from '@hanzo/esign-api/v1/openapi';
// This is a bit nasty. Todo: Extract
import type { HonoEnv } from '@hanzo/esign-remix/server/router';

// This is bad, ts-router will be created on each request.
// But don't really have a choice here.
export const tsRestHonoApp = new Hono<HonoEnv>();

tsRestHonoApp
  .get('/openapi', (c) => c.redirect('https://openapi-v1.esign.hanzo.ai'))
  .get('/openapi.json', (c) => c.json(OpenAPIV1));

tsRestHonoApp.mount('/', async (request) => {
  return fetchRequestHandler({
    request,
    contract: ApiContractV1,
    router: ApiContractV1Implementation,
    options: {
      errorHandler: (err) => {
        if (err instanceof TsRestHttpError && err.statusCode === 500) {
          console.error(err);
        }
      },
    },
  });
});
