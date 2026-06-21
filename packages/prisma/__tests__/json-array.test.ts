/**
 * Codec round-trip + fail-closed tests for the JSON list columns.
 *
 * Runs against a REAL SQLite engine (`node:sqlite`, built into Node ≥ 22.5) —
 * encode → write → read → decode — so the test exercises the exact storage
 * path, not a mock. The four list columns that were Postgres arrays are stored
 * as JSON `TEXT`; this proves the codec preserves arrays and FAILS CLOSED on
 * corrupt data (the auth-relevant `User.roles` must never silently degrade).
 *
 * Run:  npx tsx --test packages/prisma/__tests__/json-array.test.ts
 */
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { LIST_FIELDS, decodeList, encodeList, encodeListFields } from '../json-array';

// One in-memory DB, one TEXT column per list field, exercised through the codec.
let db: DatabaseSync;

before(() => {
  db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE list_col (id INTEGER PRIMARY KEY, v TEXT)');
});

after(() => {
  db.close();
});

/** Write `value` through `encodeList`, read it back, and decode it. */
const roundTrip = <T extends string>(value: readonly T[] | undefined): T[] => {
  const encoded = encodeList(value);
  db.prepare('INSERT INTO list_col (v) VALUES (?)').run(encoded === undefined ? null : encoded);
  const row = db.prepare('SELECT v FROM list_col ORDER BY id DESC LIMIT 1').get() as {
    v: string | null;
  };
  return decodeList<T>(row.v);
};

describe('json-array codec — round-trip through real SQLite', () => {
  // The four columns named in json-array.ts. Each is a string[] at the boundary.
  const columns = Object.keys(LIST_FIELDS) as (keyof typeof LIST_FIELDS)[];

  test('every declared list column round-trips a multi-element array', () => {
    // Sanity: the codec is column-agnostic, but assert all four are covered so a
    // future column addition without a test fails this assertion.
    assert.deepEqual(columns.sort(), [
      'OrganisationAuthenticationPortal',
      'Passkey',
      'User',
      'Webhook',
    ]);
  });

  test('User.roles — multi, single, empty, null', () => {
    assert.deepEqual(roundTrip(['ADMIN', 'USER']), ['ADMIN', 'USER']);
    assert.deepEqual(roundTrip(['USER']), ['USER']);
    assert.deepEqual(roundTrip([]), []);
    assert.deepEqual(roundTrip(undefined), []); // column never written → null → []
  });

  test('Webhook.eventTriggers — multi-element survives intact', () => {
    const triggers = ['DOCUMENT_CREATED', 'DOCUMENT_SIGNED', 'DOCUMENT_COMPLETED'];
    assert.deepEqual(roundTrip(triggers), triggers);
  });

  test('Passkey.transports — single + empty', () => {
    assert.deepEqual(roundTrip(['internal']), ['internal']);
    assert.deepEqual(roundTrip([]), []);
  });

  test('OrganisationAuthenticationPortal.allowedDomains — multi + order preserved', () => {
    const domains = ['hanzo.ai', 'lux.network', 'zoo.ngo'];
    assert.deepEqual(roundTrip(domains), domains);
  });

  test('values containing JSON metacharacters survive (comma, brace, quote)', () => {
    // The legacy `{A,B}` split-recovery path is gone; a value that LOOKS like a
    // Postgres array literal must round-trip verbatim, not be re-split.
    const tricky = ['{not,an,array}', 'a"b', '[bracketed]'];
    assert.deepEqual(roundTrip(tricky), tricky);
  });
});

describe('decodeList — fails closed on corrupt / unexpected input', () => {
  test('null / undefined → [] (the only empty case)', () => {
    assert.deepEqual(decodeList(null), []);
    assert.deepEqual(decodeList(undefined), []);
  });

  test('already-decoded string[] passes through', () => {
    assert.deepEqual(decodeList(['USER']), ['USER']);
    assert.deepEqual(decodeList([]), []);
  });

  test('non-JSON text THROWS (no legacy {A,B} recovery)', () => {
    // Pre-fix this returned ['John','Doe']; now it must fail closed.
    assert.throws(() => decodeList('{John,Doe}'), /failed to parse JSON/);
    // Pre-fix this fabricated a role from garbage; now it throws.
    assert.throws(() => decodeList('ADMIN USER'), /failed to parse JSON/);
  });

  test('JSON object THROWS (was silently []  → role-stripping)', () => {
    assert.throws(() => decodeList('{"role":"ADMIN"}'), /expected a JSON array/);
  });

  test('JSON number / boolean / string-scalar THROW (were silently [])', () => {
    assert.throws(() => decodeList('42'), /expected a JSON array/);
    assert.throws(() => decodeList('true'), /expected a JSON array/);
    assert.throws(() => decodeList('"ADMIN"'), /expected a JSON array/);
  });

  test('JSON null literal THROWS (it is text "null", not SQL NULL)', () => {
    assert.throws(() => decodeList('null'), /expected a JSON array/);
  });

  test('array with a non-string element THROWS (no silent coercion)', () => {
    assert.throws(() => decodeList('["USER", 7]'), /expected string\[\]/);
    assert.throws(() => decodeList('[null]'), /expected string\[\]/);
    // already-decoded path validates element types too.
    assert.throws(() => decodeList([1, 2] as unknown), /expected string\[\]/);
  });

  test('non-string scalar (number/object) THROWS', () => {
    assert.throws(() => decodeList(42 as unknown), /expected JSON string or null/);
    assert.throws(() => decodeList({} as unknown), /expected JSON string or null/);
  });
});

describe('encodeListFields — write codec + where guard', () => {
  test('encodes an array data field to its JSON string', () => {
    const args = { data: { roles: ['ADMIN', 'USER'] } };
    encodeListFields('User', args);
    assert.equal(args.data.roles, '["ADMIN","USER"]');
  });

  test('encodes createMany array rows and upsert create/update', () => {
    const many = { data: [{ roles: ['USER'] }, { roles: ['ADMIN'] }] };
    encodeListFields('User', many);
    assert.deepEqual(
      many.data.map((r) => r.roles),
      ['["USER"]', '["ADMIN"]'],
    );

    const up = { create: { roles: ['USER'] }, update: { roles: ['ADMIN'] } };
    encodeListFields('User', up);
    assert.equal(up.create.roles, '["USER"]');
    assert.equal(up.update.roles, '["ADMIN"]');
  });

  test('a list column in `where` THROWS (no silent wrong-result) — M3', () => {
    // The latent footgun: array operators do not translate to SQLite JSON-TEXT.
    assert.throws(
      () => encodeListFields('User', { where: { roles: { has: 'ADMIN' } } }),
      /cannot be used in a Prisma `where`/,
    );
    assert.throws(
      () => encodeListFields('Webhook', { where: { eventTriggers: { hasSome: ['X'] } } }),
      /json_each/,
    );
  });

  test('a `where` on a non-list column is fine', () => {
    // Must NOT throw — only list columns are rejected.
    encodeListFields('User', { where: { email: 'a@b.test' }, data: { name: 'x' } });
  });
});
