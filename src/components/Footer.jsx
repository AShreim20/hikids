import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook } from 'lucide-react';
import Logo from '@/components/Logo';
import { useLanguage } from '@/context/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="hidden md:block mt-24 bg-cosmic text-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 md:py-12">
        <div className="grid md:grid-cols-12 gap-8 items-start">
          {/* Brand */}
          <div className="md:col-span-4">
            <Link to="/" className="inline-flex items-center">
              <Logo className="h-16 md:h-20 w-auto" />
            </Link>
            <p className="mt-3 text-white/60 text-sm max-w-xs leading-snug">{t('footer.tagline')}</p>
          </div>

          {/* Shop links */}
          <div className="md:col-span-2">
            <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-white/50">{t('footer.shop')}</h4>
            <ul className="mt-2 space-y-1.5 text-sm text-white/70">
              <li><Link to="/shop" className="hover:text-white">{t('footer.allToys')}</Link></li>
              <li><a href="/#categories" className="hover:text-white">{t('footer.worlds')}</a></li>
              <li><a href="/#promise" className="hover:text-white">{t('footer.promise')}</a></li>
            </ul>
          </div>

          {/* Company links */}
          <div className="md:col-span-2">
            <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-white/50">{t('footer.company')}</h4>
            <ul className="mt-2 space-y-1.5 text-sm text-white/70">
              <li><Link to="/about" className="hover:text-white">{t('footer.about')}</Link></li>
              <li><Link to="/faq" className="hover:text-white">{t('footer.faq')}</Link></li>
              <li><Link to="/contact" className="hover:text-white">{t('footer.contact')}</Link></li>
            </ul>
          </div>

          {/* Social */}
          <div className="md:col-span-4 md:text-end">
            <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-white/50">{t('footer.follow')}</h4>
            <div className="mt-2 flex md:justify-end gap-2">
              <a href="https://www.instagram.com/hi_kids.ps/?hl=en" aria-label="Instagram" className="grid place-items-center w-10 h-10 rounded-full bg-white/10 hover:bg-white hover:text-cosmic transition-colors"><Instagram className="w-5 h-5" /></a>
              <a href="https://www.facebook.com/share/gBAGEMdhAwMobxRD/?mibextid=qi2Omg" aria-label="Facebook" className="grid place-items-center w-10 h-10 rounded-full bg-white/10 hover:bg-white hover:text-cosmic transition-colors"><Facebook className="w-5 h-5" /></a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-5 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/50">
          <p>© {new Date().getFullYear()} {t('footer.rights')}</p>
          <div className="flex gap-5">
            <a href="#" className="hover:text-white">{t('footer.privacy')}</a>
            <a href="#" className="hover:text-white">{t('footer.terms')}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}