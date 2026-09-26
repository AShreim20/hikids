import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Circle, Loader2, MapPin, Package, CreditCard, Search } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import CountryCodeSelect, { dialFor } from '@/components/checkout/CountryCodeSelect';
import { useLanguage } from '@/context/LanguageContext';
import { statusLabel, statusColor, normalizeStatus, MAIN_FLOW } from '@/lib/orderStatus';
import { lineItemName } from '@/lib/bilingual';
import { trackOrder } from '@/lib/orderTracking';

const PAYMENT_LABEL = {
  card: { ar: 'بطاقة', en: 'Card' },
  cod: { ar: 'الدفع عند الاستلام', en: 'Cash on delivery' },
  loyalty: { ar: 'نقاط الولاء', en: 'Loyalty points' },
};

// Public guest order tracking: order number + the phone used at checkout, both
// verified server-side. Only the order number may be prefilled from the URL
// (?ref=); the phone number is never put in a URL.
export default function TrackOrder() {
  const { lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const [params] = useSearchParams();
  const [ref, setRef] = useState(() => (params.get('ref') || '').slice(0, 16));
  const [country, setCountry] = useState('ps');
  const [local, setLocal] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  const genericNotFound = ar
    ? 'لم نتمكن من العثور على طلب بهذه البيانات. تأكد من رقم الطلب ورقم الهاتف.'
    : "We couldn't find an order matching these details. Please check the order number and phone number.";

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setOrder(null);
    const cleanRef = ref.trim();
    const digits = local.replace(/\D/g, '');
    // Same minimum as Checkout; anything malformed gets the generic message
    // without a request, so the form never hints which field is wrong.
    if (!cleanRef || digits.length < 7) { setError(genericNotFound); return; }
    setLoading(true);
    try {
      const res = await trackOrder(cleanRef, `${dialFor(country)} ${local.trim()}`, lang);
      if (res?.found && res.order) setOrder(res.order);
      else setError(genericNotFound);
    } catch (err) {
      setError(err.message || genericNotFound);
    } finally {
      setLoading(false);
    }
  };

  const title = ar ? 'تتبع طلبك' : 'Track Your Order';
  const status = order ? normalizeStatus(order.status) : null;
  const currentIndex = status ? MAIN_FLOW.indexOf(status) : -1;
  const num = (v) => Number(v) || 0;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={title} />
      <div className="max-w-xl mx-auto px-5 sm:px-8 py-8 md:py-14 space-y-5">
        <div>
          <h1 className="font-heading font-extrabold text-3xl md:text-4xl">{title}</h1>
          <p className="mt-2 text-muted-foreground">
            {ar ? 'أدخل رقم الطلب ورقم الهاتف الذي استخدمته عند الطلب.' : 'Enter your order number and the phone number you used at checkout.'}
          </p>
        </div>

        <form onSubmit={submit} className="rounded-3xl bg-card border border-border/60 p-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-foreground/80">{ar ? 'رقم الطلب' : 'Order number'}<span className="text-accent"> *</span></span>
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              maxLength={16}
              dir="ltr"
              autoComplete="off"
              placeholder="ORD-XXXXXX"
              className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic uppercase"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3">
            <CountryCodeSelect value={country} onChange={setCountry} />
            <label className="block">
              <span className="text-sm font-medium text-foreground/80">{ar ? 'رقم الهاتف' : 'Phone number'}<span className="text-accent"> *</span></span>
              <input
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                maxLength={20}
                dir="ltr"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="59XXXXXXX"
                className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
              />
            </label>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="squish w-full h-14 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            {ar ? 'تتبع الطلب' : 'Track order'}
          </button>
        </form>

        {order && (
          <div className="space-y-4">
            <div className="rounded-3xl bg-card border border-border/60 p-5 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{ar ? 'رقم الطلب' : 'Order number'}</p>
                <p className="font-heading font-bold" dir="ltr">{order.order_ref}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(order.created_date).toLocaleDateString(ar ? 'ar-u-nu-latn' : 'en')}
                </p>
              </div>
              <span className={`px-3 py-1.5 rounded-full text-xs font-heading font-bold ${statusColor(order.status)}`}>
                {statusLabel(order.status, lang)}
              </span>
            </div>

            {currentIndex !== -1 && (
              <div className="rounded-3xl bg-card border border-border/60 p-5">
                <ol className="space-y-3">
                  {MAIN_FLOW.map((s, i) => {
                    const done = currentIndex >= i;
                    return (
                      <li key={s} className="flex items-center gap-3">
                        <span className={`grid place-items-center w-7 h-7 rounded-full shrink-0 ${done ? 'bg-cosmic text-white' : 'bg-mist text-muted-foreground'}`}>
                          {done ? <Check className="w-4 h-4" /> : <Circle className="w-3 h-3" />}
                        </span>
                        <span className={`text-sm font-heading font-bold ${done ? '' : 'text-muted-foreground'}`}>{statusLabel(s, lang)}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            <div className="rounded-3xl bg-card border border-border/60 p-5">
              <h2 className="font-heading font-extrabold text-lg flex items-center gap-2"><Package className="w-5 h-5 text-cosmic" /> {ar ? 'المنتجات' : 'Items'}</h2>
              <div className="mt-4 space-y-3">
                {(order.items || []).map((it, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-heading font-bold line-clamp-2">{lineItemName(it, lang)}</p>
                      <p className="text-xs text-muted-foreground">
                        {ar ? 'الكمية' : 'Qty'}: {it.qty}{it.variant_label ? ` · ${it.variant_label}` : ''}
                      </p>
                    </div>
                    <p className="font-heading font-bold text-sm shrink-0">{formatPrice(num(it.price) * num(it.qty))}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border/60 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{ar ? 'المجموع الفرعي' : 'Subtotal'}</span><span className="font-heading font-bold">{formatPrice(num(order.subtotal))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{ar ? 'التوصيل' : 'Delivery'}</span><span className="font-heading font-bold">{num(order.delivery_cost) === 0 ? (ar ? 'مجاني' : 'Free') : formatPrice(num(order.delivery_cost))}</span></div>
                {num(order.discount_amount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{ar ? 'الخصم' : 'Discount'}</span><span className="font-heading font-bold text-accent">−{formatPrice(num(order.discount_amount))}</span></div>}
                {num(order.loyalty_discount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{ar ? 'نقاط الولاء' : 'Loyalty points'}</span><span className="font-heading font-bold text-accent">−{formatPrice(num(order.loyalty_discount))}</span></div>}
              </div>
              <div className="mt-3 pt-3 border-t border-border/60 flex justify-between items-center">
                <span className="font-heading font-bold">{ar ? 'الإجمالي' : 'Total'}</span>
                <span className="font-heading font-extrabold text-xl">{formatPrice(num(order.total))}</span>
              </div>
            </div>

            {(order.city || order.payment_method) && (
              <div className="rounded-3xl bg-card border border-border/60 p-5 space-y-3">
                {order.city && (
                  <p className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-cosmic shrink-0" /> {order.city}</p>
                )}
                {order.payment_method && (
                  <p className="text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-cosmic shrink-0" /> {PAYMENT_LABEL[order.payment_method]?.[lang] || order.payment_method}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
