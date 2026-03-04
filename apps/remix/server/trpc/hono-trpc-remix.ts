import { trpcServer } from '@hono/trpc-server';

import { createTrpcContext } from '@hanzo/sign-trpc/server/context';
import { appRouter } from '@hanzo/sign-trpc/server/router';
import { handleTrpcRouterError } from '@hanzo/sign-trpc/utils/trpc-error-handler';

/**
 * Trpc server for internal routes like /api/trpc/*
 */
export const reactRouterTrpcServer = trpcServer({
  router: appRouter,
  endpoint: '/api/trpc',
  createContext: async (_, c) => createTrpcContext({ c, requestSource: 'app' }),
  onError: (opts) => handleTrpcRouterError(opts, 'trpc'),
});
