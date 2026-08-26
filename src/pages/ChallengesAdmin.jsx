import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, Lock, Trophy, X, Check, Image as ImageIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { unwrap } from '@/lib/invoke';
import { rewardLabel } from '@/lib/rewards';
import { challengeName, submissionChallengeName } from '@/lib/bilingual';
import ProductPicker from '@/components/admin/ProductPicker';

const TYPES = [
  { key: 'product_purchase', label: { en: 'Buy a specific product', ar: 'شراء منتج محدد' } },
  { key: 'spend_amount', label: { en: 'Spend above an amount', ar: 'الإنفاق فوق مبلغ' } },
  { key: 'purchase_count', label: { en: 'Number of purchases', ar: 'عدد المشتريات' } },
  { key: 'photo_upload', label: { en: 'Upload a photo', ar: 'رفع صورة' } },
  { key: 'share', label: { en: 'Share with people', ar: 'المشاركة مع أشخاص' } },
  { key: 'custom', label: { en: 'Custom (manual)', ar: 'مخصص (يدوي)' } },
];
const REWARD_TYPES = ['points', 'discount_percent', 'discount_fixed', 'free_delivery', 'product', 'credit'];
const FREQ = ['once', 'daily', 'weekly', 'monthly', 'unlimited', 'custom'];

const empty = { name: '', name_en: '', description: '', type: 'spend_amount', target: { amount: 200 }, reward_type: 'points', reward_value: 50, reward_label: '', reward_label_en: '', product_id: '', start_date: '', end_date: '', active: true, frequency: 'once', limit_count: 1, requires_review: false, reward_code_prefix: 'CHL' };

