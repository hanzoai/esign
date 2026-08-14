import * as React from 'react';

import { Trans } from '@lingui/react/macro';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@hanzo/esign-ui/lib/utils';
import { Button } from '@hanzo/esign-ui/primitives/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@hanzo/esign-ui/primitives/command';
import { Popover, PopoverContent, PopoverTrigger } from '@hanzo/esign-ui/primitives/popover';

type ComboboxProps = {
  listValues: string[];
  onChange: (_values: string[]) => void;
};

const MultiSelectRoleCombobox = ({ listValues, onChange }: ComboboxProps) => {
  const [open, setOpen] = React.useState(false);
  const [selectedValues, setSelectedValues] = React.useState<string[]>([]);
  // `Role` is orphaned on the Base SQLite schema (User.roles is a JSON string[]),
  // so the generated client no longer exports it. These are the role values.
  const dbRoles = ['USER', 'ADMIN'];

  React.useEffect(() => {
    setSelectedValues(listValues);
  }, [listValues]);

  const allRoles = [...new Set([...dbRoles, ...selectedValues])];

  const handleSelect = (currentValue: string) => {
    let newSelectedValues;
    if (selectedValues.includes(currentValue)) {
      newSelectedValues = selectedValues.filter((value) => value !== currentValue);
    } else {
      newSelectedValues = [...selectedValues, currentValue];
    }

    setSelectedValues(newSelectedValues);
    onChange(newSelectedValues);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          {selectedValues.length > 0 ? selectedValues.join(', ') : 'Select values...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder={selectedValues.join(', ')} />
          <CommandEmpty>
            <Trans>No value found.</Trans>
          </CommandEmpty>
          <CommandGroup>
            {allRoles.map((value: string, i: number) => (
              <CommandItem key={i} onSelect={() => handleSelect(value)}>
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    selectedValues.includes(value) ? 'opacity-100' : 'opacity-0',
                  )}
                />
                {value}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export { MultiSelectRoleCombobox };
