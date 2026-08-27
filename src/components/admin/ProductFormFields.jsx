import React, { useRef, useState } from 'react';
import { Plus, X, Loader2, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import SheetSelect from '@/components/ui/SheetSelect';
import TagInput from '@/components/TagInput';
import OptionsEditor from '@/components/admin/OptionsEditor';
import VariantTable from '@/components/admin/VariantTable';
import FormInput from '@/components/admin/FormInput';
import { useCategories } from '@/context/CategoryContext';

export const CATEGORIES = [
  'Build & Create',
  'Plush & Soft',
  'Vehicles & Motion',
  'Early Years',
  'Pretend Play',
  'Arts & Crafts',
];

export default function ProductFormFields({ form, set }) {
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const { categories } = useCategories();
  const categoryOptions = (categories && categories.length ? categories.map((c) => c.name) : CATEGORIES);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const galleryRef = useRef(null);
  const videoRef = useRef(null);

  const upload = async (file) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url;
  };
  const fail = () => toast({ title: lang === 'ar' ? 'فشل الرفع' : 'Upload failed', variant: 'destructive' });

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { set('image_url', await upload(file)); } catch { fail(); } finally { setUploading(false); }
  };

  const onGalleryFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) urls.push(await upload(file));
      set('images', [...(form.images || []), ...urls]);
    } catch { fail(); } finally {
      setUploading(false);
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  const onVideoFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { set('video_url', await upload(file)); } catch { fail(); } finally {
      setUploading(false);
      if (videoRef.current) videoRef.current.value = '';
    }
  };

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <FormInput label={ar ? 'الاسم (عربي) — مطلوب' : 'Name (Arabic) — required'} value={form.name} onChange={(e) => set('name', e.target.value)} required className="sm:col-span-2" />
      <FormInput label={ar ? 'الاسم (إنجليزي) — اختياري' : 'Name (English) — optional'} value={form.name_en || ''} onChange={(e) => set('name_en', e.target.value)} className="sm:col-span-2" />
      <FormInput label={ar ? 'الوصف (عربي) — مطلوب' : 'Description (Arabic) — required'} value={form.description} onChange={(e) => set('description', e.target.value)} textarea required className="sm:col-span-2" />
      <FormInput label={ar ? 'الوصف (إنجليزي) — اختياري' : 'Description (English) — optional'} value={form.description_en || ''} onChange={(e) => set('description_en', e.target.value)} textarea className="sm:col-span-2" />
      <FormInput label={t('admin.price')} type="number" value={form.price} onChange={(e) => set('price', e.target.value)} required />
      <FormInput label={t('admin.salePrice')} type="number" value={form.sale_price} onChange={(e) => set('sale_price', e.target.value)} />
      <FormInput label={t('admin.unitCost')} type="number" value={form.unit_cost} onChange={(e) => set('unit_cost', e.target.value)} />
      <FormInput label={t('admin.barcode')} value={form.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="—" />
      <label className="block">
        <span className="text-sm font-medium text-foreground/80">{t('admin.category')}</span>
        <SheetSelect
          value={form.category}
          onChange={(v) => set('category', v)}
          placeholder={t('admin.category')}
          label={t('admin.category')}
          includeEmpty={false}
          className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40"
          options={categoryOptions.map((c) => ({ value: c, label: c }))}
        />
      </label>
      <FormInput label={t('admin.ageRange')} value={form.age_range} onChange={(e) => set('age_range', e.target.value)} placeholder="3-5" />
      <div className="sm:col-span-2">
        <span className="text-sm font-medium text-foreground/80">{t('admin.gender')}</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {['Boy', 'Girl', 'Unisex'].map((g) => {
            const arr = form.gender || [];
            const active = arr.includes(g);
            return (
              <button
                type="button"
                key={g}
                onClick={() => set('gender', active ? arr.filter((x) => x !== g) : [...arr, g])}
                className={`squish h-10 px-4 rounded-full text-sm font-medium transition-colors ${
                  active ? 'bg-cosmic text-white' : 'bg-mist text-foreground/70 hover:bg-accent/20'
                }`}
              >
                {t(`gender.${g.toLowerCase()}`)}
              </button>
            );
          })}
        </div>
      </div>
      <FormInput label={t('admin.material')} value={form.material} onChange={(e) => set('material', e.target.value)} className="sm:col-span-2" />
      <FormInput label={t('admin.rating')} type="number" value={form.rating} onChange={(e) => set('rating', e.target.value)} />
      <FormInput label={t('admin.stock')} type="number" value={form.stock} onChange={(e) => set('stock', e.target.value)} />

      <div className="sm:col-span-2">
        <span className="text-sm font-medium text-foreground/80">{t('admin.tags')}</span>
        <div className="mt-2">
          <TagInput value={form.tags || []} onChange={(v) => set('tags', v)} placeholder={t('admin.tagsPlaceholder')} />
        </div>
      </div>

      <div className="sm:col-span-2">
        <span className="text-sm font-medium text-foreground/80">{t('admin.image')}</span>
        <div className="mt-2 flex items-center gap-4">
          {form.image_url && (
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-mist shrink-0">
              <Image src={form.image_url} alt="preview" fittingType="fill" className="w-full h-full" />
            </div>
          )}
          <div className="flex-1">
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
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
          <input ref={galleryRef} type="file" accept="image/*" multiple onChange={onGalleryFile} className="hidden" />
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

      <div className="sm:col-span-2">
        <OptionsEditor options={form.options || []} onChange={(v) => set('options', v)} />
      </div>
      {(form.options || []).some((o) => o.name) && (
        <div className="sm:col-span-2">
          <VariantTable options={form.options || []} variants={form.variants || []} onChange={(v) => set('variants', v)} />
        </div>
      )}

      <label className="sm:col-span-2 flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} className="w-5 h-5 rounded accent-cosmic" />
        <span className="font-medium">{t('admin.featured')}</span>
      </label>

      <label className="sm:col-span-2 flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={!!form.loyalty_exempt} onChange={(e) => set('loyalty_exempt', e.target.checked)} className="mt-0.5 w-5 h-5 rounded accent-cosmic" />
        <span>
          <span className="font-medium">{t('admin.loyaltyExempt')}</span>
          <span className="block text-xs text-muted-foreground">{t('admin.loyaltyExemptDesc')}</span>
        </span>
      </label>
    </div>
  );
}