import { Trans, useLingui } from '@lingui/react/macro';
import { OrganisationGroupType, OrganisationMemberRole, TeamMemberRole } from '@prisma/client';
import { z } from 'zod';

import { useCurrentOrganisation } from '@hanzo/esign-lib/client-only/providers/organisation';
import type { ZCreateTeamGroupsRequestSchema } from '@hanzo/esign-trpc/server/team-router/create-team-groups.types';
import type { TFindOrganisationGroupsResponse } from '@hanzo/esign-trpc/server/organisation-router/find-organisation-groups.types';
import { useZapMutation, useZapQuery } from '@hanzo/esign-trpc/zap/react';
import { Button } from '@hanzo/esign-ui/primitives/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@hanzo/esign-ui/primitives/dialog';
import { useToast } from '@hanzo/esign-ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

export const TeamMemberInheritEnableDialog = () => {
  const organisation = useCurrentOrganisation();
  const team = useCurrentTeam();

  const { toast } = useToast();
  const { t } = useLingui();

  const { mutateAsync: createTeamGroups, isPending } = useZapMutation<
    void,
    z.infer<typeof ZCreateTeamGroupsRequestSchema>
  >('team.group.createMany', {
    onSuccess: () => {
      toast({
        title: t`Access enabled`,
        duration: 5000,
      });
    },
    onError: () => {
      toast({
        title: t`Something went wrong`,
        description: t`We encountered an unknown error while attempting to enable access.`,
        variant: 'destructive',
        duration: 5000,
      });
    },
  });

  const organisationGroupQuery = useZapQuery<TFindOrganisationGroupsResponse>(
    'organisation.group.find',
    {
      organisationId: organisation.id,
      perPage: 1,
      types: [OrganisationGroupType.INTERNAL_ORGANISATION],
      organisationRoles: [OrganisationMemberRole.MEMBER],
    },
  );

  const enableAccessGroup = async () => {
    if (!organisationGroupQuery.data?.data[0]?.id) {
      return;
    }

    await createTeamGroups({
      teamId: team.id,
      groups: [
        {
          organisationGroupId: organisationGroupQuery.data?.data[0]?.id,
          teamRole: TeamMemberRole.MEMBER,
        },
      ],
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Trans>Enable access</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Are you sure?</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>
              You are about to give all organisation members access to this team under their
              organisation role.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              <Trans>Cancel</Trans>
            </Button>
          </DialogClose>

          <Button
            type="submit"
            disabled={organisationGroupQuery.isPending}
            loading={isPending}
            onClick={enableAccessGroup}
          >
            <Trans>Enable</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
