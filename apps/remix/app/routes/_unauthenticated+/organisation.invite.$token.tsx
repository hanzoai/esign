import { Trans } from '@lingui/react/macro';
import { OrganisationMemberInviteStatus } from '@prisma/client';
import { Link } from 'react-router';

import { getOptionalSession } from '@hanzo/esign-auth/server/lib/utils/get-session';
import { acceptOrganisationInvitation } from '@hanzo/esign-lib/server-only/organisation/accept-organisation-invitation';
import { isInvitedPerson } from '@hanzo/esign-lib/server-only/organisation/is-invited-person';
import { prisma } from '@hanzo/esign-prisma';
import { Button } from '@hanzo/esign-ui/primitives/button';

import type { Route } from './+types/organisation.invite.$token';

export async function loader({ params, request }: Route.LoaderArgs) {
  const session = await getOptionalSession(request);

  const { token } = params;

  if (!token) {
    return {
      state: 'InvalidLink',
    } as const;
  }

  const organisationMemberInvite = await prisma.organisationMemberInvite.findUnique({
    where: {
      token,
    },
    include: {
      organisation: {
        select: {
          name: true,
        },
      },
    },
  });

  if (
    !organisationMemberInvite ||
    organisationMemberInvite.status === OrganisationMemberInviteStatus.DECLINED
  ) {
    return {
      state: 'InvalidLink',
    } as const;
  }

  const signInPath = `/signin?returnTo=${encodeURIComponent(`/organisation/invite/${token}`)}`;

  // The invitation joins the person signed in, so nobody is added until the
  // invited person is the one holding the session.
  if (!session.user) {
    return {
      state: 'LoginRequired',
      email: organisationMemberInvite.email,
      organisationName: organisationMemberInvite.organisation.name,
      signInPath,
    } as const;
  }

  if (!isInvitedPerson(session.user, organisationMemberInvite.email)) {
    return {
      state: 'WrongAccount',
      email: organisationMemberInvite.email,
      organisationName: organisationMemberInvite.organisation.name,
    } as const;
  }

  await acceptOrganisationInvitation({
    token: organisationMemberInvite.token,
    userId: session.user.id,
  });

  return {
    state: 'Success',
    email: organisationMemberInvite.email,
    organisationName: organisationMemberInvite.organisation.name,
  } as const;
}

export default function AcceptInvitationPage({ loaderData }: Route.ComponentProps) {
  const data = loaderData;

  if (data.state === 'InvalidLink') {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="w-full">
          <h1 className="text-4xl font-semibold">
            <Trans>Invalid token</Trans>
          </h1>

          <p className="mb-4 mt-2 text-sm text-muted-foreground">
            <Trans>
              This token is invalid or has expired. Please contact your team for a new invitation.
            </Trans>
          </p>

          <Button asChild>
            <Link to="/">
              <Trans>Return</Trans>
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (data.state === 'LoginRequired') {
    return (
      <div>
        <h1 className="text-4xl font-semibold">
          <Trans>Organisation invitation</Trans>
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          <Trans>
            You have been invited by <strong>{data.organisationName}</strong> to join their
            organisation.
          </Trans>
        </p>

        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          <Trans>
            Sign in with Hanzo as <strong>{data.email}</strong> to accept this invitation.
          </Trans>
        </p>

        <Button asChild>
          <Link to={data.signInPath}>
            <Trans>Sign in to accept</Trans>
          </Link>
        </Button>
      </div>
    );
  }

  if (data.state === 'WrongAccount') {
    return (
      <div>
        <h1 className="text-4xl font-semibold">
          <Trans>Organisation invitation</Trans>
        </h1>

        <p className="mb-4 mt-2 text-sm text-muted-foreground">
          <Trans>
            This invitation from <strong>{data.organisationName}</strong> was sent to{' '}
            <strong>{data.email}</strong>. Sign in as that address to accept it.
          </Trans>
        </p>

        <Button asChild>
          <Link to="/">
            <Trans>Return</Trans>
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-4xl font-semibold">
        <Trans>Invitation accepted!</Trans>
      </h1>

      <p className="mb-4 mt-2 text-sm text-muted-foreground">
        <Trans>
          You have accepted an invitation from <strong>{data.organisationName}</strong> to join
          their organisation.
        </Trans>
      </p>

      <Button asChild>
        <Link to="/">
          <Trans>Continue</Trans>
        </Link>
      </Button>
    </div>
  );
}
