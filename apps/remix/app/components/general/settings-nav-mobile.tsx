import type { HTMLAttributes } from 'react';

import { Trans } from '@lingui/react/macro';
import {
  BracesIcon,
  CreditCardIcon,
  Globe2Icon,
  Lock,
  MailIcon,
  PaletteIcon,
  Settings2Icon,
  User,
  Users,
  WebhookIcon,
} from 'lucide-react';

import { useSession } from '@hanzo/esign-lib/client-only/providers/session';
import { IS_BILLING_ENABLED } from '@hanzo/esign-lib/constants/app';
import {
  canExecuteOrganisationAction,
  isPersonalLayout,
} from '@hanzo/esign-lib/utils/organisations';
import { cn } from '@hanzo/esign-ui/lib/utils';

import { SettingsNavItem } from '~/components/general/settings-nav-item';

export type SettingsMobileNavProps = HTMLAttributes<HTMLDivElement>;

export const SettingsMobileNav = ({ className, ...props }: SettingsMobileNavProps) => {
  const { organisations } = useSession();

  const isPersonalLayoutMode = isPersonalLayout(organisations);

  const hasManageableBillingOrgs = organisations.some((org) =>
    canExecuteOrganisationAction('MANAGE_BILLING', org.currentOrganisationRole),
  );

  return (
    <div
      className={cn('flex flex-wrap items-center justify-start gap-x-2 gap-y-4', className)}
      {...props}
    >
      <SettingsNavItem to="/settings/profile">
        <User className="mr-2 h-5 w-5" />
        <Trans>Profile</Trans>
      </SettingsNavItem>

      {isPersonalLayoutMode && (
        <>
          <SettingsNavItem to="/settings/document">
            <Settings2Icon className="mr-2 h-5 w-5" />
            <Trans>Document Preferences</Trans>
          </SettingsNavItem>

          <SettingsNavItem to="/settings/branding">
            <PaletteIcon className="mr-2 h-5 w-5" />
            <Trans>Branding Preferences</Trans>
          </SettingsNavItem>

          <SettingsNavItem to="/settings/email">
            <MailIcon className="mr-2 h-5 w-5" />
            <Trans>Email Preferences</Trans>
          </SettingsNavItem>

          <SettingsNavItem to="/settings/public-profile">
            <Globe2Icon className="mr-2 h-5 w-5" />
            <Trans>Public Profile</Trans>
          </SettingsNavItem>

          <SettingsNavItem to="/settings/tokens">
            <BracesIcon className="mr-2 h-5 w-5" />
            <Trans>API Tokens</Trans>
          </SettingsNavItem>

          <SettingsNavItem to="/settings/webhooks">
            <WebhookIcon className="mr-2 h-5 w-5" />
            <Trans>Webhooks</Trans>
          </SettingsNavItem>
        </>
      )}

      <SettingsNavItem to="/settings/organisations">
        <Users className="mr-2 h-5 w-5" />
        <Trans>Organisations</Trans>
      </SettingsNavItem>

      {IS_BILLING_ENABLED() && hasManageableBillingOrgs && (
        <SettingsNavItem
          to={isPersonalLayoutMode ? '/settings/billing-personal' : '/settings/billing'}
          match="/settings/billing"
        >
          <CreditCardIcon className="mr-2 h-5 w-5" />
          <Trans>Billing</Trans>
        </SettingsNavItem>
      )}

      <SettingsNavItem to="/settings/security">
        <Lock className="mr-2 h-5 w-5" />
        <Trans>Security</Trans>
      </SettingsNavItem>
    </div>
  );
};
