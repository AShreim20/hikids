import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Upload, X, Eye, ImageIcon, Video } from 'lucide-react';
import { db } from '@/api/entities';
import { uploadFile } from '@/lib/uploadFile';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import FormInput from '@/components/admin/FormInput';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '@/components/admin/UnsavedChangesDialog';
import { snapshotsEqual } from '@/lib/formDirty';
import { saveDraft, loadDraft, clearDraft, savePreviewSnapshot } from '@/lib/sessionDraft';
import { slideStatus } from '@/lib/heroVisibility';

const QUICK_DURATIONS = [3, 5, 7, 10];

const EMPTY = {
  title: '', subtitle: '', cta_label: '', cta_link: '',
  secondary_cta_label: '', secondary_cta_link: '',
  image_url: '', media_type: 'image',
  mobile_image_url: '', mobile_media_type: null,
  focal_position: 'center',
  content_position: 'center', vertical_position: 'center',
  overlay_strength: 'medium', text_color: 'auto',
  duration_seconds: 5, video_duration_mode: 'custom',
  active: true, display_start: '', display_end: '',
  sort_order: 0,
};

// Local <-> UTC-ish string helpers for the plain datetime-local inputs —
// stored as a full timestamptz, edited as the browser's local wall-clock
// time (what a non-technical admin actually thinks in).
const toInputValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromInputValue = (v) => (v ? new Date(v).toISOString() : null);

function slideToForm(s) {
  return {
    title: s.title || '', subtitle: s.subtitle || '',
    cta_label: s.cta_label || '', cta_link: s.cta_link || '',
    secondary_cta_label: s.secondary_cta_label || '', secondary_cta_link: s.secondary_cta_link || '',
    image_url: s.image_url || '', media_type: s.media_type || 'image',
    mobile_image_url: s.mobile_image_url || '', mobile_media_type: s.mobile_media_type || null,
    focal_position: s.focal_position || 'center',
    content_position: s.content_position || 'center', vertical_position: s.vertical_position || 'center',
    overlay_strength: s.overlay_strength || 'medium', text_color: s.text_color || 'auto',
    duration_seconds: s.duration_seconds ?? 5, video_duration_mode: s.video_duration_mode || 'custom',
    active: s.active !== false,
    display_start: toInputValue(s.display_start), display_end: toInputValue(s.display_end),
    sort_order: s.sort_order ?? 0,
  };
}

