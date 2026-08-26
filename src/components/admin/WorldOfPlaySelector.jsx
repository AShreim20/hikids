import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import { useSiteContent } from '@/context/SiteContentContext';
import { upsertContent, loadContentRecord } from '@/lib/siteContent';
import { useToast } from '@/components/ui/use-toast';
import { categoryName } from '@/lib/bilingual';

const KEY = 'world_of_play';
const MAX = 6;

// Admin panel: choose which categories appear in the homepage "World of Play"
// section. Selection is stored in SiteContent key "world_of_play" as
// { category_ids: [...] }. When the selection is empty, the homepage
// automatically shows the 6 categories with the most products.
export default function WorldOfPlaySelector() {
  const { lang, t } = useLanguage();
  const ar = lang === 'ar';
  const { categories } = useCategories();
  const { reload } = useSiteContent();
  const { toast } = useToast();
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    loadContentRecord(KEY)
      .then((rec) => {
        if (!alive) return;
        setSelected((rec?.data?.category_ids || []).filter((id) => categories.some((c) => c.id === id)));
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const sorted = useMemo(
    () => [...categories].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [categories]
  );

  const toggle = (id) => {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= MAX) {
        toast({ title: ar ? `الحد الأقصى ${MAX} فئات` : `Max ${MAX} categories`, variant: 'destructive' });
        return cur;
      }
      return [...cur, id];
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await upsertContent(KEY, { category_ids: selected });
      reload();
      toast({ title: ar ? 'تم الحفظ' : 'Saved' });
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!categories.length) return null;

  return (
    <div className="mt-8 rounded-3xl bg-card border border-border/60 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-cosmic" />
        <h2 className="font-heading font-extrabold text-xl">
          {ar ? 'عالم اللعب — الصفحة الرئيسية' : 'World of Play — Homepage'}
        </h2>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {ar
          ? `اختر حتى ${MAX} فئات لعرضها. تركها فارغًا يعرض أعلى ${MAX} فئات تلقائيًا.`
          : `Pick up to ${MAX} categories to feature. Leave empty to auto-show the top ${MAX}.`}
      </p>

      {loading ? (
        <div className="grid place-items-center py-8"><Loader2 className="w-6 h-6 animate-spin text-cosmic" /></div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {sorted.map((c) => {
              const active = selected.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className={`squish h-10 px-4 rounded-full text-sm font-medium transition-colors ${
                    active ? 'bg-cosmic text-white' : 'bg-mist text-foreground/70 hover:bg-accent/20'
                  }`}
                >
                  {categoryName(c, lang)}
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="squish inline-flex items-center gap-2 h-11 px-6 rounded-full bg-cosmic text-white font-heading font-bold disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t('admin.save')}
            </button>
            <span className="text-sm text-muted-foreground">
              {selected.length} / {MAX}
            </span>
          </div>
        </>
      )}
    </div>
  );
}