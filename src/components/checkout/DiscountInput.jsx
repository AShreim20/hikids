import React, { useState } from 'react';
import { Tag, Loader2, X, Check } from 'lucide-react';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';

export default function DiscountInput({ subtotal, applied, onApplied, onRemoved }) {
  const { t, formatPrice } = useLanguage();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    if (!code.trim() || applied) return;
    setBusy(true);
    try {
      const res = await invokeFunction('validateDiscount', { code: code.trim(), subtotal });
      if (res.valid) {
        onApplied({ id: res.code.id, code: res.code.code, amount: res.discount_amount });
        toast({ title: t('checkout.discountApplied') });
      } else {
        toast({ title: res.message || t('checkout.invalidCode'), variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-2xl bg-cosmic/10 border border-cosmic/30 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Tag className="w-4 h-4 text-cosmic" />
          <span className="font-heading font-bold">{applied.code}</span>
          <span className="text-muted-foreground">−{formatPrice(applied.amount)}</span>
        </div>
        <button type="button" onClick={onRemoved} className="grid place-items-center w-8 h-8 rounded-full hover:bg-cosmic/10" aria-label="Remove">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Tag className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
          placeholder={t('checkout.promo')}
          className="w-full h-12 ps-10 pe-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
        />
      </div>
      <button type="button" onClick={apply} disabled={busy} className="h-12 px-5 rounded-2xl bg-cosmic text-white font-heading font-bold inline-flex items-center gap-2 disabled:opacity-60">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {t('checkout.apply')}
      </button>
    </div>
  );
}