import React from 'react';
import { getOptions, isValueAvailable } from '@/lib/variants';

// Customer-facing option pickers. Values that have no sellable combination with
// the current selection are disabled.
export default function VariantSelector({ product, selection, onSelect }) {
  const options = getOptions(product);
  if (options.length === 0) return null;

  return (
    <div className="mt-8 space-y-5">
      {options.map((opt) =>
      <div key={opt.name}>
          <p className="text-sm font-heading font-bold">
            {opt.name}
            {selection[opt.name] &&
          <span className="ms-2 font-body font-normal text-muted-foreground mx-3">{selection[opt.name]}</span>
          }
          </p>
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
                className={`h-11 px-5 rounded-full border text-sm font-heading font-bold transition-colors ${
                active ?
                'bg-cosmic text-white border-cosmic' :
                'bg-card border-border hover:border-cosmic'} ${
                !available ? 'opacity-40 line-through cursor-not-allowed' : 'squish'}`}>
                
                  {v.value}
                </button>);

          })}
          </div>
        </div>
      )}
    </div>);

}