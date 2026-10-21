import type { Team, User } from '@prisma/client';
import type { TsRestRequest } from '@ts-rest/serverless';
import type { Logger } from 'pino';

import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';
import { getBearer } from '@hanzo/esign-lib/server-only/public-api/get-bearer';
import type { BaseApiLog, RootApiLog } from '@hanzo/esign-lib/types/api-logs';
import type { ApiRequestMetadata } from '@hanzo/esign-lib/universal/extract-request-metadata';
import { extractRequestMetadata } from '@hanzo/esign-lib/universal/extract-request-metadata';
import { nanoid } from '@hanzo/esign-lib/universal/id';
import { logger } from '@hanzo/esign-lib/utils/logger';

type B = {
  // appRoute: any;
  request: TsRestRequest;
  responseHeaders: Headers;
};

export const authenticatedMiddleware = <
  T extends {
    headers: {
      authorization: string;
    };
  },
  R extends {
    status: number;
    body: unknown;
  },
>(
  handler: (
    args: T & { req: TsRestRequest },
    user: Pick<User, 'id' | 'email' | 'name' | 'disabled'>,
    team: Team,
    options: { metadata: ApiRequestMetadata; logger: Logger },
  ) => Promise<R>,
) => {
  return async (args: T, { request }: B) => {
    const requestMetadata = extractRequestMetadata(request);

    const apiLogger = logger.child({
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      requestId: nanoid(),
    } satisfies RootApiLog);

    const infoToLog: BaseApiLog = {
      auth: 'api',
      source: 'apiV1',
      path: request.url,
    };

    try {
      const { authorization } = args.headers;

      // A Hanzo IAM token, as "Authorization: Bearer <token>" or bare.
      const [token] = (authorization || '').split('Bearer ').filter((s) => s.length > 0);

      if (!token) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'An IAM bearer token was not provided',
        });
      }

      const bearer = await getBearer({ token, teamId: Number(request.headers.get('x-team-id')) });

      apiLogger.info({
        ...infoToLog,
        userId: bearer.user.id,
        bearer: bearer.id,
      } satisfies BaseApiLog);

      const metadata: ApiRequestMetadata = {
        requestMetadata,
        source: 'apiV1',
        auth: 'api',
        auditUser: bearer.app
          ? { id: null, email: null, name: bearer.app }
          : { id: bearer.user.id, email: bearer.user.email, name: bearer.user.name },
      };

      return await handler(
        {
          ...args,
          req: request,
        },
        bearer.user,
        bearer.team,
        { metadata, logger: apiLogger },
      );
    } catch (err) {
      console.log({ err });

      apiLogger.info(infoToLog);

      let message = 'Unauthorized';

      if (err instanceof AppError) {
        message = err.message;
      }

      return {
        status: 401,
        body: {
          message,
        },
      } as const;
    }
  };
};
