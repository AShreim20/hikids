import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, Lock, Search, Tag, X } from 'lucide-react';
import { db } from '@/api/entities';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/lib/permissions';
import FormInput from '@/components/admin/FormInput';

export default function ExpenseCategories() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const { can } = usePermissions();
  const ar = lang === 'ar';
  const allowed = can('expenses.manage');

  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [cats, exp] = await Promise.all([
        db.ExpenseCategory.list('sort_order', 200),
        db.Expense.list('-expense_date', 500, 0, ['category_id']),
      ]);
      setCategories(cats || []);
      setExpenses(exp || []);
    } catch {
      setCategories([]);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
    else setLoading(false);
  }, [allowed]);

  // How many expenses reference each category, so deleting one in use can be
  // blocked (the category is detached — never destroys expense history — but
  // an admin deleting it by accident would otherwise lose the grouping).
  const counts = useMemo(() => {
    const m = {};
    for (const e of expenses) if (e.category_id) m[e.category_id] = (m[e.category_id] || 0) + 1;
    return m;
  }, [expenses]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...categories]
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || String(a.name).localeCompare(String(b.name)))
      .filter((c) => !term || String(c.name).toLowerCase().includes(term) || String(c.name_en || '').toLowerCase().includes(term));
  }, [categories, q]);

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10"><Lock className="w-8 h-8 text-destructive" /></div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{t('expenses.denied')}</h1>
          <p className="mt-3 text-muted-foreground">{t('expenses.deniedDesc')}</p>
        </div>
        <Footer />
      </div>
    );
  }

  const toggleActive = async (c, active) => {
    try {
      await db.ExpenseCategory.update(c.id, { active });
      load();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    }
  };

  const remove = async (c) => {
    const count = counts[c.id] || 0;
    if (count > 0) {
      toast({ title: ar ? 'لا يمكن حذف فئة تحتوي على مصروفات' : 'Cannot delete a category that has expenses', variant: 'destructive' });
      return;
    }
    if (!window.confirm(ar ? 'حذف هذه الفئة؟' : 'Delete this category?')) return;
    try {
      await db.ExpenseCategory.delete(c.id);
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
        <Link to="/admin/expenses" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">← {t('expenses.title')}</Link>
        <div className="mt-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">{t('expenses.categoriesSubtitle')}</p>
            <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{t('expenses.categoriesTitle')}</h1>
          </div>
          <button onClick={() => { setEditing(null); setOpen(true); }} className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">
            <Plus className="w-5 h-5" /> {t('expenses.newCategory')}
          </button>
        </div>

        <div className="relative mt-8 max-w-md">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('expenses.searchCategories')} className="w-full h-11 ps-9 pe-3 rounded-2xl bg-mist border border-border text-sm" />
        </div>

        {loading ? (
          <div className="mt-12 grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 rounded-3xl bg-mist/60 p-16 text-center">
            <Tag className="mx-auto w-10 h-10 text-muted-foreground" />
            <p className="mt-4 font-heading font-bold text-2xl">{t('expenses.noCategories')}</p>
            <button onClick={() => { setEditing(null); setOpen(true); }} className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">
              <Plus className="w-5 h-5" /> {t('expenses.newCategory')}
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-3">
            {filtered.map((c) => (
              <div key={c.id} className={`rounded-3xl bg-card border border-border/60 p-4 sm:p-5 flex flex-wrap items-center gap-4 ${c.active === false ? 'opacity-50' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-bold truncate">{ar ? c.name : (c.name_en || c.name)}</p>
                  {ar && c.name_en ? <p className="text-xs text-muted-foreground truncate" dir="ltr">{c.name_en}</p> : null}
                  <p className="text-xs text-muted-foreground">{counts[c.id] || 0} {t('expenses.title')}</p>
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={c.active !== false}
                    onChange={(e) => toggleActive(c, e.target.checked)}
                    className="w-5 h-5 rounded accent-cosmic"
                  />
                  <span className="text-muted-foreground">{c.active !== false ? t('delivery.active') : t('delivery.inactive')}</span>
                </label>

                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => { setEditing(c); setOpen(true); }} className="squish h-10 px-4 rounded-full bg-mist font-heading font-bold text-sm inline-flex items-center gap-1.5">
                    <Pencil className="w-4 h-4" /> <span className="hidden sm:inline">{t('admin.edit')}</span>
                  </button>
                  <button onClick={() => remove(c)} className="squish grid place-items-center w-10 h-10 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors" aria-label={t('admin.delete')}>
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
        <ExpenseCategoryDialog
          initial={editing}
          onClose={() => setOpen(false)}
          onSaved={() => { load(); setOpen(false); }}
        />
      )}
    </div>
  );
}

function ExpenseCategoryDialog({ initial, onClose, onSaved }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const ar = lang === 'ar';
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    name_en: initial?.name_en || '',
    description: initial?.description || '',
    sort_order: initial?.sort_order ?? 0,
    active: initial?.active !== false,
  }));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast({ title: ar ? 'الاسم مطلوب' : 'Name required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        name_en: form.name_en.trim(),
        description: form.description.trim(),
        sort_order: Number(form.sort_order) || 0,
        active: form.active !== false,
      };
      if (initial?.id) await db.ExpenseCategory.update(initial.id, payload);
      else await db.ExpenseCategory.create(payload);
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
      <form onSubmit={submit} className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-4 shrink-0">
          <h2 className="font-heading font-extrabold text-2xl">{initial ? t('expenses.editCategory') : t('expenses.newCategory')}</h2>
          <button type="button" onClick={onClose} className="grid place-items-center w-10 h-10 rounded-full bg-mist"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 pb-6 overflow-y-auto flex-1 grid gap-4">
          <FormInput label={ar ? 'الاسم (عربي)' : 'Name (Arabic)'} value={form.name} onChange={(e) => set('name', e.target.value)} required />
          <FormInput label={ar ? 'الاسم (إنجليزي) — اختياري' : 'Name (English) — optional'} value={form.name_en} onChange={(e) => set('name_en', e.target.value)} dir="ltr" />
          <FormInput label={ar ? 'الوصف — اختياري' : 'Description — optional'} value={form.description} onChange={(e) => set('description', e.target.value)} textarea />
          <FormInput label={ar ? 'ترتيب الفرز' : 'Sort order'} type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} className="w-5 h-5 rounded accent-cosmic" />
            <span className="font-medium text-sm">{ar ? 'مفعّلة (تظهر في نموذج المصروفات)' : 'Active (shows in the expense form)'}</span>
          </label>
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
