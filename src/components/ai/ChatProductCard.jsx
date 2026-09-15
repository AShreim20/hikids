import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import { priceInfo } from '@/lib/pricing';
import { productName } from '@/lib/bilingual';
import { detectTextDir } from '@/lib/textDirection';
import { hasVariants, getVariants, isSellable } from '@/lib/variants';

// Compact recommendation card for the assistant chat. Every field the
// assistant could get wrong or make up — price, discount, stock — is read
// straight from the live `product` record via the exact same helpers the
// storefront's own ProductCard uses (priceInfo + discountPctFor for price/
// discount, the variants helpers for stock), never from anything the AI
// wrote. Only `reason` (a short "why this fits" line) comes from the
// assistant — everything a customer could act on (price, availability, the
// link) is real data.
export default function ChatProductCard({ product, reason, onNavigate }) {
  const { t, lang, formatPrice } = useLanguage();
  const { discountPctFor } = useCategories();
  const { original, final, hasDiscount } = priceInfo(product, discountPctFor(product.category));
  const variantMode = hasVariants(product);
  const outOfStock = variantMode
    ? !getVariants(product).some(isSellable)
    : Number(product.stock) === 0;
  const name = productName(product, lang);

  return (
    // Two rows rather than one wide row: the chat panel never exceeds
    // ~24rem even on desktop, and a single row (thumbnail + name + reason +
    // price + button all competing for that width) forced long product
    // names — Arabic ones especially — into an awkward multi-line wrap. The
    // name/reason now get the full width of row 1 (sharing only with the
    // thumbnail); price/stock and the button move to their own row below.
    <Link
      to={`/product/${product.id}`}
      onClick={() => typeof onNavigate === 'function' && onNavigate()}
      className="flex flex-col gap-2 p-2.5 rounded-2xl bg-card border border-border hover:border-cosmic hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cosmic/50"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-mist">
          {product.image_url && (
            <Image src={product.image_url} alt={name} fittingType="fill" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p dir={detectTextDir(name)} className="font-heading font-bold text-sm leading-snug line-clamp-2">
            {name}
          </p>
          {reason && (
            <p dir={detectTextDir(reason)} className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {reason}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="font-heading font-extrabold text-sm text-cosmic">{formatPrice(final)}</span>
          {hasDiscount && (
            <span className="text-xs text-muted-foreground line-through">{formatPrice(original)}</span>
          )}
          <span className={`text-[11px] font-bold ${outOfStock ? 'text-destructive' : 'text-muted-foreground'}`}>
            {outOfStock ? t('ai.outOfStock') : t('ai.inStock')}
          </span>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full bg-cosmic text-white text-xs font-heading font-bold whitespace-nowrap">
          {t('ai.viewProduct')} <ArrowUpRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}
