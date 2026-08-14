import type { HTMLAttributes } from 'react';

import { Trans } from '@lingui/react/macro';
import {
  BracesIcon,
  CreditCardIcon,
  Globe2Icon,
  Lock,
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

export type SettingsDesktopNavProps = HTMLAttributes<HTMLDivElement>;

export const SettingsDesktopNav = ({ className, ...props }: SettingsDesktopNavProps) => {
  const { organisations } = useSession();

  const isPersonalLayoutMode = isPersonalLayout(organisations);

  const hasManageableBillingOrgs = organisations.some((org) =>
    canExecuteOrganisationAction('MANAGE_BILLING', org.currentOrganisationRole),
  );

  return (
    <div className={cn('flex flex-col gap-y-2', className)} {...props}>
      <SettingsNavItem to="/settings/profile">
        <User className="mr-2 h-5 w-5" />
        <Trans>Profile</Trans>
      </SettingsNavItem>

      {isPersonalLayoutMode && (
        <>
          <SettingsNavItem to="/settings/document" match={null}>
            <Settings2Icon className="mr-2 h-5 w-5" />
            <Trans>Preferences</Trans>
          </SettingsNavItem>

          <SettingsNavItem to="/settings/document" className="pl-8">
            <Trans>Document</Trans>
          </SettingsNavItem>

          <SettingsNavItem to="/settings/branding" className="pl-8">
            <Trans>Branding</Trans>
          </SettingsNavItem>

          <SettingsNavItem to="/settings/email" className="pl-8">
            <Trans>Email</Trans>
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
