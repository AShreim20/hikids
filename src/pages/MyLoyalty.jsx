import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Loader2, ArrowLeft, Gift, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WalletCard from '@/components/loyalty/WalletCard';
import WalletStats from '@/components/loyalty/WalletStats';
import TransactionList from '@/components/loyalty/TransactionList';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';

export default function MyLoyalty() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    base44.functions.invoke('getLoyaltyBalance', { limit: showAll ? 200 : 6 })
      .then((res) => { if (res.success) setData(res); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, showAll]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-accent/15 text-accent">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{t('loyalty.signInTitle')}</h1>
          <p className="mt-3 text-muted-foreground">{t('loyalty.signInDesc')}</p>
          <Link to="/login" className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">{t('loyalty.signIn')}</Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 ltr:rotate-180 rtl:rotate-0" /> {t('pd.back')}
        </Link>
        <h1 className="mt-6 font-heading font-extrabold text-4xl md:text-5xl">{t('wallet.title')}</h1>
        <p className="mt-3 text-muted-foreground">{t('loyalty.subtitle')}</p>

        {loading && !data ? (
          <div className="mt-10 grid place-items-center py-16"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : (
          <>
            {data?.status && data.status !== 'active' && (
              <div className="mt-8 rounded-2xl bg-destructive/10 border border-destructive/30 p-5 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-foreground/80">{t('wallet.frozenNotice')}</p>
              </div>
            )}
            <div className="mt-8"><WalletCard wallet={data} /></div>
            <div className="mt-4"><WalletStats wallet={data} /></div>

            <div className="mt-6 rounded-3xl bg-card border border-border/60 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-heading font-extrabold text-xl">{t('wallet.recent')}</h2>
                {loading && <Loader2 className="w-4 h-4 animate-spin text-cosmic" />}
              </div>
              <TransactionList transactions={data?.transactions || []} />
              {!showAll && (data?.transactions || []).length >= 6 && (
                <button onClick={() => setShowAll(true)} className="mt-3 squish h-11 px-5 rounded-full bg-mist font-heading font-bold text-sm">
                  {t('wallet.viewAll')}
                </button>
              )}
            </div>

            <div className="mt-6 rounded-3xl bg-card border border-border/60 p-6 md:p-8">
              <h3 className="font-heading font-extrabold text-xl">{t('loyalty.howTitle')}</h3>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3"><Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />{t('loyalty.how1')}</li>
                <li className="flex gap-3"><Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />{t('loyalty.how2')}</li>
                <li className="flex gap-3"><Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />{t('loyalty.how3')}</li>
              </ul>
              <Link to="/cart" className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-accent text-white font-heading font-bold squish">
                <Gift className="w-5 h-5" /> {t('loyalty.redeemCta')}
              </Link>
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}