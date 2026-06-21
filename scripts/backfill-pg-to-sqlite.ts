/**
 * Backfill: Postgres `sign` database → the single Base SQLite store.
 *
 * The Postgres→SQLite cutover (PR #7) starts every deploy on a FRESH empty
 * `sign.db`; without this, existing users/documents/signatures vanish. This
 * script copies every row from the live Postgres database into a SQLite file
 * built from the `0_init` migration, preserving ids and foreign keys.
 *
 * It is idempotent and resumable: a `_backfill_progress` control table in the
 * target SQLite records, per source table, how many rows have been copied. A
 * re-run skips completed tables and resumes a partially-copied one from its
 * recorded offset. SQLite triggers are disabled during the load (the data is
 * already-validated Postgres rows) and re-enabled implicitly when the DB is
 * reopened by the app.
 *
 * Transformations:
 *   - `text[]` / `_text` array columns (User.roles, Webhook.eventTriggers,
 *     Passkey.transports, OrganisationAuthenticationPortal.allowedDomains) are
 *     JSON-stringified to match the SQLite JSON-TEXT codec.
 *   - `json` / `jsonb` columns are serialised to their JSON text.
 *   - `boolean` → 0/1, `timestamp` → epoch-ms (SQLite stores DATETIME as ms),
 *     `bytea` → Buffer (BLOB). Enums pass through as their TEXT label (the
 *     migration's enum CHECK triggers validate them; pre-existing PG rows are
 *     already in-domain).
 *
 * Usage:
 *   PG_URL=postgres://user:pass@host:5432/sign \
 *   SQLITE_PATH=/opt/hanzo-sign/base/data/_dev/sign.db \
 *   MIGRATION_SQL=packages/prisma/migrations/0_init/migration.sql \
 *   npx tsx scripts/backfill-pg-to-sqlite.ts [--batch=1000] [--fresh]
 *
 *   --fresh : drop + recreate the SQLite file from the migration before loading
 *             (otherwise an existing file is reused and the backfill resumes).
 *
 * `pg` is required at runtime (declared as a devDependency of @hanzo/sign-prisma).
 */
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';
import { Client } from 'pg';

type Arg = { batch: number; fresh: boolean };

const parseArgs = (argv: string[]): Arg => {
  let batch = 1000;
  let fresh = false;
  for (const a of argv) {
    if (a === '--fresh') fresh = true;
    else if (a.startsWith('--batch='))
      batch = Math.max(1, Number(a.slice('--batch='.length)) || 1000);
  }
  return { batch, fresh };
};

const env = (key: string, fallback?: string): string => {
  const v = process.env[key] ?? fallback;
  if (!v) throw new Error(`${key} is required`);
  return v;
};

/** The four array columns that become JSON-TEXT in SQLite. */
const ARRAY_COLUMNS: Record<string, Set<string>> = {
  User: new Set(['roles']),
  Webhook: new Set(['eventTriggers']),
  Passkey: new Set(['transports']),
  OrganisationAuthenticationPortal: new Set(['allowedDomains']),
};

/**
 * Read the FK-safe table order straight from the migration: tables are emitted
 * in dependency order by Prisma, so inserting in `CREATE TABLE` order satisfies
 * foreign keys without a topological sort.
 */
const tableOrderFromMigration = (sql: string): string[] => {
  const order: string[] = [];
  for (const m of sql.matchAll(/CREATE TABLE "([A-Za-z_][A-Za-z0-9_]*)"/g)) {
    if (!order.includes(m[1])) order.push(m[1]);
  }
  return order;
};

/** Coerce a Postgres value into what node:sqlite can bind (no objects/bools). */
const toSqlite = (table: string, column: string, value: unknown): unknown => {
  if (value === null || value === undefined) return null;

  if (ARRAY_COLUMNS[table]?.has(column)) {
    // pg returns text[] as a JS array → JSON-encode to match the read codec.
    return JSON.stringify(Array.isArray(value) ? value : []);
  }

  if (Array.isArray(value)) return JSON.stringify(value);
  if (value instanceof Date) return value.getTime(); // DATETIME stored as epoch-ms
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (Buffer.isBuffer(value)) return value; // bytea → BLOB
  if (typeof value === 'object') return JSON.stringify(value); // json/jsonb

  return value as string | number | bigint;
};

