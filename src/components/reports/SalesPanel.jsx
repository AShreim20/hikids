import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { StatCard, SectionCard, EmptyRow, MiniBar } from '@/components/reports/ReportShared';

export default function SalesPanel({ data }) {
  const { t, formatPrice } = useLanguage();
  const { orderCount, gross, discounts, net, returnsTotal, returnsCount, byDate, byProduct, byCategory } = data;
  const maxDate = Math.max(1, ...byDate.map((d) => d.total));
  const maxProd = Math.max(1, ...byProduct.map((p) => p.revenue));
  const maxCat = Math.max(1, ...byCategory.map((c) => c.revenue));

  return (
    <div className="grid gap-5">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('reports.netSales')} value={formatPrice(net)} accent="cosmic" hint={`${orderCount} ${t('reports.orders')}`} />
        <StatCard label={t('reports.grossSales')} value={formatPrice(gross)} />
        <StatCard label={t('reports.discounts')} value={formatPrice(discounts)} accent="accent" />
        <StatCard label={t('reports.returns')} value={formatPrice(returnsTotal)} accent={returnsTotal > 0 ? 'destructive' : undefined} hint={`${returnsCount} ${t('reports.returns')}`} />
      </div>

      <SectionCard title={t('reports.salesByDate')}>
        {byDate.length === 0 ? <EmptyRow text={t('reports.noData')} /> : (
          <div className="space-y-2.5">
            {byDate.map((d) => (
              <div key={d.date}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{d.date}</span>
                  <span className="font-heading font-bold">{formatPrice(d.total)}</span>
                </div>
                <MiniBar value={d.total} max={maxDate} />
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid md:grid-cols-2 gap-5">
        <SectionCard title={t('reports.salesByProduct')}>
          {byProduct.length === 0 ? <EmptyRow text={t('reports.noData')} /> : (
            <div className="space-y-3">
              {byProduct.slice(0, 10).map((p) => (
                <div key={p.name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate me-2">{p.name}</span>
                    <span className="font-heading font-bold shrink-0">{formatPrice(p.revenue)} · {p.qty}×</span>
                  </div>
                  <MiniBar value={p.revenue} max={maxProd} color="bg-accent" />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title={t('reports.salesByCategory')}>
          {byCategory.length === 0 ? <EmptyRow text={t('reports.noData')} /> : (
            <div className="space-y-3">
              {byCategory.map((c) => (
                <div key={c.category}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate me-2">{c.category}</span>
                    <span className="font-heading font-bold shrink-0">{formatPrice(c.revenue)}</span>
                  </div>
                  <MiniBar value={c.revenue} max={maxCat} color="bg-cosmic" />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}