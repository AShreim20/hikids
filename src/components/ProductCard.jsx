import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Heart } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { useCart } from '@/context/CartContext';
import { useCartFly } from '@/context/CartFlyContext';
import { useWishlist } from '@/context/WishlistContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import { priceInfo } from '@/lib/pricing';
import { hasVariants, getVariants, isSellable } from '@/lib/variants';

const CAT_LABEL = {
  'Build & Create': 'cat.build',
  'Plush & Soft': 'cat.plush',
  'Vehicles & Motion': 'cat.vehicles',
  'Early Years': 'cat.early',
  'Pretend Play': 'cat.pretend',
  'Arts & Crafts': 'cat.arts',
};

export default function ProductCard({ product, large = false }) {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { flyToCart } = useCartFly();
  const { toggle, isSaved } = useWishlist();
  const { t, formatPrice } = useLanguage();
  const { discountPctFor } = useCategories();
  const [added, setAdded] = useState(false);
  const { original, final, hasDiscount } = priceInfo(product, discountPctFor(product.category));
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
    addItem(product, 1);
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
        className={`relative overflow-hidden rounded-[2rem] bg-mist ${
          large ? 'aspect-[4/5] md:aspect-[4/4.5]' : 'aspect-[4/5]'
        } shadow-[0_18px_50px_-20px_rgba(26,26,30,0.25)] ring-1 ring-black/0 transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_30px_70px_-24px_rgba(26,26,30,0.4)] group-hover:ring-black/5`}
      >
        <Image
          src={product.image_url}
          alt={product.name}
          fittingType="fill"
          className="w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.07]"
        />
        {outOfStock && (
          <span className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-destructive text-white text-[11px] font-heading font-bold shadow-lg">
            {t('pd.outOfStock')}
          </span>
        )}
        <button
          onClick={handleWish}
          className={`absolute top-4 left-4 squish grid place-items-center w-11 h-11 rounded-full backdrop-blur-md transition-all duration-300 ${
            saved ? 'bg-accent text-white' : 'bg-card/85 text-foreground hover:bg-card'
          }`}
          aria-label={t('pd.saveWishlist')}
        >
          <Heart className={`w-5 h-5 ${saved ? 'fill-current' : ''}`} />
        </button>
        <button
          onClick={handleAdd}
          disabled={outOfStock}
          className={`absolute bottom-4 right-4 squish grid place-items-center gap-2 rounded-full shadow-lg transition-all duration-300 ${
            outOfStock
              ? 'bg-card/60 text-muted-foreground w-12 h-12 cursor-not-allowed'
              : added
              ? 'bg-accent text-white w-auto px-5'
              : 'bg-card text-foreground w-12 h-12 hover:bg-cosmic hover:text-white'
          }`}
        >
          {added ? (
            <span className="text-xs font-bold whitespace-nowrap px-1">{t('common.added')}</span>
          ) : (
            <ShoppingBag className="w-5 h-5" />
          )}
        </button>
      </div>

      <div className="px-1 pt-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
          {t(CAT_LABEL[product.category] || product.category)}
        </p>
        <h3 className="mt-1 font-display font-semibold text-xl leading-tight tracking-tight">
          {product.name}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('pd.ages')} {product.age_range}</p>
        <p className="mt-2 font-heading font-extrabold text-xl">
          {formatPrice(final)}
          {hasDiscount && <span className="ml-2 text-sm text-muted-foreground line-through">{formatPrice(original)}</span>}
        </p>
        {outOfStock && (
          <p className="mt-1 text-sm font-heading font-bold text-destructive">{t('pd.outOfStock')}</p>
        )}
      </div>
    </Link>
  );
}