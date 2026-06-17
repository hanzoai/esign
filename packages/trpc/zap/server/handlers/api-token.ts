// esign ZAP handlers — api-token router (fully ported, 3/3 procedures).
//
// Verbatim tRPC procedure bodies rewired to (ctx, input). Routes:
// apiToken.create / apiToken.getMany / apiToken.delete.
import { createApiToken } from '@hanzo/sign-lib/server-only/public-api/create-api-token';
import { deleteTokenById } from '@hanzo/sign-lib/server-only/public-api/delete-api-token-by-id';
import { getApiTokens } from '@hanzo/sign-lib/server-only/public-api/get-api-tokens';

import { ZCreateApiTokenRequestSchema } from '../../../server/api-token-router/create-api-token.types';
import { ZDeleteApiTokenRequestSchema } from '../../../server/api-token-router/delete-api-token.types';
import type { ZapContext } from '../context';
import type { ZapRouteMap } from '../dispatch';

export const apiTokenRoutes: ZapRouteMap = {
  'apiToken.create': async (ctx: ZapContext, raw) => {
    const { tokenName, teamId, expirationDate } = ZCreateApiTokenRequestSchema.parse(raw);
    return await createApiToken({
      userId: ctx.user.id,
      teamId,
      tokenName,
      expiresIn: expirationDate,
    });
  },

  'apiToken.getMany': async (ctx: ZapContext) => {
    return await getApiTokens({ userId: ctx.user.id, teamId: ctx.teamId });
  },

  'apiToken.delete': async (ctx: ZapContext, raw) => {
    const { id, teamId } = ZDeleteApiTokenRequestSchema.parse(raw);
    await deleteTokenById({ id, teamId, userId: ctx.user.id });
    return undefined;
  },
};
