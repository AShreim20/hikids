import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, ShoppingBag, Package, AlertTriangle, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import {
  bundleOriginalPrice, bundleSellingPrice, bundleDiscountPercent,
  bundleAvailability, bundleSavings,
} from '@/lib/bundles';

export default function BundleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, addBundle } = useCart();
  const { t, formatPrice } = useLanguage();
  const { toast } = useToast();
  const [bundle, setBundle] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const ar = t('common.addToCart') !== 'Add to cart';

  useEffect(() => {
    setLoading(true);
    Promise.all([
      base44.entities.Bundle.get(id),
      base44.entities.Product.list('-updated_date', 500),
    ])
      .then(([b, p]) => { setBundle(b); setProducts(p || []); })
      .catch(() => setBundle(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="w-8 h-8 border-4 border-mist border-t-cosmic rounded-full animate-spin" />
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={t('pd.notFound')} />
        <div className="max-w-3xl mx-auto px-5 py-32 text-center">
          <h1 className="font-heading font-extrabold text-3xl">{t('pd.notFound')}</h1>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">
            <ArrowLeft className="w-4 h-4 ltr:rotate-180 rtl:rotate-0" /> {t('pd.back')}
          </Link>
        </div>
      </div>
    );
  }

  const original = bundleOriginalPrice(bundle);
  const sell = bundleSellingPrice(bundle);
  const pct = bundleDiscountPercent(bundle);
  const savings = bundleSavings(bundle);
  const avail = bundleAvailability(bundle, products);
  const out = avail <= 0;

  const productMap = {};
  for (const p of products) productMap[p.id] = p;

  const addToCart = () => {
    if (out) return;
    addBundle(bundle, qty, sell, (bundle.items || []).map((it) => ({
      product_id: it.product_id,
      name: it.name,
      sku: it.sku || null,
      quantity: it.quantity,
      unit_price: it.unit_price,
    })));
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
    toast({ title: ar ? 'أُضيفت الحزمة إلى السلة' : 'Bundle added to cart' });
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={bundle.name} />

      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-8">
        <Link to="/shop" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 ltr:rotate-180 rtl:rotate-0" /> {t('common.back')}
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 grid lg:grid-cols-2 gap-10 lg:gap-16">
        <div className="float-in">
          <div className="relative overflow-hidden rounded-[2rem] bg-mist aspect-[4/5] shadow-[0_18px_50px_-20px_rgba(26,26,30,0.25)]">
            <Image src={bundle.image_url} alt={bundle.name} fittingType="fill" className="w-full h-full object-cover" />
            <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cosmic text-white text-[11px] font-heading font-bold shadow-lg">
              <Package className="w-3.5 h-3.5" /> {ar ? 'حزمة' : 'Bundle'}
            </span>
          </div>
        </div>

        <div className="float-in">
          <h1 className="font-display font-semibold text-4xl md:text-5xl leading-tight">{bundle.name}</h1>
          {bundle.description && (
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">{bundle.description}</p>
          )}

          <div className="mt-8 flex items-center gap-4">
            <p className="font-heading font-extrabold text-4xl">{formatPrice(sell)}</p>
            {original > sell && (
              <span className="text-lg text-muted-foreground line-through">{formatPrice(original)}</span>
            )}
            {pct > 0 && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-accent/15 text-accent text-sm font-heading font-bold">
                −{pct}%
              </span>
            )}
          </div>
          {savings > 0 && (
            <p className="mt-2 text-sm text-cosmic font-heading font-bold">
              {ar ? `وفّر ${formatPrice(savings)}` : `Save ${formatPrice(savings)}`}
            </p>
          )}

          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center rounded-full bg-mist">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid place-items-center w-12 h-12 rounded-full hover:bg-card" aria-label="Decrease">
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center font-heading font-bold">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(avail, q + 1))} className="grid place-items-center w-12 h-12 rounded-full hover:bg-card" aria-label="Increase">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {out ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-sm font-heading font-bold">
                <AlertTriangle className="w-4 h-4" /> {t('pd.outOfStock')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-sm font-heading font-bold">
                <Check className="w-4 h-4" /> {ar ? `متوفر: ${avail}` : `Available: ${avail}`}
              </span>
            )}
          </div>

          <div className="mt-10">
            <h2 className="font-heading font-extrabold text-2xl">{ar ? 'محتويات الحزمة' : 'What’s inside'}</h2>
            <div className="mt-4 space-y-3">
              {(bundle.items || []).map((it) => {
                const p = productMap[it.product_id];
                const stock = p ? Number(p.stock || 0) : 0;
                const enough = stock >= Number(it.quantity || 0);
                return (
                  <div key={it.product_id} className="flex items-center gap-4 p-3 rounded-2xl bg-card border border-border/60">
                    <Link to={`/product/${it.product_id}`} className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-mist">
                      <Image src={it.image_url || p?.image_url} alt={it.name} fittingType="fill" className="w-full h-full object-cover" />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/product/${it.product_id}`} className="font-heading font-bold hover:text-cosmic truncate block">{it.name}</Link>
                      <p className="text-sm text-muted-foreground">{formatPrice(it.unit_price || (p ? p.sale_price ?? p.price : 0))} × {it.quantity}</p>
                    </div>
                    <span className={`text-xs font-heading font-bold shrink-0 ${enough ? 'text-emerald-600' : 'text-destructive'}`}>
                      {enough ? (ar ? 'متوفر' : 'In stock') : (ar ? 'غير متوفر' : 'Low')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-xl safe-bottom">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div className="hidden sm:block">
            <p className="font-heading font-bold">{bundle.name}</p>
            <p className="text-sm text-muted-foreground">{formatPrice(sell)} · {qty}</p>
          </div>
          <div className="flex flex-1 sm:flex-initial gap-3">
            <button
              onClick={addToCart}
              disabled={out}
              className="squish flex-1 sm:w-auto whitespace-nowrap h-14 px-6 rounded-full bg-mist text-foreground font-heading font-bold inline-flex items-center justify-center gap-2 hover:bg-accent hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-mist disabled:hover:text-foreground"
            >
              <ShoppingBag className="w-5 h-5" /> {out ? t('pd.outOfStock') : added ? t('common.added') : t('common.addToCart')}
            </button>
            <button
              disabled={out}
              onClick={() => { addToCart(); navigate('/checkout'); }}
              className="squish flex-1 sm:w-auto h-14 px-6 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 hover:bg-primary transition-colors disabled:opacity-50"
            >
              {t('common.buyNow')}
            </button>
          </div>
        </div>
      </div>

      <div className="pb-32"><Footer /></div>
    </div>
  );
}