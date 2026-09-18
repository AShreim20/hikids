import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Lock, Loader2, Copy, Check, ImageOff, StickyNote, ShieldCheck, XCircle,
  MessageCircleQuestion, ImageIcon,
} from 'lucide-react';
import { db } from '@/api/entities';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FormInput from '@/components/admin/FormInput';
import { Image } from '@/components/ui/image';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/lib/permissions';
import { orderRef, orderTotals } from '@/lib/orderStatus';
import {
  returnRequestStatusLabel, REQUEST_TYPE_LABEL, deliveryResponsibilityLabel,
  allowedAdminActions, returnItemName, getDeliveredAt,
} from '@/lib/returns';
import EvidenceLightbox, { useLightbox } from '@/components/returns/EvidenceLightbox';
import {
  adminStartReview, adminRequestInformation, adminApproveReturnRequest,
  adminRejectReturnRequest, adminAddInternalNote,
} from '@/lib/returnFunctions';

export default function ReturnRequestAdminDetail() {
  const { id } = useParams();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const { can } = usePermissions();
  const ar = lang === 'ar';
  const allowed = can('returns.manage');
  const lightbox = useLightbox();

  const [request, setRequest] = useState(null);
  const [items, setItems] = useState([]);
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState({});
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [dialog, setDialog] = useState(null); // 'approve' | 'reject' | 'info' | null
  const [staleNotice, setStaleNotice] = useState(null);
  const [startingReview, setStartingReview] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await db.ReturnRequest.get(id);
      setRequest(r);
      if (r) {
        const [its, o, ns] = await Promise.all([
          db.ReturnRequestItem.filter({ return_request_id: r.id }).catch(() => []),
          db.Order.get(r.order_id).catch(() => null),
          db.ReturnRequestNote.filter({ return_request_id: r.id }).catch(() => []),
        ]);
        setItems(its || []);
        setOrder(o);
        setNotes((ns || []).sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
        // Best-effort cosmetic thumbnail only -- never a source of historical
        // name/price/qty (those always come from return_request_items /
        // order.items, both immutable snapshots).
        const ids = [...new Set((its || []).map((i) => i.product_id).filter(Boolean))];
        if (ids.length) {
          const found = await Promise.all(ids.map((pid) => db.Product.get(pid).catch(() => null)));
          setProducts(Object.fromEntries(found.filter(Boolean).map((p) => [p.id, p])));
        } else {
          setProducts({});
        }
      }
    } catch {
      setRequest(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (allowed) load(); else setLoading(false); }, [allowed, id]);

  const actions = allowedAdminActions(request?.status);
  const firstItem = items[0];
  const snapshot = firstItem?.reason_policy_snapshot;
  const isManualReview = snapshot?.delivery_responsibility === 'manual_review';
  const deliveredAt = order ? getDeliveredAt(order) : null;
  const evidenceUrls = useMemo(() => items.flatMap((it) => it.evidence_urls || []), [items]);

  const copyCode = () => {
    navigator.clipboard?.writeText(request.request_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  // Shared result handler for every mutating action -- surfaces a stale-data
  // notice instead of ever assuming the optimistic action succeeded (section
  // 44/68). Always reloads so the page reflects real backend state.
  const handleResult = (res, successMsg) => {
    if (res?.success) {
      toast({ title: successMsg });
      setDialog(null);
      load();
      return true;
    }
    if (res?.message === 'stale') {
      setStaleNotice(ar
        ? 'تم تحديث هذا الطلب من قبل مستخدم آخر. تم تحديث البيانات — يرجى المراجعة والمحاولة مجدداً.'
        : 'This request was updated by someone else. The data has been refreshed — please review and try again.');
      load();
      return false;
    }
    toast({ title: res?.message || (ar ? 'حدث خطأ' : 'Something went wrong'), variant: 'destructive' });
    return false;
  };

  const startReview = async () => {
    setStartingReview(true);
    try {
      handleResult(await adminStartReview(request.id), ar ? 'بدأت المراجعة' : 'Review started');
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setStartingReview(false);
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await adminAddInternalNote(request.id, noteText.trim());
      if (res?.success) {
        setNoteText('');
        load();
      } else {
        toast({ title: res?.message || (ar ? 'تعذّر حفظ الملاحظة' : 'Could not save note'), variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setSavingNote(false);
    }
  };

  if (!allowed) {
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
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="grid place-items-center py-32"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        <Footer />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-md mx-auto px-5 py-24 text-center">
          <p className="font-heading font-bold text-xl">{ar ? 'الطلب غير موجود' : 'Request not found'}</p>
          <Link to="/admin/return-requests" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">
            {ar ? 'طلبات الإرجاع والاستبدال' : 'Return & Exchange Requests'}
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-10 md:pl-16">
        <Link to="/admin/return-requests" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          ← {ar ? 'طلبات الإرجاع والاستبدال' : 'Return & Exchange Requests'}
        </Link>

        {staleNotice && (
          <div className="mt-5 rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start justify-between gap-3">
            <p className="text-sm text-amber-800">{staleNotice}</p>
            <button onClick={() => setStaleNotice(null)} className="text-amber-800 shrink-0">✕</button>
          </div>
        )}

        {/* A — Request Summary */}
        <div className="mt-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading font-extrabold text-3xl md:text-4xl" dir="ltr">{request.request_code}</h1>
              <button onClick={copyCode} className="grid place-items-center w-8 h-8 rounded-full bg-mist shrink-0" aria-label={ar ? 'نسخ' : 'Copy'}>
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {REQUEST_TYPE_LABEL[request.request_type]?.[lang]} · {new Date(request.submitted_at || request.created_date).toLocaleString(ar ? 'ar-u-nu-latn' : 'en')}
            </p>
          </div>
          <span className="px-4 py-2 rounded-full text-sm font-heading font-bold bg-cosmic/10 text-cosmic whitespace-nowrap">
            {returnRequestStatusLabel(request.status, lang)}
          </span>
        </div>

        {/* B — Customer + Original Order */}
        <Section title={ar ? 'الزبون والطلب الأصلي' : 'Customer & Original Order'}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={ar ? 'الزبون' : 'Customer'} value={order?.customer_name} />
            <Field label={ar ? 'الهاتف' : 'Phone'} value={order?.phone} dir="ltr" />
            <Field label={ar ? 'البريد الإلكتروني' : 'Email'} value={order?.customer_email} dir="ltr" />
            <Field label={ar ? 'الطلب الأصلي' : 'Original order'} value={order ? orderRef(order) : '—'} dir="ltr" />
            <Field label={ar ? 'تاريخ الطلب' : 'Order date'} value={order ? new Date(order.created_date).toLocaleString(ar ? 'ar-u-nu-latn' : 'en') : '—'} dir="ltr" />
            <Field label={ar ? 'تاريخ التسليم' : 'Delivered at'} value={deliveredAt ? deliveredAt.toLocaleString(ar ? 'ar-u-nu-latn' : 'en') : (ar ? 'غير مسجل' : 'Not recorded')} dir="ltr" />
            <Field label={ar ? 'حالة الطلب الأصلي' : 'Original order status'} value={order?.status} />
            <Field label={ar ? 'طريقة الدفع' : 'Payment method'} value={order?.payment_method} />
            {order && (
              <Field label={ar ? 'إجمالي الطلب' : 'Order total'} value={orderTotals(order).total?.toFixed?.(2)} dir="ltr" />
            )}
          </div>
        </Section>

        {/* C — Requested Items */}
        <Section title={ar ? 'الأصناف المطلوبة' : 'Requested Items'}>
          <div className="grid gap-3">
            {items.map((it) => {
              const product = it.product_id ? products[it.product_id] : null;
              const orderItem = order?.items?.[it.order_item_index];
              return (
                <div key={it.id} className="flex items-center gap-4 rounded-2xl bg-mist/60 p-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-mist shrink-0 grid place-items-center">
                    {product?.image_url
                      ? <Image src={product.image_url} alt="" fittingType="fill" className="w-full h-full object-cover" />
                      : <ImageIcon className="w-6 h-6 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-bold truncate">{returnItemName(it, lang)}</p>
                    {orderItem?.variant_label && <p className="text-xs text-muted-foreground">{orderItem.variant_label}</p>}
                    {it.sku && <p className="text-xs text-muted-foreground" dir="ltr">{ar ? 'الرمز: ' : 'Code: '}{it.sku}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ar ? `المشتراة: ${it.purchased_quantity}` : `Purchased: ${it.purchased_quantity}`}
                      {' · '}
                      {ar ? `المطلوبة: ${it.requested_quantity}` : `Requested: ${it.requested_quantity}`}
                    </p>
                  </div>
                  {typeof it.unit_price === 'number' && (
                    <p className="text-sm font-heading font-bold shrink-0" dir="ltr">{it.unit_price.toFixed(2)}</p>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        {/* D — Reason & Policy */}
        {snapshot && (
          <Section title={ar ? 'السبب والسياسة (كما كانت عند الإرسال)' : 'Reason & Policy (as submitted)'}>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={ar ? 'السبب' : 'Reason'} value={ar ? snapshot.name : (snapshot.name_en || snapshot.name)} />
              <Field label={ar ? 'مسؤولية التوصيل' : 'Delivery responsibility'} value={deliveryResponsibilityLabel(snapshot.delivery_responsibility, lang)} />
              <Field
                label={ar ? 'الإجراءات المسموح بها' : 'Allowed actions'}
                value={[
                  snapshot.allow_return && (ar ? 'إرجاع' : 'Return'),
                  snapshot.allow_exchange && (ar ? 'استبدال' : 'Exchange'),
                  snapshot.allow_missing_item && (ar ? 'صنف ناقص' : 'Missing item'),
                  snapshot.allow_missing_part && (ar ? 'قطعة ناقصة' : 'Missing part'),
                ].filter(Boolean).join(' · ') || '—'}
              />
              <Field
                label={ar ? 'الأدلة المطلوبة' : 'Evidence requirement'}
                value={snapshot.evidence_required
                  ? (ar ? `مطلوبة (${snapshot.evidence_min_images}–${snapshot.evidence_max_images} صور)` : `Required (${snapshot.evidence_min_images}–${snapshot.evidence_max_images} photos)`)
                  : (ar ? 'غير مطلوبة' : 'Not required')}
              />
            </div>
          </Section>
        )}

        {/* E — Customer Explanation */}
        {request.customer_note && (
          <Section title={ar ? 'شرح الزبون' : 'Customer Explanation'}>
            <p className="text-sm whitespace-pre-line">{request.customer_note}</p>
          </Section>
        )}

        {/* F — Evidence / Photos */}
        <Section title={ar ? 'الأدلة والصور' : 'Evidence & Photos'}>
          {evidenceUrls.length === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><ImageOff className="w-4 h-4" /> {ar ? 'لا توجد صور مرفقة' : 'No photos attached'}</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {evidenceUrls.map((url, i) => (
                <button key={i} onClick={() => lightbox.open(evidenceUrls, i)} className="aspect-square rounded-xl overflow-hidden bg-mist block">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* G — Review Decision */}
        <Section title={ar ? 'قرار المراجعة' : 'Review Decision'}>
          {request.status === 'rejected' && request.rejection_reason && (
            <div className="mb-4 rounded-2xl bg-destructive/10 p-4">
              <p className="text-xs font-heading font-bold text-destructive uppercase tracking-wider mb-1">{ar ? 'سبب الرفض (مرئي للزبون)' : 'Rejection reason (customer-visible)'}</p>
              <p className="text-sm text-destructive">{request.rejection_reason}</p>
            </div>
          )}
          {['needs_information', 'approved', 'awaiting_return'].includes(request.status) && request.admin_note && (
            <div className="mb-4 rounded-2xl bg-amber-50 border border-amber-200 p-4">
              <p className="text-xs font-heading font-bold text-amber-800 uppercase tracking-wider mb-1">{ar ? 'رسالة للزبون' : 'Message to customer'}</p>
              <p className="text-sm text-amber-800">{request.admin_note}</p>
            </div>
          )}
          {request.delivery_responsibility_decision && (
            <Field label={ar ? 'قرار مسؤولية التوصيل' : 'Delivery responsibility decision'} value={deliveryResponsibilityLabel(request.delivery_responsibility_decision, lang)} />
          )}

          <div className="flex flex-wrap gap-3 mt-2">
            {request.status === 'submitted' && (
              <button onClick={startReview} disabled={startingReview} className="h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center gap-2 disabled:opacity-60">
                {startingReview && <Loader2 className="w-4 h-4 animate-spin" />} {ar ? 'بدء المراجعة' : 'Start Review'}
              </button>
            )}
            {actions.canApprove && (
              <button onClick={() => setDialog('approve')} className="h-11 px-5 rounded-full bg-emerald-600 text-white font-heading font-bold inline-flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> {ar ? 'موافقة' : 'Approve'}
              </button>
            )}
            {actions.canReject && (
              <button onClick={() => setDialog('reject')} className="h-11 px-5 rounded-full bg-destructive text-white font-heading font-bold inline-flex items-center gap-2">
                <XCircle className="w-4 h-4" /> {ar ? 'رفض' : 'Reject'}
              </button>
            )}
            {actions.canRequestInfo && (
              <button onClick={() => setDialog('info')} className="h-11 px-5 rounded-full bg-mist font-heading font-bold inline-flex items-center gap-2">
                <MessageCircleQuestion className="w-4 h-4" /> {ar ? 'طلب معلومات إضافية' : 'Request More Information'}
              </button>
            )}
            {request.status === 'needs_information' && (
              <p className="text-sm text-muted-foreground self-center">{ar ? 'بانتظار رد الزبون' : 'Awaiting customer response'}</p>
            )}
            {!['submitted', 'under_review', 'needs_information'].includes(request.status) && (
              <p className="text-sm text-muted-foreground self-center">{ar ? 'لا توجد إجراءات متاحة لهذه الحالة' : 'No actions available for this status'}</p>
            )}
          </div>
        </Section>

        {/* H — Internal Notes */}
        <Section title={ar ? 'ملاحظات داخلية (للموظفين فقط)' : 'Internal Notes (staff-only)'}>
          <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5" /> {ar ? 'لا تظهر هذه الملاحظات للزبون أبداً' : 'These notes are never visible to the customer'}</p>
          <div className="flex gap-2 mb-4">
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={ar ? 'أضف ملاحظة داخلية…' : 'Add an internal note…'}
              className="flex-1 h-11 px-3.5 rounded-2xl bg-mist border border-border text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') addNote(); }}
            />
            <button onClick={addNote} disabled={savingNote || !noteText.trim()} className="h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold disabled:opacity-60">
              {ar ? 'إضافة' : 'Add'}
            </button>
          </div>
          <div className="grid gap-2">
            {notes.map((n) => (
              <div key={n.id} className="rounded-2xl bg-mist/60 p-3">
                <p className="text-sm whitespace-pre-line">{n.note}</p>
                <p className="text-xs text-muted-foreground mt-1" dir="ltr">{new Date(n.created_date).toLocaleString(ar ? 'ar-u-nu-latn' : 'en')}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* I — Status Timeline / Audit */}
        {Array.isArray(request.activity) && request.activity.length > 0 && (
          <Section title={ar ? 'سجل الحالة والتدقيق' : 'Status Timeline & Audit'}>
            <div className="grid gap-3">
              {[...request.activity].reverse().map((entry, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-cosmic mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {entry.to ? returnRequestStatusLabel(entry.to, lang) : entry.action}
                      {entry.by && <span className="text-muted-foreground font-normal"> · {entry.by}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground" dir="ltr">{new Date(entry.at).toLocaleString(ar ? 'ar-u-nu-latn' : 'en')}</p>
                    {entry.note && <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
      <Footer />

      {lightbox.state && (
        <EvidenceLightbox urls={lightbox.state.urls} index={lightbox.state.index} onClose={lightbox.close} onNavigate={lightbox.navigate} />
      )}

      {dialog === 'approve' && (
        <ApproveDialog
          request={request} items={items} order={order} isManualReview={isManualReview} lang={lang}
          onClose={() => setDialog(null)}
          onConfirm={async (message, decision) => {
            const res = await adminApproveReturnRequest(request.id, request.status, message, decision);
            return handleResult(res, ar ? 'تمت الموافقة على الطلب' : 'Request approved');
          }}
        />
      )}
      {dialog === 'reject' && (
        <RejectDialog
          request={request} items={items} lang={lang}
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            const res = await adminRejectReturnRequest(request.id, request.status, reason);
            return handleResult(res, ar ? 'تم رفض الطلب' : 'Request rejected');
          }}
        />
      )}
      {dialog === 'info' && (
        <InfoRequestDialog
          request={request} lang={lang}
          onClose={() => setDialog(null)}
          onConfirm={async (message) => {
            const res = await adminRequestInformation(request.id, message, request.status);
            return handleResult(res, ar ? 'تم إرسال طلب المعلومات' : 'Information request sent');
          }}
        />
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mt-6 rounded-3xl bg-card border border-border/60 p-5">
      <h2 className="font-heading font-extrabold text-lg mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value, dir }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words" dir={dir}>{value || '—'}</p>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-5">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-4 shrink-0">
          <h2 className="font-heading font-extrabold text-xl">{title}</h2>
          <button type="button" onClick={onClose} className="grid place-items-center w-10 h-10 rounded-full bg-mist">✕</button>
        </div>
        <div className="px-6 pb-6 overflow-y-auto flex-1 grid gap-4">{children}</div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, dir }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-end" dir={dir}>{value || '—'}</span>
    </div>
  );
}

function DialogActions({ onCancel, onConfirm, confirmDisabled, submitting, confirmLabel, confirmClass, lang }) {
  const ar = lang === 'ar';
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="button"
        onClick={onConfirm}
        disabled={submitting || confirmDisabled}
        className={`flex-1 h-12 rounded-full text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60 ${confirmClass}`}
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />} {confirmLabel}
      </button>
      <button type="button" onClick={onCancel} disabled={submitting} className="h-12 px-6 rounded-full bg-mist font-heading font-bold">
        {ar ? 'إلغاء' : 'Cancel'}
      </button>
    </div>
  );
}

// Guards against losing typed-but-unsent text if the admin clicks outside or
// the X button (section 66) -- a plain confirm() matches the rest of this
// codebase's existing dirty-state pattern (e.g. ReturnReasons.jsx's dialogs
// don't use a dedicated library either).
function useGuardedClose(hasUnsaved, onClose, lang) {
  return () => {
    if (hasUnsaved && !window.confirm(lang === 'ar' ? 'لديك نص لم يُرسل بعد. هل تريد الإغلاق؟' : 'You have unsent text. Close anyway?')) return;
    onClose();
  };
}

function ApproveDialog({ request, items, order, isManualReview, lang, onClose, onConfirm }) {
  const ar = lang === 'ar';
  const [message, setMessage] = useState('');
  const [decision, setDecision] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const firstItem = items[0];
  const guardedClose = useGuardedClose(!!message.trim(), onClose, lang);

  const submit = async () => {
    if (isManualReview && !decision) return;
    setSubmitting(true);
    try {
      await onConfirm(message.trim(), decision || null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={ar ? 'تأكيد الموافقة' : 'Confirm Approval'} onClose={submitting ? () => {} : guardedClose}>
      <div className="rounded-2xl bg-mist/60 p-4 grid gap-2">
        <SummaryRow label={ar ? 'رقم الطلب' : 'RET Code'} value={request.request_code} dir="ltr" />
        <SummaryRow label={ar ? 'الزبون' : 'Customer'} value={order?.customer_name} />
        <SummaryRow label={ar ? 'الأصناف' : 'Items'} value={items.map((it) => `${returnItemName(it, lang)} × ${it.requested_quantity}`).join(', ')} />
        <SummaryRow label={ar ? 'النوع' : 'Type'} value={REQUEST_TYPE_LABEL[request.request_type]?.[lang]} />
        <SummaryRow label={ar ? 'السبب' : 'Reason'} value={firstItem?.reason_policy_snapshot ? (ar ? firstItem.reason_policy_snapshot.name : (firstItem.reason_policy_snapshot.name_en || firstItem.reason_policy_snapshot.name)) : ''} />
        {!isManualReview && (
          <SummaryRow label={ar ? 'مسؤولية التوصيل' : 'Delivery responsibility'} value={deliveryResponsibilityLabel(firstItem?.reason_policy_snapshot?.delivery_responsibility, lang)} />
        )}
      </div>

      {isManualReview && (
        <div>
          <p className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground mb-2">
            {ar ? 'اختر المسؤول عن تكلفة التوصيل' : 'Choose who is responsible for delivery'}
          </p>
          <div className="grid gap-2">
            {['hikids', 'customer'].map((v) => (
              <label key={v} className={`flex items-center gap-2 h-11 px-3.5 rounded-2xl border cursor-pointer ${decision === v ? 'border-cosmic bg-cosmic/5' : 'border-border bg-mist'}`}>
                <input type="radio" checked={decision === v} onChange={() => setDecision(v)} className="w-4 h-4 accent-cosmic" />
                <span className="text-sm font-medium">{deliveryResponsibilityLabel(v, lang)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <FormInput label={ar ? 'رسالة للزبون (اختياري)' : 'Message to customer (optional)'} value={message} onChange={(e) => setMessage(e.target.value)} textarea />
      <p className="text-xs text-muted-foreground -mt-2">
        {ar ? 'ملاحظة: الموافقة لا تعني استلام المنتج أو استرداد المبلغ.' : 'Note: approval does not mean the item was received or a refund was issued.'}
      </p>

      <DialogActions onCancel={guardedClose} onConfirm={submit} confirmDisabled={isManualReview && !decision} submitting={submitting} confirmLabel={ar ? 'تأكيد الموافقة' : 'Confirm Approval'} confirmClass="bg-emerald-600 hover:bg-emerald-700" lang={lang} />
    </Modal>
  );
}

function RejectDialog({ request, items, lang, onClose, onConfirm }) {
  const ar = lang === 'ar';
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardedClose = useGuardedClose(!!reason.trim(), onClose, lang);

  const submit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={ar ? 'تأكيد الرفض' : 'Confirm Rejection'} onClose={submitting ? () => {} : guardedClose}>
      <div className="rounded-2xl bg-mist/60 p-4 grid gap-2">
        <SummaryRow label={ar ? 'رقم الطلب' : 'RET Code'} value={request.request_code} dir="ltr" />
        <SummaryRow label={ar ? 'الأصناف' : 'Items'} value={items.map((it) => `${returnItemName(it, lang)} × ${it.requested_quantity}`).join(', ')} />
      </div>
      <FormInput label={ar ? 'سبب الرفض (سيظهر للزبون) *' : 'Rejection reason (shown to customer) *'} value={reason} onChange={(e) => setReason(e.target.value)} textarea required />
      <DialogActions onCancel={guardedClose} onConfirm={submit} confirmDisabled={!reason.trim()} submitting={submitting} confirmLabel={ar ? 'تأكيد الرفض' : 'Confirm Rejection'} confirmClass="bg-destructive hover:bg-destructive/90" lang={lang} />
    </Modal>
  );
}

function InfoRequestDialog({ request, lang, onClose, onConfirm }) {
  const ar = lang === 'ar';
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardedClose = useGuardedClose(!!message.trim(), onClose, lang);

  const submit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(message.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={ar ? 'طلب معلومات إضافية' : 'Request More Information'} onClose={submitting ? () => {} : guardedClose}>
      <p className="text-sm text-muted-foreground">{ar ? `رقم الطلب: ${request.request_code}` : `RET Code: ${request.request_code}`}</p>
      <FormInput label={ar ? 'ما المعلومات المطلوبة من الزبون؟ (سيظهر للزبون) *' : 'What information is needed from the customer? (shown to customer) *'} value={message} onChange={(e) => setMessage(e.target.value)} textarea required />
      <DialogActions onCancel={guardedClose} onConfirm={submit} confirmDisabled={!message.trim()} submitting={submitting} confirmLabel={ar ? 'إرسال الطلب' : 'Send Request'} confirmClass="bg-cosmic hover:bg-cosmic/90" lang={lang} />
    </Modal>
  );
}
