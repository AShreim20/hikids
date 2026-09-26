import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook } from 'lucide-react';
import Logo from '@/components/Logo';
import { useLanguage } from '@/context/LanguageContext';
import { useSiteContent } from '@/context/SiteContentContext';

// Single source of truth for Footer link groups — used by both the desktop
// and mobile layouts below, so the two can never drift out of sync (the
// previous Footer had different/missing links between them). Every entry
// points at a real existing route; nothing here is a placeholder.
function footerSections(t) {
  return [
    {
      title: t('footer.shop'),
      links: [
        { label: t('footer.allToys'), to: '/shop' },
        { label: t('footer.worlds'), to: '/#categories' },
        { label: t('footer.wishlist'), to: '/wishlist' },
      ],
    },
    {
      // Shipping/returns removed — both already live inside the FAQ
      // experience itself (see FAQ.jsx), so the two links were a straight
      // duplicate of "الأسئلة الشائعة" pointing at the exact same /faq route.
      title: t('footer.help'),
      links: [
        { label: t('footer.faq'), to: '/faq' },
        { label: t('footer.contact'), to: '/contact' },
        { label: t('footer.trackOrder'), to: '/track-order' },
      ],
    },
    {
      // "لماذا نحن" removed — it pointed at the same /about route as "من
      // نحن" (About Us), a duplicate entry rather than a distinct page.
      title: t('footer.aboutStore'),
      links: [
        { label: t('footer.about'), to: '/about' },
        { label: t('footer.privacy'), to: '/privacy' },
        { label: t('footer.terms'), to: '/terms' },
      ],
    },
  ];
}

function SocialLinks({ settings, className = '' }) {
  return (
    <div className={`flex gap-2 ${className}`}>
      <a href={settings.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="grid place-items-center w-10 h-10 rounded-full bg-white/10 hover:bg-white hover:text-cosmic transition-colors">
        <Instagram className="w-5 h-5" />
      </a>
      <a href={settings.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="grid place-items-center w-10 h-10 rounded-full bg-white/10 hover:bg-white hover:text-cosmic transition-colors">
        <Facebook className="w-5 h-5" />
      </a>
    </div>
  );
}

function DesktopFooter({ t, settings, sections }) {
  return (
    <footer className="hidden md:block bg-cosmic text-white">
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-10">
        {/* Subtle, restrained HiKids decoration — same recipe used across the
            rest of the Homepage (blurred circles + tiny dot "stars"). */}
        <div aria-hidden className="absolute -top-6 -start-6 w-28 h-28 rounded-full bg-white/5 blur-2xl" />
        <div aria-hidden className="absolute bottom-0 end-16 w-24 h-24 rounded-full bg-accent/10 blur-xl" />

        <div className="relative grid grid-cols-4 gap-8">
          <div>
            <Link to="/" className="inline-flex items-center">
              <Logo className="h-24 w-auto" />
            </Link>
            <p className="mt-3 text-sm text-white/60 max-w-[22ch]">{t('footer.tagline')}</p>
            <SocialLinks settings={settings} className="mt-4" />
          </div>

          {sections.map((s) => (
            <div key={s.title}>
              <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-white/50">{s.title}</h4>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                {s.links.map((l) => (
                  <li key={l.label}><Link to={l.to} className="hover:text-white transition-colors">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="relative mt-8 pt-5 border-t border-white/15 flex items-center justify-between gap-3 text-xs text-white/50">
          <p>© {new Date().getFullYear()} {t('footer.rights')}</p>
        </div>
      </div>
    </footer>
  );
}

function MobileFooter({ t, settings, sections }) {
  return (
    <footer className="md:hidden bg-cosmic text-white">
      <div className="max-w-7xl mx-auto px-5 py-5 space-y-4">
        {/* Brand + social */}
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center shrink-0">
            <Logo className="h-12 w-auto" />
          </Link>
          <SocialLinks settings={settings} />
        </div>

        {/* Link sections — clean vertical stack, each fully visible (no
            content hidden or squeezed just because the screen is small). */}
        <div className="grid grid-cols-3 gap-3">
          {sections.map((s) => (
            <div key={s.title}>
              <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-white/50">{s.title}</h4>
              <ul className="mt-1.5 flex flex-col">
                {s.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="inline-block py-1.5 text-[13px] leading-snug text-white/75 hover:text-white transition-colors">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-white/15 text-xs text-white/50">
          <p>© {new Date().getFullYear()} {t('footer.rights')}</p>
        </div>
      </div>
    </footer>
  );
}

export default function Footer() {
  const { t } = useLanguage();
  const { settings } = useSiteContent();
  const sections = footerSections(t);
  return (
    <>
      <DesktopFooter t={t} settings={settings} sections={sections} />
      <MobileFooter t={t} settings={settings} sections={sections} />
    </>
  );
}
