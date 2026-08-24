import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, Lock, LayoutGrid, List } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import ProductListRow from '@/components/admin/ProductListRow';

export default function Admin() {
  const { user } = useAuth();
  const { t, lang, formatPrice } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(() => localStorage.getItem('admin_products_view') || 'grid');

  const setViewMode = (v) => {
    setView(v);
    localStorage.setItem('admin_products_view', v);
  };

  const load = () => {
    setLoading(true);
    base44.entities.Product.list('-updated_date', 100)
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

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12">
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
        ) : view === 'list' ? (
          <div className="mt-10 space-y-3">
            {products.map((p) => (
              <ProductListRow key={p.id} product={p} onEdit={openEdit} onDelete={remove} />
            ))}
          </div>
        ) : (
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p) => (
              <div key={p.id} className="rounded-3xl bg-card border border-border/60 overflow-hidden flex flex-col">
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
                  <p className="mt-1 text-xs text-muted-foreground">{t('pd.inStock')}: {p.stock ?? 0}</p>
                  <div className="mt-auto pt-4 flex gap-2">
                    <button
                      onClick={() => openEdit(p)}
                      className="squish flex-1 h-10 rounded-full bg-mist font-heading font-bold text-sm inline-flex items-center justify-center gap-1.5"
                    >
                      <Pencil className="w-4 h-4" /> {t('admin.edit')}
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
      </div>

      <Footer />
    </div>
  );
}