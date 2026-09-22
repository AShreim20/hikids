import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Package, MapPin, CreditCard, Lock } from 'lucide-react';
import { db } from '@/api/entities';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import OrderTimeline from '@/components/orders/OrderTimeline';
import OrderReturnsList from '@/components/orders/OrderReturnsList';
import InvoiceButton from '@/components/orders/OrderInvoice';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { statusLabel, statusColor, orderRef, orderTotals } from '@/lib/orderStatus';
import { lineItemName } from '@/lib/bilingual';
import { Image } from '@/components/ui/image';
import { getReturnEligibility, formatTimeRemaining } from '@/lib/returns';

const PAYMENT_LABEL = {
  card: { ar: 'بطاقة', en: 'Card' },
  cod: { ar: 'الدفع عند الاستلام', en: 'Cash on delivery' },
  loyalty: { ar: 'نقاط الولاء', en: 'Loyalty points' },
};

// Customer-facing order detail (My Orders -> View Details). Read-only: only
// the admin order-management RPCs can change an order, so there is no
// cancel action here -- see report note on this limitation.
export default function OrderDetailCustomer() {
  const { id } = useParams();
  const { t, lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const { user, isLoadingAuth, authChecked } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    db.Order.get(id)
      .then((o) => { if (!o) setNotFound(true); setOrder(o); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, user]);

  if (isLoadingAuth || !authChecked) return <div className="min-h-screen grid place-items-center bg-background"><div className="w-8 h-8 border-4 border-mist border-t-cosmic rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to={`/login?returnTo=${encodeURIComponent(`/orders/${id}`)}`} replace />;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={t('orders.orderNo')} />
        <div className="max-w-2xl mx-auto px-5 py-10 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 rounded-3xl bg-mist animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={t('orders.orderNo')} />
        <div className="max-w-md mx-auto px-5 py-24 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-mist"><Lock className="w-8 h-8 text-muted-foreground" /></div>
          <h1 className="mt-6 font-heading font-extrabold text-2xl">{ar ? 'الطلب غير موجود' : 'Order not found'}</h1>
          <Link to="/orders" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">{t('orders.title')}</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const { subtotal, delivery, discount, loyalty, total } = orderTotals(order);
  const { eligible, deadline } = getReturnEligibility(order);
  const remaining = deadline ? formatTimeRemaining(deadline, lang) : null;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={orderRef(order)} />
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8 space-y-4">
        <div className="rounded-3xl bg-card border border-border/60 p-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{t('orders.orderNo')}</p>
            <p className="font-heading font-bold" dir="ltr">{orderRef(order)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date(order.created_date).toLocaleDateString(ar ? 'ar-u-nu-latn' : 'en')}
            </p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-heading font-bold ${statusColor(order.status)}`}>
            {statusLabel(order.status, lang)}
          </span>
        </div>

        <OrderTimeline order={order} />

        <div className="rounded-3xl bg-card border border-border/60 p-5">
          <h2 className="font-heading font-extrabold text-lg flex items-center gap-2"><Package className="w-5 h-5 text-cosmic" /> {ar ? 'المنتجات' : 'Items'}</h2>
          <div className="mt-4 space-y-3">
            {(order.items || []).map((it, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-mist shrink-0">
                  {it.image_url && <Image src={it.image_url} alt="" fittingType="fill" className="w-full h-full object-contain" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-heading font-bold line-clamp-2">{lineItemName(it, lang)}</p>
                  <p className="text-xs text-muted-foreground">{ar ? 'الكمية' : 'Qty'}: {it.qty}</p>
                </div>
                <p className="font-heading font-bold text-sm shrink-0">{formatPrice(it.price * it.qty)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border/60 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{t('common.subtotal')}</span><span className="font-heading font-bold">{formatPrice(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('common.delivery')}</span><span className="font-heading font-bold">{delivery === 0 ? t('common.free') : formatPrice(delivery)}</span></div>
            {discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t('checkout.discount')}</span><span className="font-heading font-bold text-accent">−{formatPrice(discount)}</span></div>}
            {loyalty > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t('loyalty.title')}</span><span className="font-heading font-bold text-accent">−{formatPrice(loyalty)}</span></div>}
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 flex justify-between items-center">
            <span className="font-heading font-bold">{t('common.total')}</span>
            <span className="font-heading font-extrabold text-xl">{formatPrice(total)}</span>
          </div>
        </div>

        <div className="rounded-3xl bg-card border border-border/60 p-5">
          <h2 className="font-heading font-extrabold text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-cosmic" /> {t('checkout.address')}</h2>
          <p className="mt-2 text-sm">{order.customer_name}</p>
          <p className="text-sm text-muted-foreground">{order.address}{order.city ? `, ${order.city}` : ''}</p>
          <p className="text-sm text-muted-foreground" dir="ltr">{order.phone}</p>
        </div>

        <div className="rounded-3xl bg-card border border-border/60 p-5">
          <h2 className="font-heading font-extrabold text-lg flex items-center gap-2"><CreditCard className="w-5 h-5 text-cosmic" /> {t('checkout.payment')}</h2>
          <p className="mt-2 text-sm">{PAYMENT_LABEL[order.payment_method]?.[lang] || order.payment_method}</p>
        </div>

        {order.status === 'delivered' && (
          <div className="rounded-3xl bg-card border border-border/60 p-5">
            {eligible ? (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{t('returns.eligibleUntil')}</p>
                  {remaining && <p className="text-xs text-accent font-heading font-bold mt-0.5">{remaining}</p>}
                </div>
                <Link to={`/returns/new/${order.id}`} className="squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold text-sm shrink-0">
                  {t('returns.startAction')}
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('returns.windowClosed')}</p>
            )}
          </div>
        )}

        <OrderReturnsList orderId={order.id} bare />

        <div className="flex justify-center">
          <InvoiceButton order={order} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
