/* eslint-disable @typescript-eslint/no-namespace */
import type { Role, WebhookTriggerEvents } from '@prisma/client';

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

    // List columns: SQLite has no array type, so these are stored as JSON
    // `TEXT` and retyped to their element arrays in the client. The runtime
    // JSON encode/decode lives in `../json-array.ts`.
    type RoleList = Role[];
    type WebhookTriggerEventList = WebhookTriggerEvents[];
    type StringList = string[];
  }
}

export {};
