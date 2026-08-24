import React from 'react';
import { Wallet, Sparkles } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { pointsToValue } from '@/lib/loyalty';

// Customer-facing wallet hero: available balance + its money value.
export default function WalletCard({ wallet }) {
  const { t, formatPrice } = useLanguage();
  const balance = wallet?.balance || 0;
  const value = pointsToValue(balance, wallet?.redeem_rate);

  return (
    <div className="rounded-3xl bg-cosmic text-white p-6 sm:p-8 relative overflow-hidden">
      <Sparkles className="absolute top-6 end-6 w-24 h-24 text-white/10" />
      <div className="flex items-center gap-2 text-white/70">
        <Wallet className="w-4 h-4" />
        <p className="text-xs uppercase tracking-widest font-medium">{t('wallet.available')}</p>
      </div>
      <p className="mt-2 font-heading font-extrabold text-5xl sm:text-6xl">{balance.toLocaleString()}</p>
      <p className="mt-1 text-white/70">{t('wallet.value')}: {formatPrice(value)}</p>
      {wallet?.frozen && (
        <p className="mt-4 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{t('wallet.frozen')}</p>
      )}
    </div>
  );
}