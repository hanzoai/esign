import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from '@oslojs/encoding';
import { type Session, type User, UserSecurityAuditLogType } from '@prisma/client';

import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';
import { readStanding } from '@hanzo/esign-lib/server-only/user/standing';
import type { RequestMetadata } from '@hanzo/esign-lib/universal/extract-request-metadata';
import { credentialIsCurrent } from '@hanzo/esign-lib/utils/iam-sign-in';
import { prisma } from '@hanzo/esign-prisma';

import { AUTH_SESSION_LIFETIME } from '../../config';

/**
 * The user object to pass around the app.
 *
 * Do not put anything sensitive in here since it will be public.
 */
export type SessionUser = Pick<
  User,
  | 'id'
  | 'name'
  | 'email'
  | 'emailVerified'
  | 'avatarImageId'
  | 'twoFactorEnabled'
  | 'roles'
  | 'signature'
>;

export type SessionValidationResult =
  | {
      session: Session;
      user: SessionUser;
      isAuthenticated: true;
    }
  | { session: null; user: null; isAuthenticated: false };

export const generateSessionToken = (): string => {
  const bytes = new Uint8Array(20);

  crypto.getRandomValues(bytes);

  const token = encodeBase32LowerCaseNoPadding(bytes);

  return token;
};

export const createSession = async (
  token: string,
  userId: number,
  metadata: RequestMetadata,
): Promise<Session> => {
  const hashedSessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));

  const session: Session = {
    id: hashedSessionId,
    sessionToken: hashedSessionId,
    userId,
    updatedAt: new Date(),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + AUTH_SESSION_LIFETIME),
    ipAddress: metadata.ipAddress ?? null,
    userAgent: metadata.userAgent ?? null,
  };

  await prisma.session.create({
    data: session,
  });

  await prisma.userSecurityAuditLog.create({
    data: {
      userId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      type: UserSecurityAuditLogType.SIGN_IN,
    },
  });

  return session;
};

/**
 * The session a token names, or none.
 *
 * A session is honoured only while its holder's credentials are current
 * (`credentialIsCurrent`): linked to a Hanzo IAM identity, not disabled, and
 * admitted under the one admission rule. It lives for AUTH_SESSION_LIFETIME
 * from the IAM sign-in that made it and is never extended.
 */
export const validateSessionToken = async (token: string): Promise<SessionValidationResult> => {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));

  const result = await prisma.session.findUnique({
    where: {
      id: sessionId,
    },
    include: {
      user: {
        /**
         * Do not expose anything sensitive here.
         */
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          avatarImageId: true,
          twoFactorEnabled: true,
          roles: true,
          signature: true,
        },
      },
    },
  });

  if (!result?.user) {
    return { session: null, user: null, isAuthenticated: false };
  }

  const { user, ...session } = result;

  if (Date.now() >= session.expiresAt.getTime()) {
    await prisma.session.delete({ where: { id: sessionId } });
    return { session: null, user: null, isAuthenticated: false };
  }

  const standing = await readStanding(user.id);

  if (!standing || !credentialIsCurrent(standing)) {
    // deleteMany: two requests on one refused session both reach this line.
    await prisma.session.deleteMany({ where: { id: sessionId } });
    return { session: null, user: null, isAuthenticated: false };
  }

  return { session, user, isAuthenticated: true };
};

type InvalidateSessionsOptions = {
  userId: number;
  sessionIds: string[];
  metadata: RequestMetadata;
  isRevoke?: boolean;
};

export const invalidateSessions = async ({
  userId,
  sessionIds,
  metadata,
  isRevoke,
}: InvalidateSessionsOptions): Promise<void> => {
  if (sessionIds.length === 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.session.deleteMany({
      where: {
        userId,
        id: { in: sessionIds },
      },
    });

    if (count !== sessionIds.length) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'One or more sessions are not valid.',
      });
    }

    await tx.userSecurityAuditLog.createMany({
      data: sessionIds.map(() => ({
        userId,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        type: isRevoke
          ? UserSecurityAuditLogType.SESSION_REVOKED
          : UserSecurityAuditLogType.SIGN_OUT,
      })),
    });
  });
};
