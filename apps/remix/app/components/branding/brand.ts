import { env } from '@hanzo/esign-lib/utils/env';

/**
 * The tenant's wordmark, read at runtime so one image serves every tenant.
 *
 *   NEXT_PUBLIC_APP_NAME           whole wordmark, e.g. "Hanzo Sign" | "Acme Sign"
 *   NEXT_PUBLIC_APP_NAME_PRIMARY   first word (defaults to the first word of APP_NAME)
 *   NEXT_PUBLIC_APP_NAME_SUFFIX    the rest (defaults to the rest of APP_NAME)
 *
 * `env` reads `window.__ENV__` in the browser, so these are deployment values,
 * never baked into the bundle. This is the one place the wordmark is resolved.
 */
export const brand = (): { name: string; primary: string; suffix: string } => {
  const name = env('NEXT_PUBLIC_APP_NAME') || 'Hanzo Sign';
  const [firstWord, ...rest] = name.split(' ');

  return {
    name,
    primary: env('NEXT_PUBLIC_APP_NAME_PRIMARY') || firstWord || name,
    suffix: env('NEXT_PUBLIC_APP_NAME_SUFFIX') || rest.join(' '),
  };
};
