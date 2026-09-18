import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { db } from '@/api/entities';
import { Image } from '@/components/ui/image';
import { useLanguage } from '@/context/LanguageContext';
import { getOptions, getVariants, hasVariants } from '@/lib/variants';

// Customer-facing "pick a different product to exchange into" search.
// Deliberately NOT the admin ProductPicker/ProductSearch components (both
// query unfiltered and are styled for SKU/barcode admin search) -- this
// filters to published products with real availability (stock minus any
// exchange reservation) the way the storefront itself would, per section
// 36 ("customer must not finalize selection of an unavailable product").
// The backend RPC re-validates all of this regardless.
export default function ReplacementProductPicker({ onSelect, onClose }) {
  const { lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);
  const [selection, setSelection] = useState({});

  useEffect(() => {
    db.Product.filter({ status: 'published' }, '-created_date', 300)
      .then((list) => setProducts(list || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const available = (p) => Number(p.stock || 0) - Number(p.reserved_stock || 0);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter((p) => {
      const variantAvailable = hasVariants(p)
        ? getVariants(p).some((v) => v.active !== false && Number(v.stock || 0) - Number(v.reserved_stock || 0) > 0)
        : available(p) > 0;
      if (!variantAvailable) return false;
      if (!term) return true;
      return String(p.name || '').toLowerCase().includes(term) || String(p.name_en || '').toLowerCase().includes(term);
    });
  }, [products, q]);

  const pickedVariants = picked ? getVariants(picked) : [];
  const pickedOptions = picked ? getOptions(picked) : [];
  const selectedVariant = picked && hasVariants(picked)
    ? pickedVariants.find((v) => pickedOptions.every((o) => selection[o.name] === v.attributes?.[o.name]))
    : null;

  const confirmPick = () => {
    if (!picked) return;
    if (hasVariants(picked)) {
      if (!selectedVariant || selectedVariant.active === false || Number(selectedVariant.stock || 0) - Number(selectedVariant.reserved_stock || 0) <= 0) return;
      onSelect(picked, selectedVariant.key);
    } else {
      onSelect(picked, null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-5">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3 shrink-0">
          <h2 className="font-heading font-extrabold text-xl">{ar ? 'اختر منتجاً بديلاً' : 'Choose a Replacement Product'}</h2>
          <button onClick={onClose} className="grid place-items-center w-10 h-10 rounded-full bg-mist"><X className="w-5 h-5" /></button>
        </div>

        {picked ? (
          <div className="px-5 pb-5 overflow-y-auto flex-1 grid gap-4">
            <button onClick={() => { setPicked(null); setSelection({}); }} className="text-sm text-cosmic font-heading font-bold justify-self-start">
              {ar ? '← رجوع للقائمة' : '← Back to list'}
            </button>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-mist shrink-0">
                <Image src={picked.image_url} alt="" fittingType="fill" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="font-heading font-bold">{ar ? picked.name : (picked.name_en || picked.name)}</p>
                <p className="text-sm text-cosmic font-heading font-bold">{formatPrice(picked.sale_price ?? picked.price)}</p>
              </div>
            </div>
            {hasVariants(picked) && (
              <div className="grid gap-3">
                {pickedOptions.map((opt) => (
                  <div key={opt.name}>
                    <p className="text-xs text-muted-foreground mb-1.5">{opt.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {opt.values.map((v) => {
                        const active = selection[opt.name] === v.value;
                        return (
                          <button
                            key={v.value}
                            onClick={() => setSelection((s) => ({ ...s, [opt.name]: v.value }))}
                            className={`h-9 px-3.5 rounded-full border text-sm font-medium ${active ? 'border-cosmic bg-cosmic/10 text-cosmic' : 'border-border bg-mist'}`}
                          >
                            {v.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {selectedVariant && (
                  <p className="text-xs text-muted-foreground">
                    {ar ? 'المتاح' : 'Available'}: {Math.max(0, Number(selectedVariant.stock || 0) - Number(selectedVariant.reserved_stock || 0))}
                  </p>
                )}
              </div>
            )}
            {!hasVariants(picked) && (
              <p className="text-xs text-muted-foreground">{ar ? 'المتاح' : 'Available'}: {available(picked)}</p>
            )}
            <button
              onClick={confirmPick}
              disabled={hasVariants(picked) && (!selectedVariant || selectedVariant.active === false || Number(selectedVariant.stock || 0) - Number(selectedVariant.reserved_stock || 0) <= 0)}
              className="h-12 rounded-full bg-cosmic text-white font-heading font-bold disabled:opacity-60"
            >
              {ar ? 'اختيار هذا المنتج' : 'Select This Product'}
            </button>
          </div>
        ) : (
          <>
            <div className="px-5 pb-3 shrink-0 relative">
              <Search className="absolute top-1/2 -translate-y-1/2 start-8 w-4 h-4 text-muted-foreground" />
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder={ar ? 'ابحث عن منتج…' : 'Search products…'}
                className="w-full h-11 ps-9 pe-3 rounded-2xl bg-mist border border-border text-sm"
              />
            </div>
            <div className="px-5 pb-5 overflow-y-auto flex-1">
              {loading ? (
                <div className="grid place-items-center py-16"><Loader2 className="w-6 h-6 animate-spin text-cosmic" /></div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">{ar ? 'لا توجد منتجات متاحة مطابقة' : 'No available products match'}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filtered.map((p) => (
                    <button key={p.id} onClick={() => setPicked(p)} className="rounded-2xl bg-mist/60 p-3 text-start hover:bg-mist transition-colors">
                      <div className="aspect-square rounded-xl overflow-hidden bg-mist mb-2">
                        <Image src={p.image_url} alt="" fittingType="fill" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-sm font-medium truncate">{ar ? p.name : (p.name_en || p.name)}</p>
                      <p className="text-sm text-cosmic font-heading font-bold">{formatPrice(p.sale_price ?? p.price)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
