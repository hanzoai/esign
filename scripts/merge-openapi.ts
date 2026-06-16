#!/usr/bin/env node
/**
 * merge-openapi.ts — compose the 14 per-router ZAP OpenAPI docs into one.
 *
 * Each `packages/trpc/zap/gen/<router>-router.openapi.json` is a standalone
 * OpenAPI 3.1 doc whose `components.schemas` use the local names `Req`/`Resp`.
 * Those names collide across routers, so every router's schema keys are
 * namespaced with a deterministic prefix derived from the file name
 * (`folder-router.openapi.json` -> `Folder`) before merging, and the local
 * `$ref`s inside that router's paths + schemas are rewritten to match.
 *
 * The result is written to `packages/trpc/zap/gen/openapi.json` with the same
 * top-level `info`, `security`, and `securitySchemes.apiKey` block the old
 * trpc-to-openapi document exposed (Authorization header api key).
 *
 * Run: `npx tsx scripts/merge-openapi.ts`  (also `npm run openapi:merge`).
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const GEN_DIR = join(process.cwd(), 'packages', 'trpc', 'zap', 'gen');
const OUT_FILE = join(GEN_DIR, 'openapi.json');

const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Hanzo eSign';

/** `folder-router.openapi.json` -> `Folder` (PascalCase, router suffix dropped). */
function prefixFromFile(file: string): string {
  return file
    .replace(/-router\.openapi\.json$/, '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** Recursively rewrite every local `#/components/schemas/<name>` $ref via `map`. */
function rewriteRefs(node: unknown, map: (name: string) => string): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => rewriteRefs(item, map));
  }
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (
        key === '$ref' &&
        typeof value === 'string' &&
        value.startsWith('#/components/schemas/')
      ) {
        out[key] = `#/components/schemas/${map(value.slice('#/components/schemas/'.length))}`;
      } else {
        out[key] = rewriteRefs(value, map);
      }
    }
    return out;
  }
  return node;
}

interface OpenApiDoc {
  paths?: Record<string, unknown>;
  components?: { schemas?: Record<string, unknown> };
}

const files = readdirSync(GEN_DIR)
  .filter((f) => f.endsWith('-router.openapi.json'))
  .sort();

const mergedPaths: Record<string, unknown> = {};
const mergedSchemas: Record<string, unknown> = {};

for (const file of files) {
  const prefix = prefixFromFile(file);
  const doc = JSON.parse(readFileSync(join(GEN_DIR, file), 'utf8')) as OpenApiDoc;

  const rename = (name: string) => `${prefix}${name}`;

  for (const [name, schema] of Object.entries(doc.components?.schemas ?? {})) {
    const key = rename(name);
    if (key in mergedSchemas) {
      throw new Error(`schema key collision after namespacing: ${key} (from ${file})`);
    }
    mergedSchemas[key] = rewriteRefs(schema, rename);
  }

  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    if (path in mergedPaths) {
      throw new Error(`path collision: ${path} (from ${file})`);
    }
    mergedPaths[path] = rewriteRefs(item, rename);
  }
}

const composite = {
  openapi: '3.1.0',
  info: {
    title: `${appName} v2 API`,
    description: `Welcome to the ${appName} v2 API.\n\nThis API provides access to our system, which you can use to integrate applications, automate workflows, or build custom tools.`,
    version: '1.0.0',
  },
  security: [{ apiKey: [] }],
  components: {
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
      },
    },
    schemas: mergedSchemas,
  },
  paths: mergedPaths,
};

writeFileSync(OUT_FILE, `${JSON.stringify(composite, null, 2)}\n`);

console.log(
  `merged ${files.length} router docs -> ${OUT_FILE} ` +
    `(${Object.keys(mergedPaths).length} paths, ${Object.keys(mergedSchemas).length} schemas)`,
);
