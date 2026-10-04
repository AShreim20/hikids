import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, Lock, Sparkles, Save, CheckCircle2, AlertTriangle } from 'lucide-react';
import { db } from '@/api/entities';
import { useAdminLoadGuard } from '@/hooks/useAdminLoadGuard';
import AdminLoadFailed from '@/components/admin/AdminLoadFailed';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { rewardLabel } from '@/lib/rewards';
import { rewardName } from '@/lib/bilingual';
import { saveWheelRewards, wheelRewardUsage } from '@/lib/wheelFunctions';
import { expectedSpinCost } from '@/lib/wheelCost';
import { summarizeProbabilities, formatPercent, toUnits } from '@/lib/wheelProbability';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '@/components/admin/UnsavedChangesDialog';
import StickySaveBar from '@/components/admin/StickySaveBar';
import WheelProductPicker from '@/components/admin/WheelProductPicker';
import MysteryWheelChart from '@/components/wheel/MysteryWheelChart';

const REWARD_TYPES = ['points', 'discount_percent', 'discount_fixed', 'free_delivery', 'product', 'credit'];
const BASIS = [
  { key: 'total', label: { en: 'Total purchases', ar: 'إجمالي المشتريات' } },
  { key: 'single_order', label: { en: 'Single order', ar: 'طلب واحد' } },
  { key: 'period', label: { en: 'Specific period', ar: 'فترة محددة' } },
];
const emptyConfig = { name: 'Mystery Unboxing', min_amount: 200, basis: 'total', period_start: '', period_end: '', start_date: '', end_date: '', active: true, max_spins: 0, spins_expire: false, accumulate: true, first_time_enabled: false, first_time_new_only: false };
const emptyReward = { label: '', label_en: '', type: 'points', value: 50, product_id: '', product_name: '', probability_percent: '', max_total_wins: '', max_daily_wins: '', active: true, sort_order: 0 };

// Rewards are edited as a local draft and saved together (the database only
// accepts the set when active probabilities total exactly 100%, so rows can't
// be saved one at a time).
const toDraft = (r) => ({
  ...r,
  probability_percent: formatPercent(r.probability_percent ?? 0),
  max_total_wins: r.max_total_wins ?? '',
  max_daily_wins: r.max_daily_wins ?? '',
  _key: r.id,
});
const capOf = (v) => (v === '' || v == null ? null : Number(v));
const isUnlimited = (r) => capOf(r.max_total_wins) == null && capOf(r.max_daily_wins) == null;
const byWheelOrder = (a, b) => (a.sort_order || 0) - (b.sort_order || 0) || new Date(a.created_date) - new Date(b.created_date);
const signature = (r) => JSON.stringify([r.label, r.label_en || '', r.type, Number(r.value) || 0, r.product_id || '', toUnits(r.probability_percent), !!r.active, capOf(r.max_total_wins), capOf(r.max_daily_wins)]);
let newKeySeq = 0;

