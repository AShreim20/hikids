import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Lock, Camera, X } from 'lucide-react';
import { db } from '@/api/entities';
import { cancelReturnRequest, respondToInformationRequest } from '@/lib/returnFunctions';
import { uploadFile } from '@/lib/uploadFile';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { lineItemName } from '@/lib/bilingual';
import {
  returnRequestStatusLabel, REQUEST_TYPE_LABEL, deliveryResponsibilityLabel,
} from '@/lib/returns';

const CANCELLABLE_STATUSES = ['submitted', 'under_review', 'needs_information'];

export default function ReturnRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const ar = lang === 'ar';

  const [request, setRequest] = useState(null);
  const [items, setItems] = useState([]);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = () => {
    setLoading(true);
    db.ReturnRequest.get(id)
      .then(async (r) => {
        setRequest(r);
        if (r) {
          const [its, o] = await Promise.all([
            db.ReturnRequestItem.filter({ return_request_id: r.id }).catch(() => []),
            db.Order.get(r.order_id).catch(() => null),
          ]);
          setItems(its || []);
          setOrder(o);
        }
      })
      .catch(() => setRequest(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (user) load(); else setLoading(false); }, [id, user]);

  const cancel = async () => {
    if (!window.confirm(t('returns.cancelConfirm'))) return;
    setCancelling(true);
    try {
      const res = await cancelReturnRequest(request.id);
      if (!res?.success) {
        toast({ title: res?.message || t('returns.error'), variant: 'destructive' });
        return;
      }
      toast({ title: t('returns.cancelled') });
      load();
    } catch (err) {
      toast({ title: err.message || t('returns.error'), variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={t('returns.requestDetails')} />
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
        <PageHeader title={t('returns.requestDetails')} />
        <div className="grid place-items-center py-32"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        <Footer />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={t('returns.requestDetails')} />
        <div className="max-w-md mx-auto px-5 py-24 text-center">
          <p className="font-heading font-bold text-xl">{t('returns.notFound')}</p>
          <Link to="/returns" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">{t('returns.myRequests')}</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const canCancel = CANCELLABLE_STATUSES.includes(request.status);

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title={t('returns.requestDetails')} />
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-10">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{t('returns.requestCode')}</p>
            <h1 className="font-heading font-extrabold text-3xl" dir="ltr">{request.request_code}</h1>
          </div>
          <span className="px-3 py-1.5 rounded-full text-sm font-heading font-bold bg-cosmic/10 text-cosmic whitespace-nowrap">
            {returnRequestStatusLabel(request.status, lang)}
          </span>
        </div>

        {request.status === 'needs_information' && (
          <div className="mt-5 rounded-2xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm font-heading font-bold text-amber-800">{t('returns.needsInfoNotice')}</p>
            {request.admin_note && <p className="mt-1 text-sm text-amber-700">{request.admin_note}</p>}
          </div>
        )}
        {request.status === 'needs_information' && (
          <RespondToInfoForm requestId={request.id} maxImages={items[0]?.reason_policy_snapshot?.evidence_max_images ?? 5} onSent={load} />
        )}
        {request.status === 'rejected' && request.rejection_reason && (
          <div className="mt-5 rounded-2xl bg-destructive/10 p-4">
            <p className="text-sm font-heading font-bold text-destructive">{request.rejection_reason}</p>
          </div>
        )}

        <div className="mt-6 rounded-3xl bg-card border border-border/60 p-5 grid gap-4">
          {order && (
            <div>
              <p className="text-xs text-muted-foreground">{t('returns.orderNumber')}</p>
              <p className="text-sm font-medium">#{(order.id || '').slice(-8).toUpperCase()}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">{t('returns.submittedOn')}</p>
            <p className="text-sm font-medium" dir="ltr">
              {request.submitted_at ? new Date(request.submitted_at).toLocaleString(ar ? 'ar-u-nu-latn' : 'en') : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('returns.itemsSelected')}</p>
            {items.map((it) => (
              <p key={it.id} className="text-sm font-medium">
                {lineItemName({ name: it.product_name, name_en: it.product_name_en }, lang)} × {it.requested_quantity}
              </p>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">{t('returns.type')}</p>
              <p className="text-sm font-medium">{REQUEST_TYPE_LABEL[request.request_type]?.[lang] || request.request_type}</p>
            </div>
            {items[0]?.reason_id && (
              <div>
                <p className="text-xs text-muted-foreground">{t('returns.chooseReason')}</p>
                <p className="text-sm font-medium">{items[0]?.reason_policy_snapshot ? (ar ? items[0].reason_policy_snapshot.name : (items[0].reason_policy_snapshot.name_en || items[0].reason_policy_snapshot.name)) : ''}</p>
              </div>
            )}
          </div>
          {items[0]?.reason_policy_snapshot?.delivery_responsibility && (
            <div>
              <p className="text-xs text-muted-foreground">{t('returns.deliveryResponsibility')}</p>
              <p className="text-sm font-medium">{deliveryResponsibilityLabel(items[0].reason_policy_snapshot.delivery_responsibility, lang)}</p>
            </div>
          )}
          {request.customer_note && (
            <div>
              <p className="text-xs text-muted-foreground">{t('returns.explanation')}</p>
              <p className="text-sm">{request.customer_note}</p>
            </div>
          )}
          {items.some((it) => (it.evidence_urls || []).length > 0) && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">{t('returns.photos')}</p>
              <div className="grid grid-cols-4 gap-2">
                {items.flatMap((it) => it.evidence_urls || []).map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="aspect-square rounded-xl overflow-hidden bg-mist block">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {Array.isArray(request.activity) && request.activity.length > 0 && (
          <div className="mt-6">
            <h2 className="font-heading font-extrabold text-lg">{t('returns.timeline')}</h2>
            <div className="mt-3 grid gap-3">
              {request.activity.map((entry, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-cosmic mt-1.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">
                      {entry.to ? returnRequestStatusLabel(entry.to, lang) : entry.action}
                    </p>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {new Date(entry.at).toLocaleString(ar ? 'ar-u-nu-latn' : 'en')}
                    </p>
                    {entry.note && <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center gap-3">
          <Link to="/returns" className="h-12 px-6 rounded-full bg-mist font-heading font-bold inline-flex items-center">
            {t('returns.myRequests')}
          </Link>
          {canCancel && (
            <button
              onClick={cancel}
              disabled={cancelling}
              className="h-12 px-6 rounded-full bg-destructive/10 text-destructive font-heading font-bold inline-flex items-center gap-2 disabled:opacity-60"
            >
              {cancelling && <Loader2 className="w-4 h-4 animate-spin" />} {t('returns.cancelRequest')}
            </button>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

// Structured request/response, not live chat (section 34/35) -- one message
// plus optional additional photos per submission, appended to the request's
// activity timeline server-side. Reuses ReturnRequestNew.jsx's own
// upload-then-collect-URL pattern.
function RespondToInfoForm({ requestId, maxImages, onSent }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const ar = lang === 'ar';
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]); // [{ file, preview, url, uploading }]
  const [sending, setSending] = useState(false);

  const addPhotos = async (fileList) => {
    const picked = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (!picked.length) return;
    const room = Math.max(0, maxImages - files.length);
    if (room <= 0) {
      toast({ title: ar ? `الحد الأقصى ${maxImages} صور` : `Maximum ${maxImages} photos`, variant: 'destructive' });
      return;
    }
    const toAdd = picked.slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file), url: null, uploading: true }));
    setFiles((prev) => [...prev, ...toAdd]);
    for (const entry of toAdd) {
      try {
        const { file_url } = await uploadFile(entry.file, { bucket: 'customer-uploads', folder: 'returns', ownerId: user.id });
        setFiles((prev) => prev.map((f) => (f === entry ? { ...f, url: file_url, uploading: false } : f)));
      } catch {
        setFiles((prev) => prev.filter((f) => f !== entry));
        toast({ title: ar ? 'تعذّر رفع إحدى الصور' : 'One of the photos failed to upload', variant: 'destructive' });
      }
    }
  };
  const removePhoto = (entry) => setFiles((prev) => prev.filter((f) => f !== entry));

  const uploading = files.some((f) => f.uploading);
  const evidenceUrls = files.filter((f) => f.url).map((f) => f.url);
  const canSend = !uploading && (message.trim() || evidenceUrls.length > 0);

  const send = async () => {
    if (!canSend || sending) return;
    setSending(true);
    try {
      const res = await respondToInformationRequest(requestId, message.trim(), evidenceUrls);
      if (!res?.success) {
        toast({ title: res?.message || t('returns.error'), variant: 'destructive' });
        return;
      }
      toast({ title: ar ? 'تم إرسال ردك' : 'Your response has been sent' });
      setMessage('');
      setFiles([]);
      onSent();
    } catch (err) {
      toast({ title: err.message || t('returns.error'), variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl bg-card border border-border/60 p-4 grid gap-3">
      <p className="text-sm font-heading font-bold">{ar ? 'الرد على طلب المعلومات' : 'Respond to information request'}</p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={ar ? 'اكتب ردك هنا…' : 'Type your response…'}
        rows={3}
        className="w-full p-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 resize-none text-sm"
      />
      <div className="flex flex-wrap gap-2">
        {files.map((f, i) => (
          <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden bg-mist">
            <img src={f.preview} alt="" className="w-full h-full object-cover" />
            {f.uploading && <div className="absolute inset-0 grid place-items-center bg-black/40"><Loader2 className="w-4 h-4 animate-spin text-white" /></div>}
            <button onClick={() => removePhoto(f)} className="absolute top-0.5 end-0.5 grid place-items-center w-5 h-5 rounded-full bg-black/60 text-white" aria-label={ar ? 'إزالة' : 'Remove'}>
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {files.length < maxImages && (
          <label className="w-16 h-16 rounded-xl border-2 border-dashed border-border grid place-items-center cursor-pointer text-muted-foreground">
            <Camera className="w-5 h-5" />
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
          </label>
        )}
      </div>
      <button
        onClick={send}
        disabled={!canSend || sending}
        className="justify-self-start h-11 px-6 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center gap-2 disabled:opacity-60"
      >
        {sending && <Loader2 className="w-4 h-4 animate-spin" />} {ar ? 'إرسال الرد' : 'Send Response'}
      </button>
    </div>
  );
}
