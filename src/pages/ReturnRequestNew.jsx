import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, Package, Lock, ImagePlus, X } from 'lucide-react';
import { db } from '@/api/entities';
import { submitReturnRequest } from '@/lib/returnFunctions';
import { uploadFile } from '@/lib/uploadFile';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { lineItemName } from '@/lib/bilingual';
import {
  getReturnEligibility, formatTimeRemaining, remainingQuantityByItemIndex,
  reasonName, reasonDescription, deliveryResponsibilityLabel, REQUEST_TYPE_LABEL,
} from '@/lib/returns';

const STEPS = [1, 2, 3, 4, 5];

export default function ReturnRequestNew() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { t, lang, formatPrice } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const ar = lang === 'ar';

  const [order, setOrder] = useState(null);
  const [reasons, setReasons] = useState([]);
  const [myItems, setMyItems] = useState([]); // this order's return_request_items, each with `_status` merged in
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState({}); // { [order_item_index]: quantity }
  const [requestType, setRequestType] = useState('return');
  const [reasonId, setReasonId] = useState('');
  const [explanation, setExplanation] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState([]); // [{ file, preview, url, uploading }]
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Stable for the lifetime of this wizard instance — a double-click or a
  // network retry on the final submit reuses the same key, so the backend
  // returns the original request instead of creating a second one.
  const idempotencyKey = useRef(crypto.randomUUID()).current;

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      db.Order.get(orderId).catch(() => null),
      db.ReturnReason.list('sort_order', 200).catch(() => []),
      db.ReturnRequestItem.filter({ order_id: orderId }).catch(() => []),
      db.ReturnRequest.filter({ order_id: orderId }).catch(() => []),
    ]).then(([o, rs, items, requests]) => {
      setOrder(o);
      setReasons((rs || []).filter((r) => r.active));
      const statusById = Object.fromEntries((requests || []).map((r) => [r.id, r.status]));
      setMyItems((items || []).map((it) => ({ ...it, _status: statusById[it.return_request_id] })));
    }).finally(() => setLoading(false));
  }, [orderId, user]);

  const eligibility = useMemo(() => (order ? getReturnEligibility(order) : { eligible: false }), [order]);
  const remaining = useMemo(
    () => (order ? remainingQuantityByItemIndex(order, myItems) : []),
    [order, myItems]
  );
  const selectedReason = useMemo(() => reasons.find((r) => r.id === reasonId) || null, [reasons, reasonId]);

  const allowedTypes = useMemo(() => {
    if (!selectedReason) return ['return', 'exchange'];
    return ['return', 'exchange'].filter((tKey) =>
      tKey === 'return' ? selectedReason.allow_return : selectedReason.allow_exchange
    );
  }, [selectedReason]);

  // If a reason with no "traditional" return/exchange support is chosen
  // (missing item/part only), there is no real request_type choice — default
  // to 'return' as the closest umbrella category (see completion report:
  // Phase 1's request_type column only allows return/exchange, resolution
  // nuance lives in resolution_type instead) without implying the customer
  // must physically return something they never received.
  const resolutionType = useMemo(() => {
    if (!selectedReason) return null;
    if (allowedTypes.length === 0) {
      if (selectedReason.allow_missing_item) return 'missing_item';
      if (selectedReason.allow_missing_part) return 'missing_part';
    }
    return null;
  }, [selectedReason, allowedTypes]);

  useEffect(() => {
    if (allowedTypes.length && !allowedTypes.includes(requestType)) setRequestType(allowedTypes[0]);
  }, [allowedTypes]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedIndexes = Object.keys(selected).map(Number).filter((i) => selected[i] > 0);
  const evidenceUrls = evidenceFiles.filter((f) => f.url).map((f) => f.url);
  const evidenceReady = evidenceFiles.every((f) => f.url && !f.uploading);

  const canContinueStep1 = selectedIndexes.length > 0;
  const canContinueStep2 = !!reasonId && (resolutionType || allowedTypes.includes(requestType));
  const canContinueStep3 = evidenceReady && (
    !selectedReason?.evidence_required || evidenceUrls.length >= selectedReason.evidence_min_images
  );

  const toggleItem = (idx, maxQty) => {
    setSelected((s) => {
      const next = { ...s };
      if (next[idx]) delete next[idx];
      else next[idx] = Math.min(1, maxQty);
      return next;
    });
  };
  const setQty = (idx, qty, maxQty) => {
    setSelected((s) => ({ ...s, [idx]: Math.max(1, Math.min(qty, maxQty)) }));
  };

  const addPhotos = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    const max = selectedReason?.evidence_max_images ?? 5;
    const room = Math.max(0, max - evidenceFiles.length);
    if (room <= 0) {
      toast({ title: ar ? `الحد الأقصى ${max} صور` : `Maximum ${max} photos`, variant: 'destructive' });
      return;
    }
    const toAdd = files.slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file), url: null, uploading: true }));
    setEvidenceFiles((prev) => [...prev, ...toAdd]);
    for (const entry of toAdd) {
      try {
        const { file_url } = await uploadFile(entry.file, { bucket: 'customer-uploads', folder: 'returns', ownerId: user.id });
        setEvidenceFiles((prev) => prev.map((f) => (f === entry ? { ...f, url: file_url, uploading: false } : f)));
      } catch {
        setEvidenceFiles((prev) => prev.filter((f) => f !== entry));
        toast({ title: ar ? 'تعذّر رفع إحدى الصور' : 'One of the photos failed to upload', variant: 'destructive' });
      }
    }
  };
  const removePhoto = (entry) => setEvidenceFiles((prev) => prev.filter((f) => f !== entry));

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const items = selectedIndexes.map((idx) => ({ order_item_index: idx, requested_quantity: selected[idx] }));
      const res = await submitReturnRequest({
        orderId, requestType, reasonId, customerNote: explanation, resolutionType,
        evidenceUrls, items, idempotencyKey,
      });
      if (!res?.success) {
        toast({ title: res?.message || t('returns.error'), variant: 'destructive' });
        return;
      }
      setResult(res);
      setStep(5);
    } catch (err) {
      toast({ title: err.message || t('returns.error'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={t('returns.startAction')} />
        <div className="max-w-md mx-auto px-5 py-24 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-mist"><Lock className="w-8 h-8 text-muted-foreground" /></div>
          <h1 className="mt-6 font-heading font-extrabold text-2xl">{t('orders.signIn')}</h1>
          <Link to="/login" className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">{t('settings.signIn')}</Link>
        </div>
        <Footer />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={t('returns.startAction')} />
        <div className="grid place-items-center py-32"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        <Footer />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={t('returns.startAction')} />
        <div className="max-w-md mx-auto px-5 py-24 text-center">
          <p className="font-heading font-bold text-xl">{t('returns.orderNotFound')}</p>
          <Link to="/orders" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">{t('orders.title')}</Link>
        </div>
        <Footer />
      </div>
    );
  }

  if (!eligibility.eligible && step !== 5) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={t('returns.startAction')} />
        <div className="max-w-md mx-auto px-5 py-24 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-mist"><Package className="w-8 h-8 text-muted-foreground" /></div>
          <p className="mt-6 font-heading font-bold text-xl">{t('returns.windowClosed')}</p>
          <Link to="/orders" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">{t('orders.title')}</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const remainingLabel = eligibility.deadline ? formatTimeRemaining(eligibility.deadline, lang) : null;

  return (
    <div className="min-h-screen bg-background pb-32">
      <PageHeader title={t('returns.startAction')} />
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-10">
        {step < 5 && (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              {t('returns.orderNumber')} #{(order.id || '').slice(-8).toUpperCase()}
              {remainingLabel && <span className="text-accent font-heading font-bold"> · {remainingLabel}</span>}
            </p>
            <div className="mt-3 flex items-center gap-1.5">
              {STEPS.slice(0, 4).map((s) => (
                <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-cosmic' : 'bg-mist'}`} />
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <StepSelectItems
            order={order} remaining={remaining} selected={selected}
            toggleItem={toggleItem} setQty={setQty} lang={lang} formatPrice={formatPrice} t={t}
          />
        )}
        {step === 2 && (
          <StepTypeReason
            reasons={reasons} reasonId={reasonId} setReasonId={setReasonId}
            requestType={requestType} setRequestType={setRequestType}
            allowedTypes={allowedTypes} resolutionType={resolutionType}
            selectedReason={selectedReason} lang={lang} t={t}
          />
        )}
        {step === 3 && (
          <StepEvidence
            selectedReason={selectedReason} evidenceFiles={evidenceFiles}
            addPhotos={addPhotos} removePhoto={removePhoto}
            explanation={explanation} setExplanation={setExplanation}
            lang={lang} t={t}
          />
        )}
        {step === 4 && (
          <StepReview
            order={order} selected={selected} requestType={requestType} resolutionType={resolutionType}
            selectedReason={selectedReason} explanation={explanation} evidenceFiles={evidenceFiles}
            lang={lang} formatPrice={formatPrice} t={t}
          />
        )}
        {step === 5 && result && (
          <StepSuccess result={result} order={order} t={t} navigate={navigate} />
        )}

        {step < 5 && (
          <div className="mt-8 flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="h-12 px-6 rounded-full bg-mist font-heading font-bold inline-flex items-center gap-2"
              >
                {ar ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />} {t('returns.back')}
              </button>
            )}
            {step < 4 && (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={(step === 1 && !canContinueStep1) || (step === 2 && !canContinueStep2) || (step === 3 && !canContinueStep3)}
                className="flex-1 h-12 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {t('returns.continue')} {ar ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            )}
            {step === 4 && (
              <button
                onClick={submit}
                disabled={submitting}
                className="flex-1 h-12 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? t('returns.submitting') : t('returns.submit')}
              </button>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

function StepSelectItems({ order, remaining, selected, toggleItem, setQty, lang, formatPrice, t }) {
  return (
    <div>
      <h2 className="font-heading font-extrabold text-2xl">{t('returns.step1Title')}</h2>
      <div className="mt-5 grid gap-3">
        {(order.items || []).map((it, idx) => {
          const max = remaining[idx] ?? 0;
          const isSelected = !!selected[idx];
          return (
            <div key={idx} className={`rounded-3xl border p-4 ${max === 0 ? 'opacity-50 border-border/40' : isSelected ? 'border-cosmic bg-cosmic/5' : 'border-border/60 bg-card'}`}>
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  disabled={max === 0}
                  onClick={() => toggleItem(idx, max)}
                  className={`grid place-items-center w-6 h-6 rounded-lg border-2 shrink-0 mt-0.5 ${isSelected ? 'bg-cosmic border-cosmic text-white' : 'border-border'}`}
                >
                  {isSelected && <Check className="w-4 h-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-bold truncate">{lineItemName(it, lang)}</p>
                  {it.variant_label && <p className="text-xs text-muted-foreground">{it.variant_label}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('returns.qtyPurchased')}: {it.qty} · {t('returns.qtyEligible')}: {max}
                  </p>
                  {max === 0 && <p className="text-xs text-destructive mt-1">{t('returns.qtyNoneEligible')}</p>}
                </div>
              </div>
              {isSelected && max > 0 && (
                <div className="mt-3 flex items-center gap-3 ps-9">
                  <span className="text-sm font-medium">{t('returns.selectQuantity')}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setQty(idx, (selected[idx] || 1) - 1, max)} className="w-8 h-8 rounded-full bg-mist font-heading font-bold">-</button>
                    <span className="w-6 text-center font-heading font-bold">{selected[idx]}</span>
                    <button type="button" onClick={() => setQty(idx, (selected[idx] || 1) + 1, max)} className="w-8 h-8 rounded-full bg-mist font-heading font-bold">+</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepTypeReason({ reasons, reasonId, setReasonId, requestType, setRequestType, allowedTypes, resolutionType, selectedReason, lang, t }) {
  return (
    <div>
      <h2 className="font-heading font-extrabold text-2xl">{t('returns.step2Title')}</h2>

      <p className="mt-5 text-sm font-heading font-bold">{t('returns.chooseReason')}</p>
      <div className="mt-2 grid gap-2">
        {reasons.map((r) => (
          <label key={r.id} className={`flex items-center gap-3 h-14 px-4 rounded-2xl border cursor-pointer ${reasonId === r.id ? 'border-cosmic bg-cosmic/5' : 'border-border bg-card'}`}>
            <input type="radio" name="reason" checked={reasonId === r.id} onChange={() => setReasonId(r.id)} className="w-4 h-4 accent-cosmic" />
            <span className="font-medium text-sm">{reasonName(r, lang)}</span>
          </label>
        ))}
        {reasons.length === 0 && <p className="text-sm text-muted-foreground">{t('returns.noReasons')}</p>}
      </div>

      {selectedReason && (
        <>
          {!resolutionType && allowedTypes.length > 0 && (
            <>
              <p className="mt-6 text-sm font-heading font-bold">{t('returns.chooseType')}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {allowedTypes.map((tp) => (
                  <label key={tp} className={`flex items-center justify-center gap-2 h-12 rounded-2xl border cursor-pointer ${requestType === tp ? 'border-cosmic bg-cosmic/5 text-cosmic' : 'border-border bg-card'}`}>
                    <input type="radio" name="type" checked={requestType === tp} onChange={() => setRequestType(tp)} className="sr-only" />
                    <span className="font-heading font-bold text-sm">{REQUEST_TYPE_LABEL[tp][lang] || REQUEST_TYPE_LABEL[tp].en}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          <div className="mt-6 rounded-2xl bg-mist p-4">
            <p className="text-sm font-heading font-bold">{t('returns.deliveryResponsibility')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{deliveryResponsibilityLabel(selectedReason.delivery_responsibility, lang)}</p>
            {selectedReason.evidence_required && (
              <p className="mt-2 text-sm text-muted-foreground">
                {t('returns.evidenceRequired')}: {selectedReason.evidence_min_images}–{selectedReason.evidence_max_images} {t('returns.photos')}
              </p>
            )}
            {reasonDescription(selectedReason, lang) && (
              <p className="mt-2 text-sm text-muted-foreground">{reasonDescription(selectedReason, lang)}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StepEvidence({ selectedReason, evidenceFiles, addPhotos, removePhoto, explanation, setExplanation, lang, t }) {
  const fileRef = useRef(null);
  const ar = lang === 'ar';
  const required = !!selectedReason?.evidence_required;
  return (
    <div>
      <h2 className="font-heading font-extrabold text-2xl">{t('returns.step3Title')}</h2>

      <p className="mt-5 text-sm font-heading font-bold">
        {required ? t('returns.evidenceRequired') : t('returns.evidenceOptional')}
      </p>
      {selectedReason && (
        <p className="mt-1 text-xs text-muted-foreground">
          {selectedReason.evidence_min_images}–{selectedReason.evidence_max_images} {t('returns.photos')}
        </p>
      )}
      {(ar ? selectedReason?.evidence_instructions : selectedReason?.evidence_instructions_en) && (
        <p className="mt-1 text-xs text-muted-foreground italic">
          {ar ? selectedReason.evidence_instructions : selectedReason.evidence_instructions_en}
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
        {evidenceFiles.map((f, i) => (
          <div key={i} className="relative aspect-square rounded-2xl overflow-hidden bg-mist">
            <img src={f.preview} alt="" className="w-full h-full object-cover" />
            {f.uploading && <div className="absolute inset-0 grid place-items-center bg-black/40"><Loader2 className="w-5 h-5 animate-spin text-white" /></div>}
            <button type="button" onClick={() => removePhoto(f)} className="absolute top-1 end-1 grid place-items-center w-6 h-6 rounded-full bg-black/60 text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {evidenceFiles.length < (selectedReason?.evidence_max_images ?? 5) && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="aspect-square rounded-2xl border-2 border-dashed border-border grid place-items-center text-muted-foreground hover:border-cosmic hover:text-cosmic transition-colors"
          >
            <ImagePlus className="w-6 h-6" />
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />

      <p className="mt-6 text-sm font-heading font-bold">{t('returns.explanation')}</p>
      <textarea
        value={explanation}
        onChange={(e) => setExplanation(e.target.value.slice(0, 1000))}
        rows={4}
        placeholder={t('returns.explanationPlaceholder')}
        className="mt-2 w-full p-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 resize-none"
      />
    </div>
  );
}

function StepReview({ order, selected, requestType, resolutionType, selectedReason, explanation, evidenceFiles, lang, formatPrice, t }) {
  const indexes = Object.keys(selected).map(Number);
  return (
    <div>
      <h2 className="font-heading font-extrabold text-2xl">{t('returns.step4Title')}</h2>

      <div className="mt-5 rounded-3xl bg-card border border-border/60 p-5 grid gap-4">
        <div>
          <p className="text-xs text-muted-foreground">{t('returns.orderNumber')}</p>
          <p className="font-heading font-bold">#{(order.id || '').slice(-8).toUpperCase()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('returns.itemsSelected')}</p>
          {indexes.map((idx) => (
            <p key={idx} className="text-sm font-medium">{lineItemName(order.items[idx], lang)} × {selected[idx]}</p>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{t('returns.type')}</p>
            <p className="text-sm font-medium">{resolutionType ? t(`returns.resolution.${resolutionType}`) : (REQUEST_TYPE_LABEL[requestType][lang] || REQUEST_TYPE_LABEL[requestType].en)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('returns.chooseReason')}</p>
            <p className="text-sm font-medium">{reasonName(selectedReason, lang)}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('returns.deliveryResponsibility')}</p>
          <p className="text-sm font-medium">{deliveryResponsibilityLabel(selectedReason?.delivery_responsibility, lang)}</p>
        </div>
        {evidenceFiles.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground">{t('returns.photos')}</p>
            <p className="text-sm font-medium">{evidenceFiles.length}</p>
          </div>
        )}
        {explanation && (
          <div>
            <p className="text-xs text-muted-foreground">{t('returns.explanation')}</p>
            <p className="text-sm">{explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StepSuccess({ result, order, t, navigate }) {
  return (
    <div className="text-center py-10">
      <div className="mx-auto grid place-items-center w-20 h-20 rounded-full bg-emerald-100 text-emerald-700">
        <Check className="w-10 h-10" />
      </div>
      <h1 className="mt-6 font-heading font-extrabold text-2xl">{t('returns.submitSuccessTitle')}</h1>
      <p className="mt-4 text-sm text-muted-foreground">{t('returns.requestCode')}</p>
      <p className="font-heading font-extrabold text-3xl text-cosmic" dir="ltr">{result.request_code}</p>
      <p className="mt-4 text-muted-foreground">{t('returns.successMessage')}</p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          onClick={() => navigate(`/returns/${result.request_id}`)}
          className="h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold"
        >
          {t('returns.viewRequest')}
        </button>
        <Link to="/orders" className="h-12 px-6 rounded-full bg-mist font-heading font-bold inline-flex items-center">
          {t('orders.title')}
        </Link>
      </div>
    </div>
  );
}
