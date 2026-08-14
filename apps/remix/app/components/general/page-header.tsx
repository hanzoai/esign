import type { ReactNode } from 'react';

import { cn } from '@hanzo/esign-ui/lib/utils';

export type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Rendered at the trailing edge of the title row. */
  children?: ReactNode;
  className?: string;
  descriptionClassName?: string;
};

/**
 * The title of a page, and the one gap between it and its description. A
 * heading and the line explaining it are one unit, so they sit closer to each
 * other than to anything else on the page.
 */
export const PageHeader = ({
  title,
  description,
  children,
  className,
  descriptionClassName,
}: PageHeaderProps) => {
  return (
    <div className={cn('flex flex-row items-center justify-between gap-x-4', className)}>
      <div className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>

        {description && (
          <p className={cn('text-balance text-sm text-muted-foreground', descriptionClassName)}>
            {description}
          </p>
        )}
      </div>

      {children}
    </div>
  );
};
