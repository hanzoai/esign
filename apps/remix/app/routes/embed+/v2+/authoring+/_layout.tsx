import { useLayoutEffect } from 'react';

import { Trans } from '@lingui/react/macro';
import { OrganisationMemberRole, OrganisationType, TeamMemberRole } from '@prisma/client';
import { Outlet, isRouteErrorResponse, useLoaderData } from 'react-router';
import { match } from 'ts-pattern';

import { PAID_PLAN_LIMITS } from '@hanzo/esign-lib/server-only/limits/constants';
import { LimitsProvider } from '@hanzo/esign-lib/server-only/limits/provider/client';
import { OrganisationProvider } from '@hanzo/esign-lib/client-only/providers/organisation';
import { verifyEmbeddingPresignToken } from '@hanzo/esign-lib/server-only/embedding-presign/verify-embedding-presign-token';
import { getOrganisationClaimByTeamId } from '@hanzo/esign-lib/server-only/organisation/get-organisation-claims';
import { getTeamSettings } from '@hanzo/esign-lib/server-only/team/get-team-settings';
import { ZBaseEmbedDataSchema } from '@hanzo/esign-lib/types/embed-base-schemas';
import { ZapProvider } from '@hanzo/esign-trpc/zap/react';
import type { OrganisationSession } from '@hanzo/esign-trpc/server/organisation-router/get-organisation-session.types';

import { TeamProvider } from '~/providers/team';
import { injectCss } from '~/utils/css-vars';

import type { Route } from './+types/_layout';

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url);

  const token = url.searchParams.get('token');

  if (!token) {
    throw new Response('Invalid token', { status: 404 });
  }

  const result = await verifyEmbeddingPresignToken({ token }).catch(() => null);

  if (!result) {
    throw new Response('Invalid token', { status: 404 });
  }

  const organisationClaim = await getOrganisationClaimByTeamId({
    teamId: result.teamId,
  });

  const teamSettings = await getTeamSettings({
    userId: result.userId,
    teamId: result.teamId,
  });

  return {
    token,
    userId: result.userId,
    teamId: result.teamId,
    organisationClaim,
    preferences: {
      aiFeaturesEnabled: teamSettings.aiFeaturesEnabled,
    },
  };
};

export default function AuthoringLayout() {
  const { token, teamId, organisationClaim, preferences } = useLoaderData<typeof loader>();

  const allowEmbedAuthoringWhiteLabel = organisationClaim.flags.embedAuthoringWhiteLabel ?? false;

  useLayoutEffect(() => {
    try {
      const hash = window.location.hash.slice(1);

      const result = ZBaseEmbedDataSchema.safeParse(JSON.parse(decodeURIComponent(atob(hash))));

      if (!result.success) {
        return;
      }

      const { css, cssVars, darkModeDisabled } = result.data;

      if (darkModeDisabled) {
        document.documentElement.classList.add('dark-mode-disabled');
      }

      if (allowEmbedAuthoringWhiteLabel) {
        injectCss({
          css,
          cssVars,
        });
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  /**
   * Dummy data for providers.
   */
  const team: OrganisationSession['teams'][number] = {
    id: teamId,
    name: '',
    url: '',
    createdAt: new Date(),
    avatarImageId: null,
    organisationId: '',
    currentTeamRole: TeamMemberRole.MEMBER,
    preferences: {
      aiFeaturesEnabled: preferences.aiFeaturesEnabled,
    },
  };

  /**
   * Dummy data for providers.
   */
  const organisation: OrganisationSession = {
    id: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    type: OrganisationType.ORGANISATION,
    name: '',
    url: '',
    avatarImageId: null,
    customerId: null,
    ownerUserId: -1,
    organisationClaim,
    teams: [team],
    subscription: null,
    currentOrganisationRole: OrganisationMemberRole.MEMBER,
  };

  return (
    <OrganisationProvider organisation={organisation}>
      <TeamProvider team={team}>
        <ZapProvider>
          <LimitsProvider
            disableLimitsFetch={true}
            initialValue={{
              quota: PAID_PLAN_LIMITS,
              remaining: PAID_PLAN_LIMITS,
              maximumEnvelopeItemCount: organisationClaim.envelopeItemCount,
            }}
            teamId={team.id}
          >
            <Outlet />
          </LimitsProvider>
        </ZapProvider>
      </TeamProvider>
    </OrganisationProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const errorCode = isRouteErrorResponse(error) ? error.status : 500;

  return (
    <div>
      {match(errorCode)
        .with(404, () => (
          <div>
            <p>
              <Trans>Token Not Found</Trans>
            </p>

            <ul>
              <li>
                <Trans>Ensure that you are using the embedding token, not the API token</Trans>
              </li>
              <li>
                <Trans>
                  If you are using staging, ensure that you have set the host prop on the embedding
                  component to the staging domain (https://stg-app.esign.hanzo.ai)
                </Trans>
              </li>
            </ul>
          </div>
        ))
        .otherwise(() => (
          <p>
            <Trans>An error occurred</Trans>
            {errorCode}
          </p>
        ))}
    </div>
  );
}
