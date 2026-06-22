import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { Prisma } from '@prisma/client';
import { useRevalidator } from 'react-router';
import type { z } from 'zod';

import { formatAvatarUrl } from '@hanzo/esign-lib/utils/avatars';
import { extractInitials } from '@hanzo/esign-lib/utils/recipient-formatter';
import type {
  TDeleteTeamEmailMutationSchema,
  ZDeleteTeamEmailVerificationMutationSchema,
} from '@hanzo/esign-trpc/server/team-router/schema';
import { useZapMutation } from '@hanzo/esign-trpc/zap/react';
import { Alert } from '@hanzo/esign-ui/primitives/alert';
import { AvatarWithText } from '@hanzo/esign-ui/primitives/avatar';
import { Button } from '@hanzo/esign-ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@hanzo/esign-ui/primitives/dialog';
import { useToast } from '@hanzo/esign-ui/primitives/use-toast';

export type TeamEmailDeleteDialogProps = {
  trigger?: React.ReactNode;
  teamName: string;
  team: Prisma.TeamGetPayload<{
    include: {
      teamEmail: true;
      emailVerification: {
        select: {
          expiresAt: true;
          name: true;
          email: true;
        };
      };
    };
  }>;
};

export const TeamEmailDeleteDialog = ({ trigger, teamName, team }: TeamEmailDeleteDialogProps) => {
  const [open, setOpen] = useState(false);

  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const { mutateAsync: deleteTeamEmail, isPending: isDeletingTeamEmail } = useZapMutation<
    unknown,
    TDeleteTeamEmailMutationSchema
  >('team.email.delete', {
    onSuccess: () => {
      toast({
        title: _(msg`Success`),
        description: _(msg`Team email has been removed`),
        duration: 5000,
      });
    },
    onError: () => {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`Unable to remove team email at this time. Please try again.`),
        variant: 'destructive',
        duration: 10000,
      });
    },
  });

  const { mutateAsync: deleteTeamEmailVerification, isPending: isDeletingTeamEmailVerification } =
    useZapMutation<unknown, z.infer<typeof ZDeleteTeamEmailVerificationMutationSchema>>(
      'team.email.verification.delete',
      {
        onSuccess: () => {
          toast({
            title: _(msg`Success`),
            description: _(msg`Email verification has been removed`),
            duration: 5000,
          });
        },
        onError: () => {
          toast({
            title: _(msg`Something went wrong`),
            description: _(
              msg`Unable to remove email verification at this time. Please try again.`,
            ),
            variant: 'destructive',
            duration: 10000,
          });
        },
      },
    );

  const onRemove = async () => {
    if (team.teamEmail) {
      await deleteTeamEmail({ teamId: team.id });
    }

    if (team.emailVerification) {
      await deleteTeamEmailVerification({ teamId: team.id });
    }

    await revalidate();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => setOpen(value)}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="destructive">
            <Trans>Remove team email</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Are you sure?</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>
              You are about to delete the following team email from{' '}
              <span className="font-semibold">{teamName}</span>.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Alert variant="neutral" padding="tight">
          <AvatarWithText
            avatarClass="h-12 w-12"
            avatarSrc={formatAvatarUrl(team.avatarImageId)}
            avatarFallback={extractInitials(
              (team.teamEmail?.name || team.emailVerification?.name) ?? '',
            )}
            primaryText={
              <span className="text-foreground/80 text-sm font-semibold">
                {team.teamEmail?.name || team.emailVerification?.name}
              </span>
            }
            secondaryText={
              <span className="text-sm">
                {team.teamEmail?.email || team.emailVerification?.email}
              </span>
            }
          />
        </Alert>

        <fieldset disabled={isDeletingTeamEmail || isDeletingTeamEmailVerification}>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              <Trans>Cancel</Trans>
            </Button>

            <Button
              type="submit"
              variant="destructive"
              loading={isDeletingTeamEmail || isDeletingTeamEmailVerification}
              onClick={async () => onRemove()}
            >
              <Trans>Remove</Trans>
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
