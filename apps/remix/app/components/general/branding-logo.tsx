import type { SVGAttributes } from 'react';

import { brand } from '~/components/branding/brand';
import { MarkPaths } from '~/components/branding/hanzo-mark';

export type LogoProps = SVGAttributes<SVGSVGElement>;

// Mark plus wordmark, locked up as ONE svg so the pair scales as a unit
// wherever it mounts — the app header, the embed footers and the generated PDF
// audit trail all size it by height alone.
//
// The name comes from NEXT_PUBLIC_APP_NAME at runtime, so a tenant rebrands by
// setting env rather than forking this file. Per-org logo upload already exists
// for documents (team/org `brandingLogo`); extending it to the app shell is the
// next step and would replace the mark here.
export const BrandingLogo = ({ ...props }: LogoProps) => {
  const { name, primary, suffix } = brand();

  // The wordmark starts after the 67-wide mark plus a gap. Advance width is
  // estimated per glyph (~0.55em at 44px) because SVG cannot measure text — the
  // viewBox has to be right before layout, and `w-auto` callers size by height.
  const textX = 86;
  const width = textX + Math.ceil(name.length * 24);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} 67`}
      aria-label={name}
      {...props}
    >
      <MarkPaths />
      {/* `dx` is the word space: SVG collapses a space written between tspans. */}
      <text
        x={textX}
        y="48"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="44"
        fontWeight="600"
        letterSpacing="-1.5"
      >
        <tspan className="fill-foreground">{primary}</tspan>
        {suffix && (
          <tspan className="fill-muted-foreground" dx="11">
            {suffix}
          </tspan>
        )}
      </text>
    </svg>
  );
};
