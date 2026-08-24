import React from 'react';
import { Search } from 'lucide-react';
import SheetSelect from '@/components/ui/SheetSelect';
import { useLanguage } from '@/context/LanguageContext';

// Search + filter + sort controls for the orders list.
export default function OrderFilters({ value, onChange, cities }) {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const set = (k) => (v) => onChange({ ...value, [k]: v });

  const field = 'h-11 w-full px-4 rounded-2xl bg-card border border-border text-sm';

  return (
    <div className="rounded-3xl bg-card border border-border/60 p-4 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
      <div className="relative md:col-span-2 lg:col-span-2">
        <Search className="absolute top-1/2 -translate-y-1/2 ltr:left-4 rtl:right-4 w-4 h-4 text-muted-foreground" />
        <input
          value={value.q}
          onChange={(e) => set('q')(e.target.value)}
          placeholder={ar ? 'رقم الطلب، الاسم أو الهاتف…' : 'Order number, name or phone…'}
          className={`${field} ltr:pl-11 rtl:pr-11`}
        />
      </div>

      <SheetSelect
        className={field}
        includeEmpty={false}
        value={value.city}
        onChange={set('city')}
        options={[
          { value: '', label: ar ? 'كل المدن' : 'All cities' },
          ...cities.map((c) => ({ value: c, label: c })),
        ]}
      />

      <SheetSelect
        className={field}
        includeEmpty={false}
        value={value.payment}
        onChange={set('payment')}
        options={[
          { value: '', label: ar ? 'كل طرق الدفع' : 'All payment methods' },
          { value: 'card', label: ar ? 'بطاقة' : 'Card' },
          { value: 'cod', label: ar ? 'عند الاستلام' : 'Cash on delivery' },
          { value: 'loyalty', label: ar ? 'نقاط' : 'Loyalty points' },
        ]}
      />

      <SheetSelect
        className={field}
        includeEmpty={false}
        value={value.paymentStatus}
        onChange={set('paymentStatus')}
        options={[
          { value: '', label: ar ? 'كل حالات الدفع' : 'Any payment status' },
          { value: 'paid', label: ar ? 'مدفوع' : 'Paid' },
          { value: 'unpaid', label: ar ? 'غير مدفوع' : 'Unpaid' },
          { value: 'refunded', label: ar ? 'مُرجَع' : 'Refunded' },
          { value: 'failed', label: ar ? 'فاشل' : 'Failed' },
        ]}
      />

      <label className="block">
        <span className="text-xs text-muted-foreground">{ar ? 'من تاريخ' : 'From'}</span>
        <input type="date" value={value.from} onChange={(e) => set('from')(e.target.value)} className={`${field} mt-1`} />
      </label>
      <label className="block">
        <span className="text-xs text-muted-foreground">{ar ? 'إلى تاريخ' : 'To'}</span>
        <input type="date" value={value.to} onChange={(e) => set('to')(e.target.value)} className={`${field} mt-1`} />
      </label>

      <SheetSelect
        className={field}
        includeEmpty={false}
        value={value.sort}
        onChange={set('sort')}
        options={[
          { value: 'newest', label: ar ? 'الأحدث أولاً' : 'Newest first' },
          { value: 'oldest', label: ar ? 'الأقدم أولاً' : 'Oldest first' },
          { value: 'total_desc', label: ar ? 'الأعلى قيمة' : 'Highest total' },
          { value: 'total_asc', label: ar ? 'الأقل قيمة' : 'Lowest total' },
          { value: 'status', label: ar ? 'الحالة' : 'Status' },
          { value: 'customer', label: ar ? 'اسم الزبون' : 'Customer name' },
        ]}
      />
    </div>
  );
}