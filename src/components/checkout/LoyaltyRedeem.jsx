import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { REDEEM_RATE } from '@/lib/loyalty';

export default function LoyaltyRedeem({ subtotal, applied, onApplied, onRemoved }) {
  const { t, formatPrice } = useLanguage();
  const { toast } = useToast();
  const [balance, setBalance] = useState(0);
  const [rate, setRate] = useState(REDEEM_RATE);
  const [points, setPoints] = useState('');

  useEffect(() => {
    base44.functions.invoke('getLoyaltyBalance')
      .then((res) => { if (res.success) { setBalance(res.balance); if (res.redeem_rate) setRate(res.redeem_rate); } })
      .catch(() => {});
  }, []);

  const apply = () => {
    const p = Math.floor(Number(points) || 0);
    if (p <= 0) return;
    if (p > balance) {
      toast({ title: t('loyalty.insufficient'), variant: 'destructive' });
      return;
    }
    let amount = Math.round(p * rate * 100) / 100;
    if (amount > subtotal) amount = subtotal;
    onApplied({ points: p, amount });
  };

  if (balance <= 0) return null;

  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-2xl bg-accent/10 border border-accent/30 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="font-heading font-bold">{applied.points} {t('loyalty.points')}</span>
          <span className="text-muted-foreground">−{formatPrice(applied.amount)}</span>
        </div>
        <button type="button" onClick={onRemoved} className="grid place-items-center w-8 h-8 rounded-full hover:bg-accent/10" aria-label="Remove">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-mist border border-border p-4">
      <div className="flex items-center gap-2 text-sm">
        <Sparkles className="w-4 h-4 text-accent" />
        <span className="font-heading font-bold">{t('loyalty.balance')}: {balance}</span>
        <span className="text-muted-foreground">· {formatPrice(Math.round(balance * rate * 100) / 100)}</span>
      </div>
      <div className="mt-3 flex gap-2">
        <input
          type="number"
          min="1"
          max={balance}
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
          placeholder={t('loyalty.redeemPlaceholder')}
          className="flex-1 h-12 px-4 rounded-2xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        />
        <button type="button" onClick={apply} className="h-12 px-5 rounded-2xl bg-accent text-white font-heading font-bold">{t('checkout.apply')}</button>
      </div>
    </div>
  );
}