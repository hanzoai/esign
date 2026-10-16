import { createRateLimit } from './rate-limit';

// ---- Auth (Tier 1 - Critical, sends emails) ----

export const request2FAEmailRateLimit = createRateLimit({
  action: 'auth.request-2fa-email',
  max: 5,
  globalMax: 20,
  window: '15m',
});

// ---- API (Tier 4 - Standard) ----

export const apiV1RateLimit = createRateLimit({
  action: 'api.v1',
  max: 100,
  window: '1m',
});

export const apiV2RateLimit = createRateLimit({
  action: 'api.v2',
  max: 100,
  window: '1m',
});

export const apiTrpcRateLimit = createRateLimit({
  action: 'api.trpc',
  max: 100,
  window: '1m',
});

export const aiRateLimit = createRateLimit({
  action: 'api.ai',
  max: 3,
  window: '1m',
});

export const fileUploadRateLimit = createRateLimit({
  action: 'api.file-upload',
  max: 20,
  window: '1m',
});
