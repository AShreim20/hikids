import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Lock, Loader2, Pencil, Trash2, Send, Ban, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { unwrap } from '@/lib/invoke';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import SheetSelect from '@/components/ui/SheetSelect';
import { PO_PAYMENT_STATUSES, PO_STATUSES } from '@/lib/po';

export default function PurchaseOrders() {
  const { user } = useAuth();
  const { t, lang, formatPrice } = useLanguage();
  const { toast } = useToast();
  const ar = lang === 'ar';
  const navigate = useNavigate();

  const [pos, setPos] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [q, setQ] = useState('');
  const [fSupplier, setFSupplier] = useState('');
  const [fPay, setFPay] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      base44.entities.PurchaseOrder.list('-created_date', 500),
      base44.entities.Supplier.list('name', 200),
    ])
      .then(([list, s]) => { setPos(list || []); setSuppliers(s || []); })
      .catch(() => { setPos([]); setSuppliers([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
    else setLoading(false);
  }, [user]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return pos.filter((p) => {
      if (term && !(`${p.po_number} ${p.supplier_name}`.toLowerCase().includes(term))) return false;
      if (fSupplier && p.supplier_id !== fSupplier) return false;
      if (fPay && p.payment_status !== fPay) return false;
      if (fStatus && p.status !== fStatus) return false;
      if (from && p.purchase_date && p.purchase_date < from) return false;
      if (to && p.purchase_date && p.purchase_date > to) return false;
      return true;
    });
  }, [pos, q, fSupplier, fPay, fStatus, from, to]);

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

  const post = async (p) => {
    if (!window.confirm(ar ? 'ترحيل هذا الأمر؟' : 'Post this order?')) return;
    setBusyId(p.id);
    try {
      const out = unwrap(await base44.functions.invoke('postPurchaseOrder', { po_id: p.id }));
      if (out.success === false) throw new Error(out.message);
      toast({ title: ar ? 'تم الترحيل' : 'Posted' });
      load();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (p) => {
    if (!window.confirm(ar ? 'إلغاء هذا الأمر؟ سيتم عكس أثره على المخزون ورصيد المورّد.' : 'Cancel this order? Inventory and supplier balance will be reversed.')) return;
    setBusyId(p.id);
    try {
      const out = unwrap(await base44.functions.invoke('cancelPurchaseOrder', { po_id: p.id }));
      if (out.success === false) throw new Error(out.message);
      toast({ title: ar ? 'تم الإلغاء' : 'Cancelled' });
      load();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const del = async (p) => {
    if (!window.confirm(ar ? 'حذف أمر الشراء؟' : 'Delete this purchase order?')) return;
    setBusyId(p.id);
    try {
      await base44.entities.PurchaseOrder.delete(p.id);
      toast({ title: ar ? 'تم الحذف' : 'Deleted' });
      load();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          ← {t('admin.title')}
        </Link>
        <div className="mt-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">{t('admin.subtitle')}</p>
            <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{ar ? 'أوامر الشراء' : 'Purchase orders'}</h1>
          </div>
          <button onClick={() => navigate('/admin/po/new')} className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">
            <Plus className="w-5 h-5" /> {ar ? 'أمر شراء جديد' : 'New purchase order'}
          </button>
        </div>

        {/* Filters */}
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? 'رقم الأمر / المورّد' : 'PO no. / supplier'} className="w-full h-11 ps-9 pe-3 rounded-2xl bg-mist border border-border text-sm" />
          </div>
          <SheetSelect value={fSupplier} onChange={setFSupplier} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} placeholder={ar ? 'كل الموردين' : 'All suppliers'} label={ar ? 'المورّد' : 'Supplier'} className="h-11 px-4 rounded-2xl bg-mist border border-border text-sm" />
          <SheetSelect value={fPay} onChange={setFPay} options={PO_PAYMENT_STATUSES.map((s) => ({ value: s, label: s }))} placeholder={ar ? 'كل حالات الدفع' : 'All payment'} label={ar ? 'حالة الدفع' : 'Payment'} className="h-11 px-4 rounded-2xl bg-mist border border-border text-sm" />
          <SheetSelect value={fStatus} onChange={setFStatus} options={PO_STATUSES.map((s) => ({ value: s, label: s }))} placeholder={ar ? 'كل الحالات' : 'All status'} label={ar ? 'الحالة' : 'Status'} className="h-11 px-4 rounded-2xl bg-mist border border-border text-sm" />
          <div className="flex gap-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full h-11 px-3 rounded-2xl bg-mist border border-border text-sm" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full h-11 px-3 rounded-2xl bg-mist border border-border text-sm" />
          </div>
        </div>

        {loading ? (
          <div className="mt-12 grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 rounded-3xl bg-mist/60 p-16 text-center">
            <p className="font-heading font-bold text-2xl">{ar ? 'لا توجد أوامر شراء' : 'No purchase orders'}</p>
            <button onClick={() => navigate('/admin/po/new')} className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">
              <Plus className="w-5 h-5" /> {ar ? 'أمر شراء جديد' : 'New purchase order'}
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-3">
            {filtered.map((p) => (
              <div key={p.id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-3xl bg-card border border-border/60 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-bold truncate">{p.po_number}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.supplier_name || '—'} · {p.purchase_date} · {p.created_by_email || ''}
                  </p>
                </div>
                <div className="text-end shrink-0">
                  <p className="font-heading font-extrabold text-cosmic">{formatPrice(p.total)}</p>
                  <p className="text-xs text-muted-foreground">{p.payment_status}</p>
                </div>
                <StatusBadge status={p.status} ar={ar} />
                <div className="flex items-center gap-2 shrink-0">
                  {p.status === 'draft' && (
                    <>
                      <button onClick={() => navigate(`/admin/po/${p.id}`)} className="squish h-10 px-4 rounded-full bg-mist font-heading font-bold text-sm inline-flex items-center gap-1.5">
                        <Pencil className="w-4 h-4" /> <span className="hidden sm:inline">{t('admin.edit')}</span>
                      </button>
                      <button onClick={() => post(p)} disabled={busyId === p.id} className="squish h-10 px-4 rounded-full bg-cosmic text-white font-heading font-bold text-sm inline-flex items-center gap-1.5 disabled:opacity-60">
                        {busyId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} <span className="hidden sm:inline">{ar ? 'ترحيل' : 'Post'}</span>
                      </button>
                      <button onClick={() => del(p)} disabled={busyId === p.id} className="squish grid place-items-center w-10 h-10 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white disabled:opacity-60" aria-label={t('admin.delete')}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {p.status === 'posted' && (
                    <>
                      <button onClick={() => navigate(`/admin/po/${p.id}`)} className="squish h-10 px-4 rounded-full bg-mist font-heading font-bold text-sm inline-flex items-center gap-1.5">
                        <Pencil className="w-4 h-4" /> <span className="hidden sm:inline">{t('admin.view') || t('admin.edit')}</span>
                      </button>
                      <button onClick={() => cancel(p)} disabled={busyId === p.id} className="squish h-10 px-4 rounded-full bg-highlight/40 font-heading font-bold text-sm inline-flex items-center gap-1.5 disabled:opacity-60">
                        {busyId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} <span className="hidden sm:inline">{ar ? 'إلغاء' : 'Cancel'}</span>
                      </button>
                    </>
                  )}
                  {p.status === 'cancelled' && (
                    <button onClick={() => navigate(`/admin/po/${p.id}`)} className="squish h-10 px-4 rounded-full bg-mist font-heading font-bold text-sm inline-flex items-center gap-1.5">
                      <Pencil className="w-4 h-4" /> <span className="hidden sm:inline">{t('admin.view') || t('admin.edit')}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

function StatusBadge({ status, ar }) {
  const map = {
    draft: 'bg-mist text-foreground/70',
    posted: 'bg-cosmic/10 text-cosmic',
    cancelled: 'bg-destructive/10 text-destructive',
  };
  const label = { draft: ar ? 'مسودة' : 'Draft', posted: ar ? 'مرحّل' : 'Posted', cancelled: ar ? 'ملغى' : 'Cancelled' }[status] || status;
  return <span className={`shrink-0 inline-flex items-center px-3 h-8 rounded-full text-xs font-heading font-bold ${map[status] || 'bg-mist'}`}>{label}</span>;
}