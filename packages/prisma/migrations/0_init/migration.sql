-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "password" TEXT,
    "source" TEXT,
    "signature" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSignedIn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roles" TEXT NOT NULL DEFAULT '["USER"]',
    "identityProvider" TEXT NOT NULL DEFAULT 'DOCUMENSO',
    "avatarImageId" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorBackupCodes" TEXT,
    CONSTRAINT "User_avatarImageId_fkey" FOREIGN KEY ("avatarImageId") REFERENCES "AvatarImage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "teamId" INTEGER NOT NULL,
    "bio" TEXT,
    CONSTRAINT "TeamProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSecurityAuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    CONSTRAINT "UserSecurityAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiry" DATETIME NOT NULL,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Passkey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    "credentialId" BLOB NOT NULL,
    "credentialPublicKey" BLOB NOT NULL,
    "counter" BIGINT NOT NULL,
    "credentialDeviceType" TEXT NOT NULL,
    "credentialBackedUp" BOOLEAN NOT NULL,
    "transports" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnonymousVerificationToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "secondaryId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "expires" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "webhookUrl" TEXT NOT NULL,
    "eventTriggers" TEXT NOT NULL DEFAULT '[]',
    "secret" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    CONSTRAINT "Webhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Webhook_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "requestBody" TEXT NOT NULL,
    "responseCode" INTEGER NOT NULL,
    "responseHeaders" TEXT,
    "responseBody" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "webhookId" TEXT NOT NULL,
    CONSTRAINT "WebhookCall_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiToken" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'SHA512',
    "expires" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "teamId" INTEGER NOT NULL,
    CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApiToken_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "planId" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "periodEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "customerId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    CONSTRAINT "Subscription_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubscriptionClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "teamCount" INTEGER NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "envelopeItemCount" INTEGER NOT NULL,
    "flags" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "OrganisationClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "originalSubscriptionClaimId" TEXT,
    "teamCount" INTEGER NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "envelopeItemCount" INTEGER NOT NULL,
    "flags" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "created_at" INTEGER,
    "ext_expires_in" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "password" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visibility" TEXT NOT NULL DEFAULT 'EVERYONE',
    "type" TEXT NOT NULL,
    CONSTRAINT "Folder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Folder_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Envelope" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secondaryId" TEXT NOT NULL,
    "externalId" TEXT,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "deletedAt" DATETIME,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL,
    "qrToken" TEXT,
    "internalVersion" INTEGER NOT NULL,
    "useLegacyFieldInsertion" BOOLEAN NOT NULL DEFAULT false,
    "authOptions" TEXT,
    "formValues" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'EVERYONE',
    "templateType" TEXT NOT NULL DEFAULT 'PRIVATE',
    "publicTitle" TEXT NOT NULL DEFAULT '',
    "publicDescription" TEXT NOT NULL DEFAULT '',
    "templateId" INTEGER,
    "userId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "folderId" TEXT,
    "documentMetaId" TEXT NOT NULL,
    CONSTRAINT "Envelope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Envelope_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Envelope_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Envelope_documentMetaId_fkey" FOREIGN KEY ("documentMetaId") REFERENCES "DocumentMeta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EnvelopeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "documentDataId" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    CONSTRAINT "EnvelopeItem_documentDataId_fkey" FOREIGN KEY ("documentDataId") REFERENCES "DocumentData" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EnvelopeItem_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "envelopeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "userId" INTEGER,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    CONSTRAINT "DocumentAuditLog_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "initialData" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "DocumentMeta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT,
    "message" TEXT,
    "timezone" TEXT DEFAULT 'Etc/UTC',
    "dateFormat" TEXT DEFAULT 'yyyy-MM-dd hh:mm a',
    "redirectUrl" TEXT,
    "signingOrder" TEXT NOT NULL DEFAULT 'PARALLEL',
    "allowDictateNextSigner" BOOLEAN NOT NULL DEFAULT false,
    "typedSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "uploadSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "drawSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'en',
    "distributionMethod" TEXT NOT NULL DEFAULT 'EMAIL',
    "emailSettings" TEXT,
    "emailReplyTo" TEXT,
    "emailId" TEXT,
    "envelopeExpirationPeriod" TEXT
);

