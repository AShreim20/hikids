import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock, Wallet as WalletIcon, Award } from 'lucide-react';
import { db } from '@/api/entities';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { walletTxTypeLabel } from '@/lib/returns';

// محفظتي / My Wallet -- the monetary ₪ balance (Phase 5), shown clearly
// separate from Loyalty Points (section 17/72): different card, different
// number, never the same balance or component.
export default function MyWallet() {
  const { t, lang, formatPrice } = useLanguage();
  const { user } = useAuth();
  const ar = lang === 'ar';

  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loyalty, setLoyalty] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const [wallets, loyaltyAccounts] = await Promise.all([
          db.Wallet.filter({ user_id: user.id }).catch(() => []),
          db.LoyaltyAccount.filter({ user_id: user.id }).catch(() => []),
        ]);
        const w = wallets?.[0] || null;
        setWallet(w);
        setLoyalty(loyaltyAccounts?.[0] || null);
        if (w) {
          const txs = await db.WalletTransaction.filter({ wallet_id: w.id }).catch(() => []);
          setTransactions((txs || []).sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={ar ? 'محفظتي' : 'My Wallet'} />
        <div className="max-w-md mx-auto px-5 py-24 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-mist"><Lock className="w-8 h-8 text-muted-foreground" /></div>
          <h1 className="mt-6 font-heading font-extrabold text-2xl">{t('orders.signIn')}</h1>
          <Link to="/login" className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">{t('settings.signIn')}</Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title={ar ? 'محفظتي' : 'My Wallet'} />
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-10">
        {loading ? (
          <div className="grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-3xl bg-card border border-border/60 p-5">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                  <WalletIcon className="w-4 h-4" /> {ar ? 'رصيد المحفظة' : 'Wallet Balance'}
                </div>
                <p className="font-heading font-extrabold text-3xl">{formatPrice(wallet?.balance || 0)}</p>
              </div>
              <div className="rounded-3xl bg-card border border-border/60 p-5">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                  <Award className="w-4 h-4" /> {ar ? 'نقاط الولاء' : 'Loyalty Points'}
                </div>
                <p className="font-heading font-extrabold text-3xl">{loyalty?.balance ?? 0} {ar ? 'نقطة' : 'pts'}</p>
              </div>
            </div>

            <h2 className="mt-8 font-heading font-extrabold text-lg">{ar ? 'سجل المعاملات' : 'Transaction History'}</h2>
            {transactions.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">{ar ? 'لا توجد معاملات بعد' : 'No transactions yet'}</p>
            ) : (
              <div className="mt-4 grid gap-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-2xl bg-mist/60 p-4">
                    <div>
                      <p className="text-sm font-medium">
                        {walletTxTypeLabel(tx.type, lang)}{tx.reference_code ? ` #${tx.reference_code}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground" dir="ltr">{new Date(tx.created_date).toLocaleString(ar ? 'ar-u-nu-latn' : 'en')}</p>
                    </div>
                    <p className={`font-heading font-bold ${tx.direction === 'credit' ? 'text-emerald-600' : 'text-destructive'}`} dir="ltr">
                      {tx.direction === 'credit' ? '+' : '-'}{formatPrice(tx.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
