import React, { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { pointsToValue } from '@/lib/loyalty';

// Checkout wallet panel: opt in, choose how many points to spend (or use max),
// see the live money value and how much of the order remains to pay.
export default function LoyaltyRedeem({ subtotal, deliveryCost = 0, discountAmount = 0, orderTotal, applied, onApplied, onRemoved }) {
  const { t, formatPrice } = useLanguage();
  const { toast } = useToast();
  const [wallet, setWallet] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [points, setPoints] = useState('');

  useEffect(() => {
    base44.functions.invoke('getLoyaltyBalance', {
      subtotal, delivery_cost: deliveryCost, discount_amount: discountAmount, limit: 1,
    })
      .then((res) => { if (res.success) setWallet(res); })
      .catch(() => {});
  }, [subtotal, deliveryCost, discountAmount]);

  if (!wallet || (wallet.balance || 0) <= 0) return null;

  const rate = wallet.redeem_rate;
  const maxPoints = wallet.max_redeem_points || 0;
  const previewPoints = Math.min(Math.floor(Number(points) || 0), maxPoints);
  const previewValue = Math.min(pointsToValue(previewPoints, rate), wallet.max_redeem_amount || 0);

  const apply = () => {
    const p = Math.floor(Number(points) || 0);
    if (p <= 0) return;
    if (wallet.frozen) { toast({ title: t('wallet.frozen'), variant: 'destructive' }); return; }
    if (wallet.blocked_by_discount) { toast({ title: t('wallet.noCombine'), variant: 'destructive' }); return; }
    if (p > (wallet.balance || 0)) { toast({ title: t('loyalty.insufficient'), variant: 'destructive' }); return; }
    if (wallet.min_redeem > 0 && p < wallet.min_redeem) {
      toast({ title: `${t('wallet.minRedeem')}: ${wallet.min_redeem}`, variant: 'destructive' });
      return;
    }
    if (p > maxPoints) {
      toast({ title: `${t('wallet.maxRedeem')}: ${maxPoints}`, variant: 'destructive' });
      return;
    }
    onApplied({ points: p, amount: pointsToValue(p, rate) });
  };

  if (applied) {
    const remaining = Math.max(0, (orderTotal ?? 0));
    return (
      <div className="rounded-2xl bg-accent/10 border border-accent/30 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <Sparkles className="w-4 h-4 text-accent shrink-0" />
            <span className="font-heading font-bold">{applied.points.toLocaleString()} {t('loyalty.points')}</span>
            <span className="text-muted-foreground">−{formatPrice(applied.amount)}</span>
          </div>
          <button type="button" onClick={onRemoved} className="grid place-items-center w-8 h-8 rounded-full hover:bg-accent/10 shrink-0" aria-label={t('loyalty.cancel')}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t('wallet.remaining')}: <strong>{formatPrice(remaining)}</strong>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-mist border border-border p-4">
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-1 w-4 h-4 rounded"
        />
        <span className="text-sm">
          <span className="font-heading font-bold">{t('wallet.useTitle')}</span>
          <span className="block text-xs text-muted-foreground">
            {t('wallet.available')}: {(wallet.balance || 0).toLocaleString()} {t('loyalty.points')} ({formatPrice(pointsToValue(wallet.balance, rate))})
          </span>
        </span>
      </label>

      {enabled && (
        <div className="mt-3 float-in">
          {wallet.blocked_by_discount ? (
            <p className="text-xs text-destructive">{t('wallet.noCombine')}</p>
          ) : maxPoints <= 0 ? (
            <p className="text-xs text-muted-foreground">{t('wallet.notApplicable')}</p>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max={maxPoints}
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
                  placeholder={t('loyalty.redeemPlaceholder')}
                  className="flex-1 h-12 px-4 rounded-2xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                />
                <button type="button" onClick={() => setPoints(String(maxPoints))} className="h-12 px-4 rounded-2xl bg-background border border-border font-heading font-bold text-sm">
                  {t('wallet.useMax')}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t('wallet.value')}: <strong>{formatPrice(previewValue)}</strong> · {t('wallet.maxRedeem')}: {maxPoints.toLocaleString()}
              </p>
              <button type="button" onClick={apply} className="mt-3 squish w-full h-12 rounded-2xl bg-accent text-white font-heading font-bold">
                {t('wallet.usePoints')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}