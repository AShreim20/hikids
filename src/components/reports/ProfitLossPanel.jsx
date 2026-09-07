import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { StatCard, SectionCard, EmptyRow, MiniBar } from '@/components/reports/ReportShared';

export default function ProfitLossPanel({ data }) {
  const { t, formatPrice, lang } = useLanguage();
  const ar = lang === 'ar';
  const {
    grossSales, discounts, revenue, cogs, grossProfit,
    expenses, expensesByCategory, netProfit, orderCount,
  } = data;
  const margin = revenue > 0 ? Math.round((grossProfit / revenue) * 100) : 0;
  const maxExpenseCat = Math.max(1, ...(expensesByCategory || []).map((c) => c.total));

  return (
    <div className="grid gap-5">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('reports.revenue')} value={formatPrice(revenue)} accent="cosmic" hint={`${orderCount} ${t('reports.orders')}`} />
        <StatCard label={t('reports.cogs')} value={formatPrice(cogs)} accent="destructive" />
        <StatCard label={t('reports.grossProfit')} value={formatPrice(grossProfit)} accent={grossProfit >= 0 ? 'cosmic' : 'destructive'} hint={`${margin}% ${t('reports.margin')}`} />
        <StatCard label={t('reports.netProfit')} value={formatPrice(netProfit)} accent={netProfit >= 0 ? 'cosmic' : 'destructive'} />
      </div>

      <SectionCard title={t('reports.pnlBreakdown')}>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <Row label={t('reports.grossSales')} value={formatPrice(grossSales)} />
          <Row label={t('reports.discounts')} value={discounts > 0 ? `- ${formatPrice(discounts)}` : t('reports.noExpenses')} negative={discounts > 0} />
          <Row label={t('reports.revenue')} value={formatPrice(revenue)} strong />
          <Row label={t('reports.cogs')} value={`- ${formatPrice(cogs)}`} negative />
          <Row label={t('reports.grossProfit')} value={formatPrice(grossProfit)} strong accent />
          <Row label={t('reports.expenses')} value={expenses > 0 ? `- ${formatPrice(expenses)}` : t('reports.noExpenses')} negative={expenses > 0} />
          <Row label={t('reports.netProfit')} value={formatPrice(netProfit)} strong accent />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{t('reports.pnlNote')}</p>
      </SectionCard>

      <SectionCard title={t('reports.expensesByCategory')}>
        {(expensesByCategory || []).length === 0 ? <EmptyRow text={t('reports.noData')} /> : (
          <div className="space-y-3">
            {expensesByCategory.map((c) => {
              const label = c.name ? (ar ? c.name : (c.name_en || c.name)) : t('expenses.uncategorized');
              return (
                <div key={c.category_id || 'uncategorized'}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate me-2">{label}</span>
                    <span className="font-heading font-bold shrink-0">{formatPrice(c.total)}</span>
                  </div>
                  <MiniBar value={c.total} max={maxExpenseCat} color="bg-destructive" />
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function Row({ label, value, strong, negative, accent }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-mist/60 px-4 py-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${strong ? 'font-heading font-extrabold' : 'font-medium'} ${negative ? 'text-destructive' : accent ? 'text-cosmic' : ''}`}><bdi>{value}</bdi></span>
    </div>
  );
}
