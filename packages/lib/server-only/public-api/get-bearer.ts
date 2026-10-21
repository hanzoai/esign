import { prisma } from '@hanzo/esign-prisma';

import { IAM_PROVIDER } from '../../constants/auth';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { env } from '../../utils/env';
import { credentialIsCurrent } from '../../utils/iam-sign-in';
import { buildTeamWhereQuery } from '../../utils/teams';
import { verifyIamToken } from '../iam/token';
import { readStanding } from '../user/standing';

const holder = { select: { id: true, name: true, email: true, disabled: true } } as const;

const refuse = (message = 'Invalid token') =>
  new AppError(AppErrorCode.UNAUTHORIZED, { message, statusCode: 401 });

/**
 * The one bearer this server accepts: a Hanzo IAM access token minted for it —
 * signed by a key IAM publishes, issued by IAM, its audience this application's
 * own client id, unexpired (verifyIamToken). Nothing else authenticates a call
 * that carries no session: this server mints no tokens of its own.
 *
 * Every bearer acts in one team, the one it names (X-Team-Id).
 *
 *   - A PERSON acts as themselves: the account their IAM sign-in linked, in a
 *     team they belong to.
 *   - An APPLICATION acts for a team of the org this eSign serves (IAM_ORG) and
 *     of no other: an app of another org is refused whatever team it names. It
 *     acts as the team's organisation owner, who is who a team-wide credential
 *     has always acted as, and it is audited under its own IAM name.
 *
 * Either way the user it acts as must stand where sign-in admits them.
 */
export const getBearer = async ({ token, teamId }: { token: string; teamId?: number }) => {
  const claims = await verifyIamToken(token).catch(() => {
    throw refuse();
  });

  if (!teamId || !Number.isInteger(teamId) || teamId <= 0) {
    throw refuse('A bearer acts in one team: name it with X-Team-Id');
  }

  const app = claims.type === 'application';

  if (app && (!env('IAM_ORG') || claims.owner !== env('IAM_ORG'))) {
    throw refuse('An application acts here only for the org this eSign serves');
  }

  const person = app
    ? null
    : await prisma.account.findFirst({
        where: { provider: IAM_PROVIDER, providerAccountId: claims.sub },
        select: { user: holder },
      });

  if (!app && !person) {
    throw refuse('This IAM account has never signed in here');
  }

  const team = await prisma.team.findFirst({
    where: person ? buildTeamWhereQuery({ teamId, userId: person.user.id }) : { id: teamId },
    include: { organisation: { select: { owner: holder } } },
  });

  if (!team) {
    throw refuse('No such team for this bearer');
  }

  const user = person ? person.user : team.organisation.owner;
  const standing = await readStanding(user.id);

  if (!standing || !credentialIsCurrent(standing)) {
    throw refuse();
  }

  return {
    /** The IAM subject, for the request log. */
    id: claims.sub,
    /** Set for an application: the name the act is audited under. */
    app: app ? claims.sub : null,
    user,
    userId: user.id,
    team,
    teamId: team.id,
  };
};
