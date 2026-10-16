/**
 * What survives the move to IAM-only sign-in.
 *
 * A session or API token issued before IAM_ONLY_SINCE was issued under the old
 * sign-in rules and is not honoured; neither is a session whose user is
 * disabled or not linked to an IAM identity.
 *
 * Run:  npx tsx --test packages/lib/__tests__/iam-sign-in.test.ts
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  IAM_ONLY_SINCE,
  apiTokenIsCurrent,
  issuedUnderIamOnly,
  sessionIsCurrent,
} from '../utils/iam-sign-in';

const before = new Date(IAM_ONLY_SINCE.getTime() - 1);
const after = new Date(IAM_ONLY_SINCE.getTime() + 1);

describe('issuedUnderIamOnly', () => {
  test('the instant itself counts', () => {
    assert.equal(issuedUnderIamOnly(IAM_ONLY_SINCE), true);
  });

  test('a millisecond before does not', () => {
    assert.equal(issuedUnderIamOnly(before), false);
  });
});

describe('sessionIsCurrent', () => {
  const current = { createdAt: after, disabled: false, linkedToIam: true };

  test('a session issued under IAM-only sign-in to a linked, enabled user', () => {
    assert.equal(sessionIsCurrent(current), true);
  });

  test('a session from before IAM-only sign-in is refused', () => {
    assert.equal(sessionIsCurrent({ ...current, createdAt: before }), false);
  });

  test('a disabled user is refused', () => {
    assert.equal(sessionIsCurrent({ ...current, disabled: true }), false);
  });

  test('a user with no IAM link is refused', () => {
    assert.equal(sessionIsCurrent({ ...current, linkedToIam: false }), false);
  });
});

describe('apiTokenIsCurrent', () => {
  test('a token minted under IAM-only sign-in to an enabled user', () => {
    assert.equal(apiTokenIsCurrent({ createdAt: after, disabled: false }), true);
  });

  test('a token from before IAM-only sign-in is refused', () => {
    assert.equal(apiTokenIsCurrent({ createdAt: before, disabled: false }), false);
  });

  test("a disabled holder's token is refused", () => {
    assert.equal(apiTokenIsCurrent({ createdAt: after, disabled: true }), false);
  });
});
