import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { StatCard, SectionCard, EmptyRow } from '@/components/reports/ReportShared';

export default function ProfitLossPanel({ data }) {
  const { t, formatPrice } = useLanguage();
  const { revenue, cogs, grossProfit, expenses, netProfit, orderCount } = data;
  const margin = revenue > 0 ? Math.round((grossProfit / revenue) * 100) : 0;
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
          <Row label={t('reports.revenue')} value={formatPrice(revenue)} strong />
          <Row label={t('reports.cogs')} value={`- ${formatPrice(cogs)}`} negative />
          <Row label={t('reports.grossProfit')} value={formatPrice(grossProfit)} strong />
          <Row label={t('reports.expenses')} value={expenses > 0 ? `- ${formatPrice(expenses)}` : t('reports.noExpenses')} negative={expenses > 0} />
          <Row label={t('reports.netProfit')} value={formatPrice(netProfit)} strong accent />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{t('reports.pnlNote')}</p>
      </SectionCard>
    </div>
  );
}

function Row({ label, value, strong, negative, accent }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-mist/60 px-4 py-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${strong ? 'font-heading font-extrabold' : 'font-medium'} ${negative ? 'text-destructive' : accent ? 'text-cosmic' : ''}`}>{value}</span>
    </div>
  );
}