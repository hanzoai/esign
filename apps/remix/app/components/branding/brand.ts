import { env } from '@hanzo/esign-lib/utils/env';

/**
 * The tenant's wordmark and company, read at runtime so one image serves every tenant.
 *
 *   NEXT_PUBLIC_APP_NAME       the wordmark, e.g. "Hanzo eSign" | "Acme Sign"
 *   NEXT_PUBLIC_COMPANY_NAME   the holder of the copyright line, e.g. "Hanzo AI, Inc."
 *
 * `env` reads `window.__ENV__` in the browser, so these are deployment values,
 * never baked into the bundle. This is the one place they are resolved.
 */
export const appName = () => env('NEXT_PUBLIC_APP_NAME') || 'Hanzo eSign';

export const companyName = () => env('NEXT_PUBLIC_COMPANY_NAME') || 'Hanzo AI, Inc.';
