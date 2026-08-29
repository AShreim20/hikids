import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, Lock, Sparkles, Save } from 'lucide-react';
import { db } from '@/api/entities';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { rewardLabel } from '@/lib/rewards';
import { rewardName } from '@/lib/bilingual';
import WheelProductPicker from '@/components/admin/WheelProductPicker';

const REWARD_TYPES = ['points', 'discount_percent', 'discount_fixed', 'free_delivery', 'product', 'credit'];
const BASIS = [
  { key: 'total', label: { en: 'Total purchases', ar: 'إجمالي المشتريات' } },
  { key: 'single_order', label: { en: 'Single order', ar: 'طلب واحد' } },
  { key: 'period', label: { en: 'Specific period', ar: 'فترة محددة' } },
];
const emptyConfig = { name: 'Mystery Unboxing', min_amount: 200, basis: 'total', period_start: '', period_end: '', start_date: '', end_date: '', active: true, max_spins: 0, spins_expire: false, accumulate: true, first_time_enabled: false, first_time_new_only: false };
const emptyReward = { label: '', label_en: '', type: 'points', value: 50, product_id: '', weight: 1, active: true, sort_order: 0 };

export default function MysteryWheelAdmin() {
  const { user } = useAuth();
  const { lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(emptyConfig);
  const [configId, setConfigId] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [spins, setSpins] = useState([]);
  const [history, setHistory] = useState([]);
  const [editingReward, setEditingReward] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [cfgs, rw, sp, h] = await Promise.allSettled([
        db.WheelConfig.list('-created_date', 50),
        db.WheelReward.list('-created_date', 100),
        db.WheelSpin.list('-created_date', 500),
        db.RewardHistory.filter({ source: 'wheel' }),
      ]);
      const cfgList = cfgs.status === 'fulfilled' ? cfgs.value || [] : [];
      if (cfgList[0]) { setConfig({ ...emptyConfig, ...cfgList[0] }); setConfigId(cfgList[0].id); }
      setRewards(rw.status === 'fulfilled' ? rw.value || [] : []);
      setSpins(sp.status === 'fulfilled' ? sp.value || [] : []);
      setHistory(h.status === 'fulfilled' ? h.value || [] : []);
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

  const saveConfig = async () => {
    try {
      if (configId) await db.WheelConfig.update(configId, config);
      else { const c = await db.WheelConfig.create(config); setConfigId(c.id); }
      toast({ title: ar ? 'تم حفظ الإعدادات' : 'Config saved' });
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
  };
  const saveReward = async () => {
    const r = editingReward;
    if (!r.label) { toast({ title: ar ? 'التسمية مطلوبة' : 'Label required', variant: 'destructive' }); return; }
    try {
      if (r.id) await db.WheelReward.update(r.id, r);
      else await db.WheelReward.create(r);
      setEditingReward(null); load();
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
  };
  const removeReward = async (r) => { if (!window.confirm(ar ? 'حذف المكافأة؟' : 'Delete reward?')) return; await db.WheelReward.delete(r.id); load(); };

  const byType = {};
  spins.forEach((s) => { byType[s.reward_type] = (byType[s.reward_type] || 0) + 1; });
  const pointsDist = history.reduce((s, h) => s + (h.points || 0), 0);
  const input = "w-full h-11 px-3 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40";

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
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={ar ? 'الدورات' : 'Spins'} value={spins.length} />
          <Stat label={ar ? 'مكافآت موزّعة' : 'Rewards given'} value={history.length} />
          <Stat label={ar ? 'نقاط موزّعة' : 'Points distributed'} value={pointsDist} />
          <Stat label={ar ? 'مكافآت يدوية' : 'Manual rewards'} value={spins.filter((s) => s.fulfillment === 'manual').length} />
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
          <button onClick={() => setEditingReward({ ...emptyReward })} className="squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold text-sm"><Plus className="w-4 h-4" /> {ar ? 'إضافة' : 'Add reward'}</button>
        </div>
        <div className="mt-4 space-y-3">
          {rewards.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-4 rounded-3xl bg-card border border-border/60">
              <div className="flex-1">
                <p className="font-heading font-bold">{rewardName(r, lang)} <span className="text-xs text-muted-foreground">· {rewardLabel(r, ar, formatPrice)}</span></p>
                <p className="text-xs text-muted-foreground">{ar ? 'الوزن' : 'Weight'}: {r.weight} · {r.active ? (ar ? 'نشط' : 'Active') : (ar ? 'متوقف' : 'Inactive')}</p>
              </div>
              <button onClick={() => setEditingReward({ ...r })} className="grid place-items-center w-9 h-9 rounded-full bg-mist"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => removeReward(r)} className="grid place-items-center w-9 h-9 rounded-full bg-destructive/10 text-destructive"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {rewards.length === 0 && <p className="text-sm text-muted-foreground">{ar ? 'لا توجد مكافآت بعد' : 'No rewards yet'}</p>}
        </div>

        {/* By type */}
        <h2 className="mt-8 font-heading font-extrabold text-xl">{ar ? 'حسب النوع' : 'Rewards by type'}</h2>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(byType).map(([k, v]) => <Stat key={k} label={k} value={v} />)}
          {Object.keys(byType).length === 0 && <p className="text-sm text-muted-foreground">{ar ? 'لا توجد بيانات' : 'No data'}</p>}
        </div>
      </div>

      {editingReward && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingReward(null)} />
          <div className="relative w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl">
            <h2 className="font-heading font-extrabold text-xl">{editingReward.id ? (ar ? 'تعديل' : 'Edit') : (ar ? 'مكافأة جديدة' : 'New reward')}</h2>
            <div className="mt-4 space-y-3">
              <L label={ar ? 'التسمية (عربي) — مطلوب' : 'Label (Arabic) — required'}><input className={input} value={editingReward.label} onChange={(e) => setEditingReward({ ...editingReward, label: e.target.value })} /></L>
              <L label={ar ? 'التسمية (إنجليزي) — اختياري' : 'Label (English) — optional'}><input className={input} value={editingReward.label_en || ''} onChange={(e) => setEditingReward({ ...editingReward, label_en: e.target.value })} /></L>
              <L label={ar ? 'النوع' : 'Type'}><select className={input} value={editingReward.type} onChange={(e) => setEditingReward({ ...editingReward, type: e.target.value })}>{REWARD_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}</select></L>
              <L label={ar ? 'القيمة' : 'Value'}><input type="number" className={input} value={editingReward.value} onChange={(e) => setEditingReward({ ...editingReward, value: Number(e.target.value) })} /></L>
              {editingReward.type === 'product' && (
                <L label={ar ? 'المنتج' : 'Product'}>
                  <WheelProductPicker value={editingReward.product_id} productName={editingReward.product_name} onSelect={({ product_id, product_name }) => setEditingReward({ ...editingReward, product_id, product_name })} />
                </L>
              )}
              <L label={ar ? 'الوزن (الاحتمال)' : 'Weight (probability)'}><input type="number" className={input} value={editingReward.weight} onChange={(e) => setEditingReward({ ...editingReward, weight: Number(e.target.value) })} /></L>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editingReward.active} onChange={(e) => setEditingReward({ ...editingReward, active: e.target.checked })} /> {ar ? 'نشط' : 'Active'}</label>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={saveReward} className="flex-1 h-12 rounded-full bg-cosmic text-white font-heading font-bold">{ar ? 'حفظ' : 'Save'}</button>
              <button onClick={() => setEditingReward(null)} className="h-12 px-6 rounded-full bg-mist font-heading font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
function Stat({ label, value }) { return (<div className="rounded-2xl bg-card border border-border/60 p-4"><p className="text-2xl font-heading font-extrabold text-cosmic">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>); }
function L({ label, children }) { return (<label className="block"><span className="text-xs font-medium text-muted-foreground">{label}</span><div className="mt-1">{children}</div></label>); }