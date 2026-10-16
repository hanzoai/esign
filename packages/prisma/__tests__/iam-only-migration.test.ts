/**
 * Migration 1_iam_only_sign_in is the cutoff for IAM-only sign-in.
 *
 * It deletes every session and API token — all issued under the old sign-in
 * rules — and adds the columns that record who sent an invitation and who
 * invited a member, NULL for every row already standing, so nothing from before
 * it vouches for anyone. These tests run the REAL migrations (0_init, then this
 * one) against a real SQLite database that holds rows from before it.
 *
 * Run:  npx tsx --test packages/prisma/__tests__/iam-only-migration.test.ts
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

const migration = (name: string) =>
  readFileSync(path.join(__dirname, '..', 'migrations', name, 'migration.sql'), 'utf8');

const count = (db: DatabaseSync, table: string) =>
  Number((db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number }).n);

let db: DatabaseSync;

before(() => {
  db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=OFF'); // seed the rows below without their whole graph
  db.exec(migration('0_init'));

  db.prepare('INSERT INTO "User" (id, email, roles) VALUES (?, ?, ?)').run(1, 'a@hanzo.ai', '["USER"]');
  db.prepare('INSERT INTO "User" (id, email, roles) VALUES (?, ?, ?)').run(2, 'b@hanzo.ai', '["USER"]');
  db.prepare(
    'INSERT INTO "Session" (id, sessionToken, userId, expiresAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
  ).run('s1', 's1', 1, Date.now() + 86_400_000, Date.now());
  db.prepare('INSERT INTO "ApiToken" (name, token, userId, teamId) VALUES (?, ?, ?, ?)').run(
    'ci',
    'hash',
    1,
    1,
  );
  db.prepare(
    'INSERT INTO "OrganisationMemberInvite" (id, email, token, organisationId, organisationRole) VALUES (?, ?, ?, ?, ?)',
  ).run('inv1', 'b@hanzo.ai', 'tok', 'org1', 'MEMBER');
  db.prepare(
    'INSERT INTO "OrganisationMember" (id, userId, organisationId, updatedAt) VALUES (?, ?, ?, ?)',
  ).run('mem1', 2, 'org1', Date.now());

  db.exec(migration('1_iam_only_sign_in'));
  db.exec('PRAGMA foreign_keys=ON');
});

describe('1_iam_only_sign_in', () => {
  test('deletes every session', () => {
    assert.equal(count(db, 'Session'), 0);
  });

  test('deletes every API token', () => {
    assert.equal(count(db, 'ApiToken'), 0);
  });

  test('keeps the people, invitations and memberships themselves', () => {
    assert.equal(count(db, 'User'), 2);
    assert.equal(count(db, 'OrganisationMemberInvite'), 1);
    assert.equal(count(db, 'OrganisationMember'), 1);
  });

  test('an invitation from before it has no sender', () => {
    const row = db.prepare('SELECT inviterId FROM "OrganisationMemberInvite" WHERE id = ?').get('inv1');

    assert.deepEqual({ ...(row as object) }, { inviterId: null });
  });

  test('a membership from before it has no inviter', () => {
    const row = db.prepare('SELECT invitedById FROM "OrganisationMember" WHERE id = ?').get('mem1');

    assert.deepEqual({ ...(row as object) }, { invitedById: null });
  });

  test('deleting a sender clears what they vouched for rather than the rows', () => {
    db.prepare('UPDATE "OrganisationMemberInvite" SET inviterId = 1 WHERE id = ?').run('inv1');
    db.prepare('UPDATE "OrganisationMember" SET invitedById = 1 WHERE id = ?').run('mem1');
    db.prepare('DELETE FROM "User" WHERE id = ?').run(1);

    const invite = db.prepare('SELECT inviterId FROM "OrganisationMemberInvite" WHERE id = ?').get('inv1');
    const member = db.prepare('SELECT invitedById FROM "OrganisationMember" WHERE id = ?').get('mem1');

    assert.deepEqual({ ...(invite as object) }, { inviterId: null });
    assert.deepEqual({ ...(member as object) }, { invitedById: null });
  });
});
