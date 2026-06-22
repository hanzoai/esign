import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { useCurrentOrganisation } from '@hanzo/esign-lib/client-only/providers/organisation';
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

export type OrganisationMemberDeleteDialogProps = {
  organisationMemberId: string;
  organisationMemberName: string;
  organisationMemberEmail: string;
  trigger?: React.ReactNode;
};

export const OrganisationMemberDeleteDialog = ({
  trigger,
  organisationMemberId,
  organisationMemberName,
  organisationMemberEmail,
}: OrganisationMemberDeleteDialogProps) => {
  const [open, setOpen] = useState(false);

  const { _ } = useLingui();
  const { toast } = useToast();

  const organisation = useCurrentOrganisation();

  const { mutateAsync: deleteOrganisationMembers, isPending: isDeletingOrganisationMember } =
    useZapMutation<void, unknown>('organisation.member.delete', {
      onSuccess: () => {
        toast({
          title: _(msg`Success`),
          description: _(msg`You have successfully removed this user from the organisation.`),
          duration: 5000,
        });

        setOpen(false);
      },
      onError: () => {
        toast({
          title: _(msg`An unknown error occurred`),
          description: _(
            msg`We encountered an unknown error while attempting to remove this user. Please try again later.`,
          ),
          variant: 'destructive',
          duration: 10000,
        });
      },
    });

  return (
    <Dialog open={open} onOpenChange={(value) => !isDeletingOrganisationMember && setOpen(value)}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="secondary">
            <Trans>Delete organisation member</Trans>
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
              You are about to remove the following user from{' '}
              <span className="font-semibold">{organisation.name}</span>.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Alert variant="neutral" padding="tight">
          <AvatarWithText
            avatarClass="h-12 w-12"
            avatarFallback={organisationMemberName.slice(0, 1).toUpperCase()}
            primaryText={<span className="font-semibold">{organisationMemberName}</span>}
            secondaryText={organisationMemberEmail}
          />
        </Alert>

        <fieldset disabled={isDeletingOrganisationMember}>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              <Trans>Cancel</Trans>
            </Button>

            <Button
              type="submit"
              variant="destructive"
              loading={isDeletingOrganisationMember}
              onClick={async () =>
                deleteOrganisationMembers({
                  organisationId: organisation.id,
                  organisationMemberId,
                })
              }
            >
              <Trans>Delete</Trans>
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
