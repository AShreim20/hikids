import React, { useSyncExternalStore } from 'react';
import { MessageCircle } from 'lucide-react';
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
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`}
      target="_blank"
      rel="noreferrer"
      className="fixed z-50 bottom-20 md:bottom-6 start-20 md:start-24 grid place-items-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 squish my-16"
      aria-label="WhatsApp">
      
      <MessageCircle className="w-6 h-6" />
    </a>);

}