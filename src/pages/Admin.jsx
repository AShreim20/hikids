import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, Lock, LayoutGrid, List, Copy, X, Link2, Search, EyeOff } from 'lucide-react';
import { db } from '@/api/entities';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import ProductListRow from '@/components/admin/ProductListRow';
import ExportExcelButton from '@/components/admin/ExportExcelButton';
import { PeriodSelector, StatCard } from '@/components/reports/ReportShared';
import { periodRange, profitLoss, buildProductMap } from '@/lib/reports';
import { fetchAllRows, toExcelDate, todayStamp } from '@/lib/excelExportHelpers';
import { productFeatures, categoryName } from '@/lib/bilingual';
import { ageLabels } from '@/lib/ages';
import { hasVariants, getVariants } from '@/lib/variants';

export default function Admin() {
  const { user } = useAuth();
  const { t, lang, formatPrice } = useLanguage();
  const { toast } = useToast();
  const { categories } = useCategories();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(() => localStorage.getItem('admin_products_view') || 'list');
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  // null | 'delete' | 'unpublish' — which bulk-action confirmation dialog
  // (if any) is open.
  const [confirmAction, setConfirmAction] = useState(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Financial summary row: same profitLoss()/expensesReport() maths as the
  // Reports page, computed here from real orders/expenses so this can never
  // drift from the numbers shown on /admin/reports.
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [finLoading, setFinLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [custom, setCustom] = useState({ from: '', to: '' });

  const setViewMode = (v) => {
    setView(v);
    localStorage.setItem('admin_products_view', v);
  };

  const load = () => {
    setLoading(true);
    db.Product.list('-updated_date', 500)
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
    else setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user?.role !== 'admin') { setFinLoading(false); return; }
    Promise.allSettled([
      db.Order.list('-created_date', 500),
      db.Expense.list('-expense_date', 500),
      db.ExpenseCategory.list('sort_order', 200),
    ])
      .then(([o, exp, cat]) => {
        setOrders(o.status === 'fulfilled' ? o.value || [] : []);
        setExpenses(exp.status === 'fulfilled' ? exp.value || [] : []);
        setExpenseCategories(cat.status === 'fulfilled' ? cat.value || [] : []);
      })
      .finally(() => setFinLoading(false));
  }, [user]);

  const productMap = useMemo(() => buildProductMap(products), [products]);
  const finRange = useMemo(() => periodRange(period, custom), [period, custom]);
  // Used by the Excel export to resolve a product's Additional Categories
  // (stored as ids) to display names — declared here, before the early
  // return below, since it's a hook (must run unconditionally every render).
  const categoryNameById = useMemo(() => {
    const m = {};
    for (const c of categories) m[c.id] = categoryName(c, lang);
    return m;
  }, [categories, lang]);
  const pnl = useMemo(
    () => profitLoss(orders, productMap, finRange, expenses, expenseCategories),
    [orders, productMap, finRange, expenses, expenseCategories]
  );

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
  // One smart field instead of a search-type selector: checks the Arabic
  // name, the English name, every variant's SKU, and every variant's/the
  // product's own barcode — the admin never has to say which kind of value
  // they're typing. This is the old 'all' mode's logic, extended to also
  // cover name_en (the previous 'all' mode never did, so a partial English
  // name only matched via the now-removed dedicated "Name" filter — folding
  // it in here is a genuine capability gain, not just a UI simplification).
  const matches = (p) => {
    const term = q.trim().toLowerCase();
    if (!term) return true;
    const text = [
      p.name || '', p.name_en || '', p.barcode || '',
      ...(Array.isArray(p.variants) ? p.variants.flatMap((v) => [v.sku || '', v.barcode || '']) : []),
    ].join(' ').toLowerCase();
    return text.includes(term);
  };
  const matchesStatus = (p) => {
    if (statusFilter === 'published') return p.status !== 'draft';
    if (statusFilter === 'draft') return p.status === 'draft';
    return true;
  };
  const filtered = products.filter(matches).filter(matchesStatus);
  const draftCount = products.filter((p) => p.status === 'draft').length;
  const publishedCount = products.length - draftCount;
  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (filtered.every((p) => n.has(p.id))) filtered.forEach((p) => n.delete(p.id));
      else filtered.forEach((p) => n.add(p.id));
      return n;
    });
  const clearSel = () => setSelected(new Set());

  // ── Excel export ──────────────────────────────────────────────────────
  // Two sheets from one export: full Product detail (task §5) plus an
  // Inventory/Stock view (task §11) derived from the same rows — both are
  // "the product list", just projected differently, so one export covers
  // both required pages instead of duplicating the fetch/format logic.
  const ar = lang === 'ar';
  const genderLabel = (g) => (g === 'male' ? t('gender.boy') : g === 'female' ? t('gender.girl') : g === 'both' ? t('gender.both') : '');
  const totalStock = (p) => (hasVariants(p) ? getVariants(p).reduce((s, v) => s + (Number(v.stock) || 0), 0) : Number(p.stock) || 0);
  const stockStatusLabel = (stock) => (stock > 0 ? (ar ? 'متوفر' : 'Available') : (ar ? 'غير متوفر' : 'Out of stock'));

  const buildProductRow = (p) => {
    const skus = Array.isArray(p.variants) ? p.variants.map((v) => v.sku).filter(Boolean) : [];
    const extraCats = Array.isArray(p.category_ids) ? p.category_ids.map((id) => categoryNameById[id]).filter(Boolean) : [];
    const stock = totalStock(p);
    return {
      id: p.id,
      name: p.name || '',
      name_en: p.name_en || '',
      sku: skus.join(' | '),
      barcode: p.barcode || '',
      category: p.category || '',
      extra_categories: extraCats.join(' | '),
      gender: genderLabel(p.gender),
      age: ageLabels(p, t),
      price: Number(p.price) || 0,
      sale_price: p.sale_price != null ? Number(p.sale_price) : null,
      unit_cost: p.unit_cost != null ? Number(p.unit_cost) : null,
      stock,
      stock_status: stockStatusLabel(stock),
      status_label: p.status === 'draft' ? t('admin.statusDraft') : t('admin.statusPublished'),
      features: productFeatures(p, lang).join(' | '),
      material: p.material || '',
      tags: Array.isArray(p.tags) ? p.tags.join(' | ') : '',
      created_date: toExcelDate(p.created_date),
      updated_date: toExcelDate(p.updated_date),
    };
  };
  const buildInventoryRow = (p) => {
    const skus = Array.isArray(p.variants) ? p.variants.map((v) => v.sku).filter(Boolean) : [];
    const stock = totalStock(p);
    const unitCost = Number(p.unit_cost) || 0;
    return {
      name: p.name || '',
      sku: skus.join(' | '),
      barcode: p.barcode || '',
      category: p.category || '',
      stock,
      unit_cost: p.unit_cost != null ? unitCost : null,
      price: Number(p.price) || 0,
      inventory_value: stock * unitCost,
      stock_status: stockStatusLabel(stock),
    };
  };
  const productColumns = [
    { header: ar ? 'معرف المنتج' : 'Product ID', key: 'id', width: 24 },
    { header: ar ? 'الاسم (عربي)' : 'Arabic Name', key: 'name', width: 26, wrap: true },
    { header: ar ? 'الاسم (إنجليزي)' : 'English Name', key: 'name_en', width: 26, wrap: true },
    { header: 'SKU', key: 'sku', width: 18, wrap: true },
    { header: ar ? 'الباركود' : 'Barcode', key: 'barcode', width: 16 },
    { header: ar ? 'الفئة الرئيسية' : 'Category', key: 'category', width: 18 },
    { header: ar ? 'فئات إضافية' : 'Additional Categories', key: 'extra_categories', width: 24, wrap: true },
    { header: ar ? 'الجنس' : 'Gender', key: 'gender', width: 10 },
    { header: ar ? 'الفئة العمرية' : 'Age', key: 'age', width: 16 },
    { header: ar ? 'سعر البيع' : 'Selling Price', key: 'price', width: 14, type: 'currency' },
    { header: ar ? 'سعر الخصم' : 'Discount Price', key: 'sale_price', width: 14, type: 'currency' },
    { header: ar ? 'تكلفة الوحدة' : 'Unit Cost', key: 'unit_cost', width: 14, type: 'currency' },
    { header: ar ? 'الكمية' : 'Stock Quantity', key: 'stock', width: 14, type: 'int' },
    { header: ar ? 'حالة المخزون' : 'Stock Status', key: 'stock_status', width: 16 },
    { header: ar ? 'الحالة' : 'Published Status', key: 'status_label', width: 16 },
    { header: ar ? 'المزايا' : 'Features', key: 'features', width: 32, wrap: true },
    { header: ar ? 'الخامة' : 'Material', key: 'material', width: 16 },
    { header: ar ? 'الوسوم' : 'Tags', key: 'tags', width: 22, wrap: true },
    { header: ar ? 'تاريخ الإنشاء' : 'Created Date', key: 'created_date', width: 14, type: 'date' },
    { header: ar ? 'تاريخ التحديث' : 'Updated Date', key: 'updated_date', width: 14, type: 'date' },
  ];
  const inventoryColumns = [
    { header: ar ? 'اسم المنتج' : 'Product Name', key: 'name', width: 26, wrap: true },
    { header: 'SKU', key: 'sku', width: 18, wrap: true },
    { header: ar ? 'الباركود' : 'Barcode', key: 'barcode', width: 16 },
    { header: ar ? 'الفئة' : 'Category', key: 'category', width: 18 },
    { header: ar ? 'المخزون الحالي' : 'Current Stock', key: 'stock', width: 14, type: 'int' },
    { header: ar ? 'تكلفة الوحدة' : 'Unit Cost', key: 'unit_cost', width: 14, type: 'currency' },
    { header: ar ? 'سعر البيع' : 'Selling Price', key: 'price', width: 14, type: 'currency' },
    { header: ar ? 'قيمة المخزون' : 'Inventory Value', key: 'inventory_value', width: 16, type: 'currency' },
    { header: ar ? 'حالة المخزون' : 'Stock Status', key: 'stock_status', width: 16 },
  ];

  const getProductSheets = async (scope) => {
    let rows;
    if (scope === 'selected') {
      rows = products.filter((p) => selected.has(p.id));
      if (!rows.length) {
        toast({ title: ar ? 'لم يتم تحديد أي صف' : 'No rows selected', variant: 'destructive' });
        return null;
      }
    } else {
      // Re-fetch beyond the 500-row on-screen cap so the export is complete
      // even for a catalog larger than what's loaded for display.
      const all = await fetchAllRows(db.Product, '-updated_date');
      rows = scope === 'all' ? all : all.filter(matches).filter(matchesStatus);
    }
    return {
      sheets: [
        { name: ar ? 'المنتجات' : 'Products', columns: productColumns, rows: rows.map(buildProductRow) },
        { name: ar ? 'المخزون' : 'Inventory', columns: inventoryColumns, rows: rows.map(buildInventoryRow) },
      ],
      fileName: `products_${todayStamp()}.xlsx`,
    };
  };

  const remove = async (p) => {
    if (!window.confirm(t('admin.confirmDelete'))) return;
    try {
      await db.Product.delete(p.id);
      await invokeFunction('logAuditActivity', {
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
        await db.Product.create({
          ...rest,
          name: `${p.name} ${suffix}`,
          barcode: '',
          variants: (p.variants || []).map((v) => ({ ...v, sku: '', barcode: '' })),
          // A duplicate always starts as a draft, never auto-published —
          // otherwise a stale copy of a live product could go straight to
          // the storefront before anyone reviews it.
          status: 'draft',
          published_at: null,
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
      for (const p of targets) await db.Product.delete(p.id);
      toast({ title: lang === 'ar' ? `تم حذف ${targets.length} منتج` : `${targets.length} deleted` });
      clearSel();
      setConfirmAction(null);
      load();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  // Bulk "Move to Draft" — the exact same single-field status update
  // ProductEditor's own Unpublish already uses (see performSave/doUnpublish
  // there), just applied to every selected product. Bulk Publish is
  // deliberately NOT offered here: publishing runs required-field validation
  // in ProductEditor (name/price/category/image/description) that has no
  // reusable bulk equivalent, so a bulk publish could push an incomplete
  // draft live — unpublishing has no such validation and is always safe.
  const unpublishSelected = async () => {
    const targets = products.filter((p) => selected.has(p.id));
    if (!targets.length) return;
    setBusy(true);
    try {
      await Promise.all(targets.map((p) => db.Product.update(p.id, { status: 'draft' })));
      toast({ title: lang === 'ar' ? 'تم النقل إلى المسودة' : 'Moved to draft' });
      clearSel();
      setConfirmAction(null);
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
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 md:pl-16">
        {/* Header — back link is small/secondary, title + primary action
            (Add Product) share one row so it's never stranded across a big
            empty gap. */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          ← {t('pd.back')}
        </Link>
        <div className="mt-3 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl md:text-4xl">{t('admin.title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('admin.subtitle')}</p>
          </div>
          <button
            onClick={openNew}
            className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold shrink-0"
          >
            <Plus className="w-5 h-5" /> {t('admin.add')}
          </button>
        </div>

        {/* ── Quick Overview ─────────────────────────────────────────── */}
        <section className="mt-8 rounded-3xl bg-card border border-border/60 p-5 sm:p-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-heading font-bold text-xl">{t('admin.quickOverview')}</h2>
            <Link
              to="/admin/reports"
              className="squish inline-flex items-center h-9 px-4 rounded-full bg-mist text-sm font-heading font-bold text-foreground/80 hover:bg-cosmic hover:text-white transition-colors"
            >
              {t('admin.viewFullReport')}
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <PeriodSelector period={period} setPeriod={setPeriod} custom={custom} setCustom={setCustom} />
          </div>
          {finLoading ? (
            <div className="mt-6 grid place-items-center py-10"><Loader2 className="w-6 h-6 animate-spin text-cosmic" /></div>
          ) : (
            <div className="mt-5 grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <StatCard label={t('reports.revenue')} value={formatPrice(pnl.revenue)} />
              <StatCard label={t('reports.cogs')} value={formatPrice(pnl.cogs)} />
              <StatCard label={t('reports.grossProfit')} value={formatPrice(pnl.grossProfit)} accent="cosmic" />
              <StatCard label={t('reports.totalExpenses')} value={formatPrice(pnl.expenses)} accent="destructive" />
              <StatCard label={t('reports.netProfit')} value={formatPrice(pnl.netProfit)} accent={pnl.netProfit >= 0 ? 'cosmic' : 'destructive'} />
            </div>
          )}
        </section>

        {/* ── Products ───────────────────────────────────────────────── */}
        <section className="mt-10 pt-8 border-t border-border/60">
          <h2 className="font-heading font-bold text-xl">{t('admin.productsSection')}</h2>

          {/* Toolbar: one smart search field + List/Grid, then status filters
              on their own line underneath. */}
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 -translate-y-1/2 start-4 w-5 h-5 text-muted-foreground pointer-events-none" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('admin.searchPlaceholder')}
                className="w-full h-12 ps-12 pe-4 rounded-2xl bg-card border border-border/70 focus:border-cosmic outline-none font-body"
              />
            </div>
            <div className="flex items-center gap-1 p-1 rounded-full bg-mist shrink-0">
              <button
                onClick={() => setViewMode('list')}
                aria-label="List view"
                className={`grid place-items-center w-10 h-10 rounded-full transition-colors ${view === 'list' ? 'bg-cosmic text-white' : 'text-foreground/70'}`}
              >
                <List className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                className={`grid place-items-center w-10 h-10 rounded-full transition-colors ${view === 'grid' ? 'bg-cosmic text-white' : 'text-foreground/70'}`}
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1 p-1 rounded-full bg-mist w-fit max-w-full overflow-x-auto">
              {[
                ['all', `${t('admin.filterAll')} (${products.length})`],
                ['published', `${t('admin.filterPublished')} (${publishedCount})`],
                ['draft', `${t('admin.filterDraft')} (${draftCount})`],
              ].map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setStatusFilter(m)}
                  className={`shrink-0 h-9 px-3 rounded-full text-xs font-heading font-bold transition-colors ${statusFilter === m ? 'bg-cosmic text-white' : 'text-foreground/70'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <ExportExcelButton
              getSheets={getProductSheets}
              scopes={selected.size > 0 ? ['filtered', 'all', 'selected'] : ['filtered', 'all']}
            />
          </div>

          {/* Select all + visible count — lives with the list, not the search. */}
          {!loading && products.length > 0 && filtered.length > 0 && (
            <div className="mt-5 flex items-center justify-between flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-5 h-5 rounded accent-cosmic" />
                {t('admin.selectAll')}
              </label>
              <span className="text-sm text-muted-foreground">
                {filtered.length} {lang === 'ar' ? 'منتج' : filtered.length === 1 ? 'product' : 'products'}
              </span>
            </div>
          )}

          {/* Contextual bulk-action bar — only exists once something is selected. */}
          {selected.size > 0 && (
            <div className="mt-4 rounded-2xl bg-cosmic/10 border border-cosmic/20 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-heading font-bold text-sm">{t('admin.selectedCount').replace('{n}', selected.size)}</span>
                <button onClick={clearSel} aria-label={t('admin.cancel')} className="squish grid place-items-center w-8 h-8 rounded-full bg-card text-foreground hover:bg-mist shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  onClick={duplicateSelected}
                  disabled={busy}
                  className="squish inline-flex items-center gap-2 h-10 px-4 rounded-full bg-card font-heading font-bold text-sm disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                  {t('admin.duplicate')}
                </button>
                <button
                  onClick={() => setConfirmAction('unpublish')}
                  disabled={busy}
                  className="squish inline-flex items-center gap-2 h-10 px-4 rounded-full bg-card font-heading font-bold text-sm disabled:opacity-60"
                >
                  <EyeOff className="w-4 h-4" /> {t('admin.bulkUnpublish')}
                </button>
                <button
                  onClick={() => setConfirmAction('delete')}
                  disabled={busy}
                  className="squish inline-flex items-center gap-2 h-10 px-4 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white font-heading font-bold text-sm transition-colors disabled:opacity-60"
                >
                  <Trash2 className="w-4 h-4" /> {t('admin.deleteSelected')}
                </button>
              </div>
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
                      <span className={`absolute top-3 end-3 px-2.5 py-1 rounded-full text-[10px] font-heading font-bold backdrop-blur-sm ${p.status === 'draft' ? 'bg-accent/90 text-white' : 'bg-cosmic/80 text-white'}`}>
                        {p.status === 'draft' ? t('admin.statusDraft') : t('admin.statusPublished')}
                      </span>
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
        </section>
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-50 grid place-items-center p-5">
          <div className="absolute inset-0 bg-black/40" onClick={() => !busy && setConfirmAction(null)} />
          <div className="relative w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl">
            <h2 className={`font-heading font-extrabold text-2xl ${confirmAction === 'delete' ? 'text-destructive' : ''}`}>
              {confirmAction === 'delete' ? t('admin.confirmDeleteBulkTitle') : t('admin.confirmUnpublishBulkTitle')}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {(confirmAction === 'delete' ? t('admin.confirmDeleteBulkBody') : t('admin.confirmUnpublishBulkBody')).replace('{n}', selected.size)}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={confirmAction === 'delete' ? deleteSelected : unpublishSelected}
                disabled={busy}
                className={`flex-1 h-12 rounded-full font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60 ${
                  confirmAction === 'delete' ? 'bg-destructive text-white' : 'bg-accent text-white'
                }`}
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirmAction === 'delete' ? t('admin.deleteSelected') : t('admin.bulkUnpublish')}
              </button>
              <button
                onClick={() => setConfirmAction(null)}
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