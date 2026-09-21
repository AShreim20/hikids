import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, ShoppingBag, ShieldCheck, Leaf, Star, AlertTriangle, Sparkles, Check, Eye, Lock } from 'lucide-react';
import { db } from '@/api/entities';
import ProductGallery from '@/components/ProductGallery';
import PageHeader from '@/components/PageHeader';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCart } from '@/context/CartContext';
import { useCartFly } from '@/context/CartFlyContext';
import Reviews from '@/components/Reviews';
import ShareProduct from '@/components/product/ShareProduct';
import SimilarProducts from '@/components/product/SimilarProducts';
import { useWishlist } from '@/context/WishlistContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { priceInfo } from '@/lib/pricing';
import { productName, productDescription, productFeatures } from '@/lib/bilingual';
import { ageLabelList } from '@/lib/ages';
import { loadPreviewSnapshot } from '@/lib/sessionDraft';
import VariantSelector from '@/components/product/VariantSelector';
import TrustStrip from '@/components/TrustStrip';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { buildProductSeo } from '@/lib/productSeo';
import { SITE_URL } from '@/lib/siteUrl';
import {
  hasVariants, findVariant, defaultSelection, selectionImages,
  variantPrice, isSellable, getOptions,
} from '@/lib/variants';
import { useProductCommercial } from '@/hooks/useProductCommercial';
import { useReportStickyBarHeight } from '@/hooks/useReportStickyBarHeight';
import { getStickyBarHeight, subscribeStickyBarHeight } from '@/lib/stickyBarStore';
import MobileProductView from '@/components/product/MobileProductView';
import { useIsMobile } from '@/hooks/use-mobile';

