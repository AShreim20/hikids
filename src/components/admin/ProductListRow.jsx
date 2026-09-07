import React from 'react';
import { Pencil, Trash2, Link2, AlertTriangle } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import { priceInfo } from '@/lib/pricing';
import { productName, categoryName } from '@/lib/bilingual';
import { useToast } from '@/components/ui/use-toast';

const productSku = (p) => {
  const sku = (p.variants || []).map((v) => v.sku).find(Boolean);
  return sku || (p.id ? p.id.slice(-6).toUpperCase() : '—');
};

export default function ProductListRow({ product: p, onEdit, onDelete, selected, onToggleSelect }) {
  const { t, lang, formatPrice } = useLanguage();
  const { discountPctFor, categories } = useCategories();
  const { toast } = useToast();
  const additionalCount = Array.isArray(p.category_ids) ? p.category_ids.length : 0;
  const additionalNames = additionalCount
    ? p.category_ids.map((id) => categories.find((c) => c.id === id)).filter(Boolean).map((c) => categoryName(c, lang)).join(', ')
    : '';
  const copyLink = async () => {
    const url = `${window.location.origin}/product/${p.id}`;
    try { await navigator.clipboard.writeText(url); toast({ title: t('admin.linkCopied') }); }
    catch { toast({ title: lang === 'ar' ? 'تعذّر النسخ' : 'Copy failed', variant: 'destructive' }); }
  };
  const { original, final, hasDiscount, source } = priceInfo(p, discountPctFor(p.category));
  const stock = Number(p.stock ?? 0);
  const outOfStock = stock <= 0;
  const lowStock = stock > 0 && stock <= 5;
  const tags = Array.isArray(p.tags) ? p.tags.slice(0, 3) : [];

  return (
    <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-3xl bg-card border border-border/60 flex-wrap sm:flex-nowrap">
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={onToggleSelect}
          className="w-5 h-5 rounded accent-cosmic shrink-0"
          aria-label={t('admin.selectAll')}
        />
      )}
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-mist shrink-0">
        <Image src={p.image_url} alt={productName(p, lang)} fittingType="fill" className="w-full h-full" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-heading font-bold flex items-center gap-2 min-w-0">
          {/* The truncating text needs to be its own flex item with min-w-0
              — a bare text node next to the badge can't shrink/ellipsize on
              its own and was pushing the whole row (and the page) wider than
              the viewport on narrow screens with a long product name. */}
          <span className="truncate min-w-0">{productName(p, lang)}</span>
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-heading font-bold ${p.status === 'draft' ? 'bg-accent/15 text-accent' : 'bg-cosmic/10 text-cosmic'}`}>
            {p.status === 'draft' ? t('admin.statusDraft') : t('admin.statusPublished')}
          </span>
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {p.category || '—'}
          {additionalCount > 0 && (
            <span
              className="ms-1 px-1.5 py-0.5 rounded-full bg-mist text-foreground/70 text-[10px] font-heading font-bold align-middle cursor-default"
              title={additionalNames}
            >
              +{additionalCount}
            </span>
          )}
          {p.age_range ? ` · ${t('pd.ages')} ${p.age_range}` : ''}
        </p>
        <p className="text-xs text-muted-foreground/80 truncate">SKU: {productSku(p)}</p>
        {!p.gender && (
          <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-accent">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {lang === 'ar' ? 'بحاجة لتصنيف الجنس' : 'Needs gender classification'}
          </p>
        )}
        {tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-full bg-mist text-foreground/60 text-[11px] font-medium">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Unit cost — desktop only */}
      <div className="hidden lg:block text-end shrink-0 w-24">
        <p className="text-xs text-muted-foreground">{t('admin.unitCost')}</p>
        <p className="font-medium text-sm">{p.unit_cost != null ? formatPrice(p.unit_cost) : '—'}</p>
      </div>

      {/* Selling / discounted price */}
      <div className="text-end shrink-0 w-28 sm:w-32">
        <p className="font-heading font-extrabold text-cosmic">{formatPrice(final)}</p>
        {hasDiscount && <p className="text-xs text-muted-foreground line-through">{formatPrice(original)}</p>}
        {source === 'category' && <p className="text-[10px] text-accent font-bold">−{Math.round((1 - final / original) * 100)}% cat</p>}
      </div>

      {/* Stock + status */}
      <div className="text-end shrink-0 w-20 hidden sm:block">
        <p className="text-xs text-muted-foreground">{t('pd.inStock')}</p>
        <p className={`font-heading font-bold text-sm ${outOfStock ? 'text-destructive' : lowStock ? 'text-accent' : 'text-foreground'}`}>{stock}</p>
        <span className={`mt-0.5 inline-block px-2 py-0.5 rounded-full text-[10px] font-heading font-bold ${outOfStock ? 'bg-destructive/10 text-destructive' : 'bg-cosmic/10 text-cosmic'}`}>
          {outOfStock ? (t('pd.outOfStock')) : (t('admin.active') || 'Active')}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0 ms-auto sm:ms-0">
        <button onClick={copyLink} className="squish grid place-items-center w-10 h-10 rounded-full bg-mist text-foreground hover:bg-cosmic hover:text-white transition-colors" aria-label={t('admin.copyLink')} title={t('admin.copyLink')}>
          <Link2 className="w-4 h-4" />
        </button>
        <button onClick={() => onEdit(p)} className="squish h-10 px-4 rounded-full bg-mist font-heading font-bold text-sm inline-flex items-center gap-1.5">
          <Pencil className="w-4 h-4" /> <span className="hidden sm:inline">{t('admin.edit')}</span>
        </button>
        <button
          onClick={() => onDelete(p)}
          className="squish grid place-items-center w-10 h-10 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors"
          aria-label={t('admin.delete')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}