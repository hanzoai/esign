import type { ReactNode } from 'react';

import { Link, useLocation } from 'react-router';

import { cn } from '@hanzo/esign-ui/lib/utils';
import { Button } from '@hanzo/esign-ui/primitives/button';

export type SettingsNavItemProps = {
  to: string;
  /** Path prefix that marks this item as the current one. `null` never marks. */
  match?: string | null;
  className?: string;
  children: ReactNode;
};

/**
 * One settings destination. The link is the only thing that takes the click,
 * so a nav item fires once.
 */
export const SettingsNavItem = ({ to, match = to, className, children }: SettingsNavItemProps) => {
  const { pathname } = useLocation();

  return (
    <Button
      variant="ghost"
      className={cn(
        'w-full justify-start',
        match && pathname?.startsWith(match) && 'bg-secondary',
        className,
      )}
      asChild
    >
      <Link to={to}>{children}</Link>
    </Button>
  );
};
