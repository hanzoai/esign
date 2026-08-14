import { useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';
import { useNavigate, useParams } from 'react-router';

import { useAnalytics } from '@hanzo/esign-lib/client-only/hooks/use-analytics';
import { useCurrentOrganisation } from '@hanzo/esign-lib/client-only/providers/organisation';
import { useSession } from '@hanzo/esign-lib/client-only/providers/session';
import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@hanzo/esign-lib/constants/app';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@hanzo/esign-lib/constants/time-zones';
import { useLimits } from '@hanzo/esign-lib/server-only/limits/provider/client';
import { formatDocumentsPath, formatTemplatesPath } from '@hanzo/esign-lib/utils/teams';
import type {
  TCreateDocumentPayloadSchema,
  TCreateDocumentResponse,
} from '@hanzo/esign-trpc/server/document-router/create-document.types';
import type { TCreateTemplatePayloadSchema } from '@hanzo/esign-trpc/server/template-router/schema';
import { useZapMutation } from '@hanzo/esign-trpc/zap/react';
import { cn } from '@hanzo/esign-ui/lib/utils';
import { DocumentUploadButton as DocumentUploadButtonPrimitive } from '@hanzo/esign-ui/primitives/document-upload-button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@hanzo/esign-ui/primitives/tooltip';
import { useToast } from '@hanzo/esign-ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

import { uploadErrorMessage } from '../envelope/upload-error';

export type DocumentUploadButtonLegacyProps = {
  className?: string;
  type: EnvelopeType;
};

export const DocumentUploadButtonLegacy = ({
  className,
  type,
}: DocumentUploadButtonLegacyProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { user } = useSession();
  const { folderId } = useParams();

  const team = useCurrentTeam();

  const navigate = useNavigate();
  const analytics = useAnalytics();
  const organisation = useCurrentOrganisation();

  const userTimezone =
    TIME_ZONES.find((timezone) => timezone === Intl.DateTimeFormat().resolvedOptions().timeZone) ??
    DEFAULT_DOCUMENT_TIME_ZONE;

  const { quota, remaining, refreshLimits } = useLimits();

  const [isLoading, setIsLoading] = useState(false);

  const { mutateAsync: createDocument } = useZapMutation<TCreateDocumentResponse, FormData>(
    'document.create',
  );
  const { mutateAsync: createTemplate } = useZapMutation<{ envelopeId: string }, FormData>(
    'template.createTemplate',
  );

  const disabledMessage = useMemo(() => {
    if (!user.emailVerified) {
      return msg`Verify your email to upload documents.`;
    }

    // No errors for templates.
    if (type === EnvelopeType.TEMPLATE) {
      return;
    }

    if (organisation.subscription && remaining.documents === 0) {
      return msg`Document upload disabled due to unpaid invoices`;
    }

    if (remaining.documents === 0) {
      return msg`You have reached your document limit.`;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining.documents, user.emailVerified, team, type]);

  const onFileDrop = async (file: File) => {
    try {
      setIsLoading(true);

      const payload = {
        title: file.name,
        folderId: folderId ?? undefined,
        meta: {
          timezone: userTimezone,
        },
      } satisfies TCreateDocumentPayloadSchema | TCreateTemplatePayloadSchema;

      const formData = new FormData();

      formData.append('payload', JSON.stringify(payload));
      formData.append('file', file);

      // Handle legacy document creation.
      if (type === EnvelopeType.DOCUMENT) {
        const { envelopeId: id } = await createDocument(formData);

        void refreshLimits();

        await navigate(`${formatDocumentsPath(team.url)}/${id}/edit`);

        toast({
          title: _(msg`Document uploaded`),
          description: _(msg`Your document has been uploaded successfully.`),
          duration: 5000,
        });

        analytics.capture('App: Document Uploaded', {
          userId: user.id,
          documentId: id,
          timestamp: new Date().toISOString(),
        });
      }

      // Handle legacy template creation.
      if (type === EnvelopeType.TEMPLATE) {
        const { envelopeId: id } = await createTemplate(formData);

        await navigate(`${formatTemplatesPath(team.url)}/${id}/edit`);

        toast({
          title: _(msg`Template document uploaded`),
          description: _(
            msg`Your document has been uploaded successfully. You will be redirected to the template page.`,
          ),
          duration: 5000,
        });
      }
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(uploadErrorMessage(err, type)),
        variant: 'destructive',
        duration: 7500,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onFileDropRejected = () => {
    toast({
      title: _(msg`Your document failed to upload.`),
      description: _(msg`File cannot be larger than ${APP_DOCUMENT_UPLOAD_SIZE_LIMIT}MB`),
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
              <DocumentUploadButtonPrimitive
                loading={isLoading}
                disabled={disabledMessage !== undefined}
                disabledMessage={disabledMessage}
                onDrop={async (files) => onFileDrop(files[0])}
                onDropRejected={onFileDropRejected}
                type={type}
                internalVersion="1"
              />
            </div>
          </TooltipTrigger>

          {team?.id === undefined &&
            type === EnvelopeType.DOCUMENT &&
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
