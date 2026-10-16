/**
 * Who esign admits, and whose credentials keep working.
 *
 * One rule: an IAM admin of the app's org, or someone an ADMIN vouches for —
 * through a membership or a pending invitation. An invitation or membership
 * from before the cutoff carries no sender, and vouches for nobody. A session
 * or API token works only while its holder (for a team token, the
 * organisation's owner) is linked to IAM, not disabled, and admitted.
 *
 * Run:  npx tsx --test packages/lib/__tests__/iam-sign-in.test.ts
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { Admission } from '../utils/iam-sign-in';
import { credentialIsCurrent, isAdmitted, vouches } from '../utils/iam-sign-in';

describe('vouches — whether an invitation may admit, or be accepted', () => {
  test('an ADMIN who is not disabled vouches', () => {
    assert.equal(vouches({ roles: ['USER', 'ADMIN'], disabled: false }), true);
  });

  test('no sender (an invitation or membership from before the cutoff) vouches for nobody', () => {
    assert.equal(vouches(null), false);
  });

  test('a sender who is not ADMIN now does not vouch', () => {
    assert.equal(vouches({ roles: ['USER'], disabled: false }), false);
  });

  test('a disabled ADMIN does not vouch', () => {
    assert.equal(vouches({ roles: ['USER', 'ADMIN'], disabled: true }), false);
  });
});

describe('isAdmitted', () => {
  const none: Admission = { iamAdmin: false, vouchedMembership: false, vouchedInvite: false };

  test('nobody vouching admits nobody', () => {
    assert.equal(isAdmitted(none), false);
  });

  for (const key of ['iamAdmin', 'vouchedMembership', 'vouchedInvite'] as const) {
    test(`${key} alone admits`, () => {
      assert.equal(isAdmitted({ ...none, [key]: true }), true);
    });
  }
});

describe('credentialIsCurrent — sessions and API tokens', () => {
  const admitted = { iamAdmin: false, vouchedMembership: true, vouchedInvite: false };
  const current = { disabled: false, linkedToIam: true, admission: admitted };

  test('a linked, enabled, admitted holder', () => {
    assert.equal(credentialIsCurrent(current), true);
  });

  test('a holder never linked to IAM is refused', () => {
    assert.equal(credentialIsCurrent({ ...current, linkedToIam: false }), false);
  });

  test('a disabled holder is refused', () => {
    assert.equal(credentialIsCurrent({ ...current, disabled: true }), false);
  });

  test('a holder no longer admitted is refused', () => {
    assert.equal(
      credentialIsCurrent({
        ...current,
        admission: { iamAdmin: false, vouchedMembership: false, vouchedInvite: false },
      }),
      false,
    );
  });
});
