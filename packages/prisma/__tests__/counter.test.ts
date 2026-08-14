/**
 * Envelope id allocation against a fresh database.
 *
 * `0_init` creates `Counter` with no rows, so allocation has to establish the
 * row it counts on. This test runs the REAL migration into a temp SQLite file
 * and calls the REAL allocators: the first document is 1, ids rise by one, and
 * documents and templates count independently.
 *
 * Run:  npx tsx --test packages/prisma/__tests__/counter.test.ts
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import {
  incrementDocumentId,
  incrementTemplateId,
} from '@hanzo/esign-lib/server-only/envelope/increment-id';

import { prisma } from '../index';

let dir: string;

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'esign-counter-'));
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

describe('envelope id allocation on a fresh database', () => {
  test('the migration seeds no counters', async () => {
    assert.equal(await prisma.counter.count(), 0);
  });

  test('the first document id is 1', async () => {
    const { documentId } = await incrementDocumentId();
    assert.equal(documentId, 1);
  });

  test('each document id is one higher', async () => {
    assert.equal((await incrementDocumentId()).documentId, 2);
    assert.equal((await incrementDocumentId()).documentId, 3);
  });

  test('templates count independently of documents', async () => {
    assert.equal((await incrementTemplateId()).templateId, 1);
    assert.equal((await incrementTemplateId()).templateId, 2);
    assert.equal((await incrementDocumentId()).documentId, 4);
  });
});
