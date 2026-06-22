import { useState } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';

import type { TLicenseClaim } from '@hanzo/esign-lib/types/license';
import type { TFindSubscriptionClaimsResponse } from '@hanzo/esign-trpc/server/admin-router/find-subscription-claims.types';
import type { TUpdateSubscriptionClaimRequest } from '@hanzo/esign-trpc/server/admin-router/update-subscription-claim.types';
import { useZapMutation } from '@hanzo/esign-trpc/zap/react';
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

import { SubscriptionClaimForm } from '../forms/subscription-claim-form';

export type ClaimUpdateDialogProps = {
  claim: TFindSubscriptionClaimsResponse['data'][number];
  trigger: React.ReactNode;
  licenseFlags?: TLicenseClaim;
};

export const ClaimUpdateDialog = ({ claim, trigger, licenseFlags }: ClaimUpdateDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);

  const { mutateAsync: updateClaim, isPending } = useZapMutation<
    void,
    TUpdateSubscriptionClaimRequest
  >('admin.claims.update', {
    onSuccess: () => {
      toast({
        title: t`Subscription claim updated successfully.`,
      });

      setOpen(false);
    },
    onError: () => {
      toast({
        title: t`Failed to update subscription claim.`,
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Trans>Update Subscription Claim</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Modify the details of the subscription claim.</Trans>
          </DialogDescription>
        </DialogHeader>

        <SubscriptionClaimForm
          subscriptionClaim={claim}
          onFormSubmit={async (data) =>
            await updateClaim({
              id: claim.id,
              data,
            })
          }
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
                <Trans>Update Claim</Trans>
              </Button>
            </DialogFooter>
          }
        />
      </DialogContent>
    </Dialog>
  );
};
