import React from 'react';
import { Check } from 'lucide-react';
import { getOptions, isValueAvailable } from '@/lib/variants';

// Customer-facing option pickers. Values that have no sellable combination with
// the current selection are disabled. Renders nothing at all (no heading, no
// spacing) when the product has no options — never an empty "Color" section.
export default function VariantSelector({ product, selection, onSelect }) {
  const options = getOptions(product);
  if (options.length === 0) return null;

  return (
    <div className="mt-6 space-y-4">
      {options.map((opt) => (
        <div key={opt.name}>
          {/* Just the option name — the selected value is shown via the
              button's own active state (+ check icon) below, not repeated
              in the heading too. */}
          <p className="text-sm font-heading font-bold text-foreground/80">{opt.name}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(opt.values || []).filter((v) => v.value).map((v) => {
              const active = selection[opt.name] === v.value;
              const available = isValueAvailable(product, opt.name, v.value, selection);
              return (
                <button
                  key={v.value}
                  type="button"
                  disabled={!available}
                  onClick={() => onSelect(opt.name, v.value)}
                  className={`h-11 px-5 rounded-full border text-sm font-heading font-bold transition-colors inline-flex items-center gap-1.5 ${
                    active ? 'bg-cosmic text-white border-cosmic' : 'bg-card border-border hover:border-cosmic'
                  } ${!available ? 'opacity-40 line-through cursor-not-allowed' : 'squish'}`}
                >
                  {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                  {v.value}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
