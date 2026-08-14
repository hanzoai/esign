import { useMemo } from 'react';

import { msg, plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';
import { ErrorCode as DropzoneErrorCode, type FileRejection } from 'react-dropzone';

import { useCurrentOrganisation } from '@hanzo/esign-lib/client-only/providers/organisation';
import { useSession } from '@hanzo/esign-lib/client-only/providers/session';
import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@hanzo/esign-lib/constants/app';
import { useLimits } from '@hanzo/esign-lib/server-only/limits/provider/client';
import { cn } from '@hanzo/esign-ui/lib/utils';
import { DocumentUploadButton } from '@hanzo/esign-ui/primitives/document-upload-button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@hanzo/esign-ui/primitives/tooltip';
import { useToast } from '@hanzo/esign-ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

import { useCreateEnvelope } from './create';

export type EnvelopeUploadButtonProps = {
  className?: string;
  type: EnvelopeType;
  folderId?: string;
};

/**
 * Upload an envelope
 */
export const EnvelopeUploadButton = ({ className, type, folderId }: EnvelopeUploadButtonProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const { user } = useSession();

  const team = useCurrentTeam();

  const organisation = useCurrentOrganisation();

  const { quota, remaining, maximumEnvelopeItemCount } = useLimits();

  const { create, isCreating } = useCreateEnvelope({ type, folderId });

  const disabledMessage = useMemo(() => {
    if (organisation.subscription && remaining.documents === 0) {
      return msg`Document upload disabled due to unpaid invoices`;
    }

    if (remaining.documents === 0) {
      return msg`You have reached your document limit.`;
    }

    if (!user.emailVerified) {
      return msg`Verify your email to upload documents.`;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining.documents, user.emailVerified, team]);

  const onFileDropRejected = (fileRejections: FileRejection[]) => {
    const maxItemsReached = fileRejections.some((fileRejection) =>
      fileRejection.errors.some((error) => error.code === DropzoneErrorCode.TooManyFiles),
    );

    if (maxItemsReached) {
      toast({
        title: plural(maximumEnvelopeItemCount, {
          one: `You cannot upload more than # item per envelope.`,
          other: `You cannot upload more than # items per envelope.`,
        }),
        duration: 5000,
        variant: 'destructive',
      });

      return;
    }

    toast({
      title: t`Upload failed`,
      description: t`File cannot be larger than ${APP_DOCUMENT_UPLOAD_SIZE_LIMIT}MB`,
      duration: 5000,
      variant: 'destructive',
    });
  };

  return (
    <div className={cn('relative', className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <DocumentUploadButton
                loading={isCreating}
                disabled={remaining.documents === 0 || !user.emailVerified}
                disabledMessage={disabledMessage}
                onDrop={(files) => void create(files)}
                onDropRejected={onFileDropRejected}
                type={type}
                internalVersion="2"
                maxFiles={maximumEnvelopeItemCount}
              />
            </div>
          </TooltipTrigger>

          {type === EnvelopeType.DOCUMENT &&
            remaining.documents > 0 &&
            Number.isFinite(remaining.documents) && (
              <TooltipContent>
                <p className="text-sm">
                  <Trans>
                    {remaining.documents} of {quota.documents} documents remaining this month.
                  </Trans>
                </p>
              </TooltipContent>
            )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
