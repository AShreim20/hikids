import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, Lock, Search, Undo2, X, ChevronUp, ChevronDown } from 'lucide-react';
import { db } from '@/api/entities';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/lib/permissions';
import FormInput from '@/components/admin/FormInput';
import { DELIVERY_RESPONSIBILITIES, deliveryResponsibilityLabel, REASON_ALLOWED_ACTION_FIELDS, reasonName } from '@/lib/returns';

export default function ReturnReasons() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const { can } = usePermissions();
  const ar = lang === 'ar';
  const allowed = can('returns.manage');

  const [reasons, setReasons] = useState([]);
  const [usedReasonIds, setUsedReasonIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await db.ReturnReason.list('sort_order', 200);
      setReasons(list || []);
      // Best-effort: return_request_items may not be readable yet if this
      // profile only has returns.manage via a narrower future grant — a
      // failure here should never block the reasons list itself, it only
      // means "in use" detection falls back to allowing deletion.
      try {
        const items = await db.ReturnRequestItem.list(null, 1000, 0, ['reason_id']);
        setUsedReasonIds(new Set((items || []).map((i) => i.reason_id).filter(Boolean)));
      } catch {
        setUsedReasonIds(new Set());
      }
    } catch {
      setReasons([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
    else setLoading(false);
  }, [allowed]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...reasons]
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || String(a.name).localeCompare(String(b.name)))
      .filter((r) => !term || String(r.name).toLowerCase().includes(term) || String(r.name_en || '').toLowerCase().includes(term));
  }, [reasons, q]);

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10"><Lock className="w-8 h-8 text-destructive" /></div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{t('admin.denied')}</h1>
          <p className="mt-3 text-muted-foreground">{t('admin.deniedDesc')}</p>
        </div>
        <Footer />
      </div>
    );
  }

  const toggleActive = async (r, active) => {
    try {
      await db.ReturnReason.update(r.id, { active });
      load();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    }
  };

  const move = async (r, delta) => {
    // Assign each reason's array position as its new sort_order (rather
    // than swapping their existing values) — freshly-created reasons all
    // default to sort_order 0, so swapping two equal values would be a
    // silent no-op. Positions are always distinct, so this always works.
    const sorted = [...reasons].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const i = sorted.findIndex((x) => x.id === r.id);
    const j = i + delta;
    if (j < 0 || j >= sorted.length) return;
    const other = sorted[j];
    try {
      await Promise.all([
        db.ReturnReason.update(r.id, { sort_order: j }),
        db.ReturnReason.update(other.id, { sort_order: i }),
      ]);
      load();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    }
  };

  // Prefer deactivation over destructive deletion once a reason has been
  // used by a Return Request (section 14) — the DB also enforces this via
  // reason_id's `on delete restrict`, this is just the friendlier UI copy.
  const remove = async (r) => {
    if (usedReasonIds.has(r.id)) {
      toast({ title: ar ? 'لا يمكن حذف سبب مستخدم في طلبات إرجاع — عطّله بدلاً من ذلك' : 'Cannot delete a reason already used by return requests — deactivate it instead', variant: 'destructive' });
      return;
    }
    if (!window.confirm(ar ? 'حذف هذا السبب؟' : 'Delete this reason?')) return;
    try {
      await db.ReturnReason.delete(r.id);
      toast({ title: ar ? 'تم الحذف' : 'Deleted' });
      load();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-12 md:pl-16">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">← {t('admin.title')}</Link>
        <div className="mt-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">{ar ? 'المرتجعات والاستبدال' : 'Returns & Exchanges'}</p>
            <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{ar ? 'أسباب الإرجاع والاستبدال' : 'Return & Exchange Reasons'}</h1>
          </div>
          <button onClick={() => { setEditing(null); setOpen(true); }} className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">
            <Plus className="w-5 h-5" /> {ar ? 'سبب جديد' : 'New reason'}
          </button>
        </div>

        <div className="relative mt-8 max-w-md">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? 'بحث عن سبب' : 'Search reasons'} className="w-full h-11 ps-9 pe-3 rounded-2xl bg-mist border border-border text-sm" />
        </div>

        {loading ? (
          <div className="mt-12 grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 rounded-3xl bg-mist/60 p-16 text-center">
            <Undo2 className="mx-auto w-10 h-10 text-muted-foreground" />
            <p className="mt-4 font-heading font-bold text-2xl">{ar ? 'لا توجد أسباب بعد' : 'No reasons yet'}</p>
            <button onClick={() => { setEditing(null); setOpen(true); }} className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">
              <Plus className="w-5 h-5" /> {ar ? 'سبب جديد' : 'New reason'}
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-3">
            {filtered.map((r, i) => (
              <div key={r.id} className={`rounded-3xl bg-card border border-border/60 p-4 sm:p-5 flex flex-wrap items-center gap-4 ${r.active === false ? 'opacity-50' : ''}`}>
                <div className="flex flex-col shrink-0 text-muted-foreground">
                  <button onClick={() => move(r, -1)} disabled={!!q.trim() || i === 0} title={q.trim() ? (ar ? 'امسح البحث لإعادة الترتيب' : 'Clear search to reorder') : undefined} className="grid place-items-center w-6 h-5 disabled:opacity-25" aria-label={ar ? 'تحريك للأعلى' : 'Move up'}><ChevronUp className="w-4 h-4" /></button>
                  <button onClick={() => move(r, 1)} disabled={!!q.trim() || i === filtered.length - 1} title={q.trim() ? (ar ? 'امسح البحث لإعادة الترتيب' : 'Clear search to reorder') : undefined} className="grid place-items-center w-6 h-5 disabled:opacity-25" aria-label={ar ? 'تحريك للأسفل' : 'Move down'}><ChevronDown className="w-4 h-4" /></button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-bold truncate">{reasonName(r, lang)}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {REASON_ALLOWED_ACTION_FIELDS.filter((f) => r[f.key]).map((f) => (
                      <span key={f.key} className="inline-flex items-center px-2 h-6 rounded-full bg-cosmic/10 text-cosmic text-xs font-heading font-bold">{f.label[lang] || f.label.en}</span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{deliveryResponsibilityLabel(r.delivery_responsibility, lang)}{r.evidence_required ? ` · ${ar ? 'يتطلب صور' : 'Evidence required'}` : ''}</p>
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={r.active !== false}
                    onChange={(e) => toggleActive(r, e.target.checked)}
                    className="w-5 h-5 rounded accent-cosmic"
                  />
                  <span className="text-muted-foreground">{r.active !== false ? (ar ? 'مفعّل' : 'Active') : (ar ? 'غير مفعّل' : 'Inactive')}</span>
                </label>

                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => { setEditing(r); setOpen(true); }} className="squish h-10 px-4 rounded-full bg-mist font-heading font-bold text-sm inline-flex items-center gap-1.5">
                    <Pencil className="w-4 h-4" /> <span className="hidden sm:inline">{t('admin.edit')}</span>
                  </button>
                  <button onClick={() => remove(r)} className="squish grid place-items-center w-10 h-10 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors" aria-label={t('admin.delete')}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />

      {open && (
        <ReturnReasonDialog
          initial={editing}
          onClose={() => setOpen(false)}
          onSaved={() => { load(); setOpen(false); }}
        />
      )}
    </div>
  );
}

function ReturnReasonDialog({ initial, onClose, onSaved }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const ar = lang === 'ar';
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    name_en: initial?.name_en || '',
    description: initial?.description || '',
    description_en: initial?.description_en || '',
    allow_return: initial?.allow_return ?? true,
    allow_exchange: initial?.allow_exchange ?? false,
    allow_missing_item: initial?.allow_missing_item ?? false,
    allow_missing_part: initial?.allow_missing_part ?? false,
    delivery_responsibility: initial?.delivery_responsibility || 'manual_review',
    evidence_required: initial?.evidence_required ?? false,
    evidence_min_images: initial?.evidence_min_images ?? 0,
    evidence_max_images: initial?.evidence_max_images ?? 5,
    evidence_instructions: initial?.evidence_instructions || '',
    evidence_instructions_en: initial?.evidence_instructions_en || '',
    active: initial?.active !== false,
    sort_order: initial?.sort_order ?? 0,
  }));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast({ title: ar ? 'الاسم مطلوب' : 'Name required', variant: 'destructive' }); return; }
    if (!form.allow_return && !form.allow_exchange && !form.allow_missing_item && !form.allow_missing_part) {
      toast({ title: ar ? 'اختر إجراءً واحدًا مسموحًا على الأقل' : 'Select at least one allowed action', variant: 'destructive' });
      return;
    }
    const minImg = Math.max(0, Number(form.evidence_min_images) || 0);
    const maxImg = Math.max(minImg, Math.min(10, Number(form.evidence_max_images) || 0));
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        name_en: form.name_en.trim(),
        description: form.description.trim(),
        description_en: form.description_en.trim(),
        allow_return: !!form.allow_return,
        allow_exchange: !!form.allow_exchange,
        allow_missing_item: !!form.allow_missing_item,
        allow_missing_part: !!form.allow_missing_part,
        delivery_responsibility: form.delivery_responsibility,
        evidence_required: !!form.evidence_required,
        evidence_min_images: minImg,
        evidence_max_images: maxImg,
        evidence_instructions: form.evidence_instructions.trim(),
        evidence_instructions_en: form.evidence_instructions_en.trim(),
        active: form.active !== false,
        sort_order: Number(form.sort_order) || 0,
      };
      if (initial?.id) await db.ReturnReason.update(initial.id, payload);
      else await db.ReturnReason.create(payload);
      toast({ title: ar ? 'تم الحفظ' : 'Saved' });
      onSaved();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-5">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form onSubmit={submit} dir={ar ? 'rtl' : 'ltr'} className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-4 shrink-0">
          <h2 className="font-heading font-extrabold text-2xl">{initial ? (ar ? 'تعديل السبب' : 'Edit reason') : (ar ? 'سبب جديد' : 'New reason')}</h2>
          <button type="button" onClick={onClose} className="grid place-items-center w-10 h-10 rounded-full bg-mist"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 pb-6 overflow-y-auto flex-1 grid gap-6">
          {/* Basic information */}
          <section className="grid gap-4">
            <p className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">{ar ? 'معلومات أساسية' : 'Basic Information'}</p>
            <FormInput label={ar ? 'الاسم (عربي)' : 'Name (Arabic)'} value={form.name} onChange={(e) => set('name', e.target.value)} required />
            <FormInput label={ar ? 'الاسم (إنجليزي) — اختياري' : 'Name (English) — optional'} value={form.name_en} onChange={(e) => set('name_en', e.target.value)} dir="ltr" />
            <FormInput label={ar ? 'وصف/تعليمات للزبون (عربي)' : 'Customer description/instructions (Arabic)'} value={form.description} onChange={(e) => set('description', e.target.value)} textarea />
            <FormInput label={ar ? 'وصف/تعليمات للزبون (إنجليزي) — اختياري' : 'Customer description/instructions (English) — optional'} value={form.description_en} onChange={(e) => set('description_en', e.target.value)} textarea dir="ltr" />
          </section>

          {/* Allowed requests */}
          <section className="grid gap-2">
            <p className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">{ar ? 'الإجراءات المسموح بها' : 'Allowed Requests'}</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {REASON_ALLOWED_ACTION_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 h-11 px-3.5 rounded-2xl bg-mist border border-border cursor-pointer">
                  <input type="checkbox" checked={!!form[f.key]} onChange={(e) => set(f.key, e.target.checked)} className="w-5 h-5 rounded accent-cosmic" />
                  <span className="text-sm font-medium">{f.label[lang] || f.label.en}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Delivery */}
          <section className="grid gap-2">
            <p className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">{ar ? 'مسؤولية التوصيل' : 'Delivery'}</p>
            <div className="grid gap-2">
              {DELIVERY_RESPONSIBILITIES.map((v) => (
                <label key={v} className={`flex items-center gap-2 h-11 px-3.5 rounded-2xl border cursor-pointer ${form.delivery_responsibility === v ? 'border-cosmic bg-cosmic/5' : 'border-border bg-mist'}`}>
                  <input type="radio" name="delivery_responsibility" checked={form.delivery_responsibility === v} onChange={() => set('delivery_responsibility', v)} className="w-4 h-4 accent-cosmic" />
                  <span className="text-sm font-medium">{deliveryResponsibilityLabel(v, lang)}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Evidence */}
          <section className="grid gap-3">
            <p className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">{ar ? 'الأدلة (الصور)' : 'Evidence'}</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.evidence_required} onChange={(e) => set('evidence_required', e.target.checked)} className="w-5 h-5 rounded accent-cosmic" />
              <span className="font-medium text-sm">{ar ? 'يتطلب إرفاق صور' : 'Require evidence'}</span>
            </label>
            {form.evidence_required && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormInput label={ar ? 'الحد الأدنى للصور' : 'Minimum images'} type="number" value={form.evidence_min_images} onChange={(e) => set('evidence_min_images', e.target.value)} />
                  <FormInput label={ar ? 'الحد الأقصى للصور' : 'Maximum images'} type="number" value={form.evidence_max_images} onChange={(e) => set('evidence_max_images', e.target.value)} />
                </div>
                <FormInput label={ar ? 'تعليمات للزبون (عربي) — اختياري' : 'Customer instructions (Arabic) — optional'} value={form.evidence_instructions} onChange={(e) => set('evidence_instructions', e.target.value)} textarea />
                <FormInput label={ar ? 'تعليمات للزبون (إنجليزي) — اختياري' : 'Customer instructions (English) — optional'} value={form.evidence_instructions_en} onChange={(e) => set('evidence_instructions_en', e.target.value)} textarea dir="ltr" />
              </>
            )}
          </section>

          {/* Status & order */}
          <section className="grid grid-cols-2 gap-4">
            <FormInput label={ar ? 'ترتيب العرض' : 'Display order'} type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
            <label className="flex items-end gap-2 cursor-pointer pb-3">
              <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} className="w-5 h-5 rounded accent-cosmic" />
              <span className="font-medium text-sm">{ar ? 'مفعّل' : 'Active'}</span>
            </label>
          </section>
        </div>
        <div className="flex gap-3 p-6 pt-0 shrink-0">
          <button type="submit" disabled={saving} className="flex-1 h-12 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t('admin.save')}
          </button>
          <button type="button" onClick={onClose} className="h-12 px-6 rounded-full bg-mist font-heading font-bold">{t('admin.cancel')}</button>
        </div>
      </form>
    </div>
  );
}
