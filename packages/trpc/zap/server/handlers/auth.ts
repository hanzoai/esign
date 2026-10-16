// esign ZAP handlers — auth router: the signed-in person's passkeys.
//
// Verbatim tRPC procedure bodies rewired to (ctx, raw). Input is validated by
// the SAME Zod schema the tRPC procedure used; the server-only functions are
// reused unchanged. Routes:
//   auth.passkey.create / createAuthenticationOptions /
//   createRegistrationOptions / delete / find / update.
//
// A passkey re-authenticates a signed-in person for an action; it is never a
// way to sign in, which is Hanzo IAM's alone.
import type { RegistrationResponseJSON } from '@simplewebauthn/server';

import { createPasskey } from '@hanzo/esign-lib/server-only/auth/create-passkey';
import { createPasskeyAuthenticationOptions } from '@hanzo/esign-lib/server-only/auth/create-passkey-authentication-options';
import { createPasskeyRegistrationOptions } from '@hanzo/esign-lib/server-only/auth/create-passkey-registration-options';
import { deletePasskey } from '@hanzo/esign-lib/server-only/auth/delete-passkey';
import { findPasskeys } from '@hanzo/esign-lib/server-only/auth/find-passkeys';
import { updatePasskey } from '@hanzo/esign-lib/server-only/auth/update-passkey';

import { ZCreatePasskeyAuthenticationOptionsRequestSchema } from '../../../server/auth-router/create-passkey-authentication-options.types';
import { ZCreatePasskeyRegistrationOptionsRequestSchema } from '../../../server/auth-router/create-passkey-registration-options.types';
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
