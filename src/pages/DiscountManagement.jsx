import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock, Plus, Pencil, Trash2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import SheetSelect from '@/components/ui/SheetSelect';
import { usePermissions } from '@/lib/permissions';

export default function DiscountManagement() {
  const { t, formatPrice } = useLanguage();
  const { toast } = useToast();
  const { isOwner } = usePermissions();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', description: '', type: 'percent', value: '', min_subtotal: 0, usage_limit: '', expires_at: '', active: true });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setCodes(await base44.entities.DiscountCode.list('-created_date', 200));
    } catch {
      setCodes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOwner) load();
    else setLoading(false);
  }, [isOwner]);

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={t('discount.title')} />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{t('discount.denied')}</h1>
          <p className="mt-3 text-muted-foreground">{t('discount.deniedDesc')}</p>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">{t('pd.back')}</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const openNew = () => {
    setForm({ code: '', description: '', type: 'percent', value: '', min_subtotal: 0, usage_limit: '', expires_at: '', active: true });
    setEditing('new');
  };
  const openEdit = (c) => {
    setForm({
      code: c.code, description: c.description || '', type: c.type, value: String(c.value),
      min_subtotal: c.min_subtotal || 0, usage_limit: c.usage_limit ? String(c.usage_limit) : '',
      expires_at: c.expires_at || '', active: c.active,
    });
    setEditing(c.id);
  };
  const close = () => setEditing(null);

  const save = async (e) => {
    e.preventDefault();
    if (!form.code.trim() || form.value === '') return;
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim(),
        type: form.type,
        value: Number(form.value) || 0,
        min_subtotal: Number(form.min_subtotal) || 0,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        expires_at: form.expires_at || null,
        active: !!form.active,
      };
      const isNew = editing === 'new';
      if (isNew) payload.used_count = 0;
      const id = isNew ? await base44.entities.DiscountCode.create(payload) : await base44.entities.DiscountCode.update(editing, payload);
      await base44.functions.invoke('logAuditActivity', {
        action: isNew ? 'discount.created' : 'discount.updated',
        target_type: 'discount_code',
        target_id: isNew ? id?.id || '' : editing,
        details: `${payload.code} (${payload.type} ${payload.value})`,
      });
      toast({ title: t('address.saved') });
      close();
      load();
    } catch (err) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(t('discount.confirmDelete'))) return;
    try {
      await base44.entities.DiscountCode.delete(c.id);
      await base44.functions.invoke('logAuditActivity', { action: 'discount.deleted', target_type: 'discount_code', target_id: c.id, details: c.code });
      load();
    } catch (err) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    }
  };

  const fmtVal = (c) => (c.type === 'percent' ? `${c.value}%` : formatPrice(c.value));

  return (
    <div className="min-h-screen bg-background pb-32">
      <PageHeader title={t('discount.title')} />
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-12 md:pl-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">← {t('pd.back')}</Link>
        <div className="mt-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">{t('discount.subtitle')}</p>
            <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{t('discount.title')}</h1>
          </div>
          <button onClick={openNew} className="squish h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center gap-2">
            <Plus className="w-5 h-5" /> {t('discount.add')}
          </button>
        </div>

        {loading ? (
          <div className="mt-10 grid place-items-center py-16"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : codes.length === 0 ? (
          <p className="mt-10 text-center text-muted-foreground py-16">{t('discount.empty')}</p>
        ) : (
          <div className="mt-10 grid sm:grid-cols-2 gap-4">
            {codes.map((c) => (
              <div key={c.id} className="rounded-3xl bg-card border border-border/60 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading font-bold text-lg">{c.code}</p>
                    <p className="text-sm text-muted-foreground">{fmtVal(c)}{c.min_subtotal ? ` · min ${formatPrice(c.min_subtotal)}` : ''}</p>
                    {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${c.active ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                    {c.active ? t('delivery.active') : t('delivery.inactive')}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{c.used_count || 0}{c.usage_limit ? ` / ${c.usage_limit}` : ''} {t('discount.used')}</span>
                  {c.expires_at && <span>{t('discount.expiresAt')}: {c.expires_at}</span>}
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => openEdit(c)} className="h-10 px-4 rounded-full bg-mist text-sm font-heading font-bold inline-flex items-center gap-1.5"><Pencil className="w-4 h-4" /> {t('admin.edit')}</button>
                  <button onClick={() => remove(c)} className="h-10 px-4 rounded-full bg-destructive/10 text-destructive text-sm font-heading font-bold inline-flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> {t('admin.delete')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm grid place-items-center p-4" onClick={close}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={save} className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl float-in max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-extrabold text-xl">{editing === 'new' ? t('discount.new') : t('discount.edit')}</h3>
              <button type="button" onClick={close} className="grid place-items-center w-9 h-9 rounded-full hover:bg-mist"><X className="w-5 h-5" /></button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-foreground/80">{t('discount.code')}<span className="text-accent"> *</span></span>
                <input required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic uppercase" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-foreground/80">{t('discount.description')}</span>
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-medium text-foreground/80">{t('discount.type')}</span>
                  <SheetSelect
                    value={form.type}
                    onChange={(v) => setForm((f) => ({ ...f, type: v }))}
                    placeholder={t('discount.type')}
                    label={t('discount.type')}
                    includeEmpty={false}
                    className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
                    options={[
                      { value: 'percent', label: t('discount.percent') },
                      { value: 'fixed', label: t('discount.fixed') },
                    ]}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-foreground/80">{t('discount.value')}<span className="text-accent"> *</span></span>
                  <input required type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-medium text-foreground/80">{t('discount.minSubtotal')}</span>
                  <input type="number" min="0" step="0.01" value={form.min_subtotal} onChange={(e) => setForm((f) => ({ ...f, min_subtotal: e.target.value }))} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-foreground/80">{t('discount.usageLimit')}</span>
                  <input type="number" min="0" value={form.usage_limit} onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-medium text-foreground/80">{t('discount.expiresAt')}</span>
                <input type="date" value={form.expires_at} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground/80">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="w-4 h-4 rounded" />
                {t('delivery.active')}
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={close} className="flex-1 h-12 rounded-full bg-mist font-heading font-bold">{t('admin.cancel')}</button>
              <button type="submit" disabled={saving} className="flex-1 h-12 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t('admin.save')}
              </button>
            </div>
          </form>
        </div>
      )}
      <Footer />
    </div>
  );
}