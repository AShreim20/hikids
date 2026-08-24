import React from 'react';
import { Check, Circle } from 'lucide-react';
import { MAIN_FLOW, normalizeStatus, statusLabel } from '@/lib/orderStatus';
import { useLanguage } from '@/context/LanguageContext';

// Visual progress of the order through the main lifecycle, annotated with the
// date/time and the staff member who set each step (from the activity log).
export default function OrderTimeline({ order }) {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const current = normalizeStatus(order.status);
  const currentIndex = MAIN_FLOW.indexOf(current);

  const entryFor = (status) =>
    (order.activity || []).filter((a) => a.to === status).slice(-1)[0] ||
    (status === 'new'
      ? { at: order.created_date, by: order.customer_name }
      : null);

  return (
    <div className="rounded-3xl bg-card border border-border/60 p-5 sm:p-6">
      <h2 className="font-heading font-extrabold text-xl">{ar ? 'مسار الطلب' : 'Order timeline'}</h2>
      <ol className="mt-4 space-y-4">
        {MAIN_FLOW.map((s, i) => {
          const done = currentIndex >= i && currentIndex !== -1;
          const entry = entryFor(s);
          const at = entry?.at ? new Date(entry.at) : null;
          return (
            <li key={s} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`grid place-items-center w-8 h-8 rounded-full shrink-0 ${
                    done ? 'bg-cosmic text-white' : 'bg-mist text-muted-foreground'
                  }`}
                >
                  {done ? <Check className="w-4 h-4" /> : <Circle className="w-3 h-3" />}
                </span>
                {i < MAIN_FLOW.length - 1 && (
                  <span className={`w-0.5 flex-1 mt-1 ${done ? 'bg-cosmic/40' : 'bg-border'}`} />
                )}
              </div>
              <div className="pb-2">
                <p className={`font-heading font-bold ${done ? '' : 'text-muted-foreground'}`}>
                  {statusLabel(s, lang)}
                </p>
                {at && (
                  <p className="text-xs text-muted-foreground">
                    {at.toLocaleDateString(ar ? 'ar' : 'en')} · {at.toLocaleTimeString(ar ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' })}
                    {entry.by ? ` · ${entry.by}` : ''}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {currentIndex === -1 && (
        <p className="mt-2 text-sm font-heading font-bold text-destructive">
          {ar ? 'الحالة الحالية: ' : 'Current status: '}{statusLabel(order.status, lang)}
        </p>
      )}
    </div>
  );
}