// esign ZAP handlers — auth router (fully ported, 7/7 procedures).
//
// Verbatim tRPC procedure bodies rewired to (ctx, raw). Input is validated by
// the SAME Zod schema the tRPC procedure used; the server-only functions are
// reused unchanged. Routes:
//   auth.passkey.create / createAuthenticationOptions /
//   createRegistrationOptions / createSigninOptions / delete / find / update.
import type { RegistrationResponseJSON } from '@simplewebauthn/server';

import { createPasskey } from '@hanzo/sign-lib/server-only/auth/create-passkey';
import { createPasskeyAuthenticationOptions } from '@hanzo/sign-lib/server-only/auth/create-passkey-authentication-options';
import { createPasskeyRegistrationOptions } from '@hanzo/sign-lib/server-only/auth/create-passkey-registration-options';
import { createPasskeySigninOptions } from '@hanzo/sign-lib/server-only/auth/create-passkey-signin-options';
import { deletePasskey } from '@hanzo/sign-lib/server-only/auth/delete-passkey';
import { findPasskeys } from '@hanzo/sign-lib/server-only/auth/find-passkeys';
import { updatePasskey } from '@hanzo/sign-lib/server-only/auth/update-passkey';
import { nanoid } from '@hanzo/sign-lib/universal/id';

import { ZCreatePasskeyAuthenticationOptionsRequestSchema } from '../../../server/auth-router/create-passkey-authentication-options.types';
import { ZCreatePasskeyRegistrationOptionsRequestSchema } from '../../../server/auth-router/create-passkey-registration-options.types';
import { ZCreatePasskeySigninOptionsRequestSchema } from '../../../server/auth-router/create-passkey-signin-options.types';
import { ZCreatePasskeyRequestSchema } from '../../../server/auth-router/create-passkey.types';
import { ZDeletePasskeyRequestSchema } from '../../../server/auth-router/delete-passkey.types';
import { ZFindPasskeysRequestSchema } from '../../../server/auth-router/find-passkeys.types';
import { ZUpdatePasskeyRequestSchema } from '../../../server/auth-router/update-passkey.types';
import type { ZapContext } from '../context';
import type { ZapRouteMap } from '../dispatch';

export const authRoutes: ZapRouteMap = {
  'auth.passkey.create': async (ctx: ZapContext, raw) => {
    const input = ZCreatePasskeyRequestSchema.parse(raw);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const verificationResponse = input.verificationResponse as RegistrationResponseJSON;

    return await createPasskey({
      userId: ctx.user.id,
      verificationResponse,
      passkeyName: input.passkeyName,
      requestMetadata: ctx.metadata.requestMetadata,
    });
  },

  'auth.passkey.createAuthenticationOptions': async (ctx: ZapContext, raw) => {
    const input = ZCreatePasskeyAuthenticationOptionsRequestSchema.parse(raw);

    return await createPasskeyAuthenticationOptions({
      userId: ctx.user.id,
      preferredPasskeyId: input?.preferredPasskeyId,
    });
  },

  'auth.passkey.createRegistrationOptions': async (ctx: ZapContext, raw) => {
    ZCreatePasskeyRegistrationOptionsRequestSchema.parse(raw);

    return await createPasskeyRegistrationOptions({
      userId: ctx.user.id,
    });
  },

  'auth.passkey.createSigninOptions': async (_ctx: ZapContext, raw) => {
    ZCreatePasskeySigninOptionsRequestSchema.parse(raw);

    const sessionIdToken = nanoid(16);

    const [sessionId] = decodeURI(sessionIdToken).split('|');

    const options = await createPasskeySigninOptions({ sessionId });

    return {
      options,
      sessionId,
    };
  },

  'auth.passkey.delete': async (ctx: ZapContext, raw) => {
    const { passkeyId } = ZDeletePasskeyRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        passkeyId,
      },
    });

    await deletePasskey({
      userId: ctx.user.id,
      passkeyId,
      requestMetadata: ctx.metadata.requestMetadata,
    });
  },

  'auth.passkey.find': async (ctx: ZapContext, raw) => {
    const { page, perPage, orderBy } = ZFindPasskeysRequestSchema.parse(raw);

    return await findPasskeys({
      page,
      perPage,
      orderBy,
      userId: ctx.user.id,
    });
  },

  'auth.passkey.update': async (ctx: ZapContext, raw) => {
    const { passkeyId, name } = ZUpdatePasskeyRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        passkeyId,
      },
    });

    await updatePasskey({
      userId: ctx.user.id,
      passkeyId,
      name,
      requestMetadata: ctx.metadata.requestMetadata,
    });
  },
};
