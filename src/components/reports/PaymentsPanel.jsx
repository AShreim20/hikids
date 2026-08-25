import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { StatCard, SectionCard, EmptyRow, MiniBar } from '@/components/reports/ReportShared';

export default function PaymentsPanel({ data }) {
  const { t, formatPrice } = useLanguage();
  const { totalIn, completed, pending, failed, byMethod, byDate, supplierOut, supplierPaymentCount } = data;
  const maxDate = Math.max(1, ...byDate.map((d) => d.total));
  const maxMethod = Math.max(1, ...byMethod.map((m) => m.total));

  return (
    <div className="grid gap-5">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('reports.totalPayments')} value={formatPrice(totalIn)} accent="cosmic" />
        <StatCard label={t('reports.completed')} value={formatPrice(completed)} />
        <StatCard label={t('reports.pending')} value={formatPrice(pending)} accent="accent" />
        <StatCard label={t('reports.failed')} value={formatPrice(failed)} accent={failed > 0 ? 'destructive' : undefined} />
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <SectionCard title={t('reports.paymentsByMethod')}>
          {byMethod.length === 0 ? <EmptyRow text={t('reports.noData')} /> : (
            <div className="space-y-3">
              {byMethod.map((m) => (
                <div key={m.method}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{m.method}</span>
                    <span className="font-heading font-bold">{formatPrice(m.total)} · {m.count}×</span>
                  </div>
                  <MiniBar value={m.total} max={maxMethod} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title={t('reports.paymentsByDate')}>
          {byDate.length === 0 ? <EmptyRow text={t('reports.noData')} /> : (
            <div className="space-y-2.5">
              {byDate.map((d) => (
                <div key={d.date}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{d.date}</span>
                    <span className="font-heading font-bold">{formatPrice(d.total)}</span>
                  </div>
                  <MiniBar value={d.total} max={maxDate} color="bg-accent" />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title={t('reports.supplierPayments')}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('reports.supplierPaymentsOut')} · {supplierPaymentCount}×</span>
          <span className="font-heading font-extrabold text-destructive">- {formatPrice(supplierOut)}</span>
        </div>
      </SectionCard>
    </div>
  );
}