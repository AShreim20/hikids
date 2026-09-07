import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { StatCard, SectionCard, EmptyRow, MiniBar } from '@/components/reports/ReportShared';

const METHOD_LABEL = { cash: 'Cash', card: 'Card', bank_transfer: 'Bank transfer', cheque: 'Cheque', unknown: '—' };
const METHOD_LABEL_AR = { cash: 'نقدًا', card: 'بطاقة', bank_transfer: 'تحويل بنكي', cheque: 'شيك', unknown: '—' };

export default function ExpensesPanel({ data }) {
  const { t, formatPrice, lang } = useLanguage();
  const ar = lang === 'ar';
  const { total, count, byCategory, byDate, byMethod } = data;
  const maxCat = Math.max(1, ...byCategory.map((c) => c.total));
  const maxDate = Math.max(1, ...byDate.map((d) => d.total));

  return (
    <div className="grid gap-5">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('reports.totalExpenses')} value={formatPrice(total)} accent="destructive" hint={`${count} ${t('expenses.title')}`} />
        <StatCard label={t('expenses.categoriesCount')} value={byCategory.length} />
      </div>

      <SectionCard title={t('reports.expensesByDate')}>
        {byDate.length === 0 ? <EmptyRow text={t('reports.noData')} /> : (
          <div className="space-y-2.5">
            {byDate.map((d) => (
              <div key={d.date}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground"><bdi>{d.date}</bdi></span>
                  <span className="font-heading font-bold">{formatPrice(d.total)}</span>
                </div>
                <MiniBar value={d.total} max={maxDate} color="bg-destructive" />
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid md:grid-cols-2 gap-5">
        <SectionCard title={t('reports.expensesByCategory')}>
          {byCategory.length === 0 ? <EmptyRow text={t('reports.noData')} /> : (
            <div className="space-y-3">
              {byCategory.map((c) => {
                const label = c.name ? (ar ? c.name : (c.name_en || c.name)) : t('expenses.uncategorized');
                return (
                  <div key={c.category_id || 'uncategorized'}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate me-2">{label}</span>
                      <span className="font-heading font-bold shrink-0">{formatPrice(c.total)} · {c.count}×</span>
                    </div>
                    <MiniBar value={c.total} max={maxCat} color="bg-destructive" />
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title={t('expenses.paymentMethod')}>
          {byMethod.length === 0 ? <EmptyRow text={t('reports.noData')} /> : (
            <div className="space-y-3">
              {byMethod.map((m) => (
                <div key={m.method} className="flex items-center justify-between text-sm">
                  <span>{(ar ? METHOD_LABEL_AR : METHOD_LABEL)[m.method] || m.method}</span>
                  <span className="font-heading font-bold">{formatPrice(m.total)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
