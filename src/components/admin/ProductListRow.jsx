import React from 'react';
import { Pencil, Trash2, Link2 } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import { priceInfo } from '@/lib/pricing';
import { productName } from '@/lib/bilingual';
import { useToast } from '@/components/ui/use-toast';

const productSku = (p) => {
  const sku = (p.variants || []).map((v) => v.sku).find(Boolean);
  return sku || (p.id ? p.id.slice(-6).toUpperCase() : '—');
};

export default function ProductListRow({ product: p, onEdit, onDelete, selected, onToggleSelect }) {
  const { t, lang, formatPrice } = useLanguage();
  const { discountPctFor } = useCategories();
  const { toast } = useToast();
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
        <p className="font-heading font-bold truncate">{productName(p, lang)}</p>
        <p className="text-xs text-muted-foreground truncate">
          {p.category || '—'}{p.age_range ? ` · ${t('pd.ages')} ${p.age_range}` : ''}
        </p>
        <p className="text-xs text-muted-foreground/80 truncate">SKU: {productSku(p)}</p>
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