// Three-option pill group — reused for every Right/Center/Left,
// Top/Center/Bottom, overlay strength, and text color control below, so the
// whole DESIGN section reads consistently.
function PillGroup({ options, value, onChange }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`squish h-10 px-4 rounded-full text-sm font-medium transition-colors ${
            value === o.value ? 'bg-cosmic text-white' : 'bg-mist text-foreground/70 hover:bg-accent/20'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl bg-mist/50 p-4 sm:p-5">
      <h3 className="font-heading font-bold text-sm uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

// One Desktop/Mobile media picker — upload (image or video), or paste a URL,
// with a small preview and remove button. Kept generic so it renders both
// the required Desktop Media and the optional Mobile Media block below.
function MediaPicker({ ar, url, mediaType, onUrl, onType, uploading, onUpload, allowClear }) {
  const fileRef = useRef(null);
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => onType('image')}
          className={`squish inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-heading font-bold ${mediaType !== 'video' ? 'bg-cosmic text-white' : 'bg-mist text-foreground/70'}`}
        >
          <ImageIcon className="w-3.5 h-3.5" /> {ar ? 'صورة' : 'Image'}
        </button>
        <button
          type="button"
          onClick={() => onType('video')}
          className={`squish inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-heading font-bold ${mediaType === 'video' ? 'bg-cosmic text-white' : 'bg-mist text-foreground/70'}`}
        >
          <Video className="w-3.5 h-3.5" /> {ar ? 'فيديو' : 'Video'}
        </button>
      </div>
      <div className="flex items-center gap-4">
        {url && (
          <div className="relative w-28 h-20 rounded-2xl overflow-hidden bg-card shrink-0">
            {mediaType === 'video' ? (
              <video src={url} className="w-full h-full object-cover" muted />
            ) : (
              <Image src={url} alt="preview" fittingType="fill" className="w-full h-full" />
            )}
            {allowClear && (
              <button type="button" onClick={() => onUrl('')} className="absolute top-1 right-1 grid place-items-center w-6 h-6 rounded-full bg-black/60 text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <input
            ref={fileRef}
            type="file"
            accept={mediaType === 'video' ? 'video/mp4,video/webm' : 'image/*'}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }}
            className="hidden"
          />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-card border border-border font-heading font-bold text-sm disabled:opacity-60">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {ar ? 'رفع ملف' : 'Upload file'}
          </button>
          <input
            value={url}
            onChange={(e) => onUrl(e.target.value)}
            placeholder="https://..."
            dir="ltr"
            className="mt-3 w-full h-11 px-4 rounded-2xl bg-card border border-border text-sm"
          />
        </div>
      </div>
    </div>
  );
}

export default function HeroSlideForm({ initial, onSaved, onCancel }) {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const isNew = !initial?.id;
  const draftId = isNew ? 'new' : initial.id;

  const baselineRef = useRef(EMPTY);
  const [form, setForm] = useState(() => {
    const server = initial ? slideToForm(initial) : EMPTY;
    baselineRef.current = server;
    const draft = loadDraft('hero_slide', draftId);
    return draft?.data ? { ...server, ...draft.data } : server;
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customDuration, setCustomDuration] = useState(!QUICK_DURATIONS.includes(Number(form.duration_seconds)));

  const isDirty = useMemo(() => !snapshotsEqual(form, baselineRef.current), [form]);
  useEffect(() => {
    if (!isDirty) return;
    const t = setTimeout(() => saveDraft('hero_slide', draftId, form), 400);
    return () => clearTimeout(t);
  }, [form, isDirty, draftId]);
  const { confirmOpen, stay, leave } = useUnsavedChangesGuard(isDirty, () => clearDraft('hero_slide', draftId));

  const upload = async (file, which) => {
    const setUploading = which === 'mobile' ? setUploadingMobile : setUploadingDesktop;
    setUploading(true);
    try {
      const { file_url } = await uploadFile(file);
      set(which === 'mobile' ? 'mobile_image_url' : 'image_url', file_url);
    } catch {
      toast({ title: ar ? 'فشل الرفع' : 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const buildPayload = () => {
    const durationNum = Math.min(30, Math.max(2, Math.round(Number(form.duration_seconds)) || 5));
    return {
      title: form.title || null,
      subtitle: form.subtitle || null,
      cta_label: form.cta_label || null,
      cta_link: form.cta_link || null,
      secondary_cta_label: form.secondary_cta_label || null,
      secondary_cta_link: form.secondary_cta_link || null,
      image_url: form.image_url,
      media_type: form.media_type,
      mobile_image_url: form.mobile_image_url || null,
      mobile_media_type: form.mobile_image_url ? form.mobile_media_type : null,
      focal_position: form.focal_position,
      content_position: form.content_position,
      vertical_position: form.vertical_position,
      overlay_strength: form.overlay_strength,
      text_color: form.text_color,
      duration_seconds: durationNum,
      video_duration_mode: form.media_type === 'video' ? form.video_duration_mode : 'custom',
      active: !!form.active,
      display_start: fromInputValue(form.display_start),
      display_end: fromInputValue(form.display_end),
      sort_order: Number(form.sort_order) || 0,
    };
  };

  const preview = () => {
    savePreviewSnapshot(draftId, { ...buildPayload(), id: isNew ? null : initial.id }, 'hero_slide');
    window.open(`/admin/hero-slide-preview/${draftId}`, '_blank', 'noopener');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.image_url) {
      toast({ title: ar ? 'الوسائط الرئيسية مطلوبة' : 'Desktop Media is required', variant: 'destructive' });
      return;
    }
    const durationNum = Number(form.duration_seconds);
    if (!Number.isFinite(durationNum) || durationNum < 2 || durationNum > 30) {
      toast({ title: ar ? 'مدة الشريحة يجب أن تكون بين 2 و30 ثانية' : 'Slide duration must be between 2 and 30 seconds', variant: 'destructive' });
      return;
    }
    if (form.display_start && form.display_end && new Date(form.display_start) > new Date(form.display_end)) {
      toast({ title: ar ? 'تاريخ البدء يجب أن يسبق تاريخ الانتهاء' : 'Display Start must be before Display End', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = buildPayload();
    try {
      if (initial?.id) await db.HeroSlide.update(initial.id, payload);
      else await db.HeroSlide.create(payload);
      toast({ title: ar ? 'تم الحفظ' : 'Saved' });
      clearDraft('hero_slide', draftId);
      onSaved();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    clearDraft('hero_slide', draftId);
    onCancel();
  };

  const status = slideStatus({ active: form.active, display_start: fromInputValue(form.display_start), display_end: fromInputValue(form.display_end) });
  const STATUS_LABEL = {
    active: ar ? 'نشطة' : 'Active', inactive: ar ? 'غير مفعلة' : 'Inactive',
    scheduled: ar ? 'مجدولة' : 'Scheduled', expired: ar ? 'منتهية' : 'Expired',
  };
  const STATUS_CLASS = {
    active: 'bg-cosmic/10 text-cosmic', inactive: 'bg-mist text-muted-foreground',
    scheduled: 'bg-accent/15 text-accent', expired: 'bg-destructive/10 text-destructive',
  };

  const posOptions = (map) => Object.entries(map).map(([value, label]) => ({ value, label }));
  const CONTENT_POS = posOptions({ right: ar ? 'يمين' : 'Right', center: ar ? 'وسط' : 'Center', left: ar ? 'يسار' : 'Left' });
  const VERTICAL_POS = posOptions({ top: ar ? 'أعلى' : 'Top', center: ar ? 'وسط' : 'Center', bottom: ar ? 'أسفل' : 'Bottom' });
  const FOCAL_POS = posOptions({ left: ar ? 'يسار' : 'Left', center: ar ? 'وسط' : 'Center', right: ar ? 'يمين' : 'Right' });
  const OVERLAY_OPTS = posOptions({ none: ar ? 'بدون' : 'None', light: ar ? 'خفيف' : 'Light', medium: ar ? 'متوسط' : 'Medium', strong: ar ? 'قوي' : 'Strong' });
  const TEXT_COLOR_OPTS = posOptions({ auto: ar ? 'تلقائي' : 'Auto', light: ar ? 'فاتح' : 'Light', dark: ar ? 'داكن' : 'Dark' });

  return (
    <form onSubmit={submit} className="rounded-3xl bg-card border border-border/60 p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-heading font-bold text-lg">{isNew ? (ar ? 'شريحة جديدة' : 'New slide') : (ar ? 'تعديل الشريحة' : 'Edit slide')}</h2>
        {!isNew && (
          <span className={`px-3 py-1 rounded-full text-xs font-heading font-bold ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
        )}
      </div>

      <Section title={ar ? 'المحتوى' : 'Content'}>
        <FormInput label={ar ? 'العنوان' : 'Title'} value={form.title} onChange={(e) => set('title', e.target.value)} />
        <FormInput label={ar ? 'الوصف المختصر' : 'Short description'} value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} textarea />
        <div className="grid sm:grid-cols-2 gap-4">
          <FormInput label={ar ? 'نص الزر الرئيسي' : 'Primary CTA text'} value={form.cta_label} onChange={(e) => set('cta_label', e.target.value)} placeholder={ar ? 'تسوق الآن' : 'Shop Now'} />
          <FormInput label={ar ? 'رابط الزر الرئيسي' : 'Primary CTA destination'} value={form.cta_link} onChange={(e) => set('cta_link', e.target.value)} placeholder="/shop" dir="ltr" />
          <FormInput label={ar ? 'نص الزر الثانوي (اختياري)' : 'Secondary CTA text (optional)'} value={form.secondary_cta_label} onChange={(e) => set('secondary_cta_label', e.target.value)} />
          <FormInput label={ar ? 'رابط الزر الثانوي (اختياري)' : 'Secondary CTA destination (optional)'} value={form.secondary_cta_link} onChange={(e) => set('secondary_cta_link', e.target.value)} placeholder="/shop" dir="ltr" />
        </div>
      </Section>

      <Section title={ar ? 'الوسائط' : 'Media'}>
        <div>
          <span className="text-sm font-medium text-foreground/80">{ar ? 'وسائط سطح المكتب' : 'Desktop Media'} <span className="text-accent">*</span></span>
          {form.media_type === 'video' && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {ar
                ? 'فيديو سطح المكتب — نسبة العرض الموصى بها: 16:5. يمكن رفع فيديوهات 16:9 وسيتم قصها تلقائيًا لتناسب مساحة العرض.'
                : 'Desktop Video — recommended display ratio: 16:5. Videos such as 16:9 are supported and will be automatically cropped to fit.'}
            </p>
          )}
          <div className="mt-2">
            <MediaPicker
              ar={ar} url={form.image_url} mediaType={form.media_type}
              onUrl={(v) => set('image_url', v)} onType={(v) => set('media_type', v)}
              uploading={uploadingDesktop} onUpload={(f) => upload(f, 'desktop')}
            />
          </div>
        </div>
        <div>
          <span className="text-sm font-medium text-foreground/80">{ar ? 'وسائط الجوال (اختياري)' : 'Mobile Media (Optional)'}</span>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ar ? 'إن لم تُحدَّد، تُستخدم وسائط سطح المكتب على الجوال تلقائيًا.' : 'If not set, Desktop Media is used on mobile automatically.'}
          </p>
          <div className="mt-2">
            <MediaPicker
              ar={ar} url={form.mobile_image_url} mediaType={form.mobile_media_type || form.media_type}
              onUrl={(v) => set('mobile_image_url', v)} onType={(v) => set('mobile_media_type', v)}
              uploading={uploadingMobile} onUpload={(f) => upload(f, 'mobile')} allowClear
            />
          </div>
        </div>
        <div>
          <span className="text-sm font-medium text-foreground/80">{ar ? 'موضع الصورة' : 'Media Focal Position'}</span>
          <PillGroup options={FOCAL_POS} value={form.focal_position} onChange={(v) => set('focal_position', v)} />
        </div>
      </Section>

      <Section title={ar ? 'التصميم' : 'Design'}>
        <div>
          <span className="text-sm font-medium text-foreground/80">{ar ? 'موضع المحتوى' : 'Content Position'}</span>
          <PillGroup options={CONTENT_POS} value={form.content_position} onChange={(v) => set('content_position', v)} />
        </div>
        <div>
          <span className="text-sm font-medium text-foreground/80">{ar ? 'الموضع العمودي' : 'Vertical Position'}</span>
          <PillGroup options={VERTICAL_POS} value={form.vertical_position} onChange={(v) => set('vertical_position', v)} />
        </div>
        <div>
          <span className="text-sm font-medium text-foreground/80">{ar ? 'قوة التعتيم خلف النص' : 'Content Overlay'}</span>
          <PillGroup options={OVERLAY_OPTS} value={form.overlay_strength} onChange={(v) => set('overlay_strength', v)} />
        </div>
        <div>
          <span className="text-sm font-medium text-foreground/80">{ar ? 'لون النص' : 'Text Color'}</span>
          <PillGroup options={TEXT_COLOR_OPTS} value={form.text_color} onChange={(v) => set('text_color', v)} />
        </div>
      </Section>

      <Section title={ar ? 'العرض' : 'Display'}>
        <div>
          <span className="text-sm font-medium text-foreground/80">{ar ? 'مدة عرض الشريحة (بالثواني)' : 'Slide Duration (seconds)'}</span>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {QUICK_DURATIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { setCustomDuration(false); set('duration_seconds', n); }}
                className={`squish h-10 px-4 rounded-full text-sm font-medium transition-colors ${
                  !customDuration && Number(form.duration_seconds) === n ? 'bg-cosmic text-white' : 'bg-mist text-foreground/70 hover:bg-accent/20'
                }`}
              >
                {n} {ar ? 'ثوانٍ' : 's'}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustomDuration(true)}
              className={`squish h-10 px-4 rounded-full text-sm font-medium transition-colors ${customDuration ? 'bg-cosmic text-white' : 'bg-mist text-foreground/70 hover:bg-accent/20'}`}
            >
              {ar ? 'مخصص' : 'Custom'}
            </button>
            {customDuration && (
              <input
                type="number" min={2} max={30} step={1}
                value={form.duration_seconds}
                onChange={(e) => set('duration_seconds', e.target.value)}
                className="w-24 h-10 px-3 rounded-2xl bg-mist border border-border text-sm"
              />
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{ar ? 'من 2 إلى 30 ثانية.' : 'Between 2 and 30 seconds.'}</p>
        </div>

        {form.media_type === 'video' && (
          <div>
            <span className="text-sm font-medium text-foreground/80">{ar ? 'مدة الفيديو' : 'Video Duration'}</span>
            <PillGroup
              options={[
                { value: 'auto', label: ar ? 'تلقائي حسب مدة الفيديو' : 'Auto — Video Duration' },
                { value: 'custom', label: ar ? 'مدة مخصصة' : 'Custom Duration' },
              ]}
              value={form.video_duration_mode}
              onChange={(v) => set('video_duration_mode', v)}
            />
          </div>
        )}

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} className="w-5 h-5 rounded accent-cosmic" />
          <span className="font-medium">{ar ? 'تفعيل الشريحة' : 'Active Slide'}</span>
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <FormInput label={ar ? 'تاريخ بدء العرض (اختياري)' : 'Display Start (optional)'} type="datetime-local" value={form.display_start} onChange={(e) => set('display_start', e.target.value)} dir="ltr" />
          <FormInput label={ar ? 'تاريخ انتهاء العرض (اختياري)' : 'Display End (optional)'} type="datetime-local" value={form.display_end} onChange={(e) => set('display_end', e.target.value)} dir="ltr" />
        </div>
      </Section>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={saving} className="squish flex-1 min-w-[45%] h-12 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {ar ? 'حفظ' : 'Save'}
        </button>
        <button type="button" onClick={preview} className="squish flex-1 min-w-[45%] h-12 rounded-full bg-mist font-heading font-bold inline-flex items-center justify-center gap-2">
          <Eye className="w-4 h-4" /> {ar ? 'معاينة' : 'Preview'}
        </button>
        <button type="button" onClick={cancel} className="squish h-12 px-6 rounded-full bg-mist font-heading font-bold">
          {ar ? 'إلغاء' : 'Cancel'}
        </button>
      </div>

      <UnsavedChangesDialog open={confirmOpen} onStay={stay} onLeave={leave} />
    </form>
  );
}
