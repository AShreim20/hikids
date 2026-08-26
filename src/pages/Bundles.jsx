import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, Lock, Search, Package, X, Power } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  bundleOriginalPrice, bundleSellingPrice, bundleDiscountPercent,
} from '@/lib/bundles';

export default function Bundles() {
  const { user } = useAuth();
  const { t, lang, formatPrice } = useLanguage();
  const { toast } = useToast();
  const ar = lang === 'ar';
  const navigate = useNavigate();
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = () => {
    setLoading(true);
    base44.entities.Bundle.list('-updated_date', 200)
      .then(setBundles)
      .catch(() => setBundles([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
    else setLoading(false);
  }, [user]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...bundles]
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .filter((b) => !term || String(b.name).toLowerCase().includes(term));
  }, [bundles, q]);

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

  const toggleActive = async (b) => {
    try {
      await base44.entities.Bundle.update(b.id, { active: !b.active });
      load();
      toast({ title: ar ? 'تم التحديث' : 'Updated' });
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    }
  };

  const remove = async (b) => {
    if (!window.confirm(ar ? 'حذف هذه الحزمة؟' : 'Delete this bundle?')) return;
    try {
      await base44.entities.Bundle.delete(b.id);
      toast({ title: ar ? 'تم الحذف' : 'Deleted' });
      load();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12 md:pl-16">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">← {t('admin.title')}</Link>
        <div className="mt-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">{ar ? 'حزم المنتجات' : 'Product bundles'}</p>
            <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{ar ? 'الحزم والباقات' : 'Bundles & Packages'}</h1>
          </div>
          <button onClick={() => navigate('/admin/bundle/new')} className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">
            <Plus className="w-5 h-5" /> {ar ? 'حزمة جديدة' : 'New bundle'}
          </button>
        </div>

        <div className="relative mt-8 max-w-md">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? 'بحث عن حزمة' : 'Search bundles'} className="w-full h-11 ps-9 pe-3 rounded-2xl bg-mist border border-border text-sm" />
        </div>

        {loading ? (
          <div className="mt-12 grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 rounded-3xl bg-mist/60 p-16 text-center">
            <Package className="mx-auto w-10 h-10 text-muted-foreground" />
            <p className="mt-4 font-heading font-bold text-2xl">{ar ? 'لا توجد حزم' : 'No bundles'}</p>
            <button onClick={() => navigate('/admin/bundle/new')} className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">
              <Plus className="w-5 h-5" /> {ar ? 'حزمة جديدة' : 'New bundle'}
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-3">
            {filtered.map((b) => {
              const original = bundleOriginalPrice(b);
              const sell = bundleSellingPrice(b);
              const pct = bundleDiscountPercent(b);
              const count = (b.items || []).length;
              return (
                <div key={b.id} className="rounded-3xl bg-card border border-border/60 p-4 sm:p-5 flex flex-wrap items-center gap-4">
                  <div className="shrink-0 w-16 h-16 rounded-2xl overflow-hidden bg-mist">
                    <Image src={b.image_url} alt={b.name} fittingType="fill" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-bold truncate">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{count} {ar ? 'منتج' : 'items'} · {formatPrice(sell)}{pct > 0 && <span className="text-muted-foreground line-through ms-2">{formatPrice(original)}</span>}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center px-2.5 h-8 rounded-full text-xs font-heading font-bold ${b.active ? 'bg-emerald-100 text-emerald-700' : 'bg-mist text-muted-foreground'}`}>
                    {b.active ? t('admin.active') : (ar ? 'موقوف' : 'Inactive')}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleActive(b)} title={b.active ? (ar ? 'إيقاف' : 'Deactivate') : (ar ? 'تفعيل' : 'Activate')} className="squish grid place-items-center w-10 h-10 rounded-full bg-mist hover:bg-accent hover:text-white transition-colors">
                      <Power className="w-4 h-4" />
                    </button>
                    <button onClick={() => navigate(`/admin/bundle/${b.id}`)} className="squish h-10 px-4 rounded-full bg-mist font-heading font-bold text-sm inline-flex items-center gap-1.5">
                      <Pencil className="w-4 h-4" /> <span className="hidden sm:inline">{t('admin.edit')}</span>
                    </button>
                    <button onClick={() => remove(b)} className="squish grid place-items-center w-10 h-10 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors" aria-label={t('admin.delete')}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}