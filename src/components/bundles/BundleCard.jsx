import React from 'react';
import { Link } from 'react-router-dom';
import { Package, ShoppingBag } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/components/ui/use-toast';
import {
  bundleOriginalPrice, bundleSellingPrice, bundleDiscountPercent,
  bundleAvailability,
} from '@/lib/bundles';

// Storefront card for a product bundle. Renders as one purchasable package —
// the original combined price is struck through and the bundle price shown
// alongside the discount badge and live availability.
export default function BundleCard({ bundle, products }) {
  const { t, formatPrice } = useLanguage();
  const { addBundle } = useCart();
  const { toast } = useToast();
  const ar = t('common.addToCart') !== 'Add to cart';

  const original = bundleOriginalPrice(bundle);
  const sell = bundleSellingPrice(bundle);
  const pct = bundleDiscountPercent(bundle);
  const avail = bundleAvailability(bundle, products);
  const count = (bundle.items || []).length;
  const out = avail <= 0;

  const add = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (out) return;
    addBundle(bundle, 1, sell, (bundle.items || []).map((it) => ({
      product_id: it.product_id,
      name: it.name,
      sku: it.sku || null,
      quantity: it.quantity,
      unit_price: it.unit_price,
    })));
    toast({ title: ar ? 'أُضيفت الحزمة إلى السلة' : 'Bundle added to cart' });
  };

  return (
    <Link to={`/bundles/${bundle.id}`} className="group block float-in">
      <div className="relative overflow-hidden rounded-[2rem] bg-mist aspect-[4/5] shadow-[0_18px_50px_-20px_rgba(26,26,30,0.25)] ring-1 ring-black/0 transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_30px_70px_-24px_rgba(26,26,30,0.4)] group-hover:ring-black/5">
        <Image
          src={bundle.image_url}
          alt={bundle.name}
          fittingType="fill"
          className="w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.07]"
        />
        <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cosmic text-white text-[11px] font-heading font-bold shadow-lg">
          <Package className="w-3.5 h-3.5" /> {ar ? 'حزمة' : 'Bundle'}
        </span>
        {pct > 0 && (
          <span className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-accent text-white text-[11px] font-heading font-bold shadow-lg">
            −{pct}%
          </span>
        )}
        {out && (
          <span className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-destructive text-white text-[11px] font-heading font-bold shadow-lg">
            {t('pd.outOfStock')}
          </span>
        )}
        <button
          onClick={add}
          disabled={out}
          className={`absolute bottom-4 right-4 squish grid place-items-center gap-2 rounded-full shadow-lg transition-all duration-300 ${
            out
              ? 'bg-card/60 text-muted-foreground w-12 h-12 cursor-not-allowed'
              : 'bg-card text-foreground w-12 h-12 hover:bg-cosmic hover:text-white'
          }`}
          aria-label={t('common.addToCart')}
        >
          <ShoppingBag className="w-5 h-5" />
        </button>
      </div>

      <div className="px-1 pt-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
          {ar ? `${count} منتجات` : `${count} products`}
        </p>
        <h3 className="mt-1 font-display font-semibold text-xl leading-tight tracking-tight">
          {bundle.name}
        </h3>
        <p className="mt-2 font-heading font-extrabold text-xl">
          {formatPrice(sell)}
          {original > sell && (
            <span className="ml-2 text-sm text-muted-foreground line-through">{formatPrice(original)}</span>
          )}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {out ? t('pd.outOfStock') : `${ar ? 'متوفر' : 'Available'}: ${avail}`}
        </p>
      </div>
    </Link>
  );
}