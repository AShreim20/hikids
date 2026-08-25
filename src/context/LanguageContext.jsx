import React, { createContext, useContext, useEffect, useState } from 'react';
import { translations } from './translations';

// Preserve the context instance across Vite HMR updates. Without this, a
// hot-reload of this module creates a *new* context object while the already
// mounted <LanguageProvider> still references the old one — consumers then
// read null and throw "useLanguage must be used within LanguageProvider".
const LanguageContext = import.meta.hot?.data?.LanguageContext ?? createContext(null);
if (import.meta.hot) import.meta.hot.data.LanguageContext = LanguageContext;
const STORAGE_KEY = 'hikids-lang';

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    if (typeof window === 'undefined') return 'en';
    return localStorage.getItem(STORAGE_KEY) || 'en';
  });

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang, dir]);

  const t = (key) =>
    (translations[lang] && translations[lang][key]) || translations.en[key] || key;

  const formatPrice = (n) => {
    const value = Number(n || 0).toFixed(2);
    return lang === 'ar' ? `${value} ₪` : `₪${value}`;
  };

  const setLang = (l) => setLangState(l);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir, formatPrice }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}