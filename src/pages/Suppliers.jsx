import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Lock, Loader2 } from 'lucide-react';
import { db } from '@/api/entities';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import SupplierFormDialog from '@/components/po/SupplierFormDialog';
import SupplierDetailDialog from '@/components/po/SupplierDetailDialog';
import { balancesBySupplier } from '@/lib/suppliers';

export default function Suppliers() {
  const { user } = useAuth();
  const { t, lang, formatPrice } = useLanguage();
  const { toast } = useToast();
  const ar = lang === 'ar';

  const [suppliers, setSuppliers] = useState([]);
  const [txs, setTxs] = useState([]);
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      db.Supplier.list('name', 500),
      db.SupplierTransaction.list('-created_date', 500),
      db.PurchaseOrder.list('-created_date', 500),
    ])
      .then(([s, tx, po]) => { setSuppliers(s || []); setTxs(tx || []); setPos(po || []); })
      .catch(() => { setSuppliers([]); setTxs([]); setPos([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
    else setLoading(false);
  }, [user]);

  const balances = useMemo(() => balancesBySupplier(txs), [txs]);
  const detailSupplier = suppliers.find((s) => s.id === detailId) || null;
  const detailTxs = txs.filter((x) => x.supplier_id === detailId);

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

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12 md:pl-16">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          ← {t('admin.title')}
        </Link>
        <div className="mt-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">{t('admin.subtitle')}</p>
            <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{ar ? 'المورّدون' : 'Suppliers'}</h1>
          </div>
          <button onClick={() => { setEditing(null); setFormOpen(true); }} className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">
            <Plus className="w-5 h-5" /> {ar ? 'مورّد جديد' : 'New supplier'}
          </button>
        </div>

        {loading ? (
          <div className="mt-12 grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : suppliers.length === 0 ? (
          <div className="mt-10 rounded-3xl bg-mist/60 p-16 text-center">
            <p className="font-heading font-bold text-2xl">{ar ? 'لا يوجد مورّدون بعد' : 'No suppliers yet'}</p>
            <button onClick={() => { setEditing(null); setFormOpen(true); }} className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">
              <Plus className="w-5 h-5" /> {ar ? 'مورّد جديد' : 'New supplier'}
            </button>
          </div>
        ) : (
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((s) => (
              <button
                key={s.id}
                onClick={() => setDetailId(s.id)}
                className="text-start rounded-3xl bg-card border border-border/60 p-5 hover:border-cosmic/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-heading font-bold truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.contact_person || s.phone || s.email || '—'}</p>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-xs text-muted-foreground">{ar ? 'مستحق' : 'Owed'}</p>
                    <p className={`font-heading font-extrabold ${(balances[s.id] || 0) > 0 ? 'text-cosmic' : 'text-muted-foreground'}`}>
                      {formatPrice(balances[s.id] || 0)}
                    </p>
                  </div>
                </div>
                {s.phone && <p className="mt-3 text-xs text-muted-foreground">{s.phone}</p>}
              </button>
            ))}
          </div>
        )}
      </div>
      <Footer />

      <SupplierFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSaved={() => load()}
      />
      <SupplierDetailDialog
        open={!!detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        supplier={detailSupplier}
        txs={detailTxs}
        pos={pos}
        onChanged={load}
        onDeleted={load}
      />
    </div>
  );
}