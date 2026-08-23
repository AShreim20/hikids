import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Loader2, TrendingUp, Gift, ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { REDEEM_RATE } from '@/lib/loyalty';

export default function MyLoyalty() {
  const { t, formatPrice } = useLanguage();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    base44.functions.invoke('getLoyaltyBalance')
      .then((res) => { if (res.success) setData(res); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

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

  const redeemValue = data ? Math.round(data.balance * (data.redeem_rate ?? REDEEM_RATE) * 100) / 100 : 0;

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 ltr:rotate-180 rtl:rotate-0" /> {t('pd.back')}
        </Link>
        <h1 className="mt-6 font-heading font-extrabold text-4xl md:text-5xl">{t('loyalty.title')}</h1>
        <p className="mt-3 text-muted-foreground">{t('loyalty.subtitle')}</p>

        {loading ? (
          <div className="mt-10 grid place-items-center py-16"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : (
          <>
            <div className="mt-8 rounded-3xl bg-cosmic text-white p-8 relative overflow-hidden">
              <Sparkles className="absolute top-6 end-6 w-24 h-24 text-white/10" />
              <p className="text-sm uppercase tracking-widest text-white/60 font-medium">{t('loyalty.balance')}</p>
              <p className="mt-2 font-heading font-extrabold text-6xl">{data?.balance || 0}</p>
              <p className="mt-2 text-white/70">= {formatPrice(redeemValue)}</p>
            </div>

            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              <div className="rounded-3xl bg-card border border-border/60 p-6">
                <div className="grid place-items-center w-11 h-11 rounded-xl bg-accent/15 text-accent">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{t('loyalty.lifetime')}</p>
                <p className="font-heading font-extrabold text-2xl">{data?.lifetime_earned || 0}</p>
              </div>
              <div className="rounded-3xl bg-card border border-border/60 p-6">
                <div className="grid place-items-center w-11 h-11 rounded-xl bg-cosmic/15 text-cosmic">
                  <Gift className="w-5 h-5" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{t('loyalty.worth')}</p>
                <p className="font-heading font-extrabold text-2xl">{formatPrice(redeemValue)}</p>
              </div>
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