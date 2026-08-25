import React, { useState } from 'react';
import { Loader2, Pencil, Trash2, Wallet, ArrowDownLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { supplierBalance } from '@/lib/suppliers';
import SupplierFormDialog from './SupplierFormDialog';

// Supplier account view: current balance (ledger-derived), full transaction
// history (purchases / payments / reversals), the supplier's purchase orders,
// and a record-payment form. Edit & delete from here too.
export default function SupplierDetailDialog({ open, onOpenChange, supplier, txs, pos, onChanged, onDeleted }) {
  const { t, lang, formatPrice } = useLanguage();
  const { toast } = useToast();
  const ar = lang === 'ar';
  const [editOpen, setEditOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payReason, setPayReason] = useState('');
  const [saving, setSaving] = useState(false);

  if (!supplier) return null;

  const balance = supplierBalance(txs);
  const supplierTxs = [...txs].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  const supplierPos = (pos || []).filter((p) => p.supplier_id === supplier.id);

  const recordPayment = async (e) => {
    e.preventDefault();
    const amount = Math.abs(Number(payAmount) || 0);
    if (!amount) {
      toast({ title: ar ? 'أدخل المبلغ' : 'Enter amount', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await base44.functions.invoke('recordSupplierPayment', {
        supplier_id: supplier.id,
        amount,
        reason: payReason || (ar ? 'دفعة للمورد' : 'Supplier payment'),
      });
      toast({ title: ar ? 'تم تسجيل الدفعة' : 'Payment recorded' });
      setPayAmount('');
      setPayReason('');
      onChanged?.();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!window.confirm(ar ? 'حذف هذا المورّد؟ لن يتم حذف حركته المحاسبية.' : 'Delete this supplier? Ledger entries are kept.')) return;
    try {
      await base44.entities.Supplier.delete(supplier.id);
      toast({ title: ar ? 'تم الحذف' : 'Deleted' });
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    }
  };

  const txLabel = (type) => ({
    PURCHASE: ar ? 'شراء' : 'Purchase',
    PAYMENT: ar ? 'دفعة' : 'Payment',
    REVERSAL: ar ? 'عكس' : 'Reversal',
    ADJUSTMENT: ar ? 'تسوية' : 'Adjustment',
  }[type] || type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="font-heading font-extrabold">{supplier.name}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="rounded-2xl bg-cosmic/10 border border-cosmic/20 px-4 py-3 flex-1 min-w-[12rem]">
            <p className="text-xs text-muted-foreground">{ar ? 'الرصيد المستحق حاليًا' : 'Current outstanding balance'}</p>
            <p className="font-heading font-extrabold text-2xl text-cosmic">{formatPrice(balance)}</p>
          </div>
          <button onClick={() => setEditOpen(true)} className="squish h-11 px-4 rounded-full bg-mist font-heading font-bold text-sm inline-flex items-center gap-1.5">
            <Pencil className="w-4 h-4" /> {t('admin.edit')}
          </button>
          <button onClick={del} className="squish grid place-items-center w-11 h-11 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {(supplier.phone || supplier.email || supplier.contact_person || supplier.address) && (
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            {supplier.phone && <p><span className="text-muted-foreground">{ar ? 'الهاتف' : 'Phone'}: </span>{supplier.phone}</p>}
            {supplier.email && <p><span className="text-muted-foreground">{ar ? 'البريد' : 'Email'}: </span>{supplier.email}</p>}
            {supplier.contact_person && <p><span className="text-muted-foreground">{ar ? 'جهة الاتصال' : 'Contact'}: </span>{supplier.contact_person}</p>}
            {supplier.address && <p className="sm:col-span-2"><span className="text-muted-foreground">{ar ? 'العنوان' : 'Address'}: </span>{supplier.address}</p>}
          </div>
        )}

        {/* Record payment */}
        <form onSubmit={recordPayment} className="rounded-2xl bg-mist/60 border border-border/60 p-4">
          <p className="font-heading font-bold text-sm mb-2 inline-flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4" /> {ar ? 'تسجيل دفعة' : 'Record payment'}
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs text-muted-foreground">{ar ? 'المبلغ' : 'Amount'}</span>
              <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="mt-1 w-full h-11 px-3 rounded-xl bg-background border border-border text-sm" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs text-muted-foreground">{ar ? 'السبب / المرجع' : 'Reason / reference'}</span>
              <input value={payReason} onChange={(e) => setPayReason(e.target.value)} className="mt-1 w-full h-11 px-3 rounded-xl bg-background border border-border text-sm" />
            </label>
          </div>
          <button type="submit" disabled={saving} className="squish mt-3 h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold text-sm inline-flex items-center gap-2 disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {ar ? 'حفظ الدفعة' : 'Save payment'}
          </button>
        </form>

        {/* Purchase history */}
        {supplierPos.length > 0 && (
          <div>
            <p className="font-heading font-bold text-sm mb-2">{ar ? 'أوامر الشراء' : 'Purchase orders'}</p>
            <div className="grid gap-2">
              {supplierPos.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-mist/60 border border-border/60 px-3 py-2 text-sm">
                  <div>
                    <p className="font-heading font-bold">{p.po_number}</p>
                    <p className="text-xs text-muted-foreground">{p.purchase_date} · {p.status}</p>
                  </div>
                  <p className="font-heading font-extrabold text-cosmic">{formatPrice(p.total)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ledger */}
        <div>
          <p className="font-heading font-bold text-sm mb-2 inline-flex items-center gap-2">
            <Wallet className="w-4 h-4" /> {ar ? 'الحركة المحاسبية' : 'Account activity'}
          </p>
          {supplierTxs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{ar ? 'لا توجد حركات بعد' : 'No transactions yet'}</p>
          ) : (
            <div className="grid gap-1.5">
              {supplierTxs.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-3 text-sm border-b border-border/40 py-1.5">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {txLabel(tx.type)} {tx.po_number ? `· ${tx.po_number}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">{tx.reason || '—'} · {new Date(tx.created_date).toLocaleDateString()}</p>
                  </div>
                  <p className={`font-heading font-bold whitespace-nowrap ${Number(tx.amount) >= 0 ? 'text-cosmic' : 'text-emerald-600'}`}>
                    {Number(tx.amount) >= 0 ? '+' : ''}{formatPrice(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className="squish h-11 px-5 rounded-full bg-mist font-heading font-bold">{t('admin.cancel')}</button>
        </DialogFooter>
      </DialogContent>

      <SupplierFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={supplier}
        onSaved={() => onChanged?.()}
      />
    </Dialog>
  );
}