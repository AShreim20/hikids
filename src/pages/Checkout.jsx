import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Banknote, ShieldCheck, Check, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';

const CARD_TYPES = [
  { key: 'visa', label: 'Visa', badge: 'bg-[#1A1F71] text-white' },
  { key: 'mastercard', label: 'Mastercard', badge: 'bg-[#EB001B] text-white' },
  { key: 'amex', label: 'American Express', badge: 'bg-[#006FCF] text-white' },
  { key: 'debit', label: 'Debit', badge: 'bg-emerald-600 text-white' },
];

export default function Checkout() {
  const { items, total, clear } = useCart();
  const { toast } = useToast();
  const { t, lang, formatPrice } = useLanguage();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', address: '', phone: '' });
  const [payment, setPayment] = useState('card');
  const [cardType, setCardType] = useState('visa');
  const [card, setCard] = useState({ name: '', number: '', expiry: '', cvc: '' });
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState(false);
  const [orderId, setOrderId] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const placeOrder = async (e) => {
    e.preventDefault();
    if (items.length === 0) return;
    setPlacing(true);
    try {
      const order = await base44.entities.Order.create({
        items: items.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
        total,
        customer_name: form.name,
        customer_email: form.email,
        address: form.address,
        phone: form.phone,
        payment_method: payment,
        status: payment === 'card' ? 'paid' : 'pending',
      });
      setOrderId(order.id);
      clear();
      setDone(true);
      base44.functions.invoke('onOrderPlaced', { orderId: order.id }).catch(() => {});
      toast({ title: lang === 'ar' ? 'تم تأكيد الطلب' : 'Order placed' });
    } catch (err) {
      toast({ title: lang === 'ar' ? 'حدث خطأ' : 'Something went wrong', variant: 'destructive' });
    } finally {
      setPlacing(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-24 text-center">
          <div className="mx-auto grid place-items-center w-20 h-20 rounded-full bg-accent/20 text-accent">
            <Check className="w-10 h-10" />
          </div>
          <h1 className="mt-6 font-heading font-extrabold text-4xl md:text-5xl">{t('checkout.success')}</h1>
          <p className="mt-4 text-muted-foreground text-lg">{t('checkout.successDesc')}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            {t('track.orderNo')}: {orderId?.slice(-8).toUpperCase()}
          </p>
          <Link to="/track-order" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">
            {t('nav.track')} →
          </Link>
          <div>
            <Link to="/" className="mt-8 inline-flex items-center gap-2 h-14 px-8 rounded-full bg-cosmic text-white font-heading font-bold squish">
              {t('checkout.back')}
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <h1 className="font-heading font-extrabold text-3xl">{t('checkout.empty')}</h1>
          <p className="mt-3 text-muted-foreground">{t('checkout.emptyDesc')}</p>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">
            <ArrowLeft className="w-4 h-4 ltr:rotate-180 rtl:rotate-0" /> {t('nav.explore')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12">
        <Link to="/cart" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 ltr:rotate-180 rtl:rotate-0" /> {t('common.back')}
        </Link>
        <h1 className="mt-6 font-heading font-extrabold text-4xl md:text-5xl">{t('checkout.title')}</h1>

        <form onSubmit={placeOrder} className="mt-10 grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-8">
            {/* Contact & delivery */}
            <div className="rounded-3xl bg-card border border-border/60 p-6 md:p-8">
              <h2 className="font-heading font-extrabold text-2xl">{t('checkout.contact')}</h2>
              <div className="mt-6 grid sm:grid-cols-2 gap-4">
                <Field label={t('checkout.name')} required value={form.name} onChange={set('name')} />
                <Field label={t('checkout.email')} type="email" required value={form.email} onChange={set('email')} />
                <Field label={t('checkout.phone')} required value={form.phone} onChange={set('phone')} />
                <Field label={t('checkout.address')} required value={form.address} onChange={set('address')} />
              </div>
            </div>

            {/* Payment */}
            <div className="rounded-3xl bg-card border border-border/60 p-6 md:p-8">
              <h2 className="font-heading font-extrabold text-2xl">{t('checkout.payment')}</h2>

              <div className="mt-6 grid sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPayment('card')}
                  className={`text-left p-5 rounded-2xl border-2 transition-all ${
                    payment === 'card' ? 'border-cosmic bg-cosmic/5' : 'border-border hover:border-cosmic/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="grid place-items-center w-11 h-11 rounded-xl bg-mist">
                      <CreditCard className="w-5 h-5 text-cosmic" />
                    </div>
                    {payment === 'card' && <Check className="w-5 h-5 text-cosmic" />}
                  </div>
                  <p className="mt-3 font-heading font-bold">{t('checkout.card')}</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPayment('cod')}
                  className={`text-left p-5 rounded-2xl border-2 transition-all ${
                    payment === 'cod' ? 'border-cosmic bg-cosmic/5' : 'border-border hover:border-cosmic/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="grid place-items-center w-11 h-11 rounded-xl bg-mist">
                      <Banknote className="w-5 h-5 text-cosmic" />
                    </div>
                    {payment === 'cod' && <Check className="w-5 h-5 text-cosmic" />}
                  </div>
                  <p className="mt-3 font-heading font-bold">{t('checkout.cod')}</p>
                </button>
              </div>

              {payment === 'card' && (
                <div className="mt-6 rounded-2xl bg-mist p-5 space-y-4 float-in">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Lock className="w-3.5 h-3.5" />
                    {lang === 'ar' ? 'مشفّر وآمن.' : 'Encrypted & secure.'}
                  </div>

                  {/* Card type chips */}
                  <div>
                    <span className="text-sm font-medium text-foreground/80">{t('checkout.cardType')}</span>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {CARD_TYPES.map((c) => {
                        const active = cardType === c.key;
                        return (
                          <button
                            key={c.key}
                            type="button"
                            onClick={() => setCardType(c.key)}
                            className={`flex items-center justify-center h-11 rounded-xl text-sm font-bold transition-all border-2 ${
                              active ? 'border-cosmic bg-card' : 'border-transparent opacity-70 hover:opacity-100'
                            } ${c.badge}`}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Field label={t('checkout.cardNumber')} required value={card.number} onChange={(e) => setCard((c) => ({ ...c, number: e.target.value }))} placeholder="4242 4242 4242 4242" />
                  <Field label={t('checkout.cardName')} required value={card.name} onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label={t('checkout.expiry')} required value={card.expiry} onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))} placeholder="MM / YY" />
                    <Field label={t('checkout.cvc')} required value={card.cvc} onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value }))} placeholder="123" />
                  </div>
                </div>
              )}

              {payment === 'cod' && (
                <div className="mt-6 rounded-2xl bg-accent/10 border border-accent/30 p-5 flex items-start gap-3 float-in">
                  <ShieldCheck className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">{t('checkout.codNote')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="lg:sticky lg:top-28 h-fit rounded-3xl bg-mist p-6 md:p-8">
            <h2 className="font-heading font-extrabold text-2xl">{t('checkout.summary')}</h2>
            <div className="mt-5 space-y-4 max-h-72 overflow-auto pr-1">
              {items.map((i) => (
                <div key={i.id} className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{i.name} × {i.qty}</span>
                  <span className="font-heading font-bold">{formatPrice(i.price * i.qty)}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-5 border-t border-border/60 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('common.subtotal')}</span>
                <span className="font-heading font-bold">{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('common.delivery')}</span>
                <span className="font-heading font-bold text-cosmic">{t('common.free')}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/60 flex justify-between items-center">
              <span className="font-heading font-bold">{t('common.total')}</span>
              <span className="font-heading font-extrabold text-2xl">{formatPrice(total)}</span>
            </div>

            <button
              type="submit"
              disabled={placing}
              className="squish mt-6 w-full h-14 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 hover:bg-primary transition-colors disabled:opacity-60"
            >
              {placing ? t('checkout.placing') : t('checkout.placeOrder')}
            </button>
          </div>
        </form>
      </div>
      <Footer />
    </div>
  );
}

function Field({ label, required, value, onChange, placeholder, type = 'text' }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground/80">
        {label}{required && <span className="text-accent"> *</span>}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
      />
    </label>
  );
}