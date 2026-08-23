import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';

const STATUS_KEY = {
  pending: 'track.s_pending',
  paid: 'track.s_paid',
  shipped: 'track.s_shipped',
  delivered: 'track.s_delivered',
  cancelled: 'track.s_cancelled',
};

const STATUS_COLOR = {
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  shipped: 'bg-cosmic/10 text-cosmic',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-destructive/10 text-destructive',
};

export default function MyOrders() {
  const { t, formatPrice, lang } = useLanguage();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    base44.entities.Order.list('-created_date', 50)
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={t('orders.title')} />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-mist">
            <Package className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{t('orders.title')}</h1>
          <p className="mt-3 text-muted-foreground">{t('orders.signIn')}</p>
          <Link to="/login" className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold squish">
            {t('settings.signIn')}
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={t('orders.title')} />
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-12">
        <h1 className="font-heading font-extrabold text-4xl md:text-5xl">{t('orders.title')}</h1>
        <p className="mt-3 text-muted-foreground">{t('orders.subtitle')}</p>

        {loading ? (
          <div className="mt-10 grid gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 rounded-3xl bg-mist animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-16 text-center">
            <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-mist">
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="mt-6 font-heading font-bold text-2xl">{t('orders.empty')}</p>
            <p className="mt-2 text-muted-foreground">{t('orders.emptyDesc')}</p>
            <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">
              {t('nav.explore')}
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-4">
            {orders.map((o) => (
              <div key={o.id} className="rounded-3xl bg-card border border-border/60 p-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('orders.orderNo')}</p>
                    <p className="font-heading font-bold">#{(o.id || '').slice(-8).toUpperCase()}</p>
                  </div>
                  <span className={`px-3 py-1.5 rounded-full text-xs font-heading font-bold ${STATUS_COLOR[o.status] || 'bg-mist text-muted-foreground'}`}>
                    {t(STATUS_KEY[o.status] || 'track.s_pending')}
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t('track.placed')} {new Date(o.created_date).toLocaleDateString(lang === 'ar' ? 'ar' : 'en')}
                </p>
                <div className="mt-4 pt-4 border-t border-border/60 space-y-2">
                  {(o.items || []).map((it, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{it.name} × {it.qty}</span>
                      <span className="font-heading font-bold">{formatPrice(it.price * it.qty)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-border/60 flex justify-between items-center">
                  <span className="font-heading font-bold">{t('common.total')}</span>
                  <span className="font-heading font-extrabold text-xl">{formatPrice(o.total)}</span>
                </div>
                {o.gift_message && (
                  <div className="mt-4 rounded-2xl bg-mist p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">{t('orders.giftMessage')}</p>
                    <p className="mt-1 text-sm italic">"{o.gift_message}"</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}