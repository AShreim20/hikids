import React, { useSyncExternalStore } from 'react';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { useLanguage } from '@/context/LanguageContext';
import { useLocation } from 'react-router-dom';
import { subscribeChatOpen, getChatOpen } from '@/lib/chatOpenStore';

// Replace with the store's WhatsApp number (international format, digits only, no +).
const WHATSAPP_NUMBER = '970599000000';
const DEFAULT_MESSAGE = {
  en: "Hi HiKids! I have a question about your toys.",
  ar: "مرحبًا هاي كيدز! لدي سؤال عن ألعابكم."
};

export default function WhatsAppButton() {
  const { lang } = useLanguage();
  const { pathname } = useLocation();
  const chatOpen = useSyncExternalStore(subscribeChatOpen, getChatOpen);
  if (pathname === '/checkout' || chatOpen) return null;
  const msg = encodeURIComponent(DEFAULT_MESSAGE[lang] || DEFAULT_MESSAGE.en);
  const label = lang === 'ar' ? 'دعم واتساب' : 'WhatsApp Support';
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`}
      target="_blank"
      rel="noreferrer"
      title={label}
      aria-label={label}
      className="fixed z-50 bottom-[9rem] md:bottom-24 start-4 md:start-6 inline-flex items-center gap-2 h-14 w-14 md:w-auto md:px-5 justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 squish focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40"
    >
      <WhatsAppIcon className="w-6 h-6 shrink-0" />
      <span className="hidden md:inline font-heading font-bold text-sm whitespace-nowrap">{label}</span>
    </a>
  );
}