import React, { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Loader2, Save, Search, GripVertical, X, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { db } from '@/api/entities';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import { upsertContent, loadContentRecord } from '@/lib/siteContent';
import { productName } from '@/lib/bilingual';
import { priceInfo } from '@/lib/pricing';
import { isEligibleForDeals, HOMEPAGE_DEALS_KEY, HOMEPAGE_DEALS_DEFAULT, HOMEPAGE_DEALS_MAX } from '@/lib/homepageDeals';
import StickySaveBar from '@/components/admin/StickySaveBar';

// One product's row in either the search results list or the selected-list —
// same visual (thumbnail, name, price/discount) either way, only the
// trailing action (Add vs. drag+Remove) differs.
function ProductRow({ product, lang, formatPrice, discountPctFor, trailing, dragHandleProps, warning }) {
  const { original, final, hasDiscount, discountPct } = priceInfo(product, discountPctFor(product.category));
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-card border border-border">
      {dragHandleProps && (
        <button type="button" {...dragHandleProps} className="grid place-items-center w-8 h-8 rounded-full text-muted-foreground hover:bg-mist cursor-grab active:cursor-grabbing shrink-0">
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      <div className="shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-mist">
        {product.image_url && (
          <Image src={product.image_url} alt="" fittingType="fill" className="w-full h-full object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-bold text-sm truncate">{productName(product, lang)}</p>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-heading font-bold text-cosmic">{formatPrice(final)}</span>
          {hasDiscount && <span className="text-muted-foreground line-through">{formatPrice(original)}</span>}
          {hasDiscount && <span className="text-accent font-bold">-{discountPct}%</span>}
          {warning && (
            <span className="inline-flex items-center gap-1 text-destructive font-bold">
              <AlertTriangle className="w-3 h-3" /> {warning}
            </span>
          )}
        </div>
      </div>
      {trailing}
    </div>
  );
}

export default function HomepageDealsAdminSettings() {
  const { t, lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const { discountPctFor } = useCategories();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recordId, setRecordId] = useState(null);
  const [mode, setMode] = useState(HOMEPAGE_DEALS_DEFAULT.mode);
  const [productIds, setProductIds] = useState(HOMEPAGE_DEALS_DEFAULT.product_ids);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      // A bounded admin-management fetch (matches Admin.jsx's own product
      // list), not the public homepage's own request — this is the search/
      // eligibility source for the picker below, not what customers see.
      db.Product.list('-updated_date', 500),
      loadContentRecord(HOMEPAGE_DEALS_KEY),
    ])
      .then(([prods, rec]) => {
        setProducts(prods || []);
        if (rec) {
          setRecordId(rec.id);
          setMode(rec.data?.mode === 'manual' ? 'manual' : 'auto');
          setProductIds(Array.isArray(rec.data?.product_ids) ? rec.data.product_ids : []);
        }
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const productById = useMemo(() => {
    const m = new Map();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const onSaleProducts = useMemo(
    () => products.filter((p) => isEligibleForDeals(p, discountPctFor(p.category))),
    [products, discountPctFor]
  );

  // Search results — only products with a genuinely active discount are
  // offered here ("normally be selectable", per the brief), matched by
  // Arabic/English name, barcode, or any variant's SKU/barcode, same
  // multi-field search Admin.jsx's own product list already uses.
  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    const pool = onSaleProducts.filter((p) => !productIds.includes(p.id));
    if (!term) return pool.slice(0, 8);
    return pool
      .filter((p) => {
        const text = [
          p.name || '', p.name_en || '', p.barcode || '',
          ...(Array.isArray(p.variants) ? p.variants.flatMap((v) => [v.sku || '', v.barcode || '']) : []),
        ].join(' ').toLowerCase();
        return text.includes(term);
      })
      .slice(0, 8);
  }, [search, onSaleProducts, productIds]);

  const addProduct = (id) => {
    if (productIds.length >= HOMEPAGE_DEALS_MAX) {
      toast({ title: ar ? `الحد الأقصى ${HOMEPAGE_DEALS_MAX} منتجات` : `Maximum ${HOMEPAGE_DEALS_MAX} products`, variant: 'destructive' });
      return;
    }
    if (productIds.includes(id)) return; // never the same product twice
    setProductIds((ids) => [...ids, id]);
    setSearch('');
  };
  const removeProduct = (id) => setProductIds((ids) => ids.filter((x) => x !== id));
  const move = (i, delta) => {
    const target = i + delta;
    if (target < 0 || target >= productIds.length) return;
    setProductIds((ids) => {
      const next = [...ids];
      [next[i], next[target]] = [next[target], next[i]];
      return next;
    });
  };
  const onDragEnd = (res) => {
    if (!res.destination || res.destination.index === res.source.index) return;
    setProductIds((ids) => {
      const next = Array.from(ids);
      const [moved] = next.splice(res.source.index, 1);
      next.splice(res.destination.index, 0, moved);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await upsertContent(HOMEPAGE_DEALS_KEY, { mode, product_ids: productIds });
      toast({ title: t('settings.saved') });
    } catch (e) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="mt-10 grid place-items-center py-16"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>;
  }

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-muted-foreground">{t('admin.dealsDisplayLabel')}</p>

      {/* Mode */}
      <div className="rounded-3xl bg-card border border-border/60 p-4 space-y-3">
        {[
          { id: 'auto', label: t('deals.modeAuto') },
          { id: 'manual', label: t('deals.modeManual') },
        ].map((opt) => (
          <label key={opt.id} className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="deals-mode"
              checked={mode === opt.id}
              onChange={() => setMode(opt.id)}
              className="w-5 h-5 accent-cosmic"
            />
            <span className="font-heading font-bold">{opt.label}</span>
          </label>
        ))}
      </div>

      {mode === 'manual' && (
        <div className="rounded-3xl bg-card border border-border/60 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-heading font-bold">{ar ? 'المنتجات المختارة' : 'Selected products'}</p>
            <span className={`text-sm font-heading font-bold ${productIds.length >= HOMEPAGE_DEALS_MAX ? 'text-cosmic' : 'text-muted-foreground'}`}>
              {productIds.length} / {HOMEPAGE_DEALS_MAX}
            </span>
          </div>

          {productIds.length > 0 && (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="homepage-deals">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                    {productIds.map((id, i) => {
                      const p = productById.get(id);
                      if (!p) {
                        // Deleted since being selected — never render a
                        // broken card, just let the admin remove the entry.
                        return (
                          <div key={id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-destructive/5 border border-destructive/20">
                            <span className="flex-1 text-sm text-destructive font-bold">{ar ? 'هذا المنتج لم يعد موجودًا' : 'This product no longer exists'}</span>
                            <button type="button" onClick={() => removeProduct(id)} className="grid place-items-center w-9 h-9 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors shrink-0">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      }
                      const eligible = isEligibleForDeals(p, discountPctFor(p.category));
                      return (
                        <Draggable key={id} draggableId={id} index={i}>
                          {(prov, snapshot) => (
                            <div ref={prov.innerRef} {...prov.draggableProps} className={snapshot.isDragging ? 'opacity-90' : ''}>
                              <ProductRow
                                product={p}
                                lang={lang}
                                formatPrice={formatPrice}
                                discountPctFor={discountPctFor}
                                warning={!eligible ? t('admin.dealsExpired') : null}
                                dragHandleProps={prov.dragHandleProps}
                                trailing={
                                  <div className="flex items-center gap-1 shrink-0">
                                    <div className="flex flex-col">
                                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid place-items-center w-6 h-5 text-muted-foreground disabled:opacity-25">
                                        <ChevronUp className="w-3.5 h-3.5" />
                                      </button>
                                      <button type="button" onClick={() => move(i, 1)} disabled={i === productIds.length - 1} className="grid place-items-center w-6 h-5 text-muted-foreground disabled:opacity-25">
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    <button type="button" onClick={() => removeProduct(id)} className="grid place-items-center w-9 h-9 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors">
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                }
                              />
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}

          {productIds.length < HOMEPAGE_DEALS_MAX && (
            <div>
              <div className="relative">
                <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={ar ? 'ابحث بالاسم، الباركود، أو SKU…' : 'Search by name, barcode, or SKU…'}
                  className="w-full h-11 ps-9 pe-3 rounded-2xl bg-mist border border-border text-sm"
                />
              </div>
              <div className="mt-2 space-y-2">
                {searchResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">{ar ? 'لا توجد منتجات مخفّضة مطابقة' : 'No matching discounted products'}</p>
                ) : (
                  searchResults.map((p) => (
                    <ProductRow
                      key={p.id}
                      product={p}
                      lang={lang}
                      formatPrice={formatPrice}
                      discountPctFor={discountPctFor}
                      trailing={
                        <button
                          type="button"
                          onClick={() => addProduct(p.id)}
                          className="squish h-9 px-4 rounded-full bg-cosmic text-white text-sm font-heading font-bold shrink-0"
                        >
                          {ar ? 'إضافة' : 'Add'}
                        </button>
                      }
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <StickySaveBar>
        <button onClick={save} disabled={saving} className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold disabled:opacity-60">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} {t('settings.save')}
        </button>
      </StickySaveBar>
    </div>
  );
}
