import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, ShoppingBag, Package } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import { priceInfo } from '@/lib/pricing';
import { variantLabel } from '@/lib/variants';

function decodeCart(token) {
  try {
    return JSON.parse(decodeURIComponent(atob(token)));
  } catch {
    return null;
  }
}

// Landing page for a shared cart link. Rebuilds the cart from the encoded token
// using ONLY product/bundle ids, variant keys, and quantities — no private
// customer data is present in the link. Prices/availability are re-fetched live
// from the catalog so a shared price can't be trusted.
export default function SharedCart() {
  const navigate = useNavigate();
  const { addItem, addBundle, items: myCart } = useCart();
  const { t, lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const { discountPctFor } = useCategories();
  const [token, setToken] = useState(null);
  const [products, setProducts] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get('c');
    const decoded = c ? decodeCart(c) : null;
    if (!decoded) { setLoading(false); return; }
    setToken(decoded);
  }, []);

  const productIds = useMemo(() => (token || []).filter((x) => !x.b).map((x) => x.id), [token]);
  const bundleIds = useMemo(() => (token || []).filter((x) => x.b).map((x) => x.id), [token]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [allProducts, allBundles] = await Promise.all([
          productIds.length ? base44.entities.Product.list('-updated_date', 200) : Promise.resolve([]),
          bundleIds.length ? base44.entities.Bundle.list('-updated_date', 200) : Promise.resolve([]),
        ]);
        if (!alive) return;
        setProducts((allProducts || []).filter((p) => productIds.includes(p.id)));
        setBundles((allBundles || []).filter((b) => bundleIds.includes(b.id)));
      } catch {
        /* ignore */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token, productIds.join(','), bundleIds.join(',')]);

  const lineFor = (entry) => {
    if (entry.b) {
      const b = bundles.find((x) => x.id === entry.id);
      return b ? { kind: 'bundle', entity: b, qty: entry.q || 1 } : null;
    }
    const p = products.find((x) => x.id === entry.id);
    if (!p) return null;
    const variant = entry.v ? (p.variants || []).find((v) => v.key === entry.v) || null : null;
    return { kind: 'product', entity: p, variant, qty: entry.q || 1 };
  };
  const lines = (token || []).map(lineFor).filter(Boolean);

  const addAll = () => {
    lines.forEach((l) => {
      if (l.kind === 'bundle') {
        addBundle(l.entity, l.qty, l.entity.bundle_price, l.entity.items);
      } else {
        const pi = priceInfo(l.entity, discountPctFor(l.entity.category));
        const price = l.variant ? (l.variant.price ?? l.entity.price) : (pi ? pi.final : l.entity.price);
        addItem(l.entity, l.qty, l.variant, price);
      }
    });
    setAdded(true);
    setTimeout(() => navigate('/cart'), 900);
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={ar ? 'سلة مشاركة' : 'Shared cart'} />
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 ltr:rotate-180 rtl:rotate-0" /> {t('common.back')}
        </Link>
        <h1 className="mt-6 font-heading font-extrabold text-3xl md:text-4xl">{ar ? 'سلة مشاركة' : 'Shared cart'}</h1>
        <p className="mt-2 text-muted-foreground">
          {ar ? 'أضف هذه المنتجات إلى سلتك' : 'Add these items to your own cart'}
        </p>

        {loading ? (
          <div className="mt-12 grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : !token || lines.length === 0 ? (
          <div className="mt-12 rounded-3xl bg-mist p-12 text-center">
            <p className="font-heading font-bold text-xl">{ar ? 'رابط غير صالح أو فارغ' : 'Invalid or empty cart link'}</p>
            <Link to="/shop" className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">{ar ? 'تصفّح المتجر' : 'Browse the shop'}</Link>
          </div>
        ) : (
          <>
            <div className="mt-8 space-y-3">
              {lines.map((l, idx) => {
                const e = l.entity;
                const out = l.kind === 'product' && Number(e.stock || 0) <= 0;
                const pi = l.kind === 'product' ? priceInfo(e, discountPctFor(e.category)) : null;
                const price = l.kind === 'bundle' ? e.bundle_price : (l.variant ? (l.variant.price ?? e.price) : (pi ? pi.final : e.price));
                return (
                  <div key={idx} className="flex gap-4 p-4 rounded-3xl bg-card border border-border/60">
                    <Link to={l.kind === 'bundle' ? `/bundles/${e.id}` : `/product/${e.id}`} className="shrink-0">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-mist">
                        <Image src={e.image_url} alt={e.name} fittingType="fill" className="w-full h-full" />
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0">
                      {l.kind === 'bundle' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cosmic/10 text-cosmic text-[11px] font-heading font-bold mb-1">
                          <Package className="w-3 h-3" /> {ar ? 'حزمة' : 'Bundle'}
                        </span>
                      )}
                      <Link to={l.kind === 'bundle' ? `/bundles/${e.id}` : `/product/${e.id}`} className="font-heading font-bold hover:text-cosmic line-clamp-1">
                        {e.name}
                      </Link>
                      {l.variant && <p className="text-sm font-heading font-bold text-cosmic mt-0.5">{variantLabel(l.variant.attributes)}</p>}
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {formatPrice(price)} · {ar ? 'الكمية' : 'qty'} {l.qty}
                        {out && <span className="text-destructive"> · {ar ? 'نفد' : 'out of stock'}</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={addAll}
              disabled={added}
              className="squish mt-8 w-full h-14 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 hover:bg-primary transition-colors disabled:opacity-60"
            >
              {added ? <Check className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
              {added ? (ar ? 'تمت الإضافة' : 'Added') : ar ? 'أضف الكل إلى سلتي' : 'Add all to my cart'}
            </button>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}