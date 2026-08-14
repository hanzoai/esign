// Canonical Hanzo mark — single-source SVG, mono via currentColor so it
// adopts whatever text color its parent sets. Same vector shipped in
// @hanzo/logo's docs/assets/hanzo-logo.svg, repainted to use
// currentColor instead of #000/#666 so it composes cleanly into any
// theme.
//
// White-label rule: this component renders the MARK only. The wordmark
// (brand name + suffix) is rendered separately by the consumer using
// NEXT_PUBLIC_APP_NAME so tenants can drop in their own brand without
// forking the component.
import type { SVGProps } from 'react';

import { cn } from '@hanzo/esign-ui/lib/utils';

export type HanzoMarkProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

/**
 * The mark's geometry on a 67x67 grid, painted in `currentColor`.
 *
 * Exported so every lockup draws the same vector — the icon, the wordmark and
 * this component share it rather than each carrying a copy that can drift.
 */
export const MarkPaths = () => (
  <>
    <path d="M22.21 67V44.6369H0V67H22.21Z" fill="currentColor" />
    <path d="M0 44.6369L22.21 46.8285V44.6369H0Z" fill="currentColor" opacity="0.4" />
    <path
      d="M66.7038 22.3184H22.2534L0.0878906 44.6367H44.4634L66.7038 22.3184Z"
      fill="currentColor"
    />
    <path d="M22.21 0H0V22.3184H22.21V0Z" fill="currentColor" />
    <path d="M66.7198 0H44.5098V22.3184H66.7198V0Z" fill="currentColor" />
    <path d="M66.6753 22.3185L44.5098 20.0822V22.3185H66.6753Z" fill="currentColor" opacity="0.4" />
    <path d="M66.7198 67V44.6369H44.5098V67H66.7198Z" fill="currentColor" />
  </>
);

export const HanzoMark = ({ size = 24, className, ...props }: HanzoMarkProps) => {
  return (
    <svg
      viewBox="0 0 67 67"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      aria-label="Hanzo"
      className={cn('text-current', className)}
      {...props}
    >
      <MarkPaths />
    </svg>
  );
};
