// esign ZAP RPC — the route registry.
//
// The single map of fully-ported routes the dispatcher serves. Each entry is
// "<router>.<procedure>" → handler. Routes NOT present here resolve to a
// NOT_FOUND "not-yet-migrated" reply (see dispatch.ts), which is how the
// remaining tRPC routers coexist while they are ported one by one.
//
// Ported so far: folder (6/6), profile (5/5), apiToken (3/3) = 14 procedures.

import type { ZapRouteMap } from './dispatch';
import { apiTokenRoutes } from './handlers/api-token';
import { folderRoutes } from './handlers/folder';
import { profileRoutes } from './handlers/profile';

export const zapRoutes: ZapRouteMap = {
  ...folderRoutes,
  ...profileRoutes,
  ...apiTokenRoutes,
};

/** The set of routes the ZAP server can handle (used by the client to decide
 *  whether to dispatch over ZAP or fall back to the legacy tRPC client). */
export const migratedRoutes: ReadonlySet<string> = new Set(Object.keys(zapRoutes));
