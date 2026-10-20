import { type HTMLAttributes, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { ReadStatus } from '@prisma/client';
import { InboxIcon, MenuIcon, SearchIcon } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { useSession } from '@hanzo/esign-lib/client-only/providers/session';
import { isPersonalLayout } from '@hanzo/esign-lib/utils/organisations';
import { getRootHref } from '@hanzo/esign-lib/utils/params';
import type { TGetInboxCountResponse } from '@hanzo/esign-trpc/server/document-router/get-inbox-count.types';
import { useZapQuery } from '@hanzo/esign-trpc/zap/react';
import { cn } from '@hanzo/esign-ui/lib/utils';
import { Button } from '@hanzo/esign-ui/primitives/button';

import { BrandingLogo } from '~/components/general/branding-logo';

import { AppCommandMenu } from './app-command-menu';
import { AppNavDesktop } from './app-nav-desktop';
import { AppNavMobile } from './app-nav-mobile';
import { MenuSwitcher } from './menu-switcher';
import { OrgMenuSwitcher } from './org-menu-switcher';

export type HeaderProps = HTMLAttributes<HTMLDivElement>;

// hanzo.ai's bar: the wordmark at the left edge, a hairline under it, the page through a blur.
const HEADER_CLASS_NAME =
  'supports-backdrop-blur:bg-background/60 sticky top-0 z-[60] flex h-16 w-full items-center border-b border-border bg-background/80 backdrop-blur';

const WORDMARK_LINK_CLASS_NAME =
  'rounded-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/**
 * The bar a visitor without a session sees: the wordmark and nothing else, so a recipient
 * or a sign-in reads as the same product as the app behind it.
 */
export const PublicHeader = ({ className, ...props }: HeaderProps) => {
  return (
    <header className={cn(HEADER_CLASS_NAME, className)} {...props}>
      <div className="mx-auto flex w-full max-w-screen-xl items-center px-4 md:px-8">
        <Link to="/" className={WORDMARK_LINK_CLASS_NAME}>
          <BrandingLogo className="text-[19px]" />
        </Link>
      </div>
    </header>
  );
};

export const Header = ({ className, ...props }: HeaderProps) => {
  const { t } = useLingui();
  const params = useParams();

  const { organisations } = useSession();

  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [isHamburgerMenuOpen, setIsHamburgerMenuOpen] = useState(false);

  const { data: unreadCountData } = useZapQuery<TGetInboxCountResponse>(
    'document.inbox.getCount',
    {
      readStatus: ReadStatus.NOT_OPENED,
    },
    {
      // refetchInterval: 30000, // Refetch every 30 seconds
    },
  );

  return (
    <header className={cn(HEADER_CLASS_NAME, className)} {...props}>
      <div className="mx-auto flex w-full max-w-screen-xl items-center gap-x-4 px-4 md:px-8">
        <Link to={getRootHref(params)} className={WORDMARK_LINK_CLASS_NAME}>
          <BrandingLogo className="text-[19px]" />
        </Link>

        <AppNavDesktop setIsCommandMenuOpen={setIsCommandMenuOpen} />

        <Button asChild variant="outline" className="relative hidden h-9 w-9 md:flex">
          <Link to="/inbox" aria-label={t`Inbox`} className="relative block h-9 w-9">
            <InboxIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-colors hover:text-foreground" />

            {unreadCountData && unreadCountData.count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {unreadCountData.count > 99 ? '99+' : unreadCountData.count}
              </span>
            )}
          </Link>
        </Button>

        <div className="ml-auto md:ml-2">
          {isPersonalLayout(organisations) ? <MenuSwitcher /> : <OrgMenuSwitcher />}
        </div>

        <div className="flex flex-row items-center space-x-4 md:hidden">
          <button aria-label={t`Search`} onClick={() => setIsCommandMenuOpen(true)}>
            <SearchIcon className="h-5 w-5 text-muted-foreground" />
          </button>

          <button aria-label={t`Menu`} onClick={() => setIsHamburgerMenuOpen(true)}>
            <MenuIcon className="h-5 w-5 text-muted-foreground" />
          </button>

          <AppCommandMenu open={isCommandMenuOpen} onOpenChange={setIsCommandMenuOpen} />

          <AppNavMobile
            isMenuOpen={isHamburgerMenuOpen}
            onMenuOpenChange={setIsHamburgerMenuOpen}
          />
        </div>
      </div>
    </header>
  );
};
