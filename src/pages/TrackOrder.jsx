import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Package, CreditCard, Truck, CheckCircle, XCircle, ArrowRight, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';

export default function TrackOrder() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [orderNo, setOrderNo] = useState('');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{t('admin.denied')}</h1>
          <p className="mt-3 text-muted-foreground">{t('admin.deniedDesc')}</p>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">
            {t('pd.back')}
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const track = async (e) => {
    e.preventDefault();
    if (!orderNo.trim()) return;
    setLoading(true);
    setError(false);
    setOrder(null);
    try {
      const res = await base44.entities.Order.get(orderNo.trim());
      setOrder(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { key: 'pending', icon: Package, label: t('track.s_pending'), desc: t('track.s_pending_d') },
    { key: 'paid', icon: CreditCard, label: t('track.s_paid'), desc: t('track.s_paid_d') },
    { key: 'shipped', icon: Truck, label: t('track.s_shipped'), desc: t('track.s_shipped_d') },
    { key: 'delivered', icon: CheckCircle, label: t('track.s_delivered'), desc: t('track.s_delivered_d') },
  ];

  const orderKey = order?.status || 'pending';
  const cancelled = orderKey === 'cancelled';
  const currentIndex = steps.findIndex((s) => s.key === orderKey);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-12 md:pt-20 pb-10 text-center">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-mist text-foreground/70 text-xs font-medium tracking-wider uppercase">
          <Package className="w-3.5 h-3.5 text-accent" /> {t('track.subtitle')}
        </span>
        <h1 className="mt-6 font-heading font-extrabold text-5xl md:text-6xl leading-[1.05] tracking-tight text-balance">
          {t('track.title')}
        </h1>
      </section>

      <section className="max-w-2xl mx-auto px-5 sm:px-8 pb-24">
        <form onSubmit={track} className="rounded-3xl bg-card border border-border/60 p-6 md:p-8">
          <label className="block text-sm font-medium text-foreground/80">{t('track.label')}</label>
          <div className="mt-3 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute top-1/2 -translate-y-1/2 ltr:left-4 rtl:right-4 w-5 h-5 text-muted-foreground" />
              <input
                value={orderNo}
                onChange={(e) => setOrderNo(e.target.value)}
                placeholder={t('track.placeholder')}
                className="w-full h-14 ltr:pl-12 ltr:pr-4 rtl:pr-12 rtl:pl-4 rounded-2xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="squish h-14 px-8 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 hover:bg-primary transition-colors disabled:opacity-60"
            >
              {loading ? t('track.tracking') : t('track.button')}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-6 rounded-3xl bg-destructive/10 border border-destructive/30 p-6 text-center">
            <p className="font-heading font-bold text-destructive">{t('track.notFound')}</p>
          </div>
        )}

        {order && (
          <div className="mt-6 rounded-3xl bg-card border border-border/60 p-6 md:p-8">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t('track.orderNo')}
                </p>
                <p className="font-heading font-bold text-lg">
                  #{(order.id || '').slice(0, 8).toUpperCase()}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('track.placed')} {new Date(order.created_date).toLocaleDateString()}
              </p>
            </div>

            {cancelled ? (
              <div className="mt-6 rounded-2xl bg-destructive/10 p-5 flex items-center gap-3">
                <XCircle className="w-6 h-6 text-destructive" />
                <div>
                  <p className="font-heading font-bold text-destructive">{t('track.s_cancelled')}</p>
                  <p className="text-sm text-muted-foreground">{t('track.s_cancelled_d')}</p>
                </div>
              </div>
            ) : (
              <div className="mt-8 space-y-5">
                {steps.map((s, i) => {
                  const done = i <= currentIndex;
                  const active = i === currentIndex;
                  return (
                    <div key={s.key} className="flex items-start gap-4">
                      <div
                        className={`grid place-items-center w-11 h-11 rounded-full shrink-0 transition-colors ${
                          done ? 'bg-cosmic text-white' : 'bg-mist text-muted-foreground'
                        } ${active ? 'ring-4 ring-cosmic/20' : ''}`}
                      >
                        <s.icon className="w-5 h-5" />
                      </div>
                      <div className="pt-1.5">
                        <p className={`font-heading font-bold ${done ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {s.label}
                        </p>
                        <p className="text-sm text-muted-foreground">{s.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowRight className="w-4 h-4 ltr:rotate-180 rtl:rotate-0" /> {t('pd.back')}
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}