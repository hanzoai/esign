import { prisma } from '@hanzo/esign-prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { env } from '../../utils/env';
import { credentialIsCurrent } from '../../utils/iam-sign-in';
import { verifyIamToken } from '../iam/token';
import { readStanding } from '../user/standing';

const holder = { select: { id: true, name: true, email: true, disabled: true } } as const;

const refuse = (message = 'Invalid token') =>
  new AppError(AppErrorCode.UNAUTHORIZED, { message, statusCode: 401 });

/**
 * The team each IAM application acts for, from IAM_APP_TEAMS: `<client id>:<team
 * url>`, comma-separated, e.g. `hanzo-cloud:hanzo`. An application not named
 * here acts for nobody.
 */
export const appTeams = (raw = env('IAM_APP_TEAMS') ?? ''): Map<string, string> =>
  new Map(
    raw
      .split(',')
      .map((pair) => pair.trim().split(':'))
      .filter((pair): pair is [string, string] => pair.length === 2 && pair.every(Boolean)),
  );

/**
 * The one bearer this server accepts: a Hanzo IAM access token an APPLICATION
 * minted for this server — signed by a key IAM publishes, issued by IAM, its
 * audience this server's own client id, unexpired (verifyIamToken) — from a
 * client IAM_APP_TEAMS names. People sign in; the API is for services, and this
 * server mints no tokens of its own.
 *
 * The application acts for exactly the one team IAM_APP_TEAMS maps its client
 * to, as that team's organisation owner (who a team-wide credential has always
 * acted as), and is audited under its own IAM subject. The owner must stand
 * where sign-in admits them.
 */
export const getBearer = async ({ token }: { token: string }) => {
  const claims = await verifyIamToken(token).catch(() => {
    throw refuse();
  });

  if (claims.type !== 'application' || !claims.azp) {
    throw refuse('The API takes an IAM application token; people sign in');
  }

  const url = appTeams().get(claims.azp);

  if (!url) {
    throw refuse('This application acts for no team here');
  }

  const team = await prisma.team.findUnique({
    where: { url },
    include: { organisation: { select: { owner: holder } } },
  });

  if (!team) {
    throw refuse('This application acts for no team here');
  }

  const user = team.organisation.owner;
  const standing = await readStanding(user.id);

  if (!standing || !credentialIsCurrent(standing)) {
    throw refuse();
  }

  return {
    /** The application's IAM subject, which every act is audited under. */
    id: claims.sub,
    user,
    userId: user.id,
    team,
    teamId: team.id,
  };
};