-- CreateTable
CREATE TABLE "EnvelopeAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "envelopeId" TEXT NOT NULL,
    CONSTRAINT "EnvelopeAttachment_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recipient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "envelopeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "token" TEXT NOT NULL,
    "documentDeletedAt" DATETIME,
    "expired" DATETIME,
    "expiresAt" DATETIME,
    "expirationNotifiedAt" DATETIME,
    "signedAt" DATETIME,
    "authOptions" TEXT,
    "signingOrder" INTEGER,
    "rejectionReason" TEXT,
    "role" TEXT NOT NULL DEFAULT 'SIGNER',
    "readStatus" TEXT NOT NULL DEFAULT 'NOT_OPENED',
    "signingStatus" TEXT NOT NULL DEFAULT 'NOT_SIGNED',
    "sendStatus" TEXT NOT NULL DEFAULT 'NOT_SENT',
    CONSTRAINT "Recipient_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Field" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "secondaryId" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "envelopeItemId" TEXT NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "positionX" DECIMAL NOT NULL DEFAULT 0,
    "positionY" DECIMAL NOT NULL DEFAULT 0,
    "width" DECIMAL NOT NULL DEFAULT -1,
    "height" DECIMAL NOT NULL DEFAULT -1,
    "customText" TEXT NOT NULL,
    "inserted" BOOLEAN NOT NULL,
    "fieldMeta" TEXT,
    CONSTRAINT "Field_envelopeItemId_fkey" FOREIGN KEY ("envelopeItemId") REFERENCES "EnvelopeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Field_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Field_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientId" INTEGER NOT NULL,
    "fieldId" INTEGER NOT NULL,
    "signatureImageAsBase64" TEXT,
    "typedSignature" TEXT,
    CONSTRAINT "Signature_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Signature_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentShareLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentShareLink_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "avatarImageId" TEXT,
    "customerId" TEXT,
    "organisationClaimId" TEXT NOT NULL,
    "ownerUserId" INTEGER NOT NULL,
    "organisationGlobalSettingsId" TEXT NOT NULL,
    "organisationAuthenticationPortalId" TEXT NOT NULL,
    CONSTRAINT "Organisation_organisationClaimId_fkey" FOREIGN KEY ("organisationClaimId") REFERENCES "OrganisationClaim" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Organisation_avatarImageId_fkey" FOREIGN KEY ("avatarImageId") REFERENCES "AvatarImage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Organisation_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Organisation_organisationGlobalSettingsId_fkey" FOREIGN KEY ("organisationGlobalSettingsId") REFERENCES "OrganisationGlobalSettings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Organisation_organisationAuthenticationPortalId_fkey" FOREIGN KEY ("organisationAuthenticationPortalId") REFERENCES "OrganisationAuthenticationPortal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrganisationMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" INTEGER NOT NULL,
    "organisationId" TEXT NOT NULL,
    CONSTRAINT "OrganisationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganisationMember_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrganisationMemberInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "organisationId" TEXT NOT NULL,
    "organisationRole" TEXT NOT NULL,
    CONSTRAINT "OrganisationMemberInvite_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrganisationGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "organisationRole" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    CONSTRAINT "OrganisationGroup_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrganisationGroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "organisationMemberId" TEXT NOT NULL,
    CONSTRAINT "OrganisationGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OrganisationGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganisationGroupMember_organisationMemberId_fkey" FOREIGN KEY ("organisationMemberId") REFERENCES "OrganisationMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationGroupId" TEXT NOT NULL,
    "teamRole" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    CONSTRAINT "TeamGroup_organisationGroupId_fkey" FOREIGN KEY ("organisationGroupId") REFERENCES "OrganisationGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamGroup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrganisationGlobalSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentVisibility" TEXT NOT NULL DEFAULT 'EVERYONE',
    "documentLanguage" TEXT NOT NULL DEFAULT 'en',
    "includeSenderDetails" BOOLEAN NOT NULL DEFAULT true,
    "includeSigningCertificate" BOOLEAN NOT NULL DEFAULT true,
    "includeAuditLog" BOOLEAN NOT NULL DEFAULT false,
    "documentTimezone" TEXT,
    "documentDateFormat" TEXT NOT NULL DEFAULT 'yyyy-MM-dd hh:mm a',
    "delegateDocumentOwnership" BOOLEAN NOT NULL DEFAULT false,
    "typedSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "uploadSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "drawSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultRecipients" TEXT,
    "emailId" TEXT,
    "emailReplyTo" TEXT,
    "emailDocumentSettings" TEXT NOT NULL,
    "brandingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "brandingLogo" TEXT NOT NULL DEFAULT '',
    "brandingUrl" TEXT NOT NULL DEFAULT '',
    "brandingCompanyDetails" TEXT NOT NULL DEFAULT '',
    "envelopeExpirationPeriod" TEXT,
    "aiFeaturesEnabled" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "OrganisationGlobalSettings_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OrganisationEmail" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamGlobalSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentVisibility" TEXT,
    "documentLanguage" TEXT,
    "documentTimezone" TEXT,
    "documentDateFormat" TEXT,
    "delegateDocumentOwnership" BOOLEAN,
    "includeSenderDetails" BOOLEAN,
    "includeSigningCertificate" BOOLEAN,
    "includeAuditLog" BOOLEAN,
    "typedSignatureEnabled" BOOLEAN,
    "uploadSignatureEnabled" BOOLEAN,
    "drawSignatureEnabled" BOOLEAN,
    "defaultRecipients" TEXT,
    "emailId" TEXT,
    "emailReplyTo" TEXT,
    "emailDocumentSettings" TEXT,
    "brandingEnabled" BOOLEAN,
    "brandingLogo" TEXT,
    "brandingUrl" TEXT,
    "brandingCompanyDetails" TEXT,
    "envelopeExpirationPeriod" TEXT,
    "aiFeaturesEnabled" BOOLEAN,
    CONSTRAINT "TeamGlobalSettings_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OrganisationEmail" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Team" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avatarImageId" TEXT,
    "organisationId" TEXT NOT NULL,
    "teamGlobalSettingsId" TEXT NOT NULL,
    CONSTRAINT "Team_avatarImageId_fkey" FOREIGN KEY ("avatarImageId") REFERENCES "AvatarImage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Team_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Team_teamGlobalSettingsId_fkey" FOREIGN KEY ("teamGlobalSettingsId") REFERENCES "TeamGlobalSettings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamEmail" (
    "teamId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    CONSTRAINT "TeamEmail_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamEmailVerification" (
    "teamId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamEmailVerification_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TemplateDirectLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "envelopeId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabled" BOOLEAN NOT NULL,
    "directTemplateRecipientId" INTEGER NOT NULL,
    CONSTRAINT "TemplateDirectLink_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "data" TEXT NOT NULL,
    "lastModifiedByUserId" INTEGER,
    "lastModifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteSettings_lastModifiedByUserId_fkey" FOREIGN KEY ("lastModifiedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" TEXT,
    "retried" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "lastRetriedAt" DATETIME
);

-- CreateTable
CREATE TABLE "BackgroundJobTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" TEXT,
    "retried" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "jobId" TEXT NOT NULL,
    CONSTRAINT "BackgroundJobTask_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BackgroundJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AvatarImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bytes" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "EmailDomain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "selector" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "lastVerifiedAt" DATETIME,
    "organisationId" TEXT NOT NULL,
    CONSTRAINT "EmailDomain_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrganisationEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "email" TEXT NOT NULL,
    "emailName" TEXT NOT NULL,
    "emailDomainId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    CONSTRAINT "OrganisationEmail_emailDomainId_fkey" FOREIGN KEY ("emailDomainId") REFERENCES "EmailDomain" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganisationEmail_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrganisationAuthenticationPortal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT NOT NULL DEFAULT '',
    "clientSecret" TEXT NOT NULL DEFAULT '',
    "wellKnownUrl" TEXT NOT NULL DEFAULT '',
    "defaultOrganisationRole" TEXT NOT NULL DEFAULT 'MEMBER',
    "autoProvisionUsers" BOOLEAN NOT NULL DEFAULT true,
    "allowedDomains" TEXT NOT NULL DEFAULT '[]'
);