async function main() {
  const { batch, fresh } = parseArgs(process.argv.slice(2));
  const pgUrl = env('PG_URL');
  const sqlitePath = env('SQLITE_PATH');
  const migrationPath = env('MIGRATION_SQL', 'packages/prisma/migrations/0_init/migration.sql');

  const migration = readFileSync(migrationPath, 'utf8');
  const tables = tableOrderFromMigration(migration);

  if (fresh && existsSync(sqlitePath)) {
    unlinkSync(sqlitePath);
    console.log(`[backfill] --fresh: removed existing ${sqlitePath}`);
  }

  const freshFile = !existsSync(sqlitePath);
  const db = new DatabaseSync(sqlitePath);
  db.exec('PRAGMA foreign_keys=OFF'); // bulk load; PG data is already consistent
  db.exec('PRAGMA journal_mode=WAL');

  if (freshFile) {
    db.exec(migration);
    console.log(`[backfill] applied migration to fresh ${sqlitePath} (${tables.length} tables)`);
  }

  db.exec(
    'CREATE TABLE IF NOT EXISTS "_backfill_progress" (' +
      '"table" TEXT PRIMARY KEY, "copied" INTEGER NOT NULL DEFAULT 0, "done" INTEGER NOT NULL DEFAULT 0)',
  );
  const getProgress = db.prepare('SELECT copied, done FROM "_backfill_progress" WHERE "table" = ?');
  const setProgress = db.prepare(
    'INSERT INTO "_backfill_progress" ("table", copied, done) VALUES (?, ?, ?) ' +
      'ON CONFLICT("table") DO UPDATE SET copied = excluded.copied, done = excluded.done',
  );

  const pg = new Client({ connectionString: pgUrl });
  await pg.connect();

  let totalCopied = 0;

  try {
    for (const table of tables) {
      const prior = getProgress.get(table) as { copied: number; done: number } | undefined;
      if (prior?.done) {
        console.log(`[backfill] ${table}: already complete (${prior.copied} rows), skipping`);
        continue;
      }

      // Column list straight from PG so order matches the SELECT.
      const colsRes = await pg.query(
        `SELECT column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1
           ORDER BY ordinal_position`,
        [table],
      );
      const columns = colsRes.rows.map((r) => r.column_name as string);
      if (columns.length === 0) {
        console.warn(`[backfill] ${table}: not found in Postgres, skipping`);
        setProgress.run(table, 0, 1);
        continue;
      }

      const quotedCols = columns.map((c) => `"${c}"`).join(', ');
      const placeholders = columns.map(() => '?').join(', ');
      const insert = db.prepare(`INSERT INTO "${table}" (${quotedCols}) VALUES (${placeholders})`);

      let offset = prior?.copied ?? 0;
      // Stable order for resumability: Postgres has no implicit row order, so we
      // order by the primary key when present, else by ctid (physical order is
      // stable within a single uninterrupted table copy).
      const pkRes = await pg.query(
        `SELECT a.attname FROM pg_index i
           JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = $1::regclass AND i.indisprimary
          ORDER BY a.attnum`,
        [`"${table}"`],
      );
      const orderBy =
        pkRes.rows.length > 0 ? pkRes.rows.map((r) => `"${r.attname}"`).join(', ') : 'ctid';

      for (;;) {
        const page = await pg.query(
          `SELECT ${quotedCols} FROM "${table}" ORDER BY ${orderBy} LIMIT $1 OFFSET $2`,
          [batch, offset],
        );
        if (page.rows.length === 0) break;

        const tx = db.prepare('BEGIN');
        tx.run();
        try {
          for (const row of page.rows) {
            insert.run(...columns.map((c) => toSqlite(table, c, row[c])));
          }
          db.prepare('COMMIT').run();
        } catch (e) {
          db.prepare('ROLLBACK').run();
          throw e;
        }

        offset += page.rows.length;
        totalCopied += page.rows.length;
        setProgress.run(table, offset, 0);
        process.stdout.write(`\r[backfill] ${table}: ${offset} rows`);

        if (page.rows.length < batch) break;
      }

      setProgress.run(table, offset, 1);
      process.stdout.write(`\r[backfill] ${table}: ${offset} rows ✓\n`);
    }

    console.log(`[backfill] done — ${totalCopied} rows copied into ${sqlitePath}`);
  } finally {
    await pg.end();
    db.close();
  }
}

main().catch((err) => {
  console.error('[backfill] FAILED:', err);
  process.exit(1);
});
