import { useLingui } from '@lingui/react/macro';
import type { z } from 'zod';

import { useCurrentOrganisation } from '@hanzo/esign-lib/client-only/providers/organisation';
import { useZapMutation, useZapQuery } from '@hanzo/esign-trpc/zap/react';
import type { TGetOrganisationResponse } from '@hanzo/esign-trpc/server/organisation-router/get-organisation.types';
import type { ZUpdateOrganisationSettingsRequestSchema } from '@hanzo/esign-trpc/server/organisation-router/update-organisation-settings.types';
import { SpinnerBox } from '@hanzo/esign-ui/primitives/spinner';
import { useToast } from '@hanzo/esign-ui/primitives/use-toast';

import {
  EmailPreferencesForm,
  type TEmailPreferencesFormSchema,
} from '~/components/forms/email-preferences-form';
import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Email Preferences');
}

export default function OrganisationSettingsGeneral() {
  const { t } = useLingui();
  const { toast } = useToast();

  const organisation = useCurrentOrganisation();

  const { data: organisationWithSettings, isLoading: isLoadingOrganisation } =
    useZapQuery<TGetOrganisationResponse>('organisation.get', {
      organisationReference: organisation.url,
    });

  const { mutateAsync: updateOrganisationSettings } = useZapMutation<
    void,
    z.infer<typeof ZUpdateOrganisationSettingsRequestSchema>
  >('organisation.settings.update');

  const onEmailPreferencesSubmit = async (data: TEmailPreferencesFormSchema) => {
    try {
      const { emailId, emailReplyTo, emailDocumentSettings } = data;

      await updateOrganisationSettings({
        organisationId: organisation.id,
        data: {
          emailId,
          emailReplyTo: emailReplyTo || null,
          // emailReplyToName,
          emailDocumentSettings: emailDocumentSettings ?? undefined,
        },
      });

      toast({
        title: t`Email preferences updated`,
        description: t`Your email preferences have been updated`,
      });
    } catch (err) {
      toast({
        title: t`Something went wrong!`,
        description: t`We were unable to update your email preferences at this time, please try again later`,
        variant: 'destructive',
      });
    }
  };

  if (isLoadingOrganisation || !organisationWithSettings) {
    return <SpinnerBox />;
  }

  return (
    <div className="max-w-2xl">
      <SettingsHeader
        title={t`Email Preferences`}
        subtitle={t`You can manage your email preferences here.`}
      />

      <section>
        <EmailPreferencesForm
          canInherit={false}
          settings={organisationWithSettings.organisationGlobalSettings}
          onFormSubmit={onEmailPreferencesSubmit}
        />
      </section>
    </div>
  );
}
