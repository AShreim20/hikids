import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, Lock, Search, Tag, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import FormInput from '@/components/admin/FormInput';

export default function Categories() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const ar = lang === 'ar';
  const { categories, refresh } = useCategories();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      base44.entities.Product.list('-updated_date', 500)
        .then(setProducts)
        .catch(() => setProducts([]))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  const counts = useMemo(() => {
    const m = {};
    for (const p of products) m[p.category] = (m[p.category] || 0) + 1;
    return m;
  }, [products]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...categories]
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || String(a.name).localeCompare(String(b.name)))
      .filter((c) => !term || String(c.name).toLowerCase().includes(term));
  }, [categories, q]);

  if (user?.role !== 'admin') {
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

  const saveDiscount = async (c, patch) => {
    try {
      await base44.entities.Category.update(c.id, patch);
      refresh();
      toast({ title: ar ? 'تم التحديث' : 'Updated' });
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    }
  };

  const remove = async (c) => {
    const count = counts[c.name] || 0;
    if (count > 0) {
      toast({ title: ar ? 'لا يمكن حذف فئة تحتوي على منتجات' : 'Cannot delete a category that has products', variant: 'destructive' });
      return;
    }
    if (!window.confirm(ar ? 'حذف هذه الفئة؟' : 'Delete this category?')) return;
    try {
      await base44.entities.Category.delete(c.id);
      refresh();
      toast({ title: ar ? 'تم الحذف' : 'Deleted' });
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12 md:pl-16">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">← {t('admin.title')}</Link>
        <div className="mt-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">{t('admin.subtitle')}</p>
            <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{ar ? 'إدارة الفئات' : 'Categories'}</h1>
          </div>
          <button onClick={() => { setEditing(null); setOpen(true); }} className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">
            <Plus className="w-5 h-5" /> {ar ? 'فئة جديدة' : 'New category'}
          </button>
        </div>

        <div className="relative mt-8 max-w-md">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? 'بحث عن فئة' : 'Search categories'} className="w-full h-11 ps-9 pe-3 rounded-2xl bg-mist border border-border text-sm" />
        </div>

        {loading ? (
          <div className="mt-12 grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 rounded-3xl bg-mist/60 p-16 text-center">
            <Tag className="mx-auto w-10 h-10 text-muted-foreground" />
            <p className="mt-4 font-heading font-bold text-2xl">{ar ? 'لا توجد فئات' : 'No categories'}</p>
            <button onClick={() => { setEditing(null); setOpen(true); }} className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">
              <Plus className="w-5 h-5" /> {ar ? 'فئة جديدة' : 'New category'}
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-3">
            {filtered.map((c) => (
              <div key={c.id} className="rounded-3xl bg-card border border-border/60 p-4 sm:p-5 flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-bold truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{counts[c.name] || 0} {ar ? 'منتج' : 'products'}</p>
                </div>

                {/* Category discount controls */}
                <div className="flex items-center gap-2 shrink-0">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!c.discount_active}
                      onChange={(e) => saveDiscount(c, { discount_active: e.target.checked })}
                      className="w-5 h-5 rounded accent-cosmic"
                    />
                    <span className="text-muted-foreground">{ar ? 'خصم الفئة' : 'Category discount'}</span>
                  </label>
                  <div className="flex items-center gap-1 rounded-full bg-mist px-2 h-10">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={c.discount_percent ?? 0}
                      onChange={(e) => saveDiscount(c, { discount_percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                      className="w-14 bg-transparent text-center text-sm font-heading font-bold focus:outline-none"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  {c.discount_active && Number(c.discount_percent) > 0 && (
                    <span className="inline-flex items-center px-2.5 h-8 rounded-full bg-accent/15 text-accent text-xs font-heading font-bold">
                      −{c.discount_percent}%
                    </span>
                  )}
                </div>

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
        <CategoryDialog
          initial={editing}
          onClose={() => setOpen(false)}
          onSaved={() => { refresh(); setOpen(false); }}
        />
      )}
    </div>
  );
}

function CategoryDialog({ initial, onClose, onSaved }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const ar = lang === 'ar';
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    description: initial?.description || '',
    sort_order: initial?.sort_order ?? 0,
    discount_percent: initial?.discount_percent ?? 0,
    discount_active: !!initial?.discount_active,
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
        description: form.description,
        sort_order: Number(form.sort_order) || 0,
        discount_percent: Math.max(0, Math.min(100, Number(form.discount_percent) || 0)),
        discount_active: !!form.discount_active,
      };
      if (initial?.id) await base44.entities.Category.update(initial.id, payload);
      else await base44.entities.Category.create(payload);
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
      <form onSubmit={submit} className="relative w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-extrabold text-2xl">{initial ? (ar ? 'تعديل الفئة' : 'Edit category') : (ar ? 'فئة جديدة' : 'New category')}</h2>
          <button type="button" onClick={onClose} className="grid place-items-center w-10 h-10 rounded-full bg-mist"><X className="w-5 h-5" /></button>
        </div>
        <div className="mt-5 grid gap-4">
          <FormInput label={ar ? 'الاسم' : 'Name'} value={form.name} onChange={(e) => set('name', e.target.value)} required />
          <FormInput label={ar ? 'الوصف' : 'Description'} value={form.description} onChange={(e) => set('description', e.target.value)} textarea />
          <FormInput label={ar ? 'ترتيب الفرز' : 'Sort order'} type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
          <div className="grid grid-cols-2 gap-4">
            <FormInput label={ar ? 'نسبة الخصم %' : 'Discount %'} type="number" value={form.discount_percent} onChange={(e) => set('discount_percent', e.target.value)} />
            <label className="flex items-end gap-2 cursor-pointer pb-3">
              <input type="checkbox" checked={form.discount_active} onChange={(e) => set('discount_active', e.target.checked)} className="w-5 h-5 rounded accent-cosmic" />
              <span className="font-medium text-sm">{ar ? 'تفعيل الخصم' : 'Enable discount'}</span>
            </label>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button type="submit" disabled={saving} className="flex-1 h-12 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t('admin.save')}
          </button>
          <button type="button" onClick={onClose} className="h-12 px-6 rounded-full bg-mist font-heading font-bold">{t('admin.cancel')}</button>
        </div>
      </form>
    </div>
  );
}