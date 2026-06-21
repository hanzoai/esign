/**
 * Backfill: Postgres `sign` database → the single Base SQLite store.
 *
 * The Postgres→SQLite cutover (PR #7) starts every deploy on a FRESH empty
 * `sign.db`; without this, existing users/documents/signatures vanish. This
 * script copies every row from the live Postgres database into a SQLite file
 * built from the `0_init` migration, preserving ids and foreign keys.
 *
 * It is idempotent and resumable. A `_backfill_progress` control table in the
 * target SQLite records, per source table, the last-copied PRIMARY KEY (the
 * keyset cursor) and a row count. A re-run skips completed tables and resumes a
 * partially-copied one from its recorded cursor via `WHERE pk > cursor` — not
 * OFFSET, which is O(n²) on large tables and unstable if a row is deleted
 * mid-copy. Every INSERT is `OR IGNORE`, so re-copying a row already present
 * (e.g. after a crash between the COMMIT and the progress write) is a no-op
 * rather than a UNIQUE/PK abort. FK enforcement is OFF during the load (the data
 * is already-consistent Postgres rows); the enum/shape triggers stay ON and
 * validate every row as it lands.
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
 * The set of tables to copy, in `CREATE TABLE` order from the migration.
 *
 * This is Prisma's *model-declaration* order, NOT a foreign-key topological
 * order — a parent can be emitted after its child. That does not matter here
 * because the load runs under `PRAGMA foreign_keys=OFF` (see main()): SQLite
 * does not check FK references during insert, so any table order is safe and
 * the already-consistent Postgres rows preserve every referential link via
 * their copied id values. If `foreign_keys=ON` is ever flipped on for the load,
 * this ordering is insufficient and the script must first build a real
 * topological sort from the FK graph (`PRAGMA foreign_key_list` per table).
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
    // pg returns a `text[]` column as a JS array → JSON-encode to match the read
    // codec (json-array.ts). FAIL CLOSED, matching decodeList's contract: a
    // non-array here means the PG column was not the array we expect (driver
    // skew, a hand-mangled row) — silently writing `[]` would erase an
    // auth-relevant value (User.roles) without a trace. Throw instead.
    if (!Array.isArray(value)) {
      throw new Error(
        `${table}.${column}: expected a Postgres array, got ${typeof value}: ${JSON.stringify(value)}`,
      );
    }
    return JSON.stringify(value);
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
  // Wait, don't fail, on a momentary lock — e.g. resuming right after a previous
  // run was killed mid-write and SQLite is recovering the WAL, or a reader is
  // sampling _backfill_progress. Without this, a transient SQLITE_BUSY aborts the
  // whole copy; with it, the writer retries for up to 30s.
  db.exec('PRAGMA busy_timeout=30000');

  if (freshFile) {
    db.exec(migration);
    console.log(`[backfill] applied migration to fresh ${sqlitePath} (${tables.length} tables)`);
  }

  // Progress is keyed by table. `cursor` is the JSON-encoded last-seen primary
  // key tuple (keyset pagination) — NULL before the first page. `copied` is a
  // human-facing row count; `done` marks a table fully drained. Resuming reads
  // `cursor` and continues `WHERE pk > cursor`, so a mid-table crash loses no
  // rows and an interleaved delete cannot shift a window (unlike OFFSET).
  db.exec(
    'CREATE TABLE IF NOT EXISTS "_backfill_progress" (' +
      '"table" TEXT PRIMARY KEY, "cursor" TEXT, "copied" INTEGER NOT NULL DEFAULT 0, ' +
      '"done" INTEGER NOT NULL DEFAULT 0)',
  );
  const getProgress = db.prepare(
    'SELECT cursor, copied, done FROM "_backfill_progress" WHERE "table" = ?',
  );
  const setProgress = db.prepare(
    'INSERT INTO "_backfill_progress" ("table", cursor, copied, done) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT("table") DO UPDATE SET cursor = excluded.cursor, copied = excluded.copied, done = excluded.done',
  );

  const pg = new Client({ connectionString: pgUrl });
  await pg.connect();

  let totalCopied = 0;

  try {
    for (const table of tables) {
      const prior = getProgress.get(table) as
        | { cursor: string | null; copied: number; done: number }
        | undefined;
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
        setProgress.run(table, null, 0, 1);
        continue;
      }

      const quotedCols = columns.map((c) => `"${c}"`).join(', ');
      // INSERT OR IGNORE: re-running over already-copied rows must not abort on a
      // UNIQUE/PK conflict. Combined with keyset resume below, a re-run is exactly
      // idempotent — copied rows are skipped, the remainder is filled in.
      const placeholders = columns.map(() => '?').join(', ');
      const insert = db.prepare(
        `INSERT OR IGNORE INTO "${table}" (${quotedCols}) VALUES (${placeholders})`,
      );

      // Keyset pagination needs a deterministic, stable order key: the PRIMARY
      // KEY. Postgres has no implicit row order, and OFFSET is both O(n²) for
      // large tables and unstable across an interruption (an interleaved delete
      // shifts every later row into a window already passed). Reading the PK and
      // paging `WHERE pk > lastSeen ORDER BY pk` fixes both: O(log n) index seeks
      // and a cursor that names the row, not its position.
      const pkRes = await pg.query(
        `SELECT a.attname FROM pg_index i
           JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = $1::regclass AND i.indisprimary
          ORDER BY array_position(i.indkey, a.attnum)`,
        [`"${table}"`],
      );
      const pkCols = pkRes.rows.map((r) => r.attname as string);
      if (pkCols.length === 0) {
        // No PK ⇒ no stable resumable key. Falling back to ctid/OFFSET would
        // reintroduce exactly the instability keyset removes. Fail closed: this
        // schema has a PK on every table; a PK-less table is an unhandled shape,
        // not a silent best-effort copy.
        throw new Error(
          `${table}: no PRIMARY KEY — keyset backfill cannot resume safely. ` +
            `Add a key or copy this table by a bespoke deterministic order.`,
        );
      }
      const quotedPk = pkCols.map((c) => `"${c}"`).join(', ');
      const pkRowValue = `(${quotedPk})`;
      const pkPlaceholders = `(${pkCols.map((_, i) => `$${i + 1}`).join(', ')})`;

      let cursor: unknown[] | null = prior?.cursor ? (JSON.parse(prior.cursor) as unknown[]) : null;
      let copied = prior?.copied ?? 0;

      for (;;) {
        // First page: no cursor → no WHERE. Subsequent pages: row-value keyset.
        // `$N = batch` is the LAST bind; PK binds (if any) come first.
        const page = cursor
          ? await pg.query(
              `SELECT ${quotedCols} FROM "${table}"
                 WHERE ${pkRowValue} > ${pkPlaceholders}
                 ORDER BY ${quotedPk} LIMIT $${pkCols.length + 1}`,
              [...cursor, batch],
            )
          : await pg.query(
              `SELECT ${quotedCols} FROM "${table}" ORDER BY ${quotedPk} LIMIT $1`,
              [batch],
            );
        if (page.rows.length === 0) break;

        const last = page.rows[page.rows.length - 1];
        const nextCursor = pkCols.map((c) => last[c]);

        db.prepare('BEGIN').run();
        try {
          for (const row of page.rows) {
            insert.run(...columns.map((c) => toSqlite(table, c, row[c])));
          }
          db.prepare('COMMIT').run();
        } catch (e) {
          db.prepare('ROLLBACK').run();
          throw e;
        }

        cursor = nextCursor;
        copied += page.rows.length;
        totalCopied += page.rows.length;
        setProgress.run(table, JSON.stringify(cursor), copied, 0);
        process.stdout.write(`\r[backfill] ${table}: ${copied} rows`);

        if (page.rows.length < batch) break;
      }

      setProgress.run(table, cursor === null ? null : JSON.stringify(cursor), copied, 1);
      process.stdout.write(`\r[backfill] ${table}: ${copied} rows ✓\n`);
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
