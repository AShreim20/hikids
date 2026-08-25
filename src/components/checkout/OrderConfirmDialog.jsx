import React from 'react';
import { Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

// Final order confirmation modal shown before the order is actually submitted.
// Keeps the customer inside the checkout flow and prevents accidental double
// submission (the Confirm button is disabled while `placing` is true).
export default function OrderConfirmDialog({
  open, onClose, onConfirm, placing,
  items, total, discountAmount, loyaltyDiscount, deliveryCost, grandTotal,
  form, cityName, paymentLabel,
}) {
  const { t, lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => !placing && onClose()} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-auto rounded-3xl bg-card border border-border shadow-2xl">
        <div className="p-6 md:p-7">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center w-11 h-11 rounded-2xl bg-cosmic/10 text-cosmic shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="font-heading font-extrabold text-2xl">{ar ? 'تأكيد الطلب' : 'Confirm Your Order'}</h2>
          </div>

          {/* Items */}
          <div className="mt-5 rounded-2xl bg-mist/60 p-4">
            <p className="font-heading font-bold text-sm text-muted-foreground">{ar ? 'المنتجات' : 'Items'}</p>
            <div className="mt-2 space-y-1.5 text-sm">
              {items.map((i) => (
                <div key={i.lineId || i.id} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {i.is_bundle && <span className="font-bold text-cosmic">{ar ? 'حزمة · ' : 'Bundle · '}</span>}
                    {i.name}{i.variant_label ? ` — ${i.variant_label}` : ''} × {i.qty}
                  </span>
                  <span className="font-heading font-bold">{formatPrice(i.price * i.qty)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('common.subtotal')}</span>
              <span className="font-heading font-bold">{formatPrice(total)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('checkout.discount')}</span>
                <span className="font-heading font-bold text-accent">−{formatPrice(discountAmount)}</span>
              </div>
            )}
            {loyaltyDiscount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('loyalty.title')}</span>
                <span className="font-heading font-bold text-accent">−{formatPrice(loyaltyDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('common.delivery')}</span>
              <span className="font-heading font-bold">{deliveryCost === 0 ? t('common.free') : formatPrice(deliveryCost)}</span>
            </div>
            <div className="pt-2 mt-1 border-t border-border/60 flex justify-between items-center">
              <span className="font-heading font-bold">{t('common.total')}</span>
              <span className="font-heading font-extrabold text-xl">{formatPrice(grandTotal)}</span>
            </div>
          </div>

          {/* Delivery info */}
          <div className="mt-4 rounded-2xl border border-border/60 p-4 text-sm">
            <p className="font-heading font-bold text-sm text-muted-foreground">{ar ? 'معلومات التوصيل' : 'Delivery Information'}</p>
            <div className="mt-2 space-y-0.5">
              <p><span className="text-muted-foreground">{ar ? 'الاسم' : 'Name'}: </span>{form.name}</p>
              <p><span className="text-muted-foreground">{ar ? 'الهاتف' : 'Phone'}: </span> <span dir="ltr">{form.phone}</span></p>
              <p><span className="text-muted-foreground">{ar ? 'العنوان' : 'Address'}: </span>{form.address}{cityName ? `, ${cityName}` : ''}</p>
              <p><span className="text-muted-foreground">{ar ? 'البريد' : 'Email'}: </span>{form.email}</p>
            </div>
            <p className="mt-3">
              <span className="text-muted-foreground">{ar ? 'طريقة الدفع' : 'Payment Method'}: </span>
              <span className="font-heading font-bold">{paymentLabel}</span>
            </p>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={placing}
              className="sm:flex-1 h-12 rounded-full bg-mist font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <ArrowLeft className="w-4 h-4 ltr:rotate-180 rtl:rotate-0" />
              {ar ? 'تعديل الطلب' : 'Go Back / Edit'}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={placing}
              className="sm:flex-[1.4] h-12 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {placing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {ar ? 'جارٍ المعالجة' : 'Processing…'}</>
                : <><ShieldCheck className="w-4 h-4" /> {ar ? 'تأكيد الطلب' : 'Confirm Order'}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}