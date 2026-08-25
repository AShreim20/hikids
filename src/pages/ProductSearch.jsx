import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Loader2, Lock, Pencil } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

// Dedicated admin product search. Reads the existing Products data only —
// no duplicate records or separate database. Searches product name plus any
// variant SKU / barcode. Results show name, SKU, image, category, selling
// price, unit cost, current stock, and stock status, with a quick edit link.

function productSku(p) {
  const vs = p?.variants;
  if (Array.isArray(vs) && vs.length) {
    const withSku = vs.find((v) => v && v.sku);
    if (withSku) return withSku.sku;
  }
  return '—';
}

function searchableText(p) {
  const parts = [p?.name || ''];
  if (Array.isArray(p?.variants)) {
    p.variants.forEach((v) => {
      if (v?.sku) parts.push(v.sku);
      if (v?.barcode) parts.push(v.barcode);
    });
  }
  return parts.join(' ').toLowerCase();
}

export default function ProductSearch() {
  const { user } = useAuth();
  const { t, lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (user?.role !== 'admin') { setLoading(false); return; }
    let live = true;
    base44.entities.Product.list('-updated_date', 500)
      .then((rows) => live && setProducts(rows || []))
      .catch(() => live && setProducts([]))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [user]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => searchableText(p).includes(term));
  }, [products, q]);

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-center">
          <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="mt-3 font-heading font-bold text-lg">{ar ? 'وصول مقيّد' : 'Restricted'}</p>
          <Link to="/" className="mt-2 inline-block text-cosmic underline">{t('pd.back')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          ← {t('pd.back')}
        </Link>
        <h1 className="mt-6 font-heading font-extrabold text-4xl md:text-5xl">
          {ar ? 'البحث عن المنتجات' : 'Product Search'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {ar ? 'ابحث بالاسم أو رقم المنتج (SKU) أو الباركود' : 'Search by name, SKU, or barcode'}
        </p>

        <div className="mt-6 relative max-w-xl">
          <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-5 h-5 text-muted-foreground pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={ar ? 'ابحث بالاسم أو SKU أو الباركود…' : 'Search name, SKU, barcode…'}
            autoFocus
            className="w-full h-14 ps-12 pe-4 rounded-2xl bg-card border border-border/70 focus:border-cosmic outline-none font-body"
          />
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('common.loading')}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                {ar ? `${results.length} نتيجة` : `${results.length} results`}
              </p>
              {results.length === 0 ? (
                <p className="text-muted-foreground">{ar ? 'لا توجد نتائج' : 'No results'}</p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border/70">
                  <table className="w-full text-sm">
                    <thead className="bg-mist text-muted-foreground">
                      <tr>
                        <th className="text-start font-heading font-bold px-4 py-3">{ar ? 'المنتج' : 'Product'}</th>
                        <th className="text-start font-heading font-bold px-4 py-3">SKU</th>
                        <th className="text-start font-heading font-bold px-4 py-3">{ar ? 'الفئة' : 'Category'}</th>
                        <th className="text-end font-heading font-bold px-4 py-3">{ar ? 'سعر البيع' : 'Selling Price'}</th>
                        <th className="text-end font-heading font-bold px-4 py-3">{ar ? 'تكلفة الوحدة' : 'Unit Cost'}</th>
                        <th className="text-end font-heading font-bold px-4 py-3">{ar ? 'المخزون' : 'Stock'}</th>
                        <th className="text-start font-heading font-bold px-4 py-3">{ar ? 'الحالة' : 'Status'}</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((p) => {
                        const stock = Number(p.stock) || 0;
                        const onSale = p.sale_price != null && Number(p.sale_price) < Number(p.price || 0);
                        return (
                          <tr key={p.id} className="border-t border-border/50 hover:bg-mist/50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-mist shrink-0">
                                  <Image src={p.image_url} className="w-full h-full" fittingType="fill" />
                                </div>
                                <Link to={`/product/${p.id}`} className="font-heading font-bold hover:text-cosmic">
                                  {p.name}
                                </Link>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">{productSku(p)}</td>
                            <td className="px-4 py-3">{p.category || '—'}</td>
                            <td className="px-4 py-3 text-end">
                              {onSale ? (
                                <span>
                                  <span className="line-through text-muted-foreground">{formatPrice(p.price)}</span>{' '}
                                  <span className="font-bold text-accent">{formatPrice(p.sale_price)}</span>
                                </span>
                              ) : (
                                <span className="font-bold">{formatPrice(p.price)}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-end text-muted-foreground">{p.unit_cost != null ? formatPrice(p.unit_cost) : '—'}</td>
                            <td className="px-4 py-3 text-end">
                              <span className={stock > 0 ? 'font-bold' : 'text-accent font-bold'}>{stock}</span>
                            </td>
                            <td className="px-4 py-3">
                              {stock > 0 ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">{ar ? 'متوفر' : 'In stock'}</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full bg-accent/15 text-accent text-xs font-bold">{ar ? 'نفد' : 'Out'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-end">
                              <Link to={`/admin/product/${p.id}`} className="inline-grid place-items-center w-9 h-9 rounded-xl hover:bg-mist" aria-label="Edit">
                                <Pencil className="w-4 h-4" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}