import React, { useState } from 'react';
import { Mail, Check } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { t } = useLanguage();

  const submit = (e) => {
    e.preventDefault();
    if (!email) return;
    setSent(true);
    setEmail('');
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <section className="max-w-7xl mx-auto px-5 sm:px-8 py-20 md:py-28">
      <div className="rounded-[2.5rem] bg-mist/60 border border-border/60 px-6 sm:px-12 py-14 md:py-20 text-center">
        <div className="mx-auto grid place-items-center w-14 h-14 rounded-2xl bg-card shadow-sm">
          <Mail className="w-7 h-7 text-cosmic" />
        </div>
        <h2 className="mt-6 font-heading font-extrabold text-3xl md:text-5xl text-balance">
          {t('nl.title')}
        </h2>
        <p className="mt-4 text-muted-foreground max-w-xl mx-auto text-lg">
          {t('nl.subtitle')}
        </p>
        <form onSubmit={submit} className="mt-8 max-w-md mx-auto flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="flex-1 h-14 px-6 rounded-full bg-card border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40"
          />
          <button
            type="submit"
            className="squish h-14 px-8 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 hover:bg-primary transition-colors"
          >
            {sent ? <><Check className="w-5 h-5" /> {t('nl.subscribed')}</> : t('nl.subscribe')}
          </button>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">{t('nl.spam')}</p>
      </div>
    </section>
  );
}