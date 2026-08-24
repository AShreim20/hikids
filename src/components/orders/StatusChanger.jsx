import React, { useState } from 'react';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import SheetSelect from '@/components/ui/SheetSelect';
import {
  allowedTransitions, nextStatus, normalizeStatus, statusLabel, isWorkflowOverride,
} from '@/lib/orderStatus';
import { useLanguage } from '@/context/LanguageContext';

// Status control that follows the workflow (next step highlighted) and asks for
// confirmation before any override.
export default function StatusChanger({ order, isOwner, onChange, saving }) {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const current = normalizeStatus(order.status);
  const next = nextStatus(current);
  const options = allowedTransitions(current, { isOwner });
  const [picked, setPicked] = useState('');
  const [confirm, setConfirm] = useState(null);

  const request = (to) => {
    if (!to) return;
    if (isWorkflowOverride(current, to)) setConfirm(to);
    else onChange(to);
  };

  return (
    <div className="rounded-3xl bg-card border border-border/60 p-5 sm:p-6">
      <h2 className="font-heading font-extrabold text-xl">{ar ? 'تغيير الحالة' : 'Change status'}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {ar ? 'الحالة الحالية' : 'Current'}: <strong>{statusLabel(current, lang)}</strong>
      </p>

      {next && (
        <button
          type="button"
          disabled={saving}
          onClick={() => onChange(next)}
          className="squish mt-4 inline-flex items-center gap-2 h-12 px-5 rounded-full bg-cosmic text-white font-heading font-bold disabled:opacity-60"
        >
          {ar ? 'الانتقال إلى' : 'Advance to'} {statusLabel(next, lang)}
          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        </button>
      )}

      <div className="mt-4 grid sm:grid-cols-[1fr_auto] gap-2">
        <SheetSelect
          className="h-11 w-full px-4 rounded-2xl bg-mist border border-border text-sm"
          includeEmpty={false}
          value={picked}
          onChange={setPicked}
          options={[
            { value: '', label: ar ? 'حالة أخرى…' : 'Other status…' },
            ...options.map((s) => ({ value: s, label: statusLabel(s, lang) })),
          ]}
        />
        <button
          type="button"
          disabled={!picked || saving}
          onClick={() => request(picked)}
          className="squish h-11 px-5 rounded-2xl bg-mist font-heading font-bold text-sm disabled:opacity-50"
        >
          {ar ? 'تطبيق' : 'Apply'}
        </button>
      </div>

      {confirm && (
        <div className="mt-4 rounded-2xl bg-destructive/10 border border-destructive/30 p-4">
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            {ar
              ? `هل أنت متأكد من تعديل هذا الطلب إلى "${statusLabel(confirm, lang)}" خارج المسار الطبيعي؟`
              : `Are you sure you want to modify this order to "${statusLabel(confirm, lang)}" outside the normal workflow?`}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => { onChange(confirm, { override: true }); setConfirm(null); setPicked(''); }}
              className="squish h-10 px-4 rounded-full bg-destructive text-white font-heading font-bold text-sm"
            >
              {ar ? 'تأكيد' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => setConfirm(null)}
              className="squish h-10 px-4 rounded-full bg-mist font-heading font-bold text-sm"
            >
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}