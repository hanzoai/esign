import type { OrganisationMemberRole } from '@prisma/client';
import { nanoid } from 'nanoid';

import { generateDatabaseId } from '../../universal/id';

/**
 * A new organisation invitation row: its own id and token, sent now by
 * `inviterId`. Every invitation is made here, first sends and resends alike, so
 * a resend is a fresh invitation from the resender rather than an old one
 * re-stamped.
 */
export const newInvitation = (
  invitee: { email: string; organisationId: string; organisationRole: OrganisationMemberRole },
  inviterId: number,
) => ({
  id: generateDatabaseId('member_invite'),
  email: invitee.email,
  organisationId: invitee.organisationId,
  organisationRole: invitee.organisationRole,
  token: nanoid(32),
  inviterId,
  createdAt: new Date(),
});
