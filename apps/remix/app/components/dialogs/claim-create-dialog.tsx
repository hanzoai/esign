import { useState } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';
import type { z } from 'zod';

import type { TLicenseClaim } from '@hanzo/sign-lib/types/license';
import { generateDefaultSubscriptionClaim } from '@hanzo/sign-lib/utils/organisations-claims';
import { trpc } from '@hanzo/sign-trpc/react';
import type { ZCreateSubscriptionClaimRequestSchema } from '@hanzo/sign-trpc/server/admin-router/create-subscription-claim.types';
import { Button } from '@hanzo/sign-ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@hanzo/sign-ui/primitives/dialog';
import { useToast } from '@hanzo/sign-ui/primitives/use-toast';

import { SubscriptionClaimForm } from '../forms/subscription-claim-form';

export type CreateClaimFormValues = z.infer<typeof ZCreateSubscriptionClaimRequestSchema>;

type ClaimCreateDialogProps = {
  licenseFlags?: TLicenseClaim;
};

export const ClaimCreateDialog = ({ licenseFlags }: ClaimCreateDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);

  const { mutateAsync: createClaim, isPending } = trpc.admin.claims.create.useMutation({
    onSuccess: () => {
      toast({
        title: t`Subscription claim created successfully.`,
      });

      setOpen(false);
    },
    onError: () => {
      toast({
        title: t`Failed to create subscription claim.`,
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild={true}>
        <Button className="flex-shrink-0" variant="secondary">
          <Trans>Create claim</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Trans>Create Subscription Claim</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Fill in the details to create a new subscription claim.</Trans>
          </DialogDescription>
        </DialogHeader>

        <SubscriptionClaimForm
          subscriptionClaim={{
            ...generateDefaultSubscriptionClaim(),
          }}
          onFormSubmit={createClaim}
          licenseFlags={licenseFlags}
          formSubmitTrigger={
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                <Trans>Cancel</Trans>
              </Button>

              <Button type="submit" loading={isPending}>
                <Trans>Create Claim</Trans>
              </Button>
            </DialogFooter>
          }
        />
      </DialogContent>
    </Dialog>
  );
};
