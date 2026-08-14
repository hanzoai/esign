import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { EnvelopeType } from '@prisma/client';
import { match } from 'ts-pattern';

import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';

/**
 * Why an upload failed, worded for the thing being uploaded. Every upload
 * entry point reads its toast from here, so a template says "template".
 */
export const uploadErrorMessage = (err: unknown, type: EnvelopeType): MessageDescriptor =>
  match(AppError.parseError(err).code)
    .with('INVALID_DOCUMENT_FILE', () => msg`You cannot upload encrypted PDFs.`)
    .with(
      AppErrorCode.LIMIT_EXCEEDED,
      () => msg`You have reached your document limit for this month. Please upgrade your plan.`,
    )
    .with(
      'ENVELOPE_ITEM_LIMIT_EXCEEDED',
      () => msg`You have reached the limit of the number of files per envelope.`,
    )
    .otherwise(() =>
      type === EnvelopeType.TEMPLATE
        ? msg`An error occurred while uploading your template.`
        : msg`An error occurred while uploading your document.`,
    );
