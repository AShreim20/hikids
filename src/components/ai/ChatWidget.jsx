import React, { useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import AiAssistantIcon from '@/components/icons/AiAssistantIcon';
import ChatPanel from './ChatPanel';
import { useLanguage } from '@/context/LanguageContext';
import { useLocation } from 'react-router-dom';
import { subscribeChatOpen, getChatOpen, setChatOpen } from '@/lib/chatOpenStore';
import { useAuth } from '@/lib/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';

export default function ChatWidget() {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const open = useSyncExternalStore(subscribeChatOpen, getChatOpen);
  const { user } = useAuth();
  const isMobile = useIsMobile();
  if (pathname === '/checkout') return null;
  if (isMobile && user?.role === 'admin') return null;
  return (
    <>
      <button
        onClick={() => setChatOpen(!open)}
        title={t('ai.title')}
        aria-label={t('ai.title')}
        aria-expanded={open}
        className="fixed z-50 bottom-20 md:bottom-6 end-4 md:end-6 inline-flex items-center gap-2 h-14 w-14 md:w-auto md:px-5 justify-center rounded-full bg-cosmic text-white shadow-lg shadow-cosmic/30 squish focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cosmic/40 px-6 py-6">
        
        {open ? <X className="w-6 h-6 shrink-0" /> : <AiAssistantIcon className="w-6 h-6 shrink-0" />}
        <span className="hidden md:inline font-heading font-bold text-sm whitespace-nowrap">{t('ai.title')}</span>
      </button>
      {open && <ChatPanel onClose={() => setChatOpen(false)} />}
    </>);

}