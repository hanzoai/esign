import { readFileSync, writeFileSync } from 'node:fs';

const schema = readFileSync('packages/prisma/schema.prisma', 'utf8');

// 1) Parse enum name -> [values]
const enums = {};
for (const m of schema.matchAll(/enum\s+(\w+)\s*\{([^}]*)\}/g)) {
  const name = m[1];
  const vals = m[2]
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter((l) => l.length > 0 && /^[A-Z0-9_]+$/i.test(l));
  enums[name] = vals;
}

// 2) Parse models -> table name == model name (no @@map used here). For each
//    field whose type is an enum, capture (table, column, enumName, optional?)
const checks = []; // { table, column, enumName, values, optional }
for (const m of schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
  const table = m[1];
  const body = m[2];
  for (const line of body.split('\n')) {
    const t = line.replace(/\/\/.*$/, '').trim();
    if (!t || t.startsWith('@@')) continue;
    // field:  name  Type[?]  ...
    const fm = t.match(/^(\w+)\s+(\w+)(\?)?(\s|$|\/)/);
    if (!fm) continue;
    const [, column, type, opt] = fm;
    if (enums[type] && !t.includes('[]')) {
      checks.push({ table, column, enumName: type, values: enums[type], optional: Boolean(opt) });
    }
  }
}

writeFileSync('/tmp/enum-checks.json', JSON.stringify({ enums: Object.keys(enums).length, checks }, null, 2));
console.log(`enums parsed: ${Object.keys(enums).length}`);
console.log(`enum-typed scalar columns: ${checks.length}`);
console.log('sample:', JSON.stringify(checks.slice(0, 6)));
// show coverage of distinct enums actually referenced
const used = new Set(checks.map((c) => c.enumName));
console.log(`distinct enums referenced by columns: ${used.size}`);
const unusedEnums = Object.keys(enums).filter((e) => !used.has(e));
console.log('enums defined but not used as a scalar column:', unusedEnums);
