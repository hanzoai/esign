/**
 * An organisation invitation joins the person it was sent to, and nobody else.
 *
 * Holding the link proves the invitation was received, not who received it, so
 * acceptance binds the signed-in person only when their verified address is the
 * invited one.
 *
 * Run:  npx tsx --test packages/lib/__tests__/invitation.test.ts
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { isInvitedPerson } from '../server-only/organisation/is-invited-person';

describe('isInvitedPerson', () => {
  const verified = new Date('2026-10-16T00:00:00Z');

  test('the invited address, verified', () => {
    assert.equal(isInvitedPerson({ email: 'z@hanzo.ai', emailVerified: verified }, 'z@hanzo.ai'), true);
  });

  test('case does not make a different person', () => {
    assert.equal(isInvitedPerson({ email: 'Z@Hanzo.ai', emailVerified: verified }, 'z@hanzo.ai'), true);
  });

  test('a different address is refused', () => {
    assert.equal(
      isInvitedPerson({ email: 'someone@example.com', emailVerified: verified }, 'z@hanzo.ai'),
      false,
    );
  });

  test('the invited address, never verified, is refused', () => {
    assert.equal(isInvitedPerson({ email: 'z@hanzo.ai', emailVerified: null }, 'z@hanzo.ai'), false);
  });
});
