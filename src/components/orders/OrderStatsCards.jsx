import React from 'react';
import { statusLabel, normalizeStatus, MAIN_FLOW, RETURN_STATUSES } from '@/lib/orderStatus';
import { useLanguage } from '@/context/LanguageContext';

// Clickable status counters + sales KPIs for the orders dashboard.
export default function OrderStatsCards({ orders, active, onPick }) {
  const { lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const count = (s) => orders.filter((o) => normalizeStatus(o.status) === s).length;

  const cards = [
    { key: 'all', label: ar ? 'كل الطلبات' : 'Total Orders', value: orders.length },
    ...MAIN_FLOW.map((s) => ({ key: s, label: statusLabel(s, lang), value: count(s) })),
    { key: 'cancelled', label: statusLabel('cancelled', lang), value: count('cancelled') },
    {
      key: 'returns',
      label: ar ? 'الإرجاع والاستبدال' : 'Returns',
      value: orders.filter((o) => RETURN_STATUSES.includes(normalizeStatus(o.status))).length,
    },
  ];

  const isSale = (o) => !['cancelled', 'returned'].includes(normalizeStatus(o.status));
  const sales = orders.filter(isSale);
  const sum = (list) => list.reduce((s, o) => s + Number(o.total || 0), 0);
  const since = (days) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - days);
    return sales.filter((o) => new Date(o.created_date) >= d);
  };
  const kpis = [
    { label: ar ? 'إجمالي المبيعات' : 'Total sales', value: formatPrice(sum(sales)) },
    { label: ar ? 'مبيعات اليوم' : "Today's sales", value: formatPrice(sum(since(0))) },
    { label: ar ? 'مبيعات الأسبوع' : 'This week', value: formatPrice(sum(since(7))) },
    { label: ar ? 'مبيعات الشهر' : 'This month', value: formatPrice(sum(since(30))) },
    {
      label: ar ? 'متوسط قيمة الطلب' : 'Avg. order value',
      value: formatPrice(sales.length ? sum(sales) / sales.length : 0),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl bg-card border border-border/60 p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-1 font-heading font-extrabold text-xl">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onPick(c.key)}
            className={`text-left rounded-2xl p-4 border-2 transition-all squish ${
              active === c.key ? 'border-cosmic bg-cosmic/5' : 'border-border/60 bg-card hover:border-cosmic/40'
            }`}
          >
            <p className="text-xs text-muted-foreground line-clamp-1">{c.label}</p>
            <p className="mt-1 font-heading font-extrabold text-2xl">{c.value}</p>
          </button>
        ))}
      </div>
    </div>
  );
}