import React from 'react';
import { TrendingUp, Gift, RotateCcw, Clock, Hourglass } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

// Wallet totals grid — earned / spent / removed / expired / pending.
export default function WalletStats({ wallet }) {
  const { t } = useLanguage();
  const cells = [
    { key: 'earned', icon: TrendingUp, label: t('wallet.earned'), value: wallet?.lifetime_earned || 0 },
    { key: 'spent', icon: Gift, label: t('wallet.spent'), value: wallet?.lifetime_spent || 0 },
    { key: 'pending', icon: Hourglass, label: t('wallet.pending'), value: wallet?.pending_points || 0 },
    { key: 'removed', icon: RotateCcw, label: t('wallet.removed'), value: wallet?.lifetime_removed || 0 },
    { key: 'expired', icon: Clock, label: t('wallet.expired'), value: wallet?.expired_points || 0 },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
      {cells.map(({ key, icon: Icon, label, value }) => (
        <div key={key} className="rounded-2xl bg-card border border-border/60 p-4">
          <div className="grid place-items-center w-9 h-9 rounded-xl bg-cosmic/10 text-cosmic">
            <Icon className="w-4 h-4" />
          </div>
          <p className="mt-2.5 text-xs text-muted-foreground">{label}</p>
          <p className="font-heading font-extrabold text-xl">{Number(value).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}