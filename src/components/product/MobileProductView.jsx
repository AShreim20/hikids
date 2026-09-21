import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Heart, Share2, Star, ChevronDown, Check } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import ProductGallery from '@/components/ProductGallery';
import VariantSelector from '@/components/product/VariantSelector';
import SimilarProducts from '@/components/product/SimilarProducts';
import Reviews from '@/components/Reviews';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { productName, productDescription } from '@/lib/bilingual';
import { ageLabelList } from '@/lib/ages';
import { RETURN_WINDOW_DAYS } from '@/lib/returns';

// Collapsible section: closed by default so the first screen stays short.
function Section({ title, children, open: initial = false, keepMounted = false }) {
  const [open, setOpen] = useState(initial);
  return (
    <section className="border-b border-border/60">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between py-4 text-start font-heading font-bold">
        {title}
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {keepMounted ? <div className={open ? 'pb-4' : 'hidden'}>{children}</div> : open && <div className="pb-4 text-sm text-muted-foreground leading-relaxed">{children}</div>}
    </section>
  );
}

// Mobile (<768px) product page. All purchase data/handlers come from
// ProductDetail (same live price/stock/variant logic); this only lays it out.
export default function MobileProductView({
  product, liveProduct, galleryImages, variant, selection, selectValue,
  price, compareOriginal, stock, canBuy, qty, setQty, added, onAdd, onBuyNow,
  features, materialText, reviewStats, setReviewStats, favorited, onToggleFavorite,
  stickyBarRef, stickyBarHeight, categoryLabel,
}) {
  const { t, lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const ages = ageLabelList(product, t);
  const description = (productDescription(product, lang) || '').trim();

  // Quantity can never exceed stock (also re-clamped if the variant changes).
  useEffect(() => { if (stock > 0 && qty > stock) setQty(stock); }, [stock, qty, setQty]);

  const share = async () => {
    const url = `${window.location.origin}/product/${product.id}`;
    try {
      if (navigator.share) await navigator.share({ title: productName(product, lang), url });
      else { await navigator.clipboard.writeText(url); toast({ title: ar ? 'تم نسخ الرابط' : 'Link copied' }); }
    } catch { /* user cancelled */ }
  };

  const icon = "relative grid place-items-center w-10 h-10 rounded-full bg-mist after:absolute after:-inset-2 after:content-['']";

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={productName(product, lang)} />

      <div className="px-4 pt-3">
        <ProductGallery product={product} images={galleryImages} square />

        <div className="mt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {categoryLabel && <p className="text-xs text-muted-foreground">{categoryLabel}</p>}
              <h1 className="mt-1 font-display font-semibold text-2xl leading-tight">{productName(product, lang)}</h1>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={onToggleFavorite} className={`${icon} ${favorited ? '!bg-accent text-white' : ''}`} aria-label={t('pd.saveWishlist')}>
                <Heart className={`w-5 h-5 ${favorited ? 'fill-current' : ''}`} />
              </button>
              <button type="button" onClick={share} className={icon} aria-label={ar ? 'مشاركة' : 'Share'}>
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {reviewStats.count > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Star className="w-4 h-4 fill-accent text-accent" /> {reviewStats.average.toFixed(1)} · {reviewStats.count}
            </div>
          )}

          {ages.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {ages.map((label) => (
                <span key={label} className="px-3 py-1 rounded-full bg-cosmic/10 text-cosmic text-xs font-heading font-bold">{label}</span>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-baseline gap-3 flex-wrap">
            <p className="font-heading font-extrabold text-3xl">{formatPrice(price)}</p>
            {compareOriginal != null && <span className="text-base text-muted-foreground/70 line-through">{formatPrice(compareOriginal)}</span>}
            {compareOriginal != null && compareOriginal > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent text-sm font-heading font-bold">
                {t('pd.save').replace('{p}', Math.round((1 - price / compareOriginal) * 100))}
              </span>
            )}
          </div>

          <p className={`mt-2 text-sm font-heading font-bold ${stock > 0 ? (stock <= 5 ? 'text-accent' : 'text-emerald-500') : 'text-destructive'}`}>
            {stock > 0
              ? (stock <= 5 ? `${t('pd.lowStockPrefix')} ${stock} ${t('pd.lowStockSuffix')}` : `${stock} ${t('pd.inStock')}`)
              : t('pd.outOfStock')}
          </p>

          <div className="mt-4"><VariantSelector product={liveProduct} selection={selection} onSelect={selectValue} /></div>
          {variant?.sku && <p className="mt-2 text-xs text-muted-foreground">{t('variants.sku')}: {variant.sku}</p>}
        </div>

        <div className="mt-4 border-t border-border/60">
          {description && <Section title={t('mpd.description')}>{description}</Section>}
          {features.length > 0 && (
            <Section title={t('pd.features')}>
              <ul className="space-y-2">
                {features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2"><Check className="w-4 h-4 text-cosmic mt-0.5 shrink-0" /><span>{f}</span></li>
                ))}
              </ul>
            </Section>
          )}
          {materialText && <Section title={t('pd.material')}>{materialText}</Section>}
          <Section title={t('mpd.deliveryReturns')}>
            <ul className="space-y-2">
              <li>{t('trust.delivery')}</li>
              <li>{ar
                ? `يمكن طلب الإرجاع أو الاستبدال خلال ${RETURN_WINDOW_DAYS} أيام من تاريخ التسليم من صفحة طلباتي.`
                : `Returns & exchanges can be requested within ${RETURN_WINDOW_DAYS} days of delivery from My Orders.`}</li>
            </ul>
            <Link to="/contact" className="mt-3 inline-block text-cosmic font-heading font-bold">{t('contact.title')}</Link>
          </Section>
          {/* Always mounted (even collapsed) so the rating summary/count above stays live. */}
          <Section title={t('reviews.title')} keepMounted>
            <Reviews productId={product.id} onStats={setReviewStats} />
          </Section>
        </div>
      </div>

      <SimilarProducts product={product} horizontal />

      <div style={{ paddingBottom: stickyBarHeight ? stickyBarHeight + 8 : 0 }}>
        <Footer />
      </div>

      {/* The one purchase bar on mobile (the global bottom nav is hidden on product pages). */}
      <div ref={stickyBarRef} className="fixed bottom-0 inset-x-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur-xl safe-bottom">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div className="flex items-center rounded-full bg-mist">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} className="relative grid place-items-center w-10 h-11 rounded-full disabled:opacity-40 after:absolute after:-inset-2 after:content-['']" aria-label={ar ? 'تقليل الكمية' : 'Decrease quantity'}>
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-7 text-center font-heading font-bold">{qty}</span>
            <button type="button" onClick={() => setQty((q) => Math.min(Math.max(1, stock), q + 1))} disabled={!canBuy || qty >= stock} className="relative grid place-items-center w-10 h-11 rounded-full disabled:opacity-40 after:absolute after:-inset-2 after:content-['']" aria-label={ar ? 'زيادة الكمية' : 'Increase quantity'}>
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <button type="button" onClick={onAdd} disabled={!canBuy} className="squish flex-1 h-12 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            <ShoppingBag className="w-5 h-5" /> {!canBuy ? t('pd.outOfStock') : added ? t('common.added') : t('common.addToCart')}
          </button>
          <button type="button" onClick={onBuyNow} disabled={!canBuy} className="shrink-0 px-2 font-heading font-bold text-sm text-cosmic underline-offset-2 disabled:opacity-40">
            {t('common.buyNow')}
          </button>
        </div>
      </div>
    </div>
  );
}
