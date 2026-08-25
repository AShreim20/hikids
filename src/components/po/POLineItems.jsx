import React from 'react';
import { Trash2 } from 'lucide-react';
import { lineTotal } from '@/lib/po';
import { useLanguage } from '@/context/LanguageContext';

// Editable list of purchase line items. Each line: SKU, name, qty, unit cost,
// line total, remove. Mobile renders one card per line for touch targets.
export default function POLineItems({ items, onChange, readOnly }) {
  const { lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';

  const update = (i, patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const remove = (i) => onChange(items.filter((_, j) => j !== i));

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{ar ? 'أضف منتجات عبر البحث أعلاه.' : 'Add products using the search above.'}</p>;
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="grid gap-3 lg:hidden">
        {items.map((it, i) => (
          <div key={i} className="rounded-2xl bg-mist/60 border border-border/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-heading font-bold text-sm truncate">{it.name}</p>
                <p className="text-xs text-muted-foreground">{it.sku ? `#${it.sku}` : '\u00A0'}</p>
              </div>
              {!readOnly && (
                <button type="button" onClick={() => remove(i)} className="squish grid place-items-center w-9 h-9 rounded-full bg-destructive/10 text-destructive shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <NumField label={ar ? 'الكمية' : 'Qty'} value={it.quantity} readOnly={readOnly} onChange={(x) => update(i, { quantity: x, total: lineTotal({ ...it, quantity: x }) })} />
              <NumField label={ar ? 'تكلفة الوحدة' : 'Unit cost'} value={it.unit_cost} readOnly={readOnly} onChange={(x) => update(i, { unit_cost: x, total: lineTotal({ ...it, unit_cost: x }) })} />
              <div>
                <span className="text-xs text-muted-foreground">{ar ? 'الإجمالي' : 'Total'}</span>
                <p className="mt-1 font-heading font-extrabold text-cosmic">{formatPrice(lineTotal(it))}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted-foreground">
              <th className="text-start py-2 pe-3">{ar ? 'الكود' : 'SKU'}</th>
              <th className="text-start py-2 pe-3">{ar ? 'المنتج' : 'Product'}</th>
              <th className="text-start py-2 pe-3">{ar ? 'الكمية' : 'Qty'}</th>
              <th className="text-start py-2 pe-3">{ar ? 'تكلفة الوحدة' : 'Unit cost'}</th>
              <th className="text-start py-2 pe-3">{ar ? 'الإجمالي' : 'Total'}</th>
              {!readOnly && <th className="py-2" />}
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-t border-border/60">
                <td className="py-2 pe-3 text-muted-foreground whitespace-nowrap">{it.sku ? `#${it.sku}` : '—'}</td>
                <td className="py-2 pe-3 font-medium">{it.name}</td>
                <td className="py-2 pe-3">
                  <Cell readOnly={readOnly} value={it.quantity} onChange={(x) => update(i, { quantity: x, total: lineTotal({ ...it, quantity: x }) })} />
                </td>
                <td className="py-2 pe-3">
                  <Cell readOnly={readOnly} value={it.unit_cost} onChange={(x) => update(i, { unit_cost: x, total: lineTotal({ ...it, unit_cost: x }) })} />
                </td>
                <td className="py-2 pe-3 font-heading font-extrabold text-cosmic whitespace-nowrap">{formatPrice(lineTotal(it))}</td>
                {!readOnly && (
                  <td className="py-2">
                    <button type="button" onClick={() => remove(i)} className="squish grid place-items-center w-9 h-9 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function NumField({ label, value, onChange, readOnly }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        readOnly={readOnly}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-11 px-3 rounded-xl bg-background border border-border text-sm"
      />
    </label>
  );
}

function Cell({ value, onChange, readOnly }) {
  return (
    <input
      type="number"
      readOnly={readOnly}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-24 h-10 px-2 rounded-xl bg-mist border border-border text-sm"
    />
  );
}