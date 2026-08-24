import React from 'react';
import { Wallet, Sparkles, Hourglass } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { pointsToValue } from '@/lib/loyalty';

// Customer-facing wallet hero: wallet id, available balance, money value,
// pending points and the wallet's status.
export default function WalletCard({ wallet }) {
  const { t, formatPrice } = useLanguage();
  const balance = wallet?.balance || 0;
  const pending = wallet?.pending_points || 0;
  const status = wallet?.status || 'active';
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

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {wallet?.wallet_code && (
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide">
            {t('wallet.walletId')}: {wallet.wallet_code}
          </span>
        )}
        {pending > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
            <Hourglass className="w-3.5 h-3.5" />
            {t('wallet.pending')}: {pending.toLocaleString()}
          </span>
        )}
        {status !== 'active' && (
          <span className="rounded-full bg-white text-cosmic px-3 py-1 text-xs font-bold">
            {t(`wallet.status_${status}`)}
          </span>
        )}
      </div>
      {pending > 0 && (
        <p className="mt-3 text-xs text-white/60 max-w-md">{t('wallet.pendingNote')}</p>
      )}
    </div>
  );
}