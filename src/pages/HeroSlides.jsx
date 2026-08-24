import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, Lock, EyeOff } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import HeroSlideForm from '@/components/admin/HeroSlideForm';

export default function HeroSlides() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const ar = lang === 'ar';
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // 'new' | slide object

  const load = () => {
    setLoading(true);
    base44.entities.HeroSlide.list('sort_order', 50)
      .then(setSlides)
      .catch(() => setSlides([]))
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
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">{t('pd.back')}</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const remove = async (s) => {
    if (!window.confirm(ar ? 'حذف هذه الشريحة؟' : 'Delete this slide?')) return;
    try {
      await base44.entities.HeroSlide.delete(s.id);
      toast({ title: ar ? 'تم الحذف' : 'Deleted' });
      load();
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-12">
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

        {loading ? (
          <div className="mt-12 grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : slides.length === 0 ? (
          <div className="mt-10 rounded-3xl bg-mist/60 p-16 text-center">
            <p className="font-heading font-bold text-2xl">{ar ? 'لا توجد شرائح بعد' : 'No slides yet'}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {ar ? 'تعرض الصفحة الرئيسية المنتجات المميزة حتى تضيف شرائح.' : 'The homepage shows featured products until you add slides.'}
            </p>
          </div>
        ) : (
          <div className="mt-10 space-y-3">
            {slides.map((s) => (
              <div key={s.id} className="flex items-center gap-4 p-3 sm:p-4 rounded-3xl bg-card border border-border/60">
                <div className="w-24 h-16 rounded-2xl overflow-hidden bg-mist shrink-0">
                  <Image src={s.image_url} alt={s.title || 'slide'} fittingType="fill" className="w-full h-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-bold truncate">{s.title || (ar ? 'بدون عنوان' : 'Untitled')}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    #{s.sort_order ?? 0}{s.cta_link ? ` · ${s.cta_link}` : ''}
                  </p>
                </div>
                {s.active === false && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-mist text-xs text-muted-foreground shrink-0">
                    <EyeOff className="w-3.5 h-3.5" /> {ar ? 'مخفية' : 'Hidden'}
                  </span>
                )}
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setEditing(s)} className="squish h-10 px-4 rounded-full bg-mist font-heading font-bold text-sm inline-flex items-center gap-1.5">
                    <Pencil className="w-4 h-4" /> <span className="hidden sm:inline">{t('admin.edit')}</span>
                  </button>
                  <button
                    onClick={() => remove(s)}
                    className="squish grid place-items-center w-10 h-10 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors"
                    aria-label={t('admin.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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