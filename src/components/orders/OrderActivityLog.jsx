import React from 'react';
import { History } from 'lucide-react';
import { statusLabel } from '@/lib/orderStatus';
import { useLanguage } from '@/context/LanguageContext';

// Chronological record of every change made to the order.
export default function OrderActivityLog({ order }) {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const entries = [...(order.activity || [])].reverse();

  return (
    <div className="rounded-3xl bg-card border border-border/60 p-5 sm:p-6">
      <h2 className="font-heading font-extrabold text-xl flex items-center gap-2">
        <History className="w-5 h-5 text-cosmic" /> {ar ? 'سجل النشاط' : 'Activity log'}
      </h2>
      <div className="mt-4 space-y-3">
        <div className="text-sm">
          <p className="font-medium">{ar ? 'تم إنشاء الطلب' : 'Order created'}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(order.created_date).toLocaleString(ar ? 'ar' : 'en')}
            {order.customer_name ? ` · ${order.customer_name}` : ''}
          </p>
        </div>
        {entries.map((a, i) => (
          <div key={i} className="text-sm pt-3 border-t border-border/60">
            <p className="font-medium">
              {a.action === 'status'
                ? `${ar ? 'تغيير الحالة' : 'Status changed'}: ${statusLabel(a.from, lang)} → ${statusLabel(a.to, lang)}`
                : a.action === 'payment_status'
                ? `${ar ? 'حالة الدفع' : 'Payment status'}: ${a.from || '—'} → ${a.to}`
                : a.action === 'note'
                ? ar ? 'تحديث الملاحظات' : 'Notes updated'
                : a.action === 'delivery'
                ? ar ? 'تحديث بيانات التوصيل' : 'Delivery details updated'
                : a.action}
            </p>
            {a.note && <p className="text-xs text-muted-foreground mt-0.5">{a.note}</p>}
            <p className="text-xs text-muted-foreground">
              {new Date(a.at).toLocaleString(ar ? 'ar' : 'en')}{a.by ? ` · ${a.by}` : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}