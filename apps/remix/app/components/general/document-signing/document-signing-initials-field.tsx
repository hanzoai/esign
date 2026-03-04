import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useRevalidator } from 'react-router';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@hanzo/sign-lib/constants/trpc';
import { AppError, AppErrorCode } from '@hanzo/sign-lib/errors/app-error';
import type { TRecipientActionAuth } from '@hanzo/sign-lib/types/document-auth';
import { ZInitialsFieldMeta } from '@hanzo/sign-lib/types/field-meta';
import { extractInitials } from '@hanzo/sign-lib/utils/recipient-formatter';
import type { FieldWithSignature } from '@hanzo/sign-prisma/types/field-with-signature';
import { trpc } from '@hanzo/sign-trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@hanzo/sign-trpc/server/field-router/schema';
import { useToast } from '@hanzo/sign-ui/primitives/use-toast';

import { DocumentSigningFieldContainer } from './document-signing-field-container';
import {
  DocumentSigningFieldsInserted,
  DocumentSigningFieldsLoader,
  DocumentSigningFieldsUninserted,
} from './document-signing-fields';
import { useRequiredDocumentSigningContext } from './document-signing-provider';
import { useDocumentSigningRecipientContext } from './document-signing-recipient-provider';

export type DocumentSigningInitialsFieldProps = {
  field: FieldWithSignature;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const DocumentSigningInitialsField = ({
  field,
  onSignField,
  onUnsignField,
}: DocumentSigningInitialsFieldProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();
  const { revalidate } = useRevalidator();

  const { fullName } = useRequiredDocumentSigningContext();
  const { recipient, isAssistantMode } = useDocumentSigningRecipientContext();

  const initials = extractInitials(fullName);

  const { mutateAsync: signFieldWithToken, isPending: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isPending: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading;

  const safeFieldMeta = ZInitialsFieldMeta.safeParse(field.fieldMeta);
  const parsedFieldMeta = safeFieldMeta.success ? safeFieldMeta.data : null;

  const onSign = async (authOptions?: TRecipientActionAuth) => {
    try {
      const value = initials ?? '';

      const payload: TSignFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
        value,
        isBase64: false,
        authOptions,
      };

      if (onSignField) {
        await onSignField(payload);
        return;
      }

      await signFieldWithToken(payload);

      await revalidate();
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.UNAUTHORIZED) {
        throw error;
      }

      console.error(err);

      toast({
        title: _(msg`Error`),
        description: isAssistantMode
          ? _(msg`An error occurred while signing as assistant.`)
          : _(msg`An error occurred while signing the document.`),
        variant: 'destructive',
      });
    }
  };

  const onRemove = async () => {
    try {
      const payload: TRemovedSignedFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
      };

      if (onUnsignField) {
        await onUnsignField(payload);
        return;
      }

      await removeSignedFieldWithToken(payload);

      await revalidate();
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while removing the field.`),
        variant: 'destructive',
      });
    }
  };

  return (
    <DocumentSigningFieldContainer
      field={field}
      onSign={onSign}
      onRemove={onRemove}
      type="Initials"
    >
      {isLoading && <DocumentSigningFieldsLoader />}

      {!field.inserted && (
        <DocumentSigningFieldsUninserted>
          <Trans>Initials</Trans>
        </DocumentSigningFieldsUninserted>
      )}

      {field.inserted && (
        <DocumentSigningFieldsInserted textAlign={parsedFieldMeta?.textAlign}>
          {field.customText}
        </DocumentSigningFieldsInserted>
      )}
    </DocumentSigningFieldContainer>
  );
};
