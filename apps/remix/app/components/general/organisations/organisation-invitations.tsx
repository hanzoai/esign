import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Plural, Trans } from '@lingui/react/macro';
import { OrganisationMemberInviteStatus } from '@prisma/client';
import { AnimatePresence } from 'framer-motion';
import { BellIcon } from 'lucide-react';

import { useSession } from '@hanzo/esign-lib/client-only/providers/session';
import { formatAvatarUrl } from '@hanzo/esign-lib/utils/avatars';
import type { TAcceptOrganisationMemberInviteResponse } from '@hanzo/esign-trpc/server/organisation-router/accept-organisation-member-invite.types';
import type { TDeclineOrganisationMemberInviteResponse } from '@hanzo/esign-trpc/server/organisation-router/decline-organisation-member-invite.types';
import type { TGetOrganisationMemberInvitesResponse } from '@hanzo/esign-trpc/server/organisation-router/get-organisation-member-invites.types';
import { useZapMutation, useZapQuery } from '@hanzo/esign-trpc/zap/react';
import { AnimateGenericFadeInOut } from '@hanzo/esign-ui/components/animate/animate-generic-fade-in-out';
import { Alert, AlertDescription } from '@hanzo/esign-ui/primitives/alert';
import { AvatarWithText } from '@hanzo/esign-ui/primitives/avatar';
import { Button } from '@hanzo/esign-ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@hanzo/esign-ui/primitives/dialog';
import { useToast } from '@hanzo/esign-ui/primitives/use-toast';

export const OrganisationInvitations = ({ className }: { className?: string }) => {
  const { data, isLoading } = useZapQuery<TGetOrganisationMemberInvitesResponse>(
    'organisation.member.invite.getMany',
    {
      status: OrganisationMemberInviteStatus.PENDING,
    },
  );

  return (
    <AnimatePresence>
      {data && data.length > 0 && !isLoading && (
        <AnimateGenericFadeInOut>
          <Alert variant="secondary" className={className}>
            <div className="flex h-full flex-row items-center p-2">
              <BellIcon className="mr-4 h-5 w-5 text-foreground" />

              <AlertDescription className="mr-2">
                <Plural
                  value={data.length}
                  one={
                    <span>
                      You have <strong>1</strong> pending invitation
                    </span>
                  }
                  other={
                    <span>
                      You have <strong>#</strong> pending invitations
                    </span>
                  }
                />
              </AlertDescription>

              <Dialog>
                <DialogTrigger asChild>
                  <button className="ml-auto text-sm font-medium text-foreground hover:opacity-80">
                    <Trans>View invites</Trans>
                  </button>
                </DialogTrigger>

                <DialogContent position="center">
                  <DialogHeader>
                    <DialogTitle>
                      <Trans>Pending invitations</Trans>
                    </DialogTitle>

                    <DialogDescription className="mt-4">
                      <Plural
                        value={data.length}
                        one={
                          <span>
                            You have <strong>1</strong> pending invitation
                          </span>
                        }
                        other={
                          <span>
                            You have <strong>#</strong> pending invitations
                          </span>
                        }
                      />
                    </DialogDescription>
                  </DialogHeader>

                  <ul className="-mx-6 -mb-6 max-h-[80vh] divide-y overflow-auto px-6 pb-6 xl:max-h-[70vh]">
                    {data.map((invitation) => (
                      <li key={invitation.id}>
                        <Alert variant="neutral" className="p-0 px-4">
                          <AvatarWithText
                            avatarSrc={formatAvatarUrl(invitation.organisation.avatarImageId)}
                            className="w-full max-w-none py-4"
                            avatarFallback={invitation.organisation.name.slice(0, 1)}
                            primaryText={
                              <span className="font-semibold text-foreground/80">
                                {invitation.organisation.name}
                              </span>
                            }
                            secondaryText={`/o/${invitation.organisation.url}`}
                            rightSideComponent={
                              <div className="ml-auto space-x-2">
                                <DeclineOrganisationInvitationButton token={invitation.token} />
                                <AcceptOrganisationInvitationButton token={invitation.token} />
                              </div>
                            }
                          />
                        </Alert>
                      </li>
                    ))}
                  </ul>
                </DialogContent>
              </Dialog>
            </div>
          </Alert>
        </AnimateGenericFadeInOut>
      )}
    </AnimatePresence>
  );
};

const AcceptOrganisationInvitationButton = ({ token }: { token: string }) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { refreshSession } = useSession();

  const {
    mutateAsync: acceptOrganisationInvitation,
    isPending,
    isSuccess,
  } = useZapMutation<TAcceptOrganisationMemberInviteResponse, { token: string }>(
    'organisation.member.invite.accept',
    {
      onSuccess: async () => {
        await refreshSession();

        toast({
          title: _(msg`Success`),
          description: _(msg`Invitation accepted`),
          duration: 5000,
        });
      },
      onError: () => {
        toast({
          title: _(msg`Something went wrong`),
          description: _(msg`Unable to join this organisation at this time.`),
          variant: 'destructive',
          duration: 10000,
        });
      },
    },
  );

  return (
    <Button
      onClick={async () => acceptOrganisationInvitation({ token })}
      loading={isPending}
      disabled={isPending || isSuccess}
    >
      <Trans>Accept</Trans>
    </Button>
  );
};

const DeclineOrganisationInvitationButton = ({ token }: { token: string }) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { refreshSession } = useSession();

  const {
    mutateAsync: declineOrganisationInvitation,
    isPending,
    isSuccess,
  } = useZapMutation<TDeclineOrganisationMemberInviteResponse, { token: string }>(
    'organisation.member.invite.decline',
    {
      onSuccess: async () => {
        await refreshSession();

        toast({
          title: _(msg`Success`),
          description: _(msg`Invitation declined`),
          duration: 5000,
        });
      },
      onError: () => {
        toast({
          title: _(msg`Something went wrong`),
          description: _(msg`Unable to decline this invitation at this time.`),
          variant: 'destructive',
          duration: 10000,
        });
      },
    },
  );

  return (
    <Button
      onClick={async () => declineOrganisationInvitation({ token })}
      loading={isPending}
      disabled={isPending || isSuccess}
      variant="ghost"
    >
      <Trans>Decline</Trans>
    </Button>
  );
};
