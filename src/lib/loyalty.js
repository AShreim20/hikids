// Client-side fallbacks mirroring the server defaults in base44/shared/loyalty.ts.
// Used only for optimistic preview — the server always recomputes the real values.
export const EARN_RATE = 1;     // points earned per ₪ spent
export const REDEEM_RATE = 0.1; // ₪ value per point redeemed (10 points = ₪1)

export const pointsToValue = (points, rate = REDEEM_RATE) =>
  Math.round((Number(points) || 0) * rate * 100) / 100;

export const TX_TYPE_LABELS = {
  en: {
    earn: 'Points earned',
    redeem: 'Points used',
    refund: 'Points refunded',
    reversal: 'Points reversed',
    adjust: 'Manual adjustment',
    expire: 'Points expired',
  },
  ar: {
    earn: 'نقاط مكتسبة',
    redeem: 'نقاط مستخدمة',
    refund: 'إرجاع نقاط',
    reversal: 'سحب نقاط',
    adjust: 'تعديل يدوي',
    expire: 'نقاط منتهية',
  },
};

export const txTypeLabel = (type, lang = 'en') =>
  (TX_TYPE_LABELS[lang] || TX_TYPE_LABELS.en)[type] || type;