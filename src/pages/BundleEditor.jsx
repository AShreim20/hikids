import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Lock, X, ImagePlus, Trash2, Plus, Minus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import ProductSearch from '@/components/po/ProductSearch';
import { productSku } from '@/lib/po';
import {
  bundleOriginalPrice, bundleSellingPrice, bundleDiscountPercent,
} from '@/lib/bundles';

const EMPTY = {
  name: '', description: '', image_url: '', items: [],
  bundle_price: '', discount_percent: 0, start_date: '', end_date: '', active: true, sort_order: 0,
};

export default function BundleEditor() {
  const { id } = useParams();
  const isNew = !id;
  const { user } = useAuth();
  const { t, lang, formatPrice } = useLanguage();
  const { toast } = useToast();
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imgInputRef = useRef(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    base44.entities.Product.list('-updated_date', 500).then(setProducts).catch(() => setProducts([]));
    if (isNew) setLoading(false);
    else {
      base44.entities.Bundle.get(id)
        .then((b) => setForm({
          ...EMPTY,
          ...b,
          bundle_price: b.bundle_price ?? '',
          discount_percent: b.discount_percent ?? 0,
          start_date: b.start_date || '',
          end_date: b.end_date || '',
        }))
        .catch(() => toast({ title: ar ? 'الحزمة غير موجودة' : 'Bundle not found', variant: 'destructive' }))
        .finally(() => setLoading(false));
    }
  }, [id, isNew]);

  // items helpers
  const addItem = (p) => {
    const existing = form.items.find((i) => i.product_id === p.id);
    if (existing) {
      set('items', form.items.map((i) => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      set('items', [...form.items, {
        product_id: p.id, name: p.name, sku: productSku(p),
        image_url: p.image_url, unit_price: p.sale_price ?? p.price, quantity: 1,
      }]);
    }
  };
  const setItemQty = (pid, q) => set('items', form.items.map((i) => i.product_id === pid ? { ...i, quantity: Math.max(1, Math.floor(Number(q) || 1)) } : i));
  const removeItem = (pid) => set('items', form.items.filter((i) => i.product_id !== pid));

  const original = bundleOriginalPrice(form);

  // Pricing auto-calc: editing bundle_price derives discount %, editing
  // discount % derives bundle price — keeping the two in sync.
  const onPriceChange = (val) => {
    const v = val === '' ? '' : Math.max(0, Number(val) || 0);
    set('bundle_price', v);
    if (original > 0 && v !== '' && v >= 0) {
      const pct = Math.round((1 - Number(v) / original) * 100);
      set('discount_percent', Math.max(0, Math.min(100, pct)));
    }
  };
  const onDiscountChange = (val) => {
    const pct = Math.max(0, Math.min(100, Number(val) || 0));
    set('discount_percent', pct);
    if (original > 0) {
      set('bundle_price', Math.round(original * (1 - pct / 100) * 100) / 100);
    }
  };

  // Recompute bundle price when items change and discount is the driving value.
  useEffect(() => {
    if (original > 0 && Number(form.discount_percent) > 0 && (form.bundle_price === '' || Number(form.bundle_price) === bundleSellingPrice({ ...form, bundle_price: null })) ) {
      set('bundle_price', Math.round(original * (1 - Number(form.discount_percent) / 100) * 100) / 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original]);

  const onImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('image_url', file_url);
    } catch {
      toast({ title: ar ? 'فشل الرفع' : 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (imgInputRef.current) imgInputRef.current.value = '';
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast({ title: ar ? 'الاسم مطلوب' : 'Name required', variant: 'destructive' }); return; }
    if (!form.items.length) { toast({ title: ar ? 'أضف منتجاً واحداً على الأقل' : 'Add at least one product', variant: 'destructive' }); return; }
    const sell = form.bundle_price === '' ? bundleSellingPrice(form) : Number(form.bundle_price);
    if (!(sell > 0)) { toast({ title: ar ? 'السعر غير صالح' : 'Invalid price', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        image_url: form.image_url,
        items: form.items.map((i) => ({
          product_id: i.product_id, name: i.name, sku: i.sku || '',
          image_url: i.image_url, unit_price: Number(i.unit_price) || 0,
          quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
        })),
        bundle_price: sell,
        discount_percent: Math.max(0, Math.min(100, Number(form.discount_percent) || 0)),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        active: !!form.active,
        sort_order: Number(form.sort_order) || 0,
      };
      if (isNew) await base44.entities.Bundle.create(payload);
      else await base44.entities.Bundle.update(id, payload);
      toast({ title: ar ? 'تم الحفظ' : 'Saved' });
      navigate('/admin/bundles');
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10"><Lock className="w-8 h-8 text-destructive" /></div>
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
        <Loader2 className="w-8 h-8 animate-spin text-cosmic" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-12">
        <Link to="/admin/bundles" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 ltr:rotate-180 rtl:rotate-0" /> {ar ? 'الحزم' : 'Bundles'}
        </Link>
        <h1 className="mt-6 font-heading font-extrabold text-4xl">{isNew ? (ar ? 'حزمة جديدة' : 'New bundle') : (ar ? 'تعديل الحزمة' : 'Edit bundle')}</h1>

        <form onSubmit={submit} className="mt-8 grid gap-6">
          {/* Basics */}
          <div className="rounded-3xl bg-card border border-border/60 p-6 grid gap-4">
            <label className="block">
              <span className="text-sm font-medium text-foreground/80">{ar ? 'الاسم' : 'Name'}<span className="text-accent"> *</span></span>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} required className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-foreground/80">{ar ? 'الوصف' : 'Description'}</span>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} className="mt-1.5 w-full p-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic resize-none" />
            </label>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-foreground/80 shrink-0">{ar ? 'الصورة' : 'Image'}</span>
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-mist shrink-0">
                {form.image_url ? <Image src={form.image_url} alt="" fittingType="fill" className="w-full h-full object-cover" /> : <ImagePlus className="w-8 h-8 text-muted-foreground mx-auto mt-6" />}
              </div>
              <input ref={imgInputRef} type="file" accept="image/*" onChange={onImage} className="hidden" />
              <button type="button" onClick={() => imgInputRef.current?.click()} disabled={uploading} className="h-11 px-5 rounded-full bg-mist font-heading font-bold text-sm inline-flex items-center gap-2 disabled:opacity-60">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />} {ar ? 'رفع' : 'Upload'}
              </button>
              {form.image_url && (
                <button type="button" onClick={() => set('image_url', '')} className="grid place-items-center w-10 h-10 rounded-full bg-destructive/10 text-destructive"><X className="w-4 h-4" /></button>
              )}
            </div>
          </div>

          {/* Products */}
          <div className="rounded-3xl bg-card border border-border/60 p-6">
            <h2 className="font-heading font-extrabold text-xl">{ar ? 'المنتجات المضمّنة' : 'Included products'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{ar ? 'ابحث بالاسم أو رقم المنتج/الكود، ثم حدّد الكمية.' : 'Search by name or SKU, then set each quantity.'}</p>
            <div className="mt-4">
              <ProductSearch products={products} onAdd={addItem} />
            </div>

            <div className="mt-4 space-y-2">
              {form.items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">{ar ? 'لم تُضف منتجات بعد' : 'No products added yet'}</p>
              ) : form.items.map((it) => (
                <div key={it.product_id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-mist">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-card shrink-0">
                    <Image src={it.image_url} alt={it.name} fittingType="fill" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold text-sm truncate">{it.name}</p>
                    <p className="text-xs text-muted-foreground">{it.sku ? `#${it.sku} · ` : ''}{formatPrice(it.unit_price)}</p>
                  </div>
                  <div className="flex items-center rounded-full bg-card">
                    <button type="button" onClick={() => setItemQty(it.product_id, it.quantity - 1)} className="grid place-items-center w-9 h-9 rounded-full"><Minus className="w-4 h-4" /></button>
                    <input type="number" min="1" value={it.quantity} onChange={(e) => setItemQty(it.product_id, e.target.value)} className="w-12 bg-transparent text-center font-heading font-bold text-sm focus:outline-none" />
                    <button type="button" onClick={() => setItemQty(it.product_id, it.quantity + 1)} className="grid place-items-center w-9 h-9 rounded-full"><Plus className="w-4 h-4" /></button>
                  </div>
                  <button type="button" onClick={() => removeItem(it.product_id)} className="grid place-items-center w-9 h-9 rounded-full bg-destructive/10 text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-mist/60 px-4 py-3">
              <span className="text-sm text-muted-foreground">{ar ? 'السعر المجمّع الأصلي' : 'Combined original price'}</span>
              <span className="font-heading font-extrabold text-lg">{formatPrice(original)}</span>
            </div>
          </div>

          {/* Pricing */}
          <div className="rounded-3xl bg-card border border-border/60 p-6">
            <h2 className="font-heading font-extrabold text-xl">{ar ? 'تسعير الحزمة' : 'Bundle pricing'}</h2>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-medium text-foreground/80">{ar ? 'سعر الحزمة' : 'Bundle price'}</span>
                <input type="number" min="0" step="0.01" value={form.bundle_price} onChange={(e) => onPriceChange(e.target.value)} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-foreground/80">{ar ? 'نسبة الخصم %' : 'Discount %'}</span>
                <input type="number" min="0" max="100" value={form.discount_percent} onChange={(e) => onDiscountChange(e.target.value)} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
              </label>
            </div>
            <p className="mt-3 text-sm text-cosmic font-heading font-bold">
              {ar ? 'سعر البيع النهائي: ' : 'Selling price: '}{formatPrice(form.bundle_price === '' ? bundleSellingPrice(form) : Number(form.bundle_price))}
              {bundleDiscountPercent(form) > 0 && ` · −${bundleDiscountPercent(form)}%`}
            </p>
          </div>

          {/* Scheduling & status */}
          <div className="rounded-3xl bg-card border border-border/60 p-6 grid sm:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-foreground/80">{ar ? 'تاريخ البدء' : 'Start date'}</span>
              <input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-foreground/80">{ar ? 'تاريخ الانتهاء' : 'End date'}</span>
              <input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
            </label>
            <label className="flex items-end gap-2 cursor-pointer pb-3">
              <input type="checkbox" checked={!!form.active} onChange={(e) => set('active', e.target.checked)} className="w-5 h-5 rounded accent-cosmic" />
              <span className="font-medium text-sm">{ar ? 'تفعيل الحزمة' : 'Active'}</span>
            </label>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="flex-1 h-12 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t('admin.save')}
            </button>
            <button type="button" onClick={() => navigate('/admin/bundles')} className="h-12 px-6 rounded-full bg-mist font-heading font-bold">{t('admin.cancel')}</button>
          </div>
        </form>
      </div>
      <Footer />
    </div>
  );
}