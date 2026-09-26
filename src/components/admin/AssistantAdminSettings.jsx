import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { db } from '@/api/entities';
import { useAdminLoadGuard } from '@/hooks/useAdminLoadGuard';
import AdminLoadFailed from '@/components/admin/AdminLoadFailed';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import { upsertContent, loadContentRecord } from '@/lib/siteContent';
import { productName } from '@/lib/bilingual';
import { ASSISTANT_CONFIG_KEY, ASSISTANT_CONFIG_DEFAULT } from '@/lib/assistantConfig';

const field = 'w-full p-3 rounded-2xl bg-mist border border-border/70 outline-none focus:border-cosmic text-sm';

export default function AssistantAdminSettings() {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const { categories } = useCategories();
  const [cfg, setCfg] = useState(ASSISTANT_CONFIG_DEFAULT);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { failure, guard } = useAdminLoadGuard();

  // The saved config is editable data: a failed load shows the notice instead of
  // defaults (saving would overwrite it). The product list is only a picker and
  // stays best-effort.
  const load = async () => {
    setLoading(true);
    const [rec, prods] = await Promise.all([
      guard(() => loadContentRecord(ASSISTANT_CONFIG_KEY)),
      db.Product.list('-updated_date', 500).catch(() => []),
    ]);
    if (rec !== undefined) {
      setCfg({ ...ASSISTANT_CONFIG_DEFAULT, ...(rec?.data || {}) });
      setProducts(prods || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => !(cfg.promoted_product_ids || []).includes(p.id)
      && `${p.name || ''} ${p.name_en || ''}`.toLowerCase().includes(q)).slice(0, 6);
  }, [search, products, cfg.promoted_product_ids]);

  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const setAnswer = (i, patch) => set({ fixed_answers: cfg.fixed_answers.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const toggleCategory = (name) => set({
    promoted_categories: cfg.promoted_categories.includes(name)
      ? cfg.promoted_categories.filter((c) => c !== name) : [...cfg.promoted_categories, name],
  });

  const save = async () => {
    setSaving(true);
    try {
      await upsertContent(ASSISTANT_CONFIG_KEY, {
        ...cfg,
        fixed_answers: cfg.fixed_answers.filter((x) => x.q?.trim() && (x.a?.trim() || x.a_en?.trim())),
      });
      toast({ title: ar ? 'تم الحفظ' : 'Saved' });
    } catch (e) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (failure) return <AdminLoadFailed inline failure={failure} onRetry={load} />;

  if (loading) return <div className="mt-10 grid place-items-center py-16"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>;

  return (
    <div className="mt-6 space-y-8">
      <section className="space-y-3">
        <h2 className="font-heading font-extrabold text-lg">{ar ? 'ردود ومعلومات ثابتة' : 'Owner answers'}</h2>
        <p className="text-sm text-muted-foreground">
          {ar ? 'عندما يطابق معنى سؤال الزبون أحد الأسئلة هنا، يأخذ المساعد مضمون جوابك ويصوغه بنفسه بما يناسب سؤال الزبون، بدون تغيير الحقائق أو الأرقام أو الشروط.' : 'When a customer asks the same thing, the assistant uses the facts in your answer and words it to fit the question, without changing any facts, numbers or conditions.'}
        </p>
        {cfg.fixed_answers.map((x, i) => (
          <div key={i} className="rounded-3xl bg-card border border-border/60 p-4 grid gap-2">
            <input className={field} value={x.q || ''} onChange={(e) => setAnswer(i, { q: e.target.value })} placeholder={ar ? 'السؤال أو الموقف' : 'Question or situation'} />
            <textarea className={`${field} min-h-[70px]`} value={x.a || ''} onChange={(e) => setAnswer(i, { a: e.target.value })} placeholder={ar ? 'الجواب بالعربية' : 'Answer (Arabic)'} />
            <textarea className={`${field} min-h-[70px]`} dir="ltr" value={x.a_en || ''} onChange={(e) => setAnswer(i, { a_en: e.target.value })} placeholder="Answer (English)" />
            <button type="button" onClick={() => set({ fixed_answers: cfg.fixed_answers.filter((_, j) => j !== i) })} className="justify-self-start inline-flex items-center gap-1.5 text-xs text-destructive font-heading font-bold">
              <Trash2 className="w-3.5 h-3.5" /> {ar ? 'حذف' : 'Remove'}
            </button>
          </div>
        ))}
        <button type="button" onClick={() => set({ fixed_answers: [...cfg.fixed_answers, { q: '', a: '', a_en: '' }] })} className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-mist font-heading font-bold text-sm">
          <Plus className="w-4 h-4" /> {ar ? 'إضافة رد' : 'Add answer'}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading font-extrabold text-lg">{ar ? 'أصناف ومنتجات مُروَّجة' : 'Promoted categories & products'}</h2>
        <p className="text-sm text-muted-foreground">
          {ar ? 'يرشّحها المساعد أكثر عندما تناسب طلب الزبون، ولا يفرضها إن لم تناسبه.' : 'The assistant recommends these more often when they fit the request, and never forces them.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {(categories || []).map((c) => {
            const on = cfg.promoted_categories.includes(c.name);
            return (
              <button key={c.id} type="button" onClick={() => toggleCategory(c.name)} className={`h-9 px-4 rounded-full text-sm font-heading font-bold ${on ? 'bg-cosmic text-white' : 'bg-mist text-foreground/70'}`}>
                {ar ? c.name : (c.name_en || c.name)}
              </button>
            );
          })}
        </div>
        <input className={field} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={ar ? 'ابحث عن منتج لإضافته' : 'Search a product to add'} />
        {matches.map((p) => (
          <button key={p.id} type="button" onClick={() => { set({ promoted_product_ids: [...cfg.promoted_product_ids, p.id] }); setSearch(''); }} className="w-full text-start rounded-2xl bg-mist/60 hover:bg-mist px-4 py-2 text-sm">
            + {productName(p, lang)}
          </button>
        ))}
        <div className="flex flex-wrap gap-2">
          {cfg.promoted_product_ids.map((id) => (
            <span key={id} className="inline-flex items-center gap-1.5 h-9 ps-4 pe-2 rounded-full bg-cosmic/10 text-cosmic text-sm font-heading font-bold">
              {byId[id] ? productName(byId[id], lang) : id}
              <button type="button" onClick={() => set({ promoted_product_ids: cfg.promoted_product_ids.filter((x) => x !== id) })} aria-label="Remove"><X className="w-4 h-4" /></button>
            </span>
          ))}
        </div>
      </section>

      <button onClick={save} disabled={saving} className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold disabled:opacity-60">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />} {ar ? 'حفظ' : 'Save'}
      </button>
    </div>
  );
}
