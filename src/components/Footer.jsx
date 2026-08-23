import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, Twitter } from 'lucide-react';
import Logo from '@/components/Logo';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';

export default function Footer() {
  const { t } = useLanguage();
  const { user } = useAuth();
  return (
    <footer className="hidden md:block mt-32 bg-cosmic text-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 md:py-20">
        <div className="grid md:grid-cols-4 gap-10">
          <div>
            <Link to="/" className="inline-block">
              <div className="rounded-2xl bg-white p-1.5 shadow-lg inline-block">
                <Logo className="h-12 w-auto" />
              </div>
            </Link>
            <p className="mt-4 text-white/60 text-sm max-w-xs">{t('footer.tagline')}</p>
          </div>
          <div>
            <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-white/50">{t('footer.shop')}</h4>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              <li><a href="/#explore" className="hover:text-white">{t('footer.allToys')}</a></li>
              <li><a href="/#categories" className="hover:text-white">{t('footer.worlds')}</a></li>
              <li><a href="/#promise" className="hover:text-white">{t('footer.promise')}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-white/50">{t('footer.company')}</h4>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              <li><Link to="/about" className="hover:text-white">{t('footer.about')}</Link></li>
              <li><Link to="/faq" className="hover:text-white">{t('footer.faq')}</Link></li>
              {user?.role === 'admin' && (
                <li><Link to="/track-order" className="hover:text-white">{t('footer.track')}</Link></li>
              )}
            </ul>
          </div>
          <div>
            <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-white/50">{t('footer.follow')}</h4>
            <div className="mt-4 flex gap-3">
              <a href="https://www.instagram.com/hi_kids.ps/?hl=en" aria-label="Instagram" className="grid place-items-center w-11 h-11 rounded-full bg-white/10 hover:bg-white hover:text-cosmic transition-colors"><Instagram className="w-5 h-5" /></a>
              <a href="https://www.facebook.com/share/gBAGEMdhAwMobxRD/?mibextid=qi2Omg" aria-label="Facebook" className="grid place-items-center w-11 h-11 rounded-full bg-white/10 hover:bg-white hover:text-cosmic transition-colors"><Facebook className="w-5 h-5" /></a>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/50">
          <p>© {new Date().getFullYear()} {t('footer.rights')}</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white">{t('footer.privacy')}</a>
            <a href="#" className="hover:text-white">{t('footer.terms')}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}