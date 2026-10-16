import { type ErrorHandler, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { NEXT_PUBLIC_WEBAPP_URL } from '@hanzo/esign-lib/constants/app';
import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';
import { extractRequestMetadata } from '@hanzo/esign-lib/universal/extract-request-metadata';

import { HanzoAuthOptions } from './config';
import { setCsrfCookie } from './lib/session/session-cookies';
import { handleOAuthCallbackUrl } from './lib/utils/handle-oauth-callback-url';
import { accountRoute } from './routes/account';
import { oauthRoute } from './routes/oauth';
import { sessionRoute } from './routes/session';
import { signOutRoute } from './routes/sign-out';
import { twoFactorRoute } from './routes/two-factor';
import type { HonoAuthContext } from './types/context';

// Note: You must chain routes for Hono RPC client to work.
export const auth = new Hono<HonoAuthContext>()
  .use(async (c, next) => {
    c.set('requestMetadata', extractRequestMetadata(c.req.raw));

    const validOrigin = new URL(NEXT_PUBLIC_WEBAPP_URL()).origin;
    const headerOrigin = c.req.header('Origin');

    if (headerOrigin && headerOrigin !== validOrigin) {
      return c.json(
        {
          message: 'Forbidden',
          statusCode: 403,
        },
        403,
      );
    }

    await next();
  })
  .get('/csrf', async (c) => {
    const csrfToken = await setCsrfCookie(c);

    return c.json({ csrfToken });
  })
  .route('/', sessionRoute)
  .route('/', signOutRoute)
  .route('/', accountRoute)
  .route('/oauth', oauthRoute)
  .route('/two-factor', twoFactorRoute);

/**
 * Handle errors.
 */
const onAuthError: ErrorHandler<HonoAuthContext> = (err, c) => {
  if (err instanceof HTTPException) {
    return c.json(
      {
        code: AppErrorCode.UNKNOWN_ERROR,
        message: err.message,
        statusCode: err.status,
      },
      err.status,
    );
  }

  if (err instanceof AppError) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const statusCode = (err.statusCode || 500) as ContentfulStatusCode;

    return c.json(
      {
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
      },
      statusCode,
    );
  }

  // Handle other errors
  console.error('Unknown Error:', err);
  return c.json(
    {
      code: AppErrorCode.UNKNOWN_ERROR,
      message: 'Internal Server Error',
      statusCode: 500,
    },
    500,
  );
};

auth.onError(onAuthError);

/**
 * Hanzo IAM sign-in returns the browser here, mounted at /auth/callback: the one
 * callback path IAM registers for every host, so the redirect_uri it holds for
 * this app needs no per-app spelling.
 */
export const hanzoCallbackRoute = new Hono<HonoAuthContext>()
  .use(async (c, next) => {
    c.set('requestMetadata', extractRequestMetadata(c.req.raw));

    await next();
  })
  .get('/', async (c) => handleOAuthCallbackUrl({ c, clientOptions: HanzoAuthOptions }));

hanzoCallbackRoute.onError(onAuthError);

export type AuthAppType = typeof auth;
