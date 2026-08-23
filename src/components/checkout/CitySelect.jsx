import React from 'react';
import SheetSelect from '@/components/ui/SheetSelect';
import { useLanguage } from '@/context/LanguageContext';

export default function CitySelect({ cities, value, onChange }) {
  const { t, formatPrice } = useLanguage();
  const selected = cities.find((c) => c.id === value);
  return (
    <div>
      <label className="block">
        <span className="text-sm font-medium text-foreground/80">
          {t('checkout.city')}<span className="text-accent"> *</span>
        </span>
        <SheetSelect
          value={value}
          onChange={onChange}
          placeholder={t('checkout.selectCity')}
          label={t('checkout.city')}
          required
          className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
          options={cities.map((c) => ({ value: c.id, label: `${c.name} — ${formatPrice(c.price)}` }))}
        />
      </label>
      {selected && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t('checkout.eta')}: {selected.estimated_days} {t('common.days')}
        </p>
      )}
    </div>
  );
}