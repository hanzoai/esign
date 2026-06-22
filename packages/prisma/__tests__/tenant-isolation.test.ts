/**
 * Tenant-isolation proof for the single Base SQLite store.
 *
 * After the file-per-org design was found unimplementable (global identity
 * tables + a bootstrap paradox + 41/47 tables that scope only through
 * relations), org isolation is enforced by ONE row-level predicate reused by
 * every handler: `buildTeamWhereQuery({ teamId, userId })`. A team is reachable
 * only when the AUTHENTICATED user is a member through
 * `teamGroups → organisationGroup → organisationGroupMembers → organisationMember.userId`.
 *
 * This test stands up a REAL SQLite database from the real `0_init` migration,
 * seeds TWO independent organisation graphs (A and B) through the REAL Prisma
 * client, and proves:
 *
 *   1. org A's owner reaches org A's team        → 1 row
 *   2. org B's owner reaches org A's team        → 0 rows  (cross-tenant denied)
 *   3. a forged/non-member userId reaches it     → 0 rows  (no leak)
 *   4. the same predicate filters Envelopes so   → B sees 0 of A's documents
 *
 * If the predicate ever regresses to leak across orgs, cases 2–4 fail. This is
 * the whole security boundary, under test against the genuine ORM + engine.
 *
 * Run:  npx tsx --test packages/prisma/__tests__/tenant-isolation.test.ts
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { DEFAULT_DOCUMENT_EMAIL_SETTINGS } from '@hanzo/esign-lib/types/document-email';
import { buildTeamWhereQuery } from '@hanzo/esign-lib/utils/teams';

// The app's extended client + its codec are bound lazily to DATABASE_URL on
// first access (via `remember`), so `before()` sets DATABASE_URL to the temp DB
// BEFORE the first touch — this exercises the EXACT client the app uses, with
// the list-field codec active (so `roles: ['USER']` is encoded on write).
import { prisma } from '../index';

let dir: string;
let dbPath: string;

/**
 * Seed one complete, isolated organisation graph and return the ids a query
 * would key on: the owner user, and a team that owner can reach.
 *
 * The chain mirrors what `buildTeamWhereQuery` traverses:
 *   User → Organisation → OrganisationGroup → OrganisationMember
 *        → OrganisationGroupMember (member ∈ group)
 *        → Team → TeamGroup (team ↔ group)
 *        → Envelope (a document owned by the team)
 */
