import { sValidator } from '@hono/standard-validator';
import { EnvelopeType } from '@prisma/client';
import { Hono } from 'hono';

import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';
import { getEnvelopeById } from '@hanzo/esign-lib/server-only/envelope/get-envelope-by-id';
import { getBearer } from '@hanzo/esign-lib/server-only/public-api/get-bearer';
import { buildTeamWhereQuery } from '@hanzo/esign-lib/utils/teams';
import { prisma } from '@hanzo/esign-prisma';

import type { HonoEnv } from '../../router';
import { handleEnvelopeItemFileRequest } from '../files/files.helpers';
import {
  ZDownloadDocumentRequestParamsSchema,
  ZDownloadEnvelopeItemRequestParamsSchema,
} from './download.types';

export const downloadRoute = new Hono<HonoEnv>()
  /**
   * Download an envelope item by its ID.
   * Requires API key authentication via Authorization header.
   */
  .get(
    '/envelope/item/:envelopeItemId/download',
    sValidator('param', ZDownloadEnvelopeItemRequestParamsSchema),
    async (c) => {
      const logger = c.get('logger');

      try {
        const { envelopeItemId, version } = c.req.valid('param');
        const authorizationHeader = c.req.header('authorization');

        // A Hanzo IAM token, as "Authorization: Bearer <token>" or bare.
        const [token] = (authorizationHeader || '').split('Bearer ').filter((s) => s.length > 0);

        if (!token) {
          throw new AppError(AppErrorCode.UNAUTHORIZED, {
            message: 'An IAM bearer token was not provided',
          });
        }

        const apiToken = await getBearer({ token });

        logger.info({
          auth: 'api',
          source: 'apiV2',
          path: c.req.path,
          userId: apiToken.user.id,
          bearer: apiToken.id,
          envelopeItemId,
          version,
        });

        const envelopeItem = await prisma.envelopeItem.findFirst({
          where: {
            id: envelopeItemId,
            envelope: {
              team: buildTeamWhereQuery({ teamId: apiToken.teamId, userId: apiToken.user.id }),
            },
          },
          include: {
            envelope: true,
            documentData: true,
          },
        });

        if (!envelopeItem) {
          return c.json({ error: 'Envelope item not found' }, 404);
        }

        if (!envelopeItem.documentData) {
          return c.json({ error: 'Document data not found' }, 404);
        }

        return await handleEnvelopeItemFileRequest({
          title: envelopeItem.title,
          status: envelopeItem.envelope.status,
          documentData: envelopeItem.documentData,
          version: version || 'signed',
          isDownload: true,
          context: c,
        });
      } catch (error) {
        logger.error(error);

        if (error instanceof AppError) {
          if (error.code === AppErrorCode.UNAUTHORIZED) {
            return c.json({ error: error.message }, 401);
          }

          return c.json({ error: error.message }, 400);
        }

        return c.json({ error: 'Internal server error' }, 500);
      }
    },
  )
  /**
   * Download a document by its ID.
   * Requires API key authentication via Authorization header.
   */
  .get(
    '/document/:documentId/download',
    sValidator('param', ZDownloadDocumentRequestParamsSchema),
    async (c) => {
      const logger = c.get('logger');

      try {
        const { documentId, version } = c.req.valid('param');
        const authorizationHeader = c.req.header('authorization');

        // A Hanzo IAM token, as "Authorization: Bearer <token>" or bare.
        const [token] = (authorizationHeader || '').split('Bearer ').filter((s) => s.length > 0);

        if (!token) {
          throw new AppError(AppErrorCode.UNAUTHORIZED, {
            message: 'An IAM bearer token was not provided',
          });
        }

        const apiToken = await getBearer({ token });

        logger.info({
          auth: 'api',
          source: 'apiV2',
          path: c.req.path,
          userId: apiToken.user.id,
          bearer: apiToken.id,
          documentId,
          version,
        });

        const envelope = await getEnvelopeById({
          id: {
            type: 'documentId',
            id: documentId,
          },
          type: EnvelopeType.DOCUMENT,
          userId: apiToken.user.id,
          teamId: apiToken.teamId,
        }).catch(() => null);

        if (!envelope) {
          return c.json({ error: 'Document not found' }, 404);
        }

        // Get the first envelope item (documents have exactly one)
        const [envelopeItem] = envelope.envelopeItems;

        if (!envelopeItem) {
          return c.json({ error: 'Document item not found' }, 404);
        }

        if (!envelopeItem.documentData) {
          return c.json({ error: 'Document data not found' }, 404);
        }

        return await handleEnvelopeItemFileRequest({
          title: envelopeItem.title,
          status: envelope.status,
          documentData: envelopeItem.documentData,
          version: version || 'signed',
          isDownload: true,
          context: c,
        });
      } catch (error) {
        logger.error(error);

        if (error instanceof AppError) {
          if (error.code === AppErrorCode.UNAUTHORIZED) {
            return c.json({ error: error.message }, 401);
          }

          return c.json({ error: error.message }, 400);
        }

        return c.json({ error: 'Internal server error' }, 500);
      }
    },
  );
