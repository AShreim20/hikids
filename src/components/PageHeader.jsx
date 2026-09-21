import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Logo from '@/components/Logo';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';

// Desktop: standard brand navbar. Mobile: native-style back bar with a
// translated screen title and a back button (history-aware) + home logo.
export default function PageHeader({ title }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const { count } = useCart();
  // Top-level pages (Home, Shop, Rewards, Account) have nothing to go back to.
  const isTopLevel = ['/', '/shop', '/wallet', '/account'].includes(pathname);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <>
      <div className="hidden md:block">
        <Navbar />
      </div>
      <header className="md:hidden sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/60 safe-top">
        <div className="flex items-center gap-2 h-14 px-4">
          {isTopLevel ? <span className="w-10 h-10 shrink-0" aria-hidden /> : <button
            onClick={handleBack}
            className="squish relative grid place-items-center w-10 h-10 rounded-full bg-mist text-foreground shrink-0 after:absolute after:-inset-2 after:content-['']"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
          </button>}
          <h1 className="flex-1 text-center font-heading font-bold text-base truncate px-1">{title}</h1>
          {pathname !== '/cart' && pathname !== '/checkout' && (
            <Link to="/cart" className="relative grid place-items-center w-10 h-10 rounded-full bg-mist shrink-0 after:absolute after:-inset-2 after:content-['']" aria-label={t('nav.cart')}>
              <ShoppingBag className="w-5 h-5" data-cart-anchor />
              {count > 0 && <span className="absolute -top-1 -end-1 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-accent text-white text-[11px] font-bold">{count}</span>}
            </Link>
          )}
          <Link
            to="/"
            className="grid place-items-center h-10 px-2.5 rounded-full bg-mist shrink-0"
            aria-label={t('nav.home')}
          >
            <Logo className="h-7 w-auto" />
          </Link>
        </div>
      </header>
    </>
  );
}