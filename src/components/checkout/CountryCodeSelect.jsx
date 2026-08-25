import React from 'react';
import { useLanguage } from '@/context/LanguageContext';

// Country calling-code selector for checkout. The customer picks a country
// (name + flag + dial code) separately from their local phone number; the
// checkout combines them into a single `+970 59XXXXXXX` value at submission.
export const COUNTRY_CODES = [
  { code: 'ps', name: 'Palestine', flag: '🇵🇸', dial: '+970' },
  { code: 'il', name: 'Israel', flag: '🇮🇱', dial: '+972' },
];

export const dialFor = (code) => (COUNTRY_CODES.find((c) => c.code === code) || COUNTRY_CODES[0]).dial;

export default function CountryCodeSelect({ value, onChange }) {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground/80">
        {ar ? 'رمز الدولة' : 'Country code'}<span className="text-accent"> *</span>
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full h-12 px-3 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
      >
        {COUNTRY_CODES.map((c) => (
          <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.dial})</option>
        ))}
      </select>
    </label>
  );
}