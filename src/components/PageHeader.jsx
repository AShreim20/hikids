import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Logo from '@/components/Logo';
import { useLanguage } from '@/context/LanguageContext';

// Desktop: standard brand navbar. Mobile: native-style back bar with a
// translated screen title and a back button (history-aware) + home logo.
export default function PageHeader({ title }) {
  const navigate = useNavigate();
  const { t } = useLanguage();

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
        <div className="flex items-center gap-2 h-14 px-3">
          <button
            onClick={handleBack}
            className="squish grid place-items-center w-10 h-10 rounded-full bg-mist text-foreground shrink-0"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
          </button>
          <h1 className="flex-1 text-center font-heading font-bold text-base truncate px-1">{title}</h1>
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