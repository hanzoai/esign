import { z } from 'zod';

import { ZEnvelopeExpirationPeriod } from '@hanzo/sign-lib/constants/envelope-expiration';
import { SUPPORTED_LANGUAGE_CODES } from '@hanzo/sign-lib/constants/i18n';
import { ZDefaultRecipientsSchema } from '@hanzo/sign-lib/types/default-recipients';
import { ZDocumentEmailSettingsSchema } from '@hanzo/sign-lib/types/document-email';
import {
  ZDocumentMetaDateFormatSchema,
  ZDocumentMetaTimezoneSchema,
} from '@hanzo/sign-lib/types/document-meta';
import { DocumentVisibility } from '@hanzo/sign-lib/types/document-visibility';

export const ZUpdateOrganisationSettingsRequestSchema = z.object({
  organisationId: z.string(),
  data: z.object({
    // Document related settings.
    documentVisibility: z.nativeEnum(DocumentVisibility).optional(),
    documentLanguage: z.enum(SUPPORTED_LANGUAGE_CODES).optional(),
    documentTimezone: ZDocumentMetaTimezoneSchema.nullish(), // Null means local timezone.
    documentDateFormat: ZDocumentMetaDateFormatSchema.optional(),
    includeSenderDetails: z.boolean().optional(),
    includeSigningCertificate: z.boolean().optional(),
    includeAuditLog: z.boolean().optional(),
    typedSignatureEnabled: z.boolean().optional(),
    uploadSignatureEnabled: z.boolean().optional(),
    drawSignatureEnabled: z.boolean().optional(),
    defaultRecipients: ZDefaultRecipientsSchema.nullish(),
    delegateDocumentOwnership: z.boolean().nullish(),
    envelopeExpirationPeriod: ZEnvelopeExpirationPeriod.optional(),

    // Branding related settings.
    brandingEnabled: z.boolean().optional(),
    brandingLogo: z.string().optional(),
    brandingUrl: z.string().optional(),
    brandingCompanyDetails: z.string().optional(),

    // Email related settings.
    emailId: z.string().nullish(),
    emailReplyTo: z.string().email().nullish(),
    // emailReplyToName: z.string().optional(),
    emailDocumentSettings: ZDocumentEmailSettingsSchema.optional(),

    // AI features settings.
    aiFeaturesEnabled: z.boolean().optional(),
  }),
});

export const ZUpdateOrganisationSettingsResponseSchema = z.void();
