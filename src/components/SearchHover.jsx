import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function SearchHover() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    navigate(`/?search=${encodeURIComponent(term)}#explore`);
  };

  return (
    <div className="hidden md:block group">
      <form
        onSubmit={submit}
        role="search"
        className="relative flex items-center h-11 rounded-full bg-mist transition-all duration-300 w-11 hover:w-72 focus-within:w-72 overflow-hidden"
      >
        <Search className="absolute left-1/2 -translate-x-1/2 group-hover:left-4 group-hover:translate-x-0 w-5 h-5 text-muted-foreground pointer-events-none transition-all duration-300" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('nav.search')}
          className="w-full h-full pl-11 pr-4 text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200"
        />
      </form>
    </div>
  );
}