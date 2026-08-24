import React from 'react';
import { orderTotals } from '@/lib/orderStatus';
import { useLanguage } from '@/context/LanguageContext';

// Financial breakdown of the order, each deduction listed separately.
export default function OrderFinancials({ order }) {
  const { lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const { subtotal, delivery, discount, loyalty, total } = orderTotals(order);

  const Row = ({ label, value, accent }) => (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-heading font-bold ${accent ? 'text-accent' : ''}`}>{value}</span>
    </div>
  );

  return (
    <div className="rounded-3xl bg-mist p-5 sm:p-6">
      <h2 className="font-heading font-extrabold text-xl">{ar ? 'الملخص المالي' : 'Financial summary'}</h2>
      <div className="mt-4 space-y-2">
        <Row label={ar ? 'المجموع الفرعي' : 'Subtotal'} value={formatPrice(subtotal)} />
        {discount > 0 && (
          <Row
            label={`${ar ? 'خصم' : 'Discount'}${order.discount_code ? ` (${order.discount_code})` : ''}`}
            value={`−${formatPrice(discount)}`}
            accent
          />
        )}
        {loyalty > 0 && (
          <Row
            label={`${ar ? 'نقاط الولاء' : 'Loyalty points'} (${order.loyalty_points || 0})`}
            value={`−${formatPrice(loyalty)}`}
            accent
          />
        )}
        <Row label={ar ? 'التوصيل' : 'Delivery fee'} value={delivery === 0 ? (ar ? 'مجاني' : 'Free') : formatPrice(delivery)} />
      </div>
      <div className="mt-4 pt-4 border-t border-border/60 flex justify-between items-center">
        <span className="font-heading font-bold">{ar ? 'الإجمالي النهائي' : 'Final total'}</span>
        <span className="font-heading font-extrabold text-2xl">{formatPrice(total)}</span>
      </div>
    </div>
  );
}