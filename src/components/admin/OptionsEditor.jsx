import React, { useRef, useState } from 'react';
import { Plus, X, Upload, Loader2, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/context/LanguageContext';
import { isColorOption } from '@/lib/variants';

// Admin editor for product options (Color, Size, …) and their values, with
// per-value image galleries.
export default function OptionsEditor({ options, onChange }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState('');
  const inputRef = useRef(null);
  const targetRef = useRef(null);

  const update = (oi, patch) =>
    onChange(options.map((o, i) => (i === oi ? { ...o, ...patch } : o)));

  const updateValue = (oi, vi, patch) =>
    update(oi, {
      values: options[oi].values.map((v, j) => (j === vi ? { ...v, ...patch } : v)),
    });

  // Moves an image within a value's gallery (index 0 is the primary image).
  const moveImage = (oi, vi, from, to) => {
    const imgs = [...(options[oi].values[vi].images || [])];
    if (to < 0 || to >= imgs.length) return;
    const [moved] = imgs.splice(from, 1);
    imgs.splice(to, 0, moved);
    updateValue(oi, vi, { images: imgs });
  };

  const pickImages = (oi, vi) => {
    targetRef.current = { oi, vi };
    inputRef.current?.click();
  };

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    const { oi, vi } = targetRef.current || {};
    if (!files.length || oi == null) return;
    setBusy(`${oi}-${vi}`);
    try {
      const urls = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        urls.push(file_url);
      }
      updateValue(oi, vi, { images: [...(options[oi].values[vi].images || []), ...urls] });
    } finally {
      setBusy('');
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="rounded-3xl border border-border/60 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-heading font-bold">{t('variants.optionsTitle')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('variants.optionsDesc')}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...options, { name: '', values: [{ value: '', images: [] }] }])}
          className="squish inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-mist font-heading font-bold text-sm"
        >
          <Plus className="w-4 h-4" /> {t('variants.addOption')}
        </button>
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple onChange={onFiles} className="hidden" />

      <div className="mt-4 space-y-4">
        {options.map((opt, oi) => (
          <div key={oi} className="rounded-2xl bg-mist/60 p-4">
            <div className="flex items-center gap-3">
              <input
                value={opt.name}
                onChange={(e) => update(oi, { name: e.target.value })}
                placeholder={t('variants.optionName')}
                className="flex-1 h-11 px-4 rounded-2xl bg-card border border-border text-sm"
              />
              <button
                type="button"
                onClick={() => onChange(options.filter((_, i) => i !== oi))}
                className="grid place-items-center w-10 h-10 rounded-full bg-destructive/10 text-destructive shrink-0"
                aria-label={t('variants.removeOption')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isColorOption(opt.name) && (
              <p className="mt-2 text-xs text-cosmic font-medium">{t('variants.colorImagesHint')}</p>
            )}

            <div className="mt-3 space-y-3">
              {(opt.values || []).map((val, vi) => (
                <div key={vi} className="rounded-2xl bg-card border border-border/60 p-3">
                  <div className="flex items-center gap-3">
                    <input
                      value={val.value}
                      onChange={(e) => updateValue(oi, vi, { value: e.target.value })}
                      placeholder={t('variants.valueName')}
                      className="flex-1 h-10 px-3 rounded-xl bg-mist border border-border text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => pickImages(oi, vi)}
                      disabled={busy === `${oi}-${vi}`}
                      className="squish inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-mist font-heading font-bold text-xs disabled:opacity-60"
                    >
                      {busy === `${oi}-${vi}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {t('variants.uploadImages')}
                    </button>
                    <button
                      type="button"
                      onClick={() => update(oi, { values: opt.values.filter((_, j) => j !== vi) })}
                      className="grid place-items-center w-9 h-9 rounded-full bg-destructive/10 text-destructive shrink-0"
                      aria-label={t('variants.removeValue')}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {(val.images || []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {val.images.map((url, ii) => (
                        <div key={ii} className="relative w-20 h-20 rounded-xl overflow-hidden bg-mist">
                          <Image src={url} alt="" fittingType="fill" className="w-full h-full" />
                          {ii === 0 ? (
                            <span className="absolute bottom-1 left-1 grid place-items-center w-5 h-5 rounded-full bg-cosmic text-white">
                              <Star className="w-3 h-3 fill-current" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              title={t('variants.setPrimary')}
                              onClick={() =>
                                updateValue(oi, vi, {
                                  images: [url, ...val.images.filter((u) => u !== url)],
                                })
                              }
                              className="absolute bottom-1 left-1 grid place-items-center w-5 h-5 rounded-full bg-black/60 text-white"
                            >
                              <Star className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => updateValue(oi, vi, { images: val.images.filter((_, j) => j !== ii) })}
                            className="absolute top-1 right-1 grid place-items-center w-5 h-5 rounded-full bg-black/60 text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <div className="absolute bottom-1 right-1 flex gap-0.5">
                            <button
                              type="button"
                              onClick={() => moveImage(oi, vi, ii, ii - 1)}
                              disabled={ii === 0}
                              className="grid place-items-center w-5 h-5 rounded-full bg-black/60 text-white disabled:opacity-30"
                              aria-label="Move left"
                            >
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveImage(oi, vi, ii, ii + 1)}
                              disabled={ii === val.images.length - 1}
                              className="grid place-items-center w-5 h-5 rounded-full bg-black/60 text-white disabled:opacity-30"
                              aria-label="Move right"
                            >
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => update(oi, { values: [...(opt.values || []), { value: '', images: [] }] })}
                className="squish inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-card border border-border font-heading font-bold text-xs"
              >
                <Plus className="w-3.5 h-3.5" /> {t('variants.addValue')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}