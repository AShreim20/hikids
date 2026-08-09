import React, { createContext, useContext, useEffect, useState } from 'react';
import { translations } from './translations';

const LanguageContext = createContext(null);
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