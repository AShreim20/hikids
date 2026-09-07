import React, { useSyncExternalStore } from 'react';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { useLanguage } from '@/context/LanguageContext';
import { useLocation } from 'react-router-dom';
import { subscribeChatOpen, getChatOpen } from '@/lib/chatOpenStore';
import { useSiteContent } from '@/context/SiteContentContext';
import { WHATSAPP_NUMBER } from '@/lib/businessContact';
import { useAuth } from '@/lib/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFloatingOffset } from '@/hooks/useFloatingOffset';

const DEFAULT_MESSAGE = {
  en: "Hi HiKids! I have a question about your toys.",
  ar: "مرحبًا هاي كيدز! لدي سؤال عن ألعابكم."
};

// Compact circular floating button — same scale as the assistant button
// (see ChatWidget), stacked one slot above it via useFloatingOffset so the
// two never need independent hand-tuned positions. Hidden entirely while the
// assistant chat is open, to avoid two competing floating support actions at
// once; destination/message/link behavior is unchanged.
export default function WhatsAppButton() {
  const { lang } = useLanguage();
  const { settings } = useSiteContent();
  const { pathname } = useLocation();
  const chatOpen = useSyncExternalStore(subscribeChatOpen, getChatOpen);
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { bottom } = useFloatingOffset(1);
  if (pathname === '/checkout' || chatOpen) return null;
  if (isMobile && user?.role === 'admin') return null;
  const whatsapp = settings.whatsapp || WHATSAPP_NUMBER;
  const msg = encodeURIComponent(DEFAULT_MESSAGE[lang] || DEFAULT_MESSAGE.en);
  const label = lang === 'ar' ? 'دعم واتساب' : 'WhatsApp Support';
  return (
    <a
      href={`https://wa.me/${whatsapp}?text=${msg}`}
      target="_blank"
      rel="noreferrer"
      title={label}
      aria-label={label}
      style={{ bottom }}
      className="fixed z-50 end-4 md:end-6 grid place-items-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 squish hover:brightness-105 transition-[filter] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40"
    >
      <WhatsAppIcon className="w-6 h-6 shrink-0" />
    </a>
  );
}
