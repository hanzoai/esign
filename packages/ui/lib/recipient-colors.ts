// !: We declare all of our classes here since TailwindCSS will remove any unused CSS classes,
// !: therefore doing this at runtime is not possible without whitelisting a set of classnames.
// !:
// !: This will later be improved as we move to a CSS variable approach and rotate the lightness

export type RecipientColorMap = Record<number, RecipientColorStyles>;

export type RecipientColorStyles = {
  base: string;
  baseRing: string;
  baseRingHover: string;
  baseTextHover: string;
  fieldButton: string;
  fieldItem: string;
  fieldItemInitials: string;
  comboxBoxTrigger: string;
  comboxBoxItem: string;
};

export const DEFAULT_RECT_BACKGROUND = 'rgba(255, 255, 255, 0.95)';

// !: values of the declared variable to do all the background, border and shadow styles.
export const RECIPIENT_COLOR_STYLES = {
  readOnly: {
    base: 'ring-neutral-400',
    baseRing: 'rgba(176, 176, 176, 1)',
    baseRingHover: 'rgba(176, 176, 176, 1)',
    baseTextHover: 'rgba(176, 176, 176, 1)',
    fieldButton: 'border-neutral-400 hover:border-neutral-400',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: '',
    comboxBoxTrigger:
      'ring-2 ring-recipient-1 shadow-[0_0_0_5px_hsl(var(--recipient-1)/10%),0_0_0_2px_hsl(var(--recipient-1)/60%),0_0_0_0.5px_hsl(var(--recipient-1))]',
    comboxBoxItem: '',
  },

  1: {
    base: 'ring-recipient-1 hover:bg-recipient-1/30',
    baseRing: 'rgba(92, 92, 92, 1)',
    baseRingHover: 'rgba(92, 92, 92, 0.3)',
    baseTextHover: 'rgba(92, 92, 92, 1)',
    fieldButton: 'hover:border-recipient-1 hover:bg-recipient-1/30 ',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: 'group-hover/field-item:bg-recipient-1',
    comboxBoxTrigger:
      'ring-2 ring-recipient-1 hover:bg-recipient-1/15 active:bg-recipient-1/15 shadow-[0_0_0_5px_hsl(var(--recipient-1)/10%),0_0_0_2px_hsl(var(--recipient-1)/60%),0_0_0_0.5px_hsl(var(--recipient-1))]',
    comboxBoxItem: 'hover:bg-recipient-1/15 active:bg-recipient-1/15',
  },

  2: {
    base: 'ring-recipient-2 hover:bg-recipient-2/30',
    baseRing: 'rgba(110, 110, 110, 1)',
    baseRingHover: 'rgba(110, 110, 110, 0.3)',
    baseTextHover: 'rgba(110, 110, 110, 1)',
    fieldButton: 'hover:border-recipient-2 hover:bg-recipient-2/30',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: 'group-hover/field-item:bg-recipient-2',
    comboxBoxTrigger:
      'ring-2 ring-recipient-2 hover:bg-recipient-2/15 active:bg-recipient-2/15 shadow-[0_0_0_5px_hsl(var(--recipient-2)/10%),0_0_0_2px_hsl(var(--recipient-2)/60%),0_0_0_0.5px_hsl(var(--recipient-2))]',
    comboxBoxItem: 'ring-recipient-2 hover:bg-recipient-2/15 active:bg-recipient-2/15',
  },

  3: {
    base: 'ring-recipient-3 hover:bg-recipient-3/30',
    baseRing: 'rgba(128, 128, 128, 1)',
    baseRingHover: 'rgba(128, 128, 128, 0.3)',
    baseTextHover: 'rgba(128, 128, 128, 1)',
    fieldButton: 'hover:border-recipient-3 hover:bg-recipient-3/30',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: 'group-hover/field-item:bg-recipient-3',
    comboxBoxTrigger:
      'ring-2 ring-recipient-3 hover:bg-recipient-3/15 active:bg-recipient-3/15 shadow-[0_0_0_5px_hsl(var(--recipient-3)/10%),0_0_0_2px_hsl(var(--recipient-3)/60%),0_0_0_0.5px_hsl(var(--recipient-3))]',
    comboxBoxItem: 'hover:bg-recipient-3/15 active:bg-recipient-3/15',
  },

  4: {
    base: 'ring-recipient-4 hover:bg-recipient-4/30',
    baseRing: 'rgba(145, 145, 145, 1)',
    baseRingHover: 'rgba(145, 145, 145, 0.3)',
    baseTextHover: 'rgba(145, 145, 145, 1)',
    fieldButton: 'hover:border-recipient-4 hover:bg-recipient-4/30',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: 'group-hover/field-item:bg-recipient-4',
    comboxBoxTrigger:
      'ring-2 ring-recipient-4 hover:bg-recipient-4/15 active:bg-recipient-4/15 shadow-[0_0_0_5px_hsl(var(--recipient-4)/10%),0_0_0_2px_hsl(var(--recipient-4)/60%),0_0_0_0.5px_hsl(var(--recipient-4))]',
    comboxBoxItem: 'hover:bg-recipient-4/15 active:bg-recipient-4/15',
  },

  5: {
    base: 'ring-recipient-5 hover:bg-recipient-5/30',
    baseRing: 'rgba(163, 163, 163, 1)',
    baseRingHover: 'rgba(163, 163, 163, 0.3)',
    baseTextHover: 'rgba(163, 163, 163, 1)',
    fieldButton: 'hover:border-recipient-5 hover:bg-recipient-5/30',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: 'group-hover/field-item:bg-recipient-5',
    comboxBoxTrigger:
      'ring-2 ring-recipient-5 hover:bg-recipient-5/15 active:bg-recipient-5/15 shadow-[0_0_0_5px_hsl(var(--recipient-5)/10%),0_0_0_2px_hsl(var(--recipient-5)/60%),0_0_0_0.5px_hsl(var(--recipient-5))]',
    comboxBoxItem: 'hover:bg-recipient-5/15 active:bg-recipient-5/15',
  },

  6: {
    base: 'ring-recipient-6 hover:bg-recipient-6/30',
    baseRing: 'rgba(181, 181, 181, 1)',
    baseRingHover: 'rgba(181, 181, 181, 0.3)',
    baseTextHover: 'rgba(181, 181, 181, 1)',
    fieldButton: 'hover:border-recipient-6 hover:bg-recipient-6/30',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: 'group-hover/field-item:bg-recipient-6',
    comboxBoxTrigger:
      'ring-2 ring-recipient-6 hover:bg-recipient-6/15 active:bg-recipient-6/15 shadow-[0_0_0_5px_hsl(var(--recipient-6)/10%),0_0_0_2px_hsl(var(--recipient-6)/60%),0_0_0_0.5px_hsl(var(--recipient-6))]',
    comboxBoxItem: 'hover:bg-recipient-6/15 active:bg-recipient-6/15',
  },
} satisfies Record<string, RecipientColorStyles>;

export type TRecipientColor = keyof typeof RECIPIENT_COLOR_STYLES;

export const AVAILABLE_RECIPIENT_COLORS = [1, 2, 3, 4, 5, 6] satisfies TRecipientColor[];

export const useRecipientColors = (index: number) => {
  const key = AVAILABLE_RECIPIENT_COLORS[index % AVAILABLE_RECIPIENT_COLORS.length];

  return RECIPIENT_COLOR_STYLES[key];
};

export const getRecipientColorStyles = (index: number) => {
  // Disabling the rule since the hook doesn't do anything special and can
  // be used universally.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useRecipientColors(index);
};
