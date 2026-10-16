import { Trans } from '@lingui/react/macro';
import { OrganisationMemberInviteStatus } from '@prisma/client';
import { Form, Link } from 'react-router';

import { prisma } from '@hanzo/esign-prisma';
import { Button } from '@hanzo/esign-ui/primitives/button';

import type { Route } from './+types/organisation.decline.$token';

const findInvitation = async (token: string | undefined) =>
  token
    ? await prisma.organisationMemberInvite.findUnique({
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
      })
    : null;

/** Shows the invitation; declining it is the POST below, never the page load. */
export async function loader({ params }: Route.LoaderArgs) {
  const organisationMemberInvite = await findInvitation(params.token);

  if (!organisationMemberInvite) {
    return {
      state: 'InvalidLink',
    } as const;
  }

  return {
    state:
      organisationMemberInvite.status === OrganisationMemberInviteStatus.DECLINED
        ? 'Success'
        : 'Ready',
    organisationName: organisationMemberInvite.organisation.name,
  } as const;
}

export async function action({ params }: Route.ActionArgs) {
  const organisationMemberInvite = await findInvitation(params.token);

  if (!organisationMemberInvite) {
    return {
      state: 'InvalidLink',
    } as const;
  }

  if (organisationMemberInvite.status !== OrganisationMemberInviteStatus.DECLINED) {
    await prisma.organisationMemberInvite.update({
      where: {
        id: organisationMemberInvite.id,
      },
      data: {
        status: OrganisationMemberInviteStatus.DECLINED,
      },
    });
  }

  return {
    state: 'Success',
    organisationName: organisationMemberInvite.organisation.name,
  } as const;
}

export default function DeclineInvitationPage({ loaderData, actionData }: Route.ComponentProps) {
  const data = actionData ?? loaderData;

  if (data.state === 'InvalidLink') {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="w-full">
          <h1 className="text-4xl font-semibold">
            <Trans>Invalid token</Trans>
          </h1>

          <p className="mb-4 mt-2 text-sm text-muted-foreground">
            <Trans>This token is invalid or has expired. No action is needed.</Trans>
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

  if (data.state === 'Ready') {
    return (
      <div className="w-screen max-w-lg px-4">
        <h1 className="text-4xl font-semibold">
          <Trans>Decline invitation</Trans>
        </h1>

        <p className="mb-4 mt-2 text-sm text-muted-foreground">
          <Trans>
            Decline the invitation from <strong>{data.organisationName}</strong> to join their
            organisation?
          </Trans>
        </p>

        <Form method="post">
          <Button type="submit" variant="destructive">
            <Trans>Decline invitation</Trans>
          </Button>
        </Form>
      </div>
    );
  }

  return (
    <div className="w-screen max-w-lg px-4">
      <h1 className="text-4xl font-semibold">
        <Trans>Invitation declined</Trans>
      </h1>

      <p className="mb-4 mt-2 text-sm text-muted-foreground">
        <Trans>
          You have declined the invitation from <strong>{data.organisationName}</strong> to join
          their organisation.
        </Trans>
      </p>

      <Button asChild>
        <Link to="/">
          <Trans>Return to Home</Trans>
        </Link>
      </Button>
    </div>
  );
}
