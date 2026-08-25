import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useLanguage } from '@/context/LanguageContext';

// Shared "please sign in" gate for the customer gamification pages.
export default function RewardsAuthGate({ title }) {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={title} />
      <div className="max-w-md mx-auto px-5 py-24 text-center">
        <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-cosmic/10 text-cosmic">
          <Trophy className="w-8 h-8" />
        </div>
        <h1 className="mt-6 font-heading font-extrabold text-3xl">{t('rewards.loginTitle')}</h1>
        <p className="mt-3 text-muted-foreground">{t('rewards.loginDesc')}</p>
        <Link to="/login" className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">
          {t('nav.signIn')}
        </Link>
      </div>
    </div>
  );
}