import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DownloadIcon } from 'lucide-react';

import { downloadFile } from '@hanzo/esign-lib/client-only/download-file';
import { base64 } from '@hanzo/esign-lib/universal/base64';
import { useZapMutation } from '@hanzo/esign-trpc/zap/react';
import type { TDownloadDocumentAuditLogsRequest, TDownloadDocumentAuditLogsResponse } from '@hanzo/esign-trpc/server/document-router/download-document-audit-logs.types';
import { cn } from '@hanzo/esign-ui/lib/utils';
import { Button } from '@hanzo/esign-ui/primitives/button';
import { useToast } from '@hanzo/esign-ui/primitives/use-toast';

export type DocumentAuditLogDownloadButtonProps = {
  className?: string;
  documentId: number;
};

export const DocumentAuditLogDownloadButton = ({
  className,
  documentId,
}: DocumentAuditLogDownloadButtonProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();

  const { mutateAsync: downloadAuditLogs, isPending } = useZapMutation<
    TDownloadDocumentAuditLogsResponse,
    TDownloadDocumentAuditLogsRequest
  >('document.auditLog.download');

  const onDownloadAuditLogsClick = async () => {
    try {
      const { data, envelopeTitle } = await downloadAuditLogs({ documentId });

      const buffer = new Uint8Array(base64.decode(data));
      const blob = new Blob([buffer], { type: 'application/pdf' });

      downloadFile({
        data: blob,
        filename: `${envelopeTitle} - Audit Logs.pdf`,
      });
    } catch (error) {
      console.error(error);

      toast({
        title: _(msg`Something went wrong`),
        description: _(
          msg`Sorry, we were unable to download the audit logs. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  return (
    <Button
      className={cn('w-full sm:w-auto', className)}
      loading={isPending}
      onClick={() => void onDownloadAuditLogsClick()}
    >
      {!isPending && <DownloadIcon className="mr-1.5 h-4 w-4" />}
      <Trans>Download Audit Logs</Trans>
    </Button>
  );
};
