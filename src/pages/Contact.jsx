import React from 'react';
import { Mail, Phone, Instagram, Facebook, MapPin, Clock } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { useSiteContent } from '@/context/SiteContentContext';

export default function Contact() {
  const { lang, t } = useLanguage();
  const ar = lang === 'ar';
  const { settings } = useSiteContent();

  const methods = [
    { icon: Mail, label: t('contact.emailLabel'), value: settings.email, href: `mailto:${settings.email}` },
    { icon: Phone, label: t('contact.whatsappLabel'), value: settings.phone, href: `https://wa.me/${settings.whatsapp}` },
    { icon: Instagram, label: 'Instagram', value: '@hi_kids.ps', href: settings.instagram },
    { icon: Facebook, label: 'Facebook', value: settings.storeName || 'HiKids', href: settings.facebook },
  ].filter((m) => m.href);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-12 md:py-20">
        <h1 className="font-heading font-extrabold text-4xl md:text-6xl tracking-tight text-balance">
          {t('contact.title')}
        </h1>
        <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-2xl">
          {t('contact.subtitle')}
        </p>

        <div className="mt-10 grid sm:grid-cols-2 gap-5">
          {methods.map((m) => (
            <a
              key={m.label}
              href={m.href}
              target={m.href.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
              className="flex items-center gap-4 rounded-3xl bg-card border border-border/60 p-5 hover:border-cosmic/40 transition-colors"
            >
              <span className="grid place-items-center w-12 h-12 rounded-2xl bg-cosmic/10 shrink-0">
                <m.icon className="w-6 h-6 text-cosmic" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-muted-foreground">{m.label}</span>
                <span className="block font-heading font-bold truncate">{m.value}</span>
              </span>
            </a>
          ))}
        </div>

        <div className="mt-10 grid sm:grid-cols-2 gap-5">
          <div className="rounded-3xl bg-mist/60 p-6">
            <MapPin className="w-6 h-6 text-cosmic" />
            <h2 className="mt-3 font-heading font-bold text-xl">{t('contact.addressTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed" dir={ar ? 'rtl' : 'ltr'}>
              {ar ? settings.addressAr : settings.addressEn}
            </p>
          </div>
          <div className="rounded-3xl bg-mist/60 p-6">
            <Clock className="w-6 h-6 text-cosmic" />
            <h2 className="mt-3 font-heading font-bold text-xl">{t('contact.hoursTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed" dir={ar ? 'rtl' : 'ltr'}>
              {ar ? settings.hoursAr : settings.hoursEn}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}