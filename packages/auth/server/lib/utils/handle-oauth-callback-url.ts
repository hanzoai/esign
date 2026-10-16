import { OrganisationMemberInviteStatus } from '@prisma/client';
import { OAuth2Client, decodeIdToken } from 'arctic';
import type { Context } from 'hono';
import { deleteCookie } from 'hono/cookie';

import { SignInRefusal } from '@hanzo/esign-lib/constants/auth';
import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';
import { onCreateUserHook } from '@hanzo/esign-lib/server-only/user/create-user';
import { deletedServiceAccountEmail } from '@hanzo/esign-lib/server-only/user/service-accounts/deleted-account';
import { legacyServiceAccountEmail } from '@hanzo/esign-lib/server-only/user/service-accounts/legacy-service-account';
import { isValidReturnTo, normalizeReturnTo } from '@hanzo/esign-lib/utils/is-valid-return-to';
import { prisma } from '@hanzo/esign-prisma';

import type { OAuthClientOptions } from '../../config';
import { AuthenticationErrorCode } from '../errors/error-codes';
import { onAuthorize } from './authorizer';
import { administersAppOrg, readIamPerson } from './iam-person';
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

  const refuse = (reason: SignInRefusal) => c.redirect(`/signin?error=${reason}`, 302);

  const email = person.email.toLowerCase();

  if (email === legacyServiceAccountEmail() || email === deletedServiceAccountEmail()) {
    return c.text('FORBIDDEN', 403);
  }

  if (!person.emailVerified) {
    return refuse(SignInRefusal.UnverifiedEmail);
  }

  // An account is found by the IAM identity it is linked to, and by nothing else.
  const existingAccount = await prisma.account.findFirst({
    where: {
      provider: clientOptions.id,
      providerAccountId: person.sub,
    },
    include: {
      user: {
        select: {
          id: true,
          disabled: true,
        },
      },
    },
  });

  if (existingAccount) {
    if (existingAccount.user.disabled) {
      return refuse(SignInRefusal.Disabled);
    }

    await onAuthorize({ userId: existingAccount.user.id }, c);

    return c.redirect(redirectPath, 302);
  }

  // An address is not an identity: an account that holds this address but was
  // never linked to this IAM identity is not handed to whoever signs in with it.
  const userWithSameEmail = await prisma.user.findFirst({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });

  if (userWithSameEmail) {
    return refuse(SignInRefusal.UnlinkedAccount);
  }

  // A first sign-in makes an account only for someone who was asked in: an admin
  // of the org this application serves, or a person an organisation invited at
  // this verified address.
  const invited =
    administersAppOrg(person) ||
    (await prisma.organisationMemberInvite.findFirst({
      where: {
        email,
        status: OrganisationMemberInviteStatus.PENDING,
      },
      select: {
        id: true,
      },
    })) !== null;

  if (!invited) {
    return refuse(SignInRefusal.NotInvited);
  }

  const createdUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: person.name,
        emailVerified: new Date(),
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
