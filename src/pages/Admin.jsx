import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, Lock, LayoutGrid, List, Copy, X, Link2, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import ProductListRow from '@/components/admin/ProductListRow';
import VisaPaymentToggle from '@/components/admin/VisaPaymentToggle';

export default function Admin() {
  const { user } = useAuth();
  const { t, lang, formatPrice } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(() => localStorage.getItem('admin_products_view') || 'list');
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('all');

  const setViewMode = (v) => {
    setView(v);
    localStorage.setItem('admin_products_view', v);
  };

  const load = () => {
    setLoading(true);
    base44.entities.Product.list('-updated_date', 500)
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
    else setLoading(false);
  }, [user]);

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{t('admin.denied')}</h1>
          <p className="mt-3 text-muted-foreground">{t('admin.deniedDesc')}</p>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">
            {t('pd.back')}
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const openNew = () => navigate('/admin/product/new');
  const openEdit = (p) => navigate(`/admin/product/${p.id}`);
  const copyLink = (p) => {
    const url = `${window.location.origin}/product/${p.id}`;
    navigator.clipboard.writeText(url).then(() => toast({ title: t('admin.linkCopied') })).catch(() => {});
  };

  const toggle = (id) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const matches = (p) => {
    const term = q.trim().toLowerCase();
    if (!term) return true;
    if (mode === 'name') return (p.name || '').toLowerCase().includes(term);
    if (mode === 'sku') return Array.isArray(p.variants) && p.variants.some((v) => (v.sku || '').toLowerCase().includes(term));
    if (mode === 'barcode') return (p.barcode || '') === q.trim() || (p.barcode || '').toLowerCase() === term;
    const text = [p.name || '', p.barcode || '', ...(Array.isArray(p.variants) ? p.variants.flatMap((v) => [v.sku || '', v.barcode || '']) : [])].join(' ').toLowerCase();
    return text.includes(term);
  };
  const filtered = products.filter(matches);
  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (filtered.every((p) => n.has(p.id))) filtered.forEach((p) => n.delete(p.id));
      else filtered.forEach((p) => n.add(p.id));
      return n;
    });
  const clearSel = () => setSelected(new Set());

  const remove = async (p) => {
    if (!window.confirm(t('admin.confirmDelete'))) return;
    try {
      await base44.entities.Product.delete(p.id);
      await base44.functions.invoke('logAuditActivity', {
        action: 'product.deleted', target_type: 'product', target_id: p.id,
        details: `Deleted product "${p.name}"`,
      });
      toast({ title: lang === 'ar' ? 'تم الحذف' : 'Deleted' });
      load();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    }
  };

  const duplicateSelected = async () => {
    const targets = products.filter((p) => selected.has(p.id));
    if (!targets.length) return;
    setBusy(true);
    try {
      const suffix = lang === 'ar' ? '(نسخة)' : '(copy)';
      for (const p of targets) {
        const { id, created_date, updated_date, created_by_id, ...rest } = p;
        await base44.entities.Product.create({
          ...rest,
          name: `${p.name} ${suffix}`,
          barcode: '',
          variants: (p.variants || []).map((v) => ({ ...v, sku: '', barcode: '' })),
        });
      }
      toast({
        title:
          targets.length === 1
            ? lang === 'ar' ? 'تم نسخ المنتج' : 'Product duplicated'
            : lang === 'ar' ? `تم نسخ ${targets.length} منتج` : `${targets.length} products duplicated`,
      });
      clearSel();
      load();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const deleteSelected = async () => {
    const targets = products.filter((p) => selected.has(p.id));
    setBusy(true);
    try {
      for (const p of targets) await base44.entities.Product.delete(p.id);
      toast({ title: lang === 'ar' ? `تم حذف ${targets.length} منتج` : `${targets.length} deleted` });
      clearSel();
      setConfirmOpen(false);
      load();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12 md:pl-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          ← {t('pd.back')}
        </Link>
        <div className="mt-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">
              {t('admin.subtitle')}
            </p>
            <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{t('admin.title')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 p-1 rounded-full bg-mist">
              <button
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                className={`grid place-items-center w-10 h-10 rounded-full transition-colors ${view === 'grid' ? 'bg-cosmic text-white' : 'text-foreground/70'}`}
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                aria-label="List view"
                className={`grid place-items-center w-10 h-10 rounded-full transition-colors ${view === 'list' ? 'bg-cosmic text-white' : 'text-foreground/70'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={openNew}
              className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold"
            >
              <Plus className="w-5 h-5" /> {t('admin.add')}
            </button>
          </div>
        </div>

        <div className="mt-6 max-w-sm">
          <VisaPaymentToggle />
        </div>

        {/* Merged product search: name, SKU, or barcode (exact for barcode mode). */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-5 h-5 text-muted-foreground pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('admin.searchPlaceholder')}
              className="w-full h-12 ps-12 pe-4 rounded-2xl bg-card border border-border/70 focus:border-cosmic outline-none font-body"
            />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-full bg-mist">
            {[['all', t('admin.searchAll')], ['name', t('admin.searchName')], ['sku', t('admin.searchSku')], ['barcode', t('admin.searchBarcode')]].map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`h-9 px-3 rounded-full text-xs font-heading font-bold transition-colors ${mode === m ? 'bg-cosmic text-white' : 'text-foreground/70'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-sm text-muted-foreground">{filtered.length}/{products.length}</span>
        </div>

        {selected.size > 0 && (
          <div className="mt-6 flex items-center gap-3 flex-wrap rounded-3xl bg-cosmic/10 border border-cosmic/20 p-3 sm:p-4">
            <span className="font-heading font-bold text-sm">
              {selected.size} {t('admin.selected')}
            </span>
            <button
              onClick={duplicateSelected}
              disabled={busy}
              className="squish inline-flex items-center gap-2 h-10 px-4 rounded-full bg-card font-heading font-bold text-sm disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
              {t('admin.duplicate')}
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={busy}
              className="squish inline-flex items-center gap-2 h-10 px-4 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white font-heading font-bold text-sm transition-colors disabled:opacity-60"
            >
              <Trash2 className="w-4 h-4" /> {t('admin.deleteSelected')}
            </button>
            <button onClick={clearSel} className="ms-auto squish grid place-items-center w-10 h-10 rounded-full bg-card text-foreground hover:bg-mist">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="mt-12 grid place-items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cosmic" />
          </div>
        ) : products.length === 0 ? (
          <div className="mt-12 rounded-3xl bg-mist/60 p-16 text-center">
            <p className="font-heading font-bold text-2xl">{t('admin.empty')}</p>
            <button onClick={openNew} className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">
              <Plus className="w-5 h-5" /> {t('admin.add')}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-12 rounded-3xl bg-mist/60 p-16 text-center">
            <p className="font-heading font-bold text-2xl">{t('admin.noResults')}</p>
          </div>
        ) : (
          <>
            <div className="mt-8 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-5 h-5 rounded accent-cosmic" />
                {t('admin.selectAll')}
              </label>
            </div>

            {view === 'list' ? (
              <div className="mt-4 space-y-3">
                {filtered.map((p) => (
                  <ProductListRow
                    key={p.id}
                    product={p}
                    onEdit={openEdit}
                    onDelete={remove}
                    selected={selected.has(p.id)}
                    onToggleSelect={() => toggle(p.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((p) => (
                  <div key={p.id} className="relative rounded-3xl bg-card border border-border/60 overflow-hidden flex flex-col">
                    <div className="absolute top-3 left-3 z-10">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggle(p.id)}
                        className="w-5 h-5 rounded accent-cosmic bg-card/80"
                        aria-label={t('admin.selectAll')}
                      />
                    </div>
                    <div className="relative aspect-[4/3] bg-mist">
                      <Image src={p.image_url} alt={p.name} fittingType="fill" className="w-full h-full" />
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <p className="text-xs text-muted-foreground">{p.category}</p>
                      <p className="mt-1 font-heading font-bold text-lg line-clamp-1">{p.name}</p>
                      <p className="mt-1 font-heading font-extrabold text-cosmic">
                        {formatPrice(p.sale_price ?? p.price)}
                        {p.sale_price != null && p.sale_price < p.price && (
                          <span className="ml-2 text-sm text-muted-foreground line-through">{formatPrice(p.price)}</span>
                        )}
                      </p>
                      {p.unit_cost != null && (
                        <p className="mt-1 text-xs text-muted-foreground">{t('admin.unitCost')}: {formatPrice(p.unit_cost)}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">{t('pd.inStock')}: {p.stock ?? 0}</p>
                      <div className="mt-auto pt-4 flex gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="squish flex-1 h-10 rounded-full bg-mist font-heading font-bold text-sm inline-flex items-center justify-center gap-1.5"
                        >
                          <Pencil className="w-4 h-4" /> {t('admin.edit')}
                        </button>
                        <button
                          onClick={() => copyLink(p)}
                          className="squish grid place-items-center w-10 h-10 rounded-full bg-mist text-foreground hover:bg-cosmic hover:text-white transition-colors"
                          aria-label={t('admin.copyLink')}
                          title={t('admin.copyLink')}
                        >
                          <Link2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => remove(p)}
                          className="squish grid place-items-center w-10 h-10 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors"
                          aria-label={t('admin.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-5">
          <div className="absolute inset-0 bg-black/40" onClick={() => !busy && setConfirmOpen(false)} />
          <div className="relative w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl">
            <h2 className="font-heading font-extrabold text-2xl text-destructive">{t('admin.confirmDeleteBulkTitle')}</h2>
            <p className="mt-3 text-muted-foreground">
              {t('admin.confirmDeleteBulkBody').replace('{n}', selected.size)}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={deleteSelected}
                disabled={busy}
                className="flex-1 h-12 rounded-full bg-destructive text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} {t('admin.deleteSelected')}
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={busy}
                className="h-12 px-6 rounded-full bg-mist font-heading font-bold disabled:opacity-60"
              >
                {t('admin.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}