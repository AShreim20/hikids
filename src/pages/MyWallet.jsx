import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock, Wallet as WalletIcon, Award, RotateCw, Sparkles, Trophy, History, ChevronRight, AlertTriangle } from 'lucide-react';
import { db } from '@/api/entities';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { walletTxTypeLabel } from '@/lib/returns';
import { myPendingRewards } from '@/lib/loyaltyFunctions';
import { wheelState } from '@/lib/wheelFunctions';
import { useIsMobile } from '@/hooks/use-mobile';

// محفظتي / My Wallet -- the monetary ₪ balance (Phase 5), shown clearly
// separate from Loyalty Points (section 17/72): different card, different
// number, never the same balance or component.
export default function MyWallet() {
  const { t, lang, formatPrice } = useLanguage();
  const { user } = useAuth();
  const ar = lang === 'ar';
  const isMobile = useIsMobile();

  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loyalty, setLoyalty] = useState(null);
  const [pending, setPending] = useState(null);
  const [spins, setSpins] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rewardsError, setRewardsError] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const [wallets, loyaltyAccounts] = await Promise.all([
          db.Wallet.filter({ user_id: user.id }).catch(() => []),
          db.LoyaltyAccount.filter({ user_id: user.id }).catch(() => []),
        ]);
        const [pend, wheel] = await Promise.all([
          myPendingRewards().catch(() => { setRewardsError(true); return null; }),
          wheelState().catch(() => { setRewardsError(true); return null; }),
        ]);
        setPending(pend);
        setSpins(wheel);
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
          <Link to={`/login?returnTo=${encodeURIComponent('/wallet')}`} className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">{t('settings.signIn')}</Link>
        </div>
        <Footer />
      </div>
    );
  }

  // Phone (<768px): the Rewards Hub reached from the "My Rewards" bottom-nav
  // tab -- available/pending points+spins up top, then cards into the
  // existing Wheel/Challenges/History pages (never duplicating their own
  // data here). Tablet/desktop render the original wallet page below,
  // unchanged.
  if (isMobile) {
    const holdOn = !!(pending?.return_hold || spins?.return_hold);
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={ar ? 'مكافآتي' : 'My Rewards'} />
        <div className="px-4 py-6">
          {loading ? (
            <div className="grid grid-cols-2 gap-2.5">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[68px] rounded-2xl bg-mist animate-pulse" />)}
            </div>
          ) : rewardsError ? (
            <div className="rounded-2xl bg-mist p-4 flex items-center gap-2.5 text-sm text-muted-foreground">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {ar ? 'تعذّر تحميل مكافآتك الآن' : 'Could not load your rewards right now'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <RewardStat icon={Award} label={ar ? 'نقاط متاحة' : 'Points available'} value={loyalty?.balance ?? 0} />
                <RewardStat icon={Award} label={ar ? 'نقاط معلّقة' : 'Points pending'} value={pending?.pending_points ?? 0} tone="text-muted-foreground" />
                <RewardStat icon={RotateCw} label={ar ? 'دورات متاحة' : 'Spins available'} value={spins?.active ? (spins.available ?? 0) : '—'} tone="text-accent" />
                <RewardStat icon={RotateCw} label={ar ? 'دورات معلّقة' : 'Spins pending'} value={spins?.active ? (spins.pending_spins ?? 0) : '—'} tone="text-muted-foreground" />
              </div>
              {holdOn && <p className="mt-2 text-xs text-accent text-center">بانتظار اكتمال طلب الإرجاع</p>}
            </>
          )}

          <div className="mt-3 flex items-center justify-between rounded-2xl bg-mist px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm font-heading font-bold"><WalletIcon className="w-4 h-4 text-cosmic" /> {ar ? 'رصيد المحفظة' : 'Wallet balance'}</span>
            <span className="font-heading font-extrabold">{formatPrice(wallet?.balance || 0)}</span>
          </div>

          <div className="mt-5 grid gap-2.5">
            <RewardCard to="/wheel" icon={Sparkles} title={ar ? 'عجلة الحظ' : 'Mystery Wheel'} desc={ar ? 'أدر العجلة واربح مكافآت' : 'Spin the wheel and win rewards'} />
            <RewardCard to="/challenges" icon={Trophy} title={ar ? 'التحديات' : 'Challenges'} desc={ar ? 'أكمل التحديات واكسب المزيد' : 'Complete challenges to earn more'} />
            <RewardCard to="/rewards" icon={History} title={ar ? 'سجل المكافآت' : 'Rewards & redemption history'} desc={ar ? 'كل ما ربحته سابقًا' : 'Everything you have earned so far'} />
          </div>
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
                {(pending?.pending_points > 0 || spins?.pending_spins > 0) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {ar ? 'معلّقة' : 'Pending'}: {pending?.pending_points ?? 0} {ar ? 'نقطة' : 'pts'} · {spins?.pending_spins ?? 0} {ar ? 'دورة' : 'spins'}
                  </p>
                )}
                {(pending?.return_hold || spins?.return_hold) && (
                  <p className="mt-1 text-xs text-accent">بانتظار اكتمال طلب الإرجاع</p>
                )}
                {spins?.active && <p className="mt-2 text-xs text-muted-foreground">{ar ? 'الدورات المتاحة' : 'Available spins'}: {spins.available ?? 0}</p>}
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

function RewardStat({ icon: Icon, label, value, tone = 'text-cosmic' }) {
  return (
    <div className="rounded-2xl bg-card border border-border/60 px-3 py-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={`w-3.5 h-3.5 ${tone}`} /> {label}
      </div>
      <p className="mt-1 font-heading font-extrabold text-lg">{value}</p>
    </div>
  );
}

function RewardCard({ to, icon: Icon, title, desc }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl bg-card border border-border/60 p-4">
      <div className="grid place-items-center w-11 h-11 rounded-xl bg-cosmic/10 text-cosmic shrink-0"><Icon className="w-5 h-5" /></div>
      <div className="min-w-0 flex-1">
        <p className="font-heading font-bold">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 rtl:rotate-180" />
    </Link>
  );
}
