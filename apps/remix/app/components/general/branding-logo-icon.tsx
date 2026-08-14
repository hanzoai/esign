import type { SVGAttributes } from 'react';

import { MarkPaths } from '~/components/branding/hanzo-mark';

export type LogoProps = SVGAttributes<SVGSVGElement>;

// The house mark on its own, mono via currentColor — the compact form of the
// wordmark for tight surfaces (the mobile header, embed strips).
export const BrandingLogoIcon = ({ ...props }: LogoProps) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 67 67" {...props}>
      <MarkPaths />
    </svg>
  );
};
