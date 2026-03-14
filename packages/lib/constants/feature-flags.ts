import { env } from '@hanzo/sign-lib/utils/env';

import { NEXT_PUBLIC_WEBAPP_URL } from './app';

const NEXT_PUBLIC_INSIGHTS_KEY = () => env('NEXT_PUBLIC_INSIGHTS_KEY');

/**
 * The flag name for global session recording feature flag.
 */
export const FEATURE_FLAG_GLOBAL_SESSION_RECORDING = 'global_session_recording';

/**
 * Extract the Insights configuration from the environment.
 */
export function extractInsightsConfig(): { key: string; host: string } | null {
  const insightsKey = NEXT_PUBLIC_INSIGHTS_KEY();
  const insightsHost = `${NEXT_PUBLIC_WEBAPP_URL()}/ingest`;

  if (!insightsKey || !insightsHost) {
    return null;
  }

  return {
    key: insightsKey,
    host: insightsHost,
  };
}
