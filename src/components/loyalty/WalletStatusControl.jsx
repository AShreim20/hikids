import React, { useState } from 'react';
import { Loader2, Snowflake, Play } from 'lucide-react';
import { setWalletStatus } from '@/lib/loyaltyFunctions';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';

// Freeze / unfreeze a single wallet. Confirmation + optional reason, the status
// always comes back from the server and is handed to the parent.
export default function WalletStatusControl({ wallet, onUpdated }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const status = wallet.status || (wallet.frozen ? 'frozen' : 'active');
  const isActive = status === 'active';
  const next = isActive ? 'frozen' : 'active';

  const apply = async () => {
    setBusy(true);
    try {
      const res = await setWalletStatus({
        walletId: wallet.id,
        userEmail: wallet.user_email,
        status: next,
        reason: reason.trim(),
      });
      if (!res?.success) throw new Error(res?.message || t('wallet.statusFailed'));
      toast({ title: next === 'frozen' ? t('wallet.frozenSuccess') : t('wallet.unfrozenSuccess') });
      setOpen(false);
      setReason('');
      onUpdated(res.wallet);
    } catch (err) {
      toast({ title: err.message || t('wallet.statusFailed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        title={isActive ? t('wallet.freezeWallet') : t('wallet.unfreezeWallet')}
        aria-label={isActive ? t('wallet.freezeWallet') : t('wallet.unfreezeWallet')}
        className={`squish inline-flex items-center gap-2 h-11 px-4 rounded-full font-heading font-bold text-sm disabled:opacity-60 ${
          isActive ? 'bg-cosmic/10 text-cosmic' : 'bg-emerald-500/15 text-emerald-600'
        }`}
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isActive ? (
          <Snowflake className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">{isActive ? t('wallet.freezeWallet') : t('wallet.unfreezeWallet')}</span>
      </button>

      {open && (
        <div className="mt-3 w-full rounded-2xl bg-mist border border-border/60 p-4 float-in">
          <p className="text-sm font-heading font-bold">
            {isActive ? t('wallet.freezeConfirm') : t('wallet.unfreezeConfirm')}
          </p>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('wallet.reasonOptional')}
            className="mt-3 w-full h-12 px-4 rounded-2xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={apply}
              disabled={busy}
              className="squish inline-flex items-center gap-2 h-12 px-5 rounded-full bg-cosmic text-white font-heading font-bold disabled:opacity-60"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('wallet.confirm')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-12 px-5 rounded-full bg-card border border-border font-heading font-bold"
            >
              {t('loyalty.cancel')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}