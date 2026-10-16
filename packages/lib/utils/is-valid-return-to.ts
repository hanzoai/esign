import { NEXT_PUBLIC_WEBAPP_URL } from '@hanzo/esign-lib/constants/app';

/**
 * The path on this app a `returnTo` names, or undefined when it names anywhere
 * else.
 *
 * Accepted: a path (`/documents?x=1`) or an absolute URL on the app's own
 * origin, returned as its path. Refused: anything that resolves to another
 * host, and anything a browser could read as one — a path beginning `//` or
 * `/\` once dot segments, encodings and stray characters are resolved
 * (`/.//evil.com`, `/%2F%2Fevil.com`, `/\evil.com`), backslashes and control
 * characters anywhere.
 */
export const normalizeReturnTo = (returnTo?: string): string | undefined => {
  if (!returnTo) {
    return undefined;
  }

  let decoded: string;

  try {
    decoded = decodeURIComponent(returnTo);
  } catch {
    return undefined;
  }

  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.startsWith('//')) {
    return undefined;
  }

  const origin = new URL(NEXT_PUBLIC_WEBAPP_URL()).origin;

  let url: URL;

  try {
    url = new URL(decoded, origin);
  } catch {
    return undefined;
  }

  if (url.origin !== origin) {
    return undefined;
  }

  const path = `${url.pathname}${url.search}${url.hash}`;

  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) {
    return undefined;
  }

  return path;
};

/** Whether `returnTo` names a path on this app (see normalizeReturnTo). */
export const isValidReturnTo = (returnTo?: string): boolean =>
  normalizeReturnTo(returnTo) !== undefined;
