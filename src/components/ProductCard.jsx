import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Heart, Star } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import { useCart } from '@/context/CartContext';
import { useCartFly } from '@/context/CartFlyContext';
import { useWishlist } from '@/context/WishlistContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import { priceInfo } from '@/lib/pricing';
import { productName } from '@/lib/bilingual';
import { ageLabels } from '@/lib/ages';
import { hasVariants, getVariants, isSellable } from '@/lib/variants';
import SaleBadge from '@/components/SaleBadge';
import DiscountPriceDisplay from '@/components/DiscountPriceDisplay';

const CAT_LABEL = {
  'Build & Create': 'cat.build',
  'Plush & Soft': 'cat.plush',
  'Vehicles & Motion': 'cat.vehicles',
  'Early Years': 'cat.early',
  'Pretend Play': 'cat.pretend',
  'Arts & Crafts': 'cat.arts',
};

// avgRating/reviewCount are optional — only passed by callers that already
// have review data on hand (e.g. SimilarProducts, which fetches it once for
// the whole grid). Omitted entirely, the card renders exactly as before
// (existing callers like Shop.jsx are unaffected). When passed, reviewCount
// — never a raw averageRating — decides whether a real rating or a "New"
// label shows, so a product with zero published reviews is never displayed
// as a fake 0-star item (see lib/reviews.js for the approved-review rule
// this count is expected to already reflect).
export default function ProductCard({ product, large = false, avgRating = 0, reviewCount, compact = false }) {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { flyToCart } = useCartFly();
  const { toggle, isSaved } = useWishlist();
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const { discountPctFor, byName, categoryName } = useCategories();
  const [added, setAdded] = useState(false);
  const { original, final, hasDiscount, discountPct } = priceInfo(product, discountPctFor(product.category));
  const saved = isSaved(product.id);
  const variantMode = hasVariants(product);
  const outOfStock = variantMode
    ? !getVariants(product).some(isSellable)
    : Number(product.stock) === 0;

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) return;
    // Variant products need an explicit combination — open the product page.
    if (variantMode) {
      navigate(`/product/${product.id}`);
      return;
    }
    flyToCart(e.currentTarget);
    const res = addItem(product, 1);
    if (res.capped) {
      toast({
        title: res.available != null
          ? (ar ? `متوفر ${res.available} فقط` : `Only ${res.available} available`)
          : (ar ? 'لا يمكن إضافة المزيد' : 'No more available'),
        variant: 'destructive',
      });
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  const handleWish = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(product);
  };

  return (
    <Link to={`/product/${product.id}`} className="group block float-in">
      <div
        className={`relative overflow-hidden ${compact ? 'rounded-2xl aspect-square' : `rounded-[2rem] ${large ? 'aspect-[4/5] md:aspect-[4/4.5]' : 'aspect-[4/5]'}`} bg-mist shadow-[0_18px_50px_-20px_rgba(26,26,30,0.25)] ring-1 ring-black/0 transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_30px_70px_-24px_rgba(26,26,30,0.4)] group-hover:ring-black/5`}
      >
        <Image
          src={product.image_url}
          alt={productName(product, lang)}
          fittingType="fill"
          className={`w-full h-full ${compact ? 'object-contain' : 'object-cover'} transition-transform duration-[900ms] ease-out group-hover:scale-[1.07]`}
        />
        {/* Top-right stack: the sale badge and the out-of-stock badge share
            this corner (opposite the wishlist heart) — stacked vertically,
            never overlapping, so a discounted-but-sold-out product shows
            both without collision. */}
        {(hasDiscount || outOfStock) && (
          <div className={`absolute z-10 flex flex-col items-end gap-2 ${compact ? 'top-2 right-2' : 'top-4 right-4'}`}>
            {hasDiscount && <SaleBadge percentage={discountPct} />}
            {outOfStock && (
              <span className="px-3 py-1.5 rounded-full bg-destructive text-white text-[11px] font-heading font-bold shadow-lg">
                {t('pd.outOfStock')}
              </span>
            )}
          </div>
        )}
        <button
          onClick={handleWish}
          className={`absolute squish grid place-items-center rounded-full backdrop-blur-md transition-all duration-300 ${compact ? "top-2 left-2 w-9 h-9 after:absolute after:-inset-2 after:content-['']" : 'top-4 left-4 w-11 h-11'} ${
            saved ? 'bg-accent text-white' : 'bg-card/85 text-foreground hover:bg-card'
          }`}
          aria-label={t('pd.saveWishlist')}
        >
          <Heart className={`w-5 h-5 ${saved ? 'fill-current' : ''}`} />
        </button>
        <button
          onClick={handleAdd}
          disabled={outOfStock}
          aria-label={t('common.addToCart')}
          className={`absolute squish grid place-items-center gap-2 rounded-full shadow-lg transition-all duration-300 ${compact ? "bottom-2 right-2 after:absolute after:-inset-2 after:content-['']" : 'bottom-4 right-4'} ${
            outOfStock
              ? `bg-card/60 text-muted-foreground cursor-not-allowed ${compact ? 'w-10 h-10' : 'w-12 h-12'}`
              : added
              ? `bg-accent text-white w-auto ${compact ? 'px-3 h-10' : 'px-5'}`
              : `bg-card text-foreground hover:bg-cosmic hover:text-white ${compact ? 'w-10 h-10' : 'w-12 h-12'}`
          }`}
        >
          {added ? (
            <span className="text-xs font-bold whitespace-nowrap px-1">{t('common.added')}</span>
          ) : (
            <ShoppingBag className="w-5 h-5" />
          )}
        </button>
      </div>

      <div className={compact ? 'px-0.5 pt-2' : 'px-1 pt-4'}>
        <p className={`text-xs uppercase tracking-widest text-muted-foreground font-medium ${compact ? 'hidden' : ''}`}>
          {(() => {
            const cat = byName(product.category);
            if (cat) return categoryName(cat, lang);
            return t(CAT_LABEL[product.category] || product.category);
          })()}
        </p>
        <h3 className={`mt-1 font-display font-semibold leading-tight tracking-tight ${compact ? 'text-sm line-clamp-2' : 'text-xl'}`}>
          {productName(product, lang)}
        </h3>
        {typeof reviewCount === 'number' && (
          <div className="mt-1 flex items-center gap-1.5">
            {reviewCount > 0 ? (
              <>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(avgRating) ? 'fill-accent text-accent' : 'text-border'}`} />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">{avgRating.toFixed(1)} ({reviewCount})</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">{t('rec.new')}</span>
            )}
          </div>
        )}
        <p className={`mt-1 text-muted-foreground ${compact ? 'text-xs truncate' : 'text-sm'}`}>{compact ? '' : `${t('pd.ages')} `}{ageLabels(product, t)}</p>
        <DiscountPriceDisplay
          original={original}
          final={final}
          hasDiscount={hasDiscount}
          discountPct={discountPct}
          className="mt-2"
        />
        {outOfStock && (
          <p className="mt-1 text-sm font-heading font-bold text-destructive">{t('pd.outOfStock')}</p>
        )}
      </div>
    </Link>
  );
}