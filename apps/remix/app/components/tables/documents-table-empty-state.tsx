import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { match } from 'ts-pattern';

import { ExtendedDocumentStatus } from '@hanzo/esign-prisma/types/extended-document-status';

import { Empty } from '~/components/general/empty';

export type DocumentsTableEmptyStateProps = { status: ExtendedDocumentStatus };

export const DocumentsTableEmptyState = ({ status }: DocumentsTableEmptyStateProps) => {
  const { _ } = useLingui();

  const { title, message } = match(status)
    .with(ExtendedDocumentStatus.COMPLETED, () => ({
      title: msg`Nothing to do`,
      message: msg`There are no completed documents yet. Documents that you have created or received will appear here once completed.`,
    }))
    .with(ExtendedDocumentStatus.DRAFT, () => ({
      title: msg`No active drafts`,
      message: msg`There are no active drafts at the current moment. You can upload a document to start drafting.`,
    }))
    .with(ExtendedDocumentStatus.ALL, () => ({
      title: msg`We're all empty`,
      message: msg`You have not yet created or received any documents. To create a document please upload one.`,
    }))
    .otherwise(() => ({
      title: msg`Nothing to do`,
      message: msg`All documents have been processed. Any new documents that are sent or received will show here.`,
    }));

  return (
    <Empty title={_(title)} data-testid="empty-document-state">
      {_(message)}
    </Empty>
  );
};
