import React from 'react';
import { Wand2 } from 'lucide-react';
import { buildVariants, combinations } from '@/lib/variants';
import { useLanguage } from '@/context/LanguageContext';

// Editable table of every generated variant combination.
export default function VariantTable({ options, variants, onChange }) {
  const { t } = useLanguage();
  const optionNames = options.filter((o) => o.name).map((o) => o.name);
  const possible = combinations(options).length;

  const update = (i, patch) =>
    onChange(variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  return (
    <div className="rounded-3xl border border-border/60 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-heading font-bold">{t('variants.combosTitle')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {variants.length} / {possible} {t('variants.combos')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(buildVariants(options, variants))}
          className="squish inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-cosmic text-white font-heading font-bold text-sm"
        >
          <Wand2 className="w-4 h-4" /> {t('variants.generate')}
        </button>
      </div>

      {variants.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t('variants.noCombos')}</p>
      ) : (
        <>
        {/* Mobile / small tablet: one touch-friendly card per combination */}
        <div className="mt-4 grid gap-3 lg:hidden">
          {variants.map((v, i) => (
            <div key={v.key} className="rounded-2xl bg-mist/60 border border-border/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-heading font-bold text-sm">
                  {optionNames.map((n) => v.attributes?.[n]).filter(Boolean).join(' · ')}
                </p>
                <label className="flex items-center gap-2 text-xs shrink-0">
                  {t('variants.active')}
                  <input
                    type="checkbox"
                    checked={v.active !== false}
                    onChange={(e) => update(i, { active: e.target.checked })}
                    className="w-5 h-5 rounded accent-cosmic"
                  />
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label={t('variants.price')} type="number" value={v.price} onChange={(x) => update(i, { price: x })} />
                <Field label={t('variants.comparePrice')} type="number" value={v.compare_price} onChange={(x) => update(i, { compare_price: x })} />
                <Field label={t('variants.stock')} type="number" value={v.stock} onChange={(x) => update(i, { stock: x })} />
                <Field label={t('variants.weight')} type="number" value={v.weight} onChange={(x) => update(i, { weight: x })} />
                <Field label={t('variants.sku')} value={v.sku} onChange={(x) => update(i, { sku: x })} />
                <Field label={t('variants.barcode')} value={v.barcode} onChange={(x) => update(i, { barcode: x })} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto hidden lg:block">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                {optionNames.map((n) => (
                  <th key={n} className="text-start py-2 pe-3">{n}</th>
                ))}
                <th className="text-start py-2 pe-3">{t('variants.price')}</th>
                <th className="text-start py-2 pe-3">{t('variants.comparePrice')}</th>
                <th className="text-start py-2 pe-3">{t('variants.stock')}</th>
                <th className="text-start py-2 pe-3">{t('variants.sku')}</th>
                <th className="text-start py-2 pe-3">{t('variants.barcode')}</th>
                <th className="text-start py-2 pe-3">{t('variants.weight')}</th>
                <th className="text-start py-2">{t('variants.active')}</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => (
                <tr key={v.key} className="border-t border-border/60">
                  {optionNames.map((n) => (
                    <td key={n} className="py-2 pe-3 font-medium whitespace-nowrap">{v.attributes?.[n]}</td>
                  ))}
                  <td className="py-2 pe-3">
                    <Cell type="number" value={v.price} onChange={(x) => update(i, { price: x })} />
                  </td>
                  <td className="py-2 pe-3">
                    <Cell type="number" value={v.compare_price} onChange={(x) => update(i, { compare_price: x })} />
                  </td>
                  <td className="py-2 pe-3">
                    <Cell type="number" value={v.stock} onChange={(x) => update(i, { stock: x })} />
                  </td>
                  <td className="py-2 pe-3">
                    <Cell value={v.sku} onChange={(x) => update(i, { sku: x })} w="w-28" />
                  </td>
                  <td className="py-2 pe-3">
                    <Cell value={v.barcode} onChange={(x) => update(i, { barcode: x })} w="w-28" />
                  </td>
                  <td className="py-2 pe-3">
                    <Cell type="number" value={v.weight} onChange={(x) => update(i, { weight: x })} />
                  </td>
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={v.active !== false}
                      onChange={(e) => update(i, { active: e.target.checked })}
                      className="w-5 h-5 rounded accent-cosmic"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-12 px-3 rounded-xl bg-background border border-border text-sm"
      />
    </label>
  );
}

function Cell({ value, onChange, type = 'text', w = 'w-20' }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={`${w} h-10 px-2 rounded-xl bg-mist border border-border text-sm`}
    />
  );
}