-- CreateTable
CREATE TABLE "Counter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "bucket" DATETIME NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("key", "action", "bucket")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TeamProfile_teamId_key" ON "TeamProfile"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "AnonymousVerificationToken_id_key" ON "AnonymousVerificationToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AnonymousVerificationToken_token_key" ON "AnonymousVerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_secondaryId_key" ON "VerificationToken"("secondaryId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_token_key" ON "ApiToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_planId_key" ON "Subscription"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organisationId_key" ON "Subscription"("organisationId");

-- CreateIndex
CREATE INDEX "Subscription_organisationId_idx" ON "Subscription"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_sessionToken_idx" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Folder_userId_idx" ON "Folder"("userId");

-- CreateIndex
CREATE INDEX "Folder_teamId_idx" ON "Folder"("teamId");

-- CreateIndex
CREATE INDEX "Folder_parentId_idx" ON "Folder"("parentId");

-- CreateIndex
CREATE INDEX "Folder_type_idx" ON "Folder"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Envelope_secondaryId_key" ON "Envelope"("secondaryId");

-- CreateIndex
CREATE UNIQUE INDEX "Envelope_documentMetaId_key" ON "Envelope"("documentMetaId");

-- CreateIndex
CREATE INDEX "Envelope_type_idx" ON "Envelope"("type");

-- CreateIndex
CREATE INDEX "Envelope_status_idx" ON "Envelope"("status");

-- CreateIndex
CREATE INDEX "Envelope_userId_idx" ON "Envelope"("userId");

-- CreateIndex
CREATE INDEX "Envelope_teamId_idx" ON "Envelope"("teamId");

-- CreateIndex
CREATE INDEX "Envelope_folderId_idx" ON "Envelope"("folderId");

-- CreateIndex
CREATE INDEX "Envelope_createdAt_idx" ON "Envelope"("createdAt");

-- CreateIndex
CREATE INDEX "EnvelopeItem_envelopeId_idx" ON "EnvelopeItem"("envelopeId");

-- CreateIndex
CREATE UNIQUE INDEX "EnvelopeItem_documentDataId_key" ON "EnvelopeItem"("documentDataId");

-- CreateIndex
CREATE INDEX "DocumentAuditLog_envelopeId_idx" ON "DocumentAuditLog"("envelopeId");

-- CreateIndex
CREATE INDEX "EnvelopeAttachment_envelopeId_idx" ON "EnvelopeAttachment"("envelopeId");

-- CreateIndex
CREATE INDEX "Recipient_token_idx" ON "Recipient"("token");

-- CreateIndex
CREATE INDEX "Recipient_email_idx" ON "Recipient"("email");

-- CreateIndex
CREATE INDEX "Recipient_envelopeId_idx" ON "Recipient"("envelopeId");

-- CreateIndex
CREATE INDEX "Recipient_signedAt_idx" ON "Recipient"("signedAt");

-- CreateIndex
CREATE INDEX "Recipient_expiresAt_idx" ON "Recipient"("expiresAt");

-- CreateIndex
CREATE INDEX "Recipient_email_documentDeletedAt_envelopeId_idx" ON "Recipient"("email", "documentDeletedAt", "envelopeId");

-- CreateIndex
CREATE INDEX "Recipient_email_envelopeId_idx" ON "Recipient"("email", "envelopeId");

-- CreateIndex
CREATE INDEX "Recipient_email_signingStatus_envelopeId_role_idx" ON "Recipient"("email", "signingStatus", "envelopeId", "role");

-- CreateIndex
CREATE INDEX "Recipient_name_idx" ON "Recipient"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Field_secondaryId_key" ON "Field"("secondaryId");

-- CreateIndex
CREATE INDEX "Field_envelopeId_idx" ON "Field"("envelopeId");

-- CreateIndex
CREATE INDEX "Field_envelopeItemId_idx" ON "Field"("envelopeItemId");

-- CreateIndex
CREATE INDEX "Field_recipientId_idx" ON "Field"("recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "Signature_fieldId_key" ON "Signature"("fieldId");

-- CreateIndex
CREATE INDEX "Signature_recipientId_idx" ON "Signature"("recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentShareLink_slug_key" ON "DocumentShareLink"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentShareLink_envelopeId_email_key" ON "DocumentShareLink"("envelopeId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_url_key" ON "Organisation"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_customerId_key" ON "Organisation"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_organisationClaimId_key" ON "Organisation"("organisationClaimId");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_organisationGlobalSettingsId_key" ON "Organisation"("organisationGlobalSettingsId");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_organisationAuthenticationPortalId_key" ON "Organisation"("organisationAuthenticationPortalId");

-- CreateIndex
CREATE INDEX "Organisation_name_idx" ON "Organisation"("name");

-- CreateIndex
CREATE INDEX "Organisation_ownerUserId_idx" ON "Organisation"("ownerUserId");

-- CreateIndex
CREATE INDEX "OrganisationMember_organisationId_idx" ON "OrganisationMember"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationMember_userId_organisationId_key" ON "OrganisationMember"("userId", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationMemberInvite_token_key" ON "OrganisationMemberInvite"("token");

-- CreateIndex
CREATE INDEX "OrganisationGroup_organisationId_idx" ON "OrganisationGroup"("organisationId");

-- CreateIndex
CREATE INDEX "OrganisationGroupMember_groupId_idx" ON "OrganisationGroupMember"("groupId");

-- CreateIndex
CREATE INDEX "OrganisationGroupMember_organisationMemberId_idx" ON "OrganisationGroupMember"("organisationMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationGroupMember_organisationMemberId_groupId_key" ON "OrganisationGroupMember"("organisationMemberId", "groupId");

-- CreateIndex
CREATE INDEX "TeamGroup_teamId_idx" ON "TeamGroup"("teamId");

-- CreateIndex
CREATE INDEX "TeamGroup_organisationGroupId_idx" ON "TeamGroup"("organisationGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamGroup_teamId_organisationGroupId_key" ON "TeamGroup"("teamId", "organisationGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_url_key" ON "Team"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Team_teamGlobalSettingsId_key" ON "Team"("teamGlobalSettingsId");

-- CreateIndex
CREATE INDEX "Team_name_idx" ON "Team"("name");

-- CreateIndex
CREATE INDEX "Team_organisationId_idx" ON "Team"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamEmail_teamId_key" ON "TeamEmail"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamEmail_email_key" ON "TeamEmail"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TeamEmailVerification_teamId_key" ON "TeamEmailVerification"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamEmailVerification_token_key" ON "TeamEmailVerification"("token");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateDirectLink_id_key" ON "TemplateDirectLink"("id");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateDirectLink_envelopeId_key" ON "TemplateDirectLink"("envelopeId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateDirectLink_token_key" ON "TemplateDirectLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDomain_selector_key" ON "EmailDomain"("selector");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDomain_domain_key" ON "EmailDomain"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationEmail_email_key" ON "OrganisationEmail"("email");

-- CreateIndex
CREATE INDEX "RateLimit_createdAt_idx" ON "RateLimit"("createdAt");


-- enum domain enforcement (CHECK-equivalent) for SQLite.
--
-- Prisma 6 maps every enum to a bare `TEXT` column on the `sqlite` provider
-- and emits NO CHECK constraint, so the 33 enum-typed columns below would
-- otherwise accept arbitrary text — the same domain Postgres enforced with a
-- native enum type is reconstructed here with BEFORE INSERT/UPDATE triggers.
-- SQLite cannot ALTER TABLE ADD CONSTRAINT CHECK, so triggers are the one
-- portable way to bolt a domain onto an existing table. Each trigger fails
-- closed: a non-NULL value outside the enum set aborts the write.
--
-- Generated from schema.prisma enums by scripts/gen-enum-check-triggers.mjs.
-- Re-run that script and replace this block if the enum set changes.

DROP TRIGGER IF EXISTS "enum_User_identityProvider_insert";
CREATE TRIGGER "enum_User_identityProvider_insert"
  BEFORE INSERT ON "User"
  FOR EACH ROW WHEN NEW."identityProvider" IS NOT NULL AND NEW."identityProvider" NOT IN ('DOCUMENSO', 'GOOGLE', 'OIDC')
  BEGIN SELECT RAISE(ABORT, 'invalid IdentityProvider for User.identityProvider'); END;

DROP TRIGGER IF EXISTS "enum_User_identityProvider_update";
CREATE TRIGGER "enum_User_identityProvider_update"
  BEFORE UPDATE ON "User"
  FOR EACH ROW WHEN NEW."identityProvider" IS NOT NULL AND NEW."identityProvider" NOT IN ('DOCUMENSO', 'GOOGLE', 'OIDC')
  BEGIN SELECT RAISE(ABORT, 'invalid IdentityProvider for User.identityProvider'); END;

DROP TRIGGER IF EXISTS "enum_UserSecurityAuditLog_type_insert";
CREATE TRIGGER "enum_UserSecurityAuditLog_type_insert"
  BEFORE INSERT ON "UserSecurityAuditLog"
  FOR EACH ROW WHEN NEW."type" IS NOT NULL AND NEW."type" NOT IN ('ACCOUNT_PROFILE_UPDATE', 'ACCOUNT_SSO_LINK', 'ACCOUNT_SSO_UNLINK', 'ORGANISATION_SSO_LINK', 'ORGANISATION_SSO_UNLINK', 'AUTH_2FA_DISABLE', 'AUTH_2FA_ENABLE', 'PASSKEY_CREATED', 'PASSKEY_DELETED', 'PASSKEY_UPDATED', 'PASSWORD_RESET', 'PASSWORD_UPDATE', 'SESSION_REVOKED', 'SIGN_OUT', 'SIGN_IN', 'SIGN_IN_FAIL', 'SIGN_IN_2FA_FAIL', 'SIGN_IN_PASSKEY_FAIL')
  BEGIN SELECT RAISE(ABORT, 'invalid UserSecurityAuditLogType for UserSecurityAuditLog.type'); END;

DROP TRIGGER IF EXISTS "enum_UserSecurityAuditLog_type_update";
CREATE TRIGGER "enum_UserSecurityAuditLog_type_update"
  BEFORE UPDATE ON "UserSecurityAuditLog"
  FOR EACH ROW WHEN NEW."type" IS NOT NULL AND NEW."type" NOT IN ('ACCOUNT_PROFILE_UPDATE', 'ACCOUNT_SSO_LINK', 'ACCOUNT_SSO_UNLINK', 'ORGANISATION_SSO_LINK', 'ORGANISATION_SSO_UNLINK', 'AUTH_2FA_DISABLE', 'AUTH_2FA_ENABLE', 'PASSKEY_CREATED', 'PASSKEY_DELETED', 'PASSKEY_UPDATED', 'PASSWORD_RESET', 'PASSWORD_UPDATE', 'SESSION_REVOKED', 'SIGN_OUT', 'SIGN_IN', 'SIGN_IN_FAIL', 'SIGN_IN_2FA_FAIL', 'SIGN_IN_PASSKEY_FAIL')
  BEGIN SELECT RAISE(ABORT, 'invalid UserSecurityAuditLogType for UserSecurityAuditLog.type'); END;

DROP TRIGGER IF EXISTS "enum_WebhookCall_status_insert";
CREATE TRIGGER "enum_WebhookCall_status_insert"
  BEFORE INSERT ON "WebhookCall"
  FOR EACH ROW WHEN NEW."status" IS NOT NULL AND NEW."status" NOT IN ('SUCCESS', 'FAILED')
  BEGIN SELECT RAISE(ABORT, 'invalid WebhookCallStatus for WebhookCall.status'); END;

DROP TRIGGER IF EXISTS "enum_WebhookCall_status_update";
CREATE TRIGGER "enum_WebhookCall_status_update"
  BEFORE UPDATE ON "WebhookCall"
  FOR EACH ROW WHEN NEW."status" IS NOT NULL AND NEW."status" NOT IN ('SUCCESS', 'FAILED')
  BEGIN SELECT RAISE(ABORT, 'invalid WebhookCallStatus for WebhookCall.status'); END;

DROP TRIGGER IF EXISTS "enum_WebhookCall_event_insert";
CREATE TRIGGER "enum_WebhookCall_event_insert"
  BEFORE INSERT ON "WebhookCall"
  FOR EACH ROW WHEN NEW."event" IS NOT NULL AND NEW."event" NOT IN ('DOCUMENT_CREATED', 'DOCUMENT_SENT', 'DOCUMENT_OPENED', 'DOCUMENT_SIGNED', 'DOCUMENT_COMPLETED', 'DOCUMENT_REJECTED', 'DOCUMENT_CANCELLED', 'RECIPIENT_EXPIRED')
  BEGIN SELECT RAISE(ABORT, 'invalid WebhookTriggerEvents for WebhookCall.event'); END;

DROP TRIGGER IF EXISTS "enum_WebhookCall_event_update";
CREATE TRIGGER "enum_WebhookCall_event_update"
  BEFORE UPDATE ON "WebhookCall"
  FOR EACH ROW WHEN NEW."event" IS NOT NULL AND NEW."event" NOT IN ('DOCUMENT_CREATED', 'DOCUMENT_SENT', 'DOCUMENT_OPENED', 'DOCUMENT_SIGNED', 'DOCUMENT_COMPLETED', 'DOCUMENT_REJECTED', 'DOCUMENT_CANCELLED', 'RECIPIENT_EXPIRED')
  BEGIN SELECT RAISE(ABORT, 'invalid WebhookTriggerEvents for WebhookCall.event'); END;

DROP TRIGGER IF EXISTS "enum_ApiToken_algorithm_insert";
CREATE TRIGGER "enum_ApiToken_algorithm_insert"
  BEFORE INSERT ON "ApiToken"
  FOR EACH ROW WHEN NEW."algorithm" IS NOT NULL AND NEW."algorithm" NOT IN ('SHA512')
  BEGIN SELECT RAISE(ABORT, 'invalid ApiTokenAlgorithm for ApiToken.algorithm'); END;

DROP TRIGGER IF EXISTS "enum_ApiToken_algorithm_update";
CREATE TRIGGER "enum_ApiToken_algorithm_update"
  BEFORE UPDATE ON "ApiToken"
  FOR EACH ROW WHEN NEW."algorithm" IS NOT NULL AND NEW."algorithm" NOT IN ('SHA512')
  BEGIN SELECT RAISE(ABORT, 'invalid ApiTokenAlgorithm for ApiToken.algorithm'); END;

DROP TRIGGER IF EXISTS "enum_Subscription_status_insert";
CREATE TRIGGER "enum_Subscription_status_insert"
  BEFORE INSERT ON "Subscription"
  FOR EACH ROW WHEN NEW."status" IS NOT NULL AND NEW."status" NOT IN ('ACTIVE', 'PAST_DUE', 'INACTIVE')
  BEGIN SELECT RAISE(ABORT, 'invalid SubscriptionStatus for Subscription.status'); END;

DROP TRIGGER IF EXISTS "enum_Subscription_status_update";
CREATE TRIGGER "enum_Subscription_status_update"
  BEFORE UPDATE ON "Subscription"
  FOR EACH ROW WHEN NEW."status" IS NOT NULL AND NEW."status" NOT IN ('ACTIVE', 'PAST_DUE', 'INACTIVE')
  BEGIN SELECT RAISE(ABORT, 'invalid SubscriptionStatus for Subscription.status'); END;

DROP TRIGGER IF EXISTS "enum_Folder_visibility_insert";
CREATE TRIGGER "enum_Folder_visibility_insert"
  BEFORE INSERT ON "Folder"
  FOR EACH ROW WHEN NEW."visibility" IS NOT NULL AND NEW."visibility" NOT IN ('EVERYONE', 'MANAGER_AND_ABOVE', 'ADMIN')
  BEGIN SELECT RAISE(ABORT, 'invalid DocumentVisibility for Folder.visibility'); END;

DROP TRIGGER IF EXISTS "enum_Folder_visibility_update";
CREATE TRIGGER "enum_Folder_visibility_update"
  BEFORE UPDATE ON "Folder"
  FOR EACH ROW WHEN NEW."visibility" IS NOT NULL AND NEW."visibility" NOT IN ('EVERYONE', 'MANAGER_AND_ABOVE', 'ADMIN')
  BEGIN SELECT RAISE(ABORT, 'invalid DocumentVisibility for Folder.visibility'); END;

DROP TRIGGER IF EXISTS "enum_Folder_type_insert";
CREATE TRIGGER "enum_Folder_type_insert"
  BEFORE INSERT ON "Folder"
  FOR EACH ROW WHEN NEW."type" IS NOT NULL AND NEW."type" NOT IN ('DOCUMENT', 'TEMPLATE')
  BEGIN SELECT RAISE(ABORT, 'invalid FolderType for Folder.type'); END;

DROP TRIGGER IF EXISTS "enum_Folder_type_update";
CREATE TRIGGER "enum_Folder_type_update"
  BEFORE UPDATE ON "Folder"
  FOR EACH ROW WHEN NEW."type" IS NOT NULL AND NEW."type" NOT IN ('DOCUMENT', 'TEMPLATE')
  BEGIN SELECT RAISE(ABORT, 'invalid FolderType for Folder.type'); END;

DROP TRIGGER IF EXISTS "enum_Envelope_type_insert";
CREATE TRIGGER "enum_Envelope_type_insert"
  BEFORE INSERT ON "Envelope"
  FOR EACH ROW WHEN NEW."type" IS NOT NULL AND NEW."type" NOT IN ('DOCUMENT', 'TEMPLATE')
  BEGIN SELECT RAISE(ABORT, 'invalid EnvelopeType for Envelope.type'); END;

DROP TRIGGER IF EXISTS "enum_Envelope_type_update";
CREATE TRIGGER "enum_Envelope_type_update"
  BEFORE UPDATE ON "Envelope"
  FOR EACH ROW WHEN NEW."type" IS NOT NULL AND NEW."type" NOT IN ('DOCUMENT', 'TEMPLATE')
  BEGIN SELECT RAISE(ABORT, 'invalid EnvelopeType for Envelope.type'); END;

DROP TRIGGER IF EXISTS "enum_Envelope_status_insert";
CREATE TRIGGER "enum_Envelope_status_insert"
  BEFORE INSERT ON "Envelope"
  FOR EACH ROW WHEN NEW."status" IS NOT NULL AND NEW."status" NOT IN ('DRAFT', 'PENDING', 'COMPLETED', 'REJECTED')
  BEGIN SELECT RAISE(ABORT, 'invalid DocumentStatus for Envelope.status'); END;

DROP TRIGGER IF EXISTS "enum_Envelope_status_update";
CREATE TRIGGER "enum_Envelope_status_update"
  BEFORE UPDATE ON "Envelope"
  FOR EACH ROW WHEN NEW."status" IS NOT NULL AND NEW."status" NOT IN ('DRAFT', 'PENDING', 'COMPLETED', 'REJECTED')
  BEGIN SELECT RAISE(ABORT, 'invalid DocumentStatus for Envelope.status'); END;

DROP TRIGGER IF EXISTS "enum_Envelope_source_insert";
CREATE TRIGGER "enum_Envelope_source_insert"
  BEFORE INSERT ON "Envelope"
  FOR EACH ROW WHEN NEW."source" IS NOT NULL AND NEW."source" NOT IN ('DOCUMENT', 'TEMPLATE', 'TEMPLATE_DIRECT_LINK')
  BEGIN SELECT RAISE(ABORT, 'invalid DocumentSource for Envelope.source'); END;

DROP TRIGGER IF EXISTS "enum_Envelope_source_update";
CREATE TRIGGER "enum_Envelope_source_update"
  BEFORE UPDATE ON "Envelope"
  FOR EACH ROW WHEN NEW."source" IS NOT NULL AND NEW."source" NOT IN ('DOCUMENT', 'TEMPLATE', 'TEMPLATE_DIRECT_LINK')
  BEGIN SELECT RAISE(ABORT, 'invalid DocumentSource for Envelope.source'); END;

DROP TRIGGER IF EXISTS "enum_Envelope_visibility_insert";
CREATE TRIGGER "enum_Envelope_visibility_insert"
  BEFORE INSERT ON "Envelope"
  FOR EACH ROW WHEN NEW."visibility" IS NOT NULL AND NEW."visibility" NOT IN ('EVERYONE', 'MANAGER_AND_ABOVE', 'ADMIN')
  BEGIN SELECT RAISE(ABORT, 'invalid DocumentVisibility for Envelope.visibility'); END;

DROP TRIGGER IF EXISTS "enum_Envelope_visibility_update";
CREATE TRIGGER "enum_Envelope_visibility_update"
  BEFORE UPDATE ON "Envelope"
  FOR EACH ROW WHEN NEW."visibility" IS NOT NULL AND NEW."visibility" NOT IN ('EVERYONE', 'MANAGER_AND_ABOVE', 'ADMIN')
  BEGIN SELECT RAISE(ABORT, 'invalid DocumentVisibility for Envelope.visibility'); END;

DROP TRIGGER IF EXISTS "enum_Envelope_templateType_insert";
CREATE TRIGGER "enum_Envelope_templateType_insert"
  BEFORE INSERT ON "Envelope"
  FOR EACH ROW WHEN NEW."templateType" IS NOT NULL AND NEW."templateType" NOT IN ('PUBLIC', 'PRIVATE')
  BEGIN SELECT RAISE(ABORT, 'invalid TemplateType for Envelope.templateType'); END;

DROP TRIGGER IF EXISTS "enum_Envelope_templateType_update";
CREATE TRIGGER "enum_Envelope_templateType_update"
  BEFORE UPDATE ON "Envelope"
  FOR EACH ROW WHEN NEW."templateType" IS NOT NULL AND NEW."templateType" NOT IN ('PUBLIC', 'PRIVATE')
  BEGIN SELECT RAISE(ABORT, 'invalid TemplateType for Envelope.templateType'); END;

DROP TRIGGER IF EXISTS "enum_DocumentData_type_insert";
CREATE TRIGGER "enum_DocumentData_type_insert"
  BEFORE INSERT ON "DocumentData"
  FOR EACH ROW WHEN NEW."type" IS NOT NULL AND NEW."type" NOT IN ('S3_PATH', 'BYTES', 'BYTES_64')
  BEGIN SELECT RAISE(ABORT, 'invalid DocumentDataType for DocumentData.type'); END;

DROP TRIGGER IF EXISTS "enum_DocumentData_type_update";
CREATE TRIGGER "enum_DocumentData_type_update"
  BEFORE UPDATE ON "DocumentData"
  FOR EACH ROW WHEN NEW."type" IS NOT NULL AND NEW."type" NOT IN ('S3_PATH', 'BYTES', 'BYTES_64')
  BEGIN SELECT RAISE(ABORT, 'invalid DocumentDataType for DocumentData.type'); END;

DROP TRIGGER IF EXISTS "enum_DocumentMeta_signingOrder_insert";
CREATE TRIGGER "enum_DocumentMeta_signingOrder_insert"
  BEFORE INSERT ON "DocumentMeta"
  FOR EACH ROW WHEN NEW."signingOrder" IS NOT NULL AND NEW."signingOrder" NOT IN ('PARALLEL', 'SEQUENTIAL')
  BEGIN SELECT RAISE(ABORT, 'invalid DocumentSigningOrder for DocumentMeta.signingOrder'); END;

DROP TRIGGER IF EXISTS "enum_DocumentMeta_signingOrder_update";
CREATE TRIGGER "enum_DocumentMeta_signingOrder_update"
  BEFORE UPDATE ON "DocumentMeta"
  FOR EACH ROW WHEN NEW."signingOrder" IS NOT NULL AND NEW."signingOrder" NOT IN ('PARALLEL', 'SEQUENTIAL')
  BEGIN SELECT RAISE(ABORT, 'invalid DocumentSigningOrder for DocumentMeta.signingOrder'); END;

DROP TRIGGER IF EXISTS "enum_DocumentMeta_distributionMethod_insert";
CREATE TRIGGER "enum_DocumentMeta_distributionMethod_insert"
  BEFORE INSERT ON "DocumentMeta"
  FOR EACH ROW WHEN NEW."distributionMethod" IS NOT NULL AND NEW."distributionMethod" NOT IN ('EMAIL', 'NONE')
  BEGIN SELECT RAISE(ABORT, 'invalid DocumentDistributionMethod for DocumentMeta.distributionMethod'); END;

DROP TRIGGER IF EXISTS "enum_DocumentMeta_distributionMethod_update";
CREATE TRIGGER "enum_DocumentMeta_distributionMethod_update"
  BEFORE UPDATE ON "DocumentMeta"
  FOR EACH ROW WHEN NEW."distributionMethod" IS NOT NULL AND NEW."distributionMethod" NOT IN ('EMAIL', 'NONE')
  BEGIN SELECT RAISE(ABORT, 'invalid DocumentDistributionMethod for DocumentMeta.distributionMethod'); END;

DROP TRIGGER IF EXISTS "enum_Recipient_role_insert";
CREATE TRIGGER "enum_Recipient_role_insert"
  BEFORE INSERT ON "Recipient"
  FOR EACH ROW WHEN NEW."role" IS NOT NULL AND NEW."role" NOT IN ('CC', 'SIGNER', 'VIEWER', 'APPROVER', 'ASSISTANT')
  BEGIN SELECT RAISE(ABORT, 'invalid RecipientRole for Recipient.role'); END;

DROP TRIGGER IF EXISTS "enum_Recipient_role_update";
CREATE TRIGGER "enum_Recipient_role_update"
  BEFORE UPDATE ON "Recipient"
  FOR EACH ROW WHEN NEW."role" IS NOT NULL AND NEW."role" NOT IN ('CC', 'SIGNER', 'VIEWER', 'APPROVER', 'ASSISTANT')
  BEGIN SELECT RAISE(ABORT, 'invalid RecipientRole for Recipient.role'); END;

DROP TRIGGER IF EXISTS "enum_Recipient_readStatus_insert";
CREATE TRIGGER "enum_Recipient_readStatus_insert"
  BEFORE INSERT ON "Recipient"
  FOR EACH ROW WHEN NEW."readStatus" IS NOT NULL AND NEW."readStatus" NOT IN ('NOT_OPENED', 'OPENED')
  BEGIN SELECT RAISE(ABORT, 'invalid ReadStatus for Recipient.readStatus'); END;

DROP TRIGGER IF EXISTS "enum_Recipient_readStatus_update";
CREATE TRIGGER "enum_Recipient_readStatus_update"
  BEFORE UPDATE ON "Recipient"
  FOR EACH ROW WHEN NEW."readStatus" IS NOT NULL AND NEW."readStatus" NOT IN ('NOT_OPENED', 'OPENED')
  BEGIN SELECT RAISE(ABORT, 'invalid ReadStatus for Recipient.readStatus'); END;

DROP TRIGGER IF EXISTS "enum_Recipient_signingStatus_insert";
CREATE TRIGGER "enum_Recipient_signingStatus_insert"
  BEFORE INSERT ON "Recipient"
  FOR EACH ROW WHEN NEW."signingStatus" IS NOT NULL AND NEW."signingStatus" NOT IN ('NOT_SIGNED', 'SIGNED', 'REJECTED')
  BEGIN SELECT RAISE(ABORT, 'invalid SigningStatus for Recipient.signingStatus'); END;

DROP TRIGGER IF EXISTS "enum_Recipient_signingStatus_update";
CREATE TRIGGER "enum_Recipient_signingStatus_update"
  BEFORE UPDATE ON "Recipient"
  FOR EACH ROW WHEN NEW."signingStatus" IS NOT NULL AND NEW."signingStatus" NOT IN ('NOT_SIGNED', 'SIGNED', 'REJECTED')
  BEGIN SELECT RAISE(ABORT, 'invalid SigningStatus for Recipient.signingStatus'); END;

DROP TRIGGER IF EXISTS "enum_Recipient_sendStatus_insert";
CREATE TRIGGER "enum_Recipient_sendStatus_insert"
  BEFORE INSERT ON "Recipient"
  FOR EACH ROW WHEN NEW."sendStatus" IS NOT NULL AND NEW."sendStatus" NOT IN ('NOT_SENT', 'SENT')
  BEGIN SELECT RAISE(ABORT, 'invalid SendStatus for Recipient.sendStatus'); END;

DROP TRIGGER IF EXISTS "enum_Recipient_sendStatus_update";
CREATE TRIGGER "enum_Recipient_sendStatus_update"
  BEFORE UPDATE ON "Recipient"
  FOR EACH ROW WHEN NEW."sendStatus" IS NOT NULL AND NEW."sendStatus" NOT IN ('NOT_SENT', 'SENT')
  BEGIN SELECT RAISE(ABORT, 'invalid SendStatus for Recipient.sendStatus'); END;

DROP TRIGGER IF EXISTS "enum_Field_type_insert";
CREATE TRIGGER "enum_Field_type_insert"
  BEFORE INSERT ON "Field"
  FOR EACH ROW WHEN NEW."type" IS NOT NULL AND NEW."type" NOT IN ('SIGNATURE', 'FREE_SIGNATURE', 'INITIALS', 'NAME', 'EMAIL', 'DATE', 'TEXT', 'NUMBER', 'RADIO', 'CHECKBOX', 'DROPDOWN')
  BEGIN SELECT RAISE(ABORT, 'invalid FieldType for Field.type'); END;

DROP TRIGGER IF EXISTS "enum_Field_type_update";
CREATE TRIGGER "enum_Field_type_update"
  BEFORE UPDATE ON "Field"
  FOR EACH ROW WHEN NEW."type" IS NOT NULL AND NEW."type" NOT IN ('SIGNATURE', 'FREE_SIGNATURE', 'INITIALS', 'NAME', 'EMAIL', 'DATE', 'TEXT', 'NUMBER', 'RADIO', 'CHECKBOX', 'DROPDOWN')
  BEGIN SELECT RAISE(ABORT, 'invalid FieldType for Field.type'); END;

DROP TRIGGER IF EXISTS "enum_Organisation_type_insert";
CREATE TRIGGER "enum_Organisation_type_insert"
  BEFORE INSERT ON "Organisation"
  FOR EACH ROW WHEN NEW."type" IS NOT NULL AND NEW."type" NOT IN ('PERSONAL', 'ORGANISATION')
  BEGIN SELECT RAISE(ABORT, 'invalid OrganisationType for Organisation.type'); END;

DROP TRIGGER IF EXISTS "enum_Organisation_type_update";
CREATE TRIGGER "enum_Organisation_type_update"
  BEFORE UPDATE ON "Organisation"
  FOR EACH ROW WHEN NEW."type" IS NOT NULL AND NEW."type" NOT IN ('PERSONAL', 'ORGANISATION')
  BEGIN SELECT RAISE(ABORT, 'invalid OrganisationType for Organisation.type'); END;

DROP TRIGGER IF EXISTS "enum_OrganisationMemberInvite_status_insert";
CREATE TRIGGER "enum_OrganisationMemberInvite_status_insert"
  BEFORE INSERT ON "OrganisationMemberInvite"
  FOR EACH ROW WHEN NEW."status" IS NOT NULL AND NEW."status" NOT IN ('ACCEPTED', 'PENDING', 'DECLINED')
  BEGIN SELECT RAISE(ABORT, 'invalid OrganisationMemberInviteStatus for OrganisationMemberInvite.status'); END;

DROP TRIGGER IF EXISTS "enum_OrganisationMemberInvite_status_update";
CREATE TRIGGER "enum_OrganisationMemberInvite_status_update"
  BEFORE UPDATE ON "OrganisationMemberInvite"
  FOR EACH ROW WHEN NEW."status" IS NOT NULL AND NEW."status" NOT IN ('ACCEPTED', 'PENDING', 'DECLINED')
  BEGIN SELECT RAISE(ABORT, 'invalid OrganisationMemberInviteStatus for OrganisationMemberInvite.status'); END;

DROP TRIGGER IF EXISTS "enum_OrganisationMemberInvite_organisationRole_insert";
CREATE TRIGGER "enum_OrganisationMemberInvite_organisationRole_insert"
  BEFORE INSERT ON "OrganisationMemberInvite"
  FOR EACH ROW WHEN NEW."organisationRole" IS NOT NULL AND NEW."organisationRole" NOT IN ('ADMIN', 'MANAGER', 'MEMBER')
  BEGIN SELECT RAISE(ABORT, 'invalid OrganisationMemberRole for OrganisationMemberInvite.organisationRole'); END;

DROP TRIGGER IF EXISTS "enum_OrganisationMemberInvite_organisationRole_update";
CREATE TRIGGER "enum_OrganisationMemberInvite_organisationRole_update"
  BEFORE UPDATE ON "OrganisationMemberInvite"
  FOR EACH ROW WHEN NEW."organisationRole" IS NOT NULL AND NEW."organisationRole" NOT IN ('ADMIN', 'MANAGER', 'MEMBER')
  BEGIN SELECT RAISE(ABORT, 'invalid OrganisationMemberRole for OrganisationMemberInvite.organisationRole'); END;

DROP TRIGGER IF EXISTS "enum_OrganisationGroup_type_insert";
CREATE TRIGGER "enum_OrganisationGroup_type_insert"
  BEFORE INSERT ON "OrganisationGroup"
  FOR EACH ROW WHEN NEW."type" IS NOT NULL AND NEW."type" NOT IN ('INTERNAL_ORGANISATION', 'INTERNAL_TEAM', 'CUSTOM')
  BEGIN SELECT RAISE(ABORT, 'invalid OrganisationGroupType for OrganisationGroup.type'); END;

DROP TRIGGER IF EXISTS "enum_OrganisationGroup_type_update";
CREATE TRIGGER "enum_OrganisationGroup_type_update"
  BEFORE UPDATE ON "OrganisationGroup"
  FOR EACH ROW WHEN NEW."type" IS NOT NULL AND NEW."type" NOT IN ('INTERNAL_ORGANISATION', 'INTERNAL_TEAM', 'CUSTOM')
  BEGIN SELECT RAISE(ABORT, 'invalid OrganisationGroupType for OrganisationGroup.type'); END;

DROP TRIGGER IF EXISTS "enum_OrganisationGroup_organisationRole_insert";
CREATE TRIGGER "enum_OrganisationGroup_organisationRole_insert"
  BEFORE INSERT ON "OrganisationGroup"
  FOR EACH ROW WHEN NEW."organisationRole" IS NOT NULL AND NEW."organisationRole" NOT IN ('ADMIN', 'MANAGER', 'MEMBER')
  BEGIN SELECT RAISE(ABORT, 'invalid OrganisationMemberRole for OrganisationGroup.organisationRole'); END;

DROP TRIGGER IF EXISTS "enum_OrganisationGroup_organisationRole_update";
CREATE TRIGGER "enum_OrganisationGroup_organisationRole_update"
  BEFORE UPDATE ON "OrganisationGroup"
  FOR EACH ROW WHEN NEW."organisationRole" IS NOT NULL AND NEW."organisationRole" NOT IN ('ADMIN', 'MANAGER', 'MEMBER')
  BEGIN SELECT RAISE(ABORT, 'invalid OrganisationMemberRole for OrganisationGroup.organisationRole'); END;

DROP TRIGGER IF EXISTS "enum_TeamGroup_teamRole_insert";
CREATE TRIGGER "enum_TeamGroup_teamRole_insert"
  BEFORE INSERT ON "TeamGroup"
  FOR EACH ROW WHEN NEW."teamRole" IS NOT NULL AND NEW."teamRole" NOT IN ('ADMIN', 'MANAGER', 'MEMBER')
  BEGIN SELECT RAISE(ABORT, 'invalid TeamMemberRole for TeamGroup.teamRole'); END;

DROP TRIGGER IF EXISTS "enum_TeamGroup_teamRole_update";
CREATE TRIGGER "enum_TeamGroup_teamRole_update"
  BEFORE UPDATE ON "TeamGroup"
  FOR EACH ROW WHEN NEW."teamRole" IS NOT NULL AND NEW."teamRole" NOT IN ('ADMIN', 'MANAGER', 'MEMBER')
  BEGIN SELECT RAISE(ABORT, 'invalid TeamMemberRole for TeamGroup.teamRole'); END;

DROP TRIGGER IF EXISTS "enum_OrganisationGlobalSettings_documentVisibility_insert";
CREATE TRIGGER "enum_OrganisationGlobalSettings_documentVisibility_insert"
  BEFORE INSERT ON "OrganisationGlobalSettings"
  FOR EACH ROW WHEN NEW."documentVisibility" IS NOT NULL AND NEW."documentVisibility" NOT IN ('EVERYONE', 'MANAGER_AND_ABOVE', 'ADMIN')
  BEGIN SELECT RAISE(ABORT, 'invalid DocumentVisibility for OrganisationGlobalSettings.documentVisibility'); END;

DROP TRIGGER IF EXISTS "enum_OrganisationGlobalSettings_documentVisibility_update";
CREATE TRIGGER "enum_OrganisationGlobalSettings_documentVisibility_update"
  BEFORE UPDATE ON "OrganisationGlobalSettings"
  FOR EACH ROW WHEN NEW."documentVisibility" IS NOT NULL AND NEW."documentVisibility" NOT IN ('EVERYONE', 'MANAGER_AND_ABOVE', 'ADMIN')
  BEGIN SELECT RAISE(ABORT, 'invalid DocumentVisibility for OrganisationGlobalSettings.documentVisibility'); END;

DROP TRIGGER IF EXISTS "enum_TeamGlobalSettings_documentVisibility_insert";
CREATE TRIGGER "enum_TeamGlobalSettings_documentVisibility_insert"
  BEFORE INSERT ON "TeamGlobalSettings"
  FOR EACH ROW WHEN NEW."documentVisibility" IS NOT NULL AND NEW."documentVisibility" NOT IN ('EVERYONE', 'MANAGER_AND_ABOVE', 'ADMIN')
  BEGIN SELECT RAISE(ABORT, 'invalid DocumentVisibility for TeamGlobalSettings.documentVisibility'); END;

DROP TRIGGER IF EXISTS "enum_TeamGlobalSettings_documentVisibility_update";
CREATE TRIGGER "enum_TeamGlobalSettings_documentVisibility_update"
  BEFORE UPDATE ON "TeamGlobalSettings"
  FOR EACH ROW WHEN NEW."documentVisibility" IS NOT NULL AND NEW."documentVisibility" NOT IN ('EVERYONE', 'MANAGER_AND_ABOVE', 'ADMIN')
  BEGIN SELECT RAISE(ABORT, 'invalid DocumentVisibility for TeamGlobalSettings.documentVisibility'); END;

DROP TRIGGER IF EXISTS "enum_BackgroundJob_status_insert";
CREATE TRIGGER "enum_BackgroundJob_status_insert"
  BEFORE INSERT ON "BackgroundJob"
  FOR EACH ROW WHEN NEW."status" IS NOT NULL AND NEW."status" NOT IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')
  BEGIN SELECT RAISE(ABORT, 'invalid BackgroundJobStatus for BackgroundJob.status'); END;

DROP TRIGGER IF EXISTS "enum_BackgroundJob_status_update";
CREATE TRIGGER "enum_BackgroundJob_status_update"
  BEFORE UPDATE ON "BackgroundJob"
  FOR EACH ROW WHEN NEW."status" IS NOT NULL AND NEW."status" NOT IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')
  BEGIN SELECT RAISE(ABORT, 'invalid BackgroundJobStatus for BackgroundJob.status'); END;

DROP TRIGGER IF EXISTS "enum_BackgroundJobTask_status_insert";
CREATE TRIGGER "enum_BackgroundJobTask_status_insert"
  BEFORE INSERT ON "BackgroundJobTask"
  FOR EACH ROW WHEN NEW."status" IS NOT NULL AND NEW."status" NOT IN ('PENDING', 'COMPLETED', 'FAILED')
  BEGIN SELECT RAISE(ABORT, 'invalid BackgroundJobTaskStatus for BackgroundJobTask.status'); END;

DROP TRIGGER IF EXISTS "enum_BackgroundJobTask_status_update";
CREATE TRIGGER "enum_BackgroundJobTask_status_update"
  BEFORE UPDATE ON "BackgroundJobTask"
  FOR EACH ROW WHEN NEW."status" IS NOT NULL AND NEW."status" NOT IN ('PENDING', 'COMPLETED', 'FAILED')
  BEGIN SELECT RAISE(ABORT, 'invalid BackgroundJobTaskStatus for BackgroundJobTask.status'); END;

DROP TRIGGER IF EXISTS "enum_EmailDomain_status_insert";
CREATE TRIGGER "enum_EmailDomain_status_insert"
  BEFORE INSERT ON "EmailDomain"
  FOR EACH ROW WHEN NEW."status" IS NOT NULL AND NEW."status" NOT IN ('PENDING', 'ACTIVE')
  BEGIN SELECT RAISE(ABORT, 'invalid EmailDomainStatus for EmailDomain.status'); END;

DROP TRIGGER IF EXISTS "enum_EmailDomain_status_update";
CREATE TRIGGER "enum_EmailDomain_status_update"
  BEFORE UPDATE ON "EmailDomain"
  FOR EACH ROW WHEN NEW."status" IS NOT NULL AND NEW."status" NOT IN ('PENDING', 'ACTIVE')
  BEGIN SELECT RAISE(ABORT, 'invalid EmailDomainStatus for EmailDomain.status'); END;

DROP TRIGGER IF EXISTS "enum_OrganisationAuthenticationPortal_defaultOrganisationRole_insert";
CREATE TRIGGER "enum_OrganisationAuthenticationPortal_defaultOrganisationRole_insert"
  BEFORE INSERT ON "OrganisationAuthenticationPortal"
  FOR EACH ROW WHEN NEW."defaultOrganisationRole" IS NOT NULL AND NEW."defaultOrganisationRole" NOT IN ('ADMIN', 'MANAGER', 'MEMBER')
  BEGIN SELECT RAISE(ABORT, 'invalid OrganisationMemberRole for OrganisationAuthenticationPortal.defaultOrganisationRole'); END;

DROP TRIGGER IF EXISTS "enum_OrganisationAuthenticationPortal_defaultOrganisationRole_update";
CREATE TRIGGER "enum_OrganisationAuthenticationPortal_defaultOrganisationRole_update"
  BEFORE UPDATE ON "OrganisationAuthenticationPortal"
  FOR EACH ROW WHEN NEW."defaultOrganisationRole" IS NOT NULL AND NEW."defaultOrganisationRole" NOT IN ('ADMIN', 'MANAGER', 'MEMBER')
  BEGIN SELECT RAISE(ABORT, 'invalid OrganisationMemberRole for OrganisationAuthenticationPortal.defaultOrganisationRole'); END;

-- User.roles is a JSON-encoded Role[] (SQLite has no array type). Enforce that
-- every element is a known Role: json_each expands the array, and the guard
-- aborts if any element is outside the Role domain. Auth-relevant: a fabricated
-- role can never be persisted. (Role values are mirrored from schema.prisma's enum Role.)
DROP TRIGGER IF EXISTS "enum_User_roles_insert";
CREATE TRIGGER "enum_User_roles_insert"
  BEFORE INSERT ON "User"
  FOR EACH ROW
  WHEN NEW."roles" IS NOT NULL AND EXISTS (
    SELECT 1 FROM json_each(NEW."roles") WHERE value NOT IN ('ADMIN', 'USER')
  )
  BEGIN SELECT RAISE(ABORT, 'invalid Role in User.roles'); END;

DROP TRIGGER IF EXISTS "enum_User_roles_update";
CREATE TRIGGER "enum_User_roles_update"
  BEFORE UPDATE ON "User"
  FOR EACH ROW
  WHEN NEW."roles" IS NOT NULL AND EXISTS (
    SELECT 1 FROM json_each(NEW."roles") WHERE value NOT IN ('ADMIN', 'USER')
  )
  BEGIN SELECT RAISE(ABORT, 'invalid Role in User.roles'); END;
