import React, { useSyncExternalStore } from 'react';
import AiAssistantIcon from '@/components/icons/AiAssistantIcon';
import ChatPanel from './ChatPanel';
import { useLanguage } from '@/context/LanguageContext';
import { useLocation } from 'react-router-dom';
import { subscribeChatOpen, getChatOpen, setChatOpen } from '@/lib/chatOpenStore';
import { useAuth } from '@/lib/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFloatingOffset } from '@/hooks/useFloatingOffset';

// Compact circular floating button — icon-first at every breakpoint (no more
// permanent "مساعد هاي كيدز" text pill on desktop; the native `title`
// attribute is the desktop tooltip). While the chat is open the button is
// unmounted entirely rather than turning into an "×" — the panel's own
// header Close button is the only way to close it now (see ChatPanel).
export default function ChatWidget() {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const open = useSyncExternalStore(subscribeChatOpen, getChatOpen);
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { bottom } = useFloatingOffset(0);
  if (pathname === '/checkout') return null;
  if (isMobile && user?.role === 'admin') return null;
  return (
    <>
      {!open && (
        <button
          onClick={() => setChatOpen(true)}
          title={t('ai.title')}
          aria-label={t('ai.title')}
          style={{ bottom }}
          className="fixed z-50 end-4 md:end-6 grid place-items-center w-14 h-14 rounded-full bg-cosmic text-white shadow-lg shadow-cosmic/30 squish hover:bg-primary transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cosmic/40"
        >
          <AiAssistantIcon className="w-6 h-6 shrink-0" />
        </button>
      )}
      {open && <ChatPanel onClose={() => setChatOpen(false)} />}
    </>
  );
}
