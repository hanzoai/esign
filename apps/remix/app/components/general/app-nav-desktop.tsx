import type { HTMLAttributes } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { useSession } from '@hanzo/esign-lib/client-only/providers/session';
import { isPersonalLayout } from '@hanzo/esign-lib/utils/organisations';
import { cn } from '@hanzo/esign-ui/lib/utils';
import { Button } from '@hanzo/esign-ui/primitives/button';

import { useOptionalCurrentTeam } from '~/providers/team';

export type AppNavDesktopProps = HTMLAttributes<HTMLDivElement> & {
  setIsCommandMenuOpen: (value: boolean) => void;
};

export const AppNavDesktop = ({
  className,
  setIsCommandMenuOpen,
  ...props
}: AppNavDesktopProps) => {
  const { _ } = useLingui();
  const { organisations } = useSession();

  const { pathname } = useLocation();

  const [modifierKey, setModifierKey] = useState(() => 'Ctrl');

  const currentTeam = useOptionalCurrentTeam();

  useEffect(() => {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
    const isMacOS = /Macintosh|Mac\s+OS\s+X/i.test(userAgent);

    setModifierKey(isMacOS ? '⌘' : 'Ctrl');
  }, []);

  const menuNavigationLinks = useMemo(() => {
    let teamUrl = currentTeam?.url || null;

    if (!teamUrl && isPersonalLayout(organisations)) {
      teamUrl = organisations[0].teams[0]?.url || null;
    }

    if (!teamUrl) {
      return [];
    }

    return [
      {
        href: `/t/${teamUrl}/documents`,
        label: msg`Documents`,
      },
      {
        href: `/t/${teamUrl}/templates`,
        label: msg`Templates`,
      },
    ];
  }, [currentTeam, organisations]);

  return (
    <div
      className={cn(
        'ml-8 hidden flex-1 items-center gap-x-12 md:flex md:justify-between',
        className,
      )}
      {...props}
    >
      <div>
        <AnimatePresence>
          {menuNavigationLinks.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-baseline gap-x-6"
            >
              {menuNavigationLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  to={href}
                  className={cn(
                    'rounded-full text-[13px] font-medium leading-5 text-muted-foreground ring-offset-background transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    {
                      'text-foreground': pathname?.startsWith(href),
                    },
                  )}
                >
                  {_(label)}
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Button
        variant="outline"
        className="flex h-9 w-full max-w-80 items-center justify-between pl-3 pr-1.5 font-normal text-muted-foreground"
        onClick={() => setIsCommandMenuOpen(true)}
      >
        <div className="flex items-center text-[13px]">
          <Search className="mr-2 h-4 w-4" />
          <Trans>Search</Trans>
        </div>

        <div>
          <div className="flex items-center rounded-full bg-muted px-2 py-0.5 text-xs tracking-wider text-muted-foreground">
            {modifierKey}+K
          </div>
        </div>
      </Button>
    </div>
  );
};
