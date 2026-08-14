import { useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';
import { useNavigate } from 'react-router';

import { useAnalytics } from '@hanzo/esign-lib/client-only/hooks/use-analytics';
import { useSession } from '@hanzo/esign-lib/client-only/providers/session';
import { DEFAULT_DOCUMENT_TIME_ZONE, TIME_ZONES } from '@hanzo/esign-lib/constants/time-zones';
import { useLimits } from '@hanzo/esign-lib/server-only/limits/provider/client';
import { formatDocumentsPath, formatTemplatesPath } from '@hanzo/esign-lib/utils/teams';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '@hanzo/esign-trpc/server/envelope-router/create-envelope.types';
import { useZapMutation } from '@hanzo/esign-trpc/zap/react';
import { useToast } from '@hanzo/esign-ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

import { uploadErrorMessage } from './upload-error';

export type CreateEnvelopeOptions = {
  type: EnvelopeType;
  folderId?: string;
};

/**
 * Create an envelope from files and open it in the editor.
 *
 * Every way of starting a document ends here — a picked file, a drop, a paste,
 * a link. They differ only in how the bytes were come by; once they are Files
 * there is one call, one error message, one place the user lands.
 */
export const useCreateEnvelope = ({ type, folderId }: CreateEnvelopeOptions) => {
  const { t, i18n } = useLingui();
  const { toast } = useToast();
  const { user } = useSession();

  const team = useCurrentTeam();
  const navigate = useNavigate();
  const analytics = useAnalytics();

  const { refreshLimits } = useLimits();

  const [isCreating, setIsCreating] = useState(false);

  const { mutateAsync: createEnvelope } = useZapMutation<TCreateEnvelopeResponse, FormData>(
    'envelope.create',
  );

  const timezone =
    TIME_ZONES.find((zone) => zone === Intl.DateTimeFormat().resolvedOptions().timeZone) ??
    DEFAULT_DOCUMENT_TIME_ZONE;

  /** Resolves the new envelope's id, or undefined once the failure is shown. */
  const create = async (files: File[]): Promise<string | undefined> => {
    try {
      setIsCreating(true);

      const payload = {
        folderId,
        type,
        title: files[0].name,
        meta: {
          timezone,
        },
      } satisfies TCreateEnvelopePayload;

      const formData = new FormData();

      formData.append('payload', JSON.stringify(payload));

      for (const file of files) {
        formData.append('files', file);
      }

      const { id } = await createEnvelope(formData);

      void refreshLimits();

      toast({
        title: type === EnvelopeType.DOCUMENT ? t`Document uploaded` : t`Template uploaded`,
        description:
          type === EnvelopeType.DOCUMENT
            ? t`Your document has been uploaded successfully.`
            : t`Your template has been uploaded successfully.`,
        duration: 5000,
      });

      if (type === EnvelopeType.DOCUMENT) {
        analytics.capture('App: Document Uploaded', {
          userId: user.id,
          documentId: id,
          timestamp: new Date().toISOString(),
        });
      }

      const pathPrefix =
        type === EnvelopeType.DOCUMENT
          ? formatDocumentsPath(team.url)
          : formatTemplatesPath(team.url);

      const aiQueryParam = team.preferences.aiFeaturesEnabled ? '?ai=true' : '';

      await navigate(`${pathPrefix}/${id}/edit${aiQueryParam}`);

      return id;
    } catch (err) {
      console.error(err);

      toast({
        title: t`Error`,
        description: i18n._(uploadErrorMessage(err, type)),
        variant: 'destructive',
        duration: 7500,
      });

      return undefined;
    } finally {
      setIsCreating(false);
    }
  };

  return { create, isCreating };
};
