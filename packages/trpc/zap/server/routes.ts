// esign ZAP RPC — the route registry.
//
// The single map of fully-ported routes the dispatcher serves. Each entry is
// "<router>.<procedure>" → handler. Any route absent here resolves to a
// NOT_FOUND reply (see dispatch.ts).
//
// All 14 tRPC routers are ported to ZAP handlers:
//   admin, apiToken, auth, document, embeddingPresign, envelope, field,
//   folder, organisation, profile, recipient, team, template, webhook.
import type { ZapRouteMap } from './dispatch';
import { adminRoutes } from './handlers/admin';
import { apiTokenRoutes } from './handlers/api-token';
import { authRoutes } from './handlers/auth';
import { documentRoutes } from './handlers/document';
import { embeddingRoutes } from './handlers/embedding';
import { envelopeRoutes } from './handlers/envelope';
import { fieldRoutes } from './handlers/field';
import { folderRoutes } from './handlers/folder';
import { organisationRoutes } from './handlers/organisation';
import { profileRoutes } from './handlers/profile';
import { recipientRoutes } from './handlers/recipient';
import { teamRoutes } from './handlers/team';
import { templateRoutes } from './handlers/template';
import { webhookRoutes } from './handlers/webhook';

export const zapRoutes: ZapRouteMap = {
  ...adminRoutes,
  ...apiTokenRoutes,
  ...authRoutes,
  ...documentRoutes,
  ...embeddingRoutes,
  ...envelopeRoutes,
  ...fieldRoutes,
  ...folderRoutes,
  ...organisationRoutes,
  ...profileRoutes,
  ...recipientRoutes,
  ...teamRoutes,
  ...templateRoutes,
  ...webhookRoutes,
};

/** The set of routes the ZAP server can handle (used by the client to decide
 *  whether to dispatch over ZAP or fall back to the legacy tRPC client). */
export const migratedRoutes: ReadonlySet<string> = new Set(Object.keys(zapRoutes));
