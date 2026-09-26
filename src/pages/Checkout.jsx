import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Banknote, ShieldCheck, Check, Lock, Sparkles } from 'lucide-react';
import { db } from '@/api/entities';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { orderRef } from '@/lib/orderStatus';
import CitySelect from '@/components/checkout/CitySelect';
import SavedAddressPicker from '@/components/checkout/SavedAddressPicker';
import DiscountInput from '@/components/checkout/DiscountInput';
import LoyaltyRedeem from '@/components/checkout/LoyaltyRedeem';
import CountryCodeSelect, { dialFor } from '@/components/checkout/CountryCodeSelect';
import OrderConfirmDialog from '@/components/checkout/OrderConfirmDialog';
import { secureOrder, commitOrderStock, redeemDiscount } from '@/lib/orderFunctions';
import { getLoyaltyBalance, redeemLoyaltyPoints, releaseLoyaltyPoints, awardLoyaltyPoints } from '@/lib/loyaltyFunctions';
import { finalizeWheelRewards } from '@/lib/wheelFunctions';
import { getSetting } from '@/lib/storeSettings';
import { lineItemName } from '@/lib/bilingual';
import { resolveCheckoutItems, cartLineTotal } from '@/lib/cartSelection';
import { useIsMobile } from '@/hooks/use-mobile';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// No real card payment gateway is integrated yet. Card checkout stays hidden and
// can never be selected or submitted regardless of the admin "Card Payment"
// setting. Flip this to true only once a gateway confirms charges server-side.
const CARD_PAYMENT_AVAILABLE = false;

const CARD_TYPES = [
  { key: 'visa', label: 'Visa', badge: 'bg-[#1A1F71]', dot: 'bg-[#1A1F71]' },
  { key: 'mastercard', label: 'Mastercard', badge: 'bg-[#EB001B]', dot: 'bg-[#EB001B]' },
  { key: 'amex', label: 'American Express', badge: 'bg-[#006FCF]', dot: 'bg-[#006FCF]' },
  { key: 'debit', label: 'Debit', badge: 'bg-emerald-600', dot: 'bg-emerald-600' },
];

