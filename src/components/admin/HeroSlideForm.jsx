import React, { useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { db } from '@/api/entities';
import { uploadFile } from '@/lib/uploadFile';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import FormInput from '@/components/admin/FormInput';

export default function HeroSlideForm({ initial, onSaved, onCancel }) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const ar = lang === 'ar';
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: initial?.title || '',
    subtitle: initial?.subtitle || '',
    image_url: initial?.image_url || '',
    cta_label: initial?.cta_label || '',
    cta_link: initial?.cta_link || '',
    sort_order: initial?.sort_order ?? 0,
    active: initial?.active !== false,
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await uploadFile(file);
      set('image_url', file_url);
    } catch {
      toast({ title: ar ? 'فشل الرفع' : 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.image_url) {
      toast({ title: ar ? 'الصورة مطلوبة' : 'Image is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = { ...form, sort_order: Number(form.sort_order) || 0 };
    try {
      if (initial?.id) await db.HeroSlide.update(initial.id, payload);
      else await db.HeroSlide.create(payload);
      toast({ title: ar ? 'تم الحفظ' : 'Saved' });
      onSaved();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-3xl bg-card border border-border/60 p-5 sm:p-6 grid sm:grid-cols-2 gap-4">
      <FormInput label={ar ? 'العنوان' : 'Title'} value={form.title} onChange={(e) => set('title', e.target.value)} className="sm:col-span-2" />
      <FormInput label={ar ? 'الوصف' : 'Subtitle'} value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} textarea className="sm:col-span-2" />
      <FormInput label={ar ? 'نص الزر' : 'Button label'} value={form.cta_label} onChange={(e) => set('cta_label', e.target.value)} />
      <FormInput label={ar ? 'رابط الزر' : 'Button link'} value={form.cta_link} onChange={(e) => set('cta_link', e.target.value)} placeholder="/product/123" />
      <FormInput label={ar ? 'الترتيب' : 'Order'} type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />

      <div className="sm:col-span-2">
        <span className="text-sm font-medium text-foreground/80">{ar ? 'الصورة' : 'Image'}</span>
        <div className="mt-2 flex items-center gap-4">
          {form.image_url && (
            <div className="relative w-28 h-20 rounded-2xl overflow-hidden bg-mist shrink-0">
              <Image src={form.image_url} alt="preview" fittingType="fill" className="w-full h-full" />
              <button type="button" onClick={() => set('image_url', '')} className="absolute top-1 right-1 grid place-items-center w-6 h-6 rounded-full bg-black/60 text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex-1">
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-mist font-heading font-bold text-sm disabled:opacity-60">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {ar ? 'رفع صورة' : 'Upload image'}
            </button>
            <input value={form.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="https://..." className="mt-3 w-full h-11 px-4 rounded-2xl bg-mist border border-border text-sm" />
          </div>
        </div>
      </div>

      <label className="sm:col-span-2 flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} className="w-5 h-5 rounded accent-cosmic" />
        <span className="font-medium">{ar ? 'مرئي على الصفحة الرئيسية' : 'Visible on homepage'}</span>
      </label>

      <div className="sm:col-span-2 flex gap-3">
        <button type="submit" disabled={saving} className="squish flex-1 h-12 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {ar ? 'حفظ' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="squish h-12 px-6 rounded-full bg-mist font-heading font-bold">
          {ar ? 'إلغاء' : 'Cancel'}
        </button>
      </div>
    </form>
  );
}