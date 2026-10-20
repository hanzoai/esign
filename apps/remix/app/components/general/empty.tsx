import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@hanzo/esign-ui/lib/utils';

export type EmptyProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  title?: ReactNode;
};

/**
 * What a list draws when it holds nothing: the reason it is empty, set quietly in
 * the space the list would fill.
 */
export const Empty = ({ title, children, className, ...props }: EmptyProps) => {
  return (
    <div
      className={cn(
        'flex h-60 flex-col items-center justify-center text-muted-foreground',
        className,
      )}
      {...props}
    >
      <div className="text-center">
        {title && <h3 className="text-lg font-semibold text-foreground">{title}</h3>}

        {children && <p className="mt-2 max-w-[60ch]">{children}</p>}
      </div>
    </div>
  );
};
