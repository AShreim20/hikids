import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import SheetSelect from '@/components/ui/SheetSelect';
import SupplierFormDialog from './SupplierFormDialog';
import { useLanguage } from '@/context/LanguageContext';

// Supplier picker with an inline "New supplier" action and the selected
// supplier's outstanding balance shown beneath it.
export default function SupplierSelect({ suppliers, value, onChange, balance, onSupplierCreated }) {
  const { lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const [openForm, setOpenForm] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <SheetSelect
            value={value}
            onChange={onChange}
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            placeholder={ar ? 'اختر مورّدًا' : 'Select supplier'}
            label={ar ? 'المورّد' : 'Supplier'}
            includeEmpty
            className="w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40"
          />
        </div>
        <button
          type="button"
          onClick={() => setOpenForm(true)}
          className="squish h-12 px-4 rounded-full bg-mist font-heading font-bold text-sm inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> {ar ? 'جديد' : 'New'}
        </button>
      </div>
      {value && balance != null && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {ar ? 'الرصيد المستحق' : 'Outstanding balance'}:{' '}
          <span className="font-bold text-foreground">{formatPrice(balance)}</span>
        </p>
      )}
      <SupplierFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        initial={null}
        onSaved={(s) => onSupplierCreated?.(s)}
      />
    </div>
  );
}