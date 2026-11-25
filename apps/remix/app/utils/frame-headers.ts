/**
 * Framing and embed response headers shared between the Remix root route and
 * the v0 embed layout. Kept free of React/JSX and bundler path aliases so
 * Node's test runner can exercise it directly.
 */
export const FRAME_ANCESTORS_CSP = "frame-ancestors 'self' https://hanzo.team";

export function buildRootHeaders(loaderHeaders: Headers): Headers {
  const headers = new Headers();
  headers.set(
    'Content-Security-Policy',
    loaderHeaders.get('Content-Security-Policy') ?? FRAME_ANCESTORS_CSP,
  );
  return headers;
}

export function buildEmbedHeaders(loaderHeaders: Headers): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Security-Policy': FRAME_ANCESTORS_CSP,
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
  });
  const origin = loaderHeaders.get('Origin');
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  return headers;
}
