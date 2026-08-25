import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Lock, Save, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { unwrap } from '@/lib/invoke';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import FormInput from '@/components/admin/FormInput';
import SheetSelect from '@/components/ui/SheetSelect';
import SupplierSelect from '@/components/po/SupplierSelect';
import ProductSearch from '@/components/po/ProductSearch';
import POLineItems from '@/components/po/POLineItems';
import { PAYMENT_METHODS, computePaymentStatus, generatePoNumber, lineTotal, poSubtotal, productSku } from '@/lib/po';
import { supplierBalance } from '@/lib/suppliers';

const EMPTY = {
  po_number: '',
  purchase_date: new Date().toISOString().slice(0, 10),
  supplier_id: '',
  supplier_invoice_ref: '',
  notes: '',
  payment_method: 'cash',
  paid_amount: '',
  items: [],
};

export default function POEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang, formatPrice } = useLanguage();
  const { toast } = useToast();
  const ar = lang === 'ar';

  const [form, setForm] = useState(EMPTY);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const loadMeta = async () => {
    const [s, p, tx] = await Promise.all([
      base44.entities.Supplier.list('name', 200),
      base44.entities.Product.list('-updated_date', 500),
      base44.entities.SupplierTransaction.list('-created_date', 500),
    ]);
    setSuppliers(s || []);
    setProducts(p || []);
    setTxs(tx || []);
  };

  useEffect(() => {
    loadMeta();
    if (isNew) {
      base44.entities.PurchaseOrder.list('-created_date', 500).then((list) => {
        setForm((f) => ({ ...f, po_number: generatePoNumber(list || []) }));
      });
      setLoading(false);
    } else {
      setLoading(true);
      base44.entities.PurchaseOrder.get(id)
        .then((po) => setForm({ ...EMPTY, ...po, paid_amount: po.paid_amount ?? '' }))
        .catch(() => toast({ title: ar ? 'الأمر غير موجود' : 'Order not found', variant: 'destructive' }))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  if (user?.role !== 'admin') {
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

  const subtotal = poSubtotal(form.items);
  const paid = Math.max(0, Math.min(subtotal, Number(form.paid_amount) || 0));
  const remaining = Math.max(0, subtotal - paid);
  const paymentStatus = computePaymentStatus(subtotal, paid);
  const readOnly = !isNew && form.status && form.status !== 'draft';

  const selectedSupplierBalance = useMemo(
    () => supplierBalance(txs.filter((x) => x.supplier_id === form.supplier_id)),
    [txs, form.supplier_id]
  );

  const addProduct = (p) => {
    const existingIdx = form.items.findIndex((it) => it.product_id === p.id);
    if (existingIdx >= 0) {
      // Duplicate product line — increment quantity rather than add a new row.
      const items = [...form.items];
      const newQty = (Number(items[existingIdx].quantity) || 0) + 1;
      items[existingIdx] = { ...items[existingIdx], quantity: newQty, total: lineTotal({ ...items[existingIdx], quantity: newQty }) };
      set('items', items);
      toast({ title: ar ? 'تمت زيادة الكمية' : 'Quantity increased' });
    } else {
      const line = {
        product_id: p.id,
        sku: productSku(p),
        name: p.name,
        quantity: 1,
        unit_cost: p.unit_cost ?? '',
        total: lineTotal({ quantity: 1, unit_cost: p.unit_cost ?? 0 }),
      };
      set('items', [...form.items, line]);
    }
  };

  const buildPayload = (statusOverride) => {
    const items = form.items.map((it) => ({
      product_id: it.product_id,
      sku: it.sku || '',
      name: it.name || '',
      quantity: Number(it.quantity) || 0,
      unit_cost: it.unit_cost === '' || it.unit_cost == null ? null : Number(it.unit_cost),
      total: lineTotal(it),
    }));
    const sub = items.reduce((s, l) => s + lineTotal(l), 0);
    const paidVal = Math.max(0, Math.min(sub, Number(form.paid_amount) || 0));
    const supplier = suppliers.find((s) => s.id === form.supplier_id);
    return {
      po_number: form.po_number,
      purchase_date: form.purchase_date,
      supplier_id: form.supplier_id,
      supplier_name: supplier?.name || form.supplier_name || '',
      supplier_invoice_ref: form.supplier_invoice_ref,
      notes: form.notes,
      payment_method: form.payment_method,
      payment_status: computePaymentStatus(sub, paidVal),
      status: statusOverride || form.status || 'draft',
      items,
      subtotal: sub,
      total: sub,
      paid_amount: paidVal,
      remaining: Math.max(0, sub - paidVal),
      created_by_email: user?.email || '',
    };
  };

  const persist = async (payload) => (isNew ? base44.entities.PurchaseOrder.create(payload) : base44.entities.PurchaseOrder.update(id, payload));

  const saveDraft = async (e) => {
    e.preventDefault();
    if (!form.supplier_id) { toast({ title: ar ? 'اختر مورّدًا' : 'Select a supplier', variant: 'destructive' }); return; }
    if (!form.items.length) { toast({ title: ar ? 'أضف منتجات' : 'Add products', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload = buildPayload('draft');
      const res = await persist(payload);
      const newId = isNew ? res?.id : id;
      await base44.functions.invoke('logAuditActivity', {
        action: isNew ? 'po.created' : 'po.updated', target_type: 'purchase_order', target_id: newId,
        details: `${payload.po_number} — ${payload.total}`,
      }).catch(() => {});
      toast({ title: ar ? 'تم الحفظ كمسودة' : 'Saved as draft' });
      navigate('/admin/po');
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const post = async () => {
    if (!form.supplier_id) { toast({ title: ar ? 'اختر مورّدًا' : 'Select a supplier', variant: 'destructive' }); return; }
    if (!form.items.length) { toast({ title: ar ? 'أضف منتجات' : 'Add products', variant: 'destructive' }); return; }
    if (!window.confirm(ar ? 'ترحيل أمر الشراء؟ سيتم تحديث المخزون وتكلفة الوحدة ورصيد المورّد.' : 'Post this order? Inventory, unit cost and supplier balance will update.')) return;
    setPosting(true);
    try {
      const payload = buildPayload('draft');
      const res = await persist(payload);
      const poId = isNew ? res?.id : id;
      const out = unwrap(await base44.functions.invoke('postPurchaseOrder', { po_id: poId }));
      if (out.success === false) throw new Error(out.message || 'Post failed');
      toast({ title: ar ? 'تم الترحيل — تحقق من المخزون' : 'Posted — inventory updated' });
      navigate('/admin/po');
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10">
        <Link to="/admin/po" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" /> {ar ? 'أوامر الشراء' : 'Purchase orders'}
        </Link>
        <h1 className="mt-5 font-heading font-extrabold text-3xl md:text-4xl">
          {isNew ? (ar ? 'أمر شراء جديد' : 'New purchase order') : (ar ? 'أمر شراء #' : 'Purchase order #') + (form.po_number || '')}
        </h1>
        {readOnly && (
          <p className="mt-2 text-sm rounded-full inline-block px-3 py-1 bg-highlight/40 border border-highlight/60">
            {ar ? 'تم الترحيل — غير قابل للتعديل. ألغِ الأمر للتعديل.' : 'Posted — read only. Cancel to edit.'}
          </p>
        )}

        {loading ? (
          <div className="mt-12 grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : (
          <form onSubmit={saveDraft} className="mt-8 grid gap-6">
            <fieldset disabled={readOnly} className="contents">
            {/* Header */}
            <section className="rounded-3xl bg-card border border-border/60 p-5 sm:p-6 grid sm:grid-cols-2 gap-4">
              <FormInput label={ar ? 'رقم أمر الشراء' : 'PO number'} value={form.po_number} onChange={(e) => set('po_number', e.target.value)} required readOnly={readOnly} />
              <FormInput label={ar ? 'تاريخ الشراء' : 'Purchase date'} type="date" value={form.purchase_date} onChange={(e) => set('purchase_date', e.target.value)} required readOnly={readOnly} />
              <div className="sm:col-span-2">
                <span className="text-sm font-medium text-foreground/80">{ar ? 'المورّد' : 'Supplier'} <span className="text-accent">*</span></span>
                <div className="mt-1.5">
                  <SupplierSelect
                    suppliers={suppliers}
                    value={form.supplier_id}
                    onChange={(v) => set('supplier_id', v)}
                    balance={form.supplier_id ? selectedSupplierBalance : null}
                    onSupplierCreated={async (s) => { await loadMeta(); set('supplier_id', s.id); }}
                  />
                </div>
              </div>
              <FormInput label={ar ? 'رقم فاتورة المورّد / المرجع' : 'Supplier invoice / reference'} value={form.supplier_invoice_ref} onChange={(e) => set('supplier_invoice_ref', e.target.value)} readOnly={readOnly} />
              <label className="block">
                <span className="text-sm font-medium text-foreground/80">{ar ? 'طريقة الدفع' : 'Payment method'}</span>
                <SheetSelect
                  value={form.payment_method}
                  onChange={(v) => set('payment_method', v)}
                  options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
                  placeholder={ar ? 'اختر' : 'Select'}
                  label={ar ? 'طريقة الدفع' : 'Payment method'}
                  includeEmpty={false}
                  className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40"
                />
              </label>
              <FormInput label={ar ? 'ملاحظات' : 'Notes'} value={form.notes} onChange={(e) => set('notes', e.target.value)} textarea className="sm:col-span-2" readOnly={readOnly} />
            </section>

            {/* Line items */}
            <section className="rounded-3xl bg-card border border-border/60 p-5 sm:p-6">
              <p className="font-heading font-bold">{ar ? 'المنتجات' : 'Products'}</p>
              {!readOnly && (
                <div className="mt-3">
                  <ProductSearch products={products} onAdd={addProduct} />
                </div>
              )}
              <div className="mt-4">
                <POLineItems items={form.items} onChange={(items) => set('items', items)} readOnly={readOnly} />
              </div>
            </section>
            </fieldset>

            {/* Totals + payment */}
            <section className="rounded-3xl bg-card border border-border/60 p-5 sm:p-6 grid sm:grid-cols-2 gap-4">
              <div>
                <p className="font-heading font-bold">{ar ? 'الإجمالي' : 'Totals'}</p>
                <div className="mt-3 space-y-1.5 text-sm">
                  <Row label={ar ? 'الإجمالي الفرعي' : 'Subtotal'} value={formatPrice(subtotal)} />
                  <FormInput label={ar ? 'المبلغ المدفوع' : 'Amount paid'} type="number" value={form.paid_amount} onChange={(e) => set('paid_amount', e.target.value)} readOnly={readOnly} />
                  <Row label={ar ? 'المتبقي على المورّد' : 'Remaining owed'} value={formatPrice(remaining)} strong />
                  <Row label={ar ? 'حالة الدفع' : 'Payment status'} value={paymentStatus} />
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:items-end justify-end">
                {!readOnly ? (
                  <>
                    <button type="submit" disabled={saving || posting} className="squish w-full sm:w-auto h-12 px-6 rounded-full bg-mist font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {ar ? 'حفظ كمسودة' : 'Save as draft'}
                    </button>
                    <button type="button" onClick={post} disabled={saving || posting} className="squish w-full sm:w-auto h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
                      {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {ar ? 'ترحيل الأمر' : 'Post order'}
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => navigate('/admin/po')} className="squish h-12 px-6 rounded-full bg-mist font-heading font-bold">{t('admin.back') || t('pd.back')}</button>
                )}
                {!readOnly && (
                  <button type="button" onClick={() => navigate('/admin/po')} className="squish h-12 px-6 rounded-full bg-mist font-heading font-bold">{t('admin.cancel')}</button>
                )}
              </div>
            </section>
          </form>
        )}
      </div>
      <Footer />
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'font-heading font-extrabold text-cosmic' : 'font-medium'}>{value}</span>
    </div>
  );
}