async function seedOrg(tag: string) {
  const user = await prisma.user.create({
    data: { email: `owner-${tag}@example.test`, name: `Owner ${tag}`, roles: ['USER'] },
  });

  const org = await prisma.organisation.create({
    data: {
      id: `org-${tag}`,
      name: `Org ${tag}`,
      url: `org-${tag}`,
      type: 'ORGANISATION',
      owner: { connect: { id: user.id } },
      organisationClaim: {
        create: {
          id: `claim-${tag}`,
          teamCount: 1,
          memberCount: 1,
          envelopeItemCount: 1,
          flags: {},
        },
      },
      organisationGlobalSettings: {
        create: { id: `ogs-${tag}`, emailDocumentSettings: DEFAULT_DOCUMENT_EMAIL_SETTINGS },
      },
      organisationAuthenticationPortal: { create: { id: `oap-${tag}` } },
    },
  });

  const member = await prisma.organisationMember.create({
    data: {
      id: `mbr-${tag}`,
      user: { connect: { id: user.id } },
      organisation: { connect: { id: org.id } },
    },
  });

  const group = await prisma.organisationGroup.create({
    data: {
      id: `grp-${tag}`,
      type: 'INTERNAL_ORGANISATION',
      organisationRole: 'ADMIN',
      organisationId: org.id,
    },
  });

  await prisma.organisationGroupMember.create({
    data: {
      id: `gm-${tag}`,
      group: { connect: { id: group.id } },
      organisationMember: { connect: { id: member.id } },
    },
  });

  const team = await prisma.team.create({
    data: {
      name: `Team ${tag}`,
      url: `team-${tag}`,
      organisation: { connect: { id: org.id } },
      teamGlobalSettings: { create: { id: `tgs-${tag}` } },
    },
  });

  await prisma.teamGroup.create({
    data: {
      id: `tg-${tag}`,
      organisationGroup: { connect: { id: group.id } },
      team: { connect: { id: team.id } },
      teamRole: 'ADMIN',
    },
  });

  const envelope = await prisma.envelope.create({
    data: {
      id: `env-${tag}`,
      secondaryId: `sec-${tag}`,
      type: 'DOCUMENT',
      source: 'DOCUMENT',
      title: `Doc ${tag}`,
      internalVersion: 1,
      user: { connect: { id: user.id } },
      team: { connect: { id: team.id } },
      documentMeta: { create: { id: `dm-${tag}` } },
    },
  });

  return { userId: user.id, teamId: team.id, envelopeId: envelope.id };
}

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'esign-iso-'));
  dbPath = path.join(dir, 'sign.db');

  // Build the schema from the real migration against a fresh file DB.
  const migration = readFileSync(
    path.join(__dirname, '..', 'migrations', '0_init', 'migration.sql'),
    'utf8',
  );
  const raw = new DatabaseSync(dbPath);
  raw.exec('PRAGMA foreign_keys=ON');
  raw.exec(migration);
  raw.close();

  // Point the (not-yet-constructed) app client at the temp DB, then force its
  // lazy construction by touching it.
  process.env.DATABASE_URL = `file:${dbPath}`;
  await prisma.$connect();
}, { timeout: 60_000 });

after(async () => {
  await prisma?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

describe('tenant isolation — buildTeamWhereQuery is the boundary', () => {
  let A: Awaited<ReturnType<typeof seedOrg>>;
  let B: Awaited<ReturnType<typeof seedOrg>>;

  test('seed two independent org graphs', async () => {
    A = await seedOrg('a');
    B = await seedOrg('b');
    assert.notEqual(A.teamId, B.teamId);
    assert.notEqual(A.userId, B.userId);
  });

  test('owner reaches OWN team (positive control)', async () => {
    const row = await prisma.team.findFirst({
      where: buildTeamWhereQuery({ teamId: A.teamId, userId: A.userId }),
    });
    assert.ok(row, 'org A owner must reach org A team');
    assert.equal(row.id, A.teamId);
  });

  test("org B owner CANNOT reach org A's team (cross-tenant denied)", async () => {
    const row = await prisma.team.findFirst({
      where: buildTeamWhereQuery({ teamId: A.teamId, userId: B.userId }),
    });
    assert.equal(row, null, 'CROSS-TENANT LEAK: org B reached org A team');
  });

  test('forged / non-member userId reaches nothing (no leak)', async () => {
    const row = await prisma.team.findFirst({
      where: buildTeamWhereQuery({ teamId: A.teamId, userId: 999_999 }),
    });
    assert.equal(row, null, 'LEAK: a non-member userId reached a team');
  });

  test('the SAME predicate scopes Envelopes — B sees 0 of A’s documents', async () => {
    // The handler shape: filter envelopes by a team the caller can reach.
    const asA = await prisma.envelope.findMany({
      where: { team: buildTeamWhereQuery({ teamId: A.teamId, userId: A.userId }) },
    });
    assert.equal(asA.length, 1, 'org A owner must see org A envelope');
    assert.equal(asA[0].id, A.envelopeId);

    const asB = await prisma.envelope.findMany({
      where: { team: buildTeamWhereQuery({ teamId: A.teamId, userId: B.userId }) },
    });
    assert.equal(asB.length, 0, 'CROSS-TENANT LEAK: org B read org A envelopes');
  });

  test('roles decode as a typed array through the codec (sanity)', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: A.userId } });
    assert.deepEqual(user.roles, ['USER']);
  });
});
