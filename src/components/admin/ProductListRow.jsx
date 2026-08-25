import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { useLanguage } from '@/context/LanguageContext';

export default function ProductListRow({ product: p, onEdit, onDelete, selected, onToggleSelect }) {
  const { t, formatPrice } = useLanguage();
  return (
    <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-3xl bg-card border border-border/60">
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
        <Image src={p.image_url} alt={p.name} fittingType="fill" className="w-full h-full" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-heading font-bold truncate">{p.name}</p>
        <p className="text-xs text-muted-foreground truncate">{p.category} · {t('pd.inStock')}: {p.stock ?? 0}</p>
        {p.unit_cost != null && (
          <p className="text-xs text-muted-foreground truncate">{t('admin.unitCost')}: {formatPrice(p.unit_cost)}</p>
        )}
      </div>
      <div className="hidden sm:block text-end shrink-0">
        <p className="font-heading font-extrabold text-cosmic">{formatPrice(p.sale_price ?? p.price)}</p>
        {p.sale_price != null && p.sale_price < p.price && (
          <p className="text-xs text-muted-foreground line-through">{formatPrice(p.price)}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
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