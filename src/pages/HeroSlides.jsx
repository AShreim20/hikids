import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2, Lock, Check, X } from 'lucide-react';
import { db } from '@/api/entities';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import HeroSlideForm from '@/components/admin/HeroSlideForm';
import CarouselList from '@/components/admin/CarouselList';

export default function HeroSlides() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const ar = lang === 'ar';
  const [slides, setSlides] = useState([]); // last saved order
  const [order, setOrder] = useState([]); // working (drag) order
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // 'new' | slide object

  const load = () => {
    setLoading(true);
    db.HeroSlide.list('sort_order', 50)
      .then((list) => { setSlides(list); setOrder(list); })
      .catch(() => { setSlides([]); setOrder([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
    else setLoading(false);
  }, [user]);

  const dirty = useMemo(() => {
    if (slides.length !== order.length) return true;
    return order.some((s, i) => s.id !== slides[i]?.id);
  }, [slides, order]);

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
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">{t('pd.back')}</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const remove = async (s) => {
    if (!window.confirm(ar ? 'حذف هذه الشريحة؟' : 'Delete this slide?')) return;
    try {
      await db.HeroSlide.delete(s.id);
      toast({ title: ar ? 'تم الحذف' : 'Deleted' });
      load();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    }
  };

  const saveOrder = async () => {
    setSaving(true);
    try {
      const updates = order.map((s, i) => ({ id: s.id, sort_order: i }));
      await db.HeroSlide.bulkUpdate(updates);
      setSlides(order); // commit working order as saved
      toast({ title: ar ? 'تم حفظ الترتيب' : 'Order saved' });
    } catch (err) {
      toast({ title: ar ? 'تعذّر حفظ الترتيب' : 'Could not save order', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const cancelOrder = () => setOrder(slides);

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-12 md:pl-16">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          ← {t('admin.title')}
        </Link>
        <div className="mt-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">{t('admin.subtitle')}</p>
            <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{ar ? 'شرائح الصفحة الرئيسية' : 'Homepage carousel'}</h1>
          </div>
          {!editing && (
            <button onClick={() => setEditing('new')} className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">
              <Plus className="w-5 h-5" /> {ar ? 'شريحة جديدة' : 'New slide'}
            </button>
          )}
        </div>

        {editing && (
          <div className="mt-8">
            <HeroSlideForm
              initial={editing === 'new' ? null : editing}
              onSaved={() => { setEditing(null); load(); }}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}

        {!editing && (loading ? (
          <div className="mt-12 grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : slides.length === 0 ? (
          <div className="mt-10 rounded-3xl bg-mist/60 p-16 text-center">
            <p className="font-heading font-bold text-2xl">{ar ? 'لا توجد شرائح بعد' : 'No slides yet'}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {ar ? 'تعرض الصفحة الرئيسية المنتجات المميزة حتى تضيف شرائح.' : 'The homepage shows featured products until you add slides.'}
            </p>
          </div>
        ) : (
          <>
            {dirty && (
              <div className="mt-6 flex items-center gap-3 flex-wrap rounded-3xl bg-highlight/40 border border-highlight/60 p-3 sm:p-4">
                <span className="text-sm font-medium flex-1 min-w-[12rem]">
                  {ar ? 'لديك تغييرات غير محفوظة في الترتيب' : 'You have unsaved order changes'}
                </span>
                <button
                  onClick={saveOrder}
                  disabled={saving}
                  className="squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold text-sm disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {ar ? 'حفظ الترتيب' : 'Save order'}
                </button>
                <button
                  onClick={cancelOrder}
                  disabled={saving}
                  className="squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-mist font-heading font-bold text-sm disabled:opacity-60"
                >
                  <X className="w-4 h-4" /> {t('admin.cancel')}
                </button>
              </div>
            )}
            <CarouselList items={order} onReorder={setOrder} onEdit={(s) => setEditing(s)} onDelete={remove} />
          </>
        ))}
      </div>
      <Footer />
    </div>
  );
}