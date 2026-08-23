import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, X, Loader2, Upload, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import SheetSelect from '@/components/ui/SheetSelect';

const CATEGORIES = [
  'Build & Create',
  'Plush & Soft',
  'Vehicles & Motion',
  'Early Years',
  'Pretend Play',
  'Arts & Crafts',
];

const EMPTY = {
  name: '',
  description: '',
  price: '',
  sale_price: '',
  category: 'Build & Create',
  age_range: '',
  image_url: '',
  images: [],
  video_url: '',
  material: '',
  rating: '',
  stock: '',
  featured: false,
};

export default function Admin() {
  const { user } = useAuth();
  const { t, lang, formatPrice } = useLanguage();
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const galleryRef = useRef(null);
  const videoRef = useRef(null);

  const load = () => {
    setLoading(true);
    base44.entities.Product.list('-updated_date', 100)
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
    else setLoading(false);
  }, [user]);

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
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">
            {t('pd.back')}
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const openNew = () => {
    setEditing('new');
    setForm(EMPTY);
  };
  const openEdit = (p) => {
    setEditing(p.id);
    setForm({
      name: p.name || '',
      description: p.description || '',
      price: p.price ?? '',
      sale_price: p.sale_price ?? '',
      category: p.category || CATEGORIES[0],
      age_range: p.age_range || '',
      image_url: p.image_url || '',
      images: Array.isArray(p.images) ? p.images : [],
      video_url: p.video_url || '',
      material: p.material || '',
      rating: p.rating ?? '',
      stock: p.stock ?? '',
      featured: !!p.featured,
    });
  };
  const close = () => {
    setEditing(null);
    setForm(EMPTY);
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('image_url', file_url);
    } catch {
      toast({ title: lang === 'ar' ? 'فشل الرفع' : 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const onGalleryFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('images', [...(form.images || []), file_url]);
    } catch {
      toast({ title: lang === 'ar' ? 'فشل الرفع' : 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  const onVideoFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('video_url', file_url);
    } catch {
      toast({ title: lang === 'ar' ? 'فشل الرفع' : 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (videoRef.current) videoRef.current.value = '';
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.category || !form.image_url) {
      toast({ title: t('admin.required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description,
      price: Number(form.price) || 0,
      sale_price: form.sale_price ? Number(form.sale_price) : null,
      category: form.category,
      age_range: form.age_range,
      image_url: form.image_url,
      images: form.images || [],
      video_url: form.video_url || null,
      material: form.material,
      rating: form.rating ? Number(form.rating) : 0,
      stock: form.stock !== '' ? Number(form.stock) : 0,
      featured: !!form.featured,
    };
    try {
      if (editing === 'new') {
        const created = await base44.entities.Product.create(payload);
        await base44.functions.invoke('logAuditActivity', {
          action: 'product.created', target_type: 'product', target_id: created?.id || '',
          details: `Created product "${payload.name}"`,
        });
        toast({ title: lang === 'ar' ? 'أُضيف المنتج' : 'Product added' });
      } else {
        await base44.entities.Product.update(editing, payload);
        await base44.functions.invoke('logAuditActivity', {
          action: 'product.updated', target_type: 'product', target_id: editing,
          details: `Updated product "${payload.name}"`,
        });
        toast({ title: lang === 'ar' ? 'تم التحديث' : 'Product updated' });
      }
      close();
      load();
    } catch (err) {
      toast({
        title: lang === 'ar' ? 'خطأ' : 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(t('admin.confirmDelete'))) return;
    try {
      await base44.entities.Product.delete(p.id);
      await base44.functions.invoke('logAuditActivity', {
        action: 'product.deleted', target_type: 'product', target_id: p.id,
        details: `Deleted product "${p.name}"`,
      });
      toast({ title: lang === 'ar' ? 'تم الحذف' : 'Deleted' });
      load();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          ← {t('pd.back')}
        </Link>
        <div className="mt-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">
              {t('admin.subtitle')}
            </p>
            <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{t('admin.title')}</h1>
          </div>
          <button
            onClick={openNew}
            className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold"
          >
            <Plus className="w-5 h-5" /> {t('admin.add')}
          </button>
        </div>

        {loading ? (
          <div className="mt-12 grid place-items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cosmic" />
          </div>
        ) : products.length === 0 ? (
          <div className="mt-12 rounded-3xl bg-mist/60 p-16 text-center">
            <p className="font-heading font-bold text-2xl">{t('admin.empty')}</p>
            <button onClick={openNew} className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">
              <Plus className="w-5 h-5" /> {t('admin.add')}
            </button>
          </div>
        ) : (
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p) => (
              <div key={p.id} className="rounded-3xl bg-card border border-border/60 overflow-hidden flex flex-col">
                <div className="relative aspect-[4/3] bg-mist">
                  <Image src={p.image_url} alt={p.name} fittingType="fill" className="w-full h-full" />
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                  <p className="mt-1 font-heading font-bold text-lg line-clamp-1">{p.name}</p>
                  <p className="mt-1 font-heading font-extrabold text-cosmic">
                    {formatPrice(p.sale_price ?? p.price)}
                    {p.sale_price != null && p.sale_price < p.price && (
                      <span className="ml-2 text-sm text-muted-foreground line-through">{formatPrice(p.price)}</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('pd.inStock')}: {p.stock ?? 0}</p>
                  <div className="mt-auto pt-4 flex gap-2">
                    <button
                      onClick={() => openEdit(p)}
                      className="squish flex-1 h-10 rounded-full bg-mist font-heading font-bold text-sm inline-flex items-center justify-center gap-1.5"
                    >
                      <Pencil className="w-4 h-4" /> {t('admin.edit')}
                    </button>
                    <button
                      onClick={() => remove(p)}
                      className="squish grid place-items-center w-10 h-10 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors"
                      aria-label={t('admin.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4 overflow-auto">
          <form
            onSubmit={save}
            className="w-full max-w-2xl rounded-3xl bg-card border border-border/60 p-6 md:p-8 my-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-extrabold text-2xl">
                {editing === 'new' ? t('admin.new') : t('admin.edit')}
              </h2>
              <button type="button" onClick={close} className="grid place-items-center w-10 h-10 rounded-full bg-mist">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              <Input label={t('admin.name')} value={form.name} onChange={(e) => set('name', e.target.value)} required className="sm:col-span-2" />
              <Input label={t('admin.description')} value={form.description} onChange={(e) => set('description', e.target.value)} textarea className="sm:col-span-2" />
              <Input label={t('admin.price')} type="number" value={form.price} onChange={(e) => set('price', e.target.value)} required />
              <Input label={t('admin.salePrice')} type="number" value={form.sale_price} onChange={(e) => set('sale_price', e.target.value)} />
              <label className="block">
                <span className="text-sm font-medium text-foreground/80">{t('admin.category')}</span>
                <SheetSelect
                  value={form.category}
                  onChange={(v) => set('category', v)}
                  placeholder={t('admin.category')}
                  label={t('admin.category')}
                  includeEmpty={false}
                  className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40"
                  options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                />
              </label>
              <Input label={t('admin.ageRange')} value={form.age_range} onChange={(e) => set('age_range', e.target.value)} placeholder="3-5" />
              <Input label={t('admin.material')} value={form.material} onChange={(e) => set('material', e.target.value)} className="sm:col-span-2" />
              <Input label={t('admin.rating')} type="number" value={form.rating} onChange={(e) => set('rating', e.target.value)} />
              <Input label={t('admin.stock')} type="number" value={form.stock} onChange={(e) => set('stock', e.target.value)} />

              <div className="sm:col-span-2">
                <span className="text-sm font-medium text-foreground/80">{t('admin.image')}</span>
                <div className="mt-2 flex items-center gap-4">
                  {form.image_url && (
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-mist shrink-0">
                      <Image src={form.image_url} alt="preview" fittingType="fill" className="w-full h-full" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      onChange={onFile}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-mist font-heading font-bold text-sm disabled:opacity-60"
                    >
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploading ? t('admin.uploading') : t('admin.upload')}
                    </button>
                    <input
                      value={form.image_url}
                      onChange={(e) => set('image_url', e.target.value)}
                      placeholder="https://..."
                      className="mt-3 w-full h-11 px-4 rounded-2xl bg-mist border border-border text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <span className="text-sm font-medium text-foreground/80">{t('admin.gallery')}</span>
                <div className="mt-2 flex flex-wrap gap-3">
                  {(form.images || []).map((url, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-2xl overflow-hidden bg-mist">
                      <Image src={url} alt={`gallery-${i}`} fittingType="fill" className="w-full h-full" />
                      <button type="button" onClick={() => set('images', form.images.filter((_, j) => j !== i))} className="absolute top-1 right-1 grid place-items-center w-6 h-6 rounded-full bg-black/60 text-white">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => galleryRef.current?.click()} disabled={uploading} className="squish w-20 h-20 rounded-2xl border-2 border-dashed border-border grid place-items-center text-muted-foreground hover:border-cosmic hover:text-cosmic disabled:opacity-60">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
                  </button>
                  <input ref={galleryRef} type="file" accept="image/*" onChange={onGalleryFile} className="hidden" />
                </div>
              </div>

              <div className="sm:col-span-2">
                <span className="text-sm font-medium text-foreground/80">{t('admin.video')}</span>
                <div className="mt-2 flex items-center gap-4">
                  {form.video_url && (
                    <div className="relative w-28 h-20 rounded-2xl overflow-hidden bg-black shrink-0">
                      <video src={form.video_url} className="w-full h-full object-cover" muted />
                      <button type="button" onClick={() => set('video_url', '')} className="absolute top-1 right-1 grid place-items-center w-6 h-6 rounded-full bg-black/60 text-white">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex-1">
                    <input ref={videoRef} type="file" accept="video/*" onChange={onVideoFile} className="hidden" />
                    <button type="button" onClick={() => videoRef.current?.click()} disabled={uploading} className="squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-mist font-heading font-bold text-sm disabled:opacity-60">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploading ? t('admin.uploading') : t('admin.uploadVideo')}
                    </button>
                    <input value={form.video_url} onChange={(e) => set('video_url', e.target.value)} placeholder="https://...mp4" className="mt-3 w-full h-11 px-4 rounded-2xl bg-mist border border-border text-sm" />
                  </div>
                </div>
              </div>

              <label className="sm:col-span-2 flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => set('featured', e.target.checked)}
                  className="w-5 h-5 rounded accent-cosmic"
                />
                <span className="font-medium">{t('admin.featured')}</span>
              </label>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="squish flex-1 h-12 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? t('admin.saving') : t('admin.save')}
              </button>
              <button
                type="button"
                onClick={close}
                className="squish h-12 px-6 rounded-full bg-mist font-heading font-bold"
              >
                {t('admin.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <Footer />
    </div>
  );
}

function Input({ label, value, onChange, required, type = 'text', placeholder, textarea, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-foreground/80">
        {label}{required && <span className="text-accent"> *</span>}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={onChange}
          rows={3}
          placeholder={placeholder}
          className="mt-1.5 w-full p-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 resize-none"
        />
      ) : (
        <input
          type={type}
          required={required}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40"
        />
      )}
    </label>
  );
}