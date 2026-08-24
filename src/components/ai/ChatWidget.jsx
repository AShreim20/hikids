import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import ChatPanel from './ChatPanel';
import { useLanguage } from '@/context/LanguageContext';
import { useLocation } from 'react-router-dom';

export default function ChatWidget() {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  if (pathname === '/checkout') return null;
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed z-50 bottom-20 md:bottom-6 end-4 md:end-6 grid place-items-center w-14 h-14 rounded-full bg-cosmic text-white shadow-lg shadow-cosmic/30 squish"
        aria-label={t('ai.title')}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
      {open && <ChatPanel onClose={() => setOpen(false)} />}
    </>
  );
}