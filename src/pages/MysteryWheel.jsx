import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Sparkles, Gift, History, Trophy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { unwrap } from '@/lib/invoke';
import { rewardLabel } from '@/lib/rewards';
import RewardsAuthGate from '@/components/RewardsAuthGate';

export default function MysteryWheel() {
  const { t, lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const { user } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [spins, setSpins] = useState([]);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = unwrap(await base44.functions.invoke('wheelState', {}));
      if (res.success) setState(res);
      const s = await base44.entities.WheelSpin.filter({ user_email: user.email });
      setSpins(s || []);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user]);

  if (!user) return <RewardsAuthGate title={ar ? 'صندوق المفاجآت' : 'Mystery Wheel'} />;

  const claimFirstSpin = async () => {
    try {
      const res = unwrap(await base44.functions.invoke('wheelGrantFirstSpin', {}));
      if (res.success) { toast({ title: ar ? 'حصلت على دورة مجانية! 🎉' : 'Free spin unlocked! 🎉' }); load(); }
      else toast({ title: res.message || 'Error', variant: 'destructive' });
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
  };

  const spin = async () => {
    if (spinning || !state || state.available <= 0) return;
    setSpinning(true);
    setResult(null);
    try {
      const res = unwrap(await base44.functions.invoke('wheelSpin', {}));
      if (res.success) {
        setTimeout(() => { setResult(res.reward); setSpinning(false); load(); }, 1600);
      } else {
        toast({ title: res.message || 'Error', variant: 'destructive' });
        setSpinning(false);
      }
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); setSpinning(false); }
  };

  const pct = state ? state.progress_pct : 0;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={ar ? 'صندوق المفاجآت' : 'Mystery Wheel'} />
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center w-12 h-12 rounded-2xl bg-accent/10 text-accent"><Sparkles className="w-6 h-6" /></div>
          <div>
            <h1 className="font-heading font-extrabold text-3xl md:text-4xl">{ar ? 'صندوق المفاجآت' : 'Mystery Unboxing'}</h1>
            <p className="text-muted-foreground">{ar ? 'تسوّق، املأ شريط التقدّم، وافتح دورة' : 'Shop, fill the progress bar, unlock a spin'}</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-12 grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : !state || !state.active ? (
          <div className="mt-12 rounded-3xl bg-mist/60 p-16 text-center">
            <p className="font-heading font-bold text-2xl">{ar ? 'العجلة غير متاحة حاليًا' : 'The wheel is not active right now'}</p>
          </div>
        ) : (
          <>
            {/* Progress */}
            <div className="mt-8 rounded-3xl bg-card border border-border/60 p-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-heading font-bold">{ar ? 'شريط التقدّم' : 'Progress'}</span>
                <span className="text-muted-foreground">{ar ? 'دورات متاحة' : 'Available spins'}: <b className="text-cosmic">{state.available}</b></span>
              </div>
              <div className="h-4 rounded-full bg-mist overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cosmic to-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {state.available > 0
                  ? (ar ? 'لديك دورة جاهزة!' : 'You have a spin ready!')
                  : (ar ? `أنفق ${formatPrice(state.remaining_amount)} إضافية لفتح دورة` : `Spend ${formatPrice(state.remaining_amount)} more to unlock a spin`)}
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>{ar ? 'تم إنفاقه' : 'Eligible spent'}: {formatPrice(state.eligible_amount)}</span>
                <span>{ar ? 'الحد الأدنى' : 'Per spin'}: {formatPrice(state.min_amount)}</span>
                <span>{ar ? 'الدورات المستخدمة' : 'Spins used'}: {state.used}</span>
              </div>
            </div>

            {/* First-time free spin */}
            {state.config.first_time_enabled && !state.progress.free_spin_granted && (
              <button onClick={claimFirstSpin} className="mt-4 w-full h-12 rounded-full bg-accent/15 text-accent border border-accent/30 font-heading font-bold inline-flex items-center justify-center gap-2">
                <Gift className="w-4 h-4" /> {ar ? 'استلم دورتك المجانية للعميل الجديد' : 'Claim your first-time free spin'}
              </button>
            )}

            {/* Wheel */}
            <div className="mt-6 rounded-3xl bg-mist/40 border border-border/60 p-8 flex flex-col items-center">
              <div className={`grid place-items-center w-44 h-44 rounded-full bg-cosmic text-white shadow-2xl ${spinning ? 'animate-spin' : ''}`} style={spinning ? { animationDuration: '0.6s' } : undefined}>
                {spinning ? <Loader2 className="w-12 h-12 animate-spin" /> : <Sparkles className="w-16 h-16" />}
              </div>
              <button onClick={spin} disabled={spinning || state.available <= 0} className="mt-6 squish h-14 px-10 rounded-full bg-cosmic text-white font-heading font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                {spinning ? (ar ? 'يدور...' : 'Spinning...') : (ar ? 'أدر العجلة' : 'Spin the Wheel')}
              </button>

              {result && (
                <div className="mt-6 text-center float-in">
                  <p className="text-sm text-muted-foreground">{ar ? 'ربحت!' : 'You won'}</p>
                  <p className="mt-1 font-heading font-extrabold text-3xl text-cosmic">{result.label}</p>
                  {result.discount_code && <p className="mt-2 text-sm">{ar ? 'كود الخصم' : 'Discount code'}: <b className="font-mono">{result.discount_code}</b></p>}
                  {result.fulfillment === 'manual' && <p className="mt-2 text-xs text-muted-foreground">{ar ? 'سيتم تواصل المتجر معك لاستلام المكافأة' : 'The store will contact you to fulfill this reward'}</p>}
                </div>
              )}
            </div>

            {/* Recent spins */}
            <div className="mt-8 flex items-center justify-between">
              <h2 className="font-heading font-extrabold text-xl">{ar ? 'آخر النتائج' : 'Recent results'}</h2>
              <Link to="/rewards" className="inline-flex items-center gap-1 text-cosmic font-heading font-bold text-sm"><History className="w-4 h-4" /> {ar ? 'كل المكافآت' : 'All rewards'}</Link>
            </div>
            <div className="mt-4 space-y-3">
              {spins.length === 0 ? (
                <p className="text-sm text-muted-foreground">{ar ? 'لم تُدِر العجلة بعد' : 'No spins yet'}</p>
              ) : spins.slice(-6).reverse().map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-2xl bg-card border border-border/60 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Trophy className="w-5 h-5 text-cosmic" />
                    <div>
                      <p className="font-heading font-bold text-sm">{s.reward_label}</p>
                      {s.discount_code && <p className="text-xs text-muted-foreground font-mono">{s.discount_code}</p>}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(s.created_date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}