import type { HTMLAttributes } from 'react';

import { cn } from '@hanzo/esign-ui/lib/utils';

import { appName } from '~/components/branding/brand';

export type BrandingLogoProps = HTMLAttributes<HTMLSpanElement>;

/**
 * The wordmark, and nothing in front of it: the app's name set as text, as hanzo.ai sets
 * its own. Text rather than an SVG so it is measured by the browser and never clipped,
 * whatever the tenant's name (NEXT_PUBLIC_APP_NAME). It takes its colour from the parent
 * and its size from the caller's text-* class.
 */
export const BrandingLogo = ({ className, ...props }: BrandingLogoProps) => {
  return (
    <span
      className={cn('whitespace-nowrap font-semibold tracking-[-0.02em]', className)}
      {...props}
    >
      {appName()}
    </span>
  );
};
