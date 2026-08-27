import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { PERIODS } from '@/lib/reports';

export function PeriodSelector({ period, setPeriod, custom, setCustom }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-full bg-mist overflow-x-auto py-1 px-5">
        {PERIODS.map((p) =>
        <button
          key={p.id}
          onClick={() => setPeriod(p.id)}
          className={`shrink-0 h-9 px-4 rounded-full text-sm font-heading font-bold transition-colors py-5 ${period === p.id ? 'bg-cosmic text-white' : 'text-foreground/70 hover:bg-cosmic/10'}`}>
          
            {t(p.labelKey)}
          </button>
        )}
      </div>
      {period === 'custom' &&
      <div className="flex items-center gap-2">
          <input type="date" value={custom.from || ''} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="h-10 px-3 rounded-2xl bg-mist border border-border text-sm" />
          <span className="text-muted-foreground">–</span>
          <input type="date" value={custom.to || ''} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="h-10 px-3 rounded-2xl bg-mist border border-border text-sm" />
        </div>
      }
    </div>);

}

export function StatCard({ label, value, accent, hint }) {
  return (
    <div className={`rounded-3xl border py-5 px-5 my-4 ${accent === 'cosmic' ? 'bg-cosmic/5 border-cosmic/20' : accent === 'accent' ? 'bg-accent/5 border-accent/20' : accent === 'destructive' ? 'bg-destructive/5 border-destructive/20' : 'bg-card border-border/60'}`}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className={`mt-1.5 font-heading font-extrabold text-2xl ${accent === 'cosmic' ? 'text-cosmic' : accent === 'accent' ? 'text-accent' : accent === 'destructive' ? 'text-destructive' : ''}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>);

}

export function SectionCard({ title, children, right }) {
  return (
    <div className="rounded-3xl bg-card border border-border/60 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-heading font-bold">{title}</h3>
        {right}
      </div>
      {children}
    </div>);

}

export function EmptyRow({ text }) {
  return <p className="text-sm text-muted-foreground py-6 text-center">{text}</p>;
}

export function MiniBar({ value, max, color = 'bg-cosmic' }) {
  const pct = max > 0 ? Math.max(2, value / max * 100) : 0;
  return (
    <div className="mt-1.5 h-2 rounded-full bg-mist overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>);

}