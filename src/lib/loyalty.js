// Client-side mirrors of the server loyalty core (base44/shared/loyalty.ts).
// Used only for display / optimistic preview — the server is always the source
// of truth for balances and limits.
export const EARN_RATE = 1;     // points earned per ₪ spent
export const REDEEM_RATE = 0.1; // ₪ value per point redeemed (10 points = ₪1)

export const pointsToValue = (points, rate = REDEEM_RATE) =>
  Math.round((Number(points) || 0) * rate * 100) / 100;

export const TX_TYPE_LABELS = {
  en: {
    PURCHASE_REWARD: 'Order reward',
    REDEMPTION: 'Used at checkout',
    ADMIN_CREDIT: 'Added by store',
    ADMIN_DEBIT: 'Removed by store',
    REFUND: 'Points refunded',
    RETURN_REVERSAL: 'Reversed — return',
    CANCELLATION_REVERSAL: 'Reversed — cancellation',
    EXPIRED: 'Points expired',
    ADJUSTMENT: 'Manual adjustment',
    // legacy entries
    earn: 'Order reward',
    redeem: 'Used at checkout',
    refund: 'Points refunded',
    reversal: 'Points reversed',
    adjust: 'Manual adjustment',
    expire: 'Points expired',
  },
  ar: {
    PURCHASE_REWARD: 'مكافأة طلب',
    REDEMPTION: 'استخدام عند الدفع',
    ADMIN_CREDIT: 'إضافة من المتجر',
    ADMIN_DEBIT: 'خصم من المتجر',
    REFUND: 'إرجاع نقاط',
    RETURN_REVERSAL: 'سحب — إرجاع طلب',
    CANCELLATION_REVERSAL: 'سحب — إلغاء طلب',
    EXPIRED: 'نقاط منتهية',
    ADJUSTMENT: 'تعديل يدوي',
    earn: 'مكافأة طلب',
    redeem: 'استخدام عند الدفع',
    refund: 'إرجاع نقاط',
    reversal: 'سحب نقاط',
    adjust: 'تعديل يدوي',
    expire: 'نقاط منتهية',
  },
};

export const txTypeLabel = (type, lang = 'en') =>
  (TX_TYPE_LABELS[lang] || TX_TYPE_LABELS.en)[type] || type;

export const WALLET_STATUSES = ['active', 'frozen', 'suspended'];

export const walletStatusLabel = (status, t) => t(`wallet.status_${status || 'active'}`);

export const orderRef = (id) => (id ? `#${String(id).slice(-8).toUpperCase()}` : '');