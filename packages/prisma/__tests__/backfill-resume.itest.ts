/**
 * Backfill crash-resume integration test (RED P1-D).
 *
 * Proves the Postgres→SQLite backfill (`scripts/backfill-pg-to-sqlite.ts`) is
 * exactly idempotent across an interrupted run: copy 1000 rows, SIGKILL the
 * process mid-table (~row 500), re-run to completion, and assert the SQLite
 * target holds all 1000 rows — no duplicates, no missed rows. This exercises
 * the keyset cursor (`WHERE pk > cursor`) + `INSERT OR IGNORE` that replaced
 * OFFSET pagination, against the REAL script as a child process (not a copy).
 *
 * It also covers the COMPOSITE-primary-key path (RateLimit) — the one table in
 * the schema whose keyset cursor is a multi-column row value.
 *
 * Requires a reachable Postgres. The harness sets BACKFILL_TEST_PG_URL; if it
 * is set but unreachable the test FAILS (it does not silently pass). Locally:
 *   docker run -d --name pg -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test \
 *     -e POSTGRES_DB=signtest -p 55432:5432 ghcr.io/hanzoai/sql:latest
 *   BACKFILL_TEST_PG_URL=postgres://test:test@localhost:55432/signtest \
 *     npx tsx --test packages/prisma/__tests__/backfill-resume.test.ts
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { Client } from 'pg';

const PG_URL = process.env.BACKFILL_TEST_PG_URL;
const SCRIPT = path.join(__dirname, '..', '..', '..', 'scripts', 'backfill-pg-to-sqlite.ts');
const MIGRATION = path.join(__dirname, '..', 'migrations', '0_init', 'migration.sql');
// Enough rows that, at --batch=100, the copy spans many commits and is reliably
// caught mid-flight by the interrupt poll (a tiny table would finish in one page
// before the test could SIGKILL it).
const ROWS = 10_000;

let dir: string;
let sqlitePath: string;
let pg: Client;

/** Run the real backfill script as a child; return a handle that can be killed. */
function runBackfill(extraEnv: Record<string, string> = {}) {
  const child = spawn(
    process.execPath,
    [require.resolve('tsx/cli'), SCRIPT, '--batch=100'],
    {
      env: {
        ...process.env,
        PG_URL: PG_URL as string,
        SQLITE_PATH: sqlitePath,
        MIGRATION_SQL: MIGRATION,
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  // Capture stderr so a non-zero exit surfaces the cause instead of a bare code.
  let stderr = '';
  child.stderr.on('data', (b) => (stderr += b.toString()));
  const exited = new Promise<{ code: number | null; stderr: string }>((resolve) =>
    child.on('exit', (code) => resolve({ code, stderr })),
  );
  return { child, exited };
}

/** Rows copied into the SQLite progress table for `table`, or 0 if not started. */
function copiedSoFar(table: string): number {
  if (!existsSync(sqlitePath)) return 0; // child has not created the file yet
  // Open read-only so a concurrent writer (the child) is never blocked.
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const row = db
      .prepare('SELECT copied FROM "_backfill_progress" WHERE "table" = ?')
      .get(table) as { copied: number } | undefined;
    return row?.copied ?? 0;
  } catch {
    return 0; // progress table not created yet
  } finally {
    db.close();
  }
}

before(async () => {
  assert.ok(PG_URL, 'BACKFILL_TEST_PG_URL must be set for the backfill integration test');
  dir = mkdtempSync(path.join(tmpdir(), 'esign-backfill-'));
  sqlitePath = path.join(dir, 'sign.db');

  pg = new Client({ connectionString: PG_URL });
  await pg.connect();

  // Source tables that mirror the real schema's two keyset cases — a single-PK
  // table (User) and the one composite-PK table (RateLimit, PK key/action/bucket
  // where bucket is a DATETIME). Columns are the migration's REQUIRED set (NOT
  // NULL, no default); the rest take their SQLite defaults on insert. Drop first
  // for a clean run. The text[] roles column proves the array→JSON codec path.
  await pg.query('DROP TABLE IF EXISTS "User"');
  await pg.query('DROP TABLE IF EXISTS "RateLimit"');
  // User.id is `Int @id @default(autoincrement())` in the real schema (SQLite:
  // INTEGER PRIMARY KEY) — integer keyset, the common case. RateLimit's PK is the
  // composite (key, action, bucket) where bucket is a DateTime — multi-column
  // keyset, the one composite case in the schema.
  await pg.query(`CREATE TABLE "User" (
    "id" INTEGER PRIMARY KEY,
    "email" TEXT NOT NULL,
    "roles" TEXT[] NOT NULL DEFAULT ARRAY['USER']::TEXT[]
  )`);
  await pg.query(`CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "bucket" TIMESTAMP NOT NULL,
    PRIMARY KEY ("key", "action", "bucket")
  )`);

  // Deterministic rows. User ids 1..ROWS (integer PK). Zero-padded RateLimit keys
  // so lexical order is total, with a distinct per-row bucket timestamp so the
  // composite key is unique and its keyset cursor advances monotonically.
  const base = Date.UTC(2026, 0, 1);
  for (let i = 0; i < ROWS; i += 500) {
    const users: string[] = [];
    const limits: string[] = [];
    const uVals: unknown[] = [];
    const lVals: unknown[] = [];
    for (let j = 0; j < 500 && i + j < ROWS; j++) {
      const n = i + j;
      users.push(`($${uVals.length + 1}, $${uVals.length + 2})`);
      uVals.push(n + 1, `u-${String(n).padStart(6, '0')}@example.test`);
      limits.push(`($${lVals.length + 1}, $${lVals.length + 2}, $${lVals.length + 3})`);
      lVals.push(`k-${String(n).padStart(6, '0')}`, 'SEND', new Date(base + n * 1000).toISOString());
    }
    await pg.query(`INSERT INTO "User" ("id", "email") VALUES ${users.join(', ')}`, uVals);
    await pg.query(
      `INSERT INTO "RateLimit" ("key", "action", "bucket") VALUES ${limits.join(', ')}`,
      lVals,
    );
  }
}, { timeout: 120_000 });

after(async () => {
  await pg?.query('DROP TABLE IF EXISTS "User"').catch(() => {});
  await pg?.query('DROP TABLE IF EXISTS "RateLimit"').catch(() => {});
  await pg?.end().catch(() => {});
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('backfill — keyset resume is exactly idempotent across a crash', () => {
  test('SIGKILL mid-User, re-run, end with all rows and zero duplicates', { timeout: 120_000 }, async () => {
    // Run 1: SIGKILL the child the instant it has committed at least one page of
    // "User" but not the whole table. Tight poll (no sleep) so a fast local copy
    // is still caught mid-flight; the partial state must be a real committed page.
    const first = runBackfill();
    let killed = false;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const n = copiedSoFar('User');
      if (n > 0 && n < ROWS) {
        first.child.kill('SIGKILL');
        killed = true;
        break;
      }
      if (first.child.exitCode !== null) break; // exited before we could interrupt
      await sleep(2);
    }
    await first.exited;
    assert.ok(killed, 'expected to interrupt the backfill mid-User (raise ROWS if flaky)');

    const partial = copiedSoFar('User');
    assert.ok(partial > 0 && partial < ROWS, `expected a partial copy, got ${partial}`);

    // Run 2: resume to completion from the recorded cursor.
    const second = runBackfill();
    const { code, stderr } = await second.exited;
    assert.equal(code, 0, `resumed backfill must exit 0; stderr:\n${stderr}`);

    // Verify the SQLite target: every row present, exactly once, none missed.
    const db = new DatabaseSync(sqlitePath, { readOnly: true });
    try {
      for (const table of ['User', 'RateLimit']) {
        const { c } = db.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get() as { c: number };
        assert.equal(c, ROWS, `${table}: expected ${ROWS} rows, got ${c} (missed or duplicated)`);
      }

      // No duplicate primary keys (OR IGNORE must have absorbed re-copies).
      const dupUsers = db
        .prepare('SELECT COUNT(*) AS c FROM (SELECT "id" FROM "User" GROUP BY "id" HAVING COUNT(*) > 1)')
        .get() as { c: number };
      assert.equal(dupUsers.c, 0, 'User has duplicate ids');

      const dupLimits = db
        .prepare(
          'SELECT COUNT(*) AS c FROM (SELECT "key","action","bucket" FROM "RateLimit" ' +
            'GROUP BY "key","action","bucket" HAVING COUNT(*) > 1)',
        )
        .get() as { c: number };
      assert.equal(dupLimits.c, 0, 'RateLimit has duplicate composite keys');

      // No missed rows: the integer id set is exactly the contiguous 1..ROWS
      // range we inserted (MIN=1, MAX=ROWS, COUNT(DISTINCT)=ROWS ⇒ no gap).
      const { lo, hi, uniq } = db
        .prepare('SELECT MIN("id") AS lo, MAX("id") AS hi, COUNT(DISTINCT "id") AS uniq FROM "User"')
        .get() as { lo: number; hi: number; uniq: number };
      assert.equal(lo, 1);
      assert.equal(hi, ROWS);
      assert.equal(uniq, ROWS, 'gap in the User id range — a row was skipped');

      // roles round-tripped from PG text[] to a JSON array (codec contract).
      const sample = db.prepare('SELECT "roles" FROM "User" WHERE "id" = ?').get(42) as {
        roles: string;
      };
      assert.deepEqual(JSON.parse(sample.roles), ['USER']);
    } finally {
      db.close();
    }
  });

  test('a third run over a fully-copied DB is a clean no-op', { timeout: 60_000 }, async () => {
    const { exited } = runBackfill();
    const { code, stderr } = await exited;
    assert.equal(code, 0, `idempotent re-run over a complete copy must exit 0; stderr:\n${stderr}`);

    const db = new DatabaseSync(sqlitePath, { readOnly: true });
    try {
      const { c } = db.prepare('SELECT COUNT(*) AS c FROM "User"').get() as { c: number };
      assert.equal(c, ROWS, 'a no-op re-run must not change the row count');
    } finally {
      db.close();
    }
  });
});
