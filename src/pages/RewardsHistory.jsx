import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Trophy, Gift, Sparkles, Ticket } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { rewardLabel } from '@/lib/rewards';
import { rewardHistoryName, rewardHistorySource } from '@/lib/bilingual';
import RewardsAuthGate from '@/components/RewardsAuthGate';

const sourceLabel = (s, ar) => {
  if (s === 'challenge') return ar ? 'تحدي' : 'Challenge';
  if (s === 'wheel') return ar ? 'عجلة المفاجآت' : 'Mystery Wheel';
  if (s === 'firsttime') return ar ? 'هدية أول عميل' : 'First-time gift';
  return s;
};
const SourceIcon = (s) => (s === 'challenge' ? Trophy : s === 'firsttime' ? Gift : Sparkles);

export default function RewardsHistory() {
  const { t, lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    base44.entities.RewardHistory.filter({ user_email: user.email })
      .then((r) => setRows((r || []).sort((a, b) => new Date(b.created_date) - new Date(a.created_date))))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return <RewardsAuthGate title={ar ? 'سجل المكافآت' : 'Reward History'} />;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={ar ? 'سجل المكافآت' : 'Reward History'} />
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10">
        <h1 className="font-heading font-extrabold text-3xl md:text-4xl">{ar ? 'سجل مكافآتي' : 'My Reward History'}</h1>
        <p className="mt-2 text-muted-foreground">{ar ? 'كل ما ربحته من التحديات والعجلة' : 'Everything you earned from challenges and the wheel'}</p>

        {loading ? (
          <div className="mt-12 grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : rows.length === 0 ? (
          <div className="mt-12 rounded-3xl bg-mist/60 p-16 text-center">
            <p className="font-heading font-bold text-2xl">{ar ? 'لا توجد مكافآت بعد' : 'No rewards yet'}</p>
            <Link to="/challenges" className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">{ar ? 'ابدأ تحديًا' : 'Start a challenge'}</Link>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {rows.map((r) => {
              const Icon = SourceIcon(r.source);
              return (
                <div key={r.id} className="flex items-center gap-4 rounded-2xl bg-card border border-border/60 px-4 py-4">
                  <div className="grid place-items-center w-11 h-11 rounded-xl bg-cosmic/10 text-cosmic shrink-0"><Icon className="w-5 h-5" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold">{rewardHistoryName(r, lang) || rewardLabel(r, ar, formatPrice)}</p>
                    <p className="text-xs text-muted-foreground">{sourceLabel(r.source, ar)}{r.source_name ? ` · ${rewardHistorySource(r, lang)}` : ''}</p>
                    {r.discount_code && <p className="text-xs font-mono mt-1 inline-flex items-center gap-1"><Ticket className="w-3 h-3" /> {r.discount_code}</p>}
                    {r.fulfillment === 'manual' && <p className="text-xs text-muted-foreground mt-0.5">{ar ? 'يتم التسليم يدويًا' : 'Manual fulfillment'}</p>}
                  </div>
                  <div className="text-end shrink-0">
                    {r.points > 0 && <p className="font-heading font-extrabold text-cosmic">+{r.points}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(r.created_date).toLocaleDateString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}