import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { txTypeLabel, orderRef } from '@/lib/loyalty';

// Ledger rows: signed points, reason, related order and running balance.
// Each row expands to the full transaction record for auditing.
export default function TransactionList({ transactions = [], showBalance = true, showActor = false }) {
  const { t, lang } = useLanguage();
  const [openId, setOpenId] = useState(null);
  const locale = lang === 'ar' ? 'ar' : 'en-GB';

  if (!transactions.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t('wallet.noActivity')}</p>;
  }

  return (
    <ul className="divide-y divide-border/60">
      {transactions.map((tx) => {
        const positive = (tx.points || 0) > 0;
        const open = openId === tx.id;
        return (
          <li key={tx.id} className="py-1">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : tx.id)}
              className="w-full flex items-start justify-between gap-3 py-2.5 text-start"
            >
              <div className="min-w-0">
                <p className="font-heading font-bold text-sm truncate">
                  {tx.reason || txTypeLabel(tx.type, lang)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {txTypeLabel(tx.type, lang)}
                  {tx.order_id ? ` · ${orderRef(tx.order_id)}` : ''}
                  {tx.created_date ? ` · ${new Date(tx.created_date).toLocaleString(locale)}` : ''}
                  {showActor && tx.actor_email ? ` · ${tx.actor_email}` : ''}
                  {tx.status === 'reversed' ? ` · ${t('wallet.reversed')}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-end">
                  <p className={`font-heading font-extrabold ${positive ? 'text-accent' : 'text-destructive'}`}>
                    {positive ? '+' : ''}{Number(tx.points).toLocaleString()}
                  </p>
                  {showBalance && (
                    <p className="text-xs text-muted-foreground">{t('wallet.balanceAfter')}: {tx.balance_after}</p>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {open && (
              <dl className="mb-3 rounded-2xl bg-mist border border-border/60 p-3 grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs float-in">
                <Row label={t('wallet.txId')} value={tx.id} />
                <Row label={t('wallet.walletId')} value={tx.wallet_code || tx.account_id} />
                <Row label={t('wallet.txType')} value={tx.type} />
                <Row label={t('wallet.txStatus')} value={tx.status || 'completed'} />
                <Row label={t('wallet.before')} value={Number(tx.balance_before || 0).toLocaleString()} />
                <Row label={t('wallet.balanceAfter')} value={Number(tx.balance_after || 0).toLocaleString()} />
                {tx.order_id && <Row label={t('orders.orderNo')} value={orderRef(tx.order_id)} />}
                {tx.reference_transaction_id && <Row label={t('wallet.reference')} value={tx.reference_transaction_id} />}
                {tx.actor_email && <Row label={t('wallet.createdBy')} value={tx.actor_email} />}
                {tx.expires_at && <Row label={t('wallet.expiresAt')} value={new Date(tx.expires_at).toLocaleDateString(locale)} />}
                {tx.reason && <Row label={t('wallet.reason')} value={tx.reason} />}
              </dl>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex gap-2 min-w-0">
      <dt className="text-muted-foreground shrink-0">{label}:</dt>
      <dd className="font-medium truncate">{value}</dd>
    </div>
  );
}