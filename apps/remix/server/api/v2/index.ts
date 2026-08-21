// The v2 REST face over the ZAP service.
//
// Every row of ./routes becomes one Hono route that reads the request the way
// its method implies — path and query for GET, JSON or multipart for POST —
// and calls the SAME entry in zapRoutes the WebSocket server calls. One service
// implementation, reached two ways.
//
// Auth is mint('apiV2', request): the bearer token or session cookie the ZAP
// upgrade resolves, taken per request here instead of once per socket. Errors
// come back as the AppError JSON a v2 client already parses, under the status
// AppError carries.
import type { Context } from 'hono';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';
import { toWireError } from '@hanzo/esign-trpc/zap/runtime/error';
import type { ZapContext } from '@hanzo/esign-trpc/zap/server/context';
import { mint } from '@hanzo/esign-trpc/zap/server/mint';
import { zapRoutes } from '@hanzo/esign-trpc/zap/server/routes';

import type { HonoEnv } from '../../router';
import type { Route } from './routes';
import { routes } from './routes';

/** OpenAPI `/envelope/{envelopeId}` -> Hono `/envelope/:envelopeId`. */
const toHonoPath = (path: string) => path.replace(/\{(\w+)\}/g, ':$1');

/**
 * The procedure input this request carries. A GET spells it out in the path and
 * query; a POST carries it as multipart (the four endpoints that upload PDFs)
 * or as a JSON body.
 */
const readInput = async (c: Context<HonoEnv>, route: Route) => {
  if (route.method === 'GET') {
    return { ...c.req.query(), ...c.req.param() };
  }

  if (route.form) {
    return await c.req.formData();
  }

  const body = await c.req.text();

  if (body === '') {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new AppError(AppErrorCode.INVALID_BODY, { message: 'Request body is not valid JSON' });
  }
};

export const v2Route = new Hono<HonoEnv>();

for (const route of routes) {
  const handler: ((ctx: ZapContext, input: unknown) => unknown) | undefined = zapRoutes[route.call];

  if (!handler) {
    throw new Error(`v2 route ${route.method} ${route.path} names no procedure: ${route.call}`);
  }

  const serve = async (c: Context<HonoEnv>) => {
    const ctx = await mint('apiV2', c.req.raw);

    if (!ctx) {
      return c.json(
        { code: AppErrorCode.UNAUTHORIZED, message: 'Invalid or missing API token' },
        401,
      );
    }

    try {
      const output = await handler(ctx, await readInput(c, route));

      // A procedure that returns nothing answers 200 with an empty body.
      return output === undefined ? c.body(null) : c.json(output);
    } catch (err) {
      const { status, errorJson } = toWireError(err);

      return c.body(errorJson, status as ContentfulStatusCode, {
        'content-type': 'application/json',
      });
    }
  };

  const path = toHonoPath(route.path);

  if (route.method === 'GET') {
    v2Route.get(path, serve);
  } else {
    v2Route.post(path, serve);
  }
}
