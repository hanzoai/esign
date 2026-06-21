/**
 * Minimal ambient types for `node:sqlite` (stable since Node 22.5 / Node ≥ 24).
 *
 * The repo's `@types/node` is pinned at v20, which predates the `node:sqlite`
 * declarations. Rather than bump `@types/node` across the whole monorepo, this
 * declares only the synchronous surface the tests use (`DatabaseSync` +
 * prepared statements). Drop this file once `@types/node` is ≥ 22.5.
 */
declare module 'node:sqlite' {
  interface StatementSync {
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }

  export class DatabaseSync {
    constructor(path: string, options?: { open?: boolean; readOnly?: boolean });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
