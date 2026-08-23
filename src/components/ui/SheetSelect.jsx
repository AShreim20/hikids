import React, { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

// Native <select> on desktop; a vaul bottom-sheet drawer on mobile. Keeps the
// stored value identical across both surfaces (onChange receives the value).
export default function SheetSelect({
  value,
  onChange,
  options,
  placeholder,
  label,
  required,
  includeEmpty = true,
  className = '',
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  if (!isMobile) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={className}
      >
        {includeEmpty && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${className} flex items-center justify-between text-left`}
      >
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[75vh]">
          <DrawerHeader className="text-center pb-2">
            <DrawerTitle>{label || placeholder}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-auto space-y-1">
            {includeEmpty && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className={`w-full flex items-center justify-between px-4 h-14 rounded-2xl text-left transition-colors ${!selected ? 'bg-cosmic/10 text-cosmic font-bold' : 'hover:bg-mist'}`}
              >
                <span className="text-muted-foreground">{placeholder}</span>
                {!selected && <Check className="w-5 h-5" />}
              </button>
            )}
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full flex items-center justify-between px-4 h-14 rounded-2xl text-left transition-colors ${o.value === value ? 'bg-cosmic/10 text-cosmic font-bold' : 'hover:bg-mist'}`}
              >
                <span>{o.label}</span>
                {o.value === value && <Check className="w-5 h-5" />}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}