import type { SVGAttributes } from 'react';

export type LogoProps = SVGAttributes<SVGSVGElement>;

// Hanzo Sign wordmark: the house mark (same vector as @hanzo/logo, mono via
// currentColor) locked up with the product name, kept as ONE svg so it scales
// as a unit wherever the mark mounts — the app header, the embed footers and
// the generated PDF audit trail all rebrand from this single source.
export const BrandingLogo = ({ ...props }: LogoProps) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 67" aria-label="Hanzo Sign" {...props}>
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
      <text
        x="86"
        y="48"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="44"
        fontWeight="600"
        letterSpacing="-1.5"
        fill="currentColor"
      >
        Hanzo Sign
      </text>
    </svg>
  );
};
