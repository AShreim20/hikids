import React, { useState } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
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
  searchable = false,
  className = '',
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);
  // Search ignores case, Arabic diacritics and alef/hamza/ya/ta-marbuta spelling variants.
  const norm = (x) => String(x).toLowerCase().normalize('NFKD').replace(/[ً-ٰٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
  const q = norm(query.trim());
  const shown = searchable && q ? options.filter((o) => norm(o.label).includes(q)) : options;

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
        className={`${className} flex items-center justify-between text-start`}
      >
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>
      <Drawer open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
        <DrawerContent className="max-h-[75vh]">
          <DrawerHeader className="text-center pb-2">
            <DrawerTitle>{label || placeholder}</DrawerTitle>
          </DrawerHeader>
          {searchable && (
            <div className="px-4 pb-2">
              <div className="relative">
                <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={label || placeholder}
                  aria-label={label || placeholder}
                  className="w-full h-12 ps-10 pe-4 rounded-2xl bg-mist border border-border text-base focus:outline-none focus:ring-2 focus:ring-cosmic/40"
                />
              </div>
            </div>
          )}
          <div className="px-4 pb-6 overflow-auto space-y-1">
            {includeEmpty && !query && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className={`w-full flex items-center justify-between px-4 h-14 rounded-2xl text-start transition-colors ${!selected ? 'bg-cosmic/10 text-cosmic font-bold' : 'hover:bg-mist'}`}
              >
                <span className="text-muted-foreground">{placeholder}</span>
                {!selected && <Check className="w-5 h-5" />}
              </button>
            )}
            {searchable && query && shown.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">—</p>
            )}
            {shown.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full flex items-center justify-between px-4 h-14 rounded-2xl text-start transition-colors ${o.value === value ? 'bg-cosmic/10 text-cosmic font-bold' : 'hover:bg-mist'}`}
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