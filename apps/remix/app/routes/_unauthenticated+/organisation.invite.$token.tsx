import { Trans } from '@lingui/react/macro';
import { OrganisationMemberInviteStatus } from '@prisma/client';
import { Form, Link } from 'react-router';

import { getOptionalSession } from '@hanzo/esign-auth/server/lib/utils/get-session';
import { acceptOrganisationInvitation } from '@hanzo/esign-lib/server-only/organisation/accept-organisation-invitation';
import { isInvitedPerson } from '@hanzo/esign-lib/server-only/organisation/is-invited-person';
import { vouches } from '@hanzo/esign-lib/utils/iam-sign-in';
import { prisma } from '@hanzo/esign-prisma';
import { Button } from '@hanzo/esign-ui/primitives/button';

import type { Route } from './+types/organisation.invite.$token';

/**
 * The invitation a token names and whether the signed-in person may accept it.
 * Reading it changes nothing: acceptance is the POST below, made by the invited
 * person pressing the button.
 */
const readInvitation = async (request: Request, token: string | undefined) => {
  if (!token) {
    return { state: 'InvalidLink' } as const;
  }

  const session = await getOptionalSession(request);

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
      inviter: {
        select: {
          roles: true,
          disabled: true,
        },
      },
    },
  });

  // An invitation its sender no longer vouches for is as good as withdrawn.
  if (
    !organisationMemberInvite ||
    organisationMemberInvite.status === OrganisationMemberInviteStatus.DECLINED ||
    !vouches(organisationMemberInvite.inviter)
  ) {
    return { state: 'InvalidLink' } as const;
  }

  const email = organisationMemberInvite.email;
  const organisationName = organisationMemberInvite.organisation.name;

  // The invitation joins the person signed in, so nobody is added until the
  // invited person is the one holding the session.
  if (!session.user) {
    const signInPath = `/signin?returnTo=${encodeURIComponent(`/organisation/invite/${token}`)}`;

    return { state: 'LoginRequired', email, organisationName, signInPath } as const;
  }

  if (!isInvitedPerson(session.user, email)) {
    return { state: 'WrongAccount', email, organisationName } as const;
  }

  if (organisationMemberInvite.status === OrganisationMemberInviteStatus.ACCEPTED) {
    return { state: 'Success', email, organisationName } as const;
  }

  return { state: 'Ready', email, organisationName, userId: session.user.id, token } as const;
};

export async function loader({ params, request }: Route.LoaderArgs) {
  const invitation = await readInvitation(request, params.token);

  if (invitation.state === 'Ready') {
    return {
      state: 'Ready',
      email: invitation.email,
      organisationName: invitation.organisationName,
    } as const;
  }

  return invitation;
}

export async function action({ params, request }: Route.ActionArgs) {
  const invitation = await readInvitation(request, params.token);

  if (invitation.state !== 'Ready') {
    return invitation;
  }

  await acceptOrganisationInvitation({
    token: invitation.token,
    userId: invitation.userId,
  });

  return {
    state: 'Success',
    email: invitation.email,
    organisationName: invitation.organisationName,
  } as const;
}

export default function AcceptInvitationPage({ loaderData, actionData }: Route.ComponentProps) {
  const data = actionData ?? loaderData;

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

  if (data.state === 'Ready') {
    return (
      <div>
        <h1 className="text-4xl font-semibold">
          <Trans>Organisation invitation</Trans>
        </h1>

        <p className="mb-4 mt-2 text-sm text-muted-foreground">
          <Trans>
            You have been invited by <strong>{data.organisationName}</strong> to join their
            organisation.
          </Trans>
        </p>

        <Form method="post">
          <Button type="submit">
            <Trans>Accept invitation</Trans>
          </Button>
        </Form>
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
