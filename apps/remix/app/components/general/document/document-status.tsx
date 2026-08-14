import type { HTMLAttributes } from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { CheckCircle2, Clock, File, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react/dist/lucide-react';

import type { ExtendedDocumentStatus } from '@hanzo/esign-prisma/types/extended-document-status';
import { SignatureIcon } from '@hanzo/esign-ui/icons/signature';
import { cn } from '@hanzo/esign-ui/lib/utils';

type FriendlyStatus = {
  label: MessageDescriptor;
  labelExtended: MessageDescriptor;
  icon?: LucideIcon;
  color: string;
};

export const FRIENDLY_STATUS_MAP: Record<ExtendedDocumentStatus, FriendlyStatus> = {
  PENDING: {
    label: msg`Pending`,
    labelExtended: msg`Document pending`,
    icon: Clock,
    color: 'text-muted-foreground',
  },
  COMPLETED: {
    label: msg`Completed`,
    labelExtended: msg`Document completed`,
    icon: CheckCircle2,
    color: 'text-foreground',
  },
  DRAFT: {
    label: msg`Draft`,
    labelExtended: msg`Document draft`,
    icon: File,
    color: 'text-muted-foreground',
  },
  REJECTED: {
    label: msg`Rejected`,
    labelExtended: msg`Document rejected`,
    icon: XCircle,
    color: 'text-destructive',
  },
  INBOX: {
    label: msg`Inbox`,
    labelExtended: msg`Document inbox`,
    icon: SignatureIcon,
    color: 'text-muted-foreground',
  },
  ALL: {
    label: msg`All`,
    labelExtended: msg`Document All`,
    color: 'text-muted-foreground',
  },
};

export type DocumentStatusProps = HTMLAttributes<HTMLSpanElement> & {
  status: ExtendedDocumentStatus;
  inheritColor?: boolean;
};

export const DocumentStatus = ({
  className,
  status,
  inheritColor,
  ...props
}: DocumentStatusProps) => {
  const { _ } = useLingui();

  const { label, icon: Icon, color } = FRIENDLY_STATUS_MAP[status];

  return (
    <span className={cn('flex items-center', className)} {...props}>
      {Icon && (
        <Icon
          className={cn('mr-2 inline-block h-4 w-4', {
            [color]: !inheritColor,
          })}
        />
      )}
      {_(label)}
    </span>
  );
};
