/**
 * Embed layout response headers: framing from hanzo.team is allowed,
 * arbitrary origins are never framed, and Access-Control-Allow-Origin is
 * never wildcard.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { headers } from '../_layout';

const headersOf = (origin?: string) =>
  headers({
    loaderHeaders: new Headers(origin ? { origin } : {}),
  });

describe('embed headers', () => {
  test('frame-ancestors allows self and https://hanzo.team', () => {
    const csp = headersOf().get('Content-Security-Policy');
    assert.ok(csp?.includes("frame-ancestors 'self'"));
    assert.ok(csp?.includes('https://hanzo.team'));
  });

  test('frame-ancestors does not allow arbitrary origins', () => {
    const csp = headersOf('https://evil.example.com').get('Content-Security-Policy');
    assert.ok(csp!.includes("frame-ancestors 'self' https://hanzo.team"));
    assert.ok(!csp!.includes('*'));
  });

  test('Access-Control-Allow-Origin is never *', () => {
    assert.notEqual(headersOf().get('Access-Control-Allow-Origin'), '*');
    assert.notEqual(headersOf('https://evil.example.com').get('Access-Control-Allow-Origin'), '*');
  });

  test('Access-Control-Allow-Origin reflects the request origin', () => {
    assert.equal(headersOf('https://hanzo.team').get('Access-Control-Allow-Origin'), 'https://hanzo.team');
    assert.equal(headersOf(undefined).get('Access-Control-Allow-Origin'), null);
  });
});