export default function ChallengesAdmin() {
  const { user } = useAuth();
  const { lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [challenges, setChallenges] = useState([]);
  const [subs, setSubs] = useState([]);
  const [progress, setProgress] = useState([]);
  const [history, setHistory] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [chs, s, p, h] = await Promise.all([
        base44.entities.Challenge.list('-updated_date', 200),
        base44.entities.ChallengeSubmission.filter({ status: 'pending' }),
        base44.entities.ChallengeProgress.list('-created_date', 500),
        base44.entities.RewardHistory.filter({ source: 'challenge' }),
      ]);
      setChallenges(chs || []);
      setSubs(s || []);
      setProgress(p || []);
      setHistory(h || []);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { if (user?.role === 'admin') load(); else setLoading(false); }, [user]);

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background"><Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10"><Lock className="w-8 h-8 text-destructive" /></div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{ar ? 'محمي' : 'Access denied'}</h1>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">{ar ? 'العودة' : 'Back'}</Link>
        </div><Footer />
      </div>
    );
  }

  const save = async () => {
    const c = editing;
    if (!c.name) { toast({ title: ar ? 'الاسم مطلوب' : 'Name required', variant: 'destructive' }); return; }
    try {
      if (c.id) await base44.entities.Challenge.update(c.id, c);
      else await base44.entities.Challenge.create({ ...c, created_by_email: user.email });
      toast({ title: ar ? 'تم الحفظ' : 'Saved' });
      setEditing(null);
      load();
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
  };
  const remove = async (c) => { if (!window.confirm(ar ? 'حذف التحدي؟' : 'Delete challenge?')) return; await base44.entities.Challenge.delete(c.id); load(); };
  const toggle = async (c) => { await base44.entities.Challenge.update(c.id, { active: !c.active }); load(); };

  const review = async (sub, action) => {
    try {
      const res = unwrap(await base44.functions.invoke('challengesReview', { submission_id: sub.id, action }));
      toast({ title: res.success ? (ar ? 'تم' : 'Done') : res.message, variant: res.success ? 'default' : 'destructive' });
      load();
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
  };

  const participants = new Set(progress.map((p) => p.user_email)).size;
  const completions = progress.reduce((s, p) => s + (p.rewarded_count || 0), 0);
  const pointsDist = history.reduce((s, h) => s + (h.points || 0), 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 md:pl-16">
        <Link to="/" className="text-sm text-muted-foreground">← {ar ? 'العودة' : 'Back'}</Link>
        <div className="mt-4 flex items-end justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center w-12 h-12 rounded-2xl bg-cosmic/10 text-cosmic"><Trophy className="w-6 h-6" /></div>
            <div><h1 className="font-heading font-extrabold text-3xl md:text-4xl">{ar ? 'إدارة التحديات' : 'Challenges'}</h1><p className="text-muted-foreground text-sm">{ar ? 'أنشئ حملات مكافآت' : 'Create reward campaigns'}</p></div>
          </div>
          <button onClick={() => setEditing({ ...empty })} className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold"><Plus className="w-5 h-5" /> {ar ? 'تحدي جديد' : 'New challenge'}</button>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={ar ? 'التحديات' : 'Challenges'} value={challenges.length} />
          <Stat label={ar ? 'المشاركون' : 'Participants'} value={participants} />
          <Stat label={ar ? 'إتمامات' : 'Completions'} value={completions} />
          <Stat label={ar ? 'نقاط موزّعة' : 'Points distributed'} value={pointsDist} />
        </div>

        {/* Submissions review */}
        {subs.length > 0 && (
          <div className="mt-8">
            <h2 className="font-heading font-extrabold text-xl">{ar ? 'صور بانتظار المراجعة' : 'Photos pending review'} ({subs.length})</h2>
            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {subs.map((s) => (
                <div key={s.id} className="rounded-3xl bg-card border border-border/60 p-3">
                  <div className="aspect-square rounded-2xl overflow-hidden bg-mist"><Image src={s.file_url} alt="" fittingType="fill" className="w-full h-full" /></div>
                  <p className="mt-2 text-sm font-heading font-bold">{submissionChallengeName(s, lang)}</p>
                  <p className="text-xs text-muted-foreground">{s.user_email}</p>
                  {s.note && <p className="text-xs text-muted-foreground mt-1">{s.note}</p>}
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => review(s, 'approve')} className="flex-1 h-10 rounded-full bg-emerald-600 text-white font-heading font-bold text-sm inline-flex items-center justify-center gap-1"><Check className="w-4 h-4" /> {ar ? 'موافقة' : 'Approve'}</button>
                    <button onClick={() => review(s, 'reject')} className="flex-1 h-10 rounded-full bg-destructive/10 text-destructive font-heading font-bold text-sm inline-flex items-center justify-center gap-1"><X className="w-4 h-4" /> {ar ? 'رفض' : 'Reject'}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Challenge list */}
        <h2 className="mt-8 font-heading font-extrabold text-xl">{ar ? 'كل التحديات' : 'All challenges'}</h2>
        {loading ? <div className="mt-6 grid place-items-center py-12"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div> : (
          <div className="mt-4 space-y-3">
            {challenges.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-4 rounded-3xl bg-card border border-border/60 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold truncate">{challengeName(c, lang)}</p>
                  <p className="text-xs text-muted-foreground">{TYPES.find((x) => x.key === c.type)?.label[lang] || c.type} · {rewardLabel(c, ar, formatPrice)} · {c.frequency}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-heading font-bold ${c.active ? 'bg-emerald-100 text-emerald-700' : 'bg-mist text-muted-foreground'}`}>{c.active ? (ar ? 'نشط' : 'Active') : (ar ? 'متوقف' : 'Inactive')}</span>
                <button onClick={() => toggle(c)} className="h-9 px-3 rounded-full bg-mist text-sm font-heading font-bold">{c.active ? (ar ? 'إيقاف' : 'Disable') : (ar ? 'تفعيل' : 'Enable')}</button>
                <button onClick={() => setEditing({ ...c, target: c.target || {} })} className="grid place-items-center w-9 h-9 rounded-full bg-mist"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(c)} className="grid place-items-center w-9 h-9 rounded-full bg-destructive/10 text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && <ChallengeDialog value={editing} onChange={setEditing} onClose={() => setEditing(null)} onSave={save} ar={ar} />}
      <Footer />
    </div>
  );
}

function Stat({ label, value }) { return (<div className="rounded-2xl bg-card border border-border/60 p-4"><p className="text-2xl font-heading font-extrabold text-cosmic">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>); }

function ChallengeDialog({ value, onChange, onClose, onSave, ar }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const setT = (k, v) => onChange({ ...value, target: { ...(value.target || {}), [k]: v } });
  const input = "w-full h-11 px-3 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-auto rounded-3xl bg-card p-6 shadow-2xl">
        <h2 className="font-heading font-extrabold text-2xl">{value.id ? (ar ? 'تعديل تحدي' : 'Edit challenge') : (ar ? 'تحدي جديد' : 'New challenge')}</h2>
        <div className="mt-4 space-y-3">
          <L label={ar ? 'الاسم (عربي) — مطلوب' : 'Name (Arabic) — required'}><input className={input} value={value.name} onChange={(e) => set('name', e.target.value)} /></L>
          <L label={ar ? 'الاسم (إنجليزي) — اختياري' : 'Name (English) — optional'}><input className={input} value={value.name_en || ''} onChange={(e) => set('name_en', e.target.value)} /></L>
          <L label={ar ? 'الوصف' : 'Description'}><textarea className={input} rows={2} value={value.description} onChange={(e) => set('description', e.target.value)} /></L>
          <L label={ar ? 'النوع' : 'Type'}><select className={input} value={value.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((x) => <option key={x.key} value={x.key}>{x.label[ar ? 'ar' : 'en']}</option>)}</select></L>
          {value.type === 'product_purchase' && (
            <L label={ar ? 'المنتج المطلوب' : 'Required product'}>
              <ProductPicker
                value={value.target?.product_id || ''}
                productName={value.target?.product_name || ''}
                onSelect={({ product_id, product_name }) => { setT('product_id', product_id); setT('product_name', product_name); }}
                placeholder={ar ? 'ابحث بالاسم أو SKU أو الباركود…' : 'Search by name, SKU or barcode…'}
              />
            </L>
          )}
          {value.type === 'spend_amount' && <L label={ar ? 'المبلغ' : 'Amount'}><input type="number" className={input} value={value.target?.amount || ''} onChange={(e) => setT('amount', Number(e.target.value))} /></L>}
          {value.type === 'purchase_count' && <L label={ar ? 'العدد' : 'Count'}><input type="number" className={input} value={value.target?.count || ''} onChange={(e) => setT('count', Number(e.target.value))} /></L>}
          {value.type === 'share' && <L label={ar ? 'عدد الأشخاص' : 'Share count'}><input type="number" className={input} value={value.target?.share_count || ''} onChange={(e) => setT('share_count', Number(e.target.value))} /></L>}
          <div className="grid grid-cols-2 gap-3">
            <L label={ar ? 'نوع المكافأة' : 'Reward type'}><select className={input} value={value.reward_type} onChange={(e) => set('reward_type', e.target.value)}>{REWARD_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}</select></L>
            <L label={ar ? 'قيمة المكافأة' : 'Reward value'}><input type="number" className={input} value={value.reward_value} onChange={(e) => set('reward_value', Number(e.target.value))} /></L>
          </div>
          <L label={ar ? 'تسمية المكافأة (عربي)' : 'Reward label (Arabic)'}><input className={input} value={value.reward_label || ''} onChange={(e) => set('reward_label', e.target.value)} /></L>
          <L label={ar ? 'تسمية المكافأة (إنجليزي) — اختياري' : 'Reward label (English) — optional'}><input className={input} value={value.reward_label_en || ''} onChange={(e) => set('reward_label_en', e.target.value)} /></L>
          <div className="grid grid-cols-2 gap-3">
            <L label={ar ? 'تاريخ البداية' : 'Start date'}><input type="date" className={input} value={value.start_date || ''} onChange={(e) => set('start_date', e.target.value)} /></L>
            <L label={ar ? 'تاريخ النهاية' : 'End date'}><input type="date" className={input} value={value.end_date || ''} onChange={(e) => set('end_date', e.target.value)} /></L>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <L label={ar ? 'التكرار' : 'Frequency'}><select className={input} value={value.frequency} onChange={(e) => set('frequency', e.target.value)}>{FREQ.map((f) => <option key={f} value={f}>{f}</option>)}</select></L>
            {value.frequency === 'custom' && <L label={ar ? 'الحد' : 'Limit'}><input type="number" className={input} value={value.limit_count} onChange={(e) => set('limit_count', Number(e.target.value))} /></L>}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.requires_review} onChange={(e) => set('requires_review', e.target.checked)} /> {ar ? 'يتطلب مراجعة يدوية (للصور)' : 'Requires manual review (photos)'}</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.active} onChange={(e) => set('active', e.target.checked)} /> {ar ? 'نشط' : 'Active'}</label>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={onSave} className="flex-1 h-12 rounded-full bg-cosmic text-white font-heading font-bold">{ar ? 'حفظ' : 'Save'}</button>
          <button onClick={onClose} className="h-12 px-6 rounded-full bg-mist font-heading font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
        </div>
      </div>
    </div>
  );
}
function L({ label, children }) { return (<label className="block"><span className="text-xs font-medium text-muted-foreground">{label}</span><div className="mt-1">{children}</div></label>); }