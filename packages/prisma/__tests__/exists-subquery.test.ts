/**
 * EXISTS subqueries must name a column.
 *
 * Postgres accepts `select from "T"`; SQLite rejects it with a syntax error at
 * `from`. Every `exists(...)` therefore ends in `.select(sql.lit(1).as('one'))`.
 * These run the REAL queries against a real SQLite database built from the real
 * migration, so a subquery that forgets its select list fails here.
 *
 * Run:  npx tsx --test packages/prisma/__tests__/exists-subquery.test.ts
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { adminFindUnsealedDocuments } from '@hanzo/esign-lib/server-only/admin/admin-find-unsealed-documents';
import {
  getOrganisationInsights,
  getSigningVolume,
} from '@hanzo/esign-lib/server-only/admin/get-signing-volume';

import { prisma } from '../index';

let dir: string;

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'esign-exists-'));
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
}, { timeout: 60_000 });

after(async () => {
  await prisma?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

describe('queries built on EXISTS run on SQLite', () => {
  test('the seal sweep finds its candidates', async () => {
    const { run } = await import(
      '@hanzo/esign-lib/jobs/definitions/internal/seal-document-sweep.handler'
    );

    await run({
      payload: {},
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      io: { logger: { info: () => {}, error: () => {} } } as never,
    });
  });

  test('unsealed documents', async () => {
    const { data } = await adminFindUnsealedDocuments({});
    assert.deepEqual(data, []);
  });

  test('signing volume, searched', async () => {
    const { organisations } = await getSigningVolume({ search: 'acme' });
    assert.deepEqual(organisations, []);
  });

  test('organisation insights, searched', async () => {
    const { organisations } = await getOrganisationInsights({ search: 'acme' });
    assert.deepEqual(organisations, []);
  });
});
