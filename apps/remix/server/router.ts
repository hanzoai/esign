import { Hono } from 'hono';
import { contextStorage } from 'hono/context-storage';
import { cors } from 'hono/cors';
import type { RequestIdVariables } from 'hono/request-id';
import { requestId } from 'hono/request-id';
import type { Logger } from 'pino';

import { tsRestHonoApp } from '@hanzo/esign-api/hono';
import { auth } from '@hanzo/esign-auth/server';
import { jobsClient } from '@hanzo/esign-lib/jobs/client';
import { LicenseClient } from '@hanzo/esign-lib/server-only/license/license-client';
import { createRateLimitMiddleware } from '@hanzo/esign-lib/server-only/rate-limit/rate-limit-middleware';
import {
  aiRateLimit,
  apiV1RateLimit,
  apiV2RateLimit,
  fileUploadRateLimit,
} from '@hanzo/esign-lib/server-only/rate-limit/rate-limits';
import { TelemetryClient } from '@hanzo/esign-lib/server-only/telemetry/telemetry-client';
import { migrateDeletedAccountServiceAccount } from '@hanzo/esign-lib/server-only/user/service-accounts/deleted-account';
import { migrateLegacyServiceAccount } from '@hanzo/esign-lib/server-only/user/service-accounts/legacy-service-account';
import { env } from '@hanzo/esign-lib/utils/env';
import { logger } from '@hanzo/esign-lib/utils/logger';
import openApiDocument from '@hanzo/esign-trpc/zap/gen/openapi.json';

import { aiRoute } from './api/ai/route';
import { downloadRoute } from './api/download/download';
import { filesRoute } from './api/files/files';
import { type AppContext, appContext } from './context';
import { appMiddleware } from './middleware';

export interface HonoEnv {
  Variables: RequestIdVariables & {
    context: AppContext;
    logger: Logger;
  };
}

const app = new Hono<HonoEnv>();

/**
 * Database-backed rate limiting for API routes.
 */
const apiV1RateLimitMiddleware = createRateLimitMiddleware(apiV1RateLimit);
const apiV2RateLimitMiddleware = createRateLimitMiddleware(apiV2RateLimit);
const aiRateLimitMiddleware = createRateLimitMiddleware(aiRateLimit);
const fileRateLimitMiddleware = createRateLimitMiddleware(fileUploadRateLimit);

/**
 * Attach session and context to requests.
 */
app.use(contextStorage());
app.use(appContext);

/**
 * RR7 app middleware.
 */
app.use('*', appMiddleware);
app.use('*', requestId());
app.use(async (c, next) => {
  const metadata = c.get('context').requestMetadata;

  const honoLogger = logger.child({
    requestId: c.var.requestId,
    requestPath: c.req.path,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });

  c.set('logger', honoLogger);

  await next();
});

// Apply cors and rate limits to API routes.
app.use(`/api/v1/*`, cors());
app.use('/api/v1/*', apiV1RateLimitMiddleware);
app.use(`/api/v2/*`, cors());
app.use('/api/v2/*', apiV2RateLimitMiddleware);
app.use(`/api/v2-beta/*`, cors());
app.use('/api/v2-beta/*', apiV2RateLimitMiddleware);

// Auth server.
app.route('/api/auth', auth);

// Files route.
app.use('/api/files/upload-pdf', fileRateLimitMiddleware);
app.use('/api/files/presigned-post-url', fileRateLimitMiddleware);
app.route('/api/files', filesRoute);

// AI route.
app.use('/api/ai/*', aiRateLimitMiddleware);
app.route('/api/ai', aiRoute);

// API servers.
app.route('/api/v1', tsRestHonoApp);
app.use('/api/jobs/*', jobsClient.getApiHandler());

// Unstable API server routes. The /api/v2 + /api/v2-beta REST surface is served
// over JSON-over-HTTP ZAP, mounted on the http.Server in main.js (serveZapHttpApi).
// httpServe terminates only its POST routes there, so these GET specs and the GET
// download routes still reach Hono.
app.get(`/api/v2/openapi.json`, (c) => c.json(openApiDocument));
app.route(`/api/v2`, downloadRoute);

app.get(`/api/v2-beta/openapi.json`, (c) => c.json(openApiDocument));
app.route(`/api/v2-beta`, downloadRoute);

// Start telemetry client for anonymous usage tracking.
// Can be disabled by setting SIGN_DISABLE_TELEMETRY=true
if (env('NODE_ENV') !== 'development') {
  void TelemetryClient.start();
}

// Start license client to verify license on startup.
void LicenseClient.start();

// Start cron scheduler for background jobs (e.g. envelope expiration sweep).
// No-op for Inngest provider which handles cron externally.
jobsClient.startCron();

void migrateDeletedAccountServiceAccount();
void migrateLegacyServiceAccount();

export default app;
