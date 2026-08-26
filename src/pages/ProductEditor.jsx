import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import ProductFormFields, { CATEGORIES } from '@/components/admin/ProductFormFields';
import { unwrap } from '@/lib/invoke';

const EMPTY = {
  name: '', name_en: '', description: '', price: '', sale_price: '', unit_cost: '', barcode: '', category: CATEGORIES[0], age_range: '',
  image_url: '', images: [], video_url: '', material: '', rating: '', stock: '',
  featured: false, loyalty_exempt: false, tags: [], options: [], variants: [],
};

export default function ProductEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew || user?.role !== 'admin') return;
    setLoading(true);
    base44.entities.Product.get(id)
      .then((p) => setForm({
        name: p.name || '',
        name_en: p.name_en || '',
        description: p.description || '',
        price: p.price ?? '',
        sale_price: p.sale_price ?? '',
        unit_cost: p.unit_cost ?? '',
        barcode: p.barcode || '',
        category: p.category || CATEGORIES[0],
        age_range: p.age_range || '',
        image_url: p.image_url || '',
        images: Array.isArray(p.images) ? p.images : [],
        video_url: p.video_url || '',
        material: p.material || '',
        rating: p.rating ?? '',
        stock: p.stock ?? '',
        featured: !!p.featured,
        loyalty_exempt: !!p.loyalty_exempt,
        tags: Array.isArray(p.tags) ? p.tags : [],
        options: Array.isArray(p.options) ? p.options : [],
        variants: Array.isArray(p.variants) ? p.variants : [],
      }))
      .catch(() => toast({ title: lang === 'ar' ? 'المنتج غير موجود' : 'Product not found', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [id, isNew, user]);

  if (user?.role !== 'admin') {
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

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.category || !form.image_url) {
      toast({ title: t('admin.required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    const barcodeValue = (form.barcode || '').trim();
    if (barcodeValue) {
      try {
        const res = unwrap(await base44.functions.invoke('validateBarcode', { barcode: barcodeValue, exclude_id: isNew ? '' : id }));
        if (res && res.unique === false) {
          toast({ title: t('admin.barcodeInUse'), description: res.conflict?.name || '', variant: 'destructive' });
          setSaving(false);
          return;
        }
      } catch (e) {
        toast({ title: lang === 'ar' ? 'تعذّر التحقق من الباركود' : 'Could not verify barcode', variant: 'destructive' });
        setSaving(false);
        return;
      }
    }
    const payload = {
      name: form.name,
      name_en: (form.name_en || '').trim() || null,
      description: form.description,
      price: Number(form.price) || 0,
      sale_price: form.sale_price ? Number(form.sale_price) : null,
      unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
      barcode: form.barcode || '',
      category: form.category,
      age_range: form.age_range,
      image_url: form.image_url,
      images: form.images || [],
      video_url: form.video_url || null,
      material: form.material,
      rating: form.rating ? Number(form.rating) : 0,
      stock: form.stock !== '' ? Number(form.stock) : 0,
      featured: !!form.featured,
      loyalty_exempt: !!form.loyalty_exempt,
      tags: form.tags || [],
      options: (form.options || []).filter((o) => o.name),
      variants: (form.variants || []).map((v) => ({
        key: v.key,
        attributes: v.attributes,
        price: v.price === '' || v.price == null ? null : Number(v.price),
        cost: v.cost === '' || v.cost == null ? null : Number(v.cost),
        compare_price: v.compare_price === '' || v.compare_price == null ? null : Number(v.compare_price),
        stock: Number(v.stock) || 0,
        sku: v.sku || '',
        barcode: v.barcode || '',
        weight: v.weight === '' || v.weight == null ? null : Number(v.weight),
        active: v.active !== false,
      })),
    };
    try {
      if (isNew) {
        const created = await base44.entities.Product.create(payload);
        await base44.functions.invoke('logAuditActivity', {
          action: 'product.created', target_type: 'product', target_id: created?.id || '',
          details: `Created product "${payload.name}"`,
        });
        toast({ title: lang === 'ar' ? 'أُضيف المنتج' : 'Product added' });
      } else {
        await base44.entities.Product.update(id, payload);
        await base44.functions.invoke('logAuditActivity', {
          action: 'product.updated', target_type: 'product', target_id: id,
          details: `Updated product "${payload.name}"`,
        });
        toast({ title: lang === 'ar' ? 'تم التحديث' : 'Product updated' });
      }
      navigate('/admin');
    } catch (err) {
      toast({ title: lang === 'ar' ? 'خطأ' : 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-10 md:pl-16">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" /> {t('admin.title')}
        </Link>
        <h1 className="mt-5 font-heading font-extrabold text-3xl md:text-4xl">
          {isNew ? t('admin.new') : t('admin.edit')}
        </h1>

        {loading ? (
          <div className="mt-12 grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : (
          <form onSubmit={save} className="mt-8 rounded-3xl bg-card border border-border/60 p-5 sm:p-8">
            <ProductFormFields form={form} set={set} />
            <div className="mt-8 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="squish flex-1 h-12 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? t('admin.saving') : t('admin.save')}
              </button>
              <button type="button" onClick={() => navigate('/admin')} className="squish h-12 px-6 rounded-full bg-mist font-heading font-bold">
                {t('admin.cancel')}
              </button>
            </div>
          </form>
        )}
      </div>
      <Footer />
    </div>
  );
}