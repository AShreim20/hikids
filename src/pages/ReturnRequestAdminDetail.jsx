import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Lock, Loader2, Copy, Check, ImageOff, StickyNote, ShieldCheck, XCircle,
  MessageCircleQuestion, ImageIcon, PackageCheck, Search as SearchIcon, Camera, X,
} from 'lucide-react';
import { db } from '@/api/entities';
import { useToast } from '@/components/ui/use-toast';
import { uploadFile } from '@/lib/uploadFile';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FormInput from '@/components/admin/FormInput';
import { Image } from '@/components/ui/image';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/lib/permissions';
import { orderRef, orderTotals } from '@/lib/orderStatus';
import {
  returnRequestStatusLabel, REQUEST_TYPE_LABEL, deliveryResponsibilityLabel,
  allowedAdminActions, returnItemName, getDeliveredAt, INSPECTION_CONDITIONS,
  inspectionConditionLabel, refundMethodLabel, missingResolutionLabel,
  receivedTotals, inspectionTotals, isPhysicalItem, refundStatusLabel,
  settlementStatusLabel,
} from '@/lib/returns';
import EvidenceLightbox, { useLightbox } from '@/components/returns/EvidenceLightbox';
import {
  adminStartReview, adminRequestInformation, adminApproveReturnRequest,
  adminRejectReturnRequest, adminAddInternalNote, adminReceiveReturnItem,
  adminInspectReturnItem, adminClearDispositionReview, adminReleaseExchangeReservation,
  adminSetMissingResolution,
} from '@/lib/returnFunctions';
import {
  calculateReturnSettlement, adminConfirmReturnSettlement, adminConfirmExchangeCashCollected, adminCompleteManualRefund,
  adminFailRefund, adminRetryRefund, adminReverseSettlement,
} from '@/lib/walletFunctions';

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
  const [receipts, setReceipts] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [dialog, setDialog] = useState(null); // 'approve' | 'reject' | 'info' | 'receive' | 'inspect' | null
  const [dialogItem, setDialogItem] = useState(null);
  const [staleNotice, setStaleNotice] = useState(null);
  const [startingReview, setStartingReview] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [clearingReview, setClearingReview] = useState(false);
  const [releasingItemId, setReleasingItemId] = useState(null);
  const [missingResolutionChoice, setMissingResolutionChoice] = useState({});
  const [settingResolutionItemId, setSettingResolutionItemId] = useState(null);
  const [settlement, setSettlement] = useState(null);
  const [refund, setRefund] = useState(null);
  const [confirmingSettlement, setConfirmingSettlement] = useState(false);
  const [reversingSettlement, setReversingSettlement] = useState(false);
  const [refundDialog, setRefundDialog] = useState(null); // 'complete' | 'fail' | null
  const [refundActionBusy, setRefundActionBusy] = useState(false);

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
        const [rcs, ins] = await Promise.all([
          Promise.all((its || []).map((i) => db.ReturnRequestItemReceipt.filter({ return_request_item_id: i.id }).catch(() => []))),
          Promise.all((its || []).map((i) => db.ReturnRequestItemInspection.filter({ return_request_item_id: i.id }).catch(() => []))),
        ]);
        setReceipts(rcs.flat());
        setInspections(ins.flat());

        let s = await db.ReturnSettlement.filter({ return_request_id: r.id }).then((rows) => rows?.[0] || null).catch(() => null);
        // Auto-calculate the settlement preview once the request is ready --
        // read-only/idempotent, so silently retrying on every load is safe;
        // the RPC itself rejects (silently ignored here) if not ready yet.
        if (!s && r.status === 'processing') {
          try {
            const res = await calculateReturnSettlement(r.id);
            if (res?.success) s = res.settlement;
          } catch {
            // not ready yet -- fine, no settlement to show
          }
        }
        setSettlement(s);
        if (s?.return_refund_id) {
          const rf = await db.ReturnRefund.get(s.return_refund_id).catch(() => null);
          setRefund(rf);
        } else {
          setRefund(null);
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
  const physicalItems = useMemo(() => items.filter(isPhysicalItem), [items]);
  const missingItems = useMemo(() => items.filter((it) => !isPhysicalItem(it)), [items]);
  const isExchangeItem = (it) => request?.request_type === 'exchange' || it.missing_resolution === 'full_exchange';

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

  const clearReview = async () => {
    setClearingReview(true);
    try {
      const res = await adminClearDispositionReview(request.id, null);
      handleResult(res, ar ? 'تم رفع علامة المراجعة الإضافية' : 'Review flag cleared');
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setClearingReview(false);
    }
  };

  const releaseReservation = async (itemId) => {
    setReleasingItemId(itemId);
    try {
      const res = await adminReleaseExchangeReservation(itemId, null);
      handleResult(res, ar ? 'تم إلغاء حجز الاستبدال' : 'Reservation released');
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setReleasingItemId(null);
    }
  };

  const confirmCashCollected = async () => {
    if (!settlement || !window.confirm(ar ? 'تأكيد استلام المبلغ نقدًا من الزبون؟' : 'Confirm the cash was collected from the customer?')) return;
    setConfirmingSettlement(true);
    try {
      const res = await adminConfirmExchangeCashCollected(settlement.id);
      handleResult(res, ar ? 'تم تأكيد استلام المبلغ' : 'Cash collection confirmed');
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setConfirmingSettlement(false);
    }
  };

  const confirmSettlement = async () => {
    if (!settlement) return;
    setConfirmingSettlement(true);
    try {
      const res = await adminConfirmReturnSettlement(settlement.id, settlement.status);
      handleResult(res, ar ? 'تم تأكيد التسوية' : 'Settlement confirmed');
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setConfirmingSettlement(false);
    }
  };

  const reverseSettlement = async (reason) => {
    if (!settlement) return;
    setReversingSettlement(true);
    try {
      const res = await adminReverseSettlement(settlement.id, reason);
      handleResult(res, ar ? 'تم عكس التسوية' : 'Settlement reversed');
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setReversingSettlement(false);
    }
  };

  const completeRefund = async (externalReference, note) => {
    if (!refund) return;
    setRefundActionBusy(true);
    try {
      const res = await adminCompleteManualRefund(refund.id, externalReference, note);
      if (res?.success) { toast({ title: ar ? 'تم إكمال الاسترداد' : 'Refund completed' }); setRefundDialog(null); load(); }
      else toast({ title: res?.message || (ar ? 'حدث خطأ' : 'Something went wrong'), variant: 'destructive' });
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setRefundActionBusy(false);
    }
  };

  const failRefund = async (reason) => {
    if (!refund) return;
    setRefundActionBusy(true);
    try {
      const res = await adminFailRefund(refund.id, reason);
      if (res?.success) { toast({ title: ar ? 'تم تعليم الاسترداد كفاشل' : 'Refund marked failed' }); setRefundDialog(null); load(); }
      else toast({ title: res?.message || (ar ? 'حدث خطأ' : 'Something went wrong'), variant: 'destructive' });
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setRefundActionBusy(false);
    }
  };

  const retryRefund = async () => {
    if (!refund) return;
    setRefundActionBusy(true);
    try {
      const res = await adminRetryRefund(refund.id);
      handleResult(res, ar ? 'تتم إعادة المحاولة' : 'Retrying refund');
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setRefundActionBusy(false);
    }
  };

  const setMissingResolution = async (itemId) => {
    const resolution = missingResolutionChoice[itemId];
    if (!resolution) return;
    setSettingResolutionItemId(itemId);
    try {
      const res = await adminSetMissingResolution(itemId, resolution);
      handleResult(res, ar ? 'تم تحديد طريقة الحل' : 'Resolution set');
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setSettingResolutionItemId(null);
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

        {request.needs_admin_disposition_review && (
          <div className="mt-5 rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start justify-between gap-3 flex-wrap">
            <p className="text-sm text-amber-800">
              {ar
                ? 'المنتج عاد بحالة تالفة/ناقصة رغم أن سياسة السبب تشترط عودته بحالة جيدة. الحل النهائي (طريقة الاسترداد أو الاستبدال) متوقف حتى تراجع الحالة.'
                : 'The item came back damaged/incomplete even though this reason\'s policy requires it back in acceptable condition. Customer resolution is on hold until you review this.'}
            </p>
            <button onClick={clearReview} disabled={clearingReview} className="h-10 px-4 rounded-full bg-amber-800 text-white font-heading font-bold text-sm inline-flex items-center gap-2 shrink-0 disabled:opacity-60">
              {clearingReview && <Loader2 className="w-4 h-4 animate-spin" />} {ar ? 'مراجعة والسماح بالمتابعة' : 'Review & allow to proceed'}
            </button>
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

        {/* Receiving & Inspection (physical items only) */}
        {physicalItems.length > 0 && (
          <Section title={ar ? 'استلام وفحص المنتجات' : 'Receiving & Inspection'}>
            <div className="grid gap-4">
              {physicalItems.map((it) => {
                const { received, remaining } = receivedTotals(it, receipts);
                const totals = inspectionTotals(it, receipts, inspections);
                const canReceive = request.status === 'awaiting_return' && remaining > 0;
                const canInspect = totals.pending > 0;
                return (
                  <div key={it.id} className="rounded-2xl bg-mist/60 p-4">
                    <p className="font-heading font-bold text-sm">{returnItemName(it, lang)}</p>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <Field label={ar ? 'الكمية المعتمدة' : 'Approved qty'} value={it.requested_quantity} />
                      <Field label={ar ? 'المستلمة' : 'Received'} value={received} />
                      <Field label={ar ? 'المتبقية' : 'Remaining'} value={remaining} />
                      <Field label={ar ? 'بانتظار الفحص' : 'Pending inspection'} value={totals.pending} />
                    </div>
                    {(totals.sellable > 0 || totals.damaged > 0 || totals.incomplete > 0) && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {ar ? 'قابل للبيع' : 'Sellable'}: {totals.sellable} · {ar ? 'تالف' : 'Damaged'}: {totals.damaged} · {ar ? 'ناقص' : 'Incomplete'}: {totals.incomplete}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canReceive && (
                        <button onClick={() => { setDialogItem(it); setDialog('receive'); }} className="h-9 px-4 rounded-full bg-cosmic text-white font-heading font-bold text-xs inline-flex items-center gap-1.5">
                          <PackageCheck className="w-3.5 h-3.5" /> {ar ? 'استلام المنتج' : 'Receive Returned Item'}
                        </button>
                      )}
                      {canInspect && (
                        <button onClick={() => { setDialogItem(it); setDialog('inspect'); }} className="h-9 px-4 rounded-full bg-mist border border-border font-heading font-bold text-xs inline-flex items-center gap-1.5">
                          <SearchIcon className="w-3.5 h-3.5" /> {ar ? 'فحص المنتج' : 'Inspect Returned Item'}
                        </button>
                      )}
                      {!canReceive && !canInspect && (
                        <p className="text-xs text-muted-foreground">{ar ? 'لا توجد إجراءات متاحة حالياً لهذا الصنف' : 'No actions currently available for this item'}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Resolution -- refund method (return) / exchange replacement / missing item-part */}
        {(physicalItems.length > 0 || missingItems.length > 0) && (request.status === 'processing' || request.status === 'approved') && (
          <Section title={ar ? 'قرار الحل النهائي' : 'Resolution'}>
            <div className="grid gap-4">
              {request.request_type === 'return' && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{ar ? 'طريقة الاسترداد التي اختارها الزبون' : "Customer's chosen refund method"}</p>
                  <p className="text-sm font-medium">
                    {request.refund_method ? refundMethodLabel(request.refund_method, lang) : (ar ? 'لم يختر الزبون بعد' : 'Not selected yet')}
                  </p>
                </div>
              )}

              {items.filter((it) => isExchangeItem(it)).map((it) => (
                <div key={it.id} className="rounded-2xl bg-mist/60 p-4">
                  <p className="font-heading font-bold text-sm mb-2">{returnItemName(it, lang)} — {ar ? 'الاستبدال' : 'Exchange'}</p>
                  {it.replacement_reserved_at ? (
                    <div className="grid gap-1 text-sm">
                      <SummaryRow label={ar ? 'المنتج البديل' : 'Replacement product'} value={products[it.replacement_product_id]?.name || it.replacement_product_id} />
                      <SummaryRow label={ar ? 'الكمية' : 'Quantity'} value={it.replacement_quantity} />
                      <SummaryRow label={ar ? 'السعر' : 'Unit price'} value={it.replacement_unit_price?.toFixed?.(2)} dir="ltr" />
                      <SummaryRow
                        label={ar ? 'الفرق المتوقع' : 'Expected difference'}
                        value={it.replacement_price_difference > 0
                          ? (ar ? `الزبون يدفع ${it.replacement_price_difference.toFixed(2)}` : `Customer owes ${it.replacement_price_difference.toFixed(2)}`)
                          : it.replacement_price_difference < 0
                            ? (ar ? `يُرد للزبون ${Math.abs(it.replacement_price_difference).toFixed(2)}` : `Customer is owed ${Math.abs(it.replacement_price_difference).toFixed(2)}`)
                            : (ar ? 'لا يوجد فرق' : 'No difference')}
                      />
                      <button
                        onClick={() => releaseReservation(it.id)}
                        disabled={releasingItemId === it.id}
                        className="mt-2 justify-self-start h-9 px-4 rounded-full bg-destructive/10 text-destructive font-heading font-bold text-xs inline-flex items-center gap-1.5 disabled:opacity-60"
                      >
                        {releasingItemId === it.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {ar ? 'إلغاء الحجز' : 'Release Reservation'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{ar ? 'لم يختر الزبون البديل بعد' : 'Customer has not selected a replacement yet'}</p>
                  )}
                </div>
              ))}

              {missingItems.filter((it) => !it.missing_resolution).map((it) => (
                <div key={it.id} className="rounded-2xl bg-mist/60 p-4">
                  <p className="font-heading font-bold text-sm mb-2">{returnItemName(it, lang)} — {ar ? 'صنف/قطعة ناقصة' : 'Missing item/part'}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={missingResolutionChoice[it.id] || ''}
                      onChange={(e) => setMissingResolutionChoice((s) => ({ ...s, [it.id]: e.target.value }))}
                      className="h-10 px-3 rounded-2xl bg-mist border border-border text-sm"
                    >
                      <option value="">{ar ? 'اختر طريقة الحل' : 'Choose a resolution'}</option>
                      {it.resolution_type === 'missing_item' && <option value="send_missing_item">{missingResolutionLabel('send_missing_item', lang)}</option>}
                      {it.resolution_type === 'missing_part' && <option value="send_missing_part">{missingResolutionLabel('send_missing_part', lang)}</option>}
                      {it.resolution_type === 'missing_part' && <option value="full_exchange">{missingResolutionLabel('full_exchange', lang)}</option>}
                    </select>
                    <button
                      onClick={() => setMissingResolution(it.id)}
                      disabled={!missingResolutionChoice[it.id] || settingResolutionItemId === it.id}
                      className="h-10 px-4 rounded-full bg-cosmic text-white font-heading font-bold text-sm disabled:opacity-60 inline-flex items-center gap-1.5"
                    >
                      {settingResolutionItemId === it.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {ar ? 'تأكيد' : 'Confirm'}
                    </button>
                  </div>
                </div>
              ))}
              {missingItems.filter((it) => it.missing_resolution).map((it) => (
                <Field key={it.id} label={returnItemName(it, lang)} value={missingResolutionLabel(it.missing_resolution, lang)} />
              ))}
            </div>
          </Section>
        )}

        {/* Financial Settlement -- kept separate from operational receiving/
            inspection details (section 56). Read-only preview once
            calculated; money only moves via the explicit Confirm action. */}
        {settlement && (
          <Section title={ar ? 'التسوية المالية' : 'Financial Settlement'}>
            <div className="grid gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label={ar ? 'القيمة المستحقة للإرجاع' : 'Eligible Return Value'} value={settlement.eligible_merchandise_value?.toFixed?.(2)} dir="ltr" />
                <Field label={ar ? 'استرداد رسوم التوصيل الأصلية' : 'Original delivery refund'} value={(0).toFixed(2)} dir="ltr" />
                {settlement.request_type === 'return' && (
                  <Field label={ar ? 'طريقة الاسترداد' : 'Refund method'} value={settlement.refund_method ? refundMethodLabel(settlement.refund_method, lang) : '—'} />
                )}
                {settlement.points_to_restore > 0 && (
                  <Field label={ar ? 'نقاط ولاء مستردة' : 'Loyalty points restored'} value={`${settlement.points_to_restore}${settlement.points_restored ? '' : (ar ? ' (لم تُسترد بعد)' : ' (not yet restored)')}`} />
                )}
                {settlement.request_type === 'return' && (
                  <Field label={ar ? 'المبلغ النقدي' : 'Cash amount'} value={settlement.cash_settlement_amount?.toFixed?.(2)} dir="ltr" />
                )}
                {settlement.request_type === 'exchange' && typeof settlement.exchange_difference === 'number' && (
                  <Field
                    label={ar ? 'فرق الاستبدال' : 'Exchange difference'}
                    value={settlement.exchange_difference > 0
                      ? (ar ? `الزبون يدفع ${settlement.exchange_difference.toFixed(2)}` : `Customer owes ${settlement.exchange_difference.toFixed(2)}`)
                      : settlement.exchange_difference < 0
                        ? (ar ? `HiKids يدفع ${Math.abs(settlement.exchange_difference).toFixed(2)}` : `HiKids owes ${Math.abs(settlement.exchange_difference).toFixed(2)}`)
                        : (ar ? 'لا يوجد فرق' : 'No difference')}
                  />
                )}
                <Field label={ar ? 'حالة التسوية' : 'Settlement status'} value={settlementStatusLabel(settlement.status, lang)} />
              </div>

              {refund && (
                <div className="rounded-2xl bg-mist/60 p-4 grid gap-2">
                  <p className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">{ar ? 'سجل الاسترداد' : 'Refund Record'}</p>
                  <SummaryRow label={ar ? 'رقم الاسترداد' : 'Refund code'} value={refund.refund_code} dir="ltr" />
                  <SummaryRow label={ar ? 'المبلغ' : 'Amount'} value={refund.amount?.toFixed?.(2)} dir="ltr" />
                  <SummaryRow label={ar ? 'الحالة' : 'Status'} value={refundStatusLabel(refund.status, lang)} />
                  {refund.external_reference && <SummaryRow label={ar ? 'المرجع' : 'Reference'} value={refund.external_reference} dir="ltr" />}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {refund.status === 'processing' && (
                      <>
                        <button onClick={() => setRefundDialog('complete')} className="h-9 px-4 rounded-full bg-emerald-600 text-white font-heading font-bold text-xs">
                          {ar ? 'تأكيد إتمام الاسترداد' : 'Confirm Refund Completed'}
                        </button>
                        <button onClick={() => setRefundDialog('fail')} className="h-9 px-4 rounded-full bg-destructive/10 text-destructive font-heading font-bold text-xs">
                          {ar ? 'تعليم كفاشل' : 'Mark Failed'}
                        </button>
                      </>
                    )}
                    {refund.status === 'failed' && (
                      <button onClick={retryRefund} disabled={refundActionBusy} className="h-9 px-4 rounded-full bg-cosmic text-white font-heading font-bold text-xs disabled:opacity-60">
                        {ar ? 'إعادة المحاولة' : 'Retry'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {settlement.status === 'confirmed' && settlement.exchange_difference_status === 'cod_pending' && (
                  <button onClick={confirmCashCollected} disabled={confirmingSettlement} className="h-11 px-5 rounded-full bg-emerald-600 text-white font-heading font-bold disabled:opacity-60">
                    {ar ? `تم استلام ${settlement.exchange_difference?.toFixed?.(2)} نقدًا` : `Cash ${settlement.exchange_difference?.toFixed?.(2)} collected`}
                  </button>
                )}
                {settlement.status === 'calculated' && (
                  <button onClick={confirmSettlement} disabled={confirmingSettlement} className="h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center gap-2 disabled:opacity-60">
                    {confirmingSettlement && <Loader2 className="w-4 h-4 animate-spin" />} {ar ? 'تأكيد التسوية' : 'Confirm Settlement'}
                  </button>
                )}
                {settlement.status === 'completed' && (
                  <button onClick={() => setRefundDialog('reverse')} className="h-11 px-5 rounded-full bg-destructive/10 text-destructive font-heading font-bold text-sm">
                    {ar ? 'عكس التسوية' : 'Reverse Settlement'}
                  </button>
                )}
              </div>
            </div>
          </Section>
        )}

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
      {dialog === 'receive' && dialogItem && (
        <ReceiveDialog
          item={dialogItem} remaining={receivedTotals(dialogItem, receipts).remaining} lang={lang}
          onClose={() => { setDialog(null); setDialogItem(null); }}
          onConfirm={async (quantity, note, photos, idempotencyKey) => {
            const res = await adminReceiveReturnItem(dialogItem.id, quantity, note, photos, idempotencyKey);
            return handleResult(res, ar ? 'تم تسجيل الاستلام' : 'Receiving recorded');
          }}
        />
      )}
      {dialog === 'inspect' && dialogItem && (
        <InspectDialog
          item={dialogItem} pending={inspectionTotals(dialogItem, receipts, inspections).pending} lang={lang}
          onClose={() => { setDialog(null); setDialogItem(null); }}
          onConfirm={async (quantity, condition, note, photos, idempotencyKey) => {
            const res = await adminInspectReturnItem(dialogItem.id, quantity, condition, note, photos, idempotencyKey);
            return handleResult(res, ar ? 'تم تسجيل الفحص' : 'Inspection recorded');
          }}
        />
      )}
      {refundDialog === 'complete' && (
        <CompleteRefundDialog
          refund={refund} lang={lang} busy={refundActionBusy}
          onClose={() => setRefundDialog(null)}
          onConfirm={completeRefund}
        />
      )}
      {refundDialog === 'fail' && (
        <ReasonDialog
          title={ar ? 'تعليم الاسترداد كفاشل' : 'Mark Refund Failed'}
          label={ar ? 'سبب الفشل (داخلي فقط)' : 'Failure reason (internal only)'}
          confirmLabel={ar ? 'تأكيد' : 'Confirm'} confirmClass="bg-destructive hover:bg-destructive/90"
          lang={lang} busy={refundActionBusy}
          onClose={() => setRefundDialog(null)}
          onConfirm={failRefund}
        />
      )}
      {refundDialog === 'reverse' && (
        <ReasonDialog
          title={ar ? 'عكس التسوية المالية' : 'Reverse Financial Settlement'}
          label={ar ? 'سبب العكس (داخلي فقط)' : 'Reversal reason (internal only)'}
          confirmLabel={ar ? 'تأكيد العكس' : 'Confirm Reversal'} confirmClass="bg-destructive hover:bg-destructive/90"
          lang={lang} busy={reversingSettlement}
          onClose={() => setRefundDialog(null)}
          onConfirm={async (reason) => { await reverseSettlement(reason); setRefundDialog(null); }}
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
  const display = value === 0 ? 0 : (value || '—');
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words" dir={dir}>{display}</p>
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

// Staff-only inspection/receiving photos -- the default uploadFile() bucket
// ('uploads', admin-only per storage RLS), never the customer-uploads
// bucket, keeping inspection evidence structurally distinct from customer
// evidence (section 19).
function StaffPhotoUploader({ photos, setPhotos, lang }) {
  const ar = lang === 'ar';
  const [uploading, setUploading] = useState(false);

  const addPhotos = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const { file_url } = await uploadFile(file);
        setPhotos((prev) => [...prev, file_url]);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <p className="text-sm font-medium text-foreground/80 mb-1.5">{ar ? 'صور (اختياري)' : 'Photos (optional)'}</p>
      <div className="flex flex-wrap gap-2">
        {photos.map((url, i) => (
          <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden bg-mist">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} className="absolute top-0.5 end-0.5 grid place-items-center w-5 h-5 rounded-full bg-black/60 text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <label className="w-16 h-16 rounded-xl border-2 border-dashed border-border grid place-items-center cursor-pointer text-muted-foreground">
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
          <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={(e) => addPhotos(e.target.files)} />
        </label>
      </div>
    </div>
  );
}

function ReceiveDialog({ item, remaining, lang, onClose, onConfirm }) {
  const ar = lang === 'ar';
  const [quantity, setQuantity] = useState(remaining);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const guardedClose = useGuardedClose(!!note.trim(), onClose, lang);

  const valid = Number(quantity) > 0 && Number(quantity) <= remaining;

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    try {
      await onConfirm(Number(quantity), note.trim(), photos, idempotencyKey);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={ar ? 'استلام المنتج' : 'Receive Returned Item'} onClose={submitting ? () => {} : guardedClose}>
      <p className="text-sm text-muted-foreground">{returnItemName(item, lang)}</p>
      <FormInput
        label={ar ? `الكمية المستلمة (الحد الأقصى ${remaining})` : `Received quantity (max ${remaining})`}
        type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)}
      />
      <FormInput label={ar ? 'ملاحظة (اختياري)' : 'Note (optional)'} value={note} onChange={(e) => setNote(e.target.value)} textarea />
      <StaffPhotoUploader photos={photos} setPhotos={setPhotos} lang={lang} />
      <DialogActions onCancel={guardedClose} onConfirm={submit} confirmDisabled={!valid} submitting={submitting} confirmLabel={ar ? 'تأكيد الاستلام' : 'Confirm Receiving'} confirmClass="bg-cosmic hover:bg-cosmic/90" lang={lang} />
    </Modal>
  );
}

function InspectDialog({ item, pending, lang, onClose, onConfirm }) {
  const ar = lang === 'ar';
  const [quantity, setQuantity] = useState(pending);
  const [condition, setCondition] = useState('sellable');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const guardedClose = useGuardedClose(!!note.trim(), onClose, lang);

  const valid = Number(quantity) > 0 && Number(quantity) <= pending && INSPECTION_CONDITIONS.includes(condition);

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    try {
      await onConfirm(Number(quantity), condition, note.trim(), photos, idempotencyKey);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={ar ? 'فحص المنتج' : 'Inspect Returned Item'} onClose={submitting ? () => {} : guardedClose}>
      <p className="text-sm text-muted-foreground">{returnItemName(item, lang)}</p>
      <FormInput
        label={ar ? `الكمية قيد الفحص (الحد الأقصى ${pending})` : `Quantity being inspected (max ${pending})`}
        type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)}
      />
      <div>
        <p className="text-sm font-medium text-foreground/80 mb-1.5">{ar ? 'الحالة' : 'Condition'}</p>
        <div className="grid grid-cols-2 gap-2">
          {INSPECTION_CONDITIONS.map((c) => (
            <label key={c} className={`flex items-center gap-2 h-11 px-3.5 rounded-2xl border cursor-pointer ${condition === c ? 'border-cosmic bg-cosmic/5' : 'border-border bg-mist'}`}>
              <input type="radio" checked={condition === c} onChange={() => setCondition(c)} className="w-4 h-4 accent-cosmic" />
              <span className="text-sm font-medium">{inspectionConditionLabel(c, lang)}</span>
            </label>
          ))}
        </div>
      </div>
      <FormInput label={ar ? 'ملاحظة (اختياري)' : 'Note (optional)'} value={note} onChange={(e) => setNote(e.target.value)} textarea />
      <StaffPhotoUploader photos={photos} setPhotos={setPhotos} lang={lang} />
      {condition === 'sellable' && (
        <p className="text-xs text-muted-foreground -mt-2">{ar ? 'سيتم إضافة هذه الكمية إلى المخزون المتاح تلقائياً.' : 'This quantity will be added to available stock automatically.'}</p>
      )}
      <DialogActions onCancel={guardedClose} onConfirm={submit} confirmDisabled={!valid} submitting={submitting} confirmLabel={ar ? 'تأكيد الفحص' : 'Confirm Inspection'} confirmClass="bg-cosmic hover:bg-cosmic/90" lang={lang} />
    </Modal>
  );
}

// Completing a manual refund requires an explicit payment reference --
// never a bare one-click "done" (section 58).
function CompleteRefundDialog({ refund, lang, busy, onClose, onConfirm }) {
  const ar = lang === 'ar';
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const guardedClose = useGuardedClose(!!reference.trim() || !!note.trim(), onClose, lang);

  return (
    <Modal title={ar ? 'تأكيد إتمام الاسترداد' : 'Confirm Refund Completed'} onClose={busy ? () => {} : guardedClose}>
      <p className="text-sm text-muted-foreground">
        {ar ? `المبلغ: ${refund?.amount?.toFixed?.(2)}` : `Amount: ${refund?.amount?.toFixed?.(2)}`}
      </p>
      <FormInput label={ar ? 'مرجع الدفع (رقم التحويل مثلاً) *' : 'Payment reference (e.g. transfer number) *'} value={reference} onChange={(e) => setReference(e.target.value)} required />
      <FormInput label={ar ? 'ملاحظة داخلية (اختياري)' : 'Internal note (optional)'} value={note} onChange={(e) => setNote(e.target.value)} textarea />
      <DialogActions
        onCancel={guardedClose} submitting={busy} confirmDisabled={!reference.trim()}
        onConfirm={() => onConfirm(reference.trim(), note.trim())}
        confirmLabel={ar ? 'تأكيد الإتمام' : 'Confirm Completed'} confirmClass="bg-emerald-600 hover:bg-emerald-700" lang={lang}
      />
    </Modal>
  );
}

// Shared reason-required dialog for failing a refund or reversing a
// settlement -- the text is stored internally (return_request_notes), never
// in the customer-visible activity log (see migration 0035's comments).
function ReasonDialog({ title, label, confirmLabel, confirmClass, lang, busy, onClose, onConfirm }) {
  const ar = lang === 'ar';
  const [reason, setReason] = useState('');
  const guardedClose = useGuardedClose(!!reason.trim(), onClose, lang);

  return (
    <Modal title={title} onClose={busy ? () => {} : guardedClose}>
      <FormInput label={label} value={reason} onChange={(e) => setReason(e.target.value)} textarea required />
      <DialogActions
        onCancel={guardedClose} submitting={busy} confirmDisabled={!reason.trim()}
        onConfirm={() => onConfirm(reason.trim())}
        confirmLabel={confirmLabel} confirmClass={confirmClass} lang={lang}
      />
    </Modal>
  );
}
