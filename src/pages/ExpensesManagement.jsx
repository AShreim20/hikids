import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, Lock, Search, Receipt, X, Eye, FolderTree, FileSpreadsheet } from 'lucide-react';
import { db } from '@/api/entities';
import { useAdminLoadGuard } from '@/hooks/useAdminLoadGuard';
import AdminLoadFailed from '@/components/admin/AdminLoadFailed';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/lib/permissions';
import FormInput from '@/components/admin/FormInput';
import SheetSelect from '@/components/ui/SheetSelect';
import { PeriodSelector } from '@/components/reports/ReportShared';
import { periodRange, inRange } from '@/lib/reports';
import { PAYMENT_METHODS } from '@/lib/po';
import ExcelExportDialog from '@/components/admin/ExcelExportDialog';
import { expenseExportDialogProps } from '@/lib/expensesExportFields';

const SORT_OPTIONS = [
  { value: '-expense_date', label: 'date_desc' },
  { value: 'expense_date', label: 'date_asc' },
  { value: '-amount', label: 'amount_desc' },
  { value: 'amount', label: 'amount_asc' },
];

const blankForm = { expense_date: new Date().toISOString().slice(0, 10), category_id: '', amount: '', payment_method: '', description: '', notes: '' };

export default function ExpensesManagement() {
  const { t, lang, formatPrice } = useLanguage();
  const { toast } = useToast();
  const { can } = usePermissions();
  const ar = lang === 'ar';
  const canView = can('expenses.view');
  const canManage = can('expenses.manage');

  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [period, setPeriod] = useState('month');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [sort, setSort] = useState('-expense_date');

  const [editing, setEditing] = useState(null); // expense row | 'new' | null
  const [viewing, setViewing] = useState(null); // expense row | null (read-only)
  const [exportOpen, setExportOpen] = useState(false);

  const { failure, guard } = useAdminLoadGuard();

  const load = async () => {
    setLoading(true);
    try {
      const res = await guard(() => Promise.all([
        db.Expense.list('-expense_date', 500),
        db.ExpenseCategory.list('sort_order', 200),
      ]));
      if (!res) return;
      const [exp, cats] = res;
      setExpenses(exp || []);
      setCategories(cats || []);
      // Best-effort: a non-admin staff member with only expenses.manage can't
      // list every profile (profiles_read_own_or_admin RLS), so "Created by"
      // falls back to a short id in that case rather than blocking the page.
      try {
        setProfiles(await db.Profile.list('-created_at', 500));
      } catch {
        setProfiles([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) load();
    else setLoading(false);
  }, [canView]);

  const categoryMap = useMemo(() => {
    const m = {};
    for (const c of categories) m[c.id] = c;
    return m;
  }, [categories]);

  const profileMap = useMemo(() => {
    const m = {};
    for (const p of profiles) m[p.id] = p;
    return m;
  }, [profiles]);

  const categoryLabel = (c) => (c ? (ar ? c.name : (c.name_en || c.name)) : t('expenses.uncategorized'));
  const creatorLabel = (id) => {
    if (!id) return '—';
    const p = profileMap[id];
    if (!p) return id.slice(0, 8);
    return p.full_name || p.email || id.slice(0, 8);
  };

  const range = useMemo(() => periodRange(period, custom), [period, custom]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let rows = expenses.filter((e) => inRange(e.expense_date || e.created_date, range));
    if (categoryFilter) rows = rows.filter((e) => e.category_id === categoryFilter);
    if (term) {
      rows = rows.filter((e) => {
        const cat = categoryMap[e.category_id];
        const haystack = [e.reference, e.description, e.notes, cat?.name, cat?.name_en]
          .filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(term);
      });
    }
    const desc = sort.startsWith('-');
    const key = desc ? sort.slice(1) : sort;
    rows = [...rows].sort((a, b) => {
      const av = key === 'amount' ? Number(a.amount) || 0 : (a[key] || '');
      const bv = key === 'amount' ? Number(b.amount) || 0 : (b[key] || '');
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return desc ? -cmp : cmp;
    });
    return rows;
  }, [expenses, range, categoryFilter, q, categoryMap, sort]);

  const total = useMemo(() => filtered.reduce((s, e) => s + (Number(e.amount) || 0), 0), [filtered]);

  if (failure) return <AdminLoadFailed failure={failure} onRetry={load} />;

  if (!canView) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10"><Lock className="w-8 h-8 text-destructive" /></div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{t('expenses.denied')}</h1>
          <p className="mt-3 text-muted-foreground">{t('expenses.deniedDesc')}</p>
        </div>
        <Footer />
      </div>
    );
  }

  const openNew = () => setEditing({ ...blankForm, _isNew: true });
  const openEdit = (e) => setEditing({
    id: e.id,
    expense_date: e.expense_date,
    category_id: e.category_id || '',
    amount: String(e.amount),
    payment_method: e.payment_method || '',
    description: e.description || '',
    notes: e.notes || '',
  });
  const close = () => setEditing(null);

  const remove = async (e) => {
    if (!window.confirm(t('expenses.confirmDelete'))) return;
    try {
      await db.Expense.delete(e.id);
      await invokeFunction('logAuditActivity', {
        action: 'expense.deleted',
        target_type: 'expense',
        target_id: e.id,
        // Raw number, never formatPrice() — that injects display-only
        // bidi-isolate characters that don't belong in persisted audit text.
        details: `${e.reference}: ₪${Number(e.amount).toFixed(2)}`,
      });
      toast({ title: t('expenses.deleted') });
      load();
    } catch (err) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12 md:pl-16">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">← {t('admin.title')}</Link>
        <div className="mt-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">{t('expenses.subtitle')}</p>
            <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{t('expenses.title')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/admin/expense-categories" className="squish h-12 px-5 rounded-full bg-mist font-heading font-bold inline-flex items-center gap-2">
              <FolderTree className="w-5 h-5" /> {t('expenses.manageCategories')}
            </Link>
            {canManage && (
              <button onClick={openNew} className="squish h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center gap-2">
                <Plus className="w-5 h-5" /> {t('expenses.add')}
              </button>
            )}
          </div>
        </div>

        <div className="mt-6">
          <PeriodSelector period={period} setPeriod={setPeriod} custom={custom} setCustom={setCustom} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('expenses.search')} className="w-full h-11 ps-9 pe-3 rounded-2xl bg-mist border border-border text-sm" />
          </div>
          <SheetSelect
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categories.map((c) => ({ value: c.id, label: categoryLabel(c) }))}
            placeholder={t('expenses.allCategories')}
            label={t('admin.category')}
            includeEmpty
            className="h-11 px-4 rounded-2xl bg-mist border border-border text-sm min-w-[180px]"
          />
          <button onClick={() => setExportOpen(true)} className="squish ms-auto inline-flex items-center gap-2 h-11 px-5 rounded-2xl bg-mist border border-border font-heading font-bold text-sm">
            <FileSpreadsheet className="w-4 h-4" /> {ar ? 'تصدير Excel' : 'Export Excel'}
          </button>
          <SheetSelect
            value={sort}
            onChange={setSort}
            options={SORT_OPTIONS.map((s) => ({ value: s.value, label: t(`expenses.sort.${s.label}`) }))}
            placeholder={t('expenses.sortBy')}
            label={t('expenses.sortBy')}
            includeEmpty={false}
            className="h-11 px-4 rounded-2xl bg-mist border border-border text-sm inline-flex items-center gap-2 min-w-[160px]"
          />
        </div>

        <div className="mt-4 rounded-2xl bg-mist/60 px-5 py-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{filtered.length} {t('expenses.title')}</span>
          <span className="font-heading font-bold">{t('reports.totalExpenses')}: {formatPrice(total)}</span>
        </div>

        {loading ? (
          <div className="mt-10 grid place-items-center py-16"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 rounded-3xl bg-mist/60 p-16 text-center">
            <Receipt className="mx-auto w-10 h-10 text-muted-foreground" />
            <p className="mt-4 font-heading font-bold text-2xl">{t('expenses.empty')}</p>
            {canManage && (
              <button onClick={openNew} className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">
                <Plus className="w-5 h-5" /> {t('expenses.add')}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="mt-8 grid gap-3 lg:hidden">
              {filtered.map((e) => (
                <div key={e.id} className="rounded-3xl bg-card border border-border/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-heading font-bold text-sm" dir="ltr">{e.reference}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">{e.expense_date}</p>
                    </div>
                    <span className="font-heading font-extrabold text-destructive shrink-0"><bdi>-{formatPrice(e.amount)}</bdi></span>
                  </div>
                  <p className="mt-2 text-sm font-medium">{categoryLabel(categoryMap[e.category_id])}</p>
                  {e.description && <p className="mt-1 text-xs text-muted-foreground truncate">{e.description}</p>}
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setViewing(e)} className="h-9 px-3 rounded-full bg-mist text-xs font-heading font-bold inline-flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {t('expenses.view')}</button>
                    {canManage && (
                      <>
                        <button onClick={() => openEdit(e)} className="h-9 px-3 rounded-full bg-mist text-xs font-heading font-bold inline-flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5" /> {t('admin.edit')}</button>
                        <button onClick={() => remove(e)} className="h-9 px-3 rounded-full bg-destructive/10 text-destructive text-xs font-heading font-bold inline-flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> {t('admin.delete')}</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="mt-8 overflow-x-auto hidden lg:block rounded-3xl border border-border/60 bg-card">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border/60">
                    <th className="text-start py-3 px-4">{t('expenses.reference')}</th>
                    <th className="text-start py-3 px-4">{t('expenses.date')}</th>
                    <th className="text-start py-3 px-4">{t('admin.category')}</th>
                    <th className="text-start py-3 px-4">{t('expenses.description')}</th>
                    <th className="text-start py-3 px-4">{t('expenses.paymentMethod')}</th>
                    <th className="text-end py-3 px-4">{t('expenses.amount')}</th>
                    <th className="text-start py-3 px-4">{t('expenses.createdBy')}</th>
                    <th className="text-end py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id} className="border-b border-border/40 last:border-0 hover:bg-mist/40">
                      <td className="py-3 px-4 font-heading font-bold" dir="ltr">{e.reference}</td>
                      <td className="py-3 px-4 text-muted-foreground" dir="ltr">{e.expense_date}</td>
                      <td className="py-3 px-4">{categoryLabel(categoryMap[e.category_id])}</td>
                      <td className="py-3 px-4 text-muted-foreground max-w-[220px] truncate">{e.description || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{e.payment_method || '—'}</td>
                      <td className="py-3 px-4 text-end font-heading font-bold text-destructive"><bdi>-{formatPrice(e.amount)}</bdi></td>
                      <td className="py-3 px-4 text-muted-foreground">{creatorLabel(e.created_by_id)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => setViewing(e)} className="grid place-items-center w-8 h-8 rounded-full hover:bg-mist" aria-label={t('expenses.view')}><Eye className="w-4 h-4" /></button>
                          {canManage && (
                            <>
                              <button onClick={() => openEdit(e)} className="grid place-items-center w-8 h-8 rounded-full hover:bg-mist" aria-label={t('admin.edit')}><Pencil className="w-4 h-4" /></button>
                              <button onClick={() => remove(e)} className="grid place-items-center w-8 h-8 rounded-full hover:bg-destructive/10 text-destructive" aria-label={t('admin.delete')}><Trash2 className="w-4 h-4" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <Footer />

      {editing && canManage && (
        <ExpenseDialog
          initial={editing}
          categories={categories.filter((c) => c.active !== false)}
          categoryLabel={categoryLabel}
          onClose={close}
          onSaved={() => { close(); load(); }}
        />
      )}
      {viewing && (
        <ExpenseDetail
          expense={viewing}
          category={categoryMap[viewing.category_id]}
          categoryLabel={categoryLabel}
          creatorLabel={creatorLabel}
          onClose={() => setViewing(null)}
        />
      )}

      <ExcelExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        {...expenseExportDialogProps({ filteredExpenses: filtered, categoryLabel: (e) => categoryLabel(categoryMap[e.category_id]), creatorLabel })}
      />
    </div>
  );
}

function ExpenseDialog({ initial, categories, categoryLabel, onClose, onSaved }) {
  const { t, lang, formatPrice } = useLanguage();
  const { toast } = useToast();
  const ar = lang === 'ar';
  const isNew = !!initial._isNew;
  const [form, setForm] = useState(() => ({
    expense_date: initial.expense_date || '',
    category_id: initial.category_id || '',
    amount: initial.amount ?? '',
    payment_method: initial.payment_method || '',
    description: initial.description || '',
    notes: initial.notes || '',
  }));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.expense_date) { toast({ title: t('expenses.dateRequired'), variant: 'destructive' }); return; }
    if (!form.category_id) { toast({ title: t('expenses.categoryRequired'), variant: 'destructive' }); return; }
    // Amount: required, must parse as a finite number, and must be strictly
    // positive — rejects blank, non-numeric, zero and negative values before
    // the request ever reaches the database's own `check (amount > 0)`.
    const amount = Number(form.amount);
    if (form.amount === '' || !Number.isFinite(amount) || amount <= 0) {
      toast({ title: t('expenses.amountInvalid'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        expense_date: form.expense_date,
        category_id: form.category_id,
        amount,
        payment_method: form.payment_method || null,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
      };
      const row = isNew ? await db.Expense.create(payload) : await db.Expense.update(initial.id, payload);
      await invokeFunction('logAuditActivity', {
        action: isNew ? 'expense.created' : 'expense.updated',
        target_type: 'expense',
        target_id: row?.id || initial.id || '',
        details: `${row?.reference || ''}: ₪${amount.toFixed(2)}`,
      });
      toast({ title: isNew ? t('expenses.created') : t('expenses.updated') });
      onSaved();
    } catch (err) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-5">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-4 shrink-0">
          <h2 className="font-heading font-extrabold text-2xl">{isNew ? t('expenses.new') : t('expenses.edit')}</h2>
          <button type="button" onClick={onClose} className="grid place-items-center w-10 h-10 rounded-full bg-mist"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 pb-6 overflow-y-auto flex-1 grid gap-4">
          <FormInput label={t('expenses.date')} type="date" required value={form.expense_date} onChange={(e) => set('expense_date', e.target.value)} />

          <label className="block">
            <span className="text-sm font-medium text-foreground/80">{t('admin.category')}<span className="text-accent"> *</span></span>
            <SheetSelect
              value={form.category_id}
              onChange={(v) => set('category_id', v)}
              options={categories.map((c) => ({ value: c.id, label: categoryLabel(c) }))}
              placeholder={ar ? 'اختر فئة' : 'Select a category'}
              label={t('admin.category')}
              includeEmpty
              className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40"
            />
          </label>

          <FormInput
            label={`${t('expenses.amount')} (₪)`}
            type="number"
            required
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
            placeholder="0.00"
          />
          {form.amount !== '' && (Number(form.amount) <= 0 || !Number.isFinite(Number(form.amount))) && (
            <p className="-mt-3 text-xs text-destructive">{t('expenses.amountInvalid')}</p>
          )}

          <label className="block">
            <span className="text-sm font-medium text-foreground/80">{t('expenses.paymentMethod')}</span>
            <SheetSelect
              value={form.payment_method}
              onChange={(v) => set('payment_method', v)}
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
              placeholder={ar ? 'اختر' : 'Select'}
              label={t('expenses.paymentMethod')}
              includeEmpty
              className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40"
            />
          </label>

          <FormInput label={`${t('expenses.description')} — ${t('expenses.optional')}`} value={form.description} onChange={(e) => set('description', e.target.value)} textarea />
          <FormInput label={`${t('expenses.notes')} — ${t('expenses.optional')}`} value={form.notes} onChange={(e) => set('notes', e.target.value)} textarea />

          {form.amount !== '' && Number.isFinite(Number(form.amount)) && Number(form.amount) > 0 && (
            <p className="text-xs text-muted-foreground">{t('expenses.preview')}: <bdi>{formatPrice(Number(form.amount))}</bdi></p>
          )}
        </div>
        <div className="flex gap-3 p-6 pt-0 shrink-0">
          <button type="submit" disabled={saving} className="flex-1 h-12 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t('admin.save')}
          </button>
          <button type="button" onClick={onClose} className="h-12 px-6 rounded-full bg-mist font-heading font-bold">{t('admin.cancel')}</button>
        </div>
      </form>
    </div>
  );
}

function ExpenseDetail({ expense, category, categoryLabel, creatorLabel, onClose }) {
  const { t, formatPrice } = useLanguage();
  const Row = ({ label, value, ltr }) => (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-end" dir={ltr ? 'ltr' : undefined}>{value ?? '—'}</span>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-5">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="font-heading font-extrabold text-xl" dir="ltr">{expense.reference}</h2>
          <button type="button" onClick={onClose} className="grid place-items-center w-10 h-10 rounded-full bg-mist"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 pb-6">
          <Row label={t('expenses.date')} value={expense.expense_date} ltr />
          <Row label={t('admin.category')} value={categoryLabel(category)} />
          <Row label={t('expenses.amount')} value={<bdi>{formatPrice(expense.amount)}</bdi>} />
          <Row label={t('expenses.paymentMethod')} value={expense.payment_method || '—'} />
          <Row label={t('expenses.description')} value={expense.description} />
          <Row label={t('expenses.notes')} value={expense.notes} />
          <Row label={t('expenses.createdBy')} value={creatorLabel(expense.created_by_id)} />
          <Row label={t('expenses.createdDate')} value={(expense.created_date || '').slice(0, 10)} ltr />
        </div>
      </div>
    </div>
  );
}
