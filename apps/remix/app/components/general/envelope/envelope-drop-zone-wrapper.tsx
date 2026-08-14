import type { ReactNode } from 'react';

import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';
import { Loader } from 'lucide-react';
import {
  ErrorCode as DropzoneErrorCode,
  ErrorCode,
  type FileRejection,
  useDropzone,
} from 'react-dropzone';
import { Link, useNavigate, useParams } from 'react-router';
import { match } from 'ts-pattern';

import { useCurrentOrganisation } from '@hanzo/esign-lib/client-only/providers/organisation';
import { useSession } from '@hanzo/esign-lib/client-only/providers/session';
import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT, IS_BILLING_ENABLED } from '@hanzo/esign-lib/constants/app';
import { useLimits } from '@hanzo/esign-lib/server-only/limits/provider/client';
import { megabytesToBytes } from '@hanzo/esign-lib/universal/unit-convertions';
import { cn } from '@hanzo/esign-ui/lib/utils';
import { useToast } from '@hanzo/esign-ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

import { useCreateEnvelope } from './create';

export interface EnvelopeDropZoneWrapperProps {
  children: ReactNode;
  type: EnvelopeType;
  className?: string;
}

export const EnvelopeDropZoneWrapper = ({
  children,
  type,
  className,
}: EnvelopeDropZoneWrapperProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const { user } = useSession();
  const { folderId } = useParams();

  const team = useCurrentTeam();

  const navigate = useNavigate();
  const organisation = useCurrentOrganisation();

  const { quota, remaining, maximumEnvelopeItemCount } = useLimits();

  const { create, isCreating } = useCreateEnvelope({ type, folderId });

  const isUploadDisabled = remaining.documents === 0 || !user.emailVerified;

  const onFileDrop = async (files: File[]) => {
    if (isUploadDisabled && IS_BILLING_ENABLED()) {
      await navigate(`/o/${organisation.url}/settings/billing`);
      return;
    }

    await create(files);
  };

  const onFileDropRejected = (fileRejections: FileRejection[]) => {
    if (!fileRejections.length) {
      return;
    }

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

    // Since users can only upload only one file (no multi-upload), we only handle the first file rejection
    const { file, errors } = fileRejections[0];

    if (!errors.length) {
      return;
    }

    const errorNodes = errors.map((error, index) => (
      <span key={index} className="block">
        {match(error.code)
          .with(ErrorCode.FileTooLarge, () => (
            <Trans>File is larger than {APP_DOCUMENT_UPLOAD_SIZE_LIMIT}MB</Trans>
          ))
          .with(ErrorCode.FileInvalidType, () => <Trans>Only PDF files are allowed</Trans>)
          .with(ErrorCode.FileTooSmall, () => <Trans>File is too small</Trans>)
          .with(ErrorCode.TooManyFiles, () => (
            <Trans>Only one file can be uploaded at a time</Trans>
          ))
          .otherwise(() => (
            <Trans>Unknown error</Trans>
          ))}
      </span>
    ));

    const description = (
      <>
        <span className="font-medium">
          <Trans>{file.name} couldn't be uploaded:</Trans>
        </span>
        {errorNodes}
      </>
    );

    toast({
      title: t`Upload failed`,
      description,
      duration: 5000,
      variant: 'destructive',
    });
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: true,
    maxSize: megabytesToBytes(APP_DOCUMENT_UPLOAD_SIZE_LIMIT),
    maxFiles: maximumEnvelopeItemCount,
    onDrop: (files) => void onFileDrop(files),
    onDropRejected: onFileDropRejected,
    noClick: true,
    noDragEventsBubbling: true,
  });

  return (
    <div {...getRootProps()} className={cn('relative min-h-screen', className)}>
      <input {...getInputProps()} />
      {children}

      {isDragActive && (
        <div className="fixed left-0 top-0 z-[9999] h-full w-full bg-muted/60 backdrop-blur-[4px]">
          <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center">
            <h2 className="text-2xl font-semibold text-foreground">
              {type === EnvelopeType.DOCUMENT ? (
                <Trans>Upload Document</Trans>
              ) : (
                <Trans>Upload Template</Trans>
              )}
            </h2>

            <p className="text-md mt-4 text-muted-foreground">
              <Trans>Drag and drop your PDF file here</Trans>
            </p>

            {isUploadDisabled && IS_BILLING_ENABLED() && (
              <Link
                to={`/o/${organisation.url}/settings/billing`}
                className="mt-4 text-sm text-muted-foreground hover:underline"
              >
                <Trans>Upgrade your plan to upload more documents</Trans>
              </Link>
            )}

            {!isUploadDisabled &&
              team?.id === undefined &&
              remaining.documents > 0 &&
              Number.isFinite(remaining.documents) && (
                <p className="mt-4 text-sm text-muted-foreground/80">
                  <Trans>
                    {remaining.documents} of {quota.documents} documents remaining this month.
                  </Trans>
                </p>
              )}
          </div>
        </div>
      )}

      {isCreating && (
        <div className="absolute inset-0 z-50 bg-muted/30 backdrop-blur-[2px]">
          <div className="pointer-events-none flex h-1/2 w-full flex-col items-center justify-center">
            <Loader className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-8 font-medium text-foreground">
              <Trans>Uploading</Trans>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