export default function MysteryWheelAdmin() {
  const { user } = useAuth();
  const { lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(emptyConfig);
  const [configId, setConfigId] = useState(null);
  const [savedActive, setSavedActive] = useState(false);
  const [rewards, setRewards] = useState([]); // last saved
  const [draft, setDraft] = useState([]); // being edited
  const [spins, setSpins] = useState([]);
  const [history, setHistory] = useState([]);
  const [usage, setUsage] = useState({}); // reward_id -> { total, today }
  const [productCosts, setProductCosts] = useState({}); // product_id -> unit cost
  const [editingReward, setEditingReward] = useState(null);
  const [savingRewards, setSavingRewards] = useState(false);

  const { failure, guard } = useAdminLoadGuard();

  const load = async () => {
    setLoading(true);
    // Rewards are the primary fetch: if it fails the whole load fails. The
    // config/spins/history lists stay best-effort.
    const res = await guard(async () => {
      const [cfgs, rw, sp, h] = await Promise.allSettled([
        db.WheelConfig.list('-created_date', 50),
        db.WheelReward.list('created_date', 100),
        db.WheelSpin.list('-created_date', 500),
        db.RewardHistory.filter({ source: 'wheel' }),
      ]);
      if (rw.status === 'rejected') throw rw.reason;
      return [cfgs, rw, sp, h].map((r) => (r.status === 'fulfilled' ? r.value || [] : []));
    });
    if (res) {
      const [cfgList, rewardList, spinList, historyList] = res;
      if (cfgList[0]) { setConfig({ ...emptyConfig, ...cfgList[0] }); setConfigId(cfgList[0].id); setSavedActive(!!cfgList[0].active); }
      const ordered = [...rewardList].sort(byWheelOrder);
      setRewards(ordered);
      setDraft(ordered.map(toDraft));
      setSpins(spinList);
      setHistory(historyList);
      // Best-effort extras: usage counters and product costs for the cost estimate.
      wheelRewardUsage().then((u) => {
        if (u?.success) setUsage(Object.fromEntries((u.usage || []).map((x) => [x.reward_id, x])));
      }).catch(() => {});
      const productIds = [...new Set(rewardList.filter((r) => r.type === 'product' && r.product_id).map((r) => r.product_id))];
      Promise.all(productIds.map((pid) => db.Product.get(pid).catch(() => null))).then((ps) => {
        const m = {};
        ps.forEach((p) => { if (p) m[p.id] = Number(p.unit_cost) > 0 ? Number(p.unit_cost) : Number(p.sale_price || p.price) || 0; });
        setProductCosts(m);
      });
    }
    setLoading(false);
  };
  useEffect(() => { if (user?.role === 'admin') load(); else setLoading(false); }, [user]);

  const summary = useMemo(() => summarizeProbabilities(draft), [draft]);
  const savedSummary = useMemo(() => summarizeProbabilities(rewards.map(toDraft)), [rewards]);
  // At least one active reward must have no win limit, otherwise the wheel
  // could run out of things to give (also enforced by the database).
  const activeRewards = draft.filter((d) => d.active);
  const needsUnlimited = activeRewards.length > 0 && !activeRewards.some(isUnlimited);
  const canSaveAll = summary.canSave && !needsUnlimited;
  const cost = useMemo(
    () => expectedSpinCost(draft, { minAmount: config.min_amount, productCosts }),
    [draft, config.min_amount, productCosts]
  );

  const dirtyCount = useMemo(() => {
    const saved = Object.fromEntries(rewards.map((r) => [r.id, signature(toDraft(r))]));
    const changed = draft.reduce((n, d) => n + (!d.id ? 1 : (saved[d.id] !== signature(d) ? 1 : 0)), 0);
    const removed = rewards.filter((r) => !draft.some((d) => d.id === r.id)).length;
    return changed + removed;
  }, [draft, rewards]);
  const { confirmOpen, stay, leave } = useUnsavedChangesGuard(dirtyCount > 0);

  if (failure) return <AdminLoadFailed failure={failure} onRetry={load} />;
  if (loading) return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>;

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

  const saveConfig = async () => {
    // Switching the wheel ON needs a balanced reward set — checked here for a
    // clear message, and enforced again by the database.
    if (config.active && !savedActive && !savedSummary.canActivateWheel) {
      toast({
        title: ar ? 'لا يمكن تفعيل العجلة قبل أن يصبح إجمالي نسب الظهور 100%' : 'The wheel can’t be activated until the active rewards total exactly 100%',
        variant: 'destructive',
      });
      return;
    }
    try {
      if (configId) await db.WheelConfig.update(configId, config);
      else { const c = await db.WheelConfig.create(config); setConfigId(c.id); }
      setSavedActive(!!config.active);
      toast({ title: ar ? 'تم حفظ الإعدادات' : 'Config saved' });
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
  };

  const setProb = (key, value) => setDraft((d) => d.map((r) => (r._key === key ? { ...r, probability_percent: value } : r)));
  const setActive = (key, active) => setDraft((d) => d.map((r) => (r._key === key ? { ...r, active } : r)));
  const removeFromDraft = (r) => {
    if (!window.confirm(ar ? 'حذف المكافأة؟ (يُطبَّق عند الحفظ)' : 'Delete reward? (applied when you save)')) return;
    setDraft((d) => d.filter((x) => x._key !== r._key));
  };
  const applyEdit = () => {
    const r = editingReward;
    if (!r.label.trim()) { toast({ title: ar ? 'التسمية مطلوبة' : 'Label required', variant: 'destructive' }); return; }
    const badCap = [r.max_total_wins, r.max_daily_wins].some((v) => v !== '' && v != null && (!Number.isInteger(Number(v)) || Number(v) < 1));
    if (badCap) { toast({ title: ar ? 'الحد الأقصى يجب أن يكون عددًا صحيحًا أكبر من 0 أو فارغًا' : 'Win limits must be whole numbers above 0, or empty', variant: 'destructive' }); return; }
    setDraft((d) => (d.some((x) => x._key === r._key) ? d.map((x) => (x._key === r._key ? r : x)) : [...d, r]));
    setEditingReward(null);
  };
  const revert = () => setDraft(rewards.map(toDraft));

  const saveRewards = async () => {
    if (!canSaveAll || savingRewards) return;
    if (draft.some((d) => !d.label.trim())) { toast({ title: ar ? 'كل مكافأة تحتاج تسمية' : 'Every reward needs a label', variant: 'destructive' }); return; }
    setSavingRewards(true);
    try {
      const payload = draft.map((d) => ({
        id: d.id || null,
        label: d.label.trim(),
        label_en: d.label_en || '',
        type: d.type,
        value: Number(d.value) || 0,
        product_id: d.type === 'product' ? (d.product_id || null) : null,
        product_name: d.type === 'product' ? (d.product_name || null) : null,
        probability_percent: Number(d.probability_percent) || 0,
        max_total_wins: capOf(d.max_total_wins),
        max_daily_wins: capOf(d.max_daily_wins),
        active: !!d.active,
        sort_order: d.sort_order ?? 0,
      }));
      const res = await saveWheelRewards(payload);
      if (!res?.success) throw new Error(res?.message || 'Error');
      toast({ title: ar ? 'تم حفظ المكافآت' : 'Rewards saved' });
      await load();
    } catch (e) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSavingRewards(false);
    }
  };

  const byType = {};
  spins.forEach((s) => { byType[s.reward_type] = (byType[s.reward_type] || 0) + 1; });
  const pointsDist = history.reduce((s, h) => s + (h.points || 0), 0);
  const input = "w-full h-11 px-3 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40";
  const pct = formatPercent;
  const previewRewards = draft.filter((d) => d.active && d.label.trim()).map((d) => ({ ...d, id: d._key }));

  return (
    <div className="min-h-screen bg-background pb-24">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 md:pl-16">
        <Link to="/" className="text-sm text-muted-foreground">← {ar ? 'العودة' : 'Back'}</Link>
        <div className="mt-4 flex items-center gap-3">
          <div className="grid place-items-center w-12 h-12 rounded-2xl bg-accent/10 text-accent"><Sparkles className="w-6 h-6" /></div>
          <div><h1 className="font-heading font-extrabold text-3xl md:text-4xl">{ar ? 'إدارة صندوق المفاجآت' : 'Mystery Wheel'}</h1><p className="text-muted-foreground text-sm">{ar ? 'إعدادات العجلة والمكافآت' : 'Wheel config and rewards'}</p></div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label={ar ? 'الدورات' : 'Spins'} value={spins.length} />
          <Stat label={ar ? 'مكافآت موزّعة' : 'Rewards given'} value={history.length} />
          <Stat label={ar ? 'نقاط موزّعة' : 'Points distributed'} value={pointsDist} />
          <Stat label={ar ? 'مكافآت يدوية' : 'Manual rewards'} value={spins.filter((s) => s.fulfillment === 'manual').length} />
          <Stat label={ar ? 'جوائز لم تُستخدم بعد' : 'Unredeemed rewards'} value={spins.filter((s) => s.status === 'unused').length} />
        </div>

        {/* Config */}
        <div className="mt-8 rounded-3xl bg-card border border-border/60 p-6">
          <h2 className="font-heading font-extrabold text-xl">{ar ? 'الإعدادات' : 'Configuration'}</h2>
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <L label={ar ? 'الحد الأدنى للدورة' : 'Min amount per spin'}><input type="number" className={input} value={config.min_amount} onChange={(e) => setConfig({ ...config, min_amount: Number(e.target.value) })} /></L>
            <L label={ar ? 'الأساس' : 'Basis'}><select className={input} value={config.basis} onChange={(e) => setConfig({ ...config, basis: e.target.value })}>{BASIS.map((b) => <option key={b.key} value={b.key}>{b.label[ar ? 'ar' : 'en']}</option>)}</select></L>
            <L label={ar ? 'أقصى دورات (0=غير محدود)' : 'Max spins (0=unlimited)'}><input type="number" className={input} value={config.max_spins} onChange={(e) => setConfig({ ...config, max_spins: Number(e.target.value) })} /></L>
            <L label={ar ? 'بداية الفترة' : 'Period start'}><input type="date" className={input} value={config.period_start || ''} onChange={(e) => setConfig({ ...config, period_start: e.target.value })} /></L>
            <L label={ar ? 'نهاية الفترة' : 'Period end'}><input type="date" className={input} value={config.period_end || ''} onChange={(e) => setConfig({ ...config, period_end: e.target.value })} /></L>
            <L label={ar ? 'بداية الحملة' : 'Start date'}><input type="date" className={input} value={config.start_date || ''} onChange={(e) => setConfig({ ...config, start_date: e.target.value })} /></L>
            <L label={ar ? 'نهاية الحملة' : 'End date'}><input type="date" className={input} value={config.end_date || ''} onChange={(e) => setConfig({ ...config, end_date: e.target.value })} /></L>
            <L label={ar ? 'انتهاء المكافأة (أيام، 0=أبدًا)' : 'Reward expiry (days, 0=never)'}><input type="number" className={input} value={config.reward_expiry_days || 0} onChange={(e) => setConfig({ ...config, reward_expiry_days: Number(e.target.value) })} /></L>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={config.active} onChange={(e) => setConfig({ ...config, active: e.target.checked })} /> {ar ? 'نشط' : 'Active'}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={config.accumulate} onChange={(e) => setConfig({ ...config, accumulate: e.target.checked })} /> {ar ? 'تراكم الدورات' : 'Accumulate spins'}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={config.spins_expire} onChange={(e) => setConfig({ ...config, spins_expire: e.target.checked })} /> {ar ? 'تنتهي الدورات غير المستخدمة' : 'Unused spins expire'}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={config.first_time_enabled} onChange={(e) => setConfig({ ...config, first_time_enabled: e.target.checked })} /> {ar ? 'دورة مجانية لأول عميل' : 'First-time free spin'}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={config.first_time_new_only} onChange={(e) => setConfig({ ...config, first_time_new_only: e.target.checked })} /> {ar ? 'الجدد فقط' : 'New customers only'}</label>
          </div>
          <button onClick={saveConfig} className="mt-5 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold"><Save className="w-4 h-4" /> {ar ? 'حفظ الإعدادات' : 'Save config'}</button>
        </div>

        {/* Rewards */}
        <div className="mt-8 flex items-center justify-between">
          <h2 className="font-heading font-extrabold text-xl">{ar ? 'مكافآت العجلة' : 'Wheel rewards'}</h2>
          <button onClick={() => setEditingReward({ ...emptyReward, _key: `new-${++newKeySeq}` })} className="squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold text-sm"><Plus className="w-4 h-4" /> {ar ? 'إضافة' : 'Add reward'}</button>
        </div>

        <div className="mt-4 grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
          <div>
            {/* Live total of the ACTIVE rewards' appearance probabilities */}
            <TotalBar summary={summary} ar={ar} pct={pct} />
            {needsUnlimited && (
              <p className="mt-2 flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-xs font-heading font-bold text-destructive">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {ar ? 'يجب أن تبقى مكافأة نشطة واحدة على الأقل بدون حد أقصى للفوز، حتى لا تفرغ العجلة من الجوائز.' : 'Keep at least one active reward without a win limit so the wheel never runs out of prizes.'}
              </p>
            )}
            {(cost.expected > 0 || cost.unknown === 0) && (
              <div className="mt-2 rounded-2xl border border-border/60 bg-mist/50 px-4 py-2.5 text-xs">
                <p className="font-heading font-bold text-sm">
                  {ar ? 'متوسط الكلفة المتوقعة لكل دورة: ' : 'Estimated average cost per spin: '}
                  <span className="text-cosmic">{formatPrice(cost.expected)}</span>
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  {ar
                    ? 'تقدير تقريبي حسب النسب: النقاط بقيمتها عند الاستبدال، الخصومات بقيمتها كاملة (بافتراض استخدامها)، خصم النسبة على سلة بقيمة الحد الأدنى للدورة، والمنتج بتكلفته.'
                    : 'A rough estimate from the probabilities: points at their redeem value, discounts at full value (assuming they get used), percent discounts on a basket equal to the spin minimum, products at unit cost.'}
                  {cost.unknown > 0 && (ar ? ` (${cost.unknown} مكافأة بدون تكلفة معروفة لم تُحسب)` : ` (${cost.unknown} reward(s) without a known cost are not counted)`)}
                </p>
              </div>
            )}

            <div className="mt-3 space-y-3">
              {draft.map((r) => (
                <div key={r._key} className={`p-4 rounded-3xl bg-card border border-border/60 ${r.active ? '' : 'opacity-60'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-bold truncate">{rewardName(r, lang) || (ar ? '(بدون تسمية)' : '(no label)')}</p>
                      <p className="text-xs text-muted-foreground">{rewardLabel(r, ar, formatPrice)}</p>
                    </div>
                    <button onClick={() => setEditingReward({ ...r })} className="grid place-items-center w-9 h-9 rounded-full bg-mist" aria-label={ar ? 'تعديل' : 'Edit'}><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => removeFromDraft(r)} className="grid place-items-center w-9 h-9 rounded-full bg-destructive/10 text-destructive" aria-label={ar ? 'حذف' : 'Delete'}><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-4">
                    <label className="block">
                      <span className="text-xs font-medium text-muted-foreground">{ar ? 'نسبة الظهور %' : 'Appearance Probability %'}</span>
                      <div className="mt-1 flex items-center gap-1.5">
                        <input
                          type="number" inputMode="decimal" step="0.01" min="0" max="100" dir="ltr"
                          value={r.probability_percent}
                          onChange={(e) => setProb(r._key, e.target.value)}
                          className="w-28 h-11 px-3 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 text-center font-heading font-bold"
                        />
                        <span className="font-heading font-bold text-muted-foreground">%</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 text-sm pb-3">
                      <input type="checkbox" checked={!!r.active} onChange={(e) => setActive(r._key, e.target.checked)} />
                      {r.active ? (ar ? 'نشط' : 'Active') : (ar ? 'متوقف' : 'Inactive')}
                    </label>
                    {r.id && (capOf(r.max_total_wins) != null || capOf(r.max_daily_wins) != null) && (
                      <CapUsage reward={r} usage={usage[r.id]} ar={ar} />
                    )}
                    {r.active && toUnits(r.probability_percent) <= 0 && (
                      <p className="pb-3 text-xs text-destructive">{ar ? 'أدخل نسبة أكبر من 0 أو أوقف المكافأة' : 'Enter a probability above 0 or mark inactive'}</p>
                    )}
                  </div>
                </div>
              ))}
              {draft.length === 0 && <p className="text-sm text-muted-foreground">{ar ? 'لا توجد مكافآت بعد' : 'No rewards yet'}</p>}
            </div>
          </div>

          {/* Equal-segment preview: every ACTIVE reward gets the same slice,
              whatever its probability. */}
          <div className="rounded-3xl bg-mist/40 border border-border/60 p-4 lg:sticky lg:top-24">
            <p className="font-heading font-bold text-sm text-center">{ar ? 'معاينة العجلة' : 'Wheel preview'}</p>
            <p className="text-[11px] text-muted-foreground text-center mb-3">
              {ar ? 'كل المكافآت النشطة بحجم متساوٍ — النسبة تؤثر على فرصة الفوز فقط' : 'All active rewards are equal size — probability only affects the chance of winning'}
            </p>
            <MysteryWheelChart rewards={previewRewards} available={0} onSpin={async () => null} ar={ar} preview maxWidth={290} />
          </div>
        </div>

        {/* Actual distribution vs the configured probability — a quick way to
            spot a reward that is winning far more (or less) than intended. */}
        <h2 className="mt-8 font-heading font-extrabold text-xl">{ar ? 'توزيع الجوائز الفعلي' : 'Actual reward distribution'}</h2>
        <div className="mt-4 rounded-3xl bg-card border border-border/60 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground text-start">
                <th className="p-3 font-medium text-start">{ar ? 'المكافأة' : 'Reward'}</th>
                <th className="p-3 font-medium text-center">{ar ? 'النسبة المضبوطة' : 'Set %'}</th>
                <th className="p-3 font-medium text-center">{ar ? 'الفعلي' : 'Actual %'}</th>
                <th className="p-3 font-medium text-center">{ar ? 'مرات الفوز' : 'Wins'}</th>
                <th className="p-3 font-medium text-center">{ar ? 'اليوم' : 'Today'}</th>
              </tr>
            </thead>
            <tbody>
              {rewards.map((r) => {
                const u = usage[r.id] || {};
                const totalWins = Object.values(usage).reduce((n, x) => n + (Number(x.total) || 0), 0);
                const actual = totalWins > 0 ? ((Number(u.total) || 0) / totalWins) * 100 : null;
                return (
                  <tr key={r.id} className="border-t border-border/50">
                    <td className="p-3 font-heading font-bold">{rewardName(r, lang)}{!r.active && <span className="ms-2 text-xs text-muted-foreground">({ar ? 'متوقفة' : 'inactive'})</span>}</td>
                    <td className="p-3 text-center" dir="ltr">{pct(r.probability_percent ?? 0)}%</td>
                    <td className="p-3 text-center" dir="ltr">{actual == null ? '—' : `${actual.toFixed(1)}%`}</td>
                    <td className="p-3 text-center">{Number(u.total) || 0}</td>
                    <td className="p-3 text-center">{Number(u.today) || 0}</td>
                  </tr>
                );
              })}
              {rewards.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={5}>{ar ? 'لا توجد بيانات' : 'No data'}</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{ar ? 'مع عدد دورات قليل، النسبة الفعلية تختلف كثيرًا عن المضبوطة وهذا طبيعي؛ تقترب منها كلما زادت الدورات.' : 'With few spins the actual share differs a lot from the set one — that is normal; it converges as spins accumulate.'}</p>

        {/* By type */}
        <h2 className="mt-8 font-heading font-extrabold text-xl">{ar ? 'حسب النوع' : 'Rewards by type'}</h2>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(byType).map(([k, v]) => <Stat key={k} label={k} value={v} />)}
          {Object.keys(byType).length === 0 && <p className="text-sm text-muted-foreground">{ar ? 'لا توجد بيانات' : 'No data'}</p>}
        </div>

        <StickySaveBar dirtyCount={dirtyCount} onCancel={revert} ar={ar}>
          <button
            onClick={saveRewards}
            disabled={!canSaveAll || savingRewards}
            title={!summary.canSave ? (ar ? 'يجب أن يكون إجمالي نسب الظهور 100%' : 'Active probabilities must total exactly 100%') : (needsUnlimited ? (ar ? 'يجب أن تبقى مكافأة نشطة واحدة على الأقل بدون حد' : 'Keep at least one active reward without a win limit') : undefined)}
            className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingRewards ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} {ar ? 'حفظ المكافآت' : 'Save rewards'}
          </button>
        </StickySaveBar>
      </div>

      {editingReward && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingReward(null)} />
          <div className="relative w-full max-w-md max-h-[90vh] overflow-auto rounded-3xl bg-card p-6 shadow-2xl">
            <h2 className="font-heading font-extrabold text-xl">{editingReward.id ? (ar ? 'تعديل' : 'Edit') : (ar ? 'مكافأة جديدة' : 'New reward')}</h2>
            <div className="mt-4 space-y-3">
              <L label={ar ? 'التسمية (عربي) — مطلوب' : 'Label (Arabic) — required'}><input className={input} value={editingReward.label} onChange={(e) => setEditingReward({ ...editingReward, label: e.target.value })} /></L>
              <L label={ar ? 'التسمية (إنجليزي) — اختياري' : 'Label (English) — optional'}><input className={input} dir="ltr" value={editingReward.label_en || ''} onChange={(e) => setEditingReward({ ...editingReward, label_en: e.target.value })} /></L>
              <L label={ar ? 'النوع' : 'Type'}><select className={input} value={editingReward.type} onChange={(e) => setEditingReward({ ...editingReward, type: e.target.value })}>{REWARD_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}</select></L>
              <L label={ar ? 'القيمة' : 'Value'}><input type="number" className={input} value={editingReward.value} onChange={(e) => setEditingReward({ ...editingReward, value: Number(e.target.value) })} /></L>
              {editingReward.type === 'product' && (
                <L label={ar ? 'المنتج' : 'Product'}>
                  <WheelProductPicker value={editingReward.product_id} productName={editingReward.product_name} onSelect={({ product_id, product_name }) => setEditingReward({ ...editingReward, product_id, product_name })} />
                </L>
              )}
              <L label={ar ? 'نسبة الظهور %' : 'Appearance Probability %'}>
                <input type="number" inputMode="decimal" step="0.01" min="0" max="100" dir="ltr" className={input} value={editingReward.probability_percent} onChange={(e) => setEditingReward({ ...editingReward, probability_percent: e.target.value })} />
              </L>
              <div className="grid grid-cols-2 gap-3">
                <L label={ar ? 'أقصى فوز (إجمالي)' : 'Max wins (total)'}>
                  <input type="number" inputMode="numeric" step="1" min="1" dir="ltr" placeholder={ar ? 'بلا حد' : 'No limit'} className={input} value={editingReward.max_total_wins ?? ''} onChange={(e) => setEditingReward({ ...editingReward, max_total_wins: e.target.value })} />
                </L>
                <L label={ar ? 'أقصى فوز باليوم' : 'Max wins per day'}>
                  <input type="number" inputMode="numeric" step="1" min="1" dir="ltr" placeholder={ar ? 'بلا حد' : 'No limit'} className={input} value={editingReward.max_daily_wins ?? ''} onChange={(e) => setEditingReward({ ...editingReward, max_daily_wins: e.target.value })} />
                </L>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">{ar ? 'اتركهما فارغين لعدم وجود حد. عند بلوغ الحد تُتجاوز المكافأة في السحب وتتوزع فرصها على الباقي.' : 'Leave empty for no limit. Once a limit is reached the reward is skipped in the draw and its chance is shared by the others.'}</p>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editingReward.active} onChange={(e) => setEditingReward({ ...editingReward, active: e.target.checked })} /> {ar ? 'نشط' : 'Active'}</label>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={applyEdit} className="flex-1 h-12 rounded-full bg-cosmic text-white font-heading font-bold">{ar ? 'تم' : 'Done'}</button>
              <button onClick={() => setEditingReward(null)} className="h-12 px-6 rounded-full bg-mist font-heading font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">{ar ? 'التغييرات تُحفظ عند الضغط على «حفظ المكافآت».' : 'Changes are saved when you press “Save rewards”.'}</p>
          </div>
        </div>
      )}
      <Footer />
      <UnsavedChangesDialog open={confirmOpen} onStay={stay} onLeave={leave} />
    </div>
  );
}

function TotalBar({ summary, ar, pct }) {
  const { status, total, remaining, excess, zeroActive } = summary;
  const ok = status === 'ok' && zeroActive === 0;
  let text;
  if (status === 'empty') text = ar ? 'لا توجد مكافآت نشطة' : 'No active rewards';
  else if (status === 'ok') text = ar ? `إجمالي نسب الظهور: ${pct(total)}%` : `Total Appearance Probability: ${pct(total)}%`;
  else if (status === 'under') text = ar ? `إجمالي النسب: ${pct(total)}% — متبقي: ${pct(remaining)}%` : `Total: ${pct(total)}% — Remaining: ${pct(remaining)}%`;
  else text = ar ? `إجمالي النسب: ${pct(total)}% — تجاوزت النسبة بـ ${pct(excess)}%` : `Total: ${pct(total)}% — Over by ${pct(excess)}%`;
  const tone = ok ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
    : status === 'empty' ? 'bg-mist border-border text-muted-foreground'
      : 'bg-destructive/10 border-destructive/40 text-destructive';
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 ${tone}`} role="status" aria-live="polite">
      <Icon className="w-5 h-5 shrink-0" />
      <div className="text-sm font-heading font-bold">
        {text}
        {status !== 'ok' && status !== 'empty' && (
          <p className="font-body font-normal text-xs opacity-80">{ar ? 'يجب أن يكون الإجمالي 100% تمامًا لحفظ المكافآت.' : 'The total must be exactly 100% before the rewards can be saved.'}</p>
        )}
        {status === 'ok' && zeroActive > 0 && (
          <p className="font-body font-normal text-xs opacity-80">{ar ? 'بعض المكافآت النشطة نسبتها 0% — أدخل نسبة أو أوقفها.' : 'Some active rewards are at 0% — enter a probability or mark them inactive.'}</p>
        )}
      </div>
    </div>
  );
}

function CapUsage({ reward, usage, ar }) {
  const total = Number(usage?.total) || 0;
  const today = Number(usage?.today) || 0;
  const mt = capOf(reward.max_total_wins);
  const md = capOf(reward.max_daily_wins);
  const outTotal = mt != null && total >= mt;
  const outToday = md != null && today >= md;
  return (
    <div className="pb-2 flex flex-wrap items-center gap-1.5 text-xs">
      {mt != null && (
        <span className={`px-2 py-0.5 rounded-full font-heading font-bold ${outTotal ? 'bg-destructive/10 text-destructive' : 'bg-mist text-muted-foreground'}`}>
          {ar ? `الإجمالي ${total}/${mt}` : `Total ${total}/${mt}`}
        </span>
      )}
      {md != null && (
        <span className={`px-2 py-0.5 rounded-full font-heading font-bold ${outToday ? 'bg-destructive/10 text-destructive' : 'bg-mist text-muted-foreground'}`}>
          {ar ? `اليوم ${today}/${md}` : `Today ${today}/${md}`}
        </span>
      )}
      {(outTotal || outToday) && (
        <span className="px-2 py-0.5 rounded-full bg-destructive text-white font-heading font-bold">
          {outTotal ? (ar ? 'نفدت' : 'Used up') : (ar ? 'نفدت اليوم' : 'Used up today')}
        </span>
      )}
    </div>
  );
}

function Stat({ label, value }) { return (<div className="rounded-2xl bg-card border border-border/60 p-4"><p className="text-2xl font-heading font-extrabold text-cosmic">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>); }
function L({ label, children }) { return (<label className="block"><span className="text-xs font-medium text-muted-foreground">{label}</span><div className="mt-1">{children}</div></label>); }
