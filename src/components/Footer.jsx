import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook } from 'lucide-react';
import Logo from '@/components/Logo';
import { useLanguage } from '@/context/LanguageContext';
import { useSiteContent } from '@/context/SiteContentContext';

function DesktopFooter({ t, settings }) {
  return (
    <footer className="hidden md:block mt-24 bg-cosmic text-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
        <div className="grid md:grid-cols-12 gap-6 items-start">
          {/* Brand */}
          <div className="md:col-span-4 rounded mx-10">
            <Link to="/" className="inline-flex items-center">
              <Logo className="h-28 md:h-36 w-auto" />
            </Link>
          </div>

          {/* Shop links */}
          <div className="md:col-span-2">
            <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-white/50">{t('footer.shop')}</h4>
            <ul className="mt-1.5 space-y-1 text-sm text-white/70">
              <li><Link to="/shop" className="hover:text-white">{t('footer.allToys')}</Link></li>
              <li><a href="/#categories" className="hover:text-white">{t('footer.worlds')}</a></li>
              
            </ul>
          </div>

          {/* Company links */}
          <div className="md:col-span-2">
            <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-white/50">{t('footer.company')}</h4>
            <ul className="mt-1.5 space-y-1 text-sm text-white/70">
              <li><Link to="/about" className="hover:text-white">{t('footer.about')}</Link></li>
              <li><Link to="/faq" className="hover:text-white">{t('footer.faq')}</Link></li>
              <li><Link to="/contact" className="hover:text-white">{t('footer.contact')}</Link></li>
            </ul>
          </div>

          {/* Social */}
          <div className="md:col-span-4 md:text-end">
            <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-white/50">{t('footer.follow')}</h4>
            <div className="mt-1.5 flex md:justify-end gap-2">
              <a href={settings.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="grid place-items-center w-10 h-10 rounded-full bg-white/10 hover:bg-white hover:text-cosmic transition-colors"><Instagram className="w-5 h-5" /></a>
              <a href={settings.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="grid place-items-center w-10 h-10 rounded-full bg-white/10 hover:bg-white hover:text-cosmic transition-colors"><Facebook className="w-5 h-5" /></a>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/50">
          <p>© {new Date().getFullYear()} {t('footer.rights')}</p>
          <div className="flex gap-5">
            <Link to="/privacy" className="hover:text-white">{t('footer.privacy')}</Link>
            <Link to="/terms" className="hover:text-white">{t('footer.terms')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

const MOBILE_LINK_CLASS =
  'block py-1 text-sm text-white/75 hover:text-white transition-colors';

function MobileFooter({ t, settings }) {
  const sections = [
    {
      title: t('footer.shop'),
      links: [
        { label: t('footer.products'), to: '/shop' },
        { label: t('footer.categories'), to: '/#categories' },
        { label: t('footer.offers'), to: '/shop' },
        { label: t('footer.wishlist'), to: '/wishlist' },
      ],
    },
    {
      title: t('footer.help'),
      links: [
        { label: t('footer.contact'), to: '/contact' },
        { label: t('footer.faq'), to: '/faq' },
        { label: t('footer.shipping'), to: '/faq' },
        { label: t('footer.returns'), to: '/faq' },
      ],
    },
    {
      title: t('footer.aboutStore'),
      links: [
        { label: t('footer.about'), to: '/about' },
        { label: t('footer.whyUs'), to: '/about' },
      ],
    },
    {
      title: t('footer.legal'),
      links: [
        { label: t('footer.privacy'), to: '/privacy' },
        { label: t('footer.terms'), to: '/terms' },
      ],
    },
  ];

  return (
    <footer className="md:hidden bg-cosmic text-white">
      <div className="max-w-7xl mx-auto px-5 py-10 space-y-8">
        {/* Brand + social */}
        <div className="flex items-start justify-between gap-4">
          <Link to="/" className="inline-flex items-center shrink-0">
            <Logo className="h-20 w-auto" />
          </Link>
          <div className="flex gap-2 mt-1">
            <a href={settings.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="grid place-items-center w-10 h-10 rounded-full bg-white/10 hover:bg-white hover:text-cosmic transition-colors"><Instagram className="w-5 h-5" /></a>
            <a href={settings.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="grid place-items-center w-10 h-10 rounded-full bg-white/10 hover:bg-white hover:text-cosmic transition-colors"><Facebook className="w-5 h-5" /></a>
          </div>
        </div>

        {/* Link sections — two-column grid for compact scanning */}
        <div className="grid grid-cols-2 gap-x-5 gap-y-7">
          {sections.map((s) => (
            <div key={s.title}>
              <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-white/50">{s.title}</h4>
              <ul className="mt-2 space-y-0.5">
                {s.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className={MOBILE_LINK_CLASS}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-5 border-t border-white/15 flex flex-col gap-3 text-xs text-white/50">
          <p>© {new Date().getFullYear()} {t('footer.rights')}</p>
          <div className="flex gap-5">
            <Link to="/privacy" className="hover:text-white">{t('footer.privacy')}</Link>
            <Link to="/terms" className="hover:text-white">{t('footer.terms')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Footer() {
  const { t } = useLanguage();
  const { settings } = useSiteContent();
  return (
    <>
      <DesktopFooter t={t} settings={settings} />
      <MobileFooter t={t} settings={settings} />
    </>
  );
}