export default function Checkout() {
  const { items: cartItems, removeItems, revalidateStock, adjustForInsufficient, checkoutSelection, setCheckoutSelection } = useCart();
  const { toast } = useToast();
  const { t, lang, formatPrice } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const ar = lang === 'ar';
  const isMobile = useIsMobile();

  const lineIdOf = (i) => i.lineId || i.id;
  // Only the lines the customer selected in the cart go into this order —
  // resolveCheckoutItems() is the exact same helper Cart.jsx's Summary uses,
  // so what the customer saw as their total there is what gets charged here.
  // A null/empty selection (e.g. a direct visit with no cart selection made)
  // falls back to the whole cart so the page still works outside the
  // selection flow.
  const items = useMemo(
    () => resolveCheckoutItems(cartItems, checkoutSelection),
    [cartItems, checkoutSelection]
  );
  const total = cartLineTotal(items);

  const [form, setForm] = useState({ name: '', email: '', address: '', phone: '' });
  const [phoneCountry, setPhoneCountry] = useState('ps');
  const [giftMessage, setGiftMessage] = useState('');
  const [payment, setPayment] = useState(CARD_PAYMENT_AVAILABLE ? 'card' : 'cod');
  const [cardType, setCardType] = useState('visa');
  const [card, setCard] = useState({ name: '', number: '', expiry: '', cvc: '' });
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [cities, setCities] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [cityId, setCityId] = useState('');
  const [savedId, setSavedId] = useState('');
  const [saveAddr, setSaveAddr] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [loyaltyRedeem, setLoyaltyRedeem] = useState(null);
  // Unused wheel Free Delivery reward (account-owned). Only applied when the customer opts in;
  // it is consumed server-side (secure_order) after the order row exists.
  const [freeDeliverySpin, setFreeDeliverySpin] = useState(null);
  const [useFreeDelivery, setUseFreeDelivery] = useState(false);
  const [loyaltyBalance, setLoyaltyBalance] = useState(0);
  const [loyaltyRate, setLoyaltyRate] = useState(0.1);
  const [cardSettingOn, setCardSettingOn] = useState(true);
  const cardEnabled = CARD_PAYMENT_AVAILABLE && cardSettingOn;
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Stable per-checkout key so a retried submit can never spend points twice.
  const [checkoutKey] = useState(() => `co-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  // The admin "Card Payment" toggle controls the entire card method. When off,
  // no card option (Visa, Mastercard, …) is shown at checkout — only COD and
  // loyalty remain.
  const availableCardTypes = useMemo(() => (cardEnabled ? CARD_TYPES : []), [cardEnabled]);

  const selectedCity = cities.find((c) => c.id === cityId);
  const freeDeliveryApplied = !!(useFreeDelivery && freeDeliverySpin && selectedCity);
  const deliveryCost = selectedCity && !freeDeliveryApplied ? selectedCity.price : 0;
  const discountAmount = appliedDiscount?.amount || 0;
  const loyaltyDiscount = loyaltyRedeem?.amount || 0;
  const grandTotal = Math.max(0, total + deliveryCost - discountAmount - loyaltyDiscount);
  const requiredPoints = grandTotal > 0 ? Math.ceil(grandTotal / loyaltyRate) : 0;
  const loyaltyShort = payment === 'loyalty' && grandTotal > 0 && loyaltyBalance < requiredPoints;

  const fullPhone = `${dialFor(phoneCountry)} ${form.phone}`.trim();
  const addressComplete = !!(selectedCity && form.name && form.address && (form.phone || '').replace(/\D/g, '').length >= 7);

  useEffect(() => {
    db.DeliveryCity.filter({ active: true }).then(setCities).catch(() => {});
    if (user) db.Address.list('-created_date', 50).then(setAddresses).catch(() => {});
    if (user) {
      db.WheelSpin.filter({ user_id: user.id, reward_type: 'free_delivery', status: 'unused' })
        .then((r) => setFreeDeliverySpin((r || []).find((x) => !x.expires_at || new Date(x.expires_at) >= new Date()) || null))
        .catch(() => {});
    }
    getSetting('visa_payment_enabled', 1).then((v) => setCardSettingOn(!!v)).catch(() => {});
  }, [user]);

  // If the selected card type is no longer available, fall back to the first.
  useEffect(() => {
    if (!availableCardTypes.some((c) => c.key === cardType)) {
      setCardType((availableCardTypes[0] || { key: 'mastercard' }).key);
    }
  }, [availableCardTypes, cardType]);

  // When the whole card method is disabled, switch any 'card' selection to COD.
  useEffect(() => {
    if (!cardEnabled && payment === 'card') setPayment('cod');
  }, [cardEnabled, payment]);

  useEffect(() => {
    if (!user) return;
    getLoyaltyBalance()
      .then((res) => { if (res.success) { setLoyaltyBalance(res.balance || 0); if (res.redeem_rate) setLoyaltyRate(res.redeem_rate); } })
      .catch(() => {});
  }, [user]);

  // A product sitting in the cart is NOT a reservation — re-check live stock
  // when checkout opens and adjust any lines that sold out or dropped.
  useEffect(() => {
    let active = true;
    revalidateStock().then((adj) => {
      if (!active || !adj.length) return;
      const removed = adj.filter((a) => a.newQty === 0);
      const reduced = adj.filter((a) => a.newQty > 0);
      const parts = [];
      reduced.forEach((a) => parts.push(ar ? `تم تقليل "${a.name}" إلى ${a.newQty}` : `"${a.name}" reduced to ${a.newQty}`));
      removed.forEach((a) => parts.push(ar ? `"${a.name}" لم يعد متوفرًا` : `"${a.name}" is no longer available`));
      toast({ title: ar ? 'تم تحديث سلتك' : 'Your cart was updated', description: parts.join(' · '), variant: 'destructive' });
    });
    return () => { active = false; };
  }, []);

  // Phone: pre-fill the saved default address (customer can still pick another / edit the fields).
  useEffect(() => {
    if (!isMobile || savedId || !addresses.length || form.address) return;
    const def = addresses.find((a) => a.is_default) || addresses[0];
    if (def) applySavedAddress(def.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, addresses, cities]);

  const applySavedAddress = (id) => {
    setSavedId(id);
    const a = addresses.find((x) => x.id === id);
    if (!a) return;
    setForm((f) => ({ ...f, name: a.recipient_name, phone: a.phone, address: a.street }));
    const match = cities.find((c) => c.name === a.city);
    if (match) setCityId(match.id);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    if (items.length === 0) {
      toast({ title: ar ? 'لا توجد منتجات متاحة لإتمام الطلب' : 'No available items to checkout', variant: 'destructive' });
      return false;
    }
    if (!selectedCity) {
      toast({ title: ar ? 'اختر المدينة' : 'Please select a city', variant: 'destructive' });
      return false;
    }
    if (!form.name || !form.address) {
      toast({ title: ar ? 'أكمل الحقول المطلوبة' : 'Please complete required fields', variant: 'destructive' });
      return false;
    }
    // Email is optional — only validated (as a real address) when the
    // customer actually typed something. An empty field is always valid.
    const trimmedEmail = form.email.trim();
    if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
      toast({ title: t('checkout.invalidEmail'), variant: 'destructive' });
      return false;
    }
    const phoneDigits = (form.phone || '').replace(/\D/g, '');
    if (phoneDigits.length < 7) {
      toast({ title: ar ? 'رقم هاتف غير صالح' : 'Invalid phone number', variant: 'destructive' });
      return false;
    }
    return true;
  };

  // The Place Order button submits the form, which validates and opens the
  // confirmation modal — the actual order is only created on Confirm.
  const openConfirm = (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (loyaltyShort) {
      toast({ title: t('checkout.insufficientPoints'), variant: 'destructive' });
      return;
    }
    setConfirmOpen(true);
  };

  const placeOrder = async () => {
    if (placing) return; // guard against duplicate submission
    if (payment === 'card' && !cardEnabled) {
      setPayment('cod');
      toast({ title: ar ? 'الدفع بالبطاقة غير متاح حاليًا' : 'Card payment is not available right now', variant: 'destructive' });
      setConfirmOpen(false);
      return;
    }
    if (!validate()) return;
    setPlacing(true);
    let reserved = false;
    try {
      let loyaltyPoints = 0;
      let loyaltyAmount = 0;
      if (payment === 'loyalty' && user) {
        if (requiredPoints > loyaltyBalance) {
          toast({ title: t('checkout.insufficientPoints'), variant: 'destructive' });
          setPlacing(false);
          return;
        }
        if (requiredPoints > 0) {
          const res = await redeemLoyaltyPoints({
            points: requiredPoints,
            subtotal: total,
            deliveryCost,
            discountAmount,
            idempotencyKey: checkoutKey,
          });
          if (!res.success) {
            toast({ title: res.message || 'Loyalty error', variant: 'destructive' });
            setPlacing(false);
            return;
          }
          loyaltyPoints = res.points;
          loyaltyAmount = res.amount;
          reserved = true;
        }
      } else if (loyaltyRedeem && user) {
        const res = await redeemLoyaltyPoints({
          points: loyaltyRedeem.points,
          subtotal: total,
          deliveryCost,
          discountAmount,
          idempotencyKey: checkoutKey,
        });
        if (!res.success) {
          toast({ title: res.message || 'Loyalty error', variant: 'destructive' });
          setPlacing(false);
          return;
        }
        loyaltyPoints = res.points;
        loyaltyAmount = res.amount;
        reserved = true;
      }
      // Generated client-side (not returned by the insert): orders are
      // publicly insertable (guest checkout) but only owner/admin-readable,
      // and Postgres RLS errors an INSERT...RETURNING whose new row fails the
      // SELECT policy rather than just omitting it — so the create below
      // skips RETURNING entirely (`returning: false`) and this id is used
      // for every subsequent call instead of reading the row back.
      const orderId = crypto.randomUUID();
      await db.Order.create({
        id: orderId,
        items: items.map((i) => ({
          id: i.id, name: i.name, name_en: i.name_en || null, price: i.price, qty: i.qty,
          variant_key: i.variant_key || null,
          variant_label: i.variant_label || null,
          variant_attributes: i.variant_attributes || null,
          sku: i.sku || null,
          is_bundle: !!i.is_bundle,
          bundle_id: i.bundle_id || null,
          bundle_items: i.bundle_items || null,
          wheel_spin_id: i.wheel_spin_id || null,
          is_wheel_reward: !!i.is_wheel_reward,
        })),
        subtotal: total,
        delivery_cost: deliveryCost,
        free_delivery_spin_id: freeDeliveryApplied ? freeDeliverySpin.id : undefined,
        discount_code: appliedDiscount?.code,
        discount_amount: discountAmount,
        loyalty_points: loyaltyPoints,
        loyalty_discount: loyaltyAmount,
        loyalty_redeem_key: loyaltyPoints > 0 ? checkoutKey : undefined,
        total: Math.max(0, total + deliveryCost - discountAmount - loyaltyAmount),
        city: selectedCity.name,
        customer_name: form.name,
        // Optional — null (never a placeholder like "guest@hikids.com") when
        // the customer didn't provide one. sanitize() in createEntity.js
        // already turns '' into null on write, but this is explicit so the
        // intent reads clearly here.
        customer_email: form.email.trim() || null,
        address: `${form.address}, ${selectedCity.name}`,
        phone: fullPhone,
        payment_method: payment,
        status: 'new',
        // Only loyalty-point payment is settled at insert time (RLS enforces this);
        // no card gateway exists, so nothing else may ever be recorded as paid here.
        payment_status: payment === 'loyalty' ? 'paid' : 'unpaid',
        gift_message: giftMessage.trim() || undefined,
      }, { returning: false });

      // Recompute every price/total server-side from the real product, category,
      // delivery, discount and loyalty records so a forged client payload can
      // never lower what the customer pays. Stock is committed ONLY when
      // secure_order explicitly confirms success: a thrown error, timeout, or
      // any other response shape stops checkout (commit_order_stock also
      // refuses unsecured orders server-side). secure_order is idempotent, so
      // one retry after a lost response is safe.
      let secureResult = null;
      try {
        secureResult = await secureOrder(orderId);
      } catch {
        try {
          secureResult = await secureOrder(orderId);
        } catch { secureResult = null; }
      }
      if (!secureResult || secureResult.success !== true) {
        if (reserved) {
          await releaseLoyaltyPoints(checkoutKey).catch(() => {});
        }
        toast({ title: ar ? 'تعذر التحقق من الطلب، حاول مجددًا' : 'Could not verify your order, please try again', variant: 'destructive' });
        setConfirmOpen(false);
        setPlacing(false);
        return;
      }

      // Authoritative stock check + atomic deduction. The cart display is NOT
      // a reservation — this is the single source of truth at order time, so
      // two customers racing for the last item can never oversell.
      let commit;
      try {
        commit = await commitOrderStock(orderId);
      } catch {
        // Possibly a lost response — retry (the call is idempotent).
        try {
          commit = await commitOrderStock(orderId);
        } catch {
          if (reserved) {
            await releaseLoyaltyPoints(checkoutKey).catch(() => {});
          }
          toast({ title: ar ? 'تعذر تأكيد المخزون، حاول مجددًا' : 'Could not confirm stock, please try again', variant: 'destructive' });
          setPlacing(false);
          return;
        }
      }
      // Whitelist success rather than blacklist failure: commit_order_stock
      // can fail as either {success:false, insufficient:[...]} or
      // {error:'...'} (a permission/ownership/not-found rejection) — and a
      // guest calling this RPC used to get a permission error that this
      // check never even reached (it threw, caught by the retry logic
      // above). Checking `commit.success === true` explicitly, instead of
      // `!== false`, also means any future/unexpected response shape is
      // treated as a failure rather than silently passing through as a
      // false "success" — see the pre-launch review's finding on this.
      if (!commit || commit.success !== true) {
        // Insufficient stock — the backend already cancelled the order and
        // rolled back any partial deductions. Release the reserved loyalty
        // points and adjust the cart so the customer sees what changed.
        if (reserved) {
          await releaseLoyaltyPoints(checkoutKey).catch(() => {});
        }
        const adj = adjustForInsufficient(commit?.insufficient || []);
        const parts = adj.map((a) =>
          a.newQty === 0
            ? (ar ? `"${a.name}" لم يعد متوفرًا` : `"${a.name}" is no longer available`)
            : (ar ? `تم تقليل "${a.name}" إلى ${a.newQty}` : `"${a.name}" reduced to ${a.newQty}`)
        );
        toast({
          title: ar ? 'لا يمكن إكمال الطلب' : 'Order could not be completed',
          description: parts.length ? parts.join(' · ') : (ar ? 'مخزون غير كافٍ' : 'Insufficient stock'),
          variant: 'destructive',
        });
        setConfirmOpen(false);
        setPlacing(false);
        return;
      }

      if (saveAddr && user && form.address) {
        db.Address.create({
          label: 'Home',
          recipient_name: form.name,
          phone: fullPhone,
          city: selectedCity.name,
          street: form.address,
          is_default: addresses.length === 0,
        }).catch(() => {});
      }
      if (appliedDiscount) {
        redeemDiscount(appliedDiscount.id, orderId).catch(() => {});
      }
      setConfirmOpen(false);
      setOrderId(orderId);
      // Remove only what was actually purchased; keep any unselected cart lines.
      removeItems(items.map(lineIdOf));
      setCheckoutSelection(null);
      setDone(true);
      // Order confirmation email is deferred — Base44's onOrderPlaced sent it
      // via a platform email integration with no Supabase equivalent yet;
      // needs a transactional email provider decision (not made yet). Admins
      // still get a real-time new-order alert via NewOrderNotifier. Email is
      // optional at checkout, so whenever that provider is wired up, sending
      // must be guarded on `orderId`'s customer_email actually being present
      // (see the null handling above) — never invented/defaulted, and never
      // allowed to fail or delay order creation itself.
      finalizeWheelRewards(orderId).catch(() => {});
      if (user) awardLoyaltyPoints(orderId).catch(() => {});
      toast({ title: lang === 'ar' ? 'تم تأكيد الطلب' : 'Order placed' });
    } catch (err) {
      // The order never made it — give the reserved loyalty points straight back.
      if (reserved) {
        await releaseLoyaltyPoints(checkoutKey).catch(() => {});
      }
      toast({ title: lang === 'ar' ? 'حدث خطأ' : 'Something went wrong', variant: 'destructive' });
    } finally {
      setPlacing(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={t('checkout.title')} />
        <div className="max-w-2xl mx-auto px-5 py-24 text-center">
          <div className="mx-auto grid place-items-center w-20 h-20 rounded-full bg-accent/20 text-accent">
            <Check className="w-10 h-10" />
          </div>
          <h1 className="mt-6 font-heading font-extrabold text-4xl md:text-5xl">{t('checkout.success')}</h1>
          <p className="mt-4 text-muted-foreground text-lg">{t('checkout.successDesc')}</p>
          <div className="mt-5 inline-block rounded-2xl bg-mist px-6 py-3">
            <p className="text-xs text-muted-foreground">{ar ? 'رقم الطلب' : 'Order number'}</p>
            <p className="font-heading font-extrabold text-2xl" dir="ltr">{orderRef({ id: orderId })}</p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {ar
              ? 'احتفظ برقم الطلب — ستحتاجه مع رقم هاتفك لتتبع طلبك لاحقًا.'
              : 'Keep this order number — you will need it with your phone number to track your order later.'}
          </p>
          <div className="md:hidden mt-8 grid gap-3">
            {user ? (
              <Link to="/orders" className="h-14 grid place-items-center rounded-full bg-cosmic text-white font-heading font-bold squish">
                {ar ? 'عرض الطلب' : 'View Order'}
              </Link>
            ) : (
              <Link to={`/track-order?ref=${orderRef({ id: orderId })}`} className="h-14 grid place-items-center rounded-full bg-cosmic text-white font-heading font-bold squish">
                {ar ? 'تتبع الطلب' : 'Track Order'}
              </Link>
            )}
            <Link to="/shop" className="h-14 grid place-items-center rounded-full bg-mist font-heading font-bold squish">
              {ar ? 'متابعة التسوّق' : 'Continue Shopping'}
            </Link>
          </div>
          <div className="hidden md:block">
            {user ? (
              <Link to="/orders" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">
                {t('nav.orders')} →
              </Link>
            ) : (
              <Link to={`/track-order?ref=${orderRef({ id: orderId })}`} className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">
                {ar ? 'تتبع الطلب' : 'Track Order'} →
              </Link>
            )}
            <div>
              <Link to="/" className="mt-8 inline-flex items-center gap-2 h-14 px-8 rounded-full bg-cosmic text-white font-heading font-bold squish">
                {t('checkout.back')}
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (items.length === 0) {
    const hasUnavailable = cartItems.some((i) => i.unavailable);
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={t('checkout.title')} />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <h1 className="font-heading font-extrabold text-3xl">
            {hasUnavailable ? (ar ? 'المنتجات غير متوفرة' : t('checkout.empty')) : t('checkout.empty')}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {hasUnavailable
              ? (ar ? 'المنتجات التي اخترتها لم تعد متوفرة. يمكنك العودة إلى السلة واختيار منتجات أخرى.' : t('checkout.emptyDesc'))
              : t('checkout.emptyDesc')}
          </p>
          <Link to="/cart" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">
            <ArrowLeft className="w-4 h-4 ltr:rotate-180 rtl:rotate-0" /> {ar ? 'العودة إلى السلة' : t('nav.explore')}
          </Link>
        </div>
      </div>
    );
  }

  const paymentLabel = payment === 'card'
    ? `${t('checkout.card')} · ${availableCardTypes.find((c) => c.key === cardType)?.label || 'Card'}`
    : payment === 'cod' ? t('checkout.cod') : t('checkout.payWithPoints');

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={t('checkout.title')} />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12">
        <Link to="/cart" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 ltr:rotate-180 rtl:rotate-0" /> {t('common.back')}
        </Link>
        <h1 className="mt-6 font-heading font-extrabold text-4xl md:text-5xl">{t('checkout.title')}</h1>
        <CheckoutSteps step={confirmOpen ? 3 : addressComplete ? 2 : 1} ar={ar} />

        <form onSubmit={openConfirm} className="mt-10 grid lg:grid-cols-3 gap-10 max-md:mt-5 max-md:pb-28">
          <div className="lg:col-span-2 space-y-8">
            {/* Contact & delivery */}
            <div className="rounded-3xl bg-card border border-border/60 p-6 md:p-8">
              <h2 className="font-heading font-extrabold text-2xl">{t('checkout.contact')}</h2>
              {user && addresses.length > 0 && (
                <div className="mt-5">
                  <SavedAddressPicker addresses={addresses} value={savedId} onChange={applySavedAddress} />
                </div>
              )}
              <div className="mt-5 grid sm:grid-cols-2 gap-4">
                <Field label={t('checkout.name')} required value={form.name} onChange={set('name')} />
                <Field label={t('checkout.email')} type="email" value={form.email} onChange={set('email')} />
                <CountryCodeSelect value={phoneCountry} onChange={setPhoneCountry} />
                <Field label={t('checkout.phone')} required value={form.phone} onChange={set('phone')} placeholder="59XXXXXXX" />
                <CitySelect cities={cities} value={cityId} onChange={setCityId} />
                <div className="sm:col-span-2">
                  <Field label={t('checkout.address')} required value={form.address} onChange={set('address')} placeholder={t('checkout.addressPlaceholder')} />
                </div>
                {selectedCity && (
                  <div className="md:hidden sm:col-span-2 rounded-2xl bg-mist px-4 py-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{selectedCity.name} · {t('common.delivery')}</span>
                      <span className="font-heading font-bold text-cosmic">{deliveryCost === 0 ? t('common.free') : formatPrice(deliveryCost)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{ar ? 'التوصيل المتوقع: 1–3 أيام عمل' : 'Estimated delivery: 1–3 working days'}</p>
                  </div>
                )}
              </div>
              {user && (
                <label className="mt-4 flex items-center gap-2 text-sm text-foreground/80 cursor-pointer">
                  <input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} className="w-4 h-4 rounded" />
                  {t('checkout.saveAddress')}
                </label>
              )}
            </div>

            {/* Gift message */}
            <div className="rounded-3xl bg-card border border-border/60 p-6 md:p-8">
              <h2 className="font-heading font-extrabold text-2xl">{t('checkout.giftTitle')}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t('checkout.giftDesc')}</p>
              <textarea
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                rows={3}
                placeholder={t('checkout.giftPlaceholder')}
                className="mt-4 w-full p-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic resize-none"
              />
            </div>

            {/* Payment */}
            <div className="rounded-3xl bg-card border border-border/60 p-6 md:p-8">
              <h2 className="font-heading font-extrabold text-2xl">{t('checkout.payment')}</h2>

              <div className="mt-6 grid sm:grid-cols-2 gap-4">
                {cardEnabled && (
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
                )}

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

                {user && (
                  <button
                    type="button"
                    onClick={() => { setPayment('loyalty'); setLoyaltyRedeem(null); }}
                    className={`sm:col-span-2 text-left p-5 rounded-2xl border-2 transition-all ${
                      payment === 'loyalty' ? 'border-cosmic bg-cosmic/5' : 'border-border hover:border-cosmic/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="grid place-items-center w-11 h-11 rounded-xl bg-mist">
                          <Sparkles className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                          <p className="font-heading font-bold">{t('checkout.payWithPoints')}</p>
                          <p className="text-xs text-muted-foreground">
                            {t('checkout.pointsBalance')}: {loyaltyBalance} · {t('checkout.pointsRequired')}: {requiredPoints}
                          </p>
                        </div>
                      </div>
                      {payment === 'loyalty' && <Check className="w-5 h-5 text-cosmic" />}
                    </div>
                  </button>
                )}
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
                      {availableCardTypes.map((c) => {
                        const active = cardType === c.key;
                        return (
                          <button
                            key={c.key}
                            type="button"
                            onClick={() => setCardType(c.key)}
                            aria-pressed={active}
                            className={`flex items-center justify-center gap-2 px-2 h-11 rounded-xl text-sm font-bold transition-all border-2 ${
                              active
                                ? 'border-cosmic bg-card text-foreground shadow-sm ring-2 ring-cosmic/25'
                                : `border-transparent text-white opacity-80 hover:opacity-100 ${c.badge}`
                            }`}
                          >
                            {active && <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />}
                            <span className="truncate">{c.label}</span>
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

              {payment === 'loyalty' && (
                <div className={`mt-6 rounded-2xl border p-5 flex items-start gap-3 float-in ${loyaltyShort ? 'bg-destructive/10 border-destructive/30' : 'bg-accent/10 border-accent/30'}`}>
                  <Sparkles className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    {loyaltyShort ? t('checkout.insufficientPoints') : t('checkout.loyaltyNote')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="lg:sticky lg:top-28 h-fit rounded-3xl bg-mist p-6 md:p-8">
            <h2 className="font-heading font-extrabold text-2xl">{t('checkout.summary')}</h2>
            <div className="mt-5 space-y-4 max-h-72 overflow-auto pr-1">
              {items.map((i) => (
                <div key={i.lineId || i.id} className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {i.is_bundle && <span className="font-heading font-bold text-cosmic">{lang === 'ar' ? 'حزمة · ' : 'Bundle · '}</span>}
                    {lineItemName(i, lang)}{i.variant_label ? ` — ${i.variant_label}` : ''} × {i.qty}
                  </span>
                  <span className="font-heading font-bold">{formatPrice(i.price * i.qty)}</span>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <DiscountInput
                subtotal={total}
                applied={appliedDiscount}
                onApplied={setAppliedDiscount}
                onRemoved={() => setAppliedDiscount(null)}
              />
            </div>
            {freeDeliverySpin && (
              <label className="mt-4 flex items-center gap-3 rounded-2xl bg-mist/60 p-4 cursor-pointer text-sm font-heading font-bold">
                <input type="checkbox" checked={useFreeDelivery} onChange={(e) => setUseFreeDelivery(e.target.checked)} />
                {ar ? 'استخدام مكافأة التوصيل المجاني' : 'Use Free Delivery Reward'}
              </label>
            )}
            {user && payment !== 'loyalty' && (
              <div className="mt-4">
                <LoyaltyRedeem
                  subtotal={total}
                  deliveryCost={deliveryCost}
                  discountAmount={discountAmount}
                  orderTotal={grandTotal}
                  applied={loyaltyRedeem}
                  onApplied={setLoyaltyRedeem}
                  onRemoved={() => setLoyaltyRedeem(null)}
                />
              </div>
            )}
            <div className="mt-5 pt-5 border-t border-border/60 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('common.subtotal')}</span>
                <span className="font-heading font-bold">{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('common.delivery')}</span>
                <span className="font-heading font-bold text-cosmic">{deliveryCost === 0 ? t('common.free') : formatPrice(deliveryCost)}</span>
              </div>
              {appliedDiscount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('checkout.discount')}</span>
                  <span className="font-heading font-bold text-accent">−{formatPrice(appliedDiscount.amount)}</span>
                </div>
              )}
              {loyaltyRedeem && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('loyalty.title')}</span>
                  <span className="font-heading font-bold text-accent">−{formatPrice(loyaltyRedeem.amount)}</span>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-border/60 flex justify-between items-center">
              <span className="font-heading font-bold">{t('common.total')}</span>
              <span className="font-heading font-extrabold text-2xl">{formatPrice(grandTotal)}</span>
            </div>

            <button
              type="submit"
              disabled={placing || loyaltyShort}
              className="max-md:hidden squish mt-6 w-full h-14 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 hover:bg-primary transition-colors disabled:opacity-60"
            >
              {placing ? t('checkout.placing') : t('checkout.placeOrder')}
            </button>
          </div>

          {/* Phone: the one sticky primary action (opens the exact-amount confirmation dialog). */}
          <div className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur-xl px-4 pt-3 pb-3 safe-bottom">
            <button
              type="submit"
              disabled={placing || loyaltyShort}
              className="squish w-full h-14 rounded-full bg-cosmic text-white font-heading font-bold disabled:opacity-60"
            >
              {placing ? t('checkout.placing') : `${ar ? 'تأكيد الطلب' : 'Confirm Order'} — ${formatPrice(grandTotal)}`}
            </button>
          </div>
        </form>
      </div>

      <OrderConfirmDialog
        open={confirmOpen}
        onClose={() => !placing && setConfirmOpen(false)}
        onConfirm={placeOrder}
        placing={placing}
        items={items}
        total={total}
        discountAmount={discountAmount}
        loyaltyDiscount={loyaltyDiscount}
        deliveryCost={deliveryCost}
        grandTotal={grandTotal}
        form={{ ...form, phone: fullPhone }}
        cityName={selectedCity?.name}
        paymentLabel={paymentLabel}
      />

      <Footer />
    </div>
  );
}

// Compact Address -> Payment -> Confirmation indicator (phones only).
function CheckoutSteps({ step, ar }) {
  const labels = ar ? ['العنوان', 'الدفع', 'التأكيد'] : ['Address', 'Payment', 'Confirmation'];
  return (
    <ol className="md:hidden mt-4 flex items-center gap-2" aria-label={ar ? 'خطوات الطلب' : 'Checkout steps'}>
      {labels.map((l, i) => (
        <li key={l} className="flex flex-1 items-center gap-2" aria-current={step === i + 1 ? 'step' : undefined}>
          <span className={`grid place-items-center w-6 h-6 shrink-0 rounded-full text-xs font-heading font-bold ${step >= i + 1 ? 'bg-cosmic text-white' : 'bg-mist text-muted-foreground'}`}>{i + 1}</span>
          <span className={`text-xs font-heading font-bold truncate ${step === i + 1 ? 'text-foreground' : 'text-muted-foreground'}`}>{l}</span>
        </li>
      ))}
    </ol>
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