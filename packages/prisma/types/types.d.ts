/* eslint-disable @typescript-eslint/no-namespace */
import type { TDefaultRecipient } from '@hanzo/sign-lib/types/default-recipients';
import type {
  TDocumentAuthOptions,
  TRecipientAuthOptions,
} from '@hanzo/sign-lib/types/document-auth';
import type { TDocumentEmailSettings } from '@hanzo/sign-lib/types/document-email';
import type { TDocumentFormValues } from '@hanzo/sign-lib/types/document-form-values';
import type { TEnvelopeAttachmentType } from '@hanzo/sign-lib/types/envelope-attachment';
import type { TFieldMetaNotOptionalSchema } from '@hanzo/sign-lib/types/field-meta';
import type { TClaimFlags } from '@hanzo/sign-lib/types/subscription';

/**
 * Global types for Prisma.Json instances.
 */
declare global {
  namespace PrismaJson {
    type ClaimFlags = TClaimFlags;

    type DocumentFormValues = TDocumentFormValues;
    type DocumentAuthOptions = TDocumentAuthOptions;
    type DocumentEmailSettings = TDocumentEmailSettings;
    type DocumentEmailSettingsNullable = TDocumentEmailSettings | null;

    type RecipientAuthOptions = TRecipientAuthOptions;

    type FieldMeta = TFieldMetaNotOptionalSchema;

    type EnvelopeAttachmentType = TEnvelopeAttachmentType;

    type DefaultRecipient = TDefaultRecipient;
  }
}

export {};
