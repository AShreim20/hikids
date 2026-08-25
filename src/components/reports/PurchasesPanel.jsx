import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { StatCard, SectionCard, EmptyRow, MiniBar } from '@/components/reports/ReportShared';

export default function PurchasesPanel({ data }) {
  const { t, formatPrice } = useLanguage();
  const { total, count, bySupplier, byProduct, byDate } = data;
  const maxSup = Math.max(1, ...bySupplier.map((s) => s.total));
  const maxProd = Math.max(1, ...byProduct.map((p) => p.cost));
  const maxDate = Math.max(1, ...byDate.map((d) => d.total));

  return (
    <div className="grid gap-5">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('reports.totalPurchases')} value={formatPrice(total)} accent="cosmic" hint={`${count} ${t('reports.orders')}`} />
        <StatCard label={t('reports.suppliers')} value={bySupplier.length} />
        <StatCard label={t('reports.products')} value={byProduct.length} />
      </div>

      <SectionCard title={t('reports.purchasesByDate')}>
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
        <SectionCard title={t('reports.purchasesBySupplier')}>
          {bySupplier.length === 0 ? <EmptyRow text={t('reports.noData')} /> : (
            <div className="space-y-3">
              {bySupplier.map((s) => (
                <div key={s.supplier}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate me-2">{s.supplier}</span>
                    <span className="font-heading font-bold shrink-0">{formatPrice(s.total)}</span>
                  </div>
                  <MiniBar value={s.total} max={maxSup} color="bg-cosmic" />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title={t('reports.purchasesByProduct')}>
          {byProduct.length === 0 ? <EmptyRow text={t('reports.noData')} /> : (
            <div className="space-y-3">
              {byProduct.slice(0, 10).map((p) => (
                <div key={p.name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate me-2">{p.name}</span>
                    <span className="font-heading font-bold shrink-0">{formatPrice(p.cost)} · {p.qty}×</span>
                  </div>
                  <MiniBar value={p.cost} max={maxProd} color="bg-accent" />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}