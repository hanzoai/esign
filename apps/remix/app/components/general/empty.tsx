import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@hanzo/esign-ui/lib/utils';

import { BrandingLogoIcon } from '~/components/general/branding-logo-icon';

export type EmptyProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  title?: ReactNode;
};

/**
 * What a list draws when it holds nothing: the house mark, mono and quiet,
 * above the reason it is empty. The mark is the vector the header draws, so a
 * tenant's brand carries through.
 */
export const Empty = ({ title, children, className, ...props }: EmptyProps) => {
  return (
    <div
      className={cn(
        'flex h-60 flex-col items-center justify-center gap-y-4 text-muted-foreground',
        className,
      )}
      {...props}
    >
      <BrandingLogoIcon className="h-10 w-10 text-muted-foreground/40" />

      <div className="text-center">
        {title && <h3 className="text-lg font-semibold text-foreground">{title}</h3>}

        {children && <p className="mt-2 max-w-[60ch]">{children}</p>}
      </div>
    </div>
  );
};
