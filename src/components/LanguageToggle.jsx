import React from 'react';
import { useLanguage } from '@/context/LanguageContext';

export default function LanguageToggle({ className = '' }) {
  const { lang, setLang } = useLanguage();
  const next = lang === 'en' ? 'ar' : 'en';
  return (
    <button
      onClick={() => setLang(next)}
      className={`grid place-items-center h-11 px-3 rounded-2xl bg-mist text-foreground hover:bg-accent hover:text-white transition-colors ${className}`}
      aria-label="Toggle language"
      title={lang === 'en' ? 'العربية' : 'English'}
    >
      <span className="text-xs font-heading font-bold tracking-wide">
        {lang === 'en' ? 'AR' : 'EN'}
      </span>
    </button>
  );
}