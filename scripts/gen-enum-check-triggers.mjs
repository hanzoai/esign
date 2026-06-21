import { readFileSync, writeFileSync } from 'node:fs';
const { checks } = JSON.parse(readFileSync('/tmp/enum-checks.json', 'utf8'));

// Group columns by table so we can emit one trigger pair per (table) covering
// all its enum columns? No — clearer + orthogonal: one trigger per (table,column,op).
// SQLite has no ADD CONSTRAINT CHECK; triggers are the one portable way to add a
// post-hoc enum domain. We RAISE(ABORT) when the column is non-null AND not in
// the allowed set. NULL is allowed iff the column is optional; a NULL written to
// a NOT NULL column is already rejected by the column constraint, so we don't
// re-check it (and we must NOT reject NULL on optional columns).

const sqlList = (vals) => vals.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');

let out = [];
out.push('-- enum domain enforcement (CHECK-equivalent) for SQLite.');
out.push('--');
out.push('-- Prisma 6 maps every enum to a bare `TEXT` column on the `sqlite` provider');
out.push('-- and emits NO CHECK constraint, so the 33 enum-typed columns below would');
out.push('-- otherwise accept arbitrary text — the same domain Postgres enforced with a');
out.push('-- native enum type is reconstructed here with BEFORE INSERT/UPDATE triggers.');
out.push('-- SQLite cannot ALTER TABLE ADD CONSTRAINT CHECK, so triggers are the one');
out.push('-- portable way to bolt a domain onto an existing table. Each trigger fails');
out.push('-- closed: a non-NULL value outside the enum set aborts the write.');
out.push('--');
out.push('-- Generated from schema.prisma enums by scripts/gen-enum-check-triggers.mjs.');
out.push('-- Re-run that script and replace this block if the enum set changes.');
out.push('');

let count = 0;
for (const c of checks) {
  const set = sqlList(c.values);
  const guard = `NEW."${c.column}" IS NOT NULL AND NEW."${c.column}" NOT IN (${set})`;
  for (const op of ['INSERT', 'UPDATE']) {
    const trig = `enum_${c.table}_${c.column}_${op.toLowerCase()}`;
    out.push(`DROP TRIGGER IF EXISTS "${trig}";`);
    out.push(`CREATE TRIGGER "${trig}"`);
    out.push(`  BEFORE ${op} ON "${c.table}"`);
    out.push(`  FOR EACH ROW WHEN ${guard}`);
    out.push(`  BEGIN SELECT RAISE(ABORT, 'invalid ${c.enumName} for ${c.table}.${c.column}'); END;`);
    out.push('');
    count++;
  }
}

// Role[] list-column domain: User.roles is a JSON array of Role. Validate every
// element is a known Role on write. This is the auth-relevant column, so it gets
// its own list-aware trigger (the scalar triggers above don't cover JSON lists).
const ROLE_VALUES = ['ADMIN', 'USER'];
const roleSet = sqlList(ROLE_VALUES);
out.push('-- User.roles is a JSON-encoded Role[] (SQLite has no array type). Enforce that');
out.push('-- every element is a known Role: json_each expands the array, and the guard');
out.push('-- aborts if any element is outside the Role domain. Auth-relevant: a fabricated');
out.push("-- role can never be persisted. (Role values are mirrored from schema.prisma's enum Role.)");
for (const op of ['INSERT', 'UPDATE']) {
  const trig = `enum_User_roles_${op.toLowerCase()}`;
  out.push(`DROP TRIGGER IF EXISTS "${trig}";`);
  out.push(`CREATE TRIGGER "${trig}"`);
  out.push(`  BEFORE ${op} ON "User"`);
  out.push(`  FOR EACH ROW`);
  out.push(`  WHEN NEW."roles" IS NOT NULL AND EXISTS (`);
  out.push(`    SELECT 1 FROM json_each(NEW."roles") WHERE value NOT IN (${roleSet})`);
  out.push(`  )`);
  out.push(`  BEGIN SELECT RAISE(ABORT, 'invalid Role in User.roles'); END;`);
  out.push('');
  count++;
}

writeFileSync('packages/prisma/migrations/0_init/migration.sql', '\n' + out.join('\n'), { flag: 'a' });
console.log(`appended ${count} enum-enforcement triggers (incl. 2 for User.roles JSON list)`);