// `preview` renders this exact page from an in-memory admin snapshot instead
// of a DB fetch — see ProductEditor.jsx's preview() handler and
// sessionDraft.js's savePreviewSnapshot/loadPreviewSnapshot. It is what lets
// Preview show unsaved form edits (a changed price, a swapped image) using
// the real storefront presentation, without ever writing them to the
// database or exposing them publicly: the snapshot lives only in
// sessionStorage, shared with this tab because it was window.open()'d from
// the editor tab, and is never fetched by anyone else.
export default function ProductDetail({ preview = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { flyToCart } = useCartFly();
  const { toggle, isSaved } = useWishlist();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [selection, setSelection] = useState({});
  const { t, formatPrice, lang } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const { discountPctFor, byName, categoryName } = useCategories();
  const [reviewStats, setReviewStats] = useState({ count: 0, average: 0 });
  const isMobile = useIsMobile();
  // Publishes this page's sticky purchase bar's real rendered height (0 when
  // it isn't shown, e.g. below md:) so the floating assistant/WhatsApp
  // buttons and the assistant panel can clear it exactly instead of using a
  // hard-coded guess — see useFloatingOffset.
  const stickyBarRef = useReportStickyBarHeight();
  // Same store, read back here: the Footer needs exactly this much bottom
  // padding to clear the sticky bar (0 on mobile, where it's hidden) instead
  // of a hardcoded guess that's either too little or leaves a dead gap.
  const stickyBarHeight = useSyncExternalStore(subscribeStickyBarHeight, getStickyBarHeight);
  // price/sale_price/stock/variants only — kept live via Supabase Realtime
  // independent of the one-time descriptive fetch below (see the hook).
  // Disabled in preview mode (null id) so a live DB update can never
  // silently replace the unsaved values the admin is previewing.
  const commercial = useProductCommercial(preview ? null : id, product);

  // Hooks must run unconditionally on every render (before the loading/
  // not-found early returns below), so this guards internally instead of
  // being skipped — reuses the exact same catDiscountPct/priceInfo() the
  // visible price further down is computed from (see buildProductSeo's own
  // comment), never a second price calculation. Never indexed while
  // previewing (unsaved edits, or a draft that may not even be public).
  const liveProductForSeo = commercial ? { ...product, ...commercial } : product;
  const productSeo = liveProductForSeo
    ? buildProductSeo(liveProductForSeo, {
        catDiscountPct: discountPctFor(liveProductForSeo.category),
        siteUrl: SITE_URL,
        lang,
      })
    : null;
  useDocumentMeta({
    title: productSeo?.title,
    description: productSeo?.description,
    canonical: productSeo?.canonical,
    image: productSeo?.image,
    type: 'product',
    noindex: preview || !productSeo,
    jsonLd: preview ? null : productSeo?.jsonLd,
  });

  useEffect(() => {
    if (preview) {
      setLoading(true);
      const snap = loadPreviewSnapshot(id);
      if (snap) {
        setProduct(snap);
        setSelection(defaultSelection(snap));
        setLoading(false);
        return;
      }
      // No snapshot (tab opened directly, or sessionStorage unavailable) —
      // fall back to the real saved row for an existing product; a
      // never-saved 'new' product has nothing to fall back to.
      if (id && id !== 'new') {
        db.Product.get(id)
          .then((p) => { setProduct(p); setSelection(p ? defaultSelection(p) : {}); })
          .catch(() => setProduct(null))
          .finally(() => setLoading(false));
      } else {
        setProduct(null);
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    db.Product.get(id)
      .then((p) => {
        setProduct(p);
        setSelection(p ? defaultSelection(p) : {});
        // Base44's platform analytics.track() had no Supabase equivalent and
        // nothing in the app reads this event back (Insights/Analytics.jsx
        // uses the separate gaInsights/GA4 integration) — dropped rather than
        // ported.
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, preview]);

  // Preview is admin-only — a logged-out customer or another signed-in
  // account must never be able to load a draft's data this way, even though
  // the snapshot itself only exists in the admin's own browser tab.
  if (preview && user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{t('admin.denied')}</h1>
          <p className="mt-3 text-muted-foreground">{t('admin.deniedDesc')}</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="w-8 h-8 border-4 border-mist border-t-cosmic rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    // In preview mode this means "no snapshot and nothing saved yet" (a
    // brand-new, never-saved product) rather than a real 404 — same layout,
    // clearer copy so it doesn't read like a broken link.
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={preview ? t('pd.previewEmptyTitle') : t('pd.notFound')} />
        <div className="max-w-3xl mx-auto px-5 py-32 text-center">
          <h1 className="font-heading font-extrabold text-3xl">{preview ? t('pd.previewEmptyTitle') : t('pd.notFound')}</h1>
          <p className="mt-3 text-muted-foreground">{preview ? t('pd.previewEmptyDesc') : t('pd.notFoundDesc')}</p>
          {!preview && (
            <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">
              <ArrowLeft className="w-4 h-4 ltr:rotate-180 rtl:rotate-0" /> {t('pd.back')}
            </Link>
          )}
        </div>
      </div>
    );
  }

  // Descriptive fields (name, description, images, category, tags, age,
  // material, rating) come from the one-time fetch above and are left as
  // fetched — they are not real-time by design. price/sale_price/stock/
  // variants are overlaid from the live commercial state instead, so this is
  // the one object every computation and every add-to-cart call below reads
  // from — never two divergent copies of the same product's price.
  const liveProduct = commercial ? { ...product, ...commercial } : product;

  const variantMode = hasVariants(liveProduct);
  const variant = variantMode ? findVariant(liveProduct, selection) : null;
  const basePrice = variantMode ? variantPrice(liveProduct, variant) : liveProduct.price;
  const pi = variantMode ? null : priceInfo(liveProduct, discountPctFor(liveProduct.category));
  const price = variantMode ? basePrice : (pi ? pi.final : basePrice);
  const compareOriginal = variantMode
    ? (variant?.compare_price != null && Number(variant.compare_price) > price ? Number(variant.compare_price) : null)
    : (pi && pi.hasDiscount ? pi.original : null);
  const stock = variantMode ? Number(variant?.stock || 0) : Number(liveProduct.stock || 0);
  // Never purchasable from a preview — it may be showing unsaved edits, an
  // unpublished draft, or (for a never-saved product) an id that doesn't
  // exist in the database at all.
  const canBuy = !preview && (variantMode ? isSellable(variant) : stock > 0);
  const galleryImages = variantMode ? selectionImages(liveProduct, selection) : null;
  // Descriptive, same as material — not part of the live commercial overlay.
  // Already cleaned + language-picked (Arabic falls back to English and vice
  // versa only when the active language's list is empty); an empty result
  // means the section renders nothing at all, never an empty heading/card.
  const features = productFeatures(product, lang);
  const materialText = (product.material || '').trim();

  // Keeps the selection on a real combination: if the picked value breaks the
  // current one, snap the other options to the first sellable match.
  const selectValue = (name, value) => {
    const next = { ...selection, [name]: value };
    if (isSellable(findVariant(liveProduct, next))) {
      setSelection(next);
      return;
    }
    const match = (liveProduct.variants || []).find(
      (v) => isSellable(v) && v.attributes?.[name] === value
    );
    setSelection(match ? { ...match.attributes } : next);
  };

  const addToCart = (e) => {
    if (!canBuy) return;
    flyToCart(e?.currentTarget);
    const res = addItem(liveProduct, qty, variant, price);
    if (res.capped) {
      toast({
        title: res.available != null
          ? (ar ? `متوفر ${res.available} فقط` : `Only ${res.available} available`)
          : (ar ? 'لا يمكن إضافة المزيد' : 'No more available'),
        variant: 'destructive',
      });
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const buyNow = () => {
    const res = addItem(liveProduct, qty, variant, price);
    if (res.capped) {
      toast({
        title: res.available != null
          ? (ar ? `متوفر ${res.available} فقط` : `Only ${res.available} available`)
          : (ar ? 'لا يمكن إضافة المزيد' : 'No more available'),
        variant: 'destructive',
      });
    }
    navigate('/checkout');
  };

  // Phone (<768px): simplified layout. Tablet/desktop render the original page below.
  if (isMobile && !preview) {
    const cat = byName(product.category);
    return (
      <MobileProductView
        product={product} liveProduct={liveProduct} galleryImages={galleryImages}
        variant={variant} selection={selection} selectValue={selectValue}
        price={price} compareOriginal={compareOriginal} stock={stock} canBuy={canBuy}
        qty={qty} setQty={setQty} added={added} onAdd={addToCart} onBuyNow={buyNow}
        features={features} materialText={materialText}
        reviewStats={reviewStats} setReviewStats={setReviewStats}
        favorited={isSaved(product.id)} onToggleFavorite={() => toggle(liveProduct)}
        stickyBarRef={stickyBarRef} stickyBarHeight={stickyBarHeight}
        categoryLabel={cat ? categoryName(cat, lang) : product.category}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {preview && (
        <div className="sticky top-0 z-50 bg-cosmic text-white text-sm font-heading font-bold text-center py-2 px-4">
          <span className="inline-flex items-center gap-1.5">
            <Eye className="w-4 h-4" /> {t('pd.previewBanner')}
          </span>
        </div>
      )}
      <PageHeader title={productName(product, lang)} />

      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 ltr:rotate-180 rtl:rotate-0" /> {t('common.back')}
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 grid lg:grid-cols-2 gap-10 lg:gap-16">
        <ProductGallery product={product} images={galleryImages} />

        <div className="float-in">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            {(() => {
              const cat = byName(product.category);
              return cat ? categoryName(cat, lang) : product.category;
            })()}
          </p>
          <h1 className="mt-2 font-display font-semibold text-4xl md:text-5xl leading-tight">
            {productName(product, lang)}
          </h1>

          {/* Real rating only — reviewStats.count comes from Reviews' own
              published-review count (see lib/reviews.js), never the legacy
              products.rating field, so a product with zero real reviews
              shows "New" instead of a fake 0-star row. */}
          <div className="mt-4 flex items-center gap-1.5">
            {reviewStats.count > 0 ? (
              <>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i < Math.round(reviewStats.average) ? 'fill-accent text-accent' : 'text-border'}`}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  {reviewStats.average.toFixed(1)} · {reviewStats.count}{' '}
                  {reviewStats.count === 1 ? t('reviews.reviewSingular') : t('reviews.reviewPlural')}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">{t('rec.new')}</span>
            )}
          </div>

          {/* Age ranges as compact chips — a product can belong to several,
              which used to run together as one long sentence. Presentation
              only; ageLabelList reuses the exact same id resolution as the
              existing ageLabels (age filtering/data untouched). */}
          {ageLabelList(product, t).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {ageLabelList(product, t).map((label) => (
                <span key={label} className="px-3 py-1 rounded-full bg-cosmic/10 text-cosmic text-xs font-heading font-bold">
                  {label}
                </span>
              ))}
            </div>
          )}

          {Array.isArray(product.tags) && product.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <span key={tag} className="px-3 py-1.5 rounded-full bg-mist text-foreground/70 text-xs font-medium">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            {productDescription(product, lang)}
          </p>

          {/* Price pair — current + old belong together visually (baseline-
              aligned, tight gap), current prominent but no longer oversized,
              old price smaller/muted/struck-through. formatPrice() already
              wraps the number+₪ in bidi isolates (U+2068/U+2069) so RTL page
              direction can never reorder the currency symbol — kept as the
              only place either price is formatted, so that guarantee holds
              here too. */}
          <div className="mt-8 flex items-baseline gap-3 flex-wrap">
            <p className="font-heading font-extrabold text-3xl">{formatPrice(price)}</p>
            {compareOriginal != null && (
              <span className="text-base text-muted-foreground/70 line-through">{formatPrice(compareOriginal)}</span>
            )}
            {/* "Save X%" — derived from the same price/compareOriginal this
                page already resolved (covers both the variant compare_price
                path and the priceInfo()/category-discount path), never a
                second discount calculation. */}
            {compareOriginal != null && compareOriginal > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-accent/10 text-accent text-sm font-heading font-bold">
                {t('pd.save').replace('{p}', Math.round((1 - price / compareOriginal) * 100))}
              </span>
            )}
          </div>

          {/* Mobile buy actions — placed right under the price so they're
              reachable without scrolling past reviews / similar products. */}
          <div className="md:hidden mt-6 mb-6 flex gap-3">
            <button
              onClick={addToCart}
              disabled={!canBuy}
              className="squish flex-1 whitespace-nowrap h-14 px-5 rounded-full bg-mist text-foreground font-heading font-bold inline-flex items-center justify-center gap-2 hover:bg-accent hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-mist disabled:hover:text-foreground"
            >
              <ShoppingBag className="w-5 h-5" /> {!canBuy ? t('pd.outOfStock') : added ? t('common.added') : t('common.addToCart')}
            </button>
            <button
              disabled={!canBuy}
              onClick={() => {
                const res = addItem(liveProduct, qty, variant, price);
                if (res.capped) {
                  toast({
                    title: res.available != null
                      ? (ar ? `متوفر ${res.available} فقط` : `Only ${res.available} available`)
                      : (ar ? 'لا يمكن إضافة المزيد' : 'No more available'),
                    variant: 'destructive',
                  });
                }
                navigate('/checkout');
              }}
              className="squish flex-1 h-14 px-5 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 hover:bg-primary transition-colors disabled:opacity-50"
            >
              {t('common.buyNow')}
            </button>
          </div>

          {/* Purchase-info hierarchy: price (above) → product options → the
              lighter-weight secondary actions last. Product selection matters
              more than sharing, so it comes first. */}
          <VariantSelector product={liveProduct} selection={selection} onSelect={selectValue} />

          <div className="mt-6">
            <ShareProduct
              product={liveProduct}
              favorited={isSaved(product.id)}
              onToggleFavorite={() => toggle(liveProduct)}
            />
          </div>

          {variant?.sku && (
            <p className="mt-3 text-xs text-muted-foreground">{t('variants.sku')}: {variant.sku}</p>
          )}

          {/* Materiality bar — hidden entirely when there's no value, rather
              than showing an empty title/card (was previously unconditional). */}
          {materialText && (
            <div className="mt-8 rounded-3xl bg-mist p-6">
              <div className="flex items-center gap-2 text-sm font-heading font-bold">
                <Leaf className="w-4 h-4 text-cosmic" /> {t('pd.material')}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{materialText}</p>
            </div>
          )}

          {/* Features — product highlights, separate from Description.
              Hidden completely when empty (no heading, no card, no spacing). */}
          {features.length > 0 && (
            <div className="mt-8 rounded-3xl bg-mist p-6">
              <div className="flex items-center gap-2 text-sm font-heading font-bold">
                <Sparkles className="w-4 h-4 text-cosmic" /> {t('pd.features')}
              </div>
              <ul className="mt-3 space-y-2">
                {features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-cosmic mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center rounded-full bg-mist">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="grid place-items-center w-12 h-12 rounded-full hover:bg-card"
                aria-label="Decrease"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center font-heading font-bold">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="grid place-items-center w-12 h-12 rounded-full hover:bg-card"
                aria-label="Increase"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {stock > 0 ? (
              stock <= 5 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/15 text-accent text-sm font-heading font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  {t('pd.lowStockPrefix')} {stock} {t('pd.lowStockSuffix')}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">{stock} {t('pd.inStock')}</span>
              )
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-sm font-heading font-bold">
                <AlertTriangle className="w-4 h-4" />
                {t('pd.outOfStock')}
              </span>
            )}
          </div>

          {/* Compact reassurance strip — placed after the buy controls
              (never before) so it can't delay Add to Cart/Buy Now on
              mobile, but still sits close enough to read as part of the
              purchase decision. */}
          <TrustStrip className="mt-6" />
        </div>
      </div>

      {/* A never-saved product has no real id yet — Reviews/SimilarProducts
          would just query with an undefined id, so skip both until it has
          one (a real draft or a published product previews these for real,
          exactly as a customer would see them). */}
      {product.id && <Reviews productId={product.id} onStats={setReviewStats} />}

      {product.id && <SimilarProducts product={product} />}

      {/* Sticky add-to-cart bar — desktop only (mobile uses the inline buttons) */}
      <div ref={stickyBarRef} className="hidden md:block sticky bottom-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-xl safe-bottom">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div className="hidden sm:block">
            <p className="font-heading font-bold">{productName(product, lang)}</p>
            <p className="text-sm text-muted-foreground">
              {formatPrice(price)} · {qty}
              {variant ? ` · ${Object.values(variant.attributes || {}).join(' / ')}` : ''}
            </p>
          </div>
          <div className="flex flex-1 sm:flex-initial gap-3">
            <button
              onClick={addToCart}
              disabled={!canBuy}
              className="squish flex-1 sm:w-auto whitespace-nowrap h-14 px-6 rounded-full bg-mist text-foreground font-heading font-bold inline-flex items-center justify-center gap-2 hover:bg-accent hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-mist disabled:hover:text-foreground"
            >
              <ShoppingBag className="w-5 h-5" /> {!canBuy ? t('pd.outOfStock') : added ? t('common.added') : t('common.addToCart')}
            </button>
            <button
              disabled={!canBuy}
              onClick={() => {
                const res = addItem(liveProduct, qty, variant, price);
                if (res.capped) {
                  toast({
                    title: res.available != null
                      ? (ar ? `متوفر ${res.available} فقط` : `Only ${res.available} available`)
                      : (ar ? 'لا يمكن إضافة المزيد' : 'No more available'),
                    variant: 'destructive',
                  });
                }
                navigate('/checkout');
              }}
              className="squish flex-1 sm:w-auto h-14 px-6 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 hover:bg-primary transition-colors disabled:opacity-50"
            >
              {t('common.buyNow')}
            </button>
          </div>
        </div>
      </div>

      {/* Reserves exactly enough room for the sticky bar to release before
          the Footer's true bottom edge — the bar's real measured height
          (0 when it's hidden, e.g. on mobile), never a fixed guess that
          either leaves a dead gap or isn't quite enough. */}
      <div style={{ paddingBottom: stickyBarHeight ? stickyBarHeight + 8 : 0 }}>
        <Footer />
      </div>
    </div>
  );
}