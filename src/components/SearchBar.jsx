import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function SearchBar({ className = '', autoFocus = false, onSubmitted, collapsible = false }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    navigate(`/shop?search=${encodeURIComponent(term)}`);
    onSubmitted?.();
  };

  return (
    <form
      onSubmit={submit}
      className={`relative ${
        collapsible
          ? 'rounded-2xl bg-mist group-hover:bg-transparent group-focus-within:bg-transparent transition-colors'
          : ''
      } ${className}`}
      role="search"
    >
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('nav.search')}
        className={`w-full h-11 pl-11 pr-4 rounded-full bg-mist text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-cosmic/40 ${
          collapsible ? 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300' : ''
        }`}
      />
    </form>
  );
}