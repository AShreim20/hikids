import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';

export default function SavedAddressPicker({ addresses, value, onChange }) {
  const { t } = useLanguage();
  if (!addresses || addresses.length === 0) return null;
  return (
    <div>
      <span className="text-sm font-medium text-foreground/80">{t('checkout.savedAddress')}</span>
      <div className="mt-1.5 flex items-center gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
        >
          <option value="">{t('checkout.useSaved')}</option>
          {addresses.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label ? `${a.label} — ` : ''}{a.city}, {a.street}
            </option>
          ))}
        </select>
        <Link
          to="/addresses"
          className="h-12 px-4 shrink-0 rounded-2xl bg-mist border border-border text-xs font-heading font-bold text-cosmic inline-flex items-center"
        >
          {t('checkout.manage')}
        </Link>
      </div>
    </div>
  );
}