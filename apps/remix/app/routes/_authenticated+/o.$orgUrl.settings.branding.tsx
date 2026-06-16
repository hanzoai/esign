import { useLingui } from '@lingui/react/macro';
import { Loader } from 'lucide-react';
import type { z } from 'zod';

import { useCurrentOrganisation } from '@hanzo/sign-lib/client-only/providers/organisation';
import { useSession } from '@hanzo/sign-lib/client-only/providers/session';
import { putFile } from '@hanzo/sign-lib/universal/upload/put-file';
import { isPersonalLayout } from '@hanzo/sign-lib/utils/organisations';
import { useZapMutation, useZapQuery } from '@hanzo/sign-trpc/zap/react';
import type { TGetOrganisationResponse } from '@hanzo/sign-trpc/server/organisation-router/get-organisation.types';
import type { ZUpdateOrganisationSettingsRequestSchema } from '@hanzo/sign-trpc/server/organisation-router/update-organisation-settings.types';
import { useToast } from '@hanzo/sign-ui/primitives/use-toast';

import {
  BrandingPreferencesForm,
  type TBrandingPreferencesFormSchema,
} from '~/components/forms/branding-preferences-form';
import { SettingsHeader } from '~/components/general/settings-header';
import { useOptionalCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Branding Preferences');
}

export default function OrganisationSettingsBrandingPage() {
  const { organisations } = useSession();

  const organisation = useCurrentOrganisation();
  const team = useOptionalCurrentTeam();

  const { t } = useLingui();
  const { toast } = useToast();

  const isPersonalLayoutMode = isPersonalLayout(organisations);

  const { data: organisationWithSettings, isLoading: isLoadingOrganisation } =
    useZapQuery<TGetOrganisationResponse>('organisation.get', {
      organisationReference: organisation.url,
    });

  const { mutateAsync: updateOrganisationSettings } = useZapMutation<
    void,
    z.infer<typeof ZUpdateOrganisationSettingsRequestSchema>
  >('organisation.settings.update');

  const onBrandingPreferencesFormSubmit = async (data: TBrandingPreferencesFormSchema) => {
    try {
      const { brandingEnabled, brandingLogo, brandingUrl, brandingCompanyDetails } = data;

      let uploadedBrandingLogo: string | undefined = '';

      if (brandingLogo) {
        uploadedBrandingLogo = JSON.stringify(await putFile(brandingLogo));
      }

      await updateOrganisationSettings({
        organisationId: organisation.id,
        data: {
          brandingEnabled: brandingEnabled ?? undefined,
          brandingLogo: uploadedBrandingLogo,
          brandingUrl,
          brandingCompanyDetails,
        },
      });

      toast({
        title: t`Branding preferences updated`,
        description: t`Your branding preferences have been updated`,
      });
    } catch (err) {
      toast({
        title: t`Something went wrong`,
        description: t`We were unable to update your branding preferences at this time, please try again later`,
        variant: 'destructive',
      });
    }
  };

  if (isLoadingOrganisation || !organisationWithSettings) {
    return (
      <div className="flex items-center justify-center rounded-lg py-32">
        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const settingsHeaderText = t`Branding Preferences`;

  const settingsHeaderSubtitle = isPersonalLayoutMode
    ? t`Here you can set your general branding preferences.`
    : team
      ? t`Here you can set branding preferences for your team.`
      : t`Here you can set branding preferences for your organisation. Teams will inherit these settings by default.`;

  return (
    <div className="max-w-2xl">
      <SettingsHeader title={settingsHeaderText} subtitle={settingsHeaderSubtitle} />

      <section>
        <BrandingPreferencesForm
          context="Organisation"
          settings={organisationWithSettings.organisationGlobalSettings}
          onFormSubmit={onBrandingPreferencesFormSubmit}
        />
      </section>
    </div>
  );
}
