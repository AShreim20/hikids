import React from 'react';
import { useLanguage } from '@/context/LanguageContext';

export default function CitySelect({ cities, value, onChange }) {
  const { t, formatPrice } = useLanguage();
  const selected = cities.find((c) => c.id === value);
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground/80">
        {t('checkout.city')}<span className="text-accent"> *</span>
      </span>
      <select
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
      >
        <option value="">{t('checkout.selectCity')}</option>
        {cities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} — {formatPrice(c.price)}
          </option>
        ))}
      </select>
      {selected && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t('checkout.eta')}: {selected.estimated_days} {t('common.days')}
        </p>
      )}
    </label>
  );
}