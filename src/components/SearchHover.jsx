import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function SearchHover() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Close when clicking outside the component.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const submit = (e) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    navigate(`/?search=${encodeURIComponent(term)}#explore`);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="hidden md:block">
      <form
        onSubmit={submit}
        role="search"
        className={`relative flex items-center h-11 rounded-full bg-mist transition-all duration-300 overflow-hidden ${
          open ? 'w-72' : 'w-11'
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`absolute grid place-items-center w-11 h-11 text-muted-foreground hover:text-foreground transition-all duration-300 ${
            open ? 'left-4 translate-x-0' : 'left-1/2 -translate-x-1/2'
          }`}
          aria-label={t('nav.search')}
          aria-expanded={open}
        >
          <Search className="w-5 h-5" />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('nav.search')}
          className={`w-full h-full pl-11 pr-4 text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none transition-opacity duration-200 ${
            open ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />
      </form>
    </div>
  );
}