/**
 * A connection without a session — a recipient signing by their link, a visitor
 * on a direct template link — reaches the public routes and nothing else.
 *
 * Run:  npx tsx --test packages/trpc/__tests__/anonymous.test.ts
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { Logger } from 'pino';

import { newZapRequest } from '../zap/gen/transport_zap';
import type { AnonymousZapContext, ZapContext } from '../zap/server/context';
import { makeDispatcher, readReply } from '../zap/server/dispatch';
import { publicRoutes } from '../zap/server/public-routes';

const logger = { info: () => {}, error: () => {}, child: () => logger } as unknown as Logger;

const metadata = {
  requestMetadata: {},
  source: 'app' as const,
  auth: null,
};

const anonymous: AnonymousZapContext = { user: null, session: null, teamId: -1, metadata, logger };

const signedIn: ZapContext = {
  user: { id: 7, name: 'Signed In', email: 'signed-in@example.com' },
  session: null,
  teamId: 3,
  metadata: { ...metadata, auth: 'session' },
  logger,
};

const seen: Array<{ route: string; user: unknown }> = [];

const routes = {
  'field.signFieldWithToken': (ctx: { user: unknown }) => {
    seen.push({ route: 'field.signFieldWithToken', user: ctx.user });
    return 'signed';
  },
  'envelope.recipient.set': (ctx: { user: unknown }) => {
    seen.push({ route: 'envelope.recipient.set', user: ctx.user });
    return 'set';
  },
};

const call = async (ctx: AnonymousZapContext | ZapContext, method: string) => {
  const handler = makeDispatcher(routes, publicRoutes)(ctx);
  const response = await handler({
    promiseID: 1,
    payload: newZapRequest({ method, payload: '', teamId: '' }),
  } as Parameters<typeof handler>[0]);

  return readReply(response.body);
};

describe('an anonymous connection', () => {
  test('calls a public route, with no user', async () => {
    seen.length = 0;
    const reply = await call(anonymous, 'field.signFieldWithToken');

    assert.equal(reply.ok, true);
    assert.deepEqual(seen, [{ route: 'field.signFieldWithToken', user: null }]);
  });

  test('is refused every other route before its handler runs', async () => {
    seen.length = 0;
    const reply = await call(anonymous, 'envelope.recipient.set');

    assert.equal(reply.ok, false);
    assert.equal(reply.status, 401);
    assert.deepEqual(seen, []);
  });
});

describe('a signed-in connection', () => {
  test('calls any route as its user', async () => {
    seen.length = 0;
    const reply = await call(signedIn, 'envelope.recipient.set');

    assert.equal(reply.ok, true);
    assert.equal((seen[0].user as { id: number }).id, 7);
  });
});

describe('the public routes', () => {
  test('are the token flows a recipient or a direct-link visitor needs, and no editor route', () => {
    for (const route of publicRoutes) {
      assert.doesNotMatch(route, /^(admin|apiToken|team|organisation|folder|webhook|profile)\./);
      assert.doesNotMatch(route, /\.(set|update|delete|create)$/);
    }
  });
});
