import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { EnvelopeType } from '@prisma/client';
import { match } from 'ts-pattern';

import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@hanzo/esign-lib/constants/app';
import { AppError, AppErrorCode } from '@hanzo/esign-lib/errors/app-error';
import { ImportError } from '@hanzo/esign-lib/universal/import';

/**
 * Why an upload failed, worded for the thing being uploaded. Every upload
 * entry point reads its toast from here, so a template says "template".
 */
export const uploadErrorMessage = (err: unknown, type: EnvelopeType): MessageDescriptor =>
  match(AppError.parseError(err).code)
    .with('INVALID_DOCUMENT_FILE', () => msg`You cannot upload encrypted PDFs.`)
    .with(ImportError.url, () => msg`That address cannot be read. Use a public http(s) link.`)
    .with(ImportError.fetch, () => msg`We could not reach that address.`)
    .with(ImportError.pdf, () => msg`That address does not lead to a PDF.`)
    .with(
      ImportError.size,
      () => msg`That document is larger than ${APP_DOCUMENT_UPLOAD_SIZE_LIMIT}MB.`,
    )
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
