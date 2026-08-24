import React, { useState } from 'react';
import { Loader2, Sparkles, Snowflake, History, Plus, Minus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import TransactionList from './TransactionList';

// One customer wallet in the admin list: balance, manual add/remove with a
// mandatory reason, freeze toggle and the ledger history.
export default function WalletAdminRow({ account, perms, onChanged }) {
  const { t, formatPrice } = useLanguage();
  const { toast } = useToast();
  const [mode, setMode] = useState(null); // 'add' | 'remove' | 'history'
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(null);

  const value = Math.round((account.balance || 0) * (perms.redeemRate || 0.1) * 100) / 100;

  const submit = async () => {
    const n = Math.abs(Math.floor(Number(amount) || 0));
    if (!n) { toast({ title: t('wallet.enterPoints'), variant: 'destructive' }); return; }
    if (!reason.trim()) { toast({ title: t('wallet.reasonRequired'), variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const res = await base44.functions.invoke('adjustLoyaltyPoints', {
        user_email: account.user_email,
        points: mode === 'remove' ? -n : n,
        reason: reason.trim(),
      });
      if (!res.success) throw new Error(res.message);
      toast({ title: t('loyalty.adjustSaved') });
      setMode(null); setAmount(''); setReason('');
      onChanged();
    } catch (err) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const toggleFreeze = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('adjustLoyaltyPoints', {
        user_email: account.user_email,
        action: account.frozen ? 'unfreeze' : 'freeze',
      });
      if (!res.success) throw new Error(res.message);
      onChanged();
    } catch (err) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const openHistory = async () => {
    if (mode === 'history') { setMode(null); return; }
    setMode('history');
    if (history) return;
    try {
      const res = await base44.functions.invoke('adminLoyaltyWallet', { user_email: account.user_email, limit: 50 });
      setHistory(res.success ? res.transactions || [] : []);
    } catch {
      setHistory([]);
    }
  };

  return (
    <div className="rounded-2xl bg-card border border-border/60 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid place-items-center w-11 h-11 rounded-xl bg-accent/15 text-accent shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-heading font-bold truncate">{account.user_name || account.user_email}</p>
            <p className="text-xs text-muted-foreground truncate">{account.user_email}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-start sm:text-end">
            <p className="font-heading font-extrabold text-lg">{(account.balance || 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{formatPrice(value)}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {perms.canAdd && (
              <button onClick={() => setMode(mode === 'add' ? null : 'add')} className="squish grid place-items-center w-11 h-11 rounded-full bg-accent/10 text-accent" aria-label={t('wallet.addPoints')} title={t('wallet.addPoints')}>
                <Plus className="w-4 h-4" />
              </button>
            )}
            {perms.canRemove && (
              <button onClick={() => setMode(mode === 'remove' ? null : 'remove')} className="squish grid place-items-center w-11 h-11 rounded-full bg-destructive/10 text-destructive" aria-label={t('wallet.removePoints')} title={t('wallet.removePoints')}>
                <Minus className="w-4 h-4" />
              </button>
            )}
            {perms.canViewTx && (
              <button onClick={openHistory} className="squish grid place-items-center w-11 h-11 rounded-full bg-mist" aria-label={t('wallet.history')} title={t('wallet.history')}>
                <History className="w-4 h-4" />
              </button>
            )}
            {perms.canSettings && (
              <button onClick={toggleFreeze} disabled={busy} className={`squish grid place-items-center w-11 h-11 rounded-full ${account.frozen ? 'bg-cosmic text-white' : 'bg-mist'}`} aria-label={t('wallet.freeze')} title={t('wallet.freeze')}>
                <Snowflake className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {account.frozen && (
        <p className="mt-2 inline-block rounded-full bg-cosmic/10 text-cosmic px-3 py-1 text-xs font-bold">{t('wallet.frozen')}</p>
      )}

      {(mode === 'add' || mode === 'remove') && (
        <div className="mt-3 rounded-2xl bg-mist border border-border/60 p-4 float-in">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block flex-1 min-w-36">
              <span className="text-xs font-medium text-foreground/70">{mode === 'add' ? t('wallet.addPoints') : t('wallet.removePoints')}</span>
              <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
            </label>
            <label className="block flex-[2] min-w-48">
              <span className="text-xs font-medium text-foreground/70">{t('wallet.reason')}</span>
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('wallet.reasonPlaceholder')} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={submit} disabled={busy} className="squish inline-flex items-center gap-2 h-12 px-5 rounded-full bg-cosmic text-white font-heading font-bold disabled:opacity-60">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t('loyalty.apply')}
            </button>
            <button type="button" onClick={() => setMode(null)} className="h-12 px-5 rounded-full bg-card border border-border font-heading font-bold">{t('loyalty.cancel')}</button>
          </div>
        </div>
      )}

      {mode === 'history' && (
        <div className="mt-3 rounded-2xl bg-mist border border-border/60 px-4 float-in">
          {history === null ? (
            <div className="grid place-items-center py-6"><Loader2 className="w-5 h-5 animate-spin text-cosmic" /></div>
          ) : (
            <TransactionList transactions={history} showActor />
          )}
        </div>
      )}
    </div>
  );
}