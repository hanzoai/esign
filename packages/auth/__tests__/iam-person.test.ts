/**
 * What a Hanzo IAM sign-in leads to.
 *
 * Every sign-in, returning or first, passes one admission rule: IAM says the
 * person administers the org the application serves, or an ADMIN vouches for
 * them through a membership or a pending invitation to their verified address.
 * `isAdmin` is IAM's "admin of the account's own org", so it counts only when
 * that org is the application's — an admin of a personal org of one is not an
 * admin of Hanzo.
 *
 * Run:  npx tsx --test packages/auth/__tests__/iam-person.test.ts
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { SignInRefusal } from '@hanzo/esign-lib/constants/auth';

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

  const admin = () => readIamPerson(userinfo(), sub);
  const member = (over: Record<string, unknown> = {}) =>
    readIamPerson(
      userinfo({ isAdmin: false, orgs: [{ org: 'hanzo', role: 'member' }], ...over }),
      sub,
    );

  const nobody = {
    linked: null,
    addressHeldByUnlinkedAccount: false,
    vouchedMembership: false,
    vouchedInvite: false,
  };
  const returning = { ...nobody, linked: { id: 7, disabled: false } };

  describe('a returning, linked person', () => {
    test('who is not an admin and whom no ADMIN vouches for is refused', () => {
      // Every account the old sign-in linked, with nothing from after the cutoff.
      assert.deepEqual(decideSignIn({ ...returning, person: member() }), {
        kind: 'refuse',
        reason: SignInRefusal.NotInvited,
      });
    });

    test('who administers the app org is let in', () => {
      assert.deepEqual(decideSignIn({ ...returning, person: admin() }), {
        kind: 'sign-in',
        userId: 7,
      });
    });

    test('who holds a membership an ADMIN invited them to is let in', () => {
      assert.deepEqual(
        decideSignIn({ ...returning, person: member(), vouchedMembership: true }),
        { kind: 'sign-in', userId: 7 },
      );
    });

    test('with a pending ADMIN invitation to their verified address is let in', () => {
      assert.deepEqual(decideSignIn({ ...returning, person: member(), vouchedInvite: true }), {
        kind: 'sign-in',
        userId: 7,
      });
    });

    test('with a pending invitation but an unverified address is refused', () => {
      assert.deepEqual(
        decideSignIn({
          ...returning,
          person: member({ email_verified: false }),
          vouchedInvite: true,
        }),
        { kind: 'refuse', reason: SignInRefusal.NotInvited },
      );
    });

    test('who is admitted is not asked about their address', () => {
      assert.deepEqual(
        decideSignIn({
          ...returning,
          person: member({ email_verified: false }),
          vouchedMembership: true,
        }),
        { kind: 'sign-in', userId: 7 },
      );
    });

    test('whom an admin disabled is refused, admitted or not', () => {
      assert.deepEqual(
        decideSignIn({ ...returning, person: admin(), linked: { id: 7, disabled: true } }),
        { kind: 'refuse', reason: SignInRefusal.Disabled },
      );
    });
  });

  describe('a first sign-in', () => {
    test('of an admin of the app org makes an account', () => {
      assert.deepEqual(decideSignIn({ ...nobody, person: admin() }), { kind: 'create' });
    });

    test('of a non-admin with no invitation is refused', () => {
      assert.deepEqual(decideSignIn({ ...nobody, person: member() }), {
        kind: 'refuse',
        reason: SignInRefusal.NotInvited,
      });
    });

    test('with an invitation an ADMIN vouches for makes an account', () => {
      assert.deepEqual(decideSignIn({ ...nobody, person: member(), vouchedInvite: true }), {
        kind: 'create',
      });
    });

    test('a membership cannot admit someone with no account', () => {
      assert.deepEqual(decideSignIn({ ...nobody, person: member(), vouchedMembership: true }), {
        kind: 'refuse',
        reason: SignInRefusal.NotInvited,
      });
    });

    test('at an address IAM has not verified is refused, admin or not', () => {
      assert.deepEqual(
        decideSignIn({ ...nobody, person: readIamPerson(userinfo({ email_verified: false }), sub) }),
        { kind: 'refuse', reason: SignInRefusal.UnverifiedEmail },
      );
    });

    test('at an address held by an account never linked to this identity is refused', () => {
      assert.deepEqual(
        decideSignIn({ ...nobody, person: admin(), addressHeldByUnlinkedAccount: true }),
        { kind: 'refuse', reason: SignInRefusal.UnlinkedAccount },
      );
    });
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
