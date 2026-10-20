import type { HTMLAttributes } from 'react';

import { Trans } from '@lingui/react/macro';

import { cn } from '@hanzo/esign-ui/lib/utils';

import { companyName } from '~/components/branding/brand';
import { BrandingLogo } from '~/components/general/branding-logo';

export type AppFooterProps = HTMLAttributes<HTMLElement>;

/**
 * The foot of a public page, as hanzo.ai ends its own: the wordmark and the copyright on
 * one side, the terms and the privacy policy on the other, under a hairline.
 */
export const AppFooter = ({ className, ...props }: AppFooterProps) => {
  return (
    <footer className={cn('border-t border-border', className)} {...props}>
      <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-y-3 px-4 py-8 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-8">
        <div className="flex items-center gap-x-5">
          <BrandingLogo className="text-[17px] text-foreground" />

          <span>
            © {new Date().getFullYear()} {companyName()}
          </span>
        </div>

        <nav className="flex items-center gap-x-4">
          <a href="https://hanzo.ai/terms" className="transition-colors hover:text-foreground">
            <Trans>Terms</Trans>
          </a>

          <a href="https://hanzo.ai/privacy" className="transition-colors hover:text-foreground">
            <Trans>Privacy</Trans>
          </a>
        </nav>
      </div>
    </footer>
  );
};
