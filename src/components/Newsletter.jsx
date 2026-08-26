import React, { useState } from 'react';
import { Mail, Check, Phone } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { BUSINESS_PHONE, BUSINESS_PHONE_DISPLAY } from '@/lib/businessContact';

export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';

  const submit = (e) => {
    e.preventDefault();
    if (!email) return;
    setSent(true);
    setEmail('');
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <section className="max-w-7xl mx-auto px-5 sm:px-8 py-8 md:py-10">
      <div className="rounded-3xl bg-mist/60 border border-border/60 px-5 sm:px-8 py-6 md:py-8 text-center">
        <div className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-card shadow-sm">
          <Mail className="w-6 h-6 text-cosmic" />
        </div>
        <h2 className="mt-3 font-heading font-extrabold text-2xl md:text-3xl text-balance">
          {t('nl.title')}
        </h2>
        <p className="mt-2 text-muted-foreground max-w-xl mx-auto text-sm">
          {t('nl.subtitle')}
        </p>
        <form onSubmit={submit} className="mt-5 max-w-md mx-auto flex flex-col sm:flex-row gap-2.5">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="flex-1 h-12 w-full px-7 rounded-full bg-card border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40"
            style={{ paddingInline: '1.75rem' }} />
          
          <button
            type="submit"
            className="squish h-12 px-7 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 hover:bg-primary transition-colors">
            
            {sent ? <><Check className="w-5 h-5" /> {t('nl.subscribed')}</> : t('nl.subscribe')}
          </button>
        </form>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          
          

          
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t('nl.spam')}</p>
      </div>
    </section>);

}