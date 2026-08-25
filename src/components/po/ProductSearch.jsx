import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { productMatches, productSku } from '@/lib/po';
import { Image } from '@/components/ui/image';
import { useLanguage } from '@/context/LanguageContext';

// Fast product lookup by name, variant SKU, or record id. Selecting a product
// adds it as a line item (the parent handles duplicate-increment logic).
export default function ProductSearch({ products, onAdd }) {
  const { lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    return products.filter((p) => productMatches(p, q)).slice(0, 8);
  }, [q, products]);

  const pick = (p) => {
    onAdd(p);
    setQ('');
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-5 h-5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={ar ? 'ابحث برقم المنتج / الكود أو الاسم' : 'Search by product no. / SKU or name'}
          className="w-full h-12 ps-10 pe-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40"
        />
      </div>
      {open && q.trim() && (
        <>
          <button type="button" className="fixed inset-0 z-20" aria-label="close" onClick={() => setOpen(false)} />
          <div className="absolute z-30 mt-2 w-full rounded-2xl bg-card border border-border shadow-xl max-h-72 overflow-auto">
            {results.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">{ar ? 'لا نتائج' : 'No matches'}</p>
            ) : (
              results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-mist text-start"
                >
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-mist shrink-0">
                    <Image src={p.image_url} alt={p.name} fittingType="fill" className="w-full h-full" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-bold text-sm truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {productSku(p) ? `#${productSku(p)} · ` : ''}{formatPrice(p.sale_price ?? p.price)} · {ar ? 'المخزون' : 'Stock'} {p.stock ?? 0}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}