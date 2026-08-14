import { RecipientStatusType } from '@hanzo/esign-lib/client-only/recipient-type';
import { Avatar, AvatarFallback } from '@hanzo/esign-ui/primitives/avatar';

const ZIndexes: { [key: string]: string } = {
  '10': 'z-10',
  '20': 'z-20',
  '30': 'z-30',
  '40': 'z-40',
  '50': 'z-50',
};

export type StackAvatarProps = {
  first?: boolean;
  zIndex?: string;
  fallbackText?: string;
  type: RecipientStatusType;
};

export const StackAvatar = ({ first, zIndex, fallbackText = '', type }: StackAvatarProps) => {
  let classes = '';
  let zIndexClass = '';
  const firstClass = first ? '' : '-ml-3';

  if (zIndex) {
    zIndexClass = ZIndexes[zIndex] ?? '';
  }

  switch (type) {
    case RecipientStatusType.UNSIGNED:
      classes = 'bg-neutral-100 text-neutral-500';
      break;
    case RecipientStatusType.OPENED:
      classes = 'bg-neutral-200 text-neutral-600';
      break;
    case RecipientStatusType.WAITING:
      classes = 'bg-neutral-300 text-neutral-700';
      break;
    case RecipientStatusType.COMPLETED:
      classes = 'bg-neutral-800 text-neutral-50';
      break;
    case RecipientStatusType.REJECTED:
      classes = 'bg-red-200 text-red-800';
      break;
    default:
      break;
  }

  return (
    <Avatar
      className={` ${zIndexClass} ${firstClass} h-10 w-10 border-2 border-solid border-white dark:border-border`}
    >
      <AvatarFallback className={classes}>{fallbackText}</AvatarFallback>
    </Avatar>
  );
};
