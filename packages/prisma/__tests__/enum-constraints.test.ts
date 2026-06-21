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
