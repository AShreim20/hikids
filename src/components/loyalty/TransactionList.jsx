import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { txTypeLabel } from '@/lib/loyalty';

// Ledger rows: signed points, reason, related order and running balance.
export default function TransactionList({ transactions = [], showBalance = true, showActor = false }) {
  const { t, lang } = useLanguage();

  if (!transactions.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t('wallet.noActivity')}</p>;
  }

  return (
    <ul className="divide-y divide-border/60">
      {transactions.map((tx) => {
        const positive = (tx.points || 0) > 0;
        return (
          <li key={tx.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-heading font-bold text-sm truncate">
                {tx.reason || txTypeLabel(tx.type, lang)}
              </p>
              <p className="text-xs text-muted-foreground">
                {txTypeLabel(tx.type, lang)}
                {tx.order_id ? ` · #${String(tx.order_id).slice(-8).toUpperCase()}` : ''}
                {tx.created_date ? ` · ${new Date(tx.created_date).toLocaleString(lang === 'ar' ? 'ar' : 'en-GB')}` : ''}
                {showActor && tx.actor_email ? ` · ${tx.actor_email}` : ''}
              </p>
            </div>
            <div className="text-end shrink-0">
              <p className={`font-heading font-extrabold ${positive ? 'text-accent' : 'text-destructive'}`}>
                {positive ? '+' : ''}{Number(tx.points).toLocaleString()}
              </p>
              {showBalance && (
                <p className="text-xs text-muted-foreground">{t('wallet.balanceAfter')}: {tx.balance_after}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}