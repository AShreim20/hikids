import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock, Plus, Pencil, Trash2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/lib/permissions';

export default function DeliveryManagement() {
  const { t, formatPrice } = useLanguage();
  const { toast } = useToast();
  const { isOwner } = usePermissions();
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', price: '', estimated_days: 1, active: true });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setCities(await base44.entities.DeliveryCity.list('-created_date', 200));
    } catch {
      setCities([]);
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
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{t('delivery.denied')}</h1>
          <p className="mt-3 text-muted-foreground">{t('delivery.deniedDesc')}</p>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">
            {t('pd.back')}
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const openNew = () => {
    setForm({ name: '', price: '', estimated_days: 1, active: true });
    setEditing('new');
  };
  const openEdit = (c) => {
    setForm({ name: c.name, price: String(c.price), estimated_days: c.estimated_days, active: c.active });
    setEditing(c.id);
  };
  const close = () => setEditing(null);

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.price === '') return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        price: Number(form.price) || 0,
        estimated_days: Number(form.estimated_days) || 1,
        active: !!form.active,
      };
      const isNew = editing === 'new';
      const id = isNew ? await base44.entities.DeliveryCity.create(payload) : await base44.entities.DeliveryCity.update(editing, payload);
      await base44.functions.invoke('logAuditActivity', {
        action: isNew ? 'delivery.city_created' : 'delivery.city_updated',
        target_type: 'delivery_city',
        target_id: isNew ? id?.id || '' : editing,
        details: `${form.name} = ${formatPrice(payload.price)}`,
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
    if (!window.confirm(t('delivery.confirmDelete'))) return;
    try {
      await base44.entities.DeliveryCity.delete(c.id);
      await base44.functions.invoke('logAuditActivity', {
        action: 'delivery.city_deleted', target_type: 'delivery_city', target_id: c.id, details: c.name,
      });
      load();
    } catch (err) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-12 md:pl-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          ← {t('pd.back')}
        </Link>
        <div className="mt-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">{t('delivery.subtitle')}</p>
            <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{t('delivery.title')}</h1>
          </div>
          <button onClick={openNew} className="squish h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center gap-2">
            <Plus className="w-5 h-5" /> {t('delivery.add')}
          </button>
        </div>

        {loading ? (
          <div className="mt-10 grid place-items-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-cosmic" />
          </div>
        ) : cities.length === 0 ? (
          <p className="mt-10 text-center text-muted-foreground py-16">{t('delivery.empty')}</p>
        ) : (
          <div className="mt-10 grid sm:grid-cols-2 gap-4">
            {cities.map((c) => (
              <div key={c.id} className="rounded-3xl bg-card border border-border/60 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading font-bold text-lg">{c.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(c.price)} · {c.estimated_days} {t('common.days')}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${c.active ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                    {c.active ? t('delivery.active') : t('delivery.inactive')}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => openEdit(c)} className="h-10 px-4 rounded-full bg-mist text-sm font-heading font-bold inline-flex items-center gap-1.5">
                    <Pencil className="w-4 h-4" /> {t('admin.edit')}
                  </button>
                  <button onClick={() => remove(c)} className="h-10 px-4 rounded-full bg-destructive/10 text-destructive text-sm font-heading font-bold inline-flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4" /> {t('admin.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm grid place-items-center p-4" onClick={close}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={save}
            className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl float-in"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-extrabold text-xl">{editing === 'new' ? t('delivery.new') : t('delivery.edit')}</h3>
              <button type="button" onClick={close} className="grid place-items-center w-9 h-9 rounded-full hover:bg-mist"><X className="w-5 h-5" /></button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-foreground/80">{t('delivery.name')}</span>
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-medium text-foreground/80">{t('delivery.price')}</span>
                  <input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-foreground/80">{t('delivery.eta')}</span>
                  <input type="number" min="0" value={form.estimated_days} onChange={(e) => setForm((f) => ({ ...f, estimated_days: e.target.value }))} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground/80">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="w-4 h-4 rounded" />
                {t('delivery.active')}
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={close} className="flex-1 h-12 rounded-full bg-mist font-heading font-bold">{t('admin.cancel')}</button>
              <button type="submit" disabled={saving} className="flex-1 h-12 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {t('admin.save')}
              </button>
            </div>
          </form>
        </div>
      )}
      <Footer />
    </div>
  );
}