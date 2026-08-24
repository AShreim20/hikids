import React, { useEffect, useRef, useState } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/context/LanguageContext';

export default function ChatPanel({ onClose }) {
  const { t, lang } = useLanguage();
  const [messages, setMessages] = useState([{ role: 'assistant', content: t('ai.greeting') }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    base44.entities.Product.list('-created_date', 50).
    then((products) => {
      const lines = products.
      map((p) => `${p.name} | ${p.category} | ages ${p.age_range || 'all'} | ₪${p.sale_price || p.price}${p.stock <= 0 ? ' (out of stock)' : p.featured ? ' (featured)' : ''}`).
      join('\n');
      setCatalog(lines);
    }).
    catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text) => {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const sys = `You are the HiKids toy store assistant. Help customers choose toys and answer questions about ages, categories, pricing, shipping, loyalty points, returns, and payment (card or cash on delivery). Be friendly, warm and concise. Reply in ${lang === 'ar' ? 'Arabic' : 'English'}. If asked about a specific order's status, tell them to use the Order Tracking page. Current product catalog (name | category | ages | price):\n${catalog || 'Loading catalog...'}`;
      const convo = next.map((m) => `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.content}`).join('\n');
      const res = await base44.integrations.Core.InvokeLLM({ prompt: `${sys}\n\n${convo}\nAssistant:` });
      const reply = typeof res === 'string' ? res : res?.output || JSON.stringify(res);
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: t('ai.error') }]);
    } finally {
      setBusy(false);
    }
  };

  const suggestions = [t('ai.sugg1'), t('ai.sugg2'), t('ai.sugg3')];

  return (
    <div className="fixed z-50 bottom-36 md:bottom-24 start-4 md:start-6 w-[calc(100vw-2rem)] max-w-sm h-[60vh] max-h-[32rem] rounded-3xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden float-in mx-16">
      <div className="flex items-center gap-3 px-4 py-3 bg-cosmic text-white">
        <Sparkles className="w-5 h-5" />
        <div>
          <p className="font-heading font-bold leading-none">{t('ai.title')}</p>
          <p className="text-xs text-white/70 mt-0.5">{t('ai.subtitle')}</p>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-3 bg-mist/40">
        {messages.map((m, i) =>
        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-cosmic text-white rounded-br-md' : 'bg-card border border-border rounded-bl-md'}`}>
              {m.content}
            </div>
          </div>
        )}
        {busy &&
        <div className="flex justify-start">
            <div className="px-4 py-2.5 rounded-2xl bg-card border border-border"><Loader2 className="w-4 h-4 animate-spin text-cosmic" /></div>
          </div>
        }
      </div>
      {messages.length <= 1 &&
      <div className="px-4 pb-2 flex flex-wrap gap-2">
          {suggestions.map((s) =>
        <button key={s} type="button" onClick={() => send(s)} className="text-xs px-3 py-1.5 rounded-full bg-mist border border-border hover:border-cosmic">{s}</button>
        )}
        </div>
      }
      <form onSubmit={(e) => {e.preventDefault();send(input);}} className="p-3 border-t border-border flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('ai.placeholder')} className="flex-1 h-11 px-4 rounded-full bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
        <button type="submit" disabled={busy} className="grid place-items-center w-11 h-11 rounded-full bg-cosmic text-white disabled:opacity-60"><Send className="w-4 h-4" /></button>
      </form>
    </div>);

}