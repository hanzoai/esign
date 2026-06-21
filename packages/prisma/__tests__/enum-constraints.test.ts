/**
 * Enum-domain enforcement tests.
 *
 * Prisma 6's `sqlite` provider stores every enum as a bare `TEXT` column with
 * NO CHECK constraint, so the migration appends BEFORE INSERT/UPDATE triggers
 * (generated from schema.prisma) that reconstruct the domain Postgres enforced
 * natively. These tests run the REAL migration against a real SQLite DB and
 * prove the triggers FAIL CLOSED: an out-of-domain enum value aborts the write.
 *
 * Run:  npx tsx --test packages/prisma/__tests__/enum-constraints.test.ts
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

let db: DatabaseSync;

before(() => {
  const migration = readFileSync(
    path.join(__dirname, '..', 'migrations', '0_init', 'migration.sql'),
    'utf8',
  );
  db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=OFF'); // isolate enum triggers from FK noise
  db.exec(migration);
});

describe('enum CHECK triggers — scalar columns fail closed', () => {
  test('valid User.identityProvider is accepted', () => {
    db.prepare(
      'INSERT INTO "User" (email, identityProvider, roles) VALUES (?, ?, ?)',
    ).run('ok@test', 'GOOGLE', '["USER"]');
  });

  test('invalid User.identityProvider is ABORTED', () => {
    assert.throws(
      () =>
        db
          .prepare('INSERT INTO "User" (email, identityProvider, roles) VALUES (?, ?, ?)')
          .run('bad@test', 'FACEBOOK', '["USER"]'),
      /invalid IdentityProvider/,
    );
  });

  test('UPDATE to an invalid enum is ABORTED (not just INSERT)', () => {
    db.prepare('INSERT INTO "User" (email, identityProvider, roles) VALUES (?, ?, ?)').run(
      'upd@test',
      'OIDC',
      '["USER"]',
    );
    assert.throws(
      () =>
        db
          .prepare('UPDATE "User" SET identityProvider = ? WHERE email = ?')
          .run('NOPE', 'upd@test'),
      /invalid IdentityProvider/,
    );
  });
});

describe('User.roles JSON list — Role domain fails closed', () => {
  test('a known Role list is accepted', () => {
    db.prepare('INSERT INTO "User" (email, roles) VALUES (?, ?)').run(
      'roles-ok@test',
      '["ADMIN","USER"]',
    );
  });

  test('a fabricated Role in the list is ABORTED', () => {
    // This is the auth-relevant guard: a privilege string that is not a real
    // Role can never be persisted, on INSERT...
    assert.throws(
      () =>
        db
          .prepare('INSERT INTO "User" (email, roles) VALUES (?, ?)')
          .run('roles-bad@test', '["SUPERADMIN"]'),
      /invalid Role in User\.roles/,
    );
  });

  test('...or on UPDATE', () => {
    db.prepare('INSERT INTO "User" (email, roles) VALUES (?, ?)').run('roles-upd@test', '["USER"]');
    assert.throws(
      () =>
        db.prepare('UPDATE "User" SET roles = ? WHERE email = ?').run('["ROOT"]', 'roles-upd@test'),
      /invalid Role in User\.roles/,
    );
  });

  test('a mix of valid + invalid still aborts (every element checked)', () => {
    assert.throws(
      () =>
        db
          .prepare('INSERT INTO "User" (email, roles) VALUES (?, ?)')
          .run('roles-mix@test', '["USER","HACKER"]'),
      /invalid Role in User\.roles/,
    );
  });
});

describe('User.roles SHAPE guard — non-array JSON fails closed', () => {
  // RED proved the domain trigger alone is insufficient: json_each() iterates a
  // JSON OBJECT's values, so '{"role":"ADMIN"}' passed the domain check ("ADMIN"
  // is in-domain) and a privilege string persisted in the wrong shape. The shape
  // guard (json_type != 'array') closes this. Cases that trip ONLY the shape
  // guard assert its exact message; cases that also violate the domain may abort
  // via either trigger (SQLite does not order same-event triggers), so those
  // assert only that the write aborts — both outcomes fail closed.

  test('a JSON OBJECT with an in-domain value is ABORTED (the RED hole)', () => {
    // Pre-fix: succeeded, because json_each iterates object VALUES and "ADMIN"
    // is a valid Role. Now the shape guard rejects it deterministically.
    assert.throws(
      () =>
        db
          .prepare('INSERT INTO "User" (email, roles) VALUES (?, ?)')
          .run('shape-obj@test', '{"role":"ADMIN"}'),
      /User\.roles must be a JSON array/,
    );
  });

  test('a JSON string scalar is ABORTED', () => {
    assert.throws(
      () =>
        db.prepare('INSERT INTO "User" (email, roles) VALUES (?, ?)').run('shape-str@test', '"ADMIN"'),
      /User\.roles must be a JSON array/,
    );
  });

  test('malformed JSON is ABORTED (fails closed)', () => {
    // `json_type('not json')` raises SQLite's own "malformed JSON" while the
    // trigger condition is evaluated — so the abort message is SQLite's, not
    // ours. Either way the write is rejected: a non-JSON roles value can never
    // persist. Assert the fail-closed outcome, not a specific message.
    assert.throws(() =>
      db.prepare('INSERT INTO "User" (email, roles) VALUES (?, ?)').run('shape-bad@test', 'not json'),
    );
  });

  test('a JSON array is ACCEPTED (positive control)', () => {
    db.prepare('INSERT INTO "User" (email, roles) VALUES (?, ?)').run('shape-arr@test', '["ADMIN"]');
    const row = db.prepare('SELECT roles FROM "User" WHERE email = ?').get('shape-arr@test') as {
      roles: string;
    };
    assert.equal(row.roles, '["ADMIN"]');
  });

  test('omitting roles uses the NOT NULL default (shape guard short-circuits on NULL)', () => {
    // `roles` is `NOT NULL DEFAULT '["USER"]'`; when the column is omitted the
    // WHEN `NEW.roles IS NOT NULL` clause is false and the default applies.
    db.prepare('INSERT INTO "User" (email) VALUES (?)').run('shape-default@test');
    const row = db.prepare('SELECT roles FROM "User" WHERE email = ?').get('shape-default@test') as {
      roles: string;
    };
    assert.equal(row.roles, '["USER"]');
  });

  test('a JSON object with an out-of-domain value also aborts (either trigger)', () => {
    // Shape AND domain both violated → SQLite may fire either BEFORE trigger
    // first; both RAISE(ABORT). Only the fail-closed outcome is asserted.
    assert.throws(
      () =>
        db
          .prepare('INSERT INTO "User" (email, roles) VALUES (?, ?)')
          .run('shape-obj-bad@test', '{"role":"SUPERADMIN"}'),
    );
  });

  test('UPDATE to a non-array roles is ABORTED (not just INSERT)', () => {
    db.prepare('INSERT INTO "User" (email, roles) VALUES (?, ?)').run('shape-upd@test', '["USER"]');
    assert.throws(
      () =>
        db
          .prepare('UPDATE "User" SET roles = ? WHERE email = ?')
          .run('{"role":"ADMIN"}', 'shape-upd@test'),
      /User\.roles must be a JSON array/,
    );
  });
});
