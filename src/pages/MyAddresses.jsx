import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, Pencil, Trash2, X, Star, MapPin } from 'lucide-react';
import { db } from '@/api/entities';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/PageHeader';
import SheetSelect from '@/components/ui/SheetSelect';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

export default function MyAddresses() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [addresses, setAddresses] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ label: 'Home', recipient_name: '', phone: '', city: '', street: '', details: '', is_default: false });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [a, c] = await Promise.all([
        db.Address.list('-created_date', 100),
        db.DeliveryCity.filter({ active: true }).catch(() => []),
      ]);
      setAddresses(a);
      setCities(c);
    } catch {
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) load();
    else setLoading(false);
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={t('address.title')} />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <h1 className="font-heading font-extrabold text-3xl">{t('address.signIn')}</h1>
          <Link to="/login" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">{t('settings.signIn')} →</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const openNew = () => {
    setForm({ label: 'Home', recipient_name: user?.full_name || '', phone: '', city: '', street: '', details: '', is_default: addresses.length === 0 });
    setEditing('new');
  };
  const openEdit = (a) => {
    setForm({ label: a.label || 'Home', recipient_name: a.recipient_name, phone: a.phone, city: a.city, street: a.street, details: a.details || '', is_default: !!a.is_default });
    setEditing(a.id);
  };
  const close = () => setEditing(null);

  const save = async (e) => {
    e.preventDefault();
    if (!form.recipient_name || !form.phone || !form.city || !form.street) return;
    setSaving(true);
    try {
      const payload = { ...form };
      const isNew = editing === 'new';
      if (isNew) await db.Address.create(payload);
      else await db.Address.update(editing, payload);
      if (payload.is_default) {
        const others = addresses.filter((a) => a.id !== editing && a.is_default);
        await db.Address.bulkUpdate(others.map((a) => ({ id: a.id, is_default: false }))).catch(() => {});
      }
      toast({ title: t('address.saved') });
      close();
      load();
    } catch (err) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a) => {
    if (!window.confirm(t('address.confirmDelete'))) return;
    try {
      await db.Address.delete(a.id);
      load();
    } catch (err) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <PageHeader title={t('address.title')} />
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">← {t('pd.back')}</Link>
        <div className="mt-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">{t('address.subtitle')}</p>
            <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{t('address.title')}</h1>
          </div>
          <button onClick={openNew} className="squish h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center gap-2">
            <Plus className="w-5 h-5" /> {t('address.add')}
          </button>
        </div>

        {loading ? (
          <div className="mt-10 grid place-items-center py-16"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : addresses.length === 0 ? (
          <p className="mt-10 text-center text-muted-foreground py-16">{t('address.empty')}</p>
        ) : (
          <div className="mt-10 grid sm:grid-cols-2 gap-4">
            {addresses.map((a) => (
              <div key={a.id} className="rounded-3xl bg-card border border-border/60 p-5">
                <div className="flex items-start gap-3">
                  <div className="grid place-items-center w-11 h-11 rounded-2xl bg-cosmic/15 text-cosmic shrink-0"><MapPin className="w-5 h-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-heading font-bold">{a.label || a.city}</p>
                      {a.is_default && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[11px] font-bold"><Star className="w-3 h-3" /> {t('address.default')}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground">{a.recipient_name} · {a.phone}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{a.city}, {a.street}{a.details ? ` — ${a.details}` : ''}</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => openEdit(a)} className="h-10 px-4 rounded-full bg-mist text-sm font-heading font-bold inline-flex items-center gap-1.5"><Pencil className="w-4 h-4" /> {t('admin.edit')}</button>
                  <button onClick={() => remove(a)} className="h-10 px-4 rounded-full bg-destructive/10 text-destructive text-sm font-heading font-bold inline-flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> {t('admin.delete')}</button>
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
              <h3 className="font-heading font-extrabold text-xl">{editing === 'new' ? t('address.add') : t('admin.edit')}</h3>
              <button type="button" onClick={close} className="grid place-items-center w-9 h-9 rounded-full hover:bg-mist"><X className="w-5 h-5" /></button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-foreground/80">{t('address.label')}</span>
                <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-foreground/80">{t('address.recipient')}<span className="text-accent"> *</span></span>
                <input required value={form.recipient_name} onChange={(e) => setForm((f) => ({ ...f, recipient_name: e.target.value }))} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-foreground/80">{t('address.phone')}<span className="text-accent"> *</span></span>
                <input required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-foreground/80">{t('address.city')}<span className="text-accent"> *</span></span>
                <SheetSelect
                  value={form.city}
                  onChange={(v) => setForm((f) => ({ ...f, city: v }))}
                  placeholder={t('checkout.selectCity')}
                  label={t('address.city')}
                  required
                  className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
                  options={cities.map((c) => ({ value: c.name, label: c.name }))}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-foreground/80">{t('address.street')}<span className="text-accent"> *</span></span>
                <input required value={form.street} onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-foreground/80">{t('address.details')}</span>
                <input value={form.details} onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))} className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic" />
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground/80">
                <input type="checkbox" checked={form.is_default} onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))} className="w-4 h-4 rounded" />
                {t('address.default')}
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