// esign ZAP handlers — webhook router (8/8 procedures).
//
// Verbatim tRPC procedure bodies rewired to (ctx, raw). Input is validated by
// the SAME Zod schema the tRPC procedure used; server-only functions and the
// per-route exported helpers (findWebhookCalls / resendWebhookCallRoute body)
// are reused unchanged. Inline-bodied procedures (getTeamWebhooks,
// getWebhookById, createWebhook, deleteWebhook, editWebhook, testWebhook) plus
// the two file-backed routes (calls.find / calls.resend) have their bodies
// ported verbatim. Route keys mirror the tRPC nested router shape (see
// webhook-router.zap).
import { Prisma, WebhookCallStatus } from '@prisma/client';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@hanzo/esign-lib/constants/teams';
import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';
import { createWebhook } from '@hanzo/esign-lib/server-only/webhooks/create-webhook';
import { deleteWebhookById } from '@hanzo/esign-lib/server-only/webhooks/delete-webhook-by-id';
import { editWebhook } from '@hanzo/esign-lib/server-only/webhooks/edit-webhook';
import { getWebhookById } from '@hanzo/esign-lib/server-only/webhooks/get-webhook-by-id';
import { getWebhooksByTeamId } from '@hanzo/esign-lib/server-only/webhooks/get-webhooks-by-team-id';
import { triggerTestWebhook } from '@hanzo/esign-lib/server-only/webhooks/trigger-test-webhook';
import { buildTeamWhereQuery } from '@hanzo/esign-lib/utils/teams';
import { prisma } from '@hanzo/esign-prisma';

import { findWebhookCalls } from '../../../server/webhook-router/find-webhook-calls';
import { ZFindWebhookCallsRequestSchema } from '../../../server/webhook-router/find-webhook-calls.types';
import { ZResendWebhookCallRequestSchema } from '../../../server/webhook-router/resend-webhook-call.types';
import {
  ZCreateWebhookRequestSchema,
  ZDeleteWebhookRequestSchema,
  ZEditWebhookRequestSchema,
  ZGetWebhookByIdRequestSchema,
  ZTriggerTestWebhookRequestSchema,
} from '../../../server/webhook-router/schema';
import type { ZapContext } from '../context';
import type { ZapRouteMap } from '../dispatch';

export const webhookRoutes: ZapRouteMap = {
  'webhook.calls.find': async (ctx: ZapContext, raw) => {
    const { webhookId, page, perPage, status, query, events } =
      ZFindWebhookCallsRequestSchema.parse(raw);

    ctx.logger.info({
      input: { webhookId, status },
    });

    return await findWebhookCalls({
      userId: ctx.user.id,
      teamId: ctx.teamId,
      webhookId,
      page,
      perPage,
      status,
      query,
      events,
    });
  },

  'webhook.calls.resend': async (ctx: ZapContext, raw) => {
    const { teamId, user } = ctx;
    const { webhookId, webhookCallId } = ZResendWebhookCallRequestSchema.parse(raw);

    ctx.logger.info({
      input: { webhookId, webhookCallId },
    });

    const webhookCall = await prisma.webhookCall.findFirst({
      where: {
        id: webhookCallId,
        webhook: {
          id: webhookId,
          team: buildTeamWhereQuery({
            teamId,
            userId: user.id,
            roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP.MANAGE_TEAM,
          }),
        },
      },
      include: {
        webhook: true,
      },
    });

    if (!webhookCall) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    const { webhook } = webhookCall;

    // Note: This is duplicated in `execute-webhook.handler.ts`.
    const response = await fetch(webhookCall.url, {
      method: 'POST',
      body: JSON.stringify(webhookCall.requestBody),
      headers: {
        'Content-Type': 'application/json',
        'X-Hanzo eSign-Secret': webhook.secret ?? '',
      },
    });

    const body = await response.text();

    let responseBody: Prisma.InputJsonValue | Prisma.JsonNullValueInput = Prisma.JsonNull;

    try {
      responseBody = JSON.parse(body);
    } catch (err) {
      responseBody = body;
    }

    return await prisma.webhookCall.update({
      where: {
        id: webhookCall.id,
      },
      data: {
        status: response.ok ? WebhookCallStatus.SUCCESS : WebhookCallStatus.FAILED,
        responseCode: response.status,
        responseBody,
        responseHeaders: Object.fromEntries(response.headers.entries()),
      },
    });
  },

  'webhook.getTeamWebhooks': async (ctx: ZapContext) => {
    ctx.logger.info({
      input: {
        teamId: ctx.teamId,
      },
    });

    return await getWebhooksByTeamId(ctx.teamId, ctx.user.id);
  },

  'webhook.getWebhookById': async (ctx: ZapContext, raw) => {
    const { id } = ZGetWebhookByIdRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        id,
      },
    });

    return await getWebhookById({
      id,
      userId: ctx.user.id,
      teamId: ctx.teamId,
    });
  },

  'webhook.createWebhook': async (ctx: ZapContext, raw) => {
    const { enabled, eventTriggers, secret, webhookUrl } = ZCreateWebhookRequestSchema.parse(raw);

    return await createWebhook({
      enabled,
      secret,
      webhookUrl,
      eventTriggers,
      teamId: ctx.teamId,
      userId: ctx.user.id,
    });
  },

  'webhook.deleteWebhook': async (ctx: ZapContext, raw) => {
    const { id } = ZDeleteWebhookRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        id,
      },
    });

    return await deleteWebhookById({
      id,
      teamId: ctx.teamId,
      userId: ctx.user.id,
    });
  },

  'webhook.editWebhook': async (ctx: ZapContext, raw) => {
    const { id, ...data } = ZEditWebhookRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        id,
      },
    });

    return await editWebhook({
      id,
      data,
      userId: ctx.user.id,
      teamId: ctx.teamId,
    });
  },

  'webhook.testWebhook': async (ctx: ZapContext, raw) => {
    const { id, event } = ZTriggerTestWebhookRequestSchema.parse(raw);

    ctx.logger.info({
      input: {
        id,
        event,
      },
    });

    return await triggerTestWebhook({
      id,
      event,
      userId: ctx.user.id,
      teamId: ctx.teamId,
    });
  },
};
