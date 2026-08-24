import React, { useState } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import SheetSelect from '@/components/ui/SheetSelect';
import { useLanguage } from '@/context/LanguageContext';

const field = 'h-11 w-full px-4 rounded-2xl bg-mist border border-border text-sm';

// Editable customer / delivery / payment details. Saving asks for confirmation
// and reports the changed fields so the caller can log them.
export default function OrderEditPanel({ order, cities, onSave, saving, canEditCustomer }) {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const [form, setForm] = useState({
    customer_name: order.customer_name || '',
    phone: order.phone || '',
    address: order.address || '',
    city: order.city || '',
    delivery_cost: order.delivery_cost ?? 0,
    payment_status: order.payment_status || 'unpaid',
    delivery_notes: order.delivery_notes || '',
    internal_notes: order.internal_notes || '',
  });
  const [confirm, setConfirm] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const changed = Object.keys(form).filter(
    (k) => String(form[k] ?? '') !== String(order[k] ?? (k === 'delivery_cost' ? 0 : ''))
  );

  const save = () => {
    const patch = {};
    changed.forEach((k) => { patch[k] = k === 'delivery_cost' ? Number(form[k] || 0) : form[k]; });
    onSave(patch, changed.map((k) => `${k}: ${order[k] ?? '—'} → ${form[k]}`).join(' | '));
    setConfirm(false);
  };

  return (
    <div className="rounded-3xl bg-card border border-border/60 p-5 sm:p-6">
      <h2 className="font-heading font-extrabold text-xl">{ar ? 'تعديل الطلب' : 'Edit order'}</h2>

      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-muted-foreground">{ar ? 'اسم الزبون' : 'Customer name'}</span>
          <input disabled={!canEditCustomer} value={form.customer_name} onChange={(e) => set('customer_name')(e.target.value)} className={`${field} mt-1 disabled:opacity-60`} />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">{ar ? 'الهاتف' : 'Phone'}</span>
          <input disabled={!canEditCustomer} value={form.phone} onChange={(e) => set('phone')(e.target.value)} className={`${field} mt-1 disabled:opacity-60`} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs text-muted-foreground">{ar ? 'العنوان' : 'Address'}</span>
          <input value={form.address} onChange={(e) => set('address')(e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">{ar ? 'المدينة' : 'City'}</span>
          <SheetSelect
            className={`${field} mt-1`}
            includeEmpty={false}
            value={form.city}
            onChange={set('city')}
            options={cities.map((c) => ({ value: c, label: c }))}
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">{ar ? 'أجرة التوصيل' : 'Delivery fee'}</span>
          <input type="number" min="0" step="0.01" value={form.delivery_cost} onChange={(e) => set('delivery_cost')(e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">{ar ? 'حالة الدفع' : 'Payment status'}</span>
          <SheetSelect
            className={`${field} mt-1`}
            includeEmpty={false}
            value={form.payment_status}
            onChange={set('payment_status')}
            options={[
              { value: 'unpaid', label: ar ? 'غير مدفوع' : 'Unpaid' },
              { value: 'paid', label: ar ? 'مدفوع' : 'Paid' },
              { value: 'refunded', label: ar ? 'مُرجَع' : 'Refunded' },
              { value: 'failed', label: ar ? 'فاشل' : 'Failed' },
            ]}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs text-muted-foreground">{ar ? 'تعليمات التوصيل' : 'Delivery instructions'}</span>
          <textarea rows={2} value={form.delivery_notes} onChange={(e) => set('delivery_notes')(e.target.value)} className="mt-1 w-full p-3 rounded-2xl bg-mist border border-border text-sm resize-none" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs text-muted-foreground">{ar ? 'ملاحظات داخلية' : 'Internal notes'}</span>
          <textarea rows={2} value={form.internal_notes} onChange={(e) => set('internal_notes')(e.target.value)} className="mt-1 w-full p-3 rounded-2xl bg-mist border border-border text-sm resize-none" />
        </label>
      </div>

      {confirm ? (
        <div className="mt-4 rounded-2xl bg-accent/10 border border-accent/30 p-4">
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            {ar ? 'هل أنت متأكد من تعديل هذا الطلب؟' : 'Are you sure you want to modify this order?'}
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={save} disabled={saving} className="squish h-10 px-4 rounded-full bg-cosmic text-white font-heading font-bold text-sm disabled:opacity-60">
              {ar ? 'تأكيد الحفظ' : 'Confirm & save'}
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="squish h-10 px-4 rounded-full bg-mist font-heading font-bold text-sm">
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={changed.length === 0 || saving}
          onClick={() => setConfirm(true)}
          className="squish mt-4 inline-flex items-center gap-2 h-12 px-5 rounded-full bg-cosmic text-white font-heading font-bold disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {ar ? 'حفظ التعديلات' : 'Save changes'}
        </button>
      )}
    </div>
  );
}