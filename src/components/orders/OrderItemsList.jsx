import React from 'react';
import { useLanguage } from '@/context/LanguageContext';

// Purchased items exactly as snapshotted at checkout time (name, variant, SKU,
// unit price) — never re-read from the live product.
export default function OrderItemsList({ order }) {
  const { lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';

  return (
    <div className="rounded-3xl bg-card border border-border/60 p-5 sm:p-6">
      <h2 className="font-heading font-extrabold text-xl">{ar ? 'المنتجات' : 'Products'}</h2>
      <div className="mt-4 space-y-3">
        {(order.items || []).map((it, i) => (
          <div key={i} className="flex items-start justify-between gap-4 pt-3 first:pt-0 border-t first:border-0 border-border/60">
            <div>
              <p className="font-heading font-bold">{it.name}</p>
              {it.variant_label && (
                <p className="text-sm text-muted-foreground">{it.variant_label}</p>
              )}
              {it.variant_attributes &&
                Object.entries(it.variant_attributes).map(([k, v]) => (
                  <p key={k} className="text-xs text-muted-foreground">{k}: {v}</p>
                ))}
              {it.sku && <p className="text-xs text-muted-foreground">SKU: {it.sku}</p>}
              <p className="mt-1 text-sm text-muted-foreground">
                {formatPrice(it.price)} × {it.qty}
              </p>
            </div>
            <p className="font-heading font-bold whitespace-nowrap">
              {formatPrice(Number(it.price || 0) * Number(it.qty || 0))}
            </p>
          </div>
        ))}
        {(order.items || []).length === 0 && (
          <p className="text-sm text-muted-foreground">{ar ? 'لا توجد منتجات' : 'No items'}</p>
        )}
      </div>
    </div>
  );
}