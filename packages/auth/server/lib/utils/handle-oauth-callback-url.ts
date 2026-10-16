import { OrganisationMemberInviteStatus } from '@prisma/client';
import { OAuth2Client, decodeIdToken } from 'arctic';
import type { Context } from 'hono';
import { deleteCookie } from 'hono/cookie';

import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';
import { onCreateUserHook } from '@hanzo/esign-lib/server-only/user/create-user';
import { deletedServiceAccountEmail } from '@hanzo/esign-lib/server-only/user/service-accounts/deleted-account';
import { legacyServiceAccountEmail } from '@hanzo/esign-lib/server-only/user/service-accounts/legacy-service-account';
import { vouches } from '@hanzo/esign-lib/utils/iam-sign-in';
import { isValidReturnTo, normalizeReturnTo } from '@hanzo/esign-lib/utils/is-valid-return-to';
import { prisma } from '@hanzo/esign-prisma';

import type { OAuthClientOptions } from '../../config';
import { AuthenticationErrorCode } from '../errors/error-codes';
import { onAuthorize } from './authorizer';
import { decideSignIn, readIamPerson, rolesFor } from './iam-person';
import { getOpenIdConfiguration } from './open-id';

type HandleOAuthCallbackUrlOptions = {
  c: Context;
  clientOptions: OAuthClientOptions;
};

export const handleOAuthCallbackUrl = async (options: HandleOAuthCallbackUrlOptions) => {
  const { c, clientOptions } = options;

  const { person, accessToken, accessTokenExpiresAt, idToken, redirectPath } = await validateOauth({
    c,
    clientOptions,
  });

  const email = person.email.toLowerCase();

  if (email === legacyServiceAccountEmail() || email === deletedServiceAccountEmail()) {
    return c.text('FORBIDDEN', 403);
  }

  const voucher = { select: { roles: true, disabled: true } } as const;

  const linked = await prisma.account.findFirst({
    where: {
      provider: clientOptions.id,
      providerAccountId: person.sub,
    },
    select: {
      user: {
        select: {
          id: true,
          disabled: true,
          roles: true,
          organisationMember: {
            select: {
              invitedBy: voucher,
            },
          },
        },
      },
    },
  });

  const addressHeldByUnlinkedAccount =
    !linked && (await prisma.user.count({ where: { email } })) > 0;

  const invites = await prisma.organisationMemberInvite.findMany({
    where: {
      email,
      status: OrganisationMemberInviteStatus.PENDING,
    },
    select: {
      inviter: voucher,
    },
  });

  const decision = decideSignIn({
    person,
    linked: linked ? { id: linked.user.id, disabled: linked.user.disabled } : null,
    addressHeldByUnlinkedAccount,
    vouchedMembership: Boolean(
      linked?.user.organisationMember.some((member) => vouches(member.invitedBy)),
    ),
    vouchedInvite: invites.some((invite) => vouches(invite.inviter)),
  });

  if (decision.kind === 'refuse') {
    // An account that fails admission keeps nothing that would let it back in.
    if (linked) {
      await prisma.session.deleteMany({ where: { userId: linked.user.id } });
      await prisma.apiToken.deleteMany({ where: { userId: linked.user.id } });
    }

    return c.redirect(`/signin?error=${decision.reason}`, 302);
  }

  if (decision.kind === 'sign-in' && linked) {
    // IAM's answer is restated on every sign-in: whether the address is
    // verified (an invitation is accepted only at a verified address) and
    // whether the person administers the app's org (ADMIN).
    await prisma.user.update({
      where: {
        id: decision.userId,
      },
      data: {
        emailVerified: person.emailVerified ? new Date() : null,
        roles: rolesFor(person, linked.user.roles),
        lastSignedIn: new Date(),
      },
    });

    await onAuthorize({ userId: decision.userId }, c);

    return c.redirect(redirectPath, 302);
  }

  const createdUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: person.name,
        emailVerified: new Date(),
        roles: rolesFor(person, []),
      },
    });

    await tx.account.create({
      data: {
        type: 'oauth',
        provider: clientOptions.id,
        providerAccountId: person.sub,
        access_token: accessToken,
        expires_at: Math.floor(accessTokenExpiresAt.getTime() / 1000),
        token_type: 'Bearer',
        id_token: idToken,
        userId: user.id,
      },
    });

    return user;
  });

  await onCreateUserHook(createdUser).catch((err) => {
    console.error(err);
  });

  await onAuthorize({ userId: createdUser.id }, c);

  return c.redirect(redirectPath, 302);
};

export const validateOauth = async (options: HandleOAuthCallbackUrlOptions) => {
  const { c, clientOptions } = options;

  if (!clientOptions.clientId || !clientOptions.clientSecret) {
    throw new AppError(AppErrorCode.NOT_SETUP);
  }

  const { token_endpoint, userinfo_endpoint } = await getOpenIdConfiguration(
    clientOptions.wellKnownUrl,
    {
      requiredScopes: clientOptions.scope,
    },
  );

  const oAuthClient = new OAuth2Client(
    clientOptions.clientId,
    clientOptions.clientSecret,
    clientOptions.redirectUrl,
  );

  const code = c.req.query('code');
  const state = c.req.query('state');

  const storedState = deleteCookie(c, `${clientOptions.id}_oauth_state`);
  const storedCodeVerifier = deleteCookie(c, `${clientOptions.id}_code_verifier`);
  const storedRedirectPath = deleteCookie(c, `${clientOptions.id}_redirect_path`) ?? '';

  if (!code || !storedState || state !== storedState || !storedCodeVerifier) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid or missing state',
    });
  }

  // eslint-disable-next-line prefer-const
  let [redirectState, redirectPath] = storedRedirectPath.split(' ');

  if (redirectState !== storedState || !redirectPath) {
    redirectPath = '/';
  }

  if (!isValidReturnTo(redirectPath)) {
    redirectPath = '/';
  }

  redirectPath = normalizeReturnTo(redirectPath) || '/';

  const tokens = await oAuthClient.validateAuthorizationCode(
    token_endpoint,
    code,
    storedCodeVerifier,
  );

  const accessToken = tokens.accessToken();
  const accessTokenExpiresAt = tokens.accessTokenExpiresAt();
  const idToken = tokens.idToken();

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const claims = decodeIdToken(idToken) as Record<string, unknown>;

  if (typeof claims.sub !== 'string' || claims.sub === '') {
    throw new AppError(AuthenticationErrorCode.InvalidRequest, {
      message: 'Missing sub claim',
    });
  }

  const response = await fetch(userinfo_endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new AppError(AuthenticationErrorCode.Unauthorized, {
      message: `The identity provider refused the userinfo request: ${response.status}`,
    });
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const info = (await response.json()) as Record<string, unknown>;

  return {
    person: readIamPerson(info, claims.sub),
    accessToken,
    accessTokenExpiresAt,
    idToken,
    redirectPath,
  };
};
