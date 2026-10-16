/**
 * Who a Hanzo IAM sign-in may make an account for.
 *
 * The callback reads IAM's userinfo answer and makes an account on a first
 * sign-in only for someone who was asked in. One half of that is read here: the
 * person administers the org the application serves. `isAdmin` is IAM's "admin
 * of the account's own org", so it must count only when that org is the
 * application's — an admin of a personal org of one is not an admin of Hanzo.
 *
 * Run:  npx tsx --test packages/auth/__tests__/iam-person.test.ts
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { administersAppOrg, readIamPerson } from '../server/lib/utils/iam-person';

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
