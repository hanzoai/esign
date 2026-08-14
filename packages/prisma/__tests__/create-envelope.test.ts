/**
 * Creating an envelope, end to end, on a real SQLite database.
 *
 * Two things have to hold for a document to get created at all:
 *
 *   1. Id allocation works on a database that has never allocated one.
 *   2. Nothing inside the create transaction reaches the global client. Base
 *      SQLite serves one write connection, so a second client waiting on the
 *      lock the transaction already holds stalls until the busy timeout and the
 *      transaction dies. Side effects that read on their own connection — the
 *      webhook — belong after the commit.
 *
 * Both failures are silent in unit tests that stub the database, so this runs
 * the REAL handler against the REAL migration.
 *
 * Run:  npx tsx --test packages/prisma/__tests__/create-envelope.test.ts
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { createEnvelope } from '@hanzo/esign-lib/server-only/envelope/create-envelope';
import { DEFAULT_DOCUMENT_EMAIL_SETTINGS } from '@hanzo/esign-lib/types/document-email';

import { prisma } from '../index';

let dir: string;
let userId: number;
let teamId: number;

const requestMetadata = {
  source: 'app',
  auth: null,
  requestMetadata: {},
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
} as never;

const seed = async () => {
  const user = await prisma.user.create({
    data: { email: 'owner@example.test', name: 'Owner', roles: ['USER'] },
  });

  const org = await prisma.organisation.create({
    data: {
      id: 'org-1',
      name: 'Org',
      url: 'org-1',
      type: 'ORGANISATION',
      owner: { connect: { id: user.id } },
      organisationClaim: {
        create: { id: 'claim-1', teamCount: 1, memberCount: 1, envelopeItemCount: 5, flags: {} },
      },
      organisationGlobalSettings: {
        create: { id: 'ogs-1', emailDocumentSettings: DEFAULT_DOCUMENT_EMAIL_SETTINGS },
      },
      organisationAuthenticationPortal: { create: { id: 'oap-1' } },
    },
  });

  const member = await prisma.organisationMember.create({
    data: {
      id: 'mbr-1',
      user: { connect: { id: user.id } },
      organisation: { connect: { id: org.id } },
    },
  });

  const group = await prisma.organisationGroup.create({
    data: {
      id: 'grp-1',
      type: 'INTERNAL_ORGANISATION',
      organisationRole: 'ADMIN',
      organisationId: org.id,
    },
  });

  await prisma.organisationGroupMember.create({
    data: {
      id: 'gm-1',
      group: { connect: { id: group.id } },
      organisationMember: { connect: { id: member.id } },
    },
  });

  const team = await prisma.team.create({
    data: {
      name: 'Team',
      url: 'team-1',
      organisation: { connect: { id: org.id } },
      teamGlobalSettings: { create: { id: 'tgs-1' } },
    },
  });

  await prisma.teamGroup.create({
    data: {
      id: 'tg-1',
      organisationGroup: { connect: { id: group.id } },
      team: { connect: { id: team.id } },
      teamRole: 'ADMIN',
    },
  });

  userId = user.id;
  teamId = team.id;
};

const newDocumentData = async (tag: string) => {
  const documentData = await prisma.documentData.create({
    data: { id: `dd-${tag}`, type: 'BYTES_64', data: 'JVBERi0=', initialData: 'JVBERi0=' },
  });

  return documentData.id;
};

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'esign-create-'));
  const dbPath = path.join(dir, 'sign.db');

  const migration = readFileSync(
    path.join(__dirname, '..', 'migrations', '0_init', 'migration.sql'),
    'utf8',
  );
  const raw = new DatabaseSync(dbPath);
  raw.exec('PRAGMA foreign_keys=ON');
  raw.exec(migration);
  raw.close();

  process.env.DATABASE_URL = `file:${dbPath}`;
  await prisma.$connect();
  await seed();
}, { timeout: 60_000 });

after(async () => {
  await prisma?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

describe('createEnvelope', () => {
  test('the first document on a fresh database is created', async () => {
    const envelope = await createEnvelope({
      userId,
      teamId,
      internalVersion: 2,
      requestMetadata,
      data: {
        type: 'DOCUMENT',
        title: 'First.pdf',
        envelopeItems: [{ documentDataId: await newDocumentData('a') }],
      },
    });

    assert.equal(envelope.title, 'First.pdf');
    assert.equal(envelope.secondaryId, 'document_1');
  });

  test('the next document gets the next id', async () => {
    const envelope = await createEnvelope({
      userId,
      teamId,
      internalVersion: 2,
      requestMetadata,
      data: {
        type: 'DOCUMENT',
        title: 'Second.pdf',
        envelopeItems: [{ documentDataId: await newDocumentData('b') }],
      },
    });

    assert.equal(envelope.secondaryId, 'document_2');
  });

  test('a template is created and counted separately', async () => {
    const envelope = await createEnvelope({
      userId,
      teamId,
      internalVersion: 2,
      requestMetadata,
      data: {
        type: 'TEMPLATE',
        title: 'Template.pdf',
        envelopeItems: [{ documentDataId: await newDocumentData('c') }],
      },
    });

    assert.equal(envelope.secondaryId, 'template_1');
  });
});
