import React from 'react';
import { useLanguage } from '@/context/LanguageContext';

// Reusable discounted-price block: the current price prominent, the
// original price smaller/muted/struck through, and an optional percentage —
// exactly the layout the brief asks for everywhere a price shows. Always
// goes through the existing formatPrice() (bidi-safe ₪ formatting) — never a
// second price-formatting system — and never renders a strikethrough unless
// `hasDiscount` is true, so a plain (non-sale) product looks unchanged.
//
// Sizing is a prop, not baked in, because this is dropped into contexts with
// different type scales (a full-size ProductCard vs. a compact wishlist
// card vs. the larger product-detail price).
const SIZES = {
  sm: { final: 'text-base', original: 'text-xs' },
  md: { final: 'text-xl', original: 'text-sm' },
  lg: { final: 'text-3xl', original: 'text-base' },
};

export default function DiscountPriceDisplay({
  original, final, hasDiscount, discountPct, size = 'md', showPercent = false, className = '',
}) {
  const { formatPrice } = useLanguage();
  const s = SIZES[size] || SIZES.md;

  return (
    <div className={`flex items-baseline gap-2 flex-wrap ${className}`}>
      <span className={`font-heading font-extrabold text-cosmic ${s.final}`}>{formatPrice(final)}</span>
      {hasDiscount && (
        <span className={`text-muted-foreground line-through ${s.original}`}>{formatPrice(original)}</span>
      )}
      {hasDiscount && showPercent && discountPct > 0 && (
        <span className="text-xs font-heading font-bold text-accent">
          <bdi>{`-${Math.round(discountPct)}%`}</bdi>
        </span>
      )}
    </div>
  );
}
