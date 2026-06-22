import { useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';
import { useNavigate } from 'react-router';

import { formatDocumentsPath, formatTemplatesPath } from '@hanzo/esign-lib/utils/teams';
import type {
  TDuplicateEnvelopeRequest,
  TDuplicateEnvelopeResponse,
} from '@hanzo/esign-trpc/server/envelope-router/duplicate-envelope.types';
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

import { useCurrentTeam } from '~/providers/team';

type EnvelopeDuplicateDialogProps = {
  envelopeId: string;
  envelopeType: EnvelopeType;
  trigger?: React.ReactNode;
};

export const EnvelopeDuplicateDialog = ({
  envelopeId,
  envelopeType,
  trigger,
}: EnvelopeDuplicateDialogProps) => {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);

  const { toast } = useToast();
  const { t } = useLingui();

  const team = useCurrentTeam();

  const { mutateAsync: duplicateEnvelope, isPending: isDuplicating } = useZapMutation<
    TDuplicateEnvelopeResponse,
    TDuplicateEnvelopeRequest
  >('envelope.duplicate', {
    onSuccess: async ({ id }) => {
      toast({
        title: t`Envelope Duplicated`,
        description: t`Your envelope has been successfully duplicated.`,
        duration: 5000,
      });

      const path =
        envelopeType === EnvelopeType.DOCUMENT
          ? formatDocumentsPath(team.url)
          : formatTemplatesPath(team.url);

      await navigate(`${path}/${id}/edit`);
      setOpen(false);
    },
  });

  const onDuplicate = async () => {
    try {
      await duplicateEnvelope({ envelopeId });
    } catch {
      toast({
        title: t`Something went wrong`,
        description: t`This document could not be duplicated at this time. Please try again.`,
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isDuplicating && setOpen(value)}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent>
        {envelopeType === EnvelopeType.DOCUMENT ? (
          <DialogHeader>
            <DialogTitle>
              <Trans>Duplicate Document</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>This document will be duplicated.</Trans>
            </DialogDescription>
          </DialogHeader>
        ) : (
          <DialogHeader>
            <DialogTitle>
              <Trans>Duplicate Template</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>This template will be duplicated.</Trans>
            </DialogDescription>
          </DialogHeader>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" disabled={isDuplicating}>
            <Trans>Cancel</Trans>
          </Button>

          <Button type="button" loading={isDuplicating} onClick={onDuplicate}>
            <Trans>Duplicate</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
