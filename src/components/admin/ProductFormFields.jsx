import React, { useRef, useState } from 'react';
import { X, Loader2, Upload, AlertTriangle } from 'lucide-react';
import { uploadFile } from '@/lib/uploadFile';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import SheetSelect from '@/components/ui/SheetSelect';
import TagInput from '@/components/TagInput';
import OptionsEditor from '@/components/admin/OptionsEditor';
import VariantTable from '@/components/admin/VariantTable';
import FormInput from '@/components/admin/FormInput';
import ProductImageManager from '@/components/admin/ProductImageManager';
import FeatureListEditor from '@/components/admin/FeatureListEditor';
import { useCategories } from '@/context/CategoryContext';
import { PRODUCT_AGE_OPTIONS } from '@/lib/ages';
import { GENDER_MALE, GENDER_FEMALE, GENDER_BOTH } from '@/lib/gender';
import { categoryName } from '@/lib/bilingual';
import CategoryMultiSelect from '@/components/admin/CategoryMultiSelect';

export const CATEGORIES = [
  'Build & Create',
  'Plush & Soft',
  'Vehicles & Motion',
  'Early Years',
  'Pretend Play',
  'Arts & Crafts',
];

export default function ProductFormFields({ form, set, isNew }) {
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const { categories } = useCategories();
  const categoryOptions = (categories && categories.length ? categories.map((c) => c.name) : CATEGORIES);
  // Real category rows (with real ids) for the multi-category pickers below —
  // separate from `categoryOptions` above (name strings, kept only for the
  // legacy "no live categories loaded" fallback and unrelated to this).
  const realCategories = categories && categories.length ? categories : [];

  // Changing the Primary Category: the new primary is removed from
  // Additional Categories if it was already picked there (no duplicate
  // membership), and — per the "changing primary is safe" rule — the
  // *previous* primary is preserved as an Additional Category instead of
  // being silently dropped, unless the admin explicitly removes it
  // afterwards.
  const onPrimaryCategoryChange = (id) => {
    // No live category rows loaded (rare — the categories table is normally
    // always populated): fall back to the old plain-name behavior rather
    // than treating `id` as a real category id it isn't.
    if (!realCategories.length) { set('category', id); return; }
    const prevPrimary = form.primary_category_id;
    let nextAdditional = (form.category_ids || []).filter((x) => x !== id);
    if (prevPrimary && prevPrimary !== id && !nextAdditional.includes(prevPrimary)) {
      nextAdditional = [...nextAdditional, prevPrimary];
    }
    set('category_ids', nextAdditional);
    set('primary_category_id', id);
    const picked = realCategories.find((c) => c.id === id);
    if (picked) set('category', picked.name); // keeps the legacy text mirror in sync
  };
  const [uploading, setUploading] = useState(false);
  const videoRef = useRef(null);

  // The product's images are stored as two columns (`image_url` = main,
  // `images[]` = the rest) but always managed here as one ordered array so
  // dragging an image into slot 0 really does make it the main image; saved
  // back into the two columns on every change (see onImagesChange below).
  const allImages = [form.image_url, ...(form.images || [])].filter(Boolean);
  const onImagesChange = (next) => {
    set('image_url', next[0] || '');
    set('images', next.slice(1));
  };

  const upload = async (file) => {
    const { file_url } = await uploadFile(file);
    return file_url;
  };
  const fail = () => toast({ title: lang === 'ar' ? 'فشل الرفع' : 'Upload failed', variant: 'destructive' });

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
      <FormInput label={ar ? 'الاسم (إنجليزي) — اختياري' : 'Name (English) — optional'} value={form.name_en || ''} onChange={(e) => set('name_en', e.target.value)} dir="ltr" className="sm:col-span-2" />
      <FormInput label={ar ? 'الوصف (عربي) — مطلوب' : 'Description (Arabic) — required'} value={form.description} onChange={(e) => set('description', e.target.value)} textarea required className="sm:col-span-2" />
      <FormInput label={ar ? 'الوصف (إنجليزي) — اختياري' : 'Description (English) — optional'} value={form.description_en || ''} onChange={(e) => set('description_en', e.target.value)} textarea dir="ltr" className="sm:col-span-2" />

      {/* Features — short highlight phrases, kept separate from Description.
          Two independent lists (features_ar/features_en); both optional. */}
      <div className="sm:col-span-2">
        <span className="text-sm font-medium text-foreground/80">{t('admin.featuresAr')}</span>
        <div className="mt-2">
          <FeatureListEditor
            items={form.features_ar}
            onChange={(v) => set('features_ar', v)}
            dir="rtl"
            placeholder={t('admin.featurePlaceholder')}
            addLabel={t('admin.addFeature')}
            droppableId="features-ar"
          />
        </div>
      </div>
      <div className="sm:col-span-2">
        <span className="text-sm font-medium text-foreground/80">{t('admin.featuresEn')}</span>
        <div className="mt-2">
          <FeatureListEditor
            items={form.features_en}
            onChange={(v) => set('features_en', v)}
            dir="ltr"
            placeholder="e.g. Helps develop focus"
            addLabel={t('admin.addFeature')}
            droppableId="features-en"
          />
        </div>
      </div>

      <FormInput label={t('admin.price')} type="number" value={form.price} onChange={(e) => set('price', e.target.value)} required />
      <FormInput label={t('admin.salePrice')} type="number" value={form.sale_price} onChange={(e) => set('sale_price', e.target.value)} />
      <FormInput label={t('admin.unitCost')} type="number" value={form.unit_cost} onChange={(e) => set('unit_cost', e.target.value)} />
      <FormInput label={t('admin.barcode')} value={form.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="—" dir="ltr" />
      {/* Stable business identifier — separate from Barcode/SKU. Blank on a
          new product auto-generates HK-000001-style on save (server-side,
          race-safe); an existing product always has one already. */}
      <FormInput
        label={t('admin.productCode')}
        value={form.product_code}
        onChange={(e) => set('product_code', e.target.value)}
        placeholder={isNew ? t('admin.productCodePlaceholder') : '—'}
        dir="ltr"
      />
      <label className="block">
        <span className="text-sm font-medium text-foreground/80">{t('admin.primaryCategory')}</span>
        <SheetSelect
          value={form.primary_category_id || ''}
          onChange={onPrimaryCategoryChange}
          placeholder={t('admin.primaryCategory')}
          label={t('admin.primaryCategory')}
          includeEmpty={false}
          className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40"
          options={realCategories.length
            ? realCategories.map((c) => ({ value: c.id, label: categoryName(c, lang) }))
            : categoryOptions.map((c) => ({ value: c, label: c }))}
        />
      </label>

      {realCategories.length > 0 && (
        <div className="sm:col-span-2">
          <span className="text-sm font-medium text-foreground/80">{t('admin.additionalCategories')}</span>
          <p className="mt-1 text-xs text-muted-foreground">{t('admin.categoryHelper')}</p>
          <div className="mt-2">
            <CategoryMultiSelect
              categories={realCategories}
              selectedIds={form.category_ids || []}
              onChange={(ids) => set('category_ids', ids)}
              excludeId={form.primary_category_id}
            />
          </div>
        </div>
      )}
      <div className="sm:col-span-2">
        <span className="text-sm font-medium text-foreground/80">{t('admin.ageRange')}</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRODUCT_AGE_OPTIONS.map((o) => {
            const arr = form.ages || [];
            const active = arr.includes(o.id);
            return (
              <button
                type="button"
                key={o.id}
                onClick={() => set('ages', active ? arr.filter((x) => x !== o.id) : [...arr, o.id])}
                className={`squish h-10 px-4 rounded-full text-sm font-medium transition-colors ${
                  active ? 'bg-cosmic text-white' : 'bg-mist text-foreground/70 hover:bg-accent/20'
                }`}
              >
                {t(`age.${o.id}`)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="sm:col-span-2">
        <span className="text-sm font-medium text-foreground/80">{t('admin.gender')}</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {/* Single canonical value ('male' | 'female' | 'both' | null) —
              mutually exclusive, not combinable tags. Clicking the already-
              active option clears it back to null ("not yet classified")
              rather than forcing a guess; see the storefront filter, which
              deliberately excludes null from Boys-only/Girls-only results
              instead of treating it as "both". */}
          {[
            { value: GENDER_MALE, label: t('gender.boys') },
            { value: GENDER_FEMALE, label: t('gender.girls') },
            { value: GENDER_BOTH, label: t('gender.both') },
          ].map((opt) => {
            const active = form.gender === opt.value;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => set('gender', active ? null : opt.value)}
                className={`squish h-10 px-4 rounded-full text-sm font-medium transition-colors ${
                  active ? 'bg-cosmic text-white' : 'bg-mist text-foreground/70 hover:bg-accent/20'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {!form.gender && (
          <p className="mt-2 text-xs text-accent inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {ar
              ? 'لم يُصنَّف بعد — لن يظهر ضمن فلتر أولاد أو بنات حتى يُحدَّد'
              : 'Not classified yet — won’t appear in the Boys or Girls filter until set'}
          </p>
        )}
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
        <ProductImageManager images={allImages} onChange={onImagesChange} />
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
            <input value={form.video_url} onChange={(e) => set('video_url', e.target.value)} placeholder="https://...mp4" dir="ltr" className="mt-3 w-full h-11 px-4 rounded-2xl bg-mist border border-border text-sm" />
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