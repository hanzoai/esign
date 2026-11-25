/**
 * Root and embed layout response headers: framing from hanzo.team is allowed,
 * arbitrary origins are never framed, X-Frame-Options is never sent, and
 * Access-Control-Allow-Origin is never wildcard.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  FRAME_ANCESTORS_CSP,
  buildEmbedHeaders,
  buildRootHeaders,
} from '../../../../utils/frame-headers';

const embedHeadersOf = (origin?: string) =>
  buildEmbedHeaders(new Headers(origin ? { origin } : {}));

describe('root headers', () => {
  test('emits CSP frame-ancestors allowing self and https://hanzo.team', () => {
    const res = buildRootHeaders(
      new Headers({ 'Content-Security-Policy': FRAME_ANCESTORS_CSP }),
    );
    assert.equal(res.get('Content-Security-Policy'), "frame-ancestors 'self' https://hanzo.team");
    assert.equal(res.get('X-Frame-Options'), null);
  });

  test('falls back to frame-ancestors policy when loaderHeaders omits CSP', () => {
    const res = buildRootHeaders(new Headers());
    assert.equal(res.get('Content-Security-Policy'), "frame-ancestors 'self' https://hanzo.team");
    assert.equal(res.get('X-Frame-Options'), null);
  });
});

describe('embed headers', () => {
  test('frame-ancestors allows self and https://hanzo.team', () => {
    const res = embedHeadersOf();
    const csp = res.get('Content-Security-Policy');
    assert.ok(csp?.includes("frame-ancestors 'self'"));
    assert.ok(csp?.includes('https://hanzo.team'));
    assert.equal(res.get('X-Frame-Options'), null);
  });

  test('frame-ancestors does not allow arbitrary origins', () => {
    const csp = embedHeadersOf('https://evil.example.com').get('Content-Security-Policy');
    assert.equal(csp, "frame-ancestors 'self' https://hanzo.team");
    assert.ok(!csp!.includes('*'));
  });

  test('Access-Control-Allow-Origin is never *', () => {
    assert.notEqual(embedHeadersOf().get('Access-Control-Allow-Origin'), '*');
    assert.notEqual(
      embedHeadersOf('https://evil.example.com').get('Access-Control-Allow-Origin'),
      '*',
    );
  });

  test('Access-Control-Allow-Origin reflects the request origin when present', () => {
    assert.equal(
      embedHeadersOf('https://hanzo.team').get('Access-Control-Allow-Origin'),
      'https://hanzo.team',
    );
    assert.equal(embedHeadersOf(undefined).get('Access-Control-Allow-Origin'), null);
  });
});
