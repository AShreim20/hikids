import React, { useEffect, useState } from 'react';
import { Wallet, Coins, TrendingUp, Gift, Clock, Hourglass, CalendarPlus, CalendarMinus } from 'lucide-react';
import { loyaltyDashboardStats } from '@/lib/loyaltyFunctions';
import { useLanguage } from '@/context/LanguageContext';

// Programme-wide loyalty statistics (server-computed).
export default function WalletDashboard() {
  const { t, formatPrice } = useLanguage();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loyaltyDashboardStats()
      .then((res) => { if (res.success) setStats(res.stats); })
      .catch(() => {});
  }, []);

  if (!stats) return null;

  const cells = [
    { key: 'wallets', icon: Wallet, label: t('wallet.dashWallets'), value: stats.active_wallets },
    { key: 'circulation', icon: Coins, label: t('wallet.dashCirculation'), value: stats.in_circulation, hint: formatPrice(Math.round(stats.in_circulation * stats.point_value * 100) / 100) },
    { key: 'pending', icon: Hourglass, label: t('wallet.dashPending'), value: stats.pending },
    { key: 'earned', icon: TrendingUp, label: t('wallet.dashEarned'), value: stats.earned },
    { key: 'redeemed', icon: Gift, label: t('wallet.dashRedeemed'), value: stats.redeemed },
    { key: 'expired', icon: Clock, label: t('wallet.dashExpired'), value: stats.expired },
    { key: 'month_earned', icon: CalendarPlus, label: t('wallet.dashMonthEarned'), value: stats.earned_this_month },
    { key: 'month_redeemed', icon: CalendarMinus, label: t('wallet.dashMonthRedeemed'), value: stats.redeemed_this_month },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cells.map(({ key, icon: Icon, label, value, hint }) => (
        <div key={key} className="rounded-2xl bg-card border border-border/60 p-4">
          <div className="grid place-items-center w-9 h-9 rounded-xl bg-cosmic/10 text-cosmic">
            <Icon className="w-4 h-4" />
          </div>
          <p className="mt-2.5 text-xs text-muted-foreground">{label}</p>
          <p className="font-heading font-extrabold text-xl">{Number(value || 0).toLocaleString()}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      ))}
    </div>
  );
}