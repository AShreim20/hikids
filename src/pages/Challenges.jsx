import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Gift, Camera, Share2, Check, Trophy, Link2, ArrowUpRight, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { unwrap } from '@/lib/invoke';
import { rewardLabel } from '@/lib/rewards';
import { challengeName } from '@/lib/bilingual';
import RewardsAuthGate from '@/components/RewardsAuthGate';

export default function Challenges() {
  const { t, lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [challenges, setChallenges] = useState([]);
  const [progress, setProgress] = useState([]);
  const [orders, setOrders] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [busy, setBusy] = useState({});
  const [uploading, setUploading] = useState(null);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const [chs, prog, ords, subs] = await Promise.all([
        base44.entities.Challenge.filter({ active: true }),
        base44.entities.ChallengeProgress.filter({ user_email: user.email }),
        base44.entities.Order.filter({ created_by_id: user.id }),
        base44.entities.ChallengeSubmission.filter({ user_email: user.email }),
      ]);
      setChallenges(chs || []);
      setProgress(prog || []);
      setOrders(ords || []);
      setSubmissions(subs || []);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user]);

  if (!user) return <RewardsAuthGate title={ar ? 'التحديات' : 'Challenges'} />;

  const claim = async (c) => {
    setBusy((b) => ({ ...b, [c.id]: true }));
    try {
      const res = unwrap(await base44.functions.invoke('challengesClaim', { challenge_id: c.id }));
      if (res.success) {
        toast({ title: ar ? 'تم استلام المكافأة! 🎉' : 'Reward earned! 🎉', description: rewardLabel(c, ar, formatPrice) });
      } else {
        toast({ title: res.message || (ar ? 'لم يكتمل بعد' : 'Not completed yet'), variant: 'destructive' });
      }
      load();
    } catch (e) {
      toast({ title: e.message, variant: 'destructive' });
    } finally { setBusy((b) => ({ ...b, [c.id]: false })); }
  };

  const onPhoto = async (c, file) => {
    if (!file) return;
    setUploading(c.id);
    try {
      const up = await base44.integrations.Core.UploadFile({ file });
      const res = unwrap(await base44.functions.invoke('challengesSubmitPhoto', { challenge_id: c.id, file_url: up.file_url }));
      toast({ title: res.success ? (ar ? 'تم الإرسال' : 'Submitted') : res.message, variant: res.success ? 'default' : 'destructive' });
      load();
    } catch (e) {
      toast({ title: e.message, variant: 'destructive' });
    } finally { setUploading(null); }
  };

  const copyShare = (c) => {
    const url = `${window.location.origin}/share?c=${c.id}&e=${encodeURIComponent(user.email)}`;
    navigator.clipboard.writeText(url).then(() => toast({ title: ar ? 'تم نسخ رابط المشاركة' : 'Share link copied' }));
  };

  const progFor = (c) => progress.find((p) => p.challenge_id === c.id);
  const subFor = (c) => submissions.filter((s) => s.challenge_id === c.id);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={ar ? 'التحديات' : 'HiKids Challenges'} />
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center w-12 h-12 rounded-2xl bg-cosmic/10 text-cosmic"><Trophy className="w-6 h-6" /></div>
          <div>
            <h1 className="font-heading font-extrabold text-3xl md:text-4xl">{ar ? 'تحديات هاي كيدز' : 'HiKids Challenges'}</h1>
            <p className="text-muted-foreground">{ar ? 'أكمل تحديًا واربح مكافآت حقيقية' : 'Complete a challenge, earn real rewards'}</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-12 grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : challenges.length === 0 ? (
          <div className="mt-12 rounded-3xl bg-mist/60 p-16 text-center">
            <p className="font-heading font-bold text-2xl">{ar ? 'لا توجد تحديات نشطة الآن' : 'No active challenges right now'}</p>
            <Link to="/shop" className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">{ar ? 'تصفّح المتجر' : 'Browse the shop'}</Link>
          </div>
        ) : (
          <div className="mt-8 grid md:grid-cols-2 gap-6">
            {challenges.map((c) => {
              const prog = progFor(c);
              const claimed = (prog && prog.rewarded_count) || 0;
              const valid = (orders || []).filter((o) => !['cancelled', 'returned', 'return_approved', 'failed_delivery'].includes(o.status));
              const t = c.target || {};
              let done = false; let current = 0; let target = 0;
              if (c.type === 'product_purchase') { done = valid.some((o) => (o.items || []).some((it) => it.id === t.product_id)); current = done ? 1 : 0; target = 1; }
              else if (c.type === 'spend_amount') { const q = valid.filter((o) => (Number(o.subtotal) || 0) >= Number(t.amount)); done = q.length > 0; current = q.length; target = q.length || 1; }
              else if (c.type === 'purchase_count') { done = valid.length >= Number(t.count); current = valid.length; target = Number(t.count) || 0; }
              else if (c.type === 'share') { current = (prog && (prog.recipients || []).length) || 0; target = Number(t.share_count) || 0; done = current >= target; }
              const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
              const subs = subFor(c);
              const lastSub = subs[subs.length - 1];

              return (
                <div key={c.id} className="rounded-3xl bg-card border border-border/60 p-6 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-heading font-extrabold text-xl">{challengeName(c, lang)}</p>
                      {c.description && <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>}
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cosmic/10 text-cosmic font-heading font-bold text-sm">{rewardLabel(c, ar, formatPrice)}</span>
                  </div>

                  {/* Progress */}
                  {c.type !== 'photo_upload' && (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{ar ? 'التقدّم' : 'Progress'}</span>
                        <span>{current} / {target}</span>
                      </div>
                      <div className="h-2 rounded-full bg-mist overflow-hidden"><div className="h-full bg-cosmic rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
                    </div>
                  )}

                  {c.type === 'share' && (
                    <button onClick={() => copyShare(c)} className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-mist font-heading font-bold text-sm">
                      <Share2 className="w-4 h-4" /> {ar ? 'نسخ رابط المشاركة' : 'Copy share link'} <Link2 className="w-4 h-4" />
                    </button>
                  )}

                  {c.type === 'product_purchase' && t.product_id && (
                    <Link to={`/product/${t.product_id}`} className="mt-4 inline-flex items-center gap-1.5 text-cosmic font-heading font-bold text-sm">{t.product_name || (ar ? 'عرض المنتج' : 'View product')} <ArrowUpRight className="w-4 h-4" /></Link>
                  )}

                  {c.type === 'photo_upload' && (
                    <div className="mt-4">
                      {lastSub && <p className="text-xs mb-2 text-muted-foreground">{ar ? 'حالة الإرسال' : 'Submission'}: {lastSub.status === 'pending' ? (ar ? 'قيد المراجعة' : 'Pending review') : lastSub.status === 'approved' ? (ar ? 'تمت الموافقة' : 'Approved') : (ar ? 'مرفوض' : 'Rejected')}</p>}
                      <label className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold text-sm cursor-pointer">
                        {uploading === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                        {ar ? 'رفع صورة' : 'Upload photo'}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(c, e.target.files?.[0])} disabled={uploading === c.id} />
                      </label>
                    </div>
                  )}

                  <div className="mt-auto pt-5 flex items-center gap-2">
                    {c.type !== 'photo_upload' && c.type !== 'custom' && (
                      <button onClick={() => claim(c)} disabled={busy[c.id]} className="squish flex-1 h-12 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
                        {busy[c.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                        {claimed > 0 ? (ar ? 'استلام مجدد' : 'Claim again') : (ar ? 'استلام المكافأة' : 'Claim reward')}
                      </button>
                    )}
                    {claimed > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-heading font-bold text-emerald-600"><Check className="w-4 h-4" /> {ar ? `تم ${claimed}×` : `Claimed ${claimed}×`}</span>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {c.start_date && c.end_date ? `${c.start_date} → ${c.end_date}` : ''}
                  </p>
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