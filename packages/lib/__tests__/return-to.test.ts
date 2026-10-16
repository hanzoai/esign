/**
 * Where a sign-in may send the browser afterwards: a path on this app, or
 * nowhere. Anything a browser could read as another host is refused.
 *
 * Run:  npx tsx --test packages/lib/__tests__/return-to.test.ts
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { isValidReturnTo, normalizeReturnTo } from '../utils/is-valid-return-to';

describe('normalizeReturnTo', () => {
  const origin = 'http://localhost:3000';

  test('a path on this app', () => {
    assert.equal(normalizeReturnTo('/documents?page=2#top'), '/documents?page=2#top');
  });

  test('an absolute URL on this app becomes its path', () => {
    assert.equal(normalizeReturnTo(`${origin}/settings`), '/settings');
  });

  test('an encoded path on this app', () => {
    assert.equal(normalizeReturnTo(encodeURIComponent('/t/team/documents')), '/t/team/documents');
  });

  for (const hostile of [
    '//evil.com',
    '/.//evil.com',
    '/..//evil.com',
    '/%2F%2Fevil.com',
    '%2F%2Fevil.com',
    '/\\evil.com',
    '/%5Cevil.com',
    '\\\\evil.com',
    '/\t/evil.com',
    '/%09/evil.com',
    'https://evil.com/',
    'https://localhost:3000.evil.com/',
    `${origin}@evil.com/`,
    'javascript:alert(1)',
    '%E0%A4%A',
  ]) {
    test(`refuses ${JSON.stringify(hostile)}`, () => {
      assert.equal(normalizeReturnTo(hostile), undefined);
      assert.equal(isValidReturnTo(hostile), false);
    });
  }

  test('a bare word is a path on this app, not a host', () => {
    assert.equal(normalizeReturnTo('evil.com'), '/evil.com');
  });
});
