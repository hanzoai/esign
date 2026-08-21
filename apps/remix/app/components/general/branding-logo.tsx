import type { SVGAttributes } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { brand } from '~/components/branding/brand';
import { MarkPaths } from '~/components/branding/hanzo-mark';

export type LogoProps = SVGAttributes<SVGSVGElement>;

// The wordmark starts after the 67-wide mark plus a gap.
const TEXT_X = 86;

// Width per glyph for the first server render only, before the browser reports
// the real advance. No constant can be right for every string: the same 44px
// text needs 26 units per character for "Hanzo Sign" and 48 for "W", and system
// fonts differ per platform. This one only has to be close enough that the box
// does not visibly resize once measured.
const ESTIMATED_GLYPH_WIDTH = 26;

// Measurement reads layout, so it belongs before paint — but this component
// also renders on the server, where a layout effect does nothing and React says
// so on every request.
const useMeasure = typeof document === 'undefined' ? useEffect : useLayoutEffect;

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

  const textRef = useRef<SVGTextElement>(null);
  const [width, setWidth] = useState(() => TEXT_X + name.length * ESTIMATED_GLYPH_WIDTH);

  // SVG clips whatever sits outside its viewBox, so the box has to be as wide as
  // the text actually draws — which only the browser can say, and only once it
  // has laid the glyphs out in the font it resolved.
  useMeasure(() => {
    const text = textRef.current;

    if (!text) {
      return;
    }

    const measure = () => {
      const box = text.getBBox();

      // A mount hidden by a breakpoint (`hidden md:block`) measures zero. Keep
      // the estimate and let the observer re-measure when it gains a box.
      if (box.width > 0) {
        setWidth(Math.ceil(box.x + box.width));
      }
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(text.ownerSVGElement ?? text);

    return () => observer.disconnect();
  }, [name]);

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
        ref={textRef}
        x={TEXT_X}
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
