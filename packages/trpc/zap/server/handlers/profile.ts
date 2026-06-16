// esign ZAP handlers — profile router (fully ported, 5/5 procedures).
//
// Verbatim tRPC procedure bodies rewired to (ctx, input). Routes:
// profile.findUserSecurityAuditLogs / updateProfile / deleteAccount /
// setProfileImage / submitSupportTicket.

import { AppError, AppErrorCode } from '@hanzo/sign-lib/errors/app-error';
import type { SetAvatarImageOptions } from '@hanzo/sign-lib/server-only/profile/set-avatar-image';
import { setAvatarImage } from '@hanzo/sign-lib/server-only/profile/set-avatar-image';
import { deleteUser } from '@hanzo/sign-lib/server-only/user/delete-user';
import { findUserSecurityAuditLogs } from '@hanzo/sign-lib/server-only/user/find-user-security-audit-logs';
import { submitSupportTicket } from '@hanzo/sign-lib/server-only/user/submit-support-ticket';
import { updateProfile } from '@hanzo/sign-lib/server-only/user/update-profile';

import {
  ZFindUserSecurityAuditLogsSchema,
  ZSetProfileImageMutationSchema,
  ZSubmitSupportTicketMutationSchema,
  ZUpdateProfileMutationSchema,
} from '../../../server/profile-router/schema';
import type { ZapContext } from '../context';
import type { ZapRouteMap } from '../dispatch';

export const profileRoutes: ZapRouteMap = {
  'profile.findUserSecurityAuditLogs': async (ctx: ZapContext, raw) => {
    const input = ZFindUserSecurityAuditLogsSchema.parse(raw);
    return await findUserSecurityAuditLogs({ userId: ctx.user.id, ...input });
  },

  'profile.updateProfile': async (ctx: ZapContext, raw) => {
    const { name, signature } = ZUpdateProfileMutationSchema.parse(raw);
    await updateProfile({
      userId: ctx.user.id,
      name,
      signature,
      requestMetadata: ctx.metadata.requestMetadata,
    });
    return undefined;
  },

  'profile.deleteAccount': async (ctx: ZapContext) => {
    await deleteUser({ id: ctx.user.id });
    return undefined;
  },

  'profile.setProfileImage': async (ctx: ZapContext, raw) => {
    const { bytes, teamId, organisationId } = ZSetProfileImageMutationSchema.parse(raw);

    let target: SetAvatarImageOptions['target'] = { type: 'user' };
    if (teamId) target = { type: 'team', teamId };
    if (organisationId) target = { type: 'organisation', organisationId };

    return await setAvatarImage({
      userId: ctx.user.id,
      target,
      bytes,
      requestMetadata: ctx.metadata,
    });
  },

  'profile.submitSupportTicket': async (ctx: ZapContext, raw) => {
    const { subject, message, organisationId, teamId } =
      ZSubmitSupportTicketMutationSchema.parse(raw);

    const parsedTeamId = teamId ? Number(teamId) : null;
    if (typeof parsedTeamId === 'number') {
      if (Number.isNaN(parsedTeamId) || parsedTeamId <= 0) {
        throw new AppError(AppErrorCode.INVALID_BODY, { message: 'Invalid team ID provided' });
      }
    }

    return await submitSupportTicket({
      subject,
      message,
      userId: ctx.user.id,
      organisationId,
      teamId: parsedTeamId,
    });
  },
};
