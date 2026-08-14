import * as React from 'react';

import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';

import { cn } from '../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md text-xs font-medium ring-1 ring-inset w-fit',
  {
    variants: {
      variant: {
        neutral: 'bg-muted text-muted-foreground ring-border',
        destructive:
          'bg-red-50 text-red-700 ring-red-600/10 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20',
        warning: 'bg-muted text-foreground ring-foreground/30',
        default: 'bg-muted text-foreground ring-border',
        secondary: 'bg-transparent text-muted-foreground ring-border',
      },
      size: {
        small: 'px-1.5 py-0.5 text-xs',
        default: 'px-2 py-1.5 text-xs',
        large: 'px-3 py-2 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div role="status" className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
