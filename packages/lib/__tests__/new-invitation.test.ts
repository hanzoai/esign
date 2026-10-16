/**
 * Every invitation is a fresh row from the person sending it: a resend is a new
 * invitation from the resender, never an old one re-stamped.
 *
 * Run:  npx tsx --test packages/lib/__tests__/new-invitation.test.ts
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { newInvitation } from '../server-only/organisation/new-invitation';

describe('newInvitation', () => {
  const old = {
    id: 'member_invite_old',
    email: 'invitee@example.com',
    organisationId: 'org_1',
    organisationRole: 'MEMBER' as const,
    token: 'old-token',
    inviterId: 3,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  test('a resend carries the same invitee, organisation and role', () => {
    const fresh = newInvitation(old, 9);

    assert.equal(fresh.email, old.email);
    assert.equal(fresh.organisationId, old.organisationId);
    assert.equal(fresh.organisationRole, old.organisationRole);
  });

  test('a resend has its own id and token, so the old link stops working', () => {
    const fresh = newInvitation(old, 9);

    assert.notEqual(fresh.id, old.id);
    assert.notEqual(fresh.token, old.token);
    assert.equal(fresh.token.length, 32);
  });

  test('a resend is sent now, by the resender', () => {
    const before = Date.now();
    const fresh = newInvitation(old, 9);

    assert.equal(fresh.inviterId, 9);
    assert.ok(fresh.createdAt.getTime() >= before);
  });

  test('two invitations never share a token', () => {
    assert.notEqual(newInvitation(old, 9).token, newInvitation(old, 9).token);
  });
});
