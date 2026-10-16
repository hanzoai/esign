/**
 * What a Hanzo IAM sign-in leads to.
 *
 * A returning person is found by their linked IAM identity and let in unless
 * disabled. A first sign-in makes an account only for someone who was asked in:
 * an admin of the org the application serves, or a person an ADMIN invited
 * under IAM-only sign-in. `isAdmin` is IAM's "admin of the account's own org",
 * so it counts only when that org is the application's — an admin of a
 * personal org of one is not an admin of Hanzo.
 *
 * Run:  npx tsx --test packages/auth/__tests__/iam-person.test.ts
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { SignInRefusal } from '@hanzo/esign-lib/constants/auth';
import { IAM_ONLY_SINCE } from '@hanzo/esign-lib/utils/iam-sign-in';

import {
  administersAppOrg,
  decideSignIn,
  readIamPerson,
  rolesFor,
} from '../server/lib/utils/iam-person';

const userinfo = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  sub: 'b474eaa5-e000-474d-b317-c37bbd9a6945',
  email: 'a@hanzo.ai',
  email_verified: true,
  name: 'a',
  displayName: 'A',
  owner: 'hanzo',
  isAdmin: true,
  orgs: [{ org: 'hanzo', role: 'admin' }],
  ...over,
});

describe('readIamPerson', () => {
  test('reads the person IAM described', () => {
    const person = readIamPerson(userinfo(), 'b474eaa5-e000-474d-b317-c37bbd9a6945');

    assert.equal(person.email, 'a@hanzo.ai');
    assert.equal(person.emailVerified, true);
    assert.equal(person.name, 'A');
    assert.equal(person.owner, 'hanzo');
    assert.deepEqual(person.orgs, [{ org: 'hanzo', role: 'admin' }]);
  });

  test('refuses userinfo for a different subject than the id_token', () => {
    assert.throws(() => readIamPerson(userinfo(), 'someone-else'));
  });

  test('refuses userinfo without an email', () => {
    assert.throws(() =>
      readIamPerson(userinfo({ email: undefined }), 'b474eaa5-e000-474d-b317-c37bbd9a6945'),
    );
  });

  test('an address IAM has not proved is unverified, whatever shape the claim takes', () => {
    for (const email_verified of [false, 'true', 1, undefined, null]) {
      const person = readIamPerson(
        userinfo({ email_verified }),
        'b474eaa5-e000-474d-b317-c37bbd9a6945',
      );

      assert.equal(person.emailVerified, false, String(email_verified));
    }
  });
});

describe('administersAppOrg', () => {
  const sub = 'b474eaa5-e000-474d-b317-c37bbd9a6945';

  test('an admin whose account lives in the app org', () => {
    assert.equal(administersAppOrg(readIamPerson(userinfo(), sub)), true);
  });

  test('an owner whose account lives in the app org', () => {
    const person = readIamPerson(userinfo({ orgs: [{ org: 'hanzo', role: 'owner' }] }), sub);

    assert.equal(administersAppOrg(person), true);
  });

  test('a member of the app org is not', () => {
    const person = readIamPerson(
      userinfo({ isAdmin: false, orgs: [{ org: 'hanzo', role: 'member' }] }),
      sub,
    );

    assert.equal(administersAppOrg(person), false);
  });

  test('the admin of a personal org is not, even with a membership in the app org', () => {
    const person = readIamPerson(
      userinfo({
        orgs: [
          { org: 'gilbert-mooy2', role: 'admin' },
          { org: 'hanzo', role: 'admin' },
        ],
      }),
      sub,
    );

    assert.equal(administersAppOrg(person), false);
  });

  test('isAdmin without the admin role in the app org is not', () => {
    const person = readIamPerson(userinfo({ orgs: [{ org: 'hanzo', role: 'member' }] }), sub);

    assert.equal(administersAppOrg(person), false);
  });

  test('no owner claim is not', () => {
    const person = readIamPerson(userinfo({ owner: undefined }), sub);

    assert.equal(administersAppOrg(person), false);
  });

  test('no orgs is not', () => {
    const person = readIamPerson(userinfo({ orgs: undefined }), sub);

    assert.equal(administersAppOrg(person), false);
  });
});

describe('decideSignIn', () => {
  const sub = 'b474eaa5-e000-474d-b317-c37bbd9a6945';
  const before = new Date(IAM_ONLY_SINCE.getTime() - 1);
  const after = new Date(IAM_ONLY_SINCE.getTime() + 1);

  const admin = () => readIamPerson(userinfo(), sub);
  const member = (over: Record<string, unknown> = {}) =>
    readIamPerson(
      userinfo({ isAdmin: false, orgs: [{ org: 'hanzo', role: 'member' }], ...over }),
      sub,
    );

  const first = { linked: null, addressHeldByUnlinkedAccount: false, invites: [] };

  test('a returning linked person is let in without their address being asked about', () => {
    const decision = decideSignIn({
      ...first,
      person: member({ email_verified: false }),
      linked: { id: 7, disabled: false },
    });

    assert.deepEqual(decision, { kind: 'sign-in', userId: 7 });
  });

  test('a returning linked person an admin disabled is refused', () => {
    const decision = decideSignIn({
      ...first,
      person: admin(),
      linked: { id: 7, disabled: true },
    });

    assert.deepEqual(decision, { kind: 'refuse', reason: SignInRefusal.Disabled });
  });

  test('a new admin of the app org gets an account', () => {
    assert.deepEqual(decideSignIn({ ...first, person: admin() }), { kind: 'create' });
  });

  test('a new non-admin with no invitation is refused', () => {
    assert.deepEqual(decideSignIn({ ...first, person: member() }), {
      kind: 'refuse',
      reason: SignInRefusal.NotInvited,
    });
  });

  test('an invitation from an ADMIN, sent under IAM-only sign-in, makes an account', () => {
    const decision = decideSignIn({
      ...first,
      person: member(),
      invites: [{ createdAt: after, inviterIsAdmin: true }],
    });

    assert.deepEqual(decision, { kind: 'create' });
  });

  test('an invitation from a sender who is not ADMIN makes no account', () => {
    const decision = decideSignIn({
      ...first,
      person: member(),
      invites: [{ createdAt: after, inviterIsAdmin: false }],
    });

    assert.deepEqual(decision, { kind: 'refuse', reason: SignInRefusal.NotInvited });
  });

  test('an invitation from before IAM-only sign-in makes no account, whoever sent it', () => {
    const decision = decideSignIn({
      ...first,
      person: member(),
      invites: [{ createdAt: before, inviterIsAdmin: true }],
    });

    assert.deepEqual(decision, { kind: 'refuse', reason: SignInRefusal.NotInvited });
  });

  test('a first sign-in at an address IAM has not verified is refused, admin or not', () => {
    const decision = decideSignIn({
      ...first,
      person: readIamPerson(userinfo({ email_verified: false }), sub),
    });

    assert.deepEqual(decision, { kind: 'refuse', reason: SignInRefusal.UnverifiedEmail });
  });

  test('an address held by an account never linked to this identity is refused, admin or not', () => {
    const decision = decideSignIn({
      ...first,
      person: admin(),
      addressHeldByUnlinkedAccount: true,
    });

    assert.deepEqual(decision, { kind: 'refuse', reason: SignInRefusal.UnlinkedAccount });
  });
});

describe('rolesFor', () => {
  const sub = 'b474eaa5-e000-474d-b317-c37bbd9a6945';

  test('an admin of the app org holds ADMIN', () => {
    assert.deepEqual(rolesFor(readIamPerson(userinfo(), sub), ['USER']), ['USER', 'ADMIN']);
  });

  test('a person IAM no longer calls an admin loses ADMIN', () => {
    const person = readIamPerson(
      userinfo({ isAdmin: false, orgs: [{ org: 'hanzo', role: 'member' }] }),
      sub,
    );

    assert.deepEqual(rolesFor(person, ['USER', 'ADMIN']), ['USER']);
  });
});
