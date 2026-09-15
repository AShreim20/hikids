import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Check, ChevronDown } from 'lucide-react';
import { db } from '@/api/entities';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { COUNTRY_CODES, dialFor } from '@/components/checkout/CountryCodeSelect';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Compact HiKids newsletter/offers signup. Subscribing needs email OR phone
// (or both) — never both required — and actually persists to
// `newsletter_subscribers` via db.NewsletterSubscriber (see
// src/api/entities/index.js): public INSERT only, no read access, duplicate
// email/phone rejected by a DB unique index rather than a client-side list
// lookup. Reuses the same country-code data Checkout already uses
// (COUNTRY_CODES/dialFor) instead of a second phone component.
export default function Newsletter() {
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('ps');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedEmail = email.trim();
    const phoneDigits = phone.replace(/\D/g, '');

    if (!trimmedEmail && !phoneDigits) {
      toast({ title: t('nl.validationRequired'), variant: 'destructive' });
      return;
    }
    if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
      toast({ title: t('nl.invalidEmail'), variant: 'destructive' });
      return;
    }
    if (phoneDigits && phoneDigits.length < 7) {
      toast({ title: t('nl.invalidPhone'), variant: 'destructive' });
      return;
    }

    const fullPhone = phoneDigits ? `${dialFor(phoneCountry)} ${phone.trim()}`.trim() : null;

    setSubmitting(true);
    try {
      await db.NewsletterSubscriber.create(
        { email: trimmedEmail || null, phone: fullPhone },
        { returning: false }
      );
      toast({ title: t('nl.successTitle'), description: t('nl.successDesc') });
      setEmail('');
      setPhone('');
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      if (err?.code === '23505') {
        toast({ title: t('nl.alreadySubscribed') });
      } else {
        toast({ title: t('nl.errorGeneric'), variant: 'destructive' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-5 sm:px-8 py-6 md:py-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cosmic to-cosmic/85 px-5 sm:px-8 py-6 md:py-7">
        {/* Subtle decorative shapes — same restrained recipe as the World of
            Play fallback cards (blurred circles + tiny dot "stars"), kept
            fully static so the form stays the visual focus. */}
        <div aria-hidden className="absolute -top-8 -start-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="absolute -bottom-6 end-10 w-28 h-28 rounded-full bg-accent/25 blur-xl" />
        <div aria-hidden className="absolute top-5 end-16 w-2 h-2 rounded-full bg-white/60" />
        <div aria-hidden className="absolute bottom-7 start-16 w-1.5 h-1.5 rounded-full bg-white/50" />

        <div className="relative flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-10">
          <div className="text-center lg:text-start lg:flex-1">
            <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-white text-balance">
              {t('nl.title')}
            </h2>
            <p className="mt-1 text-sm text-white/80">{t('nl.subtitle')}</p>
          </div>

          <form onSubmit={submit} className="lg:flex-1 lg:max-w-xl w-full">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="flex-1 min-w-0">
                <label htmlFor="nl-email" className="sr-only">{t('nl.emailPlaceholder')}</label>
                <input
                  id="nl-email"
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('nl.emailPlaceholder')}
                  className="h-12 w-full rounded-full bg-white/95 px-5 text-sm text-cosmic caret-cosmic placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-white/70 [&:-webkit-autofill]:[-webkit-text-fill-color:hsl(var(--cosmic))] [&:-webkit-autofill]:caret-cosmic"
                />
              </div>

              {/* One unified pill — country code + number — always laid out
                  LTR internally (dir forced here, not just on the text
                  inputs) so the selector's side never flips under the
                  page's RTL direction. `flex-1` is deferred to `sm:` on
                  purpose: combined with `overflow-hidden`, an unconditional
                  `flex-1` (flex-basis:0) collapses this item's automatic
                  minimum height to 0 per the flexbox spec, so on mobile
                  (inside the flex-col row) it rendered shorter than Email
                  despite `h-12` — a real bug, not just a visual nudge. Below
                  `sm:`, plain block stretch inside the column already gives
                  it the full width `h-12` asks for. */}
              <div
                dir="ltr"
                className="w-full sm:flex-1 min-w-0 flex items-center h-12 rounded-full bg-white/95 focus-within:ring-2 focus-within:ring-white/70 overflow-hidden"
              >
                <label htmlFor="nl-country" className="sr-only">{ar ? 'رمز الدولة' : 'Country code'}</label>
                <div className="relative h-full shrink-0 min-w-[92px]">
                  {/* This pill's background is always light (bg-white/95),
                      regardless of the site's own dark/light theme, so its
                      text must be a fixed dark color rather than the
                      theme-flipping `text-foreground` token (near-white in
                      the site's default dark theme — unreadable here). Reuse
                      `text-cosmic`, the same token the Subscribe button below
                      already uses for dark text on this exact white
                      background. `<option>` gets it too, since native
                      selects otherwise inherit the (broken) select color for
                      the closed value and the open dropdown list alike. */}
                  <select
                    id="nl-country"
                    value={phoneCountry}
                    onChange={(e) => setPhoneCountry(e.target.value)}
                    className="peer h-full w-full appearance-none bg-transparent ps-4 pe-6 text-sm text-cosmic focus:outline-none cursor-pointer"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code} className="bg-white text-cosmic">{c.flag} {c.dial}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute end-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/50" aria-hidden="true" />
                </div>
                <span aria-hidden="true" className="w-px h-6 shrink-0 bg-border" />
                <label htmlFor="nl-phone" className="sr-only">{t('nl.phonePlaceholder')}</label>
                <input
                  id="nl-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('nl.phonePlaceholder')}
                  className="flex-1 min-w-0 h-full bg-transparent px-3 text-sm text-cosmic caret-cosmic placeholder:text-muted-foreground focus:outline-none [&:-webkit-autofill]:[-webkit-text-fill-color:hsl(var(--cosmic))] [&:-webkit-autofill]:caret-cosmic"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="squish h-12 px-7 rounded-full bg-white text-cosmic font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-70 shrink-0"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : done ? (
                  <Check className="w-4 h-4" />
                ) : null}
                {submitting ? t('nl.subscribing') : t('nl.subscribe')}
              </button>
            </div>

            <p className="mt-2.5 px-2 sm:px-0 text-xs leading-relaxed text-white/70 text-center lg:text-start">
              {t('nl.privacyNote')}{' '}
              <span className="whitespace-nowrap">· <Link to="/privacy" className="underline hover:text-white">{t('footer.privacy')}</Link></span